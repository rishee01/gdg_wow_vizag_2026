'use client'

import React, { useState, useEffect } from 'react'
import { useSystem, type SimulationType } from '@/context/SystemContext'
import { AreaChart, RadialGauge, Sparkline, IncidentHeatmap } from '@/components/svg-charts'
import { cn } from '@/lib/utils'
import {
  Activity,
  AlertOctagon,
  Clock,
  TrendingDown,
  Cpu,
  Database,
  Play,
  RotateCcw,
  Zap,
  Layers,
  Network,
  CloudLightning,
  AlertCircle
} from 'lucide-react'

export default function DashboardPage() {
  const {
    mode,
    systemHealth,
    riskScore,
    activeSimulation,
    services,
    nodes,
    alerts,
    incidents,
    triggerSimulation,
    clearSimulation,
    
    // Judge Mode properties
    judgeModeActive,
    judgeModeStep,
    judgeModeStatusText,
    startJudgeMode
  } = useSystem()

  // Generate historical data arrays for live graphs
  const [cpuHistory, setCpuHistory] = useState<number[]>([45, 48, 52, 49, 46, 44, 45, 47, 49, 50, 48, 47, 46, 48, 52, 54, 50])
  const [memHistory, setMemHistory] = useState<number[]>([62, 63, 62, 64, 65, 66, 65, 64, 63, 62, 64, 66, 67, 68, 67, 66, 65])
  const [alertVolumeHistory, setAlertVolumeHistory] = useState<number[]>([2, 1, 0, 3, 2, 1, 4, 1, 0, 2, 5, 8, 12, 18, 14, 9, 7])

  const servicesRef = React.useRef(services)
  servicesRef.current = services
  const alertsRef = React.useRef(alerts)
  alertsRef.current = alerts

  useEffect(() => {
    const interval = setInterval(() => {
      const currentServices = servicesRef.current
      const currentAlerts = alertsRef.current
      // Append current overall CPU/Memory based on active simulation or noise
      const avgCpu = Math.round(currentServices.reduce((acc, s) => acc + s.cpu, 0) / currentServices.length)
      const avgMem = Math.round(currentServices.reduce((acc, s) => acc + s.memory, 0) / currentServices.length)
      const errCount = currentAlerts.filter(a => a.level === 'ERROR' || a.level === 'FATAL').length

      setCpuHistory(prev => [...prev.slice(1), avgCpu])
      setMemHistory(prev => [...prev.slice(1), avgMem])
      setAlertVolumeHistory(prev => [...prev.slice(1), Math.min(25, errCount + Math.floor(Math.random() * 3))])
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  const activeIncident = incidents.find(i => i.status === 'active' || i.status === 'mitigating')

  const simulationOptions: { type: SimulationType; name: string; icon: any; color: string }[] = [
    { type: 'database_crash', name: 'Postgres Connection Crash', icon: Database, color: 'hover:border-rose-500/40 text-rose-400 bg-rose-950/10' },
    { type: 'api_ddos', name: 'API Gateway L7 DDoS', icon: Zap, color: 'hover:border-rose-500/40 text-rose-400 bg-rose-950/10' },
    { type: 'redis_eviction', name: 'Redis Cache Eviction Storm', icon: Layers, color: 'hover:border-rose-500/40 text-rose-400 bg-rose-950/10' },
    { type: 'memory_leak', name: 'Auth NodeJS Heap Leak', icon: Cpu, color: 'hover:border-amber-500/40 text-amber-400 bg-amber-950/10' },
    { type: 'cpu_spike', name: 'Payments CPU Thread Lock', icon: Activity, color: 'hover:border-amber-500/40 text-amber-400 bg-amber-950/10' },
    { type: 'disk_failure', name: 'Storage Node Disk Full', icon: Database, color: 'hover:border-amber-500/40 text-amber-400 bg-amber-950/10' },
    { type: 'dns_outage', name: 'Internal DNS SERVFAIL Loop', icon: Network, color: 'hover:border-rose-500/40 text-rose-400 bg-rose-950/10' },
    { type: 'cloudflare_outage', name: 'Cloudflare SSL Handshake Error', icon: CloudLightning, color: 'hover:border-rose-500/40 text-rose-400 bg-rose-950/10' },
    { type: 'autoscaling_failure', name: 'Metrics Server API Timeout', icon: Cpu, color: 'hover:border-amber-500/40 text-amber-400 bg-amber-950/10' },
    { type: 'kubernetes_failure', name: 'Cluster Node NotReady State', icon: AlertOctagon, color: 'hover:border-rose-500/40 text-rose-400 bg-rose-950/10' }
  ]

  return (
    <div className="p-8 space-y-6">
      {/* Judge Mode Presentation Banner */}
      {judgeModeActive && (
        <div className="bg-cyan-950/40 border border-cyan-500/40 rounded-lg p-5 font-mono text-xs space-y-3 shadow-[0_0_15px_rgba(34,211,238,0.15)] relative overflow-hidden animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="font-bold text-cyan-400 uppercase tracking-widest text-[10px]">Autonomous SRE Presentation Active</span>
            </div>
            <span className="text-zinc-500 text-[10px]">Step {judgeModeStep} of 10</span>
          </div>
          <p className="text-slate-100 font-bold text-sm leading-snug">{judgeModeStatusText}</p>
          <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-400 transition-all duration-1000" style={{ width: `${judgeModeStep * 10}%` }} />
          </div>
        </div>
      )}

      {/* Header Banner */}
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-border/30 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 font-mono uppercase">
            PulseControl Command Center
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            {mode === 'live' 
              ? 'SRE Hybrid Workspace streaming live container details and system performance statistics.'
              : 'SRE Operations console monitoring 6 microservices across 4 multi-region clusters.'
            }
          </p>
        </div>

        {mode === 'live' ? (
          <span className="flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-950/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-cyan-400">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Live Ingestion Active (Collector Nodes)
          </span>
        ) : activeSimulation !== 'none' ? (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-950/20 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-rose-400 animate-pulse">
              <AlertCircle className="h-3.5 w-3.5" />
              Simulation Active: {activeSimulation.replace('_', ' ')}
            </span>
            <button
              onClick={clearSimulation}
              className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-300 transition-all hover:bg-zinc-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear Simulation
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={startJudgeMode}
              disabled={judgeModeActive}
              className="flex items-center gap-1.5 rounded border border-cyan-500/40 bg-cyan-950/20 hover:bg-cyan-950/40 text-cyan-400 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              {judgeModeActive ? 'Judge Mode Active' : 'Launch Judge Mode Demo'}
            </button>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-950/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Steady State (All Systems Nominal)
            </span>
          </div>
        )}
      </header>

      {/* Incident Callout Banner */}
      {activeIncident && (
        <div className="relative rounded-lg border border-rose-500/40 bg-rose-950/10 p-5 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded bg-rose-500 px-1.5 py-0.5 font-mono text-[9px] font-bold text-black">
                {activeIncident.severity}
              </span>
              <span className="font-mono text-xs text-rose-400 font-bold uppercase tracking-wider">
                {activeIncident.id}
              </span>
              <h2 className="text-sm font-semibold text-slate-100 font-sans">
                {activeIncident.title}
              </h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans max-w-3xl">
              {activeIncident.summary}
            </p>
          </div>
          <a
            href="/incidents"
            className="shrink-0 flex items-center gap-1 bg-rose-500 text-black px-4 py-2 rounded font-mono text-xs font-bold uppercase hover:bg-rose-400 transition-all tracking-wider"
          >
            Triage & Remediate
            <Play className="h-3 w-3 fill-current" />
          </a>
        </div>
      )}

      {/* Row 1: Core SLA/SLO & Health Widgets */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Availability */}
        <div className="border border-border/40 bg-zinc-900/10 p-4 rounded-lg flex items-center justify-between">
          <div className="space-y-1 font-mono">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">Availability</span>
            <span className="text-2xl font-bold text-slate-100">
              {activeSimulation !== 'none' || mode === 'live' && systemHealth < 90 ? '92.41%' : '99.98%'}
            </span>
            <span className="text-[9px] text-emerald-400 block font-bold">SLA Limit: 99.9%</span>
          </div>
          <Sparkline data={activeSimulation !== 'none' || mode === 'live' && systemHealth < 90 ? [99.9, 99.8, 99.4, 98.2, 95.1, 92.4] : [99.9, 99.9, 99.98, 99.99, 99.98, 99.98]} color={activeSimulation !== 'none' || mode === 'live' && systemHealth < 90 ? 'stroke-rose-500' : 'stroke-emerald-400'} />
        </div>

        {/* Error Budget */}
        <div className="border border-border/40 bg-zinc-900/10 p-4 rounded-lg flex items-center justify-between">
          <div className="space-y-1 font-mono">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">Error Budget</span>
            <span className="text-2xl font-bold text-slate-100">
              {activeSimulation !== 'none' || mode === 'live' && systemHealth < 90 ? '41.2%' : '99.1%'}
            </span>
            <span className="text-[9px] text-muted-foreground block">Remaining (30d)</span>
          </div>
          <Sparkline data={activeSimulation !== 'none' || mode === 'live' && systemHealth < 90 ? [99, 94, 88, 71, 55, 41] : [99, 99.1, 99.1, 99.1, 99.1, 99.1]} color={activeSimulation !== 'none' || mode === 'live' && systemHealth < 90 ? 'stroke-amber-500' : 'stroke-cyan-400'} />
        </div>

        {/* Radial Gauges: MTTR */}
        <div className="border border-border/40 bg-zinc-900/10 p-4 rounded-lg flex items-center justify-around">
          <div className="space-y-1 font-mono text-left">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">Mean MTTR</span>
            <span className="text-2xl font-bold text-slate-100 block">14.2m</span>
            <span className="text-[9px] text-emerald-400 block font-bold">-18.4% MoM</span>
          </div>
          <RadialGauge value={78} size={65} strokeWidth={5} label="78%" sublabel="mttr" colorClass="stroke-cyan-400" />
        </div>

        {/* Radial Gauges: MTTD */}
        <div className="border border-border/40 bg-zinc-900/10 p-4 rounded-lg flex items-center justify-around">
          <div className="space-y-1 font-mono text-left">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">Mean MTTD</span>
            <span className="text-2xl font-bold text-slate-100 block">1.8m</span>
            <span className="text-[9px] text-emerald-400 block font-bold">-24.1% MoM</span>
          </div>
          <RadialGauge value={91} size={65} strokeWidth={5} label="91%" sublabel="mttd" colorClass="stroke-emerald-400" />
        </div>
      </section>

      {/* Row 2: Live Charts & Heatmap */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Telemetry Graph */}
        <div className="border border-border/40 bg-zinc-950/40 p-5 rounded-lg lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-border/30 pb-3">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300">
              Live Cluster Resource Utilization
            </h3>
            <span className="font-mono text-[9px] text-cyan-400/80 animate-pulse">
              Live Ingress ticking
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-500 uppercase">Average Node CPU</span>
                <span className="text-slate-200 font-bold">{cpuHistory[cpuHistory.length - 1]}%</span>
              </div>
              <AreaChart data={cpuHistory} height={80} colorClassName={activeSimulation !== 'none' || mode === 'live' && systemHealth < 90 ? 'stroke-rose-500' : 'stroke-cyan-500'} fillColorClassName={activeSimulation !== 'none' || mode === 'live' && systemHealth < 90 ? 'fill-rose-500/5' : 'fill-cyan-500/5'} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-500 uppercase">Average Node Memory</span>
                <span className="text-slate-200 font-bold">{memHistory[memHistory.length - 1]}%</span>
              </div>
              <AreaChart data={memHistory} height={80} colorClassName="stroke-cyan-400" fillColorClassName="fill-cyan-400/5" />
            </div>
          </div>
        </div>

        {/* Systems Alert Volume Heatmap */}
        <div className="border border-border/40 bg-zinc-950/40 p-5 rounded-lg space-y-4">
          <div className="flex items-center justify-between border-b border-border/30 pb-3">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300">
              24-Hour Alert Volume Density
            </h3>
            <span className="text-[10px] font-mono text-zinc-500">7-Day History</span>
          </div>
          <IncidentHeatmap intensity={activeSimulation !== 'none' || mode === 'live' && systemHealth < 90 ? 'high' : 'low'} />
        </div>
      </section>

      {/* Row 3: Simulations Grid (COMMAND DECK) */}
      <section className="border border-border/40 bg-zinc-950/30 p-6 rounded-lg space-y-4">
        <div>
          <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-cyan-400">
            {mode === 'live' 
              ? 'Demo Outage Simulator (Disabled in Live Mode)' 
              : 'AI Incident Simulator Ingress'
            }
          </h3>
          <p className="text-[11px] text-muted-foreground font-sans">
            {mode === 'live'
              ? 'To trigger simulated incidents, switch the Ingress source toggle in the sidebar back to Demo Mode.'
              : 'Inject realistic cascading outages into the platform. PulseControl AI will immediately triage, alert, redraw dependencies, and construct resolution scripts.'
            }
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {simulationOptions.map((opt) => {
            const Icon = opt.icon
            const isSelected = activeSimulation === opt.type
            return (
              <button
                key={opt.type}
                onClick={() => triggerSimulation(opt.type)}
                disabled={mode === 'live'}
                className={cn(
                  'flex flex-col items-start p-3 rounded-lg border text-left transition-all duration-300 font-mono group relative overflow-hidden',
                  mode === 'live' && 'cursor-not-allowed opacity-40',
                  isSelected 
                    ? 'border-rose-500 bg-rose-950/30 text-rose-400 shadow-[0_0_15px_rgba(239,68,68,0.25)]' 
                    : cn('border-zinc-800 bg-zinc-900/30 text-zinc-400 hover:text-slate-200 hover:bg-zinc-900/80', opt.color)
                )}
              >
                <Icon className={cn("h-4.5 w-4.5 mb-2 transition-transform group-hover:scale-110", isSelected ? "text-rose-400" : "text-zinc-500 group-hover:text-zinc-400")} />
                <span className="text-[10px] font-semibold leading-tight">{opt.name}</span>
                <span className="text-[8px] text-zinc-500 uppercase mt-1">Simulate</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Active Incidents Section */}
      <section className="border border-border/40 bg-zinc-950/40 p-5 rounded-lg space-y-4">
        <div className="flex items-center justify-between border-b border-border/30 pb-3">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300">
            Active Infrastructure Incidents
          </h3>
          <span className="font-mono text-[9px] text-rose-500 uppercase tracking-widest animate-pulse">
            {incidents.filter(i => i.status === 'active' || i.status === 'mitigating').length} Active Alerts
          </span>
        </div>

        {incidents.filter(i => i.status === 'active' || i.status === 'mitigating').length === 0 ? (
          <div className="text-center py-8 font-mono text-xs text-zinc-500">
            ✓ No active incidents detected. All services operating nominally.
          </div>
        ) : (
          <div className="space-y-4">
            {incidents.filter(i => i.status === 'active' || i.status === 'mitigating').map(inc => (
              <DashboardIncidentCard key={inc.id} incident={inc} />
            ))}
          </div>
        )}
      </section>

      {/* Row 4: Telemetry Service Registers & Live Nodes */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Service Registry Grid */}
        <div className="border border-border/40 bg-zinc-950/20 p-5 rounded-lg space-y-4">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-border/30 pb-3">
            Core Service Registry
          </h3>
          <div className="space-y-3">
            {services.map((svc) => (
              <div key={svc.name} className="flex items-center justify-between border-b border-zinc-900 pb-2">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "h-2 w-2 rounded-full",
                    svc.status === 'healthy' ? "bg-emerald-400" : svc.status === 'degraded' ? "bg-amber-400 animate-pulse" : "bg-rose-500 animate-ping"
                  )} />
                  <span className="font-mono text-xs text-slate-200">{svc.name}</span>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-400">
                  <span>{svc.requests.toLocaleString()} RPS</span>
                  <span>{svc.latency}ms latency</span>
                  <span className={cn(
                    svc.status === 'healthy' ? "text-emerald-400" : svc.status === 'degraded' ? "text-amber-400" : "text-rose-400 font-bold"
                  )}>
                    {svc.errorRate}% err
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Node Health Grid */}
        <div className="border border-border/40 bg-zinc-950/20 p-5 rounded-lg space-y-4">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-border/30 pb-3">
            Cluster Nodes Status
          </h3>
          <div className="space-y-3">
            {nodes.map((node) => (
              <div key={node.name} className="space-y-1.5 border-b border-zinc-900 pb-2.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "h-2 w-2 rounded-full",
                      node.status === 'healthy' ? "bg-emerald-400" : node.status === 'degraded' ? "bg-amber-400 animate-pulse" : "bg-rose-500"
                    )} />
                    <span className="text-slate-200">{node.name}</span>
                  </div>
                  <span className="text-zinc-500">{node.podsCount} active containers/pods</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-[10px] font-mono text-zinc-400">
                  <div className="flex justify-between">
                    <span>CPU:</span>
                    <span className="text-slate-300">{node.cpu}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>MEM:</span>
                    <span className="text-slate-300">{node.memory}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DISK:</span>
                    <span className="text-slate-300">{node.disk}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function DashboardIncidentCard({ incident }: { incident: any }) {
  const [isExpanded, setIsExpanded] = useState(false)
  return (
    <div 
      className={cn(
        "border rounded-lg p-4 font-mono text-xs transition-all duration-300",
        incident.severity === 'P0' 
          ? "border-rose-500/30 bg-rose-950/5 hover:border-rose-500/50" 
          : "border-amber-500/30 bg-amber-950/5 hover:border-amber-500/50"
      )}
    >
      <div 
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-bold text-black",
              incident.severity === 'P0' ? "bg-rose-500" : "bg-amber-500"
            )}>
              {incident.severity}
            </span>
            <span className="text-[10px] text-zinc-500">{incident.id}</span>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
              Confidence: {incident.confidence}%
            </span>
          </div>
          <h4 className="text-sm font-bold text-slate-200">{incident.title}</h4>
          <p className="text-zinc-400 text-[11px] leading-relaxed">
            <strong>Root Cause:</strong> {incident.rootCause}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0 font-mono">
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-zinc-500">Affected:</span>
            <div className="flex gap-1 flex-wrap">
              {incident.affectedServices.map((s: string) => (
                <span key={s} className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-[9px] px-1.5 py-0.5 rounded">
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div className="text-[10px] text-zinc-400">
            Evidence Count: <strong className="text-rose-400">{incident.evidence.length}</strong>
          </div>
          {incident.status === 'mitigating' && (
            <div className="w-48 space-y-1">
              <div className="flex justify-between text-[9px] text-zinc-500">
                <span>Healing Progress:</span>
                <span className="text-amber-400">{incident.mitigationProgress}%</span>
              </div>
              <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-400 rounded-full transition-all duration-500" 
                  style={{ width: `${incident.mitigationProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-zinc-900/60 space-y-4 transition-all">
          <div className="space-y-1.5">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest block font-bold">Evidence</span>
            <ul className="list-none space-y-1 text-[11px] text-zinc-300">
              {incident.evidence.map((ev: string, idx: number) => (
                <li key={idx} className="flex items-start gap-1">
                  <span className="text-rose-500 font-bold">✓</span>
                  <span>{ev}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1.5">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest block font-bold">Chronological Timeline</span>
            <div className="relative pl-3 border-l border-zinc-800 space-y-2 text-[10px]">
              {incident.timeline.map((item: any, idx: number) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-[16px] top-1.5 h-1.5 w-1.5 rounded-full bg-zinc-700" />
                  <span className="text-zinc-500">{item.time}</span> - <span className="text-zinc-300">{item.description}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest block font-bold">Remediation Runbook CLI</span>
            <div className="space-y-2">
              {incident.recoveryPlan.map((step: any, idx: number) => (
                <div key={idx} className="bg-black/60 rounded border border-zinc-900/60 p-2.5 space-y-1 font-mono text-[10px]">
                  <div className="flex justify-between text-zinc-400">
                    <span>Step {idx+1}: {step.description}</span>
                    <span className="text-cyan-400 uppercase font-bold text-[8px]">{step.status}</span>
                  </div>
                  <pre className="text-cyan-300 select-all overflow-x-auto p-1 bg-black/40 rounded mt-1">{step.command}</pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
