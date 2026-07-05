'use client'

import { useEffect, useRef, useState } from 'react'

const baseLogs = [
  '[02:14:07.113] ERR  pod/api-gateway-7f9c  CrashLoopBackOff: back-off 5m0s restarting failed container',
  '[02:14:07.482] ERR  svc/payments  upstream connect error: connection refused (503)',
  '[02:14:08.001] ERR  db/primary  FATAL: remaining connection slots reserved for superuser',
  '[02:14:08.377] ERR  pod/worker-queue-2  OOMKilled: memory limit 512Mi exceeded',
  '[02:14:09.030] ERR  svc/auth  JWT validation failed: token signature mismatch',
  '[02:14:09.512] ERR  lb/edge-us-east-1  upstream timeout after 30000ms',
  '[02:14:10.204] ERR  db/replica-3  replication lag exceeds threshold: 4200ms',
  '[02:14:10.688] ERR  pod/api-gateway-7f9c  readiness probe failed: HTTP 500',
  '[02:14:11.145] ERR  svc/notifications  redis: MOVED 8712 10.0.4.22:6379',
  '[02:14:11.903] ERR  cron/cleanup-job  exit code 137: task killed',
  '[02:14:12.336] ERR  svc/payments  circuit breaker OPEN for downstream stripe-proxy',
  '[02:14:12.870] ERR  pod/search-idx-0  disk pressure: /data 97% used',
  '[02:14:13.421] ERR  svc/auth  rate limit exceeded: 429 for 10.0.2.14',
  '[02:14:14.009] ERR  db/primary  deadlock detected on relation "orders"',
  '[02:14:14.556] ERR  lb/edge-eu-west-1  TLS handshake error: EOF',
  '[02:14:15.102] ERR  pod/worker-queue-5  panic: runtime error: nil pointer dereference',
  '[02:14:15.734] ERR  svc/inventory  gRPC UNAVAILABLE: transport is closing',
  '[02:14:16.288] ERR  dns/internal  SERVFAIL resolving payments.svc.cluster.local',
  '[02:14:16.845] ERR  pod/api-gateway-7f9c  CrashLoopBackOff: back-off 5m0s restarting failed container',
  '[02:14:17.399] ERR  svc/payments  upstream connect error: connection refused (503)',
  '[02:14:18.021] ERR  db/primary  checkpoint occurring too frequently (12s apart)',
  '[02:14:18.677] ERR  svc/metrics  scrape failed: context deadline exceeded',
  '[02:14:19.230] ERR  pod/cache-warm-1  liveness probe failed: connection reset by peer',
  '[02:14:19.884] ERR  svc/auth  session store unreachable: dial tcp 10.0.4.22:6379 i/o timeout',
]

const stormTemplates = [
  'ERR  db/primary  CPU utilization 99% — OOM event imminent',
  'ERR  db/primary  Out-Of-Memory (OOM) killer invoked on postgres backend',
  'ERR  svc/auth  token mismatch cascade: 4xx spike +812%',
  'ERR  lb/api-gateway  502 Bad Gateway — upstream pool exhausted',
  'ERR  db/replica-1  replication stream broke: connection reset',
  'ERR  svc/payments  timeout waiting for db/primary (30000ms)',
  'ERR  redis/notifications  eviction storm: maxmemory reached',
  'ERR  pod/api-gateway-7f9c  SIGKILL received — restart #47',
  'ERR  db/primary  too many clients already (max_connections=200)',
  'ERR  svc/orders  transaction rollback: could not serialize access',
  'ERR  lb/edge-us-east-1  health check failing across all targets',
  'ERR  svc/inventory  downstream db/primary unreachable',
]

function stormLog() {
  const t = stormTemplates[Math.floor(Math.random() * stormTemplates.length)]
  const now = new Date()
  const ts = `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`
  return `[${ts}] ${t}`
}

export function RawFirehose({ streaming }: { streaming: boolean }) {
  const [logs, setLogs] = useState<string[]>(baseLogs)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!streaming) return
    const id = setInterval(() => {
      setLogs((prev) => {
        const next = [...prev, stormLog()]
        return next.length > 400 ? next.slice(-400) : next
      })
    }, 100)
    return () => clearInterval(id)
  }, [streaming])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs])

  return (
    <aside
      className="flex h-full w-full flex-col bg-black"
      aria-label="Raw error log firehose"
    >
      <header className="flex items-center justify-between border-b border-red-950 px-4 py-3">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-red-500">
          Raw Firehose
        </h2>
        {streaming ? (
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-red-400">
            <span
              className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping"
              aria-hidden="true"
            />
            Live
          </span>
        ) : null}
      </header>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 scroll-smooth"
      >
        <ul className="flex flex-col gap-2">
          {logs.map((log, i) => (
            <li
              key={i}
              className="font-mono text-[11px] leading-relaxed text-red-500 break-all"
            >
              {log}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
