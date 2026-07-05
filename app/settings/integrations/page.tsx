'use client'

import React, { useState } from 'react'
import { Check, ArrowRight, Settings, MessageSquare, AlertCircle, Cpu } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Integration {
  id: string
  name: string
  description: string
  icon: any
  status: 'connected' | 'disconnected'
}

export default function IntegrationsSettingsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'pd',
      name: 'PagerDuty Alert Router',
      description: 'Route alerts matching P0/P1 severity metrics straight to PagerDuty services on-call groups.',
      icon: AlertCircle,
      status: 'connected'
    },
    {
      id: 'slack',
      name: 'Slack Notification Hook',
      description: 'Stream correlated incidents summaries and postmortems to designated Slack channels.',
      icon: MessageSquare,
      status: 'connected'
    },
    {
      id: 'datadog',
      name: 'Datadog Telemetry Ingress',
      description: 'Consume live metric, trace, and log streams from Datadog edge agents directly.',
      icon: Cpu,
      status: 'disconnected'
    }
  ])

  const toggleStatus = (id: string) => {
    setIntegrations(integrations.map(integ => {
      if (integ.id === id) {
        return {
          ...integ,
          status: integ.status === 'connected' ? 'disconnected' : 'connected'
        }
      }
      return integ
    }))
  }

  return (
    <div className="p-8 space-y-6 max-w-5xl font-mono text-xs text-zinc-300">
      {/* Header */}
      <header className="border-b border-border/30 pb-5">
        <h1 className="text-xl font-bold tracking-tight text-slate-100 uppercase">
          Workspace Integrations Suite
        </h1>
        <p className="text-xs text-muted-foreground">
          Bridge alert notifications, metric flows, and incident remediation steps to third-party providers.
        </p>
      </header>

      {/* Grid List */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {integrations.map((integ) => {
          const Icon = integ.icon
          const isConnected = integ.status === 'connected'
          return (
            <div
              key={integ.id}
              className={cn(
                "border rounded-lg p-5 flex flex-col justify-between font-mono bg-zinc-950/40 relative overflow-hidden transition-all duration-300",
                isConnected ? "border-cyan-500/20" : "border-border/40 opacity-70"
              )}
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-9 w-9 rounded border flex items-center justify-center shrink-0",
                    isConnected 
                      ? "bg-cyan-950 border-cyan-500/30 text-cyan-400" 
                      : "bg-zinc-900 border-zinc-800 text-zinc-500"
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200">{integ.name}</h3>
                    <span className={cn(
                      "text-[8px] uppercase tracking-wider font-semibold",
                      isConnected ? "text-cyan-400" : "text-zinc-500"
                    )}>{integ.status}</span>
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-400 font-sans">{integ.description}</p>
              </div>

              <div className="mt-5 pt-4 border-t border-zinc-900/60 flex items-center justify-between select-none">
                <button
                  onClick={() => toggleStatus(integ.id)}
                  className={cn(
                    "px-3 py-1.5 rounded font-bold uppercase tracking-wider text-[10px] border transition-all",
                    isConnected 
                      ? "border-rose-500/30 bg-rose-950/10 text-rose-400 hover:bg-rose-950/20" 
                      : "border-cyan-500/20 bg-cyan-950/10 text-cyan-400 hover:bg-cyan-950/20"
                  )}
                >
                  {isConnected ? 'Disconnect Hook' : 'Establish Connect'}
                </button>
                {isConnected && (
                  <button className="text-zinc-500 hover:text-zinc-300 flex items-center gap-1">
                    <span>Configure</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}
