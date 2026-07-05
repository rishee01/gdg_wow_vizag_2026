import { NextResponse } from 'next/server'
import { evaluateSystemLogs } from '@/lib/triage'

const MOCK_ALERTS = [
  '[02:14:07.113] ERR  pod/api-gateway-7f9c  CrashLoopBackOff: back-off 5m0s restarting failed container',
  '[02:14:07.482] ERR  svc/payments  upstream connect error: connection refused (503)',
  '[02:14:08.001] ERR  db/primary  FATAL: remaining connection slots reserved for superuser',
  '[02:14:08.377] ERR  pod/worker-queue-2  OOMKilled: memory limit 512Mi exceeded',
  '[02:14:11.145] ERR  svc/notifications  redis: MOVED 8712 10.0.4.22:6379',
  'ERR  db/primary  CPU utilization 99% — OOM event imminent',
  'ERR  db/primary  Out-Of-Memory (OOM) killer invoked on postgres backend',
  'ERR  svc/auth  token mismatch cascade: 4xx spike +812%',
  'ERR  lb/api-gateway  502 Bad Gateway — upstream pool exhausted'
]

export async function POST(request: Request) {
  let alerts: string[] = []

  try {
    const body = await request.json()
    if (body && Array.isArray(body.alerts)) {
      alerts = body.alerts
    }
  } catch (error) {
    // payload empty or malformed
  }

  // Fallback to MOCK_ALERTS if POST payload has no alerts
  if (alerts.length === 0) {
    alerts = MOCK_ALERTS
  }

  const result = evaluateSystemLogs(alerts)
  return NextResponse.json(result)
}

export async function GET() {
  const result = evaluateSystemLogs(MOCK_ALERTS)
  return NextResponse.json(result)
}
