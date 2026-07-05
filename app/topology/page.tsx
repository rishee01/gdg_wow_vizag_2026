'use client'

import React, { useState } from 'react'
import { useSystem } from '@/context/SystemContext'
import { cn } from '@/lib/utils'
import { Network, Activity, HelpCircle } from 'lucide-react'

interface NodeData {
  id: string
  name: string
  x: number
  y: number
  role: 'ingress' | 'proxy' | 'service' | 'cache' | 'database'
  serviceName?: string
}

export default function TopologyPage() {
  const { mode, services, activeSimulation, incidents } = useSystem()
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null)

  const nodes: NodeData[] = [
    { id: 'internet', name: 'Internet Edge', x: 50, y: 200, role: 'ingress' },
    { id: 'cloudflare', name: 'Cloudflare WAF', x: 180, y: 200, role: 'ingress', serviceName: 'API Gateway' },
    { id: 'lb', name: 'Load Balancer', x: 310, y: 200, role: 'proxy', serviceName: 'API Gateway' },
    { id: 'gateway', name: 'API Gateway', x: 440, y: 200, role: 'proxy', serviceName: 'API Gateway' },
    { id: 'auth', name: 'Auth Service', x: 580, y: 100, role: 'service', serviceName: 'Auth Service' },
    { id: 'payment', name: 'Payment Service', x: 580, y: 200, role: 'service', serviceName: 'Payment Service' },
    { id: 'orders', name: 'Orders Service', x: 580, y: 300, role: 'service', serviceName: 'Orders Service' },
    { id: 'redis', name: 'Redis Cache', x: 740, y: 100, role: 'cache', serviceName: 'Notification Service' },
    { id: 'postgres', name: 'PostgreSQL DB', x: 740, y: 200, role: 'database', serviceName: 'Orders Service' },
    { id: 'storage', name: 'Storage Partition', x: 740, y: 300, role: 'database', serviceName: 'Notification Service' }
  ]

  const links = [
    { source: 'internet', target: 'cloudflare' },
    { source: 'cloudflare', target: 'lb' },
    { source: 'lb', target: 'gateway' },
    { source: 'gateway', target: 'auth' },
    { source: 'gateway', target: 'payment' },
    { source: 'gateway', target: 'orders' },
    { source: 'auth', target: 'redis' },
    { source: 'payment', target: 'postgres' },
    { source: 'orders', target: 'postgres' },
    { source: 'orders', target: 'redis' },
    { source: 'orders', target: 'storage' }
  ]

  const activeIncident = incidents?.find(i => i.status === 'active' || i.status === 'mitigating')

  const getRootCauseNodeId = (): string | null => {
    if (!activeIncident) return null
    const rc = activeIncident.rootCause.toLowerCase()
    if (rc.includes('database') || rc.includes('postgres')) return 'postgres'
    if (rc.includes('redis') || rc.includes('cache')) return 'redis'
    if (rc.includes('dns') || rc.includes('coredns')) return 'gateway'
    if (rc.includes('cloudflare')) return 'cloudflare'
    if (rc.includes('leak') || rc.includes('auth')) return 'auth'
    if (rc.includes('payments') || rc.includes('crypto') || rc.includes('payment')) return 'payment'
    if (rc.includes('disk') || rc.includes('storage')) return 'storage'
    return null
  }

  const rootCauseNodeId = getRootCauseNodeId()

  const isNodeDependentOnRoot = (nodeId: string, rootId: string): boolean => {
    if (!rootId || nodeId === rootId) return false
    const dependents: Record<string, string[]> = {
      postgres: ['orders', 'payment', 'gateway', 'lb', 'cloudflare'],
      redis: ['auth', 'orders', 'gateway', 'lb', 'cloudflare'],
      storage: ['orders', 'gateway'],
      auth: ['gateway', 'lb', 'cloudflare'],
      payment: ['gateway', 'lb', 'cloudflare'],
      orders: ['gateway', 'lb', 'cloudflare'],
      gateway: ['lb', 'cloudflare'],
      cloudflare: ['lb', 'gateway', 'auth', 'orders', 'payment'],
      lb: ['gateway', 'auth', 'orders', 'payment']
    }
    return dependents[rootId]?.includes(nodeId) || false
  }

  // Retrieve health of a node dynamically
  const getNodeHealth = (node: NodeData): 'healthy' | 'degraded' | 'critical' => {
    if (node.id === 'internet') return 'healthy'
    
    if (activeIncident) {
      if (rootCauseNodeId === node.id) return 'critical'
      if (isNodeDependentOnRoot(node.id, rootCauseNodeId || '')) return 'degraded'
      if (node.serviceName && activeIncident.affectedServices.includes(node.serviceName)) {
        return rootCauseNodeId === node.id ? 'critical' : 'degraded'
      }
    }

    // In Live Mode, defer status checking entirely to the unified services registry
    if (mode === 'live') {
      if (node.serviceName) {
        const svc = services.find(s => s.name === node.serviceName)
        if (svc) return svc.status
      }
      if (node.id === 'postgres') {
        const oSvc = services.find(s => s.name === 'Orders Service')
        if (oSvc && oSvc.status === 'critical') return 'critical'
      }
      if (node.id === 'redis') {
        const aSvc = services.find(s => s.name === 'Auth Service')
        if (aSvc && aSvc.status === 'critical') return 'critical'
      }
      return 'healthy'
    }

    // In Demo Mode, consult active simulation constants
    if (activeSimulation === 'cloudflare_outage' && node.id === 'cloudflare') return 'critical'
    if (activeSimulation === 'dns_outage' && node.id !== 'internet') return 'critical'

    if (node.serviceName) {
      const svc = services.find(s => s.name === node.serviceName)
      if (svc) return svc.status
    }

    if (node.id === 'postgres' && activeSimulation === 'database_crash') return 'critical'
    if (node.id === 'redis' && activeSimulation === 'redis_eviction') return 'critical'
    if (node.id === 'storage' && activeSimulation === 'disk_failure') return 'critical'

    return 'healthy'
  }

  const getLinkStatus = (sourceId: string, targetId: string): 'nominal' | 'degraded' | 'disrupted' => {
    const sHealth = getNodeHealth(nodes.find(n => n.id === sourceId)!)
    const tHealth = getNodeHealth(nodes.find(n => n.id === targetId)!)

    if (sHealth === 'critical' || tHealth === 'critical') return 'disrupted'
    if (sHealth === 'degraded' || tHealth === 'degraded') return 'degraded'
    return 'nominal'
  }

  return (
    <div className="p-8 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-border/30 pb-5 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 font-mono uppercase">
            Service Topology Map
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            {mode === 'live'
              ? 'Real-time dependency paths mapped using live container telemetry.'
              : 'Interactive logical dependency matrix visualizing cascading traffic faults.'
            }
          </p>
        </div>
      </header>

      {/* Main Graph Canvas */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 mt-6 min-h-0">
        <div className="flex-1 border border-border/40 bg-black/40 rounded-lg p-4 relative overflow-hidden flex items-center justify-center min-h-[300px]">
          <svg
            className="w-full h-full max-w-[850px] aspect-[850/400]"
            viewBox="0 0 850 400"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Draw links */}
            {links.map((link, idx) => {
              const src = nodes.find(n => n.id === link.source)!
              const tgt = nodes.find(n => n.id === link.target)!
              const status = getLinkStatus(link.source, link.target)

              return (
                <g key={idx}>
                  <path
                    d={`M ${src.x} ${src.y} L ${tgt.x} ${tgt.y}`}
                    className={cn(
                      "stroke-[3] opacity-20",
                      status === 'disrupted' 
                        ? "stroke-rose-500" 
                        : status === 'degraded' 
                        ? "stroke-amber-500" 
                        : "stroke-emerald-500"
                    )}
                  />
                  <path
                    d={`M ${src.x} ${src.y} L ${tgt.x} ${tgt.y}`}
                    className={cn(
                      "stroke-[1.5] transition-all duration-500",
                      status === 'disrupted' 
                        ? "stroke-rose-600 stroke-dasharray-[5_5] animate-marquee" 
                        : status === 'degraded'
                        ? "stroke-amber-500 stroke-dasharray-[6_4] animate-marquee"
                        : "stroke-emerald-400 stroke-dasharray-[8_4] animate-marquee"
                    )}
                    style={{
                      animationDuration: status === 'nominal' ? '12s' : status === 'degraded' ? '6s' : '0s'
                    }}
                  />
                </g>
              )
            })}

            {/* Draw Nodes */}
            {nodes.map((node) => {
              const health = getNodeHealth(node)
              const isSelected = selectedNode?.id === node.id
              const isRootCause = activeIncident && rootCauseNodeId === node.id

              return (
                <g
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  className="cursor-pointer group"
                >
                  {/* Glowing Blast Radius Animation centered on root cause */}
                  {isRootCause && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r="16"
                      className="stroke-rose-500/80 fill-none stroke-[2]"
                    >
                      <animate attributeName="r" values="16;70" dur="2.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8;0" dur="2.5s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {health !== 'healthy' && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r="24"
                      className={cn(
                        "opacity-35 animate-ping",
                        health === 'critical' ? "fill-rose-500" : "fill-amber-500"
                      )}
                      style={{ animationDuration: '3s' }}
                    />
                  )}

                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="16"
                    className={cn(
                      "stroke-2 transition-all duration-300 fill-zinc-950",
                      isSelected
                        ? "stroke-cyan-400 fill-zinc-900 shadow-xl"
                        : health === 'critical'
                        ? "stroke-rose-500 fill-rose-950/20"
                        : health === 'degraded'
                        ? "stroke-amber-500 fill-amber-950/20"
                        : "stroke-zinc-700 hover:stroke-zinc-500"
                    )}
                  />

                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="4"
                    className={cn(
                      health === 'critical' ? "fill-rose-500" : health === 'degraded' ? "fill-amber-500" : "fill-emerald-400"
                    )}
                  />

                  <text
                    x={node.x}
                    y={node.y + 28}
                    textAnchor="middle"
                    className="fill-zinc-300 font-mono text-[9px] uppercase tracking-wider select-none pointer-events-none font-bold"
                  >
                    {node.name}
                  </text>
                </g>
              )
            })}
          </svg>

          {/* Map legend */}
          <div className="absolute bottom-4 left-4 flex gap-4 bg-zinc-950/80 border border-zinc-800 rounded px-3 py-1.5 text-[9px] font-mono uppercase text-zinc-500 select-none">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Nominal</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" /> Degraded</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" /> Disrupted</span>
          </div>
        </div>

        {/* Node details */}
        <aside className="w-full lg:w-72 shrink-0 border border-border/40 bg-zinc-950/40 rounded-lg p-5 flex flex-col justify-between font-mono">
          {selectedNode ? (
            <div className="space-y-6">
              <div className="border-b border-zinc-800 pb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-100 uppercase">{selectedNode.name}</h3>
                <span className="text-[9px] text-zinc-500 uppercase">{selectedNode.role}</span>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Node Status:</span>
                  <span className={cn(
                    "font-bold uppercase",
                    getNodeHealth(selectedNode) === 'healthy' 
                      ? "text-emerald-400" 
                      : getNodeHealth(selectedNode) === 'degraded'
                      ? "text-amber-400"
                      : "text-rose-500 animate-pulse"
                  )}>
                    {getNodeHealth(selectedNode)}
                  </span>
                </div>

                {selectedNode.serviceName ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Associated App:</span>
                      <span className="text-slate-200">{selectedNode.serviceName}</span>
                    </div>

                    {services.find(s => s.name === selectedNode.serviceName) && (
                      (() => {
                        const svc = services.find(s => s.name === selectedNode.serviceName)!
                        return (
                          <div className="space-y-2 pt-2 border-t border-zinc-900">
                            <div className="flex justify-between">
                              <span className="text-zinc-500">RPS Load:</span>
                              <span className="text-slate-300">{svc.requests.toLocaleString()} RPS</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">p99 Latency:</span>
                              <span className="text-slate-300">{svc.latency} ms</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">CPU Usage:</span>
                              <span className="text-slate-300">{svc.cpu}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Memory usage:</span>
                              <span className="text-slate-300">{svc.memory}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Error rate:</span>
                              <span className={cn(
                                "font-bold",
                                svc.errorRate > 1 ? "text-rose-400" : "text-emerald-400"
                              )}>{svc.errorRate}%</span>
                            </div>
                          </div>
                        )
                      })()
                    )}
                  </>
                ) : (
                  <div className="text-zinc-600 text-[10px]">
                    Internal network edge node hosting external proxy gateways.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-600 py-12">
              <HelpCircle className="h-8 w-8 text-zinc-700 mb-2" />
              <p className="text-[10px] uppercase">Select a node to inspect real-time telemetry metrics</p>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-zinc-900/60 text-[10px] text-zinc-500 leading-normal font-sans">
            Note: Network flow speeds adjust dynamically to indicate bandwidth capacity and saturation limits.
          </div>
        </aside>
      </div>
    </div>
  )
}
