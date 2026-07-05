import fs from 'fs'
import path from 'path'
import { type AlertLog } from '@/context/SystemContext'

const LOG_FILE_PATH = path.join(process.cwd(), 'ingress-logs.log')

function initializeLogFile() {
  if (!fs.existsSync(LOG_FILE_PATH)) {
    const defaultLogs = [
      '[05:00:01.115] INFO  API Gateway  Heartbeat ping check passed. Ingress endpoints verified.',
      '[05:01:14.288] INFO  Auth Service  Token authorization cache synchronized successfully.',
      '[05:02:40.002] INFO  Orders Service  Orders database pool check passed (active=4, idle=12).',
      '[05:03:10.945] INFO  Payment Service  Stripe proxy handshake verified within 120ms.',
      '[05:04:12.335] INFO  Catalog Service  Search index synchronization complete (1420 items mapped).',
      '[05:05:01.120] INFO  API Gateway  Heartbeat ping check passed. Ingress endpoints verified.',
      '[05:06:14.292] INFO  Auth Service  Token authorization cache synchronized successfully.'
    ].join('\n')
    fs.writeFileSync(LOG_FILE_PATH, defaultLogs)
  }
}

export async function readLocalLogsAsync(limit = 100): Promise<AlertLog[]> {
  try {
    initializeLogFile()
    const content = await fs.promises.readFile(LOG_FILE_PATH, 'utf8')
    const lines = content.trim().split('\n').filter(Boolean)
    const normalizedLogs: AlertLog[] = []

    // Read lines from end (most recent first)
    const recentLines = lines.slice(-limit).reverse()

    recentLines.forEach((line, idx) => {
      // Regex to match: [timestamp] LEVEL ServiceName Message
      const match = line.match(/^\[(.*?)\]\s+(INFO|WARN|ERROR|FATAL)\s+(.*?)\s+(.*)$/)
      if (match) {
        const [, timestamp, level, service, message] = match
        normalizedLogs.push({
          timestamp: `[${timestamp}]`,
          level: level as any,
          service,
          message,
          pod: `${service.toLowerCase().replace(' ', '-')}-live`,
          node: 'localhost',
          region: 'local-host',
          traceId: `tr-l${Math.floor(1000 + Math.random() * 9000)}`
        })
      } else {
        // Fallback for raw lines
        normalizedLogs.push({
          timestamp: `[${new Date().toLocaleTimeString()}]`,
          level: line.includes('ERR') || line.includes('fail') ? 'ERROR' : 'INFO',
          service: 'Local Ingress',
          message: line,
          pod: 'local-ingress-live',
          node: 'localhost',
          region: 'local-host',
          traceId: `tr-l${1000 + idx}`
        })
      }
    })

    return normalizedLogs
  } catch (error) {
    return []
  }
}

export function readLocalLogs(limit = 100): AlertLog[] {
  try {
    initializeLogFile()
    const content = fs.readFileSync(LOG_FILE_PATH, 'utf8')
    const lines = content.trim().split('\n').filter(Boolean)
    const normalizedLogs: AlertLog[] = []
    const recentLines = lines.slice(-limit).reverse()

    recentLines.forEach((line, idx) => {
      const match = line.match(/^\[(.*?)\]\s+(INFO|WARN|ERROR|FATAL)\s+(.*?)\s+(.*)$/)
      if (match) {
        const [, timestamp, level, service, message] = match
        normalizedLogs.push({
          timestamp: `[${timestamp}]`,
          level: level as any,
          service,
          message,
          pod: `${service.toLowerCase().replace(' ', '-')}-live`,
          node: 'localhost',
          region: 'local-host',
          traceId: `tr-l${Math.floor(1000 + Math.random() * 9000)}`
        })
      } else {
        normalizedLogs.push({
          timestamp: `[${new Date().toLocaleTimeString()}]`,
          level: line.includes('ERR') || line.includes('fail') ? 'ERROR' : 'INFO',
          service: 'Local Ingress',
          message: line,
          pod: 'local-ingress-live',
          node: 'localhost',
          region: 'local-host',
          traceId: `tr-l${1000 + idx}`
        })
      }
    })

    return normalizedLogs
  } catch (error) {
    return []
  }
}
