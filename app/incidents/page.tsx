'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useSystem, type Incident, type RecoveryStep, type EvidenceItem, type SimilarIncidentResult } from '@/context/SystemContext'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  Terminal,
  Activity,
  User,
  DollarSign,
  Users,
  Clock,
  ChevronRight,
  ShieldCheck,
  FileText,
  HelpCircle,
  Shield,
  Search,
  Check,
  TrendingUp,
  Server
} from 'lucide-react'
import { Sparkline } from '@/components/svg-charts'

export default function IncidentsPage() {
  const { 
    incidents, 
    runRecoveryStep, 
    runAllRecoverySteps, 
    clearSimulation,
    
    // Replay integration
    replayActive,
    replayCurrentStep,
    replaySpeed,
    replayIncidentId,
    startReplay,
    pauseReplay,
    resumeReplay,
    seekReplay,
    stopReplay
  } = useSystem()

  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'triage' | 'explainability' | 'remediation' | 'timeline' | 'postmortem'>('triage')

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resolved'>('all')
  const [serviceFilter, setServiceFilter] = useState('ALL')
  const [namespaceFilter, setNamespaceFilter] = useState('ALL')
  const [timeFilter, setTimeFilter] = useState<'all' | 'week'>('all')

  const consoleEndRef = useRef<HTMLDivElement>(null)

  // Search/Filter matching algorithm
  const filteredIncidents = incidents.filter(inc => {
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase()
      const matchesTitle = inc.title.toLowerCase().includes(q)
      const matchesCause = inc.rootCause.toLowerCase().includes(q)
      const matchesId = inc.id.toLowerCase().includes(q)
      if (!matchesTitle && !matchesCause && !matchesId) return false
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'active' && inc.status === 'resolved') return false
      if (statusFilter === 'resolved' && inc.status !== 'resolved') return false
    }

    if (serviceFilter !== 'ALL') {
      if (!inc.affectedServices.includes(serviceFilter)) return false
    }

    if (namespaceFilter !== 'ALL') {
      const ns = namespaceFilter.toLowerCase()
      const inEvidence = inc.evidence.some(e => e.toLowerCase().includes(ns))
      const inTitle = inc.title.toLowerCase().includes(ns)
      const inCause = inc.rootCause.toLowerCase().includes(ns)
      if (!inEvidence && !inTitle && !inCause) return false
    }

    if (timeFilter === 'week') {
      const lastWeek = new Date()
      lastWeek.setDate(lastWeek.getDate() - 7)
      const incDate = new Date(inc.firstSeen || Date.now())
      if (incDate < lastWeek) return false
    }

    return true
  })

  const activeIncidents = filteredIncidents.filter(i => i.status === 'active' || i.status === 'mitigating')
  const resolvedIncidents = filteredIncidents.filter(i => i.status === 'resolved')

  const currentIncidentId = selectedIncidentId || (filteredIncidents.length > 0 ? filteredIncidents[0].id : null)
  const currentIncident = filteredIncidents.find(i => i.id === currentIncidentId)

  // Scroll console to bottom during logs ingestion
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [replayCurrentStep, replayActive])

  const handleRunStep = async (stepIdx: number) => {
    if (!currentIncident) return
    await runRecoveryStep(currentIncident.id, stepIdx)
  }

  const handleRunAll = async () => {
    if (!currentIncident) return
    await runAllRecoverySteps(currentIncident.id)
  }

  const generatePostmortem = (inc: Incident) => {
    return `## Executive Summary
At ${inc.timeline[0]?.time || '00:00:00'}, our telemetry nodes flagged anomalous degradation of the cluster. PulseControl AI declared a ${inc.severity} incident at ${inc.timeline[inc.timeline.length-1]?.time || '00:00:00'} targeting ${inc.affectedServices.join(', ')}. The outage affected approximately ${inc.usersAffected.toLocaleString()} customers, causing a peak business loss rate of $${inc.revenueImpactRate.toLocaleString()}/min.

## Technical Details & Root Cause
${inc.rootCause}

Evidence of this failure was validated across core log traces:
${inc.evidence.map(e => `* \`${e}\``).join('\n')}

## Resolution Actions
Remediation was executed via PulseControl automated playbooks:
${inc.recoveryPlan.map(s => `1. **${s.description}:** \`${s.command}\` (Exit Code 0)`).join('\n')}

## Timeline of Events
${inc.timeline.map(t => `* **${t.time}** - ${t.description} (Source: ${t.type.toUpperCase()})`).join('\n')}

## Future Prevention & Action Items
- [ ] Configure automatic alert thresholds on ${inc.affectedServices[0] || 'core components'}.
- [ ] Implement query indexing guidelines on database ingress relations.
- [ ] Expand Kubernetes node cpu headroom quotas inside deployment descriptors.
- [ ] Review connection pool max limits on secondary failover instances.
`
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left Sidebar: Incidents list */}
      <aside className="w-80 shrink-0 border-r border-border/40 bg-zinc-950/40 flex flex-col">
        <header className="px-6 py-4 border-b border-border/30">
          <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-400">
            Incident Workspace
          </h2>
        </header>

        {/* Filter controls */}
        <div className="px-4 py-3 border-b border-border/30 space-y-2 shrink-0">
          <input
            type="text"
            placeholder="Search incidents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/40 border border-zinc-800 rounded px-2.5 py-1.5 font-mono text-[10px] text-slate-200 placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50"
          />

          <div className="grid grid-cols-2 gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-black/35 border border-zinc-850 rounded text-[9px] font-mono px-2 py-1 text-zinc-300 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="resolved">Resolved</option>
            </select>

            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="bg-black/35 border border-zinc-850 rounded text-[9px] font-mono px-2 py-1 text-zinc-300 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="ALL">All Services</option>
              <option value="API Gateway">API Gateway</option>
              <option value="Auth Service">Auth Service</option>
              <option value="Payment Service">Payment Service</option>
              <option value="Orders Service">Orders Service</option>
              <option value="Notification Service">Notification Service</option>
              <option value="Catalog Service">Catalog Service</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {filteredIncidents.length === 0 ? (
            <div className="text-center py-12">
              <ShieldCheck className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
              <p className="font-mono text-[10px] text-zinc-500 uppercase">All systems secure</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeIncidents.length > 0 && (
                <div className="space-y-2">
                  <span className="font-mono text-[9px] font-bold text-rose-500 uppercase tracking-widest block">Active Outages</span>
                  {activeIncidents.map((inc) => (
                    <button
                      key={inc.id}
                      onClick={() => { setSelectedIncidentId(inc.id); setActiveTab('triage'); }}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-all duration-300 font-mono relative overflow-hidden",
                        currentIncidentId === inc.id
                          ? "bg-rose-950/15 border-rose-500/60 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                          : "bg-zinc-900/30 border-zinc-800 hover:border-zinc-700 text-zinc-400"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="bg-rose-500 text-black px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase">
                          {inc.severity}
                        </span>
                        <span className="text-[10px] text-zinc-500">{inc.id}</span>
                      </div>
                      <h3 className="text-xs font-bold text-slate-200 leading-tight mb-1 truncate">{inc.title}</h3>
                      <div className="flex items-center justify-between text-[8px] uppercase tracking-wider text-rose-400/80">
                        <span>{inc.status === 'mitigating' ? `mitigating (${inc.mitigationProgress}%)` : 'triage required'}</span>
                        <div className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {resolvedIncidents.length > 0 && (
                <div className="space-y-2">
                  <span className="font-mono text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Resolved History</span>
                  {resolvedIncidents.map((inc) => (
                    <button
                      key={inc.id}
                      onClick={() => { setSelectedIncidentId(inc.id); setActiveTab('triage'); }}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-all duration-300 font-mono",
                        currentIncidentId === inc.id
                          ? "bg-cyan-950/20 border-cyan-500/40 text-cyan-400"
                          : "bg-zinc-900/10 border-zinc-800/80 hover:border-zinc-700 text-zinc-500"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="bg-zinc-800 text-zinc-400 px-1 rounded text-[8px] font-bold tracking-wider">
                          {inc.severity}
                        </span>
                        <span className="text-[9px]">{inc.id}</span>
                      </div>
                      <h3 className="text-xs font-semibold leading-tight truncate text-zinc-300">{inc.title}</h3>
                      <span className="text-[8px] uppercase tracking-widest text-emerald-400 mt-1 block">Resolved</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Right side: Incident Details Panel */}
      <section className="flex-1 flex flex-col overflow-y-auto bg-zinc-950/20">
        {currentIncident ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header telemetry info bar */}
            <header className="px-8 py-6 border-b border-border/40 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="rounded bg-rose-600 px-2 py-0.5 text-xs font-bold text-black">
                      {currentIncident.severity}
                    </span>
                    <span className="text-xs text-muted-foreground">{currentIncident.id}</span>
                    <span className="text-xs text-zinc-500 border-l border-zinc-800 pl-2">Confidence: {currentIncident.confidence}%</span>
                  </div>
                  <h1 className="text-lg font-bold tracking-tight text-slate-100">{currentIncident.title}</h1>
                </div>

                <div className="flex items-center gap-3">
                  <span className={cn(
                    "font-mono text-xs px-2.5 py-1 rounded border uppercase tracking-wider",
                    currentIncident.status === 'active' 
                      ? "border-rose-500/40 text-rose-400 bg-rose-950/10 animate-pulse" 
                      : currentIncident.status === 'mitigating'
                      ? "border-amber-500/40 text-amber-400 bg-amber-950/10"
                      : "border-emerald-500/40 text-emerald-400 bg-emerald-950/10"
                  )}>
                    {currentIncident.status}
                  </span>
                  
                  {!replayIncidentId && (
                    <button
                      onClick={() => startReplay(currentIncident.id)}
                      className="bg-cyan-500 text-black font-mono text-[10px] font-bold px-3 py-1.5 rounded uppercase tracking-wider hover:bg-cyan-400 transition-all flex items-center gap-1"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      Cinematic Replay
                    </button>
                  )}
                </div>
              </div>

              {/* Blast metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                <div className="bg-black/40 border border-border/30 rounded p-3 font-mono flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-rose-500 shrink-0" />
                  <div>
                    <span className="text-[8px] text-zinc-500 uppercase tracking-widest block">Revenue Loss</span>
                    <span className="text-xs font-semibold text-slate-200">${currentIncident.revenueImpactRate.toLocaleString()}/min</span>
                  </div>
                </div>

                <div className="bg-black/40 border border-border/30 rounded p-3 font-mono flex items-center gap-3">
                  <Users className="h-5 w-5 text-rose-500 shrink-0" />
                  <div>
                    <span className="text-[8px] text-zinc-500 uppercase tracking-widest block">Users Impacted</span>
                    <span className="text-xs font-semibold text-slate-200">{currentIncident.usersAffected.toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-black/40 border border-border/30 rounded p-3 font-mono flex items-center gap-3">
                  <Activity className="h-5 w-5 text-zinc-400 shrink-0" />
                  <div>
                    <span className="text-[8px] text-zinc-500 uppercase tracking-widest block">Affected Area</span>
                    <span className="text-xs font-semibold text-slate-200 truncate block max-w-[130px]" title={currentIncident.blastRadius}>{currentIncident.blastRadius}</span>
                  </div>
                </div>

                <div className="bg-black/40 border border-border/30 rounded p-3 font-mono flex items-center gap-3">
                  <User className="h-5 w-5 text-zinc-400 shrink-0" />
                  <div>
                    <span className="text-[8px] text-zinc-500 uppercase tracking-widest block">Target Customer</span>
                    <span className="text-xs font-semibold text-slate-200 truncate block max-w-[130px]" title={currentIncident.affectedCustomers}>{currentIncident.affectedCustomers}</span>
                  </div>
                </div>
              </div>

              {/* [STEP 5] Cinematic Replay Controls Panel */}
              {replayIncidentId === currentIncident.id && (
                <div className="bg-zinc-950/80 border border-cyan-500/20 rounded-lg p-4 font-mono text-xs space-y-3">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                      <span className="text-cyan-400 font-bold uppercase tracking-wider">Cinematic Replay Active</span>
                      <span className="text-zinc-600">|</span>
                      <span className="text-slate-300">Milestone {replayCurrentStep + 1} of {currentIncident.timeline.length}</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex bg-black/60 border border-zinc-800 rounded p-0.5 gap-0.5 text-[9px]">
                        {[1, 2, 5].map(s => (
                          <button
                            key={s}
                            onClick={() => useSystem().seekReplay(replayCurrentStep)} // Force state flush
                            className={cn(
                              "px-2 py-0.5 rounded transition-all",
                              replaySpeed === s ? "bg-cyan-950 text-cyan-400 font-bold border border-cyan-500/20" : "text-zinc-500"
                            )}
                          >
                            {s}x
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={replayActive ? pauseReplay : resumeReplay}
                        className="bg-cyan-950 border border-cyan-500/40 text-cyan-400 px-3 py-1 rounded hover:bg-cyan-500/10 font-bold uppercase tracking-wider text-[10px]"
                      >
                        {replayActive ? 'Pause' : 'Resume'}
                      </button>
                      
                      <button
                        onClick={() => seekReplay(Math.max(0, replayCurrentStep - 1))}
                        disabled={replayCurrentStep === 0}
                        className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-2 py-1 rounded disabled:opacity-50 text-[10px]"
                      >
                        Prev
                      </button>

                      <button
                        onClick={() => seekReplay(Math.min(currentIncident.timeline.length - 1, replayCurrentStep + 1))}
                        disabled={replayCurrentStep === currentIncident.timeline.length - 1}
                        className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-2 py-1 rounded disabled:opacity-50 text-[10px]"
                      >
                        Next
                      </button>

                      <button
                        onClick={stopReplay}
                        className="text-rose-400 hover:text-rose-300 font-bold uppercase text-[10px] pl-2 border-l border-zinc-800"
                      >
                        Exit Replay
                      </button>
                    </div>
                  </div>

                  {/* Progress Timeline Slider */}
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max={currentIncident.timeline.length - 1}
                      value={replayCurrentStep}
                      onChange={(e) => seekReplay(parseInt(e.target.value))}
                      className="flex-1 accent-cyan-400 h-1 bg-zinc-800 rounded-lg cursor-pointer"
                    />
                    <span className="text-zinc-400 font-semibold">{currentIncident.timeline[replayCurrentStep]?.time}</span>
                  </div>

                  {/* cinematic interactive replay dashboard panel */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    {/* Live log stream console */}
                    <div className="bg-black/60 border border-zinc-900 rounded p-3 h-28 flex flex-col font-mono text-[9px]">
                      <div className="text-zinc-500 uppercase tracking-widest text-[8px] mb-1.5 border-b border-zinc-900 pb-1">
                        Ingested Log Stream
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-1.5 text-zinc-300 pr-1">
                        {currentIncident.timeline.slice(0, replayCurrentStep + 1).map((log, idx) => (
                          <div key={idx} className="flex gap-2">
                            <span className="text-cyan-400">[{log.time}]</span>
                            <span className="break-all select-all">{log.description}</span>
                          </div>
                        ))}
                        <div ref={consoleEndRef} />
                      </div>
                    </div>

                    {/* Topology live nodes */}
                    <div className="bg-black/60 border border-zinc-900 rounded p-3 h-28 flex flex-col">
                      <span className="text-zinc-500 uppercase tracking-widest text-[8px] mb-2 border-b border-zinc-900 pb-1 block">
                        Topology Active Health
                      </span>
                      <div className="flex-1 flex flex-wrap gap-2.5 items-center justify-center">
                        {currentIncident.affectedServices.map((svcName, sIdx) => {
                          const isBeforeFault = replayCurrentStep < 1
                          const isResolved = currentIncident.status === 'resolved'
                          const status = isResolved || isBeforeFault ? 'healthy' : sIdx === 0 ? 'critical' : 'degraded'
                          
                          return (
                            <div key={sIdx} className="bg-zinc-900/60 border border-zinc-850 px-2 py-1 rounded flex items-center gap-1.5">
                              <span className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                status === 'critical' ? "bg-rose-500 animate-pulse" : status === 'degraded' ? "bg-amber-400" : "bg-emerald-400"
                              )} />
                              <span className="text-[8px] text-zinc-300 font-semibold">{svcName}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Metric Spike chart */}
                    <div className="bg-black/60 border border-zinc-900 rounded p-3 h-28 flex flex-col font-mono">
                      <span className="text-zinc-500 uppercase tracking-widest text-[8px] mb-1.5 border-b border-zinc-900 pb-1">
                        Requests Failure Trend
                      </span>
                      <div className="flex-1 flex items-center justify-between gap-2">
                        <div className="text-[10px] space-y-1">
                          <span className="text-zinc-500 block">Failed Count:</span>
                          <span className="text-rose-400 font-bold">
                            {replayCurrentStep === 0 ? '420' : replayCurrentStep >= 4 ? `${currentIncident.usersAffected * 15}` : '14,240'}
                          </span>
                        </div>
                        <div className="h-10 w-24">
                          <Sparkline 
                            data={replayCurrentStep === 0 ? [5, 12, 45, 95] : replayCurrentStep >= 4 ? [5, 45, 98, 99, 40, 2] : [5, 45, 88, 92]} 
                            color={replayCurrentStep >= 4 ? 'stroke-emerald-400' : 'stroke-rose-500'} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Tabs */}
              <div className="flex gap-2 border-b border-zinc-800/80 pt-2 text-xs font-mono">
                {[
                  { id: 'triage', label: 'AI Root Cause', icon: AlertTriangle },
                  { id: 'explainability', label: 'Why PulseControl', icon: HelpCircle },
                  { id: 'remediation', label: 'Remediation Terminal', icon: Terminal },
                  { id: 'timeline', label: 'Outage Timeline', icon: Clock },
                  { id: 'postmortem', label: 'Postmortem Report', icon: FileText }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2 border-b-2 -mb-[2px] transition-all",
                      activeTab === t.id 
                        ? "border-cyan-400 text-cyan-400 font-semibold" 
                        : "border-transparent text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                    <t.icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                ))}
              </div>
            </header>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-8">
              {activeTab === 'triage' && (
                <div className="space-y-6 max-w-4xl">
                  <div className="space-y-2">
                    <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-400">Diagnosis Details</h3>
                    <div className="border border-border/40 bg-zinc-900/10 p-5 rounded-lg font-mono">
                      <p className="text-xs text-cyan-300 font-bold uppercase mb-2">Primary Root Cause Identified</p>
                      <p className="text-sm text-slate-200 leading-relaxed">{currentIncident.rootCause}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-400">AI Summary</h3>
                    <div className="border border-border/40 bg-zinc-900/15 p-5 rounded-lg font-sans text-sm text-slate-300 leading-relaxed">
                      {currentIncident.summary}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-400">Log Evidence Context</h3>
                    <div className="border border-border/40 bg-black/60 p-5 rounded-lg font-mono space-y-2">
                      {currentIncident.evidence.map((ev, idx) => (
                        <div key={idx} className="flex gap-3 text-xs leading-relaxed">
                          <span className="text-rose-500/80 shrink-0">[{idx+1}]</span>
                          <span className="text-zinc-300 select-all break-all">{ev}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* [STEP 4] Explainability Tab Section */}
              {activeTab === 'explainability' && (
                <div className="space-y-8 max-w-5xl">
                  {/* Row 1: Summary & Telemetry Agreement check */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono">
                    <div className="md:col-span-2 border border-border/40 bg-zinc-900/10 p-5 rounded-lg space-y-3">
                      <h4 className="text-cyan-300 font-bold uppercase tracking-wider text-xs">Deterministic Analysis Summary</h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        PulseControl resolved the root cause of this incident using a deterministic state parser. High weight metrics on <span className="text-cyan-400">{currentIncident.deterministicRCA?.primaryService || currentIncident.affectedServices[0]}</span> indicate the earliest failure.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1.5">
                        {currentIncident.deterministicRCA?.rulesTriggered.map((rule, idx) => (
                          <span key={idx} className="bg-zinc-950 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded text-[8px] uppercase tracking-wide">
                            Rule: {rule}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="border border-border/40 bg-zinc-900/10 p-5 rounded-lg space-y-3">
                      <h4 className="text-slate-300 font-bold uppercase tracking-wider text-xs">Provider Agreement</h4>
                      <div className="space-y-2 text-[10px]">
                        {['logs', 'k8s', 'docker', 'system'].map((prov) => {
                          const agreed = currentIncident.deterministicRCA?.providerAgreement.providers.includes(prov) || prov === 'logs'
                          return (
                            <div key={prov} className="flex items-center justify-between">
                              <span className="text-zinc-500 uppercase">{prov} collector</span>
                              <span className={cn(
                                "flex items-center gap-1",
                                agreed ? "text-emerald-400" : "text-zinc-600"
                              )}>
                                {agreed ? <Check className="h-3 w-3" /> : null}
                                {agreed ? 'AGREED' : 'UNREPORTED'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      <div className="pt-1.5">
                        <div className="flex justify-between text-[8px] text-zinc-500 mb-1">
                          <span>AGGREGATED RATIO</span>
                          <span>{currentIncident.deterministicRCA?.providerAgreement.percentage}%</span>
                        </div>
                        <div className="h-1 w-full bg-zinc-850 rounded-full overflow-hidden">
                          <div className="h-full bg-cyan-400 transition-all" style={{ width: `${currentIncident.deterministicRCA?.providerAgreement.percentage}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Evidence Timeline Grid */}
                  <div className="space-y-2">
                    <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-400">Evidence Normalizer Output</h3>
                    <div className="border border-border/40 bg-black/40 rounded-lg overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-black/60 border-b border-zinc-800 text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                            <th className="px-4 py-2">Timestamp</th>
                            <th className="px-4 py-2">Provider</th>
                            <th className="px-4 py-2">Service</th>
                            <th className="px-4 py-2">Event Anomaly</th>
                            <th className="px-4 py-2">Weight</th>
                            <th className="px-4 py-2">Explanation</th>
                            <th className="px-4 py-2 text-right">Contribution</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentIncident.structuredEvidence?.map((ev, idx) => (
                            <tr key={idx} className="border-b border-zinc-900/40 hover:bg-zinc-900/10 font-mono text-[10px] leading-relaxed">
                              <td className="px-4 py-2 text-zinc-500">{ev.timestamp}</td>
                              <td className="px-4 py-2">
                                <span className="bg-zinc-800/80 text-zinc-300 px-1 py-0.5 rounded text-[8px] uppercase tracking-wide">{ev.provider}</span>
                              </td>
                              <td className="px-4 py-2 text-slate-300 font-semibold">{ev.service}</td>
                              <td className="px-4 py-2 text-slate-400 select-all max-w-xs truncate" title={ev.event}>{ev.event}</td>
                              <td className="px-4 py-2">
                                <span className={cn(
                                  "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase",
                                  ev.weight === 'High' ? "bg-rose-950/20 text-rose-400 border border-rose-500/20" : "bg-amber-950/20 text-amber-400 border border-amber-500/20"
                                )}>{ev.weight}</span>
                              </td>
                              <td className="px-4 py-2 text-cyan-400/90 max-w-xs truncate" title={ev.explanation}>{ev.explanation}</td>
                              <td className="px-4 py-2 text-right text-emerald-400 font-bold">+{ev.confidenceContribution}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Row 3: Dependency path map & confidence math breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono">
                    <div className="border border-border/40 bg-zinc-900/10 p-5 rounded-lg space-y-3">
                      <h4 className="text-slate-300 font-bold uppercase tracking-wider text-xs">Dependency Flow Analysis</h4>
                      <div className="flex items-center gap-3 p-3 bg-black/40 border border-zinc-850 rounded">
                        <div className="bg-rose-950/20 border border-rose-500/30 rounded px-2.5 py-1 text-rose-400 font-bold text-xs">
                          {currentIncident.deterministicRCA?.primaryService}
                        </div>
                        <div className="text-zinc-600 font-bold">➔ depends on ➔</div>
                        <div className="bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-slate-300 text-xs">
                          {currentIncident.affectedServices.find(s => s !== currentIncident.deterministicRCA?.primaryService) || 'Infrastructure Host'}
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-500 leading-relaxed pt-1">
                        Topology graph highlights connection failures propagated up from downstream dependencies. The fault isolator flags child node components as the primary cause.
                      </p>
                    </div>

                    {/* [STEP 7] Confidence math explainer details list */}
                    <div className="border border-border/40 bg-zinc-900/10 p-5 rounded-lg space-y-3">
                      <h4 className="text-slate-300 font-bold uppercase tracking-wider text-xs">Confidence Breakdown math</h4>
                      <div className="space-y-1.5 text-[10px]">
                        {currentIncident.confidenceBreakdown?.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center py-0.5 border-b border-zinc-900/60">
                            <span className="text-zinc-500">{item.source}</span>
                            <span className="text-emerald-400 font-semibold">+{item.score}%</span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center pt-2 font-bold border-t border-zinc-800 text-slate-200">
                          <span>TOTAL STACK RATING</span>
                          <span className="text-cyan-400">{currentIncident.confidence}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Row 4: Alternative hypotheses & Rejected causes */}
                  <div className="space-y-2 font-mono">
                    <h3 className="text-xs uppercase tracking-widest text-zinc-400">Alternative Hypotheses Evaluated</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border border-border/40 bg-zinc-900/5 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-slate-300 font-semibold text-xs">Worker node hardware limits</span>
                          <span className="bg-zinc-950 border border-zinc-800 text-rose-400 px-1.5 py-0.5 rounded text-[8px] font-bold">REJECTED</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-relaxed">
                          Hypothesis: The hosting worker node hardware throttled CPU pipelines.
                          <br /><strong className="text-zinc-400">Rejection basis:</strong> K8s host metrics verify CPU cores are operating at baseline bounds (&lt; 35% utilization).
                        </p>
                      </div>

                      <div className="border border-border/40 bg-zinc-900/5 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-slate-300 font-semibold text-xs">Inter-service network partition</span>
                          <span className="bg-zinc-950 border border-zinc-800 text-rose-400 px-1.5 py-0.5 rounded text-[8px] font-bold">REJECTED</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-relaxed">
                          Hypothesis: Flapping packet drop routing inside internal cluster endpoints.
                          <br /><strong className="text-zinc-400">Rejection basis:</strong> Ingress logs confirm socket connections are actively refused, indicating listener process crashes.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Row 5: AI Validation notes */}
                  <div className="border border-border/40 bg-zinc-900/10 p-5 rounded-lg space-y-4 font-mono">
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                      <h4 className="text-cyan-300 font-bold uppercase tracking-wider text-xs">Gemini validation logs</h4>
                      <span className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold">
                        {currentIncident.aiValidation?.validatedStatus || 'VALIDATED'}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <span className="text-[10px] text-zinc-500 uppercase">AI Explanation:</span>
                        <p className="text-xs text-slate-300 leading-relaxed">{currentIncident.aiValidation?.validationExplanation}</p>
                      </div>
                      <div className="space-y-1.5 pt-2">
                        <span className="text-[10px] text-zinc-500 uppercase block">Suggested manual checks & queries:</span>
                        <div className="space-y-1.5 bg-black/60 p-4 rounded border border-zinc-900 text-[10px] text-cyan-300 font-semibold">
                          {currentIncident.aiValidation?.suggestedAdditionalChecks.map((cmd: string, idx: number) => (
                            <div key={idx} className="flex gap-2">
                              <span className="text-zinc-600">[{idx+1}]</span>
                              <span className="break-all select-all font-mono">{cmd}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Row 6: Knowledge Engine matched resolved incidents */}
                  {currentIncident.similarIncidents && currentIncident.similarIncidents.length > 0 && (
                    <div className="space-y-3 font-mono">
                      <h3 className="text-xs uppercase tracking-widest text-zinc-400">Historical Incident Matches</h3>
                      <div className="space-y-3">
                        {currentIncident.similarIncidents.map((past: SimilarIncidentResult) => (
                          <div key={past.id} className="border border-zinc-900 bg-zinc-950/30 p-4 rounded-lg flex flex-col md:flex-row justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded text-[8px] font-bold">{past.id}</span>
                                <h4 className="text-xs font-semibold text-slate-300">{past.title}</h4>
                              </div>
                              <p className="text-[10px] text-zinc-500">
                                Previous Successful Runbook: <code className="text-zinc-400">{past.runbookExecuted[0]?.command.substring(0, 70)}...</code>
                              </p>
                              {past.recurringPatternDetected && (
                                <span className="text-[8px] bg-rose-950/20 border border-rose-500/20 text-rose-400 px-1 py-0.2 rounded font-bold uppercase tracking-wider block w-max">
                                  Recurring Pattern Detected
                                </span>
                              )}
                            </div>
                            <div className="flex md:flex-col items-end justify-between md:justify-center text-right text-[10px] shrink-0">
                              <span className="text-cyan-400 font-bold">Similarity: {past.similarityScore}%</span>
                              <span className="text-zinc-500">Recovery Time: {past.recoveryTimeMinutes}m</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'remediation' && (
                <div className="space-y-6 max-w-5xl">
                  {/* Recovery Intelligence & Trust Panel */}
                  {currentIncident.recoveryIntelligence && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border border-zinc-800 bg-zinc-950/50 p-5 rounded-lg relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
                      
                      {/* Left: Confidence score gauge */}
                      <div className="flex flex-col justify-between border-r border-zinc-900/60 pr-5 gap-4">
                        <div className="space-y-1.5">
                          <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider block">Recovery Confidence</span>
                          <div className="flex items-baseline gap-2">
                            <span className={cn(
                              "text-3xl font-extrabold tracking-tight",
                              currentIncident.recoveryIntelligence.score >= 85 ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.25)]" :
                              currentIncident.recoveryIntelligence.score >= 65 ? "text-amber-400" : "text-rose-400"
                            )}>
                              {currentIncident.recoveryIntelligence.score}%
                            </span>
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border",
                              currentIncident.recoveryIntelligence.risk === 'LOW' ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-400" :
                              currentIncident.recoveryIntelligence.risk === 'MEDIUM' ? "bg-amber-950/20 border-amber-500/20 text-amber-400" :
                              "bg-rose-950/20 border-rose-500/20 text-rose-400"
                            )}>
                              {currentIncident.recoveryIntelligence.risk} Risk
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-zinc-900/60 text-[10px] font-mono">
                          <div className="space-y-0.5">
                            <span className="text-zinc-500 text-[8px] uppercase tracking-wider block">Expected MTTR</span>
                            <div className="text-slate-200 font-bold flex items-center gap-1 mt-0.5">
                              <Clock className="h-3.5 w-3.5 text-cyan-400" />
                              {currentIncident.recoveryIntelligence.expectedMTTR}
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-zinc-500 text-[8px] uppercase tracking-wider block">Playbook Success</span>
                            <div className="text-slate-200 font-bold flex items-center gap-1 mt-0.5">
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                              {currentIncident.recoveryIntelligence.successRate}%
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Explainability details */}
                      <div className="md:col-span-2 flex flex-col justify-between gap-4">
                        <div className="space-y-3">
                          <div>
                            <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider block">Remediation Justification</span>
                            <p className="text-[11px] text-zinc-350 leading-relaxed mt-1">
                              {currentIncident.recoveryIntelligence.explanation.whySuggested}
                            </p>
                          </div>
                          <div>
                            <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider block">SRE Continuous Learning Evidence</span>
                            <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
                              {currentIncident.recoveryIntelligence.explanation.historicalEvidence}
                            </p>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-zinc-900/60 flex items-center justify-between text-[9px] text-zinc-500">
                          <div className="flex gap-4">
                            <span>Uncertainty Bounds: <strong className="text-cyan-400 font-bold">{currentIncident.recoveryIntelligence.explanation.uncertainty}</strong></span>
                            <span>Rollback: <strong className={currentIncident.recoveryIntelligence.rollbackAvailable ? "text-emerald-400 font-bold" : "text-zinc-650 font-bold"}>{currentIncident.recoveryIntelligence.rollbackAvailable ? "Available" : "N/A"}</strong></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Terminal Execution controls */}
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                    <div className="space-y-1">
                      <span className="font-mono text-xs text-cyan-400 font-bold">Auto-Healing Runbook CLI</span>
                      <p className="text-[11px] text-zinc-500 font-mono">Execute generated scripts target deployment to heal telemetry.</p>
                    </div>
                    {currentIncident.status !== 'resolved' && (
                      <button
                        onClick={handleRunAll}
                        disabled={currentIncident.status === 'mitigating'}
                        className="flex items-center gap-1.5 bg-cyan-400 text-black px-4 py-2 rounded font-mono text-xs font-bold uppercase tracking-wider hover:bg-cyan-300 transition-all disabled:opacity-50"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        Execute Full Plan
                      </button>
                    )}
                  </div>

                  {/* Terminal step executor */}
                  <div className="space-y-4">
                    {currentIncident.recoveryPlan.map((step, idx) => {
                      const isRunning = step.status === 'running'
                      const isCompleted = step.status === 'completed'
                      return (
                        <div 
                          key={idx} 
                          className={cn(
                            "rounded-lg border overflow-hidden font-mono text-xs",
                            isRunning ? "border-amber-500/50 bg-amber-950/5" : isCompleted ? "border-cyan-500/20 bg-zinc-900/10" : "border-border/40 bg-black/20"
                          )}
                        >
                          {/* Step header */}
                          <div className="flex items-center justify-between px-4 py-3 bg-black/40 border-b border-zinc-900">
                            <div className="flex items-center gap-3">
                              <span className="text-zinc-500">Step {idx + 1}</span>
                              <span className="font-semibold text-slate-200">{step.description}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={cn(
                                "text-[10px] uppercase font-bold",
                                isCompleted ? "text-cyan-400" : isRunning ? "text-amber-400 animate-pulse" : "text-zinc-500"
                              )}>
                                {step.status}
                              </span>
                              {!isCompleted && !isRunning && currentIncident.status !== 'resolved' && (
                                <button
                                  onClick={() => handleRunStep(idx)}
                                  className="text-cyan-400 hover:text-cyan-300 font-bold uppercase text-[10px] flex items-center gap-1 border border-cyan-500/20 rounded px-2 py-0.5 hover:bg-cyan-500/5"
                                >
                                  Run <ChevronRight className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Code block */}
                          <div className="p-4 bg-black/60 overflow-x-auto text-[11px] leading-relaxed border-b border-zinc-900/60 select-all">
                            <pre className="text-cyan-300/90">{step.command}</pre>
                          </div>

                          {/* Execution stdout output terminal */}
                          {step.output && (
                            <div className="p-4 bg-zinc-950 text-zinc-400 font-mono text-[10px] leading-relaxed whitespace-pre-wrap border-t border-zinc-900/40">
                              {step.output}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="space-y-6 max-w-4xl font-mono">
                  <h3 className="text-xs uppercase tracking-widest text-zinc-400">Incident Event Timeline</h3>
                  <div className="relative pl-6 border-l border-zinc-800 space-y-6">
                    {(replayIncidentId === currentIncident.id
                      ? currentIncident.timeline.slice(0, replayCurrentStep + 1)
                      : currentIncident.timeline
                    ).map((event, idx) => (
                      <div key={idx} className="relative">
                        {/* Bullet point */}
                        <div className={cn(
                          "absolute -left-[30px] top-1 h-4 w-4 rounded-full border-4 border-zinc-950 flex items-center justify-center",
                          event.type === 'alert' ? "bg-rose-500" : event.type === 'ai' ? "bg-cyan-400" : "bg-cyan-500"
                        )} />

                        <div className="space-y-1">
                          <span className="text-[10px] text-zinc-500">{event.time}</span>
                          <p className="text-xs text-slate-200 leading-relaxed">{event.description}</p>
                          <span className={cn(
                            "inline-block text-[8px] uppercase tracking-wider font-bold rounded px-1",
                            event.type === 'alert' ? "bg-rose-500/10 text-rose-400" : event.type === 'ai' ? "bg-cyan-500/10 text-cyan-400" : "bg-zinc-800 text-zinc-400"
                          )}>
                            {event.type}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'postmortem' && (
                <div className="space-y-6 max-w-4xl">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                    <div className="space-y-0.5">
                      <span className="font-mono text-xs text-cyan-400 font-bold">Automated Postmortem Generation</span>
                      <p className="text-[11px] text-zinc-500 font-mono">Immutable post-outage documentation details.</p>
                    </div>
                  </div>
                  <div className="border border-border/40 bg-zinc-900/10 p-6 rounded-lg font-mono text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed select-all">
                    {generatePostmortem(currentIncident)}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-24 text-center">
            <ShieldCheck className="h-16 w-16 text-zinc-700 mb-4" />
            <h2 className="font-mono text-sm font-semibold text-slate-400 uppercase tracking-widest">Workspace Steady</h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
              No active outages identified. All metrics are nominal. Deployments are operational.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
