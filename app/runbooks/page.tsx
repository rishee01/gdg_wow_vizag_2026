'use client'

import React, { useState } from 'react'
import { BookOpen, AlertTriangle, Code, Terminal, ArrowRight, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RunbookItem {
  id: string
  title: string
  service: string
  symptoms: string[]
  diagnosis: string
  verification: string
  recovery: string
  rollback: string
  escalation: string
}

export default function RunbooksPage() {
  const [selectedId, setSelectedId] = useState('rb-db')

  const runbooks: RunbookItem[] = [
    {
      id: 'rb-db',
      title: 'Database Connection Pool Exhaustion Recovery',
      service: 'PostgreSQL db-primary',
      symptoms: [
        'p99 latency spikes above 8000ms on backend orders service',
        'FATAL: remaining connection slots reserved for superuser errors in logs',
        'API Gateway throws 502 Bad Gateway to incoming cart actions'
      ],
      diagnosis: `kubectl exec -it db-primary-0 -n database -- psql -U postgres -c "
SELECT count(*), state 
FROM pg_stat_activity 
GROUP BY state;"`,
      verification: 'curl -I https://pulsecontrol.com/healthz',
      recovery: `# 1. Force release active connections by canceling long running transactions
kubectl exec -it db-primary-0 -n database -- psql -U postgres -c "
SELECT pg_cancel_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'active' AND query_start < now() - interval '2 minutes';"

# 2. Restart resource gateways to release blocked sockets
kubectl rollout restart deployment api-gateway -n gateway`,
      rollback: '# No rollback required for connection slots cleanup',
      escalation: 'Primary: DB Infra Team (@db-ops) -> Secondary: Director of Engineering (@eng-director)'
    },
    {
      id: 'rb-ddos',
      title: 'HTTP Layer 7 DDoS Traffic Mitigation',
      service: 'API Gateway Ingress Edge',
      symptoms: [
        'Edge requests count exceeds 50,000 requests per second',
        'Ingress controller CPU usage hits 100%',
        'Downstream service calls stall'
      ],
      diagnosis: 'kubectl logs -n gateway -l app=ingress-controller --tail=100 | grep "429\\|502"',
      verification: 'curl -s -o /dev/null -w "%{http_code}" https://pulsecontrol.com/',
      recovery: `# 1. Enable Security Group restrictions to Cloudflare proxies only
aws ec2 authorize-security-group-ingress --group-id sg-edge-lb --ip-permissions "[{\\"IpProtocol\\": \\"tcp\\", \\"FromPort\\": 443, \\"ToPort\\": 443, \\"IpRanges\\": [{\\"CidrIp\\": \\"103.21.244.0/22\\", \\"Description\\": \\"Cloudflare proxy\\"}]}]"

# 2. Deploy rate limit configuration mappings to cluster Ingress
kubectl apply -f config/ingress-ratelimit.yaml`,
      rollback: 'aws ec2 revoke-security-group-ingress --group-id sg-edge-lb ...',
      escalation: 'Primary: SRE Edge Security (@sre-sec) -> Secondary: On-Call Incident Commander (@oncall-ic)'
    },
    {
      id: 'rb-mem',
      title: 'NodeJS Application Server Memory Leak Rollback',
      service: 'Auth Service Pods',
      symptoms: [
        'Linear growth in NodeJS container memory limits',
        'Pod status changes to OOMKilled or CrashLoopBackOff',
        'JWT validation requests return HTTP 500'
      ],
      diagnosis: 'kubectl describe pod -l app=auth-service -n core | grep -E "State:|Last State:|Reason:"',
      verification: 'kubectl get pods -n core -l app=auth-service',
      recovery: `# 1. Revert container image tags to last stable version release
kubectl set image deployment/auth-service auth=auth-service:v2.14.2 -n core

# 2. Spin up temporary replicas buffer
kubectl scale deployment/auth-service --replicas=6 -n core`,
      rollback: 'kubectl set image deployment/auth-service auth=auth-service:v2.14.3 -n core',
      escalation: 'Primary: Core Auth Devs (@auth-team) -> Secondary: Engineering Manager (@em-core)'
    }
  ]

  const activeRunbook = runbooks.find(r => r.id === selectedId) || runbooks[0]

  return (
    <div className="p-8 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-border/30 pb-5 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 font-mono uppercase">
            SRE Runbooks
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            Standard Operating Procedures (SOPs) for cluster incident response.
          </p>
        </div>
      </header>

      {/* Main double column workspace */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 mt-6 min-h-0">
        {/* Left Side: Runbook list */}
        <aside className="w-full lg:w-72 shrink-0 border border-border/40 bg-zinc-950/40 rounded-lg p-4 space-y-3 overflow-y-auto">
          <span className="font-mono text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Available Runbooks</span>
          {runbooks.map((rb) => {
            const isSelected = rb.id === selectedId
            return (
              <button
                key={rb.id}
                onClick={() => setSelectedId(rb.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-all duration-300 font-mono flex items-center gap-3",
                  isSelected 
                    ? "bg-cyan-950/20 border-cyan-500/40 text-cyan-400" 
                    : "bg-zinc-900/10 border-zinc-800/80 hover:border-zinc-700 text-zinc-400 hover:text-slate-200"
                )}
              >
                <BookOpen className="h-4 w-4 text-zinc-500" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-semibold leading-tight truncate">{rb.title}</h3>
                  <span className="text-[8px] text-zinc-500 block truncate mt-1">{rb.service}</span>
                </div>
              </button>
            )}
          )}
        </aside>

        {/* Right Side: Active Runbook detailed viewer */}
        <section className="flex-1 border border-border/40 bg-black/40 rounded-lg p-6 overflow-y-auto font-mono text-xs text-zinc-300 space-y-6">
          <header className="border-b border-zinc-900 pb-4">
            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest block">{activeRunbook.service} SOP</span>
            <h2 className="text-sm font-bold text-slate-100 mt-1 uppercase">{activeRunbook.title}</h2>
          </header>

          {/* Symptoms */}
          <div className="space-y-2">
            <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-400" /> Symptoms
            </h3>
            <ul className="list-disc list-inside pl-4 space-y-1 text-zinc-300 font-sans">
              {activeRunbook.symptoms.map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          </div>

          {/* Diagnosis Command block */}
          <div className="space-y-2">
            <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
              <Terminal className="h-4 w-4 text-zinc-500" /> Diagnosis Verification
            </h3>
            <div className="bg-black/60 rounded p-4 border border-zinc-900/60 leading-relaxed text-[11px] select-all">
              <pre className="text-cyan-400/90">{activeRunbook.diagnosis}</pre>
            </div>
          </div>

          {/* Recovery Script Command block */}
          <div className="space-y-2">
            <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
              <Code className="h-4 w-4 text-zinc-500" /> Recovery Commands
            </h3>
            <div className="bg-black/60 rounded p-4 border border-zinc-900/60 leading-relaxed text-[11px] select-all">
              <pre className="text-emerald-400/90">{activeRunbook.recovery}</pre>
            </div>
          </div>

          {/* Rollback Script Command block */}
          <div className="space-y-2">
            <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
              <ArrowRight className="h-4 w-4 text-zinc-500" /> Rollback Plan
            </h3>
            <div className="bg-black/60 rounded p-4 border border-zinc-900/60 leading-relaxed text-[11px] select-all">
              <pre className="text-amber-400/90">{activeRunbook.rollback}</pre>
            </div>
          </div>

          {/* Verification & Escalation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-900/60">
            <div className="space-y-2">
              <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 block">Verification check</span>
              <code className="text-slate-200 select-all block bg-black/40 border border-zinc-900 rounded p-2">{activeRunbook.verification}</code>
            </div>
            <div className="space-y-2">
              <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 block flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5 text-rose-500" /> Escalation Hierarchy
              </span>
              <p className="text-zinc-400 leading-normal font-sans text-xs">{activeRunbook.escalation}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
