'use client'

import React, { useState, useEffect } from 'react'
import { useSystem, type AlertLog } from '@/context/SystemContext'
import { cn } from '@/lib/utils'
import {
  Search,
  Filter,
  Terminal,
  Play,
  Pause,
  Copy,
  CheckCircle,
  Database
} from 'lucide-react'

export default function AlertsPage() {
  const { alerts } = useSystem()
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'>('ALL')
  const [serviceFilter, setServiceFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLive, setIsLive] = useState(true)
  const [copiedTrace, setCopiedTrace] = useState<string | null>(null)
  const [frozenLogs, setFrozenLogs] = useState<AlertLog[]>([])

  // Freeze logs when live toggle is false
  useEffect(() => {
    if (isLive) {
      setFrozenLogs(alerts)
    }
  }, [alerts, isLive])

  // Get active items to render
  const itemsToRender = isLive ? alerts : frozenLogs

  // Perform filtration
  const filteredAlerts = itemsToRender.filter((alert) => {
    const matchesLevel = levelFilter === 'ALL' || alert.level === levelFilter
    const matchesService = serviceFilter === 'ALL' || alert.service === serviceFilter
    const matchesSearch =
      searchQuery === '' ||
      alert.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (alert.traceId && alert.traceId.toLowerCase().includes(searchQuery.toLowerCase()))

    return matchesLevel && matchesService && matchesSearch
  })

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedTrace(text)
    setTimeout(() => setCopiedTrace(null), 1500)
  }

  const uniqueServices = ['API Gateway', 'Auth Service', 'Payment Service', 'Orders Service', 'Notification Service', 'Catalog Service']

  return (
    <div className="p-8 h-full flex flex-col overflow-hidden">
      {/* Header bar */}
      <header className="flex items-center justify-between border-b border-border/30 pb-5 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 font-mono uppercase">
            Alert Explorer
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            Direct firehose streaming anomaly and debug indicators.
          </p>
        </div>

        {/* Live control */}
        <button
          onClick={() => setIsLive(!isLive)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-[10px] uppercase tracking-wider transition-all border",
            isLive 
              ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-400" 
              : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
          )}
        >
          {isLive ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
              Live Feed Active
            </>
          ) : (
            <>
              <Pause className="h-3 w-3" />
              Logs Frozen
            </>
          )}
        </button>
      </header>

      {/* Filter panel */}
      <section className="bg-zinc-900/10 border border-border/30 rounded-lg p-4 my-4 flex flex-col md:flex-row gap-4 shrink-0">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Query regex or service trace ID..."
            className="w-full bg-black/40 border border-zinc-800 rounded pl-9 pr-4 py-2 font-mono text-xs text-slate-200 placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        {/* Level Filters */}
        <div className="flex flex-wrap gap-1 bg-black/30 p-1 rounded border border-zinc-800">
          {(['ALL', 'INFO', 'WARN', 'ERROR', 'FATAL'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className={cn(
                "px-2.5 py-1 rounded font-mono text-[10px] uppercase transition-all",
                levelFilter === lvl 
                  ? "bg-zinc-800 text-slate-100 font-semibold" 
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Service filters */}
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-zinc-500" />
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="bg-black/30 border border-zinc-800 rounded text-xs font-mono px-3 py-2 text-zinc-300 focus:outline-none focus:border-cyan-500/50"
          >
            <option value="ALL">All Services</option>
            {uniqueServices.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Logs Table Area */}
      <section className="flex-1 border border-border/40 bg-black/40 rounded-lg overflow-hidden flex flex-col min-h-0">
        <div className="flex border-b border-zinc-800/80 px-4 py-3 bg-zinc-950 font-mono text-[9px] uppercase tracking-widest font-bold text-zinc-500 select-none">
          <div className="w-24 shrink-0">Timestamp</div>
          <div className="w-16 shrink-0">Level</div>
          <div className="w-36 shrink-0">Service</div>
          <div className="flex-1 min-w-[200px]">Log Message</div>
          <div className="w-32 shrink-0 max-md:hidden">Pod/Node</div>
          <div className="w-24 shrink-0 max-sm:hidden">Trace ID</div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/60 font-mono text-[11px] leading-relaxed">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-24 text-zinc-600">
              <Terminal className="h-8 w-8 mx-auto mb-2 text-zinc-700" />
              <span>No logs matched filter criteria.</span>
            </div>
          ) : (
            filteredAlerts.map((log, i) => (
              <div 
                key={i} 
                className={cn(
                  "flex px-4 py-2 hover:bg-zinc-900/40 border-l-2 transition-all",
                  log.level === 'FATAL' 
                    ? "border-rose-600 bg-rose-950/5 text-rose-300" 
                    : log.level === 'ERROR'
                    ? "border-rose-500 text-rose-400"
                    : log.level === 'WARN'
                    ? "border-amber-500 text-amber-300"
                    : "border-transparent text-zinc-300"
                )}
              >
                {/* Timestamp */}
                <div className="w-24 shrink-0 text-zinc-500">{log.timestamp.replace('[','').replace(']','')}</div>

                {/* Level badge */}
                <div className="w-16 shrink-0">
                  <span className={cn(
                    "text-[9px] font-bold px-1 rounded",
                    log.level === 'FATAL' 
                      ? "bg-rose-600 text-black" 
                      : log.level === 'ERROR'
                      ? "bg-rose-950 text-rose-400 border border-rose-500/20"
                      : log.level === 'WARN'
                      ? "bg-amber-950 text-amber-400 border border-amber-500/20"
                      : "text-zinc-500"
                  )}>
                    {log.level}
                  </span>
                </div>

                {/* Service */}
                <div className="w-36 shrink-0 text-cyan-400/80 truncate pr-2">{log.service}</div>

                {/* Message */}
                <div className="flex-1 min-w-[200px] text-zinc-200 select-all pr-4">{log.message}</div>

                {/* Pod/Node */}
                <div className="w-32 shrink-0 max-md:hidden text-zinc-500 truncate pr-2">
                  {log.pod || '—'}
                </div>

                {/* Trace ID */}
                <div className="w-24 shrink-0 max-sm:hidden">
                  {log.traceId ? (
                    <button
                      onClick={() => copyToClipboard(log.traceId!)}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1 select-none"
                      title="Copy Trace ID"
                    >
                      <span>{log.traceId}</span>
                      {copiedTrace === log.traceId ? (
                        <CheckCircle className="h-3 w-3 text-cyan-400" />
                      ) : (
                        <Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" />
                      )}
                    </button>
                  ) : '—'}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
