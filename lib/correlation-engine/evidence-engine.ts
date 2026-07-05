import { type Event } from '../telemetry-system'

export interface EvidenceItem {
  timestamp: string
  provider: 'system' | 'docker' | 'k8s' | 'logs'
  service: string
  event: string
  severity: 'INFO' | 'WARN' | 'ERROR' | 'FATAL'
  weight: 'High' | 'Medium' | 'Low'
  confidenceContribution: number
  explanation: string
}

export function generateEvidence(events: Event[]): EvidenceItem[] {
  if (events.length === 0) return []

  // 1. Remove Duplicates
  // De-duplicate if same provider, service, and message within a 30-second window
  const uniqueEvents: Event[] = []
  
  // Sort events chronologically to process in order
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  for (const event of sortedEvents) {
    const isDup = uniqueEvents.some(ue => {
      const sameService = ue.service === event.service
      const sameProvider = ue.provider === event.provider
      const sameMessage = ue.message.toLowerCase() === event.message.toLowerCase() || 
                          ue.message.toLowerCase().substring(0, 40) === event.message.toLowerCase().substring(0, 40)
      const timeDiff = Math.abs(new Date(ue.timestamp).getTime() - new Date(event.timestamp).getTime())
      
      return sameService && sameProvider && sameMessage && timeDiff < 30000
    })

    if (!isDup) {
      uniqueEvents.push(event)
    }
  }

  // 2. Map and Enrich with Weights, Contributions, and Explanations
  const evidenceList: EvidenceItem[] = uniqueEvents.map(evt => {
    let weight: 'High' | 'Medium' | 'Low' = 'Low'
    let confidenceContribution = 10
    let explanation = 'Uncorrelated system telemetry anomaly.'

    const msg = evt.message.toLowerCase()
    
    // System Metrics
    if (evt.provider === 'system') {
      confidenceContribution = 18
      if (msg.includes('exceeded') || msg.includes('95%') || msg.includes('98%') || msg.includes('99%')) {
        weight = 'High'
        explanation = 'Host system critical utilization limits breached, triggering resource exhaustion.'
      } else {
        weight = 'Medium'
        explanation = 'Host system metrics deviated from steady baseline.'
      }
    } 
    // Docker
    else if (evt.provider === 'docker') {
      confidenceContribution = 20
      if (msg.includes('exited') || msg.includes('dead')) {
        weight = 'High'
        explanation = 'Docker daemon reports container terminated. Process is inactive.'
      } else if (msg.includes('restarting')) {
        weight = 'High'
        explanation = 'Container restarting repeatedly, indicating startup crash or heap loop.'
      } else {
        weight = 'Medium'
        explanation = 'Docker container status changed to warning state.'
      }
    } 
    // Kubernetes
    else if (evt.provider === 'k8s') {
      confidenceContribution = 25
      if (msg.includes('oomkilled') || msg.includes('oom')) {
        weight = 'High'
        explanation = 'Pod terminated by K8s kernel Out-Of-Memory (OOM) killer.'
      } else if (msg.includes('crashloopbackoff')) {
        weight = 'High'
        explanation = 'Pod trapped in failing restart loop. Service is completely down.'
      } else if (msg.includes('restarted')) {
        weight = 'High'
        explanation = 'Kubernetes pod restarted automatically. Downstream symptom of liveness failure.'
      } else {
        weight = 'Medium'
        explanation = 'Kubernetes replica state configuration degraded.'
      }
    } 
    // Logs
    else if (evt.provider === 'logs') {
      confidenceContribution = 22
      if (msg.includes('slots reserved') || msg.includes('max_connections') || msg.includes('postgres') || msg.includes('db/primary')) {
        weight = 'High'
        explanation = 'Earliest failure observed. Critical database cluster pool exhausted.'
      } else if (msg.includes('connection timeout') || msg.includes('timed out') || msg.includes('refused')) {
        weight = 'High'
        explanation = 'Downstream connection error. Pod blocked waiting for database sockets.'
      } else if (msg.includes('502') || msg.includes('503') || msg.includes('500') || msg.includes('gateway')) {
        weight = 'Medium'
        explanation = 'Customer-facing consequence. API Gateway returning HTTP error codes.'
      } else if (msg.includes('crash') || msg.includes('oom') || msg.includes('heap')) {
        weight = 'High'
        explanation = 'Process thread allocation limits breached.'
      } else {
        weight = 'Medium'
        explanation = 'Error log message flagged in application streams.'
      }
    }

    // Format clean timestamp (e.g. HH:MM:SS)
    const dateObj = new Date(evt.timestamp)
    const timeStr = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}:${String(dateObj.getSeconds()).padStart(2, '0')}`

    return {
      timestamp: timeStr,
      provider: evt.provider,
      service: evt.service,
      event: evt.message,
      severity: evt.severity,
      weight,
      confidenceContribution,
      explanation
    }
  })

  // 3. Chronological sorting is already handled.
  return evidenceList
}
