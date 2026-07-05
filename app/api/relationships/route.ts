import { NextResponse } from 'next/server'
import { loadRelationships } from '@/lib/correlation-engine/persistence'

export async function GET() {
  try {
    const relationships = loadRelationships()
    return NextResponse.json(relationships)
  } catch (error) {
    console.error('Relationships GET Error:', error)
    return NextResponse.json({ error: 'Failed to load relationships' }, { status: 500 })
  }
}
