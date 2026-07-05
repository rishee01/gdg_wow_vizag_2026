export interface BusinessImpactData {
  usersAffected: number
  requestsFailed: number
  servicesImpacted: string[]
  criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  revenueRisk: number
  operationalSeverity: 'P0' | 'P1' | 'P2' | 'P3'
  estimatedMTTR: number // in minutes
  slaImpact: number // percentage points drop or resulting SLA
  assumptions: string[]
}

const SERVICE_RPS: Record<string, number> = {
  'API Gateway': 2450,
  'Auth Service': 2450,
  'Payment Service': 620,
  'Orders Service': 1240,
  'Notification Service': 450,
  'Catalog Service': 3800
}

const SERVICE_REVENUE_RATE: Record<string, number> = {
  'API Gateway': 2100,
  'Auth Service': 980,
  'Payment Service': 1450,
  'Orders Service': 1450,
  'Notification Service': 150,
  'Catalog Service': 50
}

const SERVICE_USERS: Record<string, number> = {
  'API Gateway': 150000,
  'Auth Service': 78000,
  'Payment Service': 42300,
  'Orders Service': 42300,
  'Notification Service': 8500,
  'Catalog Service': 5000
}

export function calculateBusinessImpact(
  services: string[],
  severity: 'P0' | 'P1' | 'P2' | 'P3',
  durationMinutes: number
): BusinessImpactData {
  // 1. Operational Severity
  const operationalSeverity = severity

  // 2. Criticality
  const criticality = severity === 'P0' ? 'CRITICAL' : severity === 'P1' ? 'HIGH' : severity === 'P2' ? 'MEDIUM' : 'LOW'

  // 3. Services Impacted
  const servicesImpacted = [...services]

  // 4. Users Affected (take maximum or sum weighted)
  let usersAffected = 0
  if (services.includes('API Gateway')) {
    usersAffected = SERVICE_USERS['API Gateway']
  } else {
    // Max users among active services
    usersAffected = Math.max(...services.map(s => SERVICE_USERS[s] || 8500), 5000)
  }

  // 5. Revenue Impact Rate & Revenue Risk
  let peakRevenueRate = 0
  services.forEach(s => {
    const rate = SERVICE_REVENUE_RATE[s] || 150
    if (rate > peakRevenueRate) {
      peakRevenueRate = rate
    }
  })
  
  // Calculate total accumulated revenue risk
  const revenueRisk = peakRevenueRate * durationMinutes

  // 6. Requests Failed
  // Requests Failed = RPS * 60 * Duration * ErrorRate
  // If P0, assume error rate of 95% on primary service, if P1 assume 40%, else 10%
  let totalRequestsFailed = 0
  const errorRateMultiplier = severity === 'P0' ? 0.95 : severity === 'P1' ? 0.40 : 0.10

  services.forEach(s => {
    const rps = SERVICE_RPS[s] || 250
    const failedForService = Math.round(rps * 60 * durationMinutes * errorRateMultiplier)
    totalRequestsFailed += failedForService
  })

  // 7. Estimated MTTR (in minutes)
  let estimatedMTTR = 10
  if (services.includes('Postgres DB') || services.some(s => s.toLowerCase().includes('database'))) {
    estimatedMTTR = 18
  } else if (services.includes('API Gateway') && severity === 'P0') {
    estimatedMTTR = 15
  } else if (services.includes('Auth Service') || services.includes('Redis Cache')) {
    estimatedMTTR = 12
  } else if (severity === 'P0') {
    estimatedMTTR = 15
  } else if (severity === 'P1') {
    estimatedMTTR = 10
  } else {
    estimatedMTTR = 8
  }

  // 8. SLA Impact
  // SLA availability drop. Assume typical 30-day window total requests:
  // Baseline: 5,000,000 requests. SLA impact is percent of failed requests.
  const monthlyTotalRequests = 850000000 // 850M requests per month typical scale
  const availabilityDrop = (totalRequestsFailed / monthlyTotalRequests) * 100
  const slaImpact = Math.round(availabilityDrop * 100000) / 100000 // Round to 5 decimals

  // 9. Assumptions Display
  const assumptions = [
    `Baseline traffic load modeled at active telemetry rates (API Gateway: ${SERVICE_RPS['API Gateway']} RPS, Orders: ${SERVICE_RPS['Orders Service']} RPS).`,
    `Revenue risk modeling assumes a standard SRE transactional attribution model ($${peakRevenueRate}/minute checkout transaction density).`,
    `Error multiplier rate set dynamically at ${Math.round(errorRateMultiplier * 100)}% based on SRE Incident Severity status ${severity}.`,
    `SLA impact computed as percentage of failed events relative to a rolling 30-day cluster baseline of 850,000,000 requests.`
  ]

  return {
    usersAffected,
    requestsFailed: totalRequestsFailed,
    servicesImpacted,
    criticality,
    revenueRisk,
    operationalSeverity,
    estimatedMTTR,
    slaImpact,
    assumptions
  }
}
