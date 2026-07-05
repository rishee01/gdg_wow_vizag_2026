import { execFile } from 'child_process'

export interface DockerContainer {
  id: string
  name: string
  image: string
  status: string
  state: 'running' | 'exited' | 'paused' | 'restarting' | 'dead' | string
  cpu: number // percentage
  memory: number // percentage
  restarts: number
  logs: string[]
}

function execFilePromise(file: string, args: string[], options = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout) => {
      if (error) reject(error)
      else resolve(stdout)
    })
  })
}

// Temporary availability cache to avoid repeated timeouts when docker is offline
let lastDockerCheckTime = 0
let isDockerAvailableCache = true

export async function collectDockerContainersAsync(): Promise<DockerContainer[] | null> {
  const now = Date.now()
  if (now - lastDockerCheckTime < 30000 && !isDockerAvailableCache) {
    return null // Return cached failure state to prevent hanging requests
  }

  try {
    // 1. Verify if Docker daemon is responsive (2-second timeout limit)
    await execFilePromise('docker', ['info'], { timeout: 2000 })
    isDockerAvailableCache = true
    lastDockerCheckTime = now

    // 2. Fetch container definitions in JSON format
    const formatStr = '{"id":"{{.ID}}","name":"{{.Names}}","image":"{{.Image}}","status":"{{.Status}}","state":"{{.State}}"}'
    const psOutput = await execFilePromise('docker', ['ps', '-a', '--format', formatStr], { timeout: 3000 })
    if (!psOutput.trim()) return []

    const containersRaw = psOutput.trim().split('\n').map(line => {
      try {
        return JSON.parse(line.trim())
      } catch {
        return null
      }
    }).filter(Boolean) as { id: string; name: string; image: string; status: string; state: string }[]

    // 3. Fetch container stats (non-streaming)
    const statsFormat = '{"id":"{{.Container}}","cpu":"{{.CPUPerc}}","mem":"{{.MemUsage}}"}'
    const statsOutput = await execFilePromise('docker', ['stats', '--no-stream', '--format', statsFormat], { timeout: 4000 })
    const statsMap: Record<string, { cpu: number; mem: number }> = {}

    if (statsOutput.trim()) {
      statsOutput.trim().split('\n').forEach(line => {
        try {
          const parsed = JSON.parse(line.trim())
          const cpu = parseFloat(parsed.cpu.replace('%', '')) || 0
          const memStr = parsed.mem.split('/')[0].trim().toLowerCase()
          let memUsageVal = parseFloat(memStr) || 0
          if (memStr.includes('gib')) memUsageVal *= 1024
          const memPercent = Math.min(100, Math.round((memUsageVal / 8192) * 100))
          statsMap[parsed.id] = { cpu, mem: memPercent }
        } catch {
          // Parse fail
        }
      })
    }

    // 4. Fetch logs for each container in parallel using Promise.all
    const logsPromises = containersRaw.map(async (c) => {
      try {
        // Whitelist container name to prevent any args command injection
        const cleanName = c.name.replace(/[^a-zA-Z0-9_-]/g, '')
        const logContent = await execFilePromise('docker', ['logs', cleanName, '--tail=15'], { timeout: 2000 })
        const logs = logContent.trim().split('\n').filter(Boolean)
        return { name: c.name, logs }
      } catch {
        return { name: c.name, logs: [`Container ${c.name} logs unavailable.`] }
      }
    })

    const allLogsResults = await Promise.all(logsPromises)
    const logsMap = Object.fromEntries(allLogsResults.map(r => [r.name, r.logs]))

    // 5. Map all metrics
    const mappedContainers: DockerContainer[] = containersRaw.map(c => {
      const stats = statsMap[c.id] || statsMap[c.name] || { cpu: 2, mem: 5 }
      return {
        id: c.id,
        name: c.name,
        image: c.image,
        status: c.status,
        state: c.state,
        cpu: stats.cpu,
        memory: stats.mem,
        restarts: c.status.toLowerCase().includes('restarting') ? 1 : 0,
        logs: logsMap[c.name] || []
      }
    })

    return mappedContainers
  } catch (error) {
    isDockerAvailableCache = false
    lastDockerCheckTime = now
    return null
  }
}

// Keep synchronous wrapper signature for legacy compatibility
export function collectDockerContainers(): DockerContainer[] | null {
  return null // Return null under sync signature to enforce async adoption
}
