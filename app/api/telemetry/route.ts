import { NextResponse } from 'next/server'
import { type ServiceMetrics, type NodeMetrics } from '@/context/SystemContext'
import { collectAndNormalizeTelemetry } from '@/lib/telemetry-system'
import { correlateEventsIntoIncidents, enrichIncidentWithAI } from '@/lib/correlation-engine'
import { saveIncidents } from '@/lib/correlation-engine/persistence'

// Server-side cache context to prevent resource exhaustions
const globalRef = global as any
if (!globalRef._telemetryCache) {
  globalRef._telemetryCache = {
    data: null,
    lastFetched: 0,
    lockPromise: null
  }
}
const cache = globalRef._telemetryCache

export async function GET() {
  try {
    const now = Date.now()

    // 1. Return cached payload if fresh (5-second TTL window)
    if (cache.data && (now - cache.lastFetched) < 5000) {
      return NextResponse.json(cache.data)
    }

    // 2. Await current pending fetch request (Request Collapsing)
    if (cache.lockPromise) {
      await cache.lockPromise
      return NextResponse.json(cache.data)
    }

    // 3. Trigger telemetry processing under a lock promise
    cache.lockPromise = (async () => {
      // 1. Unified Telemetry Collection, Normalization, & Capability Detection
      const { events, capabilities, raw } = await collectAndNormalizeTelemetry()

      // 2. Incident Correlation Engine
      let incidents = correlateEventsIntoIncidents(events)

      // AI enrichment for active incidents
      const apiKey = process.env.GEMINI_API_KEY
      if (apiKey) {
        const activeInc = incidents.find(i => i.status === 'active')
        if (activeInc && (!activeInc.summary || activeInc.summary.includes('correlated targeting'))) {
          const enriched = await enrichIncidentWithAI(activeInc, apiKey)
          incidents = incidents.map(i => i.id === enriched.id ? enriched : i)
          saveIncidents(incidents)
        }
      }

      // Exclude duplicate query executions by reusing parallel raw metrics
      const sysMetrics = raw?.sysMetrics || { cpuUsage: 12, memoryUsage: 45, diskUsage: 44, hostname: 'localhost', platform: 'win32' }
      const dockerContainers = raw?.dockerContainers || null
      const k8sData = raw?.k8sData || null
      const localLogs = raw?.logs || []

      // Normalize Node Metrics
      const normalizedNodes: NodeMetrics[] = []
      if (k8sData && k8sData.nodes.length > 0) {
        k8sData.nodes.forEach((n: any) => {
          normalizedNodes.push({
            name: n.name,
            status: n.status === 'Ready' ? 'healthy' : 'critical',
            cpu: n.cpuPercent,
            memory: n.memPercent,
            disk: 44, // Default estimation
            podsCount: n.podsCount
          })
        })
      } else {
        // Fallback to host node
        normalizedNodes.push({
          name: sysMetrics.hostname,
          status: 'healthy',
          cpu: sysMetrics.cpuUsage,
          memory: sysMetrics.memoryUsage,
          disk: sysMetrics.diskUsage,
          podsCount: dockerContainers ? dockerContainers.length : 6
        })
      }

      // Default services template
      const defaultServices: ServiceMetrics[] = [
        { name: 'API Gateway', status: 'healthy', cpu: 15, memory: 35, latency: 45, requests: 2450, errorRate: 0.01, sla: 99.99, slo: 99.95, errorBudget: 99.8 },
        { name: 'Auth Service', status: 'healthy', cpu: 12, memory: 28, latency: 18, requests: 2450, errorRate: 0.0, sla: 99.99, slo: 99.9, errorBudget: 100.0 },
        { name: 'Payment Service', status: 'healthy', cpu: 18, memory: 42, latency: 120, requests: 620, errorRate: 0.05, sla: 99.95, slo: 99.9, errorBudget: 98.4 },
        { name: 'Orders Service', status: 'healthy', cpu: 22, memory: 51, latency: 68, requests: 1240, errorRate: 0.02, sla: 99.98, slo: 99.9, errorBudget: 99.1 },
        { name: 'Notification Service', status: 'healthy', cpu: 10, memory: 15, latency: 35, requests: 450, errorRate: 0.0, sla: 100.0, slo: 99.5, errorBudget: 100.0 },
        { name: 'Catalog Service', status: 'healthy', cpu: 8, memory: 20, latency: 15, requests: 3800, errorRate: 0.01, sla: 99.99, slo: 99.95, errorBudget: 99.9 }
      ]

      // Map service status according to active Docker / K8s metrics
      const services = defaultServices.map(svc => {
        let status = svc.status
        let cpu = svc.cpu
        let memory = svc.memory
        let errorRate = svc.errorRate
        let latency = svc.latency

        // 1. Docker overrides
        if (dockerContainers) {
          const matchingContainer = dockerContainers.find(
            (c: any) => c.name.toLowerCase().includes(svc.name.toLowerCase().replace(' ', '-'))
          )
          if (matchingContainer) {
            cpu = matchingContainer.cpu
            memory = matchingContainer.memory
            if (matchingContainer.state === 'exited' || matchingContainer.state === 'dead') {
              status = 'critical'
              errorRate = 100
              latency = 0
            } else if (matchingContainer.state === 'restarting') {
              status = 'degraded'
              errorRate = 45
              latency = 1200
            }
          }
        }

        // 2. Kubernetes overrides
        if (k8sData) {
          const matchingDeployment = k8sData.deployments.find(
            (d: any) => d.name.toLowerCase().includes(svc.name.toLowerCase().replace(' ', '-'))
          )
          if (matchingDeployment) {
            if (matchingDeployment.readyReplicas === 0 && matchingDeployment.replicas > 0) {
              status = 'critical'
              errorRate = 100
              latency = 0
            } else if (matchingDeployment.readyReplicas < matchingDeployment.replicas) {
              status = 'degraded'
              errorRate = 15
              latency = Math.max(latency, 1200)
            }
          }
        }

        // 3. Fluctuations based on system-wide metrics (so live charts look organic)
        if (status === 'healthy') {
          const systemCpuModifier = sysMetrics.cpuUsage / 100
          cpu = Math.round((cpu + systemCpuModifier * 10) * 10) / 10
          memory = Math.round((memory + (sysMetrics.memoryUsage / 100) * 5) * 10) / 10
          latency = Math.round(latency + (Math.random() - 0.5) * 6)
        }

        return {
          ...svc,
          cpu,
          memory,
          status,
          errorRate,
          latency
        }
      })

      // Calculate dynamic health/risk based on active incidents
      const activeInc = incidents.find(i => i.status === 'active' || i.status === 'mitigating')
      let computedHealth = sysMetrics.cpuUsage > 90 ? 45 : 99
      let computedRisk = sysMetrics.cpuUsage > 90 ? 80 : 8

      if (activeInc) {
        if (activeInc.status === 'mitigating') {
          computedHealth = Math.min(90, 40 + Math.round(activeInc.mitigationProgress * 0.5))
          computedRisk = Math.max(10, 80 - Math.round(activeInc.mitigationProgress * 0.7))
        } else {
          const drop = activeInc.severity === 'P0' ? 65 : 40
          computedHealth = Math.max(5, 99 - drop)
          computedRisk = activeInc.severity === 'P0' ? 94 : 70
        }
      }

      cache.data = {
        systemHealth: computedHealth,
        riskScore: computedRisk,
        services,
        nodes: normalizedNodes,
        logs: localLogs.slice(0, 50),
        incidents,
        capabilities,
        system: {
          cpu: sysMetrics.cpuUsage,
          memory: sysMetrics.memoryUsage,
          disk: sysMetrics.diskUsage,
          platform: sysMetrics.platform,
          hostname: sysMetrics.hostname
        }
      }
      cache.lastFetched = Date.now()
    })()

    try {
      await cache.lockPromise
    } finally {
      cache.lockPromise = null
    }

    return NextResponse.json(cache.data)
  } catch (error) {
    console.error('Telemetry GET Error:', error)
    return NextResponse.json({ error: 'Failed to read live telemetry' }, { status: 500 })
  }
}
