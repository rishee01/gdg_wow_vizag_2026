import { type Event } from '../telemetry-system'
import { DEPENDENCY_GRAPH, dependsOn } from './config'

export interface DeterministicRCA {
  primaryRootCause: string
  primaryService: string
  secondaryContributors: string[]
  downstreamSymptoms: string[]
  unknownFactors: string[]
  rulesTriggered: string[]
  providerAgreement: {
    providers: string[]
    percentage: number
  }
  blastRadius: {
    affectedCount: number
    percentage: number
    description: string
  }
}

export function runDeterministicRCA(events: Event[]): DeterministicRCA {
  const rulesTriggered: string[] = ['Temporal Ordering Alert Indexing']
  
  if (events.length === 0) {
    return {
      primaryRootCause: 'No active anomalies identified.',
      primaryService: 'Unknown Service',
      secondaryContributors: [],
      downstreamSymptoms: [],
      unknownFactors: [],
      rulesTriggered,
      providerAgreement: { providers: [], percentage: 0 },
      blastRadius: { affectedCount: 0, percentage: 0, description: 'Zero services impacted.' }
    }
  }

  // 1. Gather all services experiencing warnings or errors
  const criticalEvents = events.filter(e => e.severity === 'FATAL' || e.severity === 'ERROR' || e.severity === 'WARN')
  const failedServices = Array.from(new Set(criticalEvents.map(e => e.service)))

  // Sort critical events chronologically (Temporal Ordering)
  const chronoEvents = [...criticalEvents].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  // 2. Identify the earliest service that failed
  const earliestEvent = chronoEvents[0]
  let candidateService = earliestEvent.service
  rulesTriggered.push(`Earliest Critical Event detected on service: ${candidateService}`)

  // 3. Topological Dependency Descent
  let primaryService = candidateService
  let descended = true
  let iterations = 0
  const maxIterations = 10

  while (descended && iterations < maxIterations) {
    descended = false
    iterations++
    
    // Look for any other failed service that this service depends on
    for (const otherService of failedServices) {
      if (otherService !== primaryService && dependsOn(primaryService, otherService)) {
        primaryService = otherService
        descended = true
        rulesTriggered.push(`Topological Dependency Descent: ${primaryService} is a dependency of parent path`)
        break // break inner loop and continue descent from new primary
      }
    }
  }

  // 4. Map technical explanation to primary root cause
  let primaryRootCause = `An outage was detected on ${primaryService}.`
  const primaryEvents = chronoEvents.filter(e => e.service === primaryService)
  const earliestPrimaryEvent = primaryEvents[0] || earliestEvent

  const msg = earliestPrimaryEvent.message.toLowerCase()
  // FIX: leaf node descent postgres check support
  if ((primaryService === 'Orders Service' || primaryService === 'Postgres DB') && (msg.includes('postgres') || msg.includes('db/primary') || msg.includes('database'))) {
    primaryRootCause = 'Main Database Cluster (db-primary-us-east) connection pool overflow or Out-Of-Memory events.'
  } else if ((primaryService === 'Auth Service' || primaryService === 'Redis Cache') && (msg.includes('redis') || msg.includes('cache') || msg.includes('evict'))) {
    primaryRootCause = 'Redis Session Cache memory allocation limit (maxmemory) hit, causing session eviction storm.'
  } else if (msg.includes('notready') || msg.includes('node-2')) {
    primaryRootCause = 'Kubernetes worker node NotReady status, trapping active authentication and database agent pods.'
  } else if (msg.includes('oomkilled') || msg.includes('heap') || msg.includes('memory limit')) {
    primaryRootCause = 'Memory leak in node process router validated-token, triggering Kubernetes OOMKilled evictions.'
  } else if (msg.includes('dns') || msg.includes('coredns') || msg.includes('servfail')) {
    primaryRootCause = 'DNS loop forwarding loop configuration pushed to coredns configmap, causing name server timeouts.'
  } else if (msg.includes('cloudflare') || msg.includes('ssl')) {
    primaryRootCause = 'Bypass of Cloudflare WAF constraints due to direct-to-IP ingress routing targeting internal load balancer.'
  } else {
    primaryRootCause = earliestPrimaryEvent.message
  }

  // 5. Categorize: Secondary Contributors, Downstream Symptoms, Unknown Factors
  const secondaryContributors: string[] = []
  const downstreamSymptoms: string[] = []
  const unknownFactors: string[] = []

  failedServices.forEach(srv => {
    if (srv === primaryService) return

    // Downstream symptom if this service depends on primary
    if (dependsOn(srv, primaryService)) {
      downstreamSymptoms.push(srv)
    } 
    // Connected in dependency graph but not directly upstream
    else if (dependsOn(primaryService, srv)) {
      secondaryContributors.push(srv)
    }
    // Totally disconnected
    else {
      unknownFactors.push(srv)
    }
  })

  if (downstreamSymptoms.length > 0) {
    rulesTriggered.push('Service Relationship Cascading analysis matching upstream nodes')
  }

  // 6. Provider Agreement
  const activeProviders = Array.from(new Set(criticalEvents.map(e => e.provider)))
  const totalProviders = 4 // system, docker, k8s, logs
  const agreementPercentage = Math.round((activeProviders.length / totalProviders) * 100)
  rulesTriggered.push('Provider Agreement cross-correlation checks completed')

  // 7. Blast Radius
  const allCoreServices = ['API Gateway', 'Auth Service', 'Payment Service', 'Orders Service', 'Notification Service', 'Catalog Service']
  const affectedCount = failedServices.length
  const blastPercentage = Math.round((affectedCount / allCoreServices.length) * 100)
  
  let blastDesc = 'Local microservice degradation.'
  if (blastPercentage > 60) {
    blastDesc = `Cluster-wide disruption affecting ${blastPercentage}% of internal infrastructure routes.`
  } else if (blastPercentage > 30) {
    blastDesc = `Cascade checkout route degradation affecting ${affectedCount} upstream systems.`
  }

  return {
    primaryRootCause,
    primaryService,
    secondaryContributors,
    downstreamSymptoms,
    unknownFactors,
    rulesTriggered,
    providerAgreement: {
      providers: activeProviders,
      percentage: agreementPercentage
    },
    blastRadius: {
      affectedCount,
      percentage: blastPercentage,
      description: blastDesc
    }
  }
}
