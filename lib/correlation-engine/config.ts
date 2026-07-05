export const DEPENDENCY_GRAPH: Record<string, string[]> = {
  'API Gateway': ['Auth Service', 'Payment Service', 'Orders Service'],
  'Auth Service': ['Redis Cache'],
  'Payment Service': ['Postgres DB'],
  'Orders Service': ['Postgres DB', 'Redis Cache', 'Storage Partition'],
  'Notification Service': ['Redis Cache']
}

export function dependsOn(parent: string, child: string, visited = new Set<string>()): boolean {
  if (parent === child) return true
  if (visited.has(parent)) return false
  visited.add(parent)

  const deps = DEPENDENCY_GRAPH[parent]
  if (!deps) return false

  for (const dep of deps) {
    if (dep === child) return true
    if (dependsOn(dep, child, visited)) return true
  }
  return false
}

export function getRelatedServices(service: string): string[] {
  if (service === 'Postgres DB') return ['Orders Service', 'Payment Service']
  if (service === 'Redis Cache') return ['Auth Service', 'Notification Service']
  return DEPENDENCY_GRAPH[service] || []
}

export function mapToServiceName(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('api-gateway') || lower.includes('gateway')) return 'API Gateway'
  if (lower.includes('auth-service') || lower.includes('auth')) return 'Auth Service'
  if (lower.includes('payment-service') || lower.includes('payments')) return 'Payment Service'
  if (lower.includes('orders-service') || lower.includes('orders')) return 'Orders Service'
  if (lower.includes('notification-service') || lower.includes('notifications')) return 'Notification Service'
  if (lower.includes('catalog-service') || lower.includes('catalog')) return 'Catalog Service'
  if (lower.includes('postgres') || lower.includes('db-primary') || lower.includes('db-') || lower.includes('database')) return 'Orders Service'
  if (lower.includes('redis') || lower.includes('cache')) return 'Auth Service'
  return 'Unknown Service'
}

export function calculateJaccardSimilarity(a: string, b: string): number {
  const cleanWords = (str: string) => 
    str.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3)

  const wordsA = new Set(cleanWords(a))
  const wordsB = new Set(cleanWords(b))
  
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  
  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)))
  const union = new Set([...wordsA, ...wordsB])
  
  return intersection.size / union.size
}
