import { NextResponse } from 'next/server'
import { loadIncidents, saveIncidents, queryIncidents, type SearchFilters } from '@/lib/correlation-engine/persistence'

// GET /api/incidents - Search/Filter Incidents
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filters: SearchFilters = {
      query: searchParams.get('query') || undefined,
      service: searchParams.get('service') || undefined,
      namespace: searchParams.get('namespace') || undefined,
      status: (searchParams.get('status') as any) || undefined,
      timeRange: (searchParams.get('timeRange') as any) || undefined
    }

    const incidents = queryIncidents(filters)
    return NextResponse.json(incidents)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to query incidents' }, { status: 500 })
  }
}

// POST /api/incidents - Update Incident Remediation Status
export async function POST(request: Request) {
  try {
    const { incidentId, stepIndex, status, output, mitigationProgress, incidentStatus } = await request.json()
    const incidents = loadIncidents()
    
    const updated = incidents.map(inc => {
      if (inc.id !== incidentId) return inc
      
      const plan = [...inc.recoveryPlan]
      if (stepIndex !== undefined && plan[stepIndex]) {
        plan[stepIndex] = {
          ...plan[stepIndex],
          status: status || plan[stepIndex].status,
          output: output !== undefined ? output : plan[stepIndex].output
        }
      }

      return {
        ...inc,
        recoveryPlan: plan,
        mitigationProgress: mitigationProgress !== undefined ? mitigationProgress : inc.mitigationProgress,
        status: incidentStatus !== undefined ? incidentStatus : inc.status
      }
    })
    
    saveIncidents(updated)
    return NextResponse.json({ success: true, incidents: updated })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update incident state' }, { status: 500 })
  }
}
