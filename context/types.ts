export type Severity = 'P0' | 'P1' | 'P2' | 'P3'
export type IncidentStatus = 'active' | 'mitigating' | 'resolved'

export interface AlertLog {
  timestamp: string
  level: 'INFO' | 'WARN' | 'ERROR' | 'FATAL'
  service: string
  message: string
  pod?: string
  node?: string
  region: string
  traceId?: string
  correlationId?: string
}

export interface TimelineEvent {
  time: string
  description: string
  type: 'alert' | 'system' | 'ai' | 'user'
}

export interface RecoveryStep {
  command: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  output: string
}

export interface EvidenceItem {
  timestamp: string
  provider: 'system' | 'docker' | 'k8s' | 'logs'
  service: string
  event: string
  severity: 'INFO' | 'WARN' | 'ERROR' | 'FATAL'
  weight: 'High' | 'Medium' | 'Low'
  confidenceContribution: number
  explanation: string
}

export interface DeterministicRCA {
  primaryRootCause: string
  primaryService: string
  secondaryContributors: string[]
  downstreamSymptoms: string[]
  unknownFactors: string[]
  rulesTriggered: string[]
  providerAgreement: {
    providers: string[]
    percentage: number
  }
  blastRadius: {
    affectedCount: number
    percentage: number
    description: string
  }
}

export interface BusinessImpactData {
  usersAffected: number
  requestsFailed: number
  servicesImpacted: string[]
  criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  revenueRisk: number
  operationalSeverity: 'P0' | 'P1' | 'P2' | 'P3'
  estimatedMTTR: number
  slaImpact: number
  assumptions: string[]
}

export interface ConfidenceFactor {
  source: string
  score: number
}

export interface SimilarIncidentResult {
  id: string
  title: string
  similarityScore: number
  previousResolution: string
  recoveryTimeMinutes: number
  runbookExecuted: RecoveryStep[]
  recurringPatternDetected: boolean
}

export interface AIValidation {
  validatedStatus: 'validated' | 'challenged'
  validationExplanation: string
  suggestedAdditionalChecks: string[]
  generatedRemediation?: string
  uncertaintyEstimate: string
  justificationForChange?: string
}

export interface Incident {
  id: string
  title: string
  firstSeen?: string
  lastSeen?: string
  severity: Severity
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  confidence: number // percentage
  rootCause: string
  summary: string
  evidence: string[]
  affectedServices: string[]
  affectedCustomers: string
  businessImpact: string
  revenueImpactRate: number // USD per minute
  usersAffected: number
  timeline: TimelineEvent[]
  blastRadius: string // percentage/description
  recommendedActions: string
  recoveryPlan: RecoveryStep[]
  rollbackPlan: RecoveryStep[]
  verificationPlan: string[]
  status: IncidentStatus
  mitigationProgress: number // 0 to 100
  falsePositiveProbability: number
  postmortem?: string

  // New structured explainability fields
  structuredEvidence?: EvidenceItem[]
  deterministicRCA?: DeterministicRCA
  businessImpactData?: BusinessImpactData
  confidenceBreakdown?: ConfidenceFactor[]
  similarIncidents?: SimilarIncidentResult[]
  aiValidation?: AIValidation
  recoveryIntelligence?: {
    score: number
    expectedMTTR: string
    successRate: number
    risk: 'LOW' | 'MEDIUM' | 'HIGH'
    verificationSteps: string[]
    rollbackAvailable: boolean
    previousRecoveries: { id: string; date: string; time: string; success: boolean }[]
    explanation: {
      whySuggested: string
      historicalEvidence: string
      similarCount: number
      assumptions: string[]
      uncertainty: string
    }
  }
}

export interface ServiceMetrics {
  name: string
  status: 'healthy' | 'degraded' | 'critical'
  cpu: number // percent
  memory: number // percent
  latency: number // ms
  requests: number // rps
  errorRate: number // percent
  sla: number // percent
  slo: number // percent
  errorBudget: number // percent
}

export interface NodeMetrics {
  name: string
  status: 'healthy' | 'degraded' | 'critical'
  cpu: number
  memory: number
  disk: number
  podsCount: number
}

export type SimulationType =
  | 'none'
  | 'database_crash'
  | 'api_ddos'
  | 'redis_eviction'
  | 'memory_leak'
  | 'cpu_spike'
  | 'disk_failure'
  | 'dns_outage'
  | 'cloudflare_outage'
  | 'autoscaling_failure'
  | 'kubernetes_failure'

export interface SystemContextType {
  mode: 'demo' | 'live'
  setMode: (mode: 'demo' | 'live') => void
  systemHealth: number // 0 to 100
  riskScore: number // 0 to 100
  activeSimulation: SimulationType
  services: ServiceMetrics[]
  nodes: NodeMetrics[]
  alerts: AlertLog[]
  incidents: Incident[]
  copilotMessages: { role: 'user' | 'assistant'; content: string; timestamp: Date }[]
  voiceLanguage: 'en' | 'te' | 'hi'
  voiceEnabled: boolean
  capabilities?: Record<string, any>
  triggerSimulation: (type: SimulationType) => void
  clearSimulation: () => void
  runRecoveryStep: (incidentId: string, stepIndex: number) => Promise<void>
  runAllRecoverySteps: (incidentId: string) => Promise<void>
  askCopilot: (question: string) => Promise<void>
  setVoiceLanguage: (lang: 'en' | 'te' | 'hi') => void
  setVoiceEnabled: (enabled: boolean) => void
  clearCopilot: () => void

  // SRE Knowledge & Learning States
  historicalIncidents: Incident[]
  learningMetadata: any[]
  fetchHistoricalData: () => Promise<void>
  archiveResolvedIncident: (incident: Incident) => Promise<void>

  // Judge Mode Presentation
  judgeModeActive: boolean
  judgeModeStep: number
  judgeModeStatusText: string
  startJudgeMode: () => void

  // Incident Replay Player
  replayActive: boolean
  replayCurrentStep: number
  replaySpeed: number
  replayIncidentId: string | null
  startReplay: (incidentId: string) => void
  pauseReplay: () => void
  resumeReplay: () => void
  seekReplay: (stepIndex: number) => void
  stopReplay: () => void
}
