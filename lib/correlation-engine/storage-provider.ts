import fs from 'fs'
import path from 'path'
import { type Incident } from '@/context/SystemContext'

export interface SearchFilters {
  status?: string
  service?: string
  namespace?: string
  timeRange?: 'all' | 'week'
  query?: string
}

export interface Relationship {
  source: string
  target: string
  type: 'CAUSES' | 'TRIGGERED' | 'DEPENDS_ON' | 'SIMILAR_TO' | 'RESOLVED_BY' | 'DUPLICATE_OF' | 'FOLLOWED_BY' | 'AFFECTS' | 'PART_OF_OUTAGE'
  confidence: number
  explanation: string
}

export interface LearningMetadata {
  incidentId: string
  evidence: string[]
  rootCause: string
  timeline: { time: string; description: string; type: string }[]
  commandsExecuted: { command: string; description: string; status: string; output: string }[]
  recoveryDurationMinutes: number
  verificationOutcome: 'success' | 'failure'
  manualNotes?: string
}

export interface StorageProvider {
  loadIncidents(): Incident[]
  saveIncidents(incidents: Incident[]): void
  queryIncidents(filters: SearchFilters): Incident[]
  
  loadRelationships(): Relationship[]
  saveRelationships(relationships: Relationship[]): void
  
  loadHistoricalIncidents(): Incident[]
  saveHistoricalIncident(incident: Incident): void
  
  loadLearningMetadata(): LearningMetadata[]
  saveLearningMetadata(metadata: LearningMetadata): void
}

// Shared query filter logic
export function queryIncidentsList(incidents: Incident[], filters: SearchFilters): Incident[] {
  return incidents.filter(inc => {
    // 1. Filter by Status
    if (filters.status && filters.status !== 'all') {
      if (inc.status !== filters.status) return false
    }

    // 2. Filter by Service
    if (filters.service && filters.service !== 'ALL') {
      const match = inc.affectedServices.some(s => s.toLowerCase() === filters.service?.toLowerCase())
      if (!match) return false
    }

    // 3. Filter by Namespace
    if (filters.namespace && filters.namespace !== 'ALL') {
      const nsLower = filters.namespace.toLowerCase()
      const inEvidence = inc.evidence.some(e => e.toLowerCase().includes(nsLower))
      const inTitle = inc.title.toLowerCase().includes(nsLower)
      const inCause = inc.rootCause.toLowerCase().includes(nsLower)
      
      if (!inEvidence && !inTitle && !inCause) return false
    }

    // 4. Filter by Time Range (Last Week)
    if (filters.timeRange === 'week') {
      const lastWeek = new Date()
      lastWeek.setDate(lastWeek.getDate() - 7)
      const incDate = new Date(inc.firstSeen || Date.now())
      if (incDate < lastWeek) return false
    }

    // 5. Filter by Text Query
    if (filters.query && filters.query.trim() !== '') {
      const q = filters.query.toLowerCase()
      const inTitle = inc.title.toLowerCase().includes(q)
      const inCause = inc.rootCause.toLowerCase().includes(q)
      const inService = inc.affectedServices.some(s => s.toLowerCase().includes(q))
      const inEvidence = inc.evidence.some(e => e.toLowerCase().includes(q))

      if (!inTitle && !inCause && !inService && !inEvidence) return false
    }

    return true
  })
}

// 1. Memory Storage Provider
export class MemoryStorage implements StorageProvider {
  private incidents: Incident[] = []
  private relationships: Relationship[] = []
  private historicalIncidents: Incident[] = []
  private learningMetadata: LearningMetadata[] = []

  loadIncidents(): Incident[] {
    return [...this.incidents]
  }

  saveIncidents(incidents: Incident[]): void {
    this.incidents = [...incidents]
  }

  queryIncidents(filters: SearchFilters): Incident[] {
    return queryIncidentsList(this.incidents, filters)
  }

  loadRelationships(): Relationship[] {
    return [...this.relationships]
  }

  saveRelationships(relationships: Relationship[]): void {
    this.relationships = [...relationships]
  }

  loadHistoricalIncidents(): Incident[] {
    return [...this.historicalIncidents]
  }

  saveHistoricalIncident(incident: Incident): void {
    const idx = this.historicalIncidents.findIndex(i => i.id === incident.id)
    if (idx !== -1) {
      this.historicalIncidents[idx] = incident
    } else {
      this.historicalIncidents.push(incident)
    }
  }

  loadLearningMetadata(): LearningMetadata[] {
    return [...this.learningMetadata]
  }

  saveLearningMetadata(metadata: LearningMetadata): void {
    const idx = this.learningMetadata.findIndex(m => m.incidentId === metadata.incidentId)
    if (idx !== -1) {
      this.learningMetadata[idx] = metadata
    } else {
      this.learningMetadata.push(metadata)
    }
  }
}

// 2. JSON Storage Provider
export class JsonStorage implements StorageProvider {
  private filePath = path.join(process.cwd(), 'incidents.json')
  private relPath = path.join(process.cwd(), 'relationships.json')
  private histPath = path.join(process.cwd(), 'historical_incidents.json')
  private learnPath = path.join(process.cwd(), 'learning_metadata.json')

  loadIncidents(): Incident[] {
    try {
      if (!fs.existsSync(this.filePath)) {
        return []
      }
      const data = fs.readFileSync(this.filePath, 'utf8')
      return JSON.parse(data) as Incident[]
    } catch (error) {
      console.error('Failed to load incidents.json via JsonStorage:', error)
      return []
    }
  }

  private writeAtomic(filePath: string, data: any): void {
    const tmpPath = filePath + '.tmp'
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8')
    fs.renameSync(tmpPath, filePath)
  }

  saveIncidents(incidents: Incident[]): void {
    try {
      this.writeAtomic(this.filePath, incidents)
    } catch (error) {
      console.error('Failed to save incidents.json via JsonStorage:', error)
    }
  }

  queryIncidents(filters: SearchFilters): Incident[] {
    return queryIncidentsList(this.loadIncidents(), filters)
  }

  loadRelationships(): Relationship[] {
    try {
      if (!fs.existsSync(this.relPath)) return []
      const data = fs.readFileSync(this.relPath, 'utf8')
      return JSON.parse(data) as Relationship[]
    } catch (error) {
      console.error('Failed to load relationships.json via JsonStorage:', error)
      return []
    }
  }

  saveRelationships(relationships: Relationship[]): void {
    try {
      this.writeAtomic(this.relPath, relationships)
    } catch (error) {
      console.error('Failed to save relationships.json via JsonStorage:', error)
    }
  }

  loadHistoricalIncidents(): Incident[] {
    try {
      if (!fs.existsSync(this.histPath)) return []
      const data = fs.readFileSync(this.histPath, 'utf8')
      return JSON.parse(data) as Incident[]
    } catch (error) {
      console.error('Failed to load historical_incidents.json via JsonStorage:', error)
      return []
    }
  }

  saveHistoricalIncident(incident: Incident): void {
    try {
      const current = this.loadHistoricalIncidents()
      const idx = current.findIndex(i => i.id === incident.id)
      if (idx !== -1) {
        current[idx] = incident
      } else {
        current.push(incident)
      }
      this.writeAtomic(this.histPath, current)
    } catch (error) {
      console.error('Failed to save historical_incidents.json via JsonStorage:', error)
    }
  }

  loadLearningMetadata(): LearningMetadata[] {
    try {
      if (!fs.existsSync(this.learnPath)) return []
      const data = fs.readFileSync(this.learnPath, 'utf8')
      return JSON.parse(data) as LearningMetadata[]
    } catch (error) {
      console.error('Failed to load learning_metadata.json via JsonStorage:', error)
      return []
    }
  }

  saveLearningMetadata(metadata: LearningMetadata): void {
    try {
      const current = this.loadLearningMetadata()
      const idx = current.findIndex(m => m.incidentId === metadata.incidentId)
      if (idx !== -1) {
        current[idx] = metadata
      } else {
        current.push(metadata)
      }
      this.writeAtomic(this.learnPath, current)
    } catch (error) {
      console.error('Failed to save learning_metadata.json via JsonStorage:', error)
    }
  }
}

// 3. SQLite Storage Provider (Raw SQL Dump Emulation)
export class SqliteStorage implements StorageProvider {
  private dbPath = path.join(process.cwd(), 'incidents.db')

  loadIncidents(): Incident[] {
    try {
      if (!fs.existsSync(this.dbPath)) {
        return []
      }
      const content = fs.readFileSync(this.dbPath, 'utf8')
      const incidents: Incident[] = []
      const lines = content.split('\n')
      
      for (const line of lines) {
        if (line.startsWith('INSERT INTO incidents')) {
          // Parse: INSERT INTO incidents (id, data) VALUES ('INC-1234', '...');
          const match = line.match(/VALUES\s*\('(.*?)',\s*'(.*)'\);?$/)
          if (match) {
            let dataStr = match[2]
            // Unescape SQL single quotes
            dataStr = dataStr.replace(/''/g, "'")
            incidents.push(JSON.parse(dataStr) as Incident)
          }
        }
      }
      return incidents
    } catch (e) {
      console.error('Failed to load incidents from SqliteStorage:', e)
      return []
    }
  }

  saveIncidents(incidents: Incident[]): void {
    try {
      let sql = ''
      if (fs.existsSync(this.dbPath)) {
        const content = fs.readFileSync(this.dbPath, 'utf8')
        sql = content.split('\n').filter(line => 
          !line.startsWith('CREATE TABLE IF NOT EXISTS incidents') &&
          !line.startsWith('DELETE FROM incidents') &&
          !line.startsWith('INSERT INTO incidents')
        ).join('\n')
        if (!sql.endsWith('\n') && sql.length > 0) sql += '\n'
      } else {
        sql = ''
      }
      sql += 'CREATE TABLE IF NOT EXISTS incidents (id TEXT PRIMARY KEY, data TEXT);\n'
      sql += 'DELETE FROM incidents;\n'
      for (const inc of incidents) {
        const dataStr = JSON.stringify(inc).replace(/'/g, "''")
        sql += `INSERT INTO incidents (id, data) VALUES ('${inc.id}', '${dataStr}');\n`
      }
      fs.writeFileSync(this.dbPath, sql, 'utf8')
    } catch (e) {
      console.error('Failed to save to SqliteStorage:', e)
    }
  }

  queryIncidents(filters: SearchFilters): Incident[] {
    return queryIncidentsList(this.loadIncidents(), filters)
  }

  loadRelationships(): Relationship[] {
    try {
      if (!fs.existsSync(this.dbPath)) return []
      const content = fs.readFileSync(this.dbPath, 'utf8')
      const list: Relationship[] = []
      const lines = content.split('\n')
      for (const line of lines) {
        if (line.startsWith('INSERT INTO relationships')) {
          const match = line.match(/VALUES\s*\('(.*?)',\s*'(.*?)',\s*'(.*?)',\s*'(.*)'\);?$/)
          if (match) {
            let dataStr = match[4].replace(/''/g, "'")
            list.push(JSON.parse(dataStr) as Relationship)
          }
        }
      }
      return list
    } catch (e) {
      console.error('Failed to load relationships from SqliteStorage:', e)
      return []
    }
  }

  saveRelationships(relationships: Relationship[]): void {
    try {
      let sql = ''
      if (fs.existsSync(this.dbPath)) {
        const content = fs.readFileSync(this.dbPath, 'utf8')
        sql = content.split('\n').filter(line => 
          !line.startsWith('CREATE TABLE IF NOT EXISTS relationships') &&
          !line.startsWith('DELETE FROM relationships') &&
          !line.startsWith('INSERT INTO relationships')
        ).join('\n')
        if (!sql.endsWith('\n') && sql.length > 0) sql += '\n'
      }
      sql += 'CREATE TABLE IF NOT EXISTS relationships (source TEXT, target TEXT, type TEXT, data TEXT);\n'
      sql += 'DELETE FROM relationships;\n'
      for (const rel of relationships) {
        const dataStr = JSON.stringify(rel).replace(/'/g, "''")
        sql += `INSERT INTO relationships (source, target, type, data) VALUES ('${rel.source}', '${rel.target}', '${rel.type}', '${dataStr}');\n`
      }
      fs.writeFileSync(this.dbPath, sql, 'utf8')
    } catch (e) {
      console.error('Failed to save relationships to SqliteStorage:', e)
    }
  }

  loadHistoricalIncidents(): Incident[] {
    try {
      if (!fs.existsSync(this.dbPath)) return []
      const content = fs.readFileSync(this.dbPath, 'utf8')
      const list: Incident[] = []
      const lines = content.split('\n')
      for (const line of lines) {
        if (line.startsWith('INSERT INTO historical_incidents')) {
          const match = line.match(/VALUES\s*\('(.*?)',\s*'(.*)'\);?$/)
          if (match) {
            let dataStr = match[2].replace(/''/g, "'")
            list.push(JSON.parse(dataStr) as Incident)
          }
        }
      }
      return list
    } catch (e) {
      console.error('Failed to load historical incidents from SqliteStorage:', e)
      return []
    }
  }

  saveHistoricalIncident(incident: Incident): void {
    try {
      const current = this.loadHistoricalIncidents()
      const index = current.findIndex(i => i.id === incident.id)
      if (index !== -1) {
        current[index] = incident
      } else {
        current.push(incident)
      }

      let sql = ''
      if (fs.existsSync(this.dbPath)) {
        const content = fs.readFileSync(this.dbPath, 'utf8')
        sql = content.split('\n').filter(line => 
          !line.startsWith('CREATE TABLE IF NOT EXISTS historical_incidents') &&
          !line.startsWith('DELETE FROM historical_incidents') &&
          !line.startsWith('INSERT INTO historical_incidents')
        ).join('\n')
        if (!sql.endsWith('\n') && sql.length > 0) sql += '\n'
      }
      sql += 'CREATE TABLE IF NOT EXISTS historical_incidents (id TEXT PRIMARY KEY, data TEXT);\n'
      sql += 'DELETE FROM historical_incidents;\n'
      for (const inc of current) {
        const dataStr = JSON.stringify(inc).replace(/'/g, "''")
        sql += `INSERT INTO historical_incidents (id, data) VALUES ('${inc.id}', '${dataStr}');\n`
      }
      fs.writeFileSync(this.dbPath, sql, 'utf8')
    } catch (e) {
      console.error('Failed to save historical incident to SqliteStorage:', e)
    }
  }

  loadLearningMetadata(): LearningMetadata[] {
    try {
      if (!fs.existsSync(this.dbPath)) return []
      const content = fs.readFileSync(this.dbPath, 'utf8')
      const list: LearningMetadata[] = []
      const lines = content.split('\n')
      for (const line of lines) {
        if (line.startsWith('INSERT INTO learning_metadata')) {
          const match = line.match(/VALUES\s*\('(.*?)',\s*'(.*)'\);?$/)
          if (match) {
            let dataStr = match[2].replace(/''/g, "'")
            list.push(JSON.parse(dataStr) as LearningMetadata)
          }
        }
      }
      return list
    } catch (e) {
      console.error('Failed to load learning metadata from SqliteStorage:', e)
      return []
    }
  }

  saveLearningMetadata(metadata: LearningMetadata): void {
    try {
      const current = this.loadLearningMetadata()
      const index = current.findIndex(m => m.incidentId === metadata.incidentId)
      if (index !== -1) {
        current[index] = metadata
      } else {
        current.push(metadata)
      }

      let sql = ''
      if (fs.existsSync(this.dbPath)) {
        const content = fs.readFileSync(this.dbPath, 'utf8')
        sql = content.split('\n').filter(line => 
          !line.startsWith('CREATE TABLE IF NOT EXISTS learning_metadata') &&
          !line.startsWith('DELETE FROM learning_metadata') &&
          !line.startsWith('INSERT INTO learning_metadata')
        ).join('\n')
        if (!sql.endsWith('\n') && sql.length > 0) sql += '\n'
      }
      sql += 'CREATE TABLE IF NOT EXISTS learning_metadata (incident_id TEXT PRIMARY KEY, data TEXT);\n'
      sql += 'DELETE FROM learning_metadata;\n'
      for (const meta of current) {
        const dataStr = JSON.stringify(meta).replace(/'/g, "''")
        sql += `INSERT INTO learning_metadata (incident_id, data) VALUES ('${meta.incidentId}', '${dataStr}');\n`
      }
      fs.writeFileSync(this.dbPath, sql, 'utf8')
    } catch (e) {
      console.error('Failed to save learning metadata to SqliteStorage:', e)
    }
  }
}

// 4. Remote Supabase Storage Provider Mock
export class SupabaseStorage implements StorageProvider {
  private static mockData: Incident[] = []
  private static mockRelationships: Relationship[] = []
  private static mockHistorical: Incident[] = []
  private static mockLearning: LearningMetadata[] = []

  loadIncidents(): Incident[] {
    console.log('[SupabaseStorage] Querying incident records from remote Postgres tables...')
    return [...SupabaseStorage.mockData]
  }

  saveIncidents(incidents: Incident[]): void {
    console.log('[SupabaseStorage] Syncing batch mutations to remote Postgres engine...')
    SupabaseStorage.mockData = [...incidents]
  }

  queryIncidents(filters: SearchFilters): Incident[] {
    return queryIncidentsList(SupabaseStorage.mockData, filters)
  }

  loadRelationships(): Relationship[] {
    return [...SupabaseStorage.mockRelationships]
  }

  saveRelationships(relationships: Relationship[]): void {
    SupabaseStorage.mockRelationships = [...relationships]
  }

  loadHistoricalIncidents(): Incident[] {
    return [...SupabaseStorage.mockHistorical]
  }

  saveHistoricalIncident(incident: Incident): void {
    const idx = SupabaseStorage.mockHistorical.findIndex(i => i.id === incident.id)
    if (idx !== -1) {
      SupabaseStorage.mockHistorical[idx] = incident
    } else {
      SupabaseStorage.mockHistorical.push(incident)
    }
  }

  loadLearningMetadata(): LearningMetadata[] {
    return [...SupabaseStorage.mockLearning]
  }

  saveLearningMetadata(metadata: LearningMetadata): void {
    const idx = SupabaseStorage.mockLearning.findIndex(m => m.incidentId === metadata.incidentId)
    if (idx !== -1) {
      SupabaseStorage.mockLearning[idx] = metadata
    } else {
      SupabaseStorage.mockLearning.push(metadata)
    }
  }
}

// Storage Configuration
const STORAGE_TYPE = process.env.STORAGE_PROVIDER || 'json'

export function getStorageProvider(): StorageProvider {
  switch (STORAGE_TYPE.toLowerCase()) {
    case 'memory':
      return new MemoryStorage()
    case 'json':
    case 'sqlite':
    default:
      return new JsonStorage()
    case 'supabase':
      return new SupabaseStorage()
  }
}
