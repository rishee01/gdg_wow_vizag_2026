export interface TriageResult {
  id: string
  name: string
  rootCause: string
  action: string
}

export function evaluateSystemLogs(logs: string[]): TriageResult {
  let dbCount = 0
  let authCount = 0
  let redisCount = 0
  let networkCount = 0

  logs.forEach((alert) => {
    const lower = alert.toLowerCase()
    if (
      lower.includes('db/primary') ||
      lower.includes('postgres') ||
      lower.includes('deadlock') ||
      lower.includes('max_connections')
    ) {
      dbCount++
    }
    if (
      lower.includes('auth') ||
      lower.includes('jwt') ||
      lower.includes('session store')
    ) {
      authCount++
    }
    if (
      lower.includes('redis') ||
      lower.includes('eviction') ||
      lower.includes('maxmemory')
    ) {
      redisCount++
    }
    if (
      lower.includes('gateway') ||
      lower.includes('timeout') ||
      lower.includes('503') ||
      lower.includes('connection refused') ||
      lower.includes('probe failed')
    ) {
      networkCount++
    }
  })

  const incidentId = 'INC-' + Math.floor(1000 + Math.random() * 9000)
  let name = 'Global Cascading Failure'
  let rootCause =
    'An uncorrelated set of microservice errors has caused a service interruption.'
  let action =
    'Verify network boundaries, monitor pod resource utilization, and check internal DNS routing.'

  const maxVal = Math.max(dbCount, authCount, redisCount, networkCount)
  if (maxVal > 0) {
    if (maxVal === dbCount) {
      name = 'Global Database Cascading Failure'
      rootCause =
        'Main DB Cluster (db/primary) experienced resource exhaustion (99% CPU / Out-Of-Memory event), leading to blocked connections, query deadlocks, and downstream failures.'
      action =
        'Automatically scale main-db-cluster instance tier, clear connection pools, and restart downstream api-gateway pods.'
    } else if (maxVal === redisCount) {
      name = 'Redis Eviction Storm and Session Loss'
      rootCause =
        'The Redis cache and notification store reached its maxmemory allocation limit, inducing eviction storms and causing auth session timeouts and notification packet drops.'
      action =
        'Allocate additional memory to the Redis cluster, tune key eviction policy rules, and flush expired JWT cached instances.'
    } else if (maxVal === authCount) {
      name = 'Authentication Service Key Mismatch'
      rootCause =
        'Auth token verification failed persistently due to cryptographic signature desynchronization. Downstream services rejected API requests, triggering upstream gateway timeouts.'
      action =
        'Synchronize security credentials across authorization pods and trigger a rolling restart of the auth-service.'
    } else if (maxVal === networkCount) {
      name = 'API Gateway Upstream Outage'
      rootCause =
        'The API gateway experienced connection failures and readiness probe timeouts from downstream payments and inventory services, leading to gateway timeouts.'
      action =
        'Inspect security groups and internal cluster DNS resolution, and restart api-gateway pods to restore upstream connections.'
    }
  }

  return {
    id: incidentId,
    name,
    rootCause,
    action,
  }
}
