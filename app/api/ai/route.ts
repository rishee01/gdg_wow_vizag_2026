import { NextResponse } from 'next/server'

function sanitizeAICopilotResponse(text: string): string {
  // 1. Detect and prevent destructive command patterns
  const destructiveRegex = /\b(rm\s+-rf|mkfs|dd\s+if|shutdown|reboot|poweroff|init\s+0)\b/gi
  if (destructiveRegex.test(text)) {
    return `### Security Warning\n\nThe SRE AI Assistant suggested a command that has been blocked by PulseControl's SRE Security Policy (destructive command pattern detected). Execution blocked.`
  }

  // 2. Override DoS scaling policies (scaling down to 0)
  let sanitized = text
  const scaleZeroRegex = /--replicas=0\b/g
  if (scaleZeroRegex.test(sanitized)) {
    sanitized = sanitized.replace(scaleZeroRegex, '--replicas=1')
    sanitized += `\n\n*Note: An AI suggestion attempting to scale replicas to 0 has been overridden to 1 by PulseControl security parameters to prevent service disruption.*`
  }

  return sanitized
}

export async function POST(request: Request) {
  try {
    const { question, currentIncident, simulationType } = await request.json()
    const apiKey = process.env.GEMINI_API_KEY

    // Fallback response generator (Local Heuristics Engine)
    const getFallbackReply = () => {
      if (!currentIncident || simulationType === 'none') {
        return `I am PulseControl's SRE Co-pilot. There is currently no active simulation or incident recorded. 
        
You can trigger an outage simulation on the **Dashboard** (e.g., Database Crash, DDoS Attack, Kubernetes Node failure) to review AI-driven triage streams, dependency cascading graphs, and executable healing playbooks.`
      }

      const q = question.toLowerCase()
      const title = currentIncident.title
      const root = currentIncident.rootCause
      const plan = currentIncident.recoveryPlan
      const affected = currentIncident.affectedServices.join(', ')

      if (q.includes('why') || q.includes('cause') || q.includes('reason')) {
        return `### Root Cause Analysis (Local SRE Heuristics)

The ongoing incident **${currentIncident.id}** (${title}) is caused by:
**${root}**

**Downstream Cascades:**
1. Sockets on the **${affected}** pods are returning gateway timeouts.
2. The front-end API gateway is dropping customer checkout requests.
3. Thread locks on parent nodes are preventing Kubernetes HPA scales.

**Suggested Inspection command:**
\`\`\`bash
kubectl get pods -n core -o wide --field-selector status.phase=Running
\`\`\``
      }

      if (q.includes('fix') || q.includes('remediat') || q.includes('command') || q.includes('runbook')) {
        let response = `### SRE Remediation Playbook for ${currentIncident.id}\n\nHere are the executable recovery commands identified for this outage:\n\n`
        plan.forEach((step: any, idx: number) => {
          response += `**Step ${idx + 1}: ${step.description}**\n\`\`\`bash\n${step.command}\n\`\`\`\n\n`
        })
        response += `You can execute these commands step-by-step from the **Incidents tab** UI to observe telemetry metrics recover in real-time.`
        return response
      }

      if (q.includes('predict') || q.includes('next') || q.includes('future')) {
        return `### Predictive Impact Assessment

Given the current bottleneck in **${affected}**, if this state persists for > 5 minutes:
1. **Queue Saturation:** Downstream Kafka ingestion clusters will hit maximum memory triggers, dropping telemetry packages.
2. **Cluster Outage:** The Kubernetes scheduler will flag neighboring nodes as \`NotReady\` due to memory pressure.
3. **SLA Breach:** Global checkout availability will drop below the SLA limit of 99.9% (currently at 92.4%).`
      }

      if (q.includes('terraform') || q.includes('iac') || q.includes('config')) {
        return `### Generated Terraform Configuration Fix

To prevent future occurrences of **${title}**, I recommend applying resource limit profiles and configuration parameters. Here is the suggested HCL definition:

\`\`\`hcl
# main.tf - Resource Limits profile
resource "kubernetes_deployment" "auth_service" {
  metadata {
    name      = "auth-service"
    namespace = "core"
  }
  spec {
    replicas = 4
    template {
      metadata {
        labels = { app = "auth-service" }
      }
      spec {
        container {
          name  = "auth"
          image = "auth-service:v2.14.3"
          resources {
            limits = {
              cpu    = "1000m"
              memory = "1024Mi"
            }
            requests = {
              cpu    = "250m"
              memory = "256Mi"
            }
          }
        }
      }
    }
  }
}
\`\`\``
      }

      return `### SRE AI Assistant Context: ${currentIncident.id}

I am monitoring the active **${title}** incident.

* **Blast Radius:** ${currentIncident.blastRadius}
* **Affected users:** ${currentIncident.usersAffected.toLocaleString()}
* **Revenue Bleed Rate:** $${currentIncident.revenueImpactRate}/min

You can ask me questions such as:
- *Why did this happen?* (Root Cause Details)
- *Show remediation commands.* (Step-by-step scripts)
- *Predict next failure.* (Downstream risks)
- *Generate Terraform fix.* (IaC code configuration)`
    }

    if (!apiKey) {
      return NextResponse.json({ reply: getFallbackReply() })
    }

    const systemPrompt = `You are a Principal SRE, Systems Architect, and Lead DevOps engineer at Google. 
You are assisting an on-call SRE debugging a production outage. 
Analyze the current system simulation details and provide professional, technical, concise, and highly realistic answers.
Do not give vague or superficial answers. Write like a staff engineer.

Current Incident Details:
${JSON.stringify(currentIncident || { status: 'none', message: 'No active incident.' }, null, 2)}
Active Simulation: ${simulationType}`

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`

    const apiBody = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${systemPrompt}\n\nUser Question: ${question}` }
          ]
        }
      ],
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.2
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey // Header security fix
      },
      body: JSON.stringify(apiBody)
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Gemini API request failed:', errText)
      return NextResponse.json({ reply: getFallbackReply() })
    }

    const data = await response.json()
    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || getFallbackReply()

    // Enforce safety sanitization on LLM responses
    reply = sanitizeAICopilotResponse(reply)

    return NextResponse.json({ reply })
  } catch (error: any) {
    console.error('Error in AI Copilot handler:', error)
    return NextResponse.json({ 
      reply: 'An unexpected error occurred in the PulseControl SRE AI Engine. Using local heuristics engine fallback.' 
    }, { status: 500 })
  }
}
