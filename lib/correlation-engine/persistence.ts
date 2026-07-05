import { type Incident } from '@/context/SystemContext'
import { getStorageProvider, type SearchFilters, type Relationship, type LearningMetadata } from './storage-provider'

export { type SearchFilters, type Relationship, type LearningMetadata }

export function loadIncidents(): Incident[] {
  return getStorageProvider().loadIncidents()
}

export function saveIncidents(incidents: Incident[]): void {
  getStorageProvider().saveIncidents(incidents)
}

export function queryIncidents(filters: SearchFilters): Incident[] {
  return getStorageProvider().queryIncidents(filters)
}

export function loadRelationships(): Relationship[] {
  return getStorageProvider().loadRelationships()
}

export function saveRelationships(relationships: Relationship[]): void {
  getStorageProvider().saveRelationships(relationships)
}

export function loadHistoricalIncidents(): Incident[] {
  return getStorageProvider().loadHistoricalIncidents()
}

export function saveHistoricalIncident(incident: Incident): void {
  getStorageProvider().saveHistoricalIncident(incident)
}

export function loadLearningMetadata(): LearningMetadata[] {
  return getStorageProvider().loadLearningMetadata()
}

export function saveLearningMetadata(metadata: LearningMetadata): void {
  getStorageProvider().saveLearningMetadata(metadata)
}
