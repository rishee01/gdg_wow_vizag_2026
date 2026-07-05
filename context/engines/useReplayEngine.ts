import { useState } from 'react'

export function useReplayEngine() {
  const [replayActive, setReplayActive] = useState(false)
  const [replayCurrentStep, setReplayCurrentStep] = useState(0)
  const [replaySpeed, setReplaySpeed] = useState(1)
  const [replayIncidentId, setReplayIncidentId] = useState<string | null>(null)

  const startReplay = (incidentId: string) => {
    setReplayActive(true)
    setReplayIncidentId(incidentId)
    setReplayCurrentStep(0)
  }

  const pauseReplay = () => {
    setReplayActive(false)
  }

  const resumeReplay = () => {
    setReplayActive(true)
  }

  const seekReplay = (stepIndex: number) => {
    setReplayCurrentStep(stepIndex)
  }

  const stopReplay = () => {
    setReplayActive(false)
    setReplayIncidentId(null)
    setReplayCurrentStep(0)
  }

  return {
    replayActive,
    setReplayActive,
    replayCurrentStep,
    setReplayCurrentStep,
    replaySpeed,
    setReplaySpeed,
    replayIncidentId,
    startReplay,
    pauseReplay,
    resumeReplay,
    seekReplay,
    stopReplay
  }
}
