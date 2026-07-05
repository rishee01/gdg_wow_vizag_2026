import { NextResponse } from 'next/server'
import { collectDockerContainers } from '@/lib/collectors/docker'
import { collectK8sData } from '@/lib/collectors/k8s'
import { collectSystemMetrics } from '@/lib/collectors/system'

export async function GET() {
  try {
    const system = collectSystemMetrics()
    const docker = collectDockerContainers()
    const k8s = collectK8sData()

    return NextResponse.json({
      docker: docker || [],
      k8s: k8s || null,
      system: {
        platform: system.platform,
        hostname: system.hostname,
        cpu: system.cpuUsage,
        memory: system.memoryUsage,
        disk: system.diskUsage
      },
      hasDocker: docker !== null,
      hasK8s: k8s !== null
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to collect infrastructure details' }, { status: 500 })
  }
}
