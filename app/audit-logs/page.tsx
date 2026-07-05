'use client'

import React from 'react'
import { FileCode, ShieldAlert, Terminal } from 'lucide-react'

interface AuditEvent {
  timestamp: string
  actor: string
  action: string
  origin: string
  traceId: string
}

export default function AuditLogsPage() {
  const logs: AuditEvent[] = [
    {
      timestamp: '2026-07-05 05:35:10',
      actor: 'system-agent',
      action: 'API key authorization key credentials rotated successfully for developer workspace API access',
      origin: 'pulse-control-internal',
      traceId: 'tr-094b81d4'
    },
    {
      timestamp: '2026-07-05 05:30:14',
      actor: 'SRE on-call (mahar)',
      action: 'Triggered database connection pool failure simulation parameters manually from visual dashboard',
      origin: '10.0.12.87',
      traceId: 'tr-db2418a0'
    },
    {
      timestamp: '2026-07-05 05:28:02',
      actor: 'SRE on-call (mahar)',
      action: 'Added Slack webhooks integrations parameters to settings configuration portal',
      origin: '10.0.12.87',
      traceId: 'tr-ea9401b3'
    },
    {
      timestamp: '2026-07-05 05:14:40',
      actor: 'AI Mitigation Engine',
      action: 'Executed automated rollback patch playbook: INC-2041 scaling deployment auth-service replicas to 6',
      origin: 'system-controller',
      traceId: 'tr-ac094b1a'
    },
    {
      timestamp: '2026-07-05 05:08:12',
      actor: 'system-scheduler',
      action: 'Scheduled cron cleanup job sweep validation metrics completed',
      origin: 'k8s-kube-system',
      traceId: 'tr-99b8214a'
    }
  ]

  return (
    <div className="p-8 h-full flex flex-col overflow-hidden font-mono text-xs">
      {/* Header */}
      <header className="border-b border-border/30 pb-5 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 uppercase">
            Audit Workspace Logs
          </h1>
          <p className="text-xs text-muted-foreground">
            Cryptographically signed immutable logs of administrator configurations.
          </p>
        </div>
      </header>

      {/* Logs Table */}
      <section className="flex-grow border border-border/40 bg-black/40 rounded-lg overflow-hidden flex flex-col mt-6 min-h-0">
        <div className="flex border-b border-zinc-800/80 px-4 py-3 bg-zinc-950 text-[9px] uppercase tracking-widest font-bold text-zinc-500 select-none shrink-0">
          <div className="w-40 shrink-0">Timestamp</div>
          <div className="w-40 shrink-0">Actor Authority</div>
          <div className="flex-grow min-w-[200px]">Action Detail</div>
          <div className="w-36 shrink-0">Origin IP</div>
          <div className="w-24 shrink-0 text-right">Reference ID</div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/60 leading-relaxed text-[11px] text-zinc-300">
          {logs.map((log, idx) => (
            <div key={idx} className="flex px-4 py-3 hover:bg-zinc-900/40 select-all transition-colors">
              <div className="w-40 shrink-0 text-zinc-500">{log.timestamp}</div>
              <div className="w-40 shrink-0 text-cyan-400/90 truncate pr-2">{log.actor}</div>
              <div className="flex-grow min-w-[200px] text-zinc-200 pr-4">{log.action}</div>
              <div className="w-36 shrink-0 text-zinc-500">{log.origin}</div>
              <div className="w-24 shrink-0 text-right text-zinc-600">{log.traceId}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
