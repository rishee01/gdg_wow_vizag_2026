'use client'

import React, { useState } from 'react'
import { useSystem, type ServiceMetrics } from '@/context/SystemContext'
import { AreaChart } from '@/components/svg-charts'
import { cn } from '@/lib/utils'
import { Activity, Clock, Sliders, Database, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function ServicesPage() {
  const { services, activeSimulation } = useSystem()
  const [selectedServiceName, setSelectedServiceName] = useState<string | null>(null)

  const activeServiceName = selectedServiceName || (services.length > 0 ? services[0].name : null)
  const activeService = services.find(s => s.name === activeServiceName)

  // Generate fake latency logs for trend graph
  const getLatencyTrend = (name: string): number[] => {
    // Spikes during outages
    const base = [35, 42, 38, 45, 52, 48, 39, 41, 44, 46, 50, 48, 42, 45, 49, 47, 44]
    if (activeSimulation !== 'none') {
      if (activeSimulation === 'database_crash' && (name === 'Orders Service' || name === 'Payment Service')) {
        return base.map(l => l * 40 + Math.random() * 100)
      }
      if (activeSimulation === 'api_ddos' && name === 'API Gateway') {
        return base.map(l => l * 50 + Math.random() * 200)
      }
      if (activeSimulation === 'cpu_spike' && name === 'Payment Service') {
        return base.map(l => l * 90)
      }
    }
    return base
  }

  // Response code breakdown
  const getResponseCodes = (svc: ServiceMetrics) => {
    if (svc.status === 'critical') {
      return { '2xx': 20, '3xx': 5, '4xx': 10, '5xx': 65 }
    } else if (svc.status === 'degraded') {
      return { '2xx': 65, '3xx': 10, '4xx': 15, '5xx': 10 }
    }
    return { '2xx': 98.4, '3xx': 1.1, '4xx': 0.4, '5xx': 0.1 }
  }

  return (
    <div className="p-8 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-border/30 pb-5 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 font-mono uppercase">
            Service Registry
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            SLA and SLO parameters validation tracker for internal application nodes.
          </p>
        </div>
      </header>

      {/* Grid: service table & sidebar */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 mt-6 min-h-0">
        {/* Table list */}
        <section className="flex-1 border border-border/40 bg-black/40 rounded-lg overflow-hidden flex flex-col min-h-0">
          <div className="flex border-b border-zinc-800/80 px-4 py-3 bg-zinc-950 font-mono text-[9px] uppercase tracking-widest font-bold text-zinc-500 select-none">
            <div className="flex-1">Service Name</div>
            <div className="w-24 shrink-0 text-center">Status</div>
            <div className="w-28 shrink-0 text-right">RPS</div>
            <div className="w-28 shrink-0 text-right">p99 Latency</div>
            <div className="w-28 shrink-0 text-right">Error Budget</div>
            <div className="w-28 shrink-0 text-right">SLA / Actual</div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/60 font-mono text-[11px]">
            {services.map((svc) => {
              const isSelected = activeServiceName === svc.name
              const isOutage = svc.status !== 'healthy'

              return (
                <div
                  key={svc.name}
                  onClick={() => setSelectedServiceName(svc.name)}
                  className={cn(
                    "flex items-center px-4 py-3.5 cursor-pointer hover:bg-zinc-900/40 transition-all border-l-2",
                    isSelected 
                      ? "bg-zinc-900/40 border-cyan-400" 
                      : isOutage 
                      ? "border-rose-500 bg-rose-950/5 text-rose-300"
                      : "border-transparent"
                  )}
                >
                  <div className="flex-1 text-slate-200 font-semibold">{svc.name}</div>
                  
                  {/* Status badge */}
                  <div className="w-24 shrink-0 flex justify-center">
                    <span className={cn(
                      "text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider",
                      svc.status === 'healthy' 
                        ? "border-emerald-500/20 text-emerald-400 bg-emerald-950/10" 
                        : svc.status === 'degraded'
                        ? "border-amber-500/20 text-amber-400 bg-amber-950/10"
                        : "border-rose-500/20 text-rose-400 bg-rose-950/10 animate-pulse"
                    )}>
                      {svc.status}
                    </span>
                  </div>

                  <div className="w-28 shrink-0 text-right text-zinc-300 font-bold">{svc.requests.toLocaleString()}</div>
                  <div className="w-28 shrink-0 text-right text-zinc-300">{svc.latency}ms</div>
                  <div className={cn(
                    "w-28 shrink-0 text-right font-bold",
                    svc.errorBudget < 80 ? "text-rose-400" : "text-cyan-400"
                  )}>
                    {svc.errorBudget}%
                  </div>
                  <div className="w-28 shrink-0 text-right text-zinc-400">
                    {svc.sla}% / <span className={isOutage ? 'text-rose-400 font-bold' : 'text-emerald-400'}>{svc.status === 'healthy' ? svc.sla : '92.4'}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Latency graphs & SLO metrics sidebar */}
        <aside className="w-full lg:w-80 shrink-0 border border-border/40 bg-zinc-950/40 rounded-lg p-5 flex flex-col justify-between font-mono">
          {activeService ? (
            <div className="space-y-6 flex-1 flex flex-col min-h-0">
              <div className="border-b border-zinc-800 pb-3 shrink-0 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-100 uppercase">{activeService.name} Metrics</h3>
                <Activity className="h-4 w-4 text-zinc-500 shrink-0" />
              </div>

              {/* Latency graph */}
              <div className="space-y-2 shrink-0">
                <div className="flex justify-between text-[10px] text-zinc-500 uppercase">
                  <span>Latency trend (p99)</span>
                  <span className="text-slate-300">{activeService.latency}ms average</span>
                </div>
                <div className="border border-zinc-900 rounded p-2 bg-black/40">
                  <AreaChart
                    data={getLatencyTrend(activeService.name)}
                    height={75}
                    colorClassName={activeService.status === 'critical' ? 'stroke-rose-500' : 'stroke-cyan-400'}
                    fillColorClassName={activeService.status === 'critical' ? 'fill-rose-500/5' : 'fill-cyan-400/5'}
                  />
                </div>
              </div>

              {/* Status parameters */}
              <div className="space-y-4 text-xs flex-1 overflow-y-auto">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Service Status:</span>
                  <span className={cn(
                    "font-bold uppercase",
                    activeService.status === 'healthy' ? 'text-emerald-400' : 'text-rose-400'
                  )}>{activeService.status}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-zinc-500">SLO target profile:</span>
                  <span className="text-slate-300">&gt; {activeService.slo}% availability</span>
                </div>

                {/* HTTP codes chart */}
                <div className="space-y-2 pt-3 border-t border-zinc-900">
                  <span className="text-[10px] text-zinc-500 uppercase block">Response Code Share</span>
                  <div className="space-y-1.5 text-[10px]">
                    {Object.entries(getResponseCodes(activeService)).map(([code, share]) => (
                      <div key={code} className="flex items-center gap-2">
                        <span className="w-8 text-zinc-400">{code}:</span>
                        <div className="flex-1 h-2 rounded bg-zinc-900 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded transition-all duration-500",
                              code === '2xx' 
                                ? 'bg-emerald-500' 
                                : code === '3xx'
                                ? 'bg-zinc-600'
                                : code === '4xx'
                                ? 'bg-amber-500'
                                : 'bg-rose-500 animate-pulse'
                            )}
                            style={{ width: `${share}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-slate-300 font-bold">{share}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-600 py-12">
              <Sliders className="h-8 w-8 text-zinc-700 mb-2" />
              <p className="text-[10px] uppercase">Select a service registry row to display SLA breakdown parameters</p>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-zinc-900/60 text-[9px] text-zinc-500 leading-normal font-sans shrink-0">
            SLA targets compliance checks are audited automatically every 24 hours.
          </div>
        </aside>
      </div>
    </div>
  )
}
