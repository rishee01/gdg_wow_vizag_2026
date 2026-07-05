import { NextResponse } from 'next/server'
import { loadHistoricalIncidents, saveHistoricalIncident, saveLearningMetadata } from '@/lib/correlation-engine/persistence'

export async function GET() {
  try {
    const historical = loadHistoricalIncidents()
    return NextResponse.json(historical)
  } catch (error) {
    console.error('Historical GET Error:', error)
    return NextResponse.json({ error: 'Failed to load historical incidents' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { incident, learningMetadata } = body

    if (!incident || !incident.id) {
      return NextResponse.json({ error: 'Missing incident details' }, { status: 400 })
    }

    // Save incident to historical record database
    saveHistoricalIncident(incident)

    // Save continuous learning metadata
    if (learningMetadata) {
      saveLearningMetadata(learningMetadata)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Historical POST Error:', error)
    return NextResponse.json({ error: 'Failed to save historical incident' }, { status: 500 })
  }
}
