'use client'

import React from 'react'
import { AreaChart, RadialGauge } from '@/components/svg-charts'
import { TrendingUp, BarChart4, Zap, Activity } from 'lucide-react'

export default function AnalyticsPage() {
  // Mock historical trends
  const incidentsPerDay = [14, 12, 10, 8, 15, 11, 7, 5, 9, 12, 6, 4, 3, 5, 2, 4, 1]
  const noiseReduction = [10, 15, 22, 34, 45, 50, 62, 70, 78, 82, 85, 88, 91, 93, 92, 94, 95]
  const recoveryTimes = [45, 42, 38, 32, 28, 24, 21, 18, 17, 19, 16, 15, 14, 15, 14.2, 14.5, 14.2]

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <header className="border-b border-border/30 pb-5">
        <h1 className="text-xl font-bold tracking-tight text-slate-100 font-mono uppercase">
          Analytics & Insights
        </h1>
        <p className="text-xs text-muted-foreground font-mono">
          Long-term service telemetry reliability metrics audit.
          </p>
      </header>

      {/* Grid rows */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric 1 */}
        <div className="border border-border/40 bg-zinc-950/40 p-5 rounded-lg space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
            <span className="font-mono text-xs text-slate-300 font-semibold uppercase flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-cyan-400" /> Incidents Trend (30d)
            </span>
          </div>
          <div className="space-y-1">
            <span className="font-mono text-2xl font-bold text-slate-100 block">1.4 / day</span>
            <span className="font-mono text-[9px] text-emerald-400 uppercase font-bold">-45.2% Reduction MoM</span>
          </div>
          <AreaChart data={incidentsPerDay} height={100} colorClassName="stroke-cyan-500" fillColorClassName="fill-cyan-500/5" />
        </div>

        {/* Metric 2 */}
        <div className="border border-border/40 bg-zinc-950/40 p-5 rounded-lg space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
            <span className="font-mono text-xs text-slate-300 font-semibold uppercase flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-cyan-400" /> Alert Noise Reduction
            </span>
          </div>
          <div className="space-y-1">
            <span className="font-mono text-2xl font-bold text-slate-100 block">95.2%</span>
            <span className="font-mono text-[9px] text-emerald-400 uppercase font-bold">Alert Deduplication Efficiency</span>
          </div>
          <AreaChart data={noiseReduction} height={100} colorClassName="stroke-cyan-400" fillColorClassName="fill-cyan-400/5" />
        </div>

        {/* Metric 3 */}
        <div className="border border-border/40 bg-zinc-950/40 p-5 rounded-lg space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
            <span className="font-mono text-xs text-slate-300 font-semibold uppercase flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-cyan-400" /> MTTR Index (Minutes)
            </span>
          </div>
          <div className="space-y-1">
            <span className="font-mono text-2xl font-bold text-slate-100 block">14.2 min</span>
            <span className="font-mono text-[9px] text-emerald-400 uppercase font-bold">Stable resolution rate</span>
          </div>
          <AreaChart data={recoveryTimes} height={100} colorClassName="stroke-cyan-500" fillColorClassName="fill-cyan-500/5" />
        </div>
      </section>

      {/* Radial summary cards */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6 border-t border-zinc-900/60 pt-6">
        <div className="border border-border/40 bg-zinc-900/10 p-5 rounded-lg flex flex-col items-center text-center space-y-3 font-mono">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">AI Accuracy Rate</span>
          <RadialGauge value={98} size={90} strokeWidth={6} label="98.2%" sublabel="accuracy" colorClass="stroke-cyan-400" />
        </div>

        <div className="border border-border/40 bg-zinc-900/10 p-5 rounded-lg flex flex-col items-center text-center space-y-3 font-mono">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">SLA Target Met</span>
          <RadialGauge value={99} size={90} strokeWidth={6} label="99.98%" sublabel="actual" colorClass="stroke-emerald-400" />
        </div>

        <div className="border border-border/40 bg-zinc-900/10 p-5 rounded-lg flex flex-col items-center text-center space-y-3 font-mono">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Auto-healing Rate</span>
          <RadialGauge value={84} size={90} strokeWidth={6} label="84.2%" sublabel="automated" colorClass="stroke-cyan-500" />
        </div>

        <div className="border border-border/40 bg-zinc-900/10 p-5 rounded-lg flex flex-col items-center text-center space-y-3 font-mono">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Team MTTA SLA</span>
          <RadialGauge value={96} size={90} strokeWidth={6} label="96.1%" sublabel="acknowledged" colorClass="stroke-emerald-400" />
        </div>
      </section>
    </div>
  )
}
