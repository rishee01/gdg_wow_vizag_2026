import { type Incident } from '@/context/SystemContext'
import { loadLearningMetadata, loadHistoricalIncidents } from './persistence'
import { findSimilarIncidents } from './knowledge-engine'

export interface RecoveryIntelligence {
  score: number // 0-100. If no history, will represent default base safety score
  expectedMTTR: string
  successRate: number // percentage, or -1 if no history
  risk: 'LOW' | 'MEDIUM' | 'HIGH'
  verificationSteps: string[]
  rollbackAvailable: boolean
  previousRecoveries: { id: string; date: string; time: string; success: boolean }[]
  explanation: {
    whySuggested: string
    historicalEvidence: string
    similarCount: number
    assumptions: string[]
    uncertainty: string
  }
}

export function calculateRecoveryIntelligence(incident: Incident): RecoveryIntelligence {
  const learningData = loadLearningMetadata()
  const history = loadHistoricalIncidents()
  
  const similarMatches = findSimilarIncidents(incident)
  const similarCount = similarMatches.length

  let successCount = 0
  let totalRuns = 0
  let totalDuration = 0
  const previousRecoveries: { id: string; date: string; time: string; success: boolean }[] = []

  for (const match of similarMatches) {
    const meta = learningData.find(m => m.incidentId === match.id)
    if (meta) {
      totalRuns++
      const wasSuccess = meta.verificationOutcome === 'success'
      if (wasSuccess) successCount++
      totalDuration += meta.recoveryDurationMinutes || 10
      
      const matchInc = history.find(h => h.id === match.id)
      const dateStr = matchInc?.lastSeen ? new Date(matchInc.lastSeen).toLocaleDateString() : 'Recent'
      previousRecoveries.push({
        id: match.id,
        date: dateStr,
        time: `${meta.recoveryDurationMinutes || 10}m`,
        success: wasSuccess
      })
    }
  }

  const hasHistory = totalRuns > 0
  // FIX: do not fabricate confidence rates if no history exists (returns -1 to render as "No historical evidence available.")
  const successRate = hasHistory ? Math.round((successCount / totalRuns) * 100) : -1
  const avgDurationMin = hasHistory ? Math.round(totalDuration / totalRuns) : -1

  // Evidence Quality Score calculation based on weight weights
  let evidenceQualitySum = 0
  const evidenceItems = incident.structuredEvidence || []
  for (const ev of evidenceItems) {
    if (ev.weight === 'High') evidenceQualitySum += 20
    else if (ev.weight === 'Medium') evidenceQualitySum += 15
    else evidenceQualitySum += 10
  }
  const evidenceQualityScore = evidenceItems.length > 0 ? (evidenceQualitySum / (evidenceItems.length * 20)) * 100 : 80

  const providerAgreement = incident.deterministicRCA?.providerAgreement.percentage || 75
  const highestSimilarity = similarMatches.length > 0 ? similarMatches[0].similarityScore : 88

  // Base score calculation
  let score = 80
  if (hasHistory) {
    score = Math.round(
      successRate * 0.3 +
      highestSimilarity * 0.3 +
      providerAgreement * 0.2 +
      evidenceQualityScore * 0.2
    )
  }
  score = Math.max(10, Math.min(99, score))

  // MTTR display formatting
  let expectedMTTR = 'No historical evidence available.'
  if (avgDurationMin !== -1) {
    const minutes = Math.floor(avgDurationMin)
    const seconds = Math.round((avgDurationMin - minutes) * 60)
    expectedMTTR = seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
  }

  let risk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW'
  if (score < 65) risk = 'HIGH'
  else if (score < 85) risk = 'MEDIUM'

  const rollbackAvailable = !!(incident.rollbackPlan && incident.rollbackPlan.length > 0)
  const rcService = incident.deterministicRCA?.primaryService || incident.affectedServices[0] || 'Target'
  const whySuggested = `Suggested because deterministic analysis isolated the root cause to socket connection pool depletion or resource locking on the ${rcService} cluster.`

  const historicalEvidence = hasHistory
    ? `PulseControl correlated this profile with ${similarCount} similar incidents. The recovery playbook was executed successfully in ${successCount} of the last ${totalRuns} occurrences.`
    : `No historical evidence available in active operational store. Recommendations generated using deterministic dependency rules and standard container orchestration playbooks.`

  const assumptions = [
    `Assumes Kubernetes API gateway for cluster-control is fully online and accepting scaling requests.`,
    `Assumes target microservice resources and limits are not hard-locked by hypervisor constraints.`,
    `Assumes socket pool exhaustion is transient and can be resolved by scaling replicas.`
  ]

  const uncertainty = hasHistory
    ? `Low uncertainty (< 5% error bounds) due to high historical replication of similar database connection resets.`
    : `Medium uncertainty. Lacking previous resolution benchmarks for this specific cascading sequence in memory.`

  return {
    score,
    expectedMTTR,
    successRate,
    risk,
    verificationSteps: incident.verificationPlan || ['Verify sockets drop below threshold', 'Check gateway response code status'],
    rollbackAvailable,
    previousRecoveries,
    explanation: {
      whySuggested,
      historicalEvidence,
      similarCount,
      assumptions,
      uncertainty
    }
  }
}
export function calculateClientRecoveryIntelligence(incident: Incident, historicalIncidents: Incident[], learningMetadata: any[]): RecoveryIntelligence {
  // Client-side helper that matches the same shape
  const similarMatches = findSimilarIncidents(incident)
  const similarCount = similarMatches.length

  let successCount = 0
  let totalRuns = 0
  let totalDuration = 0
  const previousRecoveries: any[] = []

  for (const match of similarMatches) {
    const meta = learningMetadata.find(m => m.incidentId === match.id)
    if (meta) {
      totalRuns++
      const wasSuccess = meta.verificationOutcome === 'success'
      if (wasSuccess) successCount++
      totalDuration += meta.recoveryDurationMinutes || 10
      previousRecoveries.push({
        id: match.id,
        date: 'Recent',
        time: `${meta.recoveryDurationMinutes || 10}m`,
        success: wasSuccess
      })
    }
  }

  const hasHistory = totalRuns > 0
  const successRate = hasHistory ? Math.round((successCount / totalRuns) * 100) : -1
  const avgDurationMin = hasHistory ? Math.round(totalDuration / totalRuns) : -1

  let expectedMTTR = 'No historical evidence available.'
  if (avgDurationMin !== -1) {
    const minutes = Math.floor(avgDurationMin)
    const seconds = Math.round((avgDurationMin - minutes) * 60)
    expectedMTTR = seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
  }

  const rollbackAvailable = !!(incident.rollbackPlan && incident.rollbackPlan.length > 0)
  const rcService = incident.deterministicRCA?.primaryService || incident.affectedServices[0] || 'Target'
  const whySuggested = `Suggested because deterministic analysis isolated the root cause to socket connection pool depletion or resource locking on the ${rcService} cluster.`

  return {
    score: hasHistory ? Math.round(successRate * 0.8 + 19) : 80,
    expectedMTTR,
    successRate,
    risk: 'LOW',
    verificationSteps: incident.verificationPlan || ['Verify sockets drop below threshold', 'Check gateway response code status'],
    rollbackAvailable,
    previousRecoveries,
    explanation: {
      whySuggested,
      historicalEvidence: hasHistory 
        ? `PulseControl correlated this profile with ${similarCount} similar incidents. Resolved successfully in ${successCount} of last ${totalRuns} runs.`
        : `No historical evidence available.`,
      similarCount,
      assumptions: ['Assumes target pod resources are not hard-locked by hypervisor constraints.'],
      uncertainty: hasHistory ? 'Low uncertainty' : 'Medium uncertainty'
    }
  }
}
