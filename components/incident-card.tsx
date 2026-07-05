import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TriageStatus = 'idle' | 'triaging' | 'resolved'

export interface TriageResult {
  id: string
  name: string
  rootCause: string
  action: string
}

const resolved = {
  id: 'INC-2041',
  name: 'Global Database Cascading Failure',
  rootCause:
    'Main DB Cluster (db/primary) hit 99% CPU utilization and triggered an Out-Of-Memory (OOM) event. This caused downstream auth token mismatches and API gateway timeouts.',
  action:
    'Automatically scale main-db-cluster to instance tier 2, flush the Redis notification cache, and restart the api-gateway pod.',
}

function Field({
  label,
  status,
  value,
  emphasis,
}: {
  label: string
  status: TriageStatus
  value: string
  emphasis?: boolean
}) {
  const filled = status === 'resolved'
  return (
    <div>
      <dt className="mb-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          'rounded-md border px-4 py-3 transition-all duration-500',
          emphasis ? 'text-lg font-semibold' : 'text-base leading-relaxed',
          filled
            ? 'border-cyan-400/30 bg-secondary text-foreground'
            : 'border-dashed border-border bg-secondary/50 text-foreground/40'
        )}
      >
        {filled ? value : '—'}
      </dd>
    </div>
  )
}

export function IncidentCard({
  status,
  result,
}: {
  status: TriageStatus
  result?: TriageResult | null
}) {
  const isTriaging = status === 'triaging'
  const isResolved = status === 'resolved'

  return (
    <article
      className={cn(
        'relative w-full max-w-2xl rounded-xl border bg-card p-8 transition-all duration-500',
        isTriaging
          ? 'border-amber-400/60 shadow-[0_0_24px_rgba(251,191,36,0.35),0_0_64px_rgba(251,191,36,0.15)]'
          : 'border-cyan-400/60 shadow-[0_0_24px_rgba(34,211,238,0.35),0_0_64px_rgba(34,211,238,0.15)]'
      )}
      aria-label="Active incident"
      aria-busy={isTriaging}
    >
      <div className="mb-6 flex items-center justify-between">
        <span
          className={cn(
            'inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-widest',
            isTriaging
              ? 'border-amber-400/40 text-amber-300'
              : 'border-cyan-400/40 text-cyan-300'
          )}
        >
          <span
            className={cn(
              'h-2 w-2 rounded-full animate-pulse',
              isTriaging ? 'bg-amber-400' : 'bg-cyan-400'
            )}
            aria-hidden="true"
          />
          {isTriaging ? 'Triaging' : 'Active Incident'}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {isResolved ? (result?.id ?? resolved.id) : 'INC-0000'}
        </span>
      </div>

      {isTriaging ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <Loader2
            className="h-10 w-10 animate-spin text-amber-400"
            aria-hidden="true"
          />
          <p className="font-mono text-sm text-amber-200">
            Gemini 1.5 Flash Triaging Stream...
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            Correlating {'>'} 300 error signals across 14 services
          </p>
        </div>
      ) : (
        <dl className="flex flex-col gap-6">
          <Field
            label="Incident Name"
            status={status}
            value={result?.name ?? resolved.name}
            emphasis
          />
          <Field
            label="Root Cause"
            status={status}
            value={result?.rootCause ?? resolved.rootCause}
          />
          <Field
            label="Action"
            status={status}
            value={result?.action ?? resolved.action}
          />
        </dl>
      )}
    </article>
  )
}
