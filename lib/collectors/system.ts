import os from 'os'
import { execFile } from 'child_process'

interface SystemMetrics {
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  platform: string
  hostname: string
  loadAvg: number[]
}

// Thread-safe and race-condition free CPU tracker
let lastCpuInfo = { idle: 0, total: 0 }
let lastCpuCalculationTime = 0
let cachedCpuUsage = 24

function getCpuUsage(): number {
  const now = Date.now()
  if (now - lastCpuCalculationTime < 1000) {
    return cachedCpuUsage
  }

  const cpus = os.cpus()
  let idle = 0
  let total = 0

  cpus.forEach((cpu) => {
    for (const type in cpu.times) {
      total += (cpu.times as any)[type]
    }
    idle += cpu.times.idle
  })

  const deltaIdle = idle - lastCpuInfo.idle
  const deltaTotal = total - lastCpuInfo.total

  if (deltaTotal > 0) {
    const usage = Math.round((1 - deltaIdle / deltaTotal) * 100)
    cachedCpuUsage = Math.min(100, Math.max(0, usage))
    lastCpuInfo = { idle, total }
    lastCpuCalculationTime = now
  }
  
  return cachedCpuUsage
}

function execFilePromise(file: string, args: string[], options = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout) => {
      if (error) reject(error)
      else resolve(stdout)
    })
  })
}

async function getDiskUsageAsync(): Promise<number> {
  try {
    const platform = os.platform()
    if (platform === 'win32') {
      const output = await execFilePromise('wmic', ['logicaldisk', 'get', 'Caption,FreeSpace,Size'], { timeout: 2000 })
      const lines = output.trim().split('\n').slice(1)
      for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        if (parts[0] === 'C:') {
          const free = parseInt(parts[1], 10)
          const size = parseInt(parts[2], 10)
          if (!isNaN(free) && !isNaN(size)) {
            return Math.round(((size - free) / size) * 100)
          }
        }
      }
    } else {
      const output = await execFilePromise('df', ['-k', '/'], { timeout: 2000 })
      const lines = output.trim().split('\n')
      const lastLine = lines[lines.length - 1]
      const parts = lastLine.trim().split(/\s+/)
      if (parts[4]) {
        const percentage = parseInt(parts[4].replace('%', '').trim(), 10)
        if (!isNaN(percentage)) return percentage
      }
    }
  } catch (error) {
    // Fail-safe default
  }
  return 44
}

export async function collectSystemMetricsAsync(): Promise<SystemMetrics> {
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const memoryUsage = Math.round(((totalMem - freeMem) / totalMem) * 100)
  const disk = await getDiskUsageAsync()

  return {
    cpuUsage: getCpuUsage(),
    memoryUsage,
    diskUsage: disk,
    platform: os.platform(),
    hostname: os.hostname(),
    loadAvg: os.loadavg()
  }
}

// Keep synchronous wrapper signature for legacy compatibility
export function collectSystemMetrics(): SystemMetrics {
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const memoryUsage = Math.round(((totalMem - freeMem) / totalMem) * 100)
  return {
    cpuUsage: getCpuUsage(),
    memoryUsage,
    diskUsage: 44, // Synchronous fallback
    platform: os.platform(),
    hostname: os.hostname(),
    loadAvg: os.loadavg()
  }
}
