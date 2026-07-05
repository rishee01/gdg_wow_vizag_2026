import { type Incident } from '@/context/SystemContext'
import { type Relationship, saveRelationships, loadRelationships } from './persistence'
import { dependsOn, calculateJaccardSimilarity } from './config'

export function rebuildIncidentGraph(allIncidents: Incident[]): Relationship[] {
  // Load existing cached relationships to prevent re-calculating fixed history
  let existingRelationships: Relationship[] = []
  try {
    existingRelationships = loadRelationships()
  } catch (e) {
    // Fallback if load fails
  }

  const relationships: Relationship[] = []

  // Identify active incidents (those whose status is 'active' or 'mitigating')
  const activeIncidents = allIncidents.filter(inc => inc.status === 'active' || inc.status === 'mitigating')
  const activeIds = new Set(activeIncidents.map(i => i.id))

  // Keep all existing relationships where neither the source nor the target is active
  // This preserves all historical relationships, reducing calculations from O(N^2) to O(M * N)
  existingRelationships.forEach(rel => {
    if (!activeIds.has(rel.source) && !activeIds.has(rel.target)) {
      relationships.push(rel)
    }
  })

  // Calculate relationships for active incidents against all other incidents
  for (const active of activeIncidents) {
    for (const other of allIncidents) {
      if (active.id === other.id) continue

      let type: Relationship['type'] | null = null
      let confidence = 0
      let explanation = ''

      const timeA = new Date(active.firstSeen || Date.now()).getTime()
      const timeB = new Date(other.firstSeen || Date.now()).getTime()
      const timeDiff = timeB - timeA
      const sameTime = Math.abs(timeDiff) < 300000 // 5m

      // 1. DUPLICATE_OF
      const rcSim = calculateJaccardSimilarity(active.rootCause, other.rootCause)
      if (rcSim > 0.75 && sameTime) {
        type = 'DUPLICATE_OF'
        confidence = Math.round(90 + rcSim * 10)
        explanation = `Incidents occurred within 5 minutes and share ${Math.round(rcSim * 100)}% root cause syntax overlap.`
      }
      
      // 2. CAUSES / DEPENDS_ON
      else {
        let hasDepRelation = false
        let causeService = ''
        let effectService = ''
        
        for (const sA of active.affectedServices) {
          for (const sB of other.affectedServices) {
            if (dependsOn(sB, sA)) {
              hasDepRelation = true
              causeService = sA
              effectService = sB
              break
            }
          }
        }

        if (hasDepRelation) {
          if (timeDiff >= 0 && timeDiff < 1800000) { // A before B
            type = 'CAUSES'
            confidence = 85
            explanation = `Outage in upstream ${causeService} preceded and caused degradation in downstream dependent ${effectService}.`
          } else {
            type = 'DEPENDS_ON'
            confidence = 80
            explanation = `${effectService} depends directly on the core infrastructure of ${causeService}.`
          }
        }
      }

      // 3. TRIGGERED
      if (!type) {
        const isABeforeB = timeDiff >= 0 && timeDiff < 600000 // 10 minutes
        const sharedInfrastructure = active.evidence.some(eA => other.evidence.some(eB => {
          const podA = eA.match(/pod\/([^\s:]+)/)
          const podB = eB.match(/pod\/([^\s:]+)/)
          if (podA && podB && podA[1] === podB[1]) return true
          const nodeA = eA.match(/node\/([^\s:]+)/)
          const nodeB = eB.match(/node\/([^\s:]+)/)
          if (nodeA && nodeB && nodeA[1] === nodeB[1]) return true
          return false
        }))

        if (sharedInfrastructure && isABeforeB) {
          type = 'TRIGGERED'
          confidence = 82
          explanation = `Shared physical hosting resources triggered sequential alert loops on same infrastructure.`
        }
      }

      // 4. SIMILAR_TO
      if (!type) {
        const setA = new Set(active.affectedServices)
        const setB = new Set(other.affectedServices)
        const serviceOverlap = [...setA].filter(x => setB.has(x)).length / new Set([...setA, ...setB]).size
        const textSim = calculateJaccardSimilarity(active.title + ' ' + active.rootCause, other.title + ' ' + other.rootCause)
        const simScore = serviceOverlap * 0.6 + textSim * 0.4

        if (simScore >= 0.5) {
          type = 'SIMILAR_TO'
          confidence = Math.round(simScore * 100)
          explanation = `Structural profile matches with ${Math.round(serviceOverlap * 100)}% service overlap and similar root cause heuristics.`
        }
      }

      // 5. FOLLOWED_BY
      if (!type) {
        if (timeDiff > 0 && timeDiff < 1800000) { // within 30m
          type = 'FOLLOWED_BY'
          confidence = 65
          explanation = `Temporal sequence: Incident occurred within 30 minutes of predecessor.`
        }
      }

      // 6. AFFECTS / PART_OF_OUTAGE
      if (!type) {
        const timeOverlap = Math.abs(timeDiff) < 1800000
        const isLowLevelA = active.affectedServices.some(s => s.toLowerCase().includes('db') || s.toLowerCase().includes('cache') || s.toLowerCase().includes('postgres') || s.toLowerCase().includes('redis'))
        
        if (timeOverlap && isLowLevelA) {
          type = 'AFFECTS'
          confidence = 75
          explanation = `Database/Cache backend failure is likely affecting mid-tier microservices within the same outage window.`
        } else if (timeOverlap) {
          type = 'PART_OF_OUTAGE'
          confidence = 70
          explanation = `Incident occurred during the same active system-wide operational fault window.`
        }
      }

      if (type) {
        // Avoid inserting duplicates
        const exists = relationships.some(r => r.source === active.id && r.target === other.id && r.type === type)
        if (!exists) {
          relationships.push({
            source: active.id,
            target: other.id,
            type,
            confidence,
            explanation
          })
        }
      }
    }
  }

  // Save to persistence
  saveRelationships(relationships)
  return relationships
}
