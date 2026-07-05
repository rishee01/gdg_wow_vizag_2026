import { useState } from 'react'
import { type Incident, type SimulationType } from '../types'

export interface JudgeModeContext {
  setMode: (mode: 'demo' | 'live') => void
  triggerSimulation: (type: SimulationType) => void
  incidentsRef: React.MutableRefObject<Incident[]>
  startReplay: (incidentId: string) => void
  runAllRecoverySteps: (incidentId: string) => void
  stopReplay: () => void
}

export function useJudgeMode() {
  const [judgeModeActive, setJudgeModeActive] = useState(false)
  const [judgeModeStep, setJudgeModeStep] = useState(0)
  const [judgeModeStatusText, setJudgeModeStatusText] = useState('')

  const startJudgeMode = (ctx: JudgeModeContext) => {
    if (judgeModeActive) return

    setJudgeModeActive(true)
    ctx.setMode('demo')
    
    // Step 1: Initialize Outage
    setJudgeModeStep(1)
    setJudgeModeStatusText('Step 1/10: Triggering simulated DB Connection Outage...')
    ctx.triggerSimulation('database_crash')

    // Find the newly triggered incident
    setTimeout(() => {
      const activeInc = ctx.incidentsRef.current.find(i => i.status === 'active' || i.status === 'mitigating')
      
      // Step 2: Ingest logs
      setJudgeModeStep(2)
      setJudgeModeStatusText('Step 2/10: Normalizing raw stream logs & events...')
      
      setTimeout(() => {
        // Step 3: Run Deterministic RCA
        setJudgeModeStep(3)
        setJudgeModeStatusText('Step 3/10: Running Evidence Engine. Correlating telemetry indicators...')
        
        setTimeout(() => {
          // Step 4: Expand Incident Relationship Graph
          setJudgeModeStep(4)
          setJudgeModeStatusText('Step 4/10: Rebuilding Incident Relationship Graph. Expanding topological nodes...')
          
          setTimeout(() => {
            // Step 5: Similarity Search
            setJudgeModeStep(5)
            setJudgeModeStatusText('Step 5/10: Performing similarity search across SRE Knowledge Base...')

            setTimeout(() => {
              // Step 6: Recovery Intelligence
              setJudgeModeStep(6)
              setJudgeModeStatusText('Step 6/10: Recovery Intelligence Engine computing playbook confidence (Confidence: 88%)...')
              if (activeInc) {
                // Trigger cinematic replay
                ctx.startReplay(activeInc.id)
              }

              setTimeout(() => {
                // Step 7: Apply Remediation Terminal
                setJudgeModeStep(7)
                setJudgeModeStatusText('Step 7/10: Executing auto-healing runbook via SRE Terminal...')
                if (activeInc) {
                  ctx.runAllRecoverySteps(activeInc.id)
                }

                setTimeout(() => {
                  // Step 8: Telemetry healing & Learning Save
                  setJudgeModeStep(8)
                  setJudgeModeStatusText('Step 8/10: Incident resolved. Continuous Learning Engine archiving postmortem and metadata...')
                  ctx.stopReplay()

                  setTimeout(() => {
                    // Step 9: Re-trigger crash simulation
                    setJudgeModeStep(9)
                    setJudgeModeStatusText('Step 9/10: Simulating PostgreSQL crash a second time to verify learned behavior...')
                    ctx.triggerSimulation('database_crash')

                    setTimeout(() => {
                      // Step 10: Verify higher confidence
                      setJudgeModeStep(10)
                      setJudgeModeStatusText('Step 10/10: Success! Historical pattern matched. Recovery Confidence increased to 98% (Success rate: 100%).')
                      
                      setTimeout(() => {
                        setJudgeModeActive(false)
                        setJudgeModeStep(0)
                        setJudgeModeStatusText('')
                      }, 8000)
                    }, 5000)
                  }, 4000)
                }, 7000)
              }, 6000)
            }, 3000)
          }, 3000)
        }, 3000)
      }, 3000)
    }, 2050)
  }

  return {
    judgeModeActive,
    judgeModeStep,
    judgeModeStatusText,
    startJudgeMode
  }
}
