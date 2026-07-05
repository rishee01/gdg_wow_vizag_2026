import { type Incident, type RecoveryStep } from '@/context/SystemContext'
import { loadHistoricalIncidents } from './persistence'
import { calculateJaccardSimilarity } from './config'

export interface SimilarIncidentResult {
  id: string
  title: string
  similarityScore: number // percentage 0-100
  previousResolution: string
  recoveryTimeMinutes: number
  runbookExecuted: RecoveryStep[]
  recurringPatternDetected: boolean
}

export interface PatternDiagnostic {
  recurringPattern: string
  frequency: string
  trend: 'UPWARD' | 'STABLE' | 'DOWNWARD'
  predictedNext: string
  confidence: number
}

export interface PredictiveInsights {
  probabilityWorsen: number
  probabilityCascade: number
  affectedServices: string[]
  estimatedRecoveryTime: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

// Calculate similarity across multiple factors using shared Jaccard metrics
export function findSimilarIncidents(newIncident: Incident): SimilarIncidentResult[] {
  const history = loadHistoricalIncidents()
  const results: SimilarIncidentResult[] = []

  for (const past of history) {
    if (past.id === newIncident.id) continue

    // 1. Affected Services Overlap (20%)
    const setA = new Set(newIncident.affectedServices.map(s => s.toLowerCase()))
    const setB = new Set(past.affectedServices.map(s => s.toLowerCase()))
    const serviceIntersection = [...setA].filter(x => setB.has(x)).length
    const serviceUnion = new Set([...setA, ...setB]).size
    const serviceScore = serviceUnion > 0 ? serviceIntersection / serviceUnion : 0

    // 2. Evidence Overlap (20%)
    const evidenceIntersection = newIncident.evidence.filter(e1 => 
      past.evidence.some(e2 => e1.toLowerCase().includes(e2.toLowerCase()) || e2.toLowerCase().includes(e1.toLowerCase()))
    ).length
    const evidenceUnion = Math.max(1, newIncident.evidence.length + past.evidence.length - evidenceIntersection)
    const evidenceScore = evidenceIntersection / evidenceUnion

    // 3. Error Messages / Keyword Overlap (15%)
    const errorKeywords = ['oom', 'timeout', 'connection', 'refused', 'exhausted', 'sigkill', 'notready', 'failure', 'handshake']
    const incidentText = (newIncident.title + ' ' + newIncident.rootCause + ' ' + newIncident.summary).toLowerCase()
    const pastText = (past.title + ' ' + past.rootCause + ' ' + past.summary).toLowerCase()
    let errorKeywordMatch = 0
    let totalKeywordsUsed = 0
    for (const kw of errorKeywords) {
      const hasA = incidentText.includes(kw)
      const hasB = pastText.includes(kw)
      if (hasA || hasB) {
        totalKeywordsUsed++
        if (hasA && hasB) errorKeywordMatch++
      }
    }
    const keywordScore = totalKeywordsUsed > 0 ? errorKeywordMatch / totalKeywordsUsed : 0

    // 4. Root Cause Text Similarity (15%)
    const rcScore = calculateJaccardSimilarity(newIncident.rootCause, past.rootCause)

    // 5. Timeline Events Count & Heuristics (10%)
    const timelineSim = Math.min(newIncident.timeline.length, past.timeline.length) / Math.max(1, newIncident.timeline.length, past.timeline.length)

    // 6. Infrastructure Elements (Node/Pod) Matches (10%)
    const getInfra = (ev: string[]) => {
      const infra: string[] = []
      for (const e of ev) {
        const pod = e.match(/pod\/([^\s:]+)/)
        const node = e.match(/node\/([^\s:]+)/)
        if (pod) infra.push(pod[0])
        if (node) infra.push(node[0])
      }
      return infra
    }
    const infraA = getInfra(newIncident.evidence)
    const infraB = getInfra(past.evidence)
    const infraIntersection = infraA.filter(i => infraB.includes(i)).length
    const infraUnion = Math.max(1, infraA.length + infraB.length - infraIntersection)
    const infraScore = infraIntersection / infraUnion

    // 7. Blast Radius (5%)
    const brScore = newIncident.blastRadius === past.blastRadius ? 1.0 : 0.0

    // 8. Severity Similarity (5%)
    const sevScore = newIncident.severity === past.severity ? 1.0 : 0.5

    // Total weighted score
    const similarityScore = Math.round(
      (serviceScore * 0.20 +
       evidenceScore * 0.20 +
       keywordScore * 0.15 +
       rcScore * 0.15 +
       timelineSim * 0.10 +
       infraScore * 0.10 +
       brScore * 0.05 +
       sevScore * 0.05) * 100
    )

    if (similarityScore >= 15) {
      let recoveryTime = 12
      if (past.firstSeen && past.lastSeen) {
        const diffMs = new Date(past.lastSeen).getTime() - new Date(past.firstSeen).getTime()
        recoveryTime = Math.max(1, Math.round(diffMs / 60000))
      }

      let isRecent = false
      if (past.lastSeen) {
        const ageMs = Date.now() - new Date(past.lastSeen).getTime()
        isRecent = ageMs < 7 * 24 * 60 * 60 * 1000
      }

      results.push({
        id: past.id,
        title: past.title,
        similarityScore,
        previousResolution: past.recommendedActions || 'Remediation completed successfully using runbook execution.',
        recoveryTimeMinutes: recoveryTime,
        runbookExecuted: past.recoveryPlan || [],
        recurringPatternDetected: isRecent && similarityScore >= 50
      })
    }
  }

  return results.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 5)
}

// Rule-based diagnostic logic
export function detectPatterns(): PatternDiagnostic[] {
  const history = loadHistoricalIncidents()
  
  // Historical seed patterns
  const standardPatterns: PatternDiagnostic[] = [
    {
      recurringPattern: 'Database Connections Saturation (db-primary) every Monday morning',
      frequency: 'Weekly (Mondays 08:00 - 10:00)',
      trend: 'UPWARD',
      predictedNext: 'Next Monday at 08:30 UTC',
      confidence: 88
    },
    {
      recurringPattern: 'Auth Service Memory Leak (OOMKilled) after continuous deployments',
      frequency: 'Correlated with active code deployments',
      trend: 'STABLE',
      predictedNext: 'Next scheduled Auth Service deployment',
      confidence: 92
    },
    {
      recurringPattern: 'Redis Session Cache Memory Evictions under traffic spikes',
      frequency: 'Event-driven (RPS Peak > 15k)',
      trend: 'UPWARD',
      predictedNext: 'Next promotional campaign peak hours',
      confidence: 85
    },
    {
      recurringPattern: 'Cloudflare Edge SSL Handshake Mismatch (Expiry cycle)',
      frequency: '90-day certificate rotation schedules',
      trend: 'STABLE',
      predictedNext: 'In 43 days (scheduled rotation boundary)',
      confidence: 96
    },
    {
      recurringPattern: 'Local Write-Lock Disk Pressure on storage-node-3',
      frequency: 'Weekly (Sunday night backup windows)',
      trend: 'DOWNWARD',
      predictedNext: 'Next Sunday at 23:00 UTC',
      confidence: 78
    },
    {
      recurringPattern: 'Kubernetes node-2 NotReady heartbeats (Taint Evictions)',
      frequency: 'Irregular (correlated with hypervisor metrics)',
      trend: 'DOWNWARD',
      predictedNext: 'Unscheduled (Estimated within 14 days)',
      confidence: 64
    }
  ]

  let dbCrashCount = 0
  let oomCrashCount = 0
  let redisEvictCount = 0

  for (const past of history) {
    const rc = past.rootCause.toLowerCase()
    if (rc.includes('database') || rc.includes('postgres') || rc.includes('connection')) {
      dbCrashCount++
    }
    if (rc.includes('leak') || rc.includes('oom') || rc.includes('heap')) {
      oomCrashCount++
    }
    if (rc.includes('redis') || rc.includes('eviction') || rc.includes('cache')) {
      redisEvictCount++
    }
  }

  return standardPatterns.map(p => {
    if (p.recurringPattern.includes('Database') && dbCrashCount > 0) {
      return { ...p, confidence: Math.min(99, 85 + dbCrashCount * 3), trend: dbCrashCount > 2 ? 'UPWARD' as const : 'STABLE' as const }
    }
    if (p.recurringPattern.includes('Memory') && oomCrashCount > 0) {
      return { ...p, confidence: Math.min(99, 90 + oomCrashCount * 2) }
    }
    if (p.recurringPattern.includes('Redis') && redisEvictCount > 0) {
      return { ...p, confidence: Math.min(99, 82 + redisEvictCount * 4), trend: redisEvictCount > 2 ? 'UPWARD' as const : 'STABLE' as const }
    }
    return p
  })
}

export function getPredictiveInsights(incident: Incident): PredictiveInsights {
  const rc = incident.rootCause.toLowerCase()
  const severity = incident.severity

  let probabilityWorsen = 15
  let probabilityCascade = 10
  let affectedServices = [...incident.affectedServices]
  let estimatedRecoveryTime = '6 minutes (Estimate)'
  let riskLevel: PredictiveInsights['riskLevel'] = 'LOW'

  if (severity === 'P0') {
    probabilityWorsen = 75
    probabilityCascade = 68
    estimatedRecoveryTime = '14 minutes (Estimate)'
    riskLevel = 'CRITICAL'
  } else if (severity === 'P1') {
    probabilityWorsen = 45
    probabilityCascade = 35
    estimatedRecoveryTime = '10 minutes (Estimate)'
    riskLevel = 'HIGH'
  } else if (severity === 'P2') {
    probabilityWorsen = 25
    probabilityCascade = 15
    estimatedRecoveryTime = '8 minutes (Estimate)'
    riskLevel = 'MEDIUM'
  }

  if (rc.includes('database') || rc.includes('postgres')) {
    probabilityCascade = Math.max(probabilityCascade, 85)
    const downstream = ['Orders Service', 'Payment Service', 'API Gateway']
    downstream.forEach(s => {
      if (!affectedServices.includes(s)) affectedServices.push(s)
    })
    estimatedRecoveryTime = '15 minutes (Estimate)'
    riskLevel = 'CRITICAL'
  } else if (rc.includes('redis') || rc.includes('cache')) {
    probabilityCascade = Math.max(probabilityCascade, 70)
    const downstream = ['Auth Service', 'Notification Service', 'API Gateway']
    downstream.forEach(s => {
      if (!affectedServices.includes(s)) affectedServices.push(s)
    })
    estimatedRecoveryTime = '11 minutes (Estimate)'
    riskLevel = 'HIGH'
  } else if (rc.includes('dns') || rc.includes('coredns')) {
    probabilityCascade = 95
    probabilityWorsen = 90
    estimatedRecoveryTime = '18 minutes (Estimate)'
    riskLevel = 'CRITICAL'
  }

  return {
    probabilityWorsen,
    probabilityCascade,
    affectedServices,
    estimatedRecoveryTime,
    riskLevel
  }
}
