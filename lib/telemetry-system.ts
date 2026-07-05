import { collectSystemMetricsAsync } from './collectors/system'
import { collectDockerContainersAsync } from './collectors/docker'
import { collectK8sDataAsync } from './collectors/k8s'
import { readLocalLogsAsync } from './collectors/logs'
import { execFile } from 'child_process'
import { mapToServiceName } from './correlation-engine/config'

export interface Event {
  id: string
  timestamp: string // ISO Date string
  provider: 'system' | 'docker' | 'k8s' | 'logs'
  resourceType: 'host' | 'container' | 'pod' | 'deployment' | 'service' | 'database' | 'log'
  resourceName: string
  service: string
  severity: 'INFO' | 'WARN' | 'ERROR' | 'FATAL'
  message: string
  metadata: Record<string, any>
}

export interface CollectorStatus {
  available: boolean
  connected: boolean
  lastSync: string | null
  providerName: string
  version: string
  errors: string[]
}

function execFilePromise(file: string, args: string[], options = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout) => {
      if (error) reject(error)
      else resolve(stdout)
    })
  })
}

function logTimeToISO(timestampStr: string): string {
  const match = timestampStr.match(/\[?(\d{2}):(\d{2}):(\d{2})\.(\d{3})\]?/)
  const now = new Date()
  if (match) {
    const [, h, m, s, ms] = match
    now.setHours(parseInt(h, 10), parseInt(m, 10), parseInt(s, 10), parseInt(ms, 10))
  }
  return now.toISOString()
}

export interface TelemetryHarvest {
  events: Event[]
  capabilities: Record<string, CollectorStatus>
  raw?: {
    sysMetrics: any
    dockerContainers: any
    k8sData: any
    logs: any
  }
}

export async function collectAndNormalizeTelemetry(): Promise<TelemetryHarvest> {
  const events: Event[] = []
  const capabilities: Record<string, CollectorStatus> = {}

  // Trigger parallel asynchronous telemetry collection tasks
  const [sysMetrics, dockerContainers, k8sData, logs] = await Promise.all([
    collectSystemMetricsAsync().catch(() => null),
    collectDockerContainersAsync().catch(() => null),
    collectK8sDataAsync().catch(() => null),
    readLocalLogsAsync(80).catch(() => [])
  ])

  // 1. Process Host System
  if (sysMetrics) {
    capabilities.system = {
      available: true,
      connected: true,
      lastSync: new Date().toISOString(),
      providerName: 'Host System',
      version: '1.0.0',
      errors: []
    }

    if (sysMetrics.cpuUsage > 90) {
      events.push({
        id: `evt-sys-cpu-${Date.now()}`,
        timestamp: new Date().toISOString(),
        provider: 'system',
        resourceType: 'host',
        resourceName: sysMetrics.hostname,
        service: 'Host System',
        severity: 'FATAL',
        message: `CPU utilization exceeded threshold: ${sysMetrics.cpuUsage}%`,
        metadata: { loadAvg: sysMetrics.loadAvg, platform: sysMetrics.platform }
      })
    }
  } else {
    capabilities.system = {
      available: true,
      connected: false,
      lastSync: null,
      providerName: 'Host System',
      version: '1.0.0',
      errors: ['Failed to read host metrics']
    }
  }

  // 2. Process Docker
  let dockerVersion = 'N/A'
  let dockerAvailable = false
  try {
    const ver = await execFilePromise('docker', ['--version'], { timeout: 1000 })
    dockerAvailable = true
    dockerVersion = ver.replace('Docker version', '').trim()
  } catch {
    // Docker CLI not in PATH
  }

  if (!dockerAvailable || dockerContainers === null) {
    capabilities.docker = {
      available: dockerAvailable,
      connected: false,
      lastSync: null,
      providerName: 'Docker Daemon',
      version: dockerVersion,
      errors: [!dockerAvailable ? 'Docker CLI client not installed or not in PATH' : 'Docker daemon is unresponsive']
    }
  } else {
    capabilities.docker = {
      available: true,
      connected: true,
      lastSync: new Date().toISOString(),
      providerName: 'Docker Daemon',
      version: dockerVersion,
      errors: []
    }

    dockerContainers.forEach(c => {
      const isFailing = c.state === 'exited' || c.state === 'dead' || c.state === 'restarting'
      if (isFailing) {
        events.push({
          id: `evt-docker-${c.id}-${Date.now()}`,
          timestamp: new Date().toISOString(),
          provider: 'docker',
          resourceType: 'container',
          resourceName: c.name,
          service: mapToServiceName(c.name),
          severity: c.state === 'restarting' ? 'WARN' : 'FATAL',
          message: `Docker container ${c.name} status is ${c.state} (${c.status})`,
          metadata: { image: c.image, restarts: c.restarts, cpu: c.cpu, memory: c.memory }
        })
      }
    })
  }

  // 3. Process Kubernetes
  let k8sVersion = 'N/A'
  let k8sAvailable = false
  try {
    const ver = await execFilePromise('kubectl', ['version', '--client'], { timeout: 1000 })
    k8sAvailable = true
    k8sVersion = ver.split('\n')[0].replace('Client Version:', '').trim()
  } catch {
    // kubectl CLI not in PATH
  }

  if (!k8sAvailable || k8sData === null) {
    capabilities.k8s = {
      available: k8sAvailable,
      connected: false,
      lastSync: null,
      providerName: 'Kubernetes Cluster',
      version: k8sVersion,
      errors: [!k8sAvailable ? 'kubectl CLI tool not installed or not in PATH' : 'Kubernetes cluster API unreachable']
    }
  } else {
    capabilities.k8s = {
      available: true,
      connected: true,
      lastSync: new Date().toISOString(),
      providerName: 'Kubernetes Cluster',
      version: k8sVersion,
      errors: []
    }

    // Process Pods anomalies
    k8sData.pods.forEach(p => {
      const isAnomaly = p.status !== 'Running' && p.status !== 'Completed'
      if (isAnomaly) {
        events.push({
          id: `evt-k8s-pod-${p.name}-${Date.now()}`,
          timestamp: new Date().toISOString(),
          provider: 'k8s',
          resourceType: 'pod',
          resourceName: p.name,
          service: mapToServiceName(p.name),
          severity: 'FATAL',
          message: `Kubernetes pod ${p.name} has anomalous status: ${p.status}`,
          metadata: { namespace: p.namespace, restarts: p.restarts, node: p.node }
        })
      } else if (p.restarts > 0) {
        events.push({
          id: `evt-k8s-restarts-${p.name}-${Date.now()}`,
          timestamp: new Date().toISOString(),
          provider: 'k8s',
          resourceType: 'pod',
          resourceName: p.name,
          service: mapToServiceName(p.name),
          severity: 'WARN',
          message: `Kubernetes pod ${p.name} restarted ${p.restarts} times`,
          metadata: { namespace: p.namespace, restarts: p.restarts, node: p.node }
        })
      }
    })

    // Process Deployments anomalies
    k8sData.deployments.forEach(d => {
      if (d.readyReplicas < d.replicas) {
        events.push({
          id: `evt-k8s-deploy-${d.name}-${Date.now()}`,
          timestamp: new Date().toISOString(),
          provider: 'k8s',
          resourceType: 'deployment',
          resourceName: d.name,
          service: mapToServiceName(d.name),
          severity: d.readyReplicas === 0 ? 'FATAL' : 'ERROR',
          message: `Deployment ${d.name} replica configuration degraded: ${d.readyReplicas}/${d.replicas} ready`,
          metadata: { namespace: d.namespace, readyReplicas: d.readyReplicas, replicas: d.replicas }
        })
      }
    })
  }

  // 4. Process Logs
  if (logs && logs.length > 0) {
    capabilities.logs = {
      available: true,
      connected: true,
      lastSync: new Date().toISOString(),
      providerName: 'Application Logs',
      version: '1.0.0',
      errors: []
    }

    logs.forEach((l, index) => {
      if (l.level === 'ERROR' || l.level === 'FATAL' || l.level === 'WARN') {
        events.push({
          id: `evt-log-${index}-${Date.now()}`,
          timestamp: logTimeToISO(l.timestamp),
          provider: 'logs',
          resourceType: 'log',
          resourceName: l.pod || 'local-ingress',
          service: mapToServiceName(l.service),
          severity: l.level as any,
          message: l.message,
          metadata: { traceId: l.traceId, correlationId: l.correlationId, node: l.node }
        })
      }
    })
  } else {
    capabilities.logs = {
      available: true,
      connected: false,
      lastSync: null,
      providerName: 'Application Logs',
      version: '1.0.0',
      errors: ['Failed to load application logs']
    }
  }

  return {
    events,
    capabilities,
    raw: {
      sysMetrics,
      dockerContainers,
      k8sData,
      logs
    }
  }
}
