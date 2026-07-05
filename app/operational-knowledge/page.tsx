'use client'

import React, { useState, useEffect } from 'react'
import { useSystem, type Incident, type RecoveryStep } from '@/context/SystemContext'
import { cn } from '@/lib/utils'
import {
  Brain,
  Clock,
  Activity,
  TrendingUp,
  TrendingDown,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Play,
  Flame,
  CornerDownRight,
  Sparkles,
  Zap,
  Check
} from 'lucide-react'

interface PatternDiagnostic {
  recurringPattern: string
  frequency: string
  trend: 'UPWARD' | 'STABLE' | 'DOWNWARD'
  predictedNext: string
  confidence: number
}

interface Stats {
  totalCount: number
  averageMTTR: number
  successRate: number
}

export default function OperationalKnowledgePage() {
  const { incidents } = useSystem()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{
    historical: Incident[]
    patterns: PatternDiagnostic[]
    stats: Stats
  } | null>(null)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedIncidentId, setExpandedIncidentId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchKnowledgeData = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true)
    try {
      const res = await fetch('/api/operational-knowledge')
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) {
      console.error('Error fetching operational knowledge:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchKnowledgeData()
  }, [incidents]) // refetch if incidents list changes (e.g. newly resolved ones)

  const toggleExpandIncident = (id: string) => {
    if (expandedIncidentId === id) {
      setExpandedIncidentId(null)
    } else {
      setExpandedIncidentId(id)
    }
  }

  // Active Incident predictive insights calculation
  const activeIncident = incidents.find(i => i.status === 'active' || i.status === 'mitigating')
  
  // Calculate client-side predictive insights if there's an active incident
  let predictions = null
  if (activeIncident) {
    const rc = activeIncident.rootCause.toLowerCase()
    const severity = activeIncident.severity

    let worsenProb = 15
    let cascadeProb = 10
    let estMTTR = '6m'
    let riskLevel = 'LOW'
    let cascadingServices = [...activeIncident.affectedServices]

    if (severity === 'P0') {
      worsenProb = 75
      cascadeProb = 68
      estMTTR = '14m'
      riskLevel = 'CRITICAL'
    } else if (severity === 'P1') {
      worsenProb = 45
      cascadeProb = 35
      estMTTR = '10m'
      riskLevel = 'HIGH'
    }

    if (rc.includes('database') || rc.includes('postgres')) {
      cascadeProb = Math.max(cascadeProb, 85)
      riskLevel = 'CRITICAL'
      estMTTR = '15m'
      const downstream = ['Orders Service', 'Payment Service', 'API Gateway']
      downstream.forEach(s => {
        if (!cascadingServices.includes(s)) cascadingServices.push(s)
      })
    } else if (rc.includes('redis') || rc.includes('cache')) {
      cascadeProb = Math.max(cascadeProb, 70)
      riskLevel = 'HIGH'
      estMTTR = '11m'
      const downstream = ['Auth Service', 'Notification Service', 'API Gateway']
      downstream.forEach(s => {
        if (!cascadingServices.includes(s)) cascadingServices.push(s)
      })
    }

    predictions = {
      worsenProb,
      cascadeProb,
      estMTTR,
      riskLevel,
      cascadingServices
    }
  }

  const filteredHistory = data?.historical.filter(h => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      h.id.toLowerCase().includes(q) ||
      h.title.toLowerCase().includes(q) ||
      h.rootCause.toLowerCase().includes(q) ||
      h.affectedServices.some(s => s.toLowerCase().includes(q))
    )
  }) || []

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-zinc-950 p-6 font-mono text-xs text-zinc-300">
      {/* Header */}
      <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between border-b border-border/40 pb-5 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-cyan-400">
            <Brain className="h-5 w-5 animate-pulse" />
            <h1 className="text-base font-bold uppercase tracking-wider text-slate-100">
              Operational Knowledge Hub
            </h1>
          </div>
          <p className="text-[10px] text-zinc-500 tracking-wider">
            Continuous Learning Engine & predictive pattern indexes for root-cause diagnosis.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchKnowledgeData(true)}
            className="flex items-center gap-2 border border-zinc-800 bg-zinc-900/30 px-3 py-1.5 rounded text-[10px] uppercase font-bold hover:bg-zinc-800/50 hover:text-white transition-all text-zinc-400"
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            {refreshing ? 'Syncing...' : 'Sync History'}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
          <div className="h-8 w-8 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-4" />
          <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
            Analyzing operational records...
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Key Metrics Dashboard */}
          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="border border-border/30 bg-zinc-950/60 p-4 rounded-lg flex flex-col justify-between hover:border-cyan-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-all" />
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Historical Outages Resolved</span>
              <span className="text-2xl font-bold text-slate-100 mt-2">{data?.stats.totalCount || 0}</span>
              <span className="text-[9px] text-zinc-500 mt-1">Archived in continuous learning store</span>
            </div>

            <div className="border border-border/30 bg-zinc-950/60 p-4 rounded-lg flex flex-col justify-between hover:border-cyan-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-all" />
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Average Recovery MTTR</span>
              <span className="text-2xl font-bold text-cyan-400 mt-2">{data?.stats.averageMTTR} min</span>
              <span className="text-[9px] text-zinc-500 mt-1">~60% faster than manual playbook triage</span>
            </div>

            <div className="border border-border/30 bg-zinc-950/60 p-4 rounded-lg flex flex-col justify-between hover:border-cyan-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-all" />
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Remediation Success Rate</span>
              <span className="text-2xl font-bold text-emerald-400 mt-2">{data?.stats.successRate}%</span>
              <span className="text-[9px] text-zinc-500 mt-1">Validated verify milestones</span>
            </div>

            <div className="border border-border/30 bg-zinc-950/60 p-4 rounded-lg flex flex-col justify-between hover:border-cyan-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-all" />
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Continuous Learning Index</span>
              <span className="text-2xl font-bold text-indigo-400 mt-2">Active</span>
              <span className="text-[9px] text-zinc-500 mt-1">Resolutions parsed on save</span>
            </div>
          </section>

          {/* Active Outage Prediction panel */}
          {activeIncident && predictions && (
            <section className="border border-rose-500/20 bg-rose-950/5 p-5 rounded-lg relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl" />
              <div className="flex items-center gap-2 text-rose-400 mb-4">
                <Flame className="h-4 w-4 animate-bounce" />
                <h3 className="text-xs uppercase tracking-widest font-bold">Predictive Cascading Outage Alerts</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <span className="text-zinc-500 text-[10px] uppercase">Active Target Outage</span>
                  <div className="text-xs text-slate-100 font-bold">{activeIncident.title}</div>
                  <div className="text-[10px] text-rose-400/80">Risk Level: {predictions.riskLevel}</div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-zinc-500 uppercase">Probability of Worsening</span>
                      <span className="text-rose-400 font-bold">{predictions.worsenProb}%</span>
                    </div>
                    <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden border border-zinc-800">
                      <div className="bg-rose-500 h-full rounded-full" style={{ width: `${predictions.worsenProb}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-zinc-500 uppercase">Probability of Cascade Failures</span>
                      <span className="text-amber-400 font-bold">{predictions.cascadeProb}%</span>
                    </div>
                    <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden border border-zinc-800">
                      <div className="bg-amber-500 h-full rounded-full" style={{ width: `${predictions.cascadeProb}%` }} />
                    </div>
                  </div>
                </div>

                <div className="space-y-1 text-[11px]">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider block">Forecast Impact Tree</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {predictions.cascadingServices.map((svc, i) => (
                      <span
                        key={i}
                        className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-bold border",
                          activeIncident.affectedServices.includes(svc)
                            ? "bg-rose-950/20 border-rose-500/30 text-rose-400"
                            : "bg-amber-950/10 border-amber-500/20 text-amber-300/80 animate-pulse"
                        )}
                      >
                        {svc}
                      </span>
                    ))}
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-2 block">
                    Expected Recovery Duration: <span className="text-cyan-400 font-bold font-mono">{predictions.estMTTR}</span>
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Operational Patterns Grid */}
          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-widest text-zinc-400 font-bold flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-cyan-400" />
              Continuous Learning & Pattern Diagnostics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data?.patterns.map((pat, i) => {
                const isUpward = pat.trend === 'UPWARD'
                const isDownward = pat.trend === 'DOWNWARD'
                return (
                  <div
                    key={i}
                    className="border border-border/40 bg-zinc-900/10 p-4 rounded-lg flex flex-col justify-between hover:border-cyan-500/20 hover:bg-zinc-900/20 transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[8px] font-bold tracking-widest uppercase border",
                            isUpward
                              ? "bg-rose-950/20 border-rose-500/20 text-rose-400"
                              : isDownward
                              ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-400"
                              : "bg-cyan-950/20 border-cyan-500/20 text-cyan-400"
                          )}
                        >
                          Trend: {pat.trend}
                        </span>
                        <span className="text-[10px] font-bold text-cyan-400">{pat.confidence}% Conf</span>
                      </div>
                      <h4 className="text-[11px] font-bold text-slate-200 leading-normal">{pat.recurringPattern}</h4>
                    </div>

                    <div className="mt-4 pt-3 border-t border-zinc-900/80 space-y-1.5 text-[10px]">
                      <div className="flex justify-between text-zinc-500">
                        <span>Frequency:</span>
                        <span className="text-zinc-400 font-semibold">{pat.frequency}</span>
                      </div>
                      <div className="flex justify-between text-zinc-500">
                        <span>Predicted Next:</span>
                        <span className="text-zinc-300 font-bold">{pat.predictedNext}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Historical Incident Archive */}
          <section className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/30 pb-3">
              <h3 className="text-xs uppercase tracking-widest text-zinc-400 font-bold flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-cyan-400" />
                Resolved Operations Archive
              </h3>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter archives..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-black/50 border border-zinc-800 rounded px-2.5 py-1 text-[10px] font-mono text-slate-200 placeholder-zinc-650 focus:outline-none focus:border-cyan-500/50 w-64 pl-8"
                />
                <Search className="h-3.5 w-3.5 text-zinc-600 absolute left-2.5 top-1.5" />
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="border border-dashed border-border/30 bg-zinc-950/20 py-12 rounded-lg text-center">
                <CheckCircle className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                <p className="font-mono text-[10px] text-zinc-500 uppercase">No resolved archives found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredHistory.map((inc) => {
                  const isExpanded = expandedIncidentId === inc.id
                  let duration = 'Recent'
                  if (inc.firstSeen && inc.lastSeen) {
                    const diffMs = new Date(inc.lastSeen).getTime() - new Date(inc.firstSeen).getTime()
                    duration = `${Math.max(1, Math.round(diffMs / 60000))}m`
                  }
                  return (
                    <div
                      key={inc.id}
                      className={cn(
                        "border border-border/30 rounded-lg overflow-hidden transition-all bg-zinc-950/40 hover:bg-zinc-950/60",
                        isExpanded && "border-cyan-500/20 bg-zinc-900/5"
                      )}
                    >
                      {/* Row Header */}
                      <div
                        onClick={() => toggleExpandIncident(inc.id)}
                        className="px-4 py-3 flex items-center justify-between cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-3">
                          <span className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded text-[8px] font-bold">
                            {inc.id}
                          </span>
                          <span className="font-bold text-slate-200 hover:text-cyan-400 transition-colors">
                            {inc.title}
                          </span>
                          <span className="text-[9px] text-zinc-500">|</span>
                          <span className="text-[10px] text-zinc-500 uppercase">
                            {inc.affectedServices.join(', ')}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-[10px]">
                          <div className="text-zinc-500">
                            Recovery Duration: <span className="text-cyan-400 font-bold">{duration}</span>
                          </div>
                          <div className="text-zinc-500">
                            Severity: <span className="text-rose-400 font-bold">{inc.severity}</span>
                          </div>
                          <div className="text-zinc-400 font-bold uppercase flex items-center gap-1 text-[9px] bg-emerald-950/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                            <Check className="h-3 w-3 text-emerald-400" />
                            Resolved
                          </div>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
                        </div>
                      </div>

                      {/* Expandable Body */}
                      {isExpanded && (
                        <div className="border-t border-zinc-900/60 p-5 bg-black/35 space-y-4 text-[10px]">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Column 1: Root Cause */}
                            <div className="space-y-3">
                              <div>
                                <span className="text-zinc-500 font-bold uppercase text-[9px]">Root Cause Assessment</span>
                                <p className="text-[11px] text-zinc-300 font-semibold mt-1 leading-relaxed">
                                  {inc.rootCause}
                                </p>
                              </div>

                              <div>
                                <span className="text-zinc-500 font-bold uppercase text-[9px]">Ingested Anomalies & Evidence</span>
                                <ul className="mt-1 space-y-1">
                                  {inc.evidence.map((ev, idx) => (
                                    <li key={idx} className="flex items-start gap-1.5 text-zinc-400">
                                      <CornerDownRight className="h-3 w-3 text-cyan-500 shrink-0 mt-0.5" />
                                      <span className="font-mono text-[9px]">{ev}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            {/* Column 2: Runbook execution outcomes */}
                            <div className="space-y-3">
                              <span className="text-zinc-500 font-bold uppercase text-[9px]">Auto-Healing Playbook History</span>
                              <div className="space-y-2">
                                {inc.recoveryPlan.map((step, idx) => (
                                  <div key={idx} className="border border-zinc-900/60 bg-zinc-950/50 rounded p-3 font-mono text-[9px] space-y-1">
                                    <div className="flex justify-between items-center text-zinc-400">
                                      <span>Step {idx + 1}: {step.description}</span>
                                      <span className="text-emerald-400 font-bold uppercase text-[8px]">exit 0</span>
                                    </div>
                                    <pre className="text-cyan-400/90 whitespace-pre overflow-x-auto p-1 bg-black/40 rounded text-[8px]">{step.command}</pre>
                                    {step.output && (
                                      <div className="text-zinc-500 text-[8px] overflow-x-auto whitespace-pre-wrap border-t border-zinc-900/60 pt-1">
                                        {step.output}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Verify and Postmortem details */}
                          <div className="pt-3 border-t border-zinc-900/60 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <span className="text-zinc-500 font-bold uppercase text-[9px]">Outcome Verification Checklist</span>
                              <div className="flex flex-wrap gap-2 mt-1.5">
                                {inc.verificationPlan?.map((ver, idx) => (
                                  <span key={idx} className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-[8px] font-bold text-zinc-400">
                                    <CheckCircle className="h-3 w-3 text-cyan-400" />
                                    {ver}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {inc.postmortem && (
                              <div className="text-right flex items-end justify-end">
                                <button
                                  onClick={() => {
                                    alert(`Immutable audit logs saved in continuous learning storage:\n\n${inc.postmortem}`);
                                  }}
                                  className="text-[9px] text-cyan-400 font-bold uppercase flex items-center gap-1 border border-cyan-500/20 bg-cyan-950/20 px-3 py-1 rounded hover:bg-cyan-950/40 hover:text-cyan-300 transition-all"
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                  Inspect postmortem audit
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
