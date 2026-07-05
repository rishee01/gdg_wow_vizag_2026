'use client'

import React, { useState, useEffect } from 'react'
import { useSystem } from '@/context/SystemContext'
import { cn } from '@/lib/utils'
import { Server, HelpCircle, HardDrive, Terminal, CheckCircle, AlertOctagon, RefreshCw } from 'lucide-react'

interface PodData {
  name: string
  namespace: 'core' | 'gateway' | 'database' | 'kube-system' | string
  status: 'Running' | 'CrashLoopBackOff' | 'Terminating' | 'Pending' | 'OOMKilled' | string
  cpu: string
  memory: string
  node: string
  restarts: number
  logs: string[]
}

export default function InfrastructurePage() {
  const { mode, nodes, activeSimulation } = useSystem()
  const [selectedNamespace, setSelectedNamespace] = useState<string>('ALL')
  const [selectedPod, setSelectedPod] = useState<PodData | null>(null)
  
  // Live ingestion states
  const [liveData, setLiveData] = useState<{
    docker: any[]
    k8s: any
    hasDocker: boolean
    hasK8s: boolean
  } | null>(null)
  const [loading, setLoading] = useState(false)

  // In Live Mode, query the local infrastructure endpoint periodically
  useEffect(() => {
    if (mode !== 'live') return

    const fetchInfra = async () => {
      try {
        const res = await fetch('/api/infrastructure')
        if (!res.ok) throw new Error('infra offline')
        const data = await res.json()
        setLiveData(data)
      } catch (e) {
        // fail silently
      }
    }

    fetchInfra()
    const timer = setInterval(fetchInfra, 4000)
    return () => clearInterval(timer)
  }, [mode])

  // Dynamic simulation pods builder for Demo Mode
  const getDemoPods = (): PodData[] => {
    return [
      {
        name: 'api-gateway-7cf9-1',
        namespace: 'gateway',
        status: activeSimulation === 'api_ddos' || activeSimulation === 'autoscaling_failure' ? 'OOMKilled' : 'Running',
        cpu: activeSimulation === 'api_ddos' ? '980m' : '45m',
        memory: activeSimulation === 'api_ddos' ? '480Mi' : '120Mi',
        node: 'k8s-node-1',
        restarts: activeSimulation === 'api_ddos' ? 3 : 0,
        logs: [
          'INFO [gateway] [ingress] Connection route validated: /checkout',
          'INFO [gateway] [ingress] SSL verification succeeded with CF certificates.',
          activeSimulation === 'api_ddos' ? 'FATAL [gateway] [ingress] thread pool exhaustion. incoming requests count > 65k RPS' : 'INFO [gateway] p95 request latency: 45ms'
        ]
      },
      {
        name: 'api-gateway-7cf9-2',
        namespace: 'gateway',
        status: 'Running',
        cpu: '42m',
        memory: '115Mi',
        node: 'k8s-node-2',
        restarts: 0,
        logs: ['INFO [gateway] starting worker process...', 'INFO [gateway] listening on port 443']
      },
      {
        name: 'auth-service-54db-1',
        namespace: 'core',
        status: activeSimulation === 'memory_leak' ? 'CrashLoopBackOff' : activeSimulation === 'kubernetes_failure' ? 'Terminating' : 'Running',
        cpu: activeSimulation === 'memory_leak' ? '850m' : '15m',
        memory: activeSimulation === 'memory_leak' ? '512Mi' : '65Mi',
        node: 'k8s-node-2',
        restarts: activeSimulation === 'memory_leak' ? 14 : 0,
        logs: [
          'INFO [auth] initializing token validation routers...',
          activeSimulation === 'memory_leak' ? 'WARN [auth] javascript heap memory utilization near limit: 511.4Mi / 512Mi' : 'INFO [auth] token verification active.'
        ]
      },
      {
        name: 'auth-service-54db-2',
        namespace: 'core',
        status: activeSimulation === 'kubernetes_failure' ? 'Terminating' : 'Running',
        cpu: '18m',
        memory: '68Mi',
        node: 'k8s-node-2',
        restarts: 0,
        logs: ['INFO [auth] identity store validation passed. Syncing active keys.']
      },
      {
        name: 'payments-service-8fd2-1',
        namespace: 'core',
        status: activeSimulation === 'cpu_spike' ? 'Running' : 'Running',
        cpu: activeSimulation === 'cpu_spike' ? '1980m' : '22m',
        memory: '95Mi',
        node: 'k8s-node-3',
        restarts: 0,
        logs: [
          'INFO [payments] billing interface connected to provider: stripe',
          activeSimulation === 'cpu_spike' ? 'FATAL [payments] cryptographic thread lock detected in validate_signatures catalog' : 'INFO [payments] billing checks passed.'
        ]
      },
      {
        name: 'orders-service-67a1-1',
        namespace: 'core',
        status: activeSimulation === 'database_crash' ? 'Pending' : 'Running',
        cpu: '30m',
        memory: '84Mi',
        node: 'k8s-node-1',
        restarts: 0,
        logs: [
          'INFO [orders] order orchestration state engine ready.',
          activeSimulation === 'database_crash' ? 'ERROR [orders] pg_stat_database connection failed: pool exhausted' : 'INFO [orders] database sync passed.'
        ]
      },
      {
        name: 'postgres-db-0',
        namespace: 'database',
        status: activeSimulation === 'database_crash' ? 'OOMKilled' : 'Running',
        cpu: activeSimulation === 'database_crash' ? '0m' : '140m',
        memory: activeSimulation === 'database_crash' ? '0Mi' : '1.8Gi',
        node: 'db-primary-us-east',
        restarts: activeSimulation === 'database_crash' ? 1 : 0,
        logs: [
          'postgres [primary] listening on port 5432...',
          activeSimulation === 'database_crash' ? 'postgres [primary] FATAL: Out-Of-Memory (OOM) killer triggered by kernel scheduler' : 'postgres [primary] database checkpoint reached. all logs written.'
        ]
      },
      {
        name: 'redis-cache-0',
        namespace: 'database',
        status: activeSimulation === 'redis_eviction' ? 'Running' : 'Running',
        cpu: '35m',
        memory: activeSimulation === 'redis_eviction' ? '8.0Gi' : '2.1Gi',
        node: 'db-primary-us-east',
        restarts: 0,
        logs: [
          'redis [cache] database loaded from RDB file.',
          activeSimulation === 'redis_eviction' ? 'redis [cache] WARNING: maxmemory limit (8.00GB) hit. volatile-lru eviction initiated.' : 'redis [cache] cache hits/misses: 94.2% / 5.8%'
        ]
      },
      {
        name: 'coredns-7f9a-1',
        namespace: 'kube-system',
        status: activeSimulation === 'dns_outage' ? 'CrashLoopBackOff' : 'Running',
        cpu: '8m',
        memory: '18Mi',
        node: 'k8s-node-1',
        restarts: activeSimulation === 'dns_outage' ? 8 : 0,
        logs: [
          'coredns resolving upstream cluster nameserver config...',
          activeSimulation === 'dns_outage' ? 'coredns SERVFAIL circular forwarding loops detected' : 'coredns resolving query success: payment.svc.cluster.local'
        ]
      }
    ]
  }

  // Map Live Docker & Kubernetes Pods
  const getLivePods = (): PodData[] => {
    if (!liveData) return []
    const pods: PodData[] = []

    // 1. If K8s exists, render pods
    if (liveData.k8s && liveData.k8s.pods) {
      liveData.k8s.pods.forEach((p: any) => {
        pods.push({
          name: p.name,
          namespace: p.namespace,
          status: p.status,
          cpu: p.cpu,
          memory: p.memory,
          node: p.node,
          restarts: p.restarts,
          logs: p.logs
        })
      })
    }

    // 2. Add Docker containers if K8s list is small or empty (so both views are combined)
    if (liveData.docker && liveData.docker.length > 0) {
      liveData.docker.forEach((c: any) => {
        pods.push({
          name: c.name,
          namespace: 'docker-engine',
          status: c.state === 'running' ? 'Running' : c.state.toUpperCase(),
          cpu: `${c.cpu}%`,
          memory: `${c.memory}%`,
          node: 'docker-host',
          restarts: c.restarts,
          logs: c.logs
        })
      })
    }

    return pods
  }

  // Select source list based on active Toggle
  const isLive = mode === 'live'
  const rawPods = isLive ? getLivePods() : getDemoPods()

  // Apply filters
  const pods = rawPods.filter(
    p => selectedNamespace === 'ALL' || p.namespace.toLowerCase() === selectedNamespace.toLowerCase()
  )

  const uniqueNamespaces = isLive
    ? ['ALL', 'docker-engine', ...(liveData?.k8s?.namespaces || ['core', 'gateway', 'database', 'kube-system'])]
    : ['ALL', 'gateway', 'core', 'database', 'kube-system']

  return (
    <div className="p-8 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-border/30 pb-5 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 font-mono uppercase">
            Infrastructure Explorer
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            {isLive 
              ? 'Direct socket access to active Docker containers and Kubernetes pod replica parameters.'
              : 'Direct access to pod replicas scheduling metrics and container debug environments.'
            }
          </p>
        </div>
      </header>

      {/* Split panel: Node hosts (Top), Pod list & details (Bottom) */}
      <div className="flex-1 flex flex-col gap-6 mt-6 min-h-0">
        {/* Node Hosts row grid */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
          {nodes.map((node) => (
            <div key={node.name} className="border border-border/40 bg-zinc-950/40 p-4 rounded-lg font-mono">
              <div className="flex items-center gap-2 mb-3">
                <Server className="h-4 w-4 text-zinc-500" />
                <span className="text-xs font-semibold text-slate-200 truncate block max-w-[150px]">{node.name}</span>
                <span className={cn(
                  "h-1.5 w-1.5 rounded-full ml-auto",
                  node.status === 'healthy' ? 'bg-emerald-400' : 'bg-rose-500 animate-pulse'
                )} />
              </div>
              <div className="space-y-1.5 text-[10px] text-zinc-400">
                <div className="flex justify-between">
                  <span>Host CPU Load:</span>
                  <span className="text-slate-300 font-bold">{node.cpu}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Host Memory limits:</span>
                  <span className="text-slate-300 font-bold">{node.memory}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Partition Disk usage:</span>
                  <span className="text-slate-300 font-bold">{node.disk}%</span>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Lower layout: Pod list on left, container stdout on right */}
        <section className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
          {/* Pod Explorer */}
          <div className="flex-1 border border-border/40 bg-black/40 rounded-lg flex flex-col overflow-hidden min-h-0">
            {/* Filter buttons */}
            <div className="px-4 py-3 bg-zinc-950 border-b border-zinc-900 flex items-center justify-between shrink-0">
              <span className="font-mono text-xs text-slate-300 font-bold uppercase">
                {isLive ? 'Active Microservices / Containers' : 'Pod Replicas'}
              </span>
              <div className="flex gap-1.5 font-mono text-[9px] uppercase text-zinc-500 overflow-x-auto max-w-md">
                {uniqueNamespaces.map(ns => (
                  <button
                    key={ns}
                    onClick={() => { setSelectedNamespace(ns); setSelectedPod(null); }}
                    className={cn(
                      "px-2 py-0.5 rounded border border-transparent transition-all whitespace-nowrap",
                      selectedNamespace.toLowerCase() === ns.toLowerCase() ? "bg-zinc-800 text-slate-200 border-zinc-700" : "hover:text-slate-300"
                    )}
                  >
                    {ns}
                  </button>
                ))}
              </div>
            </div>

            {/* Pod Grid table */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/60 font-mono text-[11px]">
              {isLive && rawPods.length === 0 ? (
                <div className="text-center py-24 text-zinc-500">
                  <RefreshCw className="h-8 w-8 mx-auto mb-2 text-zinc-600 animate-spin" />
                  <span>Loading local infrastructure collector data...</span>
                </div>
              ) : pods.length === 0 ? (
                <div className="text-center py-24 text-zinc-500">
                  <span>No active resources found in namespace {selectedNamespace}.</span>
                </div>
              ) : (
                pods.map((pod) => {
                  const isSelected = selectedPod?.name === pod.name
                  const isHealthy = pod.status === 'Running' || pod.status === 'RUNNING'

                  return (
                    <div
                      key={pod.name}
                      onClick={() => setSelectedPod(pod)}
                      className={cn(
                        "flex items-center px-4 py-3 cursor-pointer hover:bg-zinc-900/40 transition-all border-l-2",
                        isSelected 
                          ? "bg-zinc-900/40 border-cyan-400" 
                          : !isHealthy 
                          ? "border-rose-500 bg-rose-950/5 text-rose-300" 
                          : "border-transparent"
                      )}
                    >
                      <div className="w-56 shrink-0 text-slate-200 font-semibold truncate pr-2" title={pod.name}>{pod.name}</div>
                      <div className="w-24 shrink-0 text-zinc-500 text-[10px] truncate pr-2">{pod.namespace}</div>
                      <div className="w-32 shrink-0">
                        <span className={cn(
                          "inline-flex items-center gap-1 text-[9px] uppercase font-bold",
                          isHealthy 
                            ? "text-emerald-400" 
                            : "text-rose-400 animate-pulse"
                        )}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", isHealthy ? "bg-emerald-400" : "bg-rose-500")} />
                          {pod.status}
                        </span>
                      </div>
                      <div className="flex-1 flex gap-4 text-[10px] text-zinc-500 justify-end">
                        <span>CPU: {pod.cpu}</span>
                        <span>MEM: {pod.memory}</span>
                        <span>Restarts: {pod.restarts}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Pod Output Terminal stdout pane */}
          <aside className="w-full lg:w-80 shrink-0 border border-border/40 bg-zinc-950/40 rounded-lg p-5 flex flex-col justify-between font-mono min-h-[250px]">
            {selectedPod ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="border-b border-zinc-800 pb-3 mb-4 shrink-0 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 truncate pr-2 uppercase">{selectedPod.name} Logs</h3>
                  <Terminal className="h-4 w-4 text-zinc-500 shrink-0" />
                </div>
                <div className="flex-1 bg-black/60 rounded p-4 border border-zinc-900/60 overflow-y-auto text-[10px] leading-relaxed text-zinc-300 space-y-2 select-all font-mono">
                  {selectedPod.logs.map((log, idx) => (
                    <div key={idx} className="flex gap-2">
                      <span className="text-zinc-600">[{idx+1}]</span>
                      <span className={cn(
                        log.includes('FATAL') || log.includes('ERROR') ? 'text-rose-400' : log.includes('WARN') ? 'text-amber-400' : 'text-zinc-300'
                      )}>{log}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-600 py-12">
                <HelpCircle className="h-8 w-8 text-zinc-700 mb-2" />
                <p className="text-[10px] uppercase">Select a pod replica to stream container stdout logs</p>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-zinc-900/60 text-[9px] text-zinc-500 leading-normal font-sans">
              Kubernetes cluster nodes: <strong>us-east-1.aws.pulsecontrol</strong>. API logs cache limit: 400 entries.
            </div>
          </aside>
        </section>
      </div>
    </div>
  )
}
