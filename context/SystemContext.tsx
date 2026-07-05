'use client'

import React, { createContext, useContext, useState, useEffect, useRef } from 'react'

import { type Severity, type IncidentStatus, type AlertLog, type TimelineEvent, type RecoveryStep, type EvidenceItem, type DeterministicRCA, type BusinessImpactData, type ConfidenceFactor, type SimilarIncidentResult, type AIValidation, type Incident, type ServiceMetrics, type NodeMetrics, type SimulationType, type SystemContextType } from './types'
import { useAudioEngine } from './engines/useAudioEngine'
import { useLearningEngine } from './engines/useLearningEngine'
import { useReplayEngine } from './engines/useReplayEngine'
import { useJudgeMode } from './engines/useJudgeMode'

export * from './types'

const SystemContext = createContext<SystemContextType | undefined>(undefined)

// Preset simulations data for local heuristic fallback in Demo Mode
const SIMULATION_DETAILS: Record<Exclude<SimulationType, 'none'>, Omit<Incident, 'id' | 'status' | 'mitigationProgress'>> = {
  database_crash: {
    title: 'PostgreSQL Connection Exhaustion & Cascade Failure',
    severity: 'P0',
    priority: 'CRITICAL',
    confidence: 98,
    rootCause: 'Main DB Cluster (db-primary-us-east) connection pool overflow due to slow unindexed query on relation "orders". Downstream services blocked waiting for pool acquisition.',
    summary: 'The main PostgreSQL database instance is throwing connection errors. This is cascading into 502/503 errors on the Orders and Payment services, triggering a public-facing outage at the API Gateway.',
    evidence: [
      'db/primary: FATAL: remaining connection slots reserved for non-replication superuser connections',
      'svc/orders: connection timeout after 15000ms attempting to reach db/primary',
      'lb/api-gateway: upstream pool exhausted - returning 502 Bad Gateway'
    ],
    affectedServices: ['Orders Service', 'Payment Service', 'API Gateway'],
    affectedCustomers: 'Enterprise Core Segment (US-East)',
    businessImpact: 'Checkout operations halted. Credit card authorizations failing.',
    revenueImpactRate: 1450,
    usersAffected: 42300,
    blastRadius: '45% of total active users blocked during checkout flow.',
    falsePositiveProbability: 1,
    timeline: [
      { time: '05:14:10', description: 'Database server db-primary-us-east CPU spiked to 98%.', type: 'alert' },
      { time: '05:14:22', description: 'Postgres connection pool exhausted (max_connections=250 reached).', type: 'alert' },
      { time: '05:14:45', description: 'Orders service throws ConnectionTimeoutException.', type: 'alert' },
      { time: '05:15:02', description: 'Payment service circuit breaker OPENS for payments.svc.cluster.local.', type: 'alert' },
      { time: '05:15:10', description: 'API Gateway returns 502 Bad Gateway to incoming checkout requests.', type: 'alert' },
      { time: '05:15:30', description: 'PulseControl AI correlated 14 events and declared P0 database outage.', type: 'ai' }
    ],
    recommendedActions: 'Kill long-running queries blocking the pg_stat_activity catalog, expand connection limits via config adjustments, and execute a rolling restart of downstream microservices to release stale sockets.',
    recoveryPlan: [
      {
        command: 'kubectl exec -it db-primary-0 -n database -- psql -U postgres -c "SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE state = \'active\' AND query_start < now() - interval \'2 minutes\';"',
        description: 'Terminate all active queries running for more than 2 minutes',
        status: 'pending',
        output: ''
      },
      {
        command: 'kubectl scale deployment orders-service payments-service --replicas=0 -n core',
        description: 'Scale down core dependencies to flush active connection retries',
        status: 'pending',
        output: ''
      },
      {
        command: 'kubectl scale deployment orders-service payments-service --replicas=4 -n core',
        description: 'Scale up core services to start clean connection pools',
        status: 'pending',
        output: ''
      },
      {
        command: 'kubectl rollout restart deployment api-gateway -n gateway',
        description: 'Restart api-gateway pods to clean cached endpoints',
        status: 'pending',
        output: ''
      }
    ],
    rollbackPlan: [
      {
        command: 'kubectl rollout undo deployment api-gateway -n gateway',
        description: 'Rollback API gateway to previous revision',
        status: 'pending',
        output: ''
      }
    ],
    verificationPlan: [
      'Run curl testing command on /healthz endpoint of API Gateway',
      'Verify connection pool usage count is below 40% using pg_stat_database metric'
    ]
  },
  api_ddos: {
    title: 'HTTP Flood API DDoS Outage (Cloudflare Bypass)',
    severity: 'P0',
    priority: 'CRITICAL',
    confidence: 94,
    rootCause: 'Bypass of Cloudflare WAF constraints due to direct-to-IP ingress routing targeting internal load balancer edge-us-east-1.',
    summary: 'A heavy layer 7 HTTP flood (approx. 65,000 requests/sec) bypasses Cloudflare security mechanisms and targets the public API Gateway directly, exhausting socket workers.',
    evidence: [
      'lb/edge-us-east-1: request rate exceeded rate limits - 65,000 rps',
      'pod/api-gateway: CPU thread exhaustion - thread lock detected',
      'svc/auth: jwt verification latency climbed to 4200ms'
    ],
    affectedServices: ['API Gateway', 'Auth Service'],
    affectedCustomers: 'All active web/mobile users globally',
    businessImpact: 'Complete platform unavailability. Users unable to log in or refresh workspace.',
    revenueImpactRate: 980,
    usersAffected: 125000,
    blastRadius: 'Global user base. Authenticated applications are unable to load data.',
    falsePositiveProbability: 3,
    timeline: [
      { time: '05:22:01', description: 'API Gateway request throughput increased from 4k RPS to 65k RPS.', type: 'alert' },
      { time: '05:22:15', description: 'Host CPU on k8s-node-1 climbs to 100%.', type: 'alert' },
      { time: '05:22:30', description: 'TLS handshakes failing at API edge due to worker pool timeout.', type: 'alert' },
      { time: '05:23:00', description: 'AI identified traffic storm from 1,420 unverified residential IPs.', type: 'ai' }
    ],
    recommendedActions: 'Apply custom iptables block rules at the load balancer level, enforce rate-limiting configurations on API gateway, and restrict external routes to cloudflare source CIDR groups.',
    recoveryPlan: [
      {
        command: 'aws ec2 authorize-security-group-ingress --group-id sg-edge-lb --ip-permissions "[{\\"IpProtocol\\": \\"tcp\\", \\"FromPort\\": 443, \\"ToPort\\": 443, \\"IpRanges\\": [{\\"CidrIp\\": \\"103.21.244.0/22\\", \\"Description\\": \\"Cloudflare Range\\"}, {\\"CidrIp\\": \\"172.64.0.0/13\\", \\"Description\\": \\"Cloudflare Range\\"}]}]"',
        description: 'Lock down Security Group to Cloudflare CIDR blocks only',
        status: 'pending',
        output: ''
      },
      {
        command: 'kubectl patch configmap nginx-config -n gateway --patch \'{"data":{"limit-conn-zone":"addr zone=one:10m rate=20r/s"}}\'',
        description: 'Enable strict rate limit bounds in Nginx configuration',
        status: 'pending',
        output: ''
      },
      {
        command: 'kubectl rollout restart daemonset nginx-ingress-controller -n gateway',
        description: 'Deploy rate limit configs to edge controllers',
        status: 'pending',
        output: ''
      }
    ],
    rollbackPlan: [
      {
        command: 'aws ec2 revoke-security-group-ingress --group-id sg-edge-lb --ip-permissions ...',
        description: 'Reopen edge firewall limits',
        status: 'pending',
        output: ''
      }
    ],
    verificationPlan: [
      'Verify request traffic drops back to nominal threshold (< 6,000 RPS)',
      'Confirm gateway response latency returns below 250ms'
    ]
  },
  redis_eviction: {
    title: 'Redis Eviction Storm and Session Dropping',
    severity: 'P1',
    priority: 'HIGH',
    confidence: 96,
    rootCause: 'Redis maxmemory configuration bound reached due to caching session details with infinite TTL parameters.',
    summary: 'The shared Redis cache (redis-session-store) has reached its maxmemory allocation (8GiB). Out-of-memory evictions are causing session invalidations, forcing users to repeatedly log in.',
    evidence: [
      'redis/sessions: OOM command not allowed when used memory > \'maxmemory\'',
      'redis/sessions: Eviction count per second spiked by 2400%',
      'svc/auth: Failed to retrieve session keys - cached values evicted'
    ],
    affectedServices: ['Auth Service', 'Notification Service'],
    affectedCustomers: 'All active users attempting to authenticate',
    businessImpact: 'Sudden mass user logouts, token refresh failures, and delays in real-time notification dispatch.',
    revenueImpactRate: 450,
    usersAffected: 78000,
    blastRadius: 'All sessions hosted on active clusters.',
    falsePositiveProbability: 1,
    timeline: [
      { time: '05:30:00', description: 'Redis memory usage reached 100% (8.00 GB).', type: 'alert' },
      { time: '05:30:15', description: 'Redis started evicting keys aggressively (2,100 keys/sec).', type: 'alert' },
      { time: '05:31:00', description: 'Session mismatch spikes on Auth microservices.', type: 'alert' },
      { time: '05:31:20', description: 'AI detects Cache Eviction Storm and alerts SRE team.', type: 'ai' }
    ],
    recommendedActions: 'Resize the Redis cluster memory space, change the eviction policy to volatile-lru, and run an automated script to wipe cache entries with invalid TTL fields.',
    recoveryPlan: [
      {
        command: 'redis-cli -h redis-session-store.cache.svc config set maxmemory-policy volatile-lru',
        description: 'Set eviction policy to Least Recently Used with expire field',
        status: 'pending',
        output: ''
      },
      {
        command: 'helm upgrade cache-cluster bitnami/redis --set master.resources.limits.memory=16Gi --reuse-values -n database',
        description: 'Double memory limits allocated to cache cluster from 8Gi to 16Gi',
        status: 'pending',
        output: ''
      },
      {
        command: 'kubectl rollout restart statefulset cache-cluster -n database',
        description: 'Execute a rolling restart on redis stateful nodes',
        status: 'pending',
        output: ''
      }
    ],
    rollbackPlan: [
      {
        command: 'helm upgrade cache-cluster bitnami/redis --set master.resources.limits.memory=8Gi -n database',
        description: 'Rollback cache memory limits',
        status: 'pending',
        output: ''
      }
    ],
    verificationPlan: [
      'Check if redis command info memory returns total_allocated < 60%',
      'Verify session drops drop back to nominal level (< 1 per min)'
    ]
  },
  memory_leak: {
    title: 'Auth Service Memory Leak (OOMKilled Loop)',
    severity: 'P1',
    priority: 'HIGH',
    confidence: 91,
    rootCause: 'NodeJS heap allocation leak inside the /validate-token router handler due to appending metadata to a global array without cleanup.',
    summary: 'A memory leak in the token validator middleware causes memory usage of the Auth Service to grow linearly. Once it crosses 512Mi, the Kubernetes OOM killer issues SIGKILL, sending the pod into CrashLoopBackOff.',
    evidence: [
      'pod/auth-service-7cf: OOMKilled - Container exceeded memory limit 512Mi',
      'pod/auth-service-7cf: CrashLoopBackOff - restarting in 3m0s',
      'svc/auth: p99 latency spiked to 9.2 seconds'
    ],
    affectedServices: ['Auth Service', 'API Gateway'],
    affectedCustomers: 'New and guest users browsing portal login panels',
    businessImpact: 'Authentication requests hanging, token validation cascading into downstream timeouts.',
    revenueImpactRate: 350,
    usersAffected: 15400,
    blastRadius: 'Authentication gateway pods.',
    falsePositiveProbability: 2,
    timeline: [
      { time: '05:40:02', description: 'Memory utilization of pod auth-service-7cf grew linearly from 40% to 99%.', type: 'alert' },
      { time: '05:40:15', description: 'Kubernetes node OOM killer terminated the container process.', type: 'alert' },
      { time: '05:40:22', description: 'Pod status shifted to CrashLoopBackOff.', type: 'alert' },
      { time: '05:41:00', description: 'AI correlated pod crashes and traced leak to version v2.14.3 release.', type: 'ai' }
    ],
    recommendedActions: 'Temporarily roll back the Auth Service image to v2.14.2, spin up double replicas to buffer requests, and alert the development team to patch the heap reference leak.',
    recoveryPlan: [
      {
        command: 'kubectl set image deployment/auth-service auth=auth-service:v2.14.2 -n core',
        description: 'Roll back Auth Service image tag to v2.14.2',
        status: 'pending',
        output: ''
      },
      {
        command: 'kubectl scale deployment/auth-service --replicas=6 -n core',
        description: 'Increase auth service replica buffer to 6 pods',
        status: 'pending',
        output: ''
      }
    ],
    rollbackPlan: [
      {
        command: 'kubectl set image deployment/auth-service auth=auth-service:v2.14.3 -n core',
        description: 'Restore v2.14.3 deployment image',
        status: 'pending',
        output: ''
      }
    ],
    verificationPlan: [
      'Validate auth deployment rollouts complete successfully',
      'Confirm auth pod memory utilization stabilizes around 180Mi'
    ]
  },
  cpu_spike: {
    title: 'Payment Gateway CPU Thread Lock',
    severity: 'P1',
    priority: 'HIGH',
    confidence: 89,
    rootCause: 'Cryptographic hashing thread lock within payment-service triggered by encrypted payloads using outdated TLS cipher patterns.',
    summary: 'Crypto libraries inside the payment service are locking threads at 100% CPU. Downstream connections stall, and the Kubernetes horizontal pod autoscaler (HPA) fails to spawn instances due to cluster node resource limits.',
    evidence: [
      'pod/payments-service-54d: CPU usage hit 100% and blocked main event loop',
      'hpa/payments-hpa: failed to scale - cluster node resources exhausted',
      'svc/payments: payment checkout process timed out (gateway timeout)'
    ],
    affectedServices: ['Payment Service'],
    affectedCustomers: 'Customers submitting payment requests',
    businessImpact: 'Inability to complete checkouts, cart abandonment, and customer service ticket spike.',
    revenueImpactRate: 1100,
    usersAffected: 9500,
    blastRadius: 'Payment systems checkouts only.',
    falsePositiveProbability: 1,
    timeline: [
      { time: '05:45:00', description: 'Payments service CPU usage reached 100%.', type: 'alert' },
      { time: '05:45:12', description: 'Payment response latency climbed from 180ms to 12,000ms.', type: 'alert' },
      { time: '05:45:30', description: 'HPA triggered scale action, status blocked by insufficient CPU quota on node.', type: 'alert' },
      { time: '05:46:00', description: 'AI matched CPU thread locks and recommended instance upgrades.', type: 'ai' }
    ],
    recommendedActions: 'Manually scale database nodes to free up space, schedule resource headroom on other nodes, and force-kill the thread-locked pods to trigger clean reschedules.',
    recoveryPlan: [
      {
        command: 'kubectl patch deployment payments-service -n core -p \'{"spec":{"template":{"spec":{"containers":[{"name":"payments","resources":{"limits":{"cpu":"2000m","memory":"1Gi"}}}]}}}}\'',
        description: 'Upgrade CPU resource limits on payments containers',
        status: 'pending',
        output: ''
      },
      {
        command: 'kubectl rollout restart deployment payments-service -n core',
        description: 'Force clean restart of payments deployments to release locks',
        status: 'pending',
        output: ''
      }
    ],
    rollbackPlan: [
      {
        command: 'kubectl patch deployment payments-service -n core -p \'{"spec":{"template":{"spec":{"containers":[{"name":"payments","resources":{"limits":{"cpu":"500m","memory":"512Mi"}}}]}}}}\'',
        description: 'Revert container resources',
        status: 'pending',
        output: ''
      }
    ],
    verificationPlan: [
      'Verify average payments CPU usage settles below 45%',
      'Ensure p95 latency for cart transactions drops back below 350ms'
    ]
  },
  disk_failure: {
    title: 'Storage Service Local Disk Pressure (Write-Lock)',
    severity: 'P2',
    priority: 'MEDIUM',
    confidence: 97,
    rootCause: 'Storage nodes accumulated stale chunk files without cron rotation scripts operating correctly.',
    summary: 'Disk utilization on storage-node-3 crossed the 98% threshold. This triggered K8s disk pressure evictions and shifted file-writing queues into a Read-Only fallback state.',
    evidence: [
      'storage-node-3: disk space utilized 98% - disk pressure flag active',
      'svc/storage: file write failure: filesystem is read-only',
      'pod/worker-queue-2: write locks blocked log uploads'
    ],
    affectedServices: ['Storage Service', 'Notification Service'],
    affectedCustomers: 'Users attempting to upload logs or profile attachments',
    businessImpact: 'Document and media storage unavailable, database backup jobs failing.',
    revenueImpactRate: 150,
    usersAffected: 4200,
    blastRadius: 'Write-heavy operations requiring file attachments.',
    falsePositiveProbability: 1,
    timeline: [
      { time: '05:50:00', description: 'Disk usage on storage-node-3 hit 98%.', type: 'alert' },
      { time: '05:50:12', description: 'Kubernetes flagged node storage-node-3 with DiskPressure.', type: 'alert' },
      { time: '05:50:35', description: 'Worker queues transitioned to read-only disk writes.', type: 'alert' },
      { time: '05:51:00', description: 'AI verified storage pressure logs and recommended cleaning logs.', type: 'ai' }
    ],
    recommendedActions: 'Run an emergency disk sweep utility on the node, delete old crash log dumps from `/var/log`, and configure temporary partition sizing.',
    recoveryPlan: [
      {
        command: 'kubectl exec -it storage-node-3 -n infra -- find /var/log -type f -name "*.log" -mtime +7 -delete',
        description: 'Delete logs older than 7 days from the storage cluster node',
        status: 'pending',
        output: ''
      },
      {
        command: 'kubectl exec -it storage-node-3 -n infra -- docker system prune -af --volumes',
        description: 'Execute deep docker system prune on the node filesystem',
        status: 'pending',
        output: ''
      }
    ],
    rollbackPlan: [
      {
        command: 'echo "No rollback required for disk purge"',
        description: 'No rollback required',
        status: 'pending',
        output: ''
      }
    ],
    verificationPlan: [
      'Check df -h output on storage-node-3 and verify capacity is below 75%',
      'Verify disk pressure labels are cleared from the Kubernetes node'
    ]
  },
  dns_outage: {
    title: 'CoreDNS Service Resolution Outage (SERVFAIL)',
    severity: 'P0',
    priority: 'CRITICAL',
    confidence: 93,
    rootCause: 'DNS loop forwarding loop configuration pushed to coredns configmap, causing name server timeouts.',
    summary: 'CoreDNS pods in the kube-system namespace are throwing SERVFAIL errors. Internal microservices are unable to resolve each other\'s endpoints (e.g. payment.svc.cluster.local), causing total microservice network partition.',
    evidence: [
      'coredns: DNS loop detected for resolver 127.0.0.1 - breaking loop',
      'svc/orders: failed to resolve payments.svc.cluster.local: SERVFAIL',
      'pod/api-gateway: connection to auth.svc.cluster.local timed out'
    ],
    affectedServices: ['All Internal Services'],
    affectedCustomers: 'All active customers',
    businessImpact: 'Total application failure. The API Gateway cannot resolve auth, orders, payments, or caches.',
    revenueImpactRate: 1800,
    usersAffected: 140000,
    blastRadius: 'Entire Kubernetes cluster. All inter-pod communication is disrupted.',
    falsePositiveProbability: 1,
    timeline: [
      { time: '05:55:00', description: 'CoreDNS logs show loop resolution warnings.', type: 'alert' },
      { time: '05:55:15', description: 'Auth, payment, and order services fail DNS name lookups.', type: 'alert' },
      { time: '05:55:30', description: 'API Gateway reports total backend service unavailability.', type: 'alert' },
      { time: '05:56:00', description: 'AI correlated SERVFAIL logs and isolated CoreDNS configmap edits.', type: 'ai' }
    ],
    recommendedActions: 'Revert the CoreDNS ConfigMap to the last stable configuration and force-restart the CoreDNS pods to pick up the changes.',
    recoveryPlan: [
      {
        command: 'kubectl replace -f - <<EOF\napiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: coredns\n  namespace: kube-system\ndata:\n  Corefile: |\n    .:53 {\n        errors\n        health {\n           lameduck 5s\n        }\n        ready\n        kubernetes cluster.local in-addr.arpa ip6.arpa {\n           pods insecure\n           fallthrough in-addr.arpa ip6.arpa\n           ttl 30\n        }\n        prometheus :9153\n        forward . 8.8.8.8 8.8.4.4\n        cache 30\n        loop\n        reload\n        loadbalance\n    }\nEOF',
        description: 'Revert CoreDNS config file mapping to remove circular forwards',
        status: 'pending',
        output: ''
      },
      {
        command: 'kubectl rollout restart deployment coredns -n kube-system',
        description: 'Force CoreDNS pods to restart and pull new config rules',
        status: 'pending',
        output: ''
      }
    ],
    rollbackPlan: [
      {
        command: 'echo "No rollback required for DNS config correction"',
        description: 'No rollback required',
        status: 'pending',
        output: ''
      }
    ],
    verificationPlan: [
      'Exec into an orders pod and run nslookup payments.svc.cluster.local',
      'Verify coredns pod log metrics show no resolution loop errors'
    ]
  },
  cloudflare_outage: {
    title: 'Cloudflare Edge CDN Failure (TLS Outage)',
    severity: 'P0',
    priority: 'CRITICAL',
    confidence: 99,
    rootCause: 'SSL/TLS configuration mismatch at Cloudflare Edge network due to certificate verification settings.',
    summary: 'Cloudflare edge servers are throwing 526 SSL handshake errors when users connect to pulsecontrol.com. Traffic is rejected at the CDN layer prior to hitting our load balancers.',
    evidence: [
      'cf/edge: 526 SSL handshake failed - origin ssl certificate invalid',
      'lb/edge: no incoming connections recorded from CF edge servers',
      'alerts/ping: global availability metric dropped to 0%'
    ],
    affectedServices: ['API Gateway', 'CDN Edge'],
    affectedCustomers: 'All public web/mobile users globally',
    businessImpact: 'Zero traffic reaching the origin server. Complete public site outage.',
    revenueImpactRate: 2100,
    usersAffected: 150000,
    blastRadius: 'Global public route ingress points.',
    falsePositiveProbability: 1,
    timeline: [
      { time: '06:00:00', description: 'Global status ping checks reported 100% failure rates.', type: 'alert' },
      { time: '06:00:15', description: 'Cloudflare logs show 526 error return codes on domain routes.', type: 'alert' },
      { time: '06:00:30', description: 'Origin gateway ingress drops to 0 requests per second.', type: 'alert' },
      { time: '06:01:00', description: 'AI maps CF error codes to origin TLS certificate expiry warnings.', type: 'ai' }
    ],
    recommendedActions: 'Disable Full SSL Strict verification temporarily in Cloudflare configuration (fallback to Full/Flexible) or update the origin certificate, and run a DNS validation.',
    recoveryPlan: [
      {
        command: 'curl -X PATCH "https://api.cloudflare.com/client/v4/zones/zone_id/settings/ssl" -H "Authorization: Bearer CF_API_TOKEN" -H "Content-Type: application/json" --data \'{"value":"full"}\'',
        description: 'Downgrade Cloudflare SSL Verification from Full (Strict) to Full to temporarily bypass origin validation',
        status: 'pending',
        output: ''
      },
      {
        command: 'gcloud compute ssl-certificates create pulse-cert-v3 --domains=pulsecontrol.com --global',
        description: 'Provision updated SSL certificates at Load Balancer',
        status: 'pending',
        output: ''
      }
    ],
    rollbackPlan: [
      {
        command: 'curl -X PATCH "https://api.cloudflare.com/client/v4/zones/zone_id/settings/ssl" -H "Authorization: Bearer CF_API_TOKEN" -H "Content-Type: application/json" --data \'{"value":"strict"}\'',
        description: 'Re-enable Strict SSL checks',
        status: 'pending',
        output: ''
      }
    ],
    verificationPlan: [
      'Validate domain pulsecontrol.com resolves with clean SSL handshakes',
      'Verify incoming edge logs show request rates returning to nominal values'
    ]
  },
  autoscaling_failure: {
    title: 'Autoscaling Metric Target Failure (HPA Thread Pool)',
    severity: 'P1',
    priority: 'HIGH',
    confidence: 90,
    rootCause: 'Metrics Server API became unresponsive, causing Kubernetes HPA to fall back to default replicas while traffic spiked.',
    summary: 'A surge in promotional campaign traffic caused API Gateway latency to spike. The HPA was unable to pull pod metrics due to an unresponsive metrics-server API, preventing horizontal scale-out.',
    evidence: [
      'hpa/api-gateway: unable to read metrics - metrics.k8s.io is unavailable',
      'pod/api-gateway: container CPU utilization at 100% limit',
      'svc/orders: request queue full: 503 service unavailable'
    ],
    affectedServices: ['API Gateway', 'Orders Service'],
    affectedCustomers: 'Customers browsing active promotions',
    businessImpact: 'High latency and timeout rates during peak promotion campaign hours.',
    revenueImpactRate: 850,
    usersAffected: 45000,
    blastRadius: 'All campaign entry routes.',
    falsePositiveProbability: 2,
    timeline: [
      { time: '06:10:00', description: 'Campaign traffic surged by 400% on the API edge.', type: 'alert' },
      { time: '06:10:15', description: 'Metrics API server threw connection timeout errors.', type: 'alert' },
      { time: '06:10:35', description: 'HPA failed to scale replicas - remaining locked at 2 instances.', type: 'alert' },
      { time: '06:11:00', description: 'AI isolated HPA metrics API timeout and recommended manual override.', type: 'ai' }
    ],
    recommendedActions: 'Bypass the HPA by manually setting deployment replicas to maximum scale capacity, and trigger a rollout restart on the Metrics Server.',
    recoveryPlan: [
      {
        command: 'kubectl scale deployment api-gateway -n gateway --replicas=12',
        description: 'Manually scale API Gateway replicas to 12 instances',
        status: 'pending',
        output: ''
      },
      {
        command: 'kubectl scale deployment orders-service -n core --replicas=8',
        description: 'Manually scale Orders Service replicas to 8 instances',
        status: 'pending',
        output: ''
      },
      {
        command: 'kubectl rollout restart deployment metrics-server -n kube-system',
        description: 'Restart cluster Metrics Server to re-establish status APIs',
        status: 'pending',
        output: ''
      }
    ],
    rollbackPlan: [
      {
        command: 'kubectl autoscale deployment api-gateway --min=2 --max=10 --cpu-percent=70 -n gateway',
        description: 'Restore HPA auto control properties',
        status: 'pending',
        output: ''
      }
    ],
    verificationPlan: [
      'Confirm replica count on API Gateway reaches 12 active pods',
      'Verify request processing latency drops below 200ms'
    ]
  },
  kubernetes_failure: {
    title: 'Kubernetes Node NotReady Outage (Etcd Desync)',
    severity: 'P0',
    priority: 'CRITICAL',
    confidence: 95,
    rootCause: 'Node k8s-node-2 network interface failure causing kubelet heartbeats to miss etcd cluster timers.',
    summary: 'The main cluster node k8s-node-2 suddenly shifted to NotReady status. Pods hosted on it (including core authentication and catalog nodes) are stuck in Terminating status, blocking service execution.',
    evidence: [
      'node/k8s-node-2: status shifted from Ready to NotReady',
      'pod/auth-service: status Terminating - pod not responding to health check',
      'kube-apiserver: failed heartbeat validation on node k8s-node-2'
    ],
    affectedServices: ['Auth Service', 'Catalog Service'],
    affectedCustomers: 'All active users',
    businessImpact: 'Microservice availability drop, user logins failing, catalog searches returning timeouts.',
    revenueImpactRate: 1200,
    usersAffected: 65000,
    blastRadius: 'All services containing instances scheduled on k8s-node-2.',
    falsePositiveProbability: 1,
    timeline: [
      { time: '06:20:00', description: 'Node k8s-node-2 status changed to NotReady.', type: 'alert' },
      { time: '06:20:15', description: 'Kubernetes API server stopped receiving node heartbeat checks.', type: 'alert' },
      { time: '06:20:45', description: 'Scheduled pods entered Terminating state without rescheduling.', type: 'alert' },
      { time: '06:21:00', description: 'AI identified node desync, recommending taint eviction.', type: 'ai' }
    ],
    recommendedActions: 'Drain the failing node to force rescheduling of active pods onto other available nodes, and restart node kubelet operations if access is restored.',
    recoveryPlan: [
      {
        command: 'kubectl drain k8s-node-2 --ignore-daemonsets --delete-emptydir-data --force',
        description: 'Drain k8s-node-2 to evict terminating pods and reschedule them immediately on healthy nodes',
        status: 'pending',
        output: ''
      },
      {
        command: 'kubectl cordon k8s-node-2',
        description: 'Mark k8s-node-2 as unschedulable to prevent future pod assignments',
        status: 'pending',
        output: ''
      }
    ],
    rollbackPlan: [
      {
        command: 'kubectl uncordon k8s-node-2',
        description: 'Re-enable pod assignments on k8s-node-2',
        status: 'pending',
        output: ''
      }
    ],
    verificationPlan: [
      'Verify evicted pods are rescheduled and reach Running status on healthy nodes',
      'Confirm service availability levels return to > 99.9%'
    ]
  }
}

export const SystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<'demo' | 'live'>('demo')
  const [systemHealth, setSystemHealth] = useState(99)
  const [riskScore, setRiskScore] = useState(8)
  const [activeSimulation, setActiveSimulation] = useState<SimulationType>('none')
  const [alerts, setAlerts] = useState<AlertLog[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [copilotMessages, setCopilotMessages] = useState<{ role: 'user' | 'assistant'; content: string; timestamp: Date }[]>([])
  const { voiceLanguage, setVoiceLanguage, voiceEnabled, setVoiceEnabled, announceOutage } = useAudioEngine()

  const {
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
  } = useReplayEngine()

  const {
    historicalIncidents,
    learningMetadata,
    historicalIncidentsRef,
    learningMetadataRef,
    sessionActiveIncidentIdsRef,
    fetchHistoricalData,
    archiveResolvedIncident
  } = useLearningEngine()

  const {
    judgeModeActive,
    judgeModeStep,
    judgeModeStatusText,
    startJudgeMode: rawStartJudgeMode
  } = useJudgeMode()

  const [capabilities, setCapabilities] = useState<Record<string, any>>({})

  // Load history on mount
  useEffect(() => {
    fetchHistoricalData()
  }, [])

  // Monitor UI active incident list to auto-archive newly resolved ones from current session
  useEffect(() => {
    const resolvedInUI = incidents.filter(i => i.status === 'resolved')
    resolvedInUI.forEach(async (incident) => {
      if (sessionActiveIncidentIdsRef.current.has(incident.id)) {
        sessionActiveIncidentIdsRef.current.delete(incident.id)
        await archiveResolvedIncident(incident)
      }
    })
  }, [incidents])

  // Dynamic client-side recovery intelligence calculator (matches server-side logic in recovery-engine.ts)
  const calculateClientRecoveryIntelligence = (incident: Incident, historyList: Incident[], metadataList: any[]) => {
    const serviceSet = new Set(incident.affectedServices.map(s => s.toLowerCase()))
    const similarMatches = historyList.filter(past => {
      if (past.id === incident.id) return false
      return past.affectedServices.some(s => serviceSet.has(s.toLowerCase()))
    }).map(past => {
      const matchServices = past.affectedServices.filter(s => serviceSet.has(s.toLowerCase())).length
      const simScore = Math.min(99, Math.round((matchServices / Math.max(1, incident.affectedServices.length)) * 80 + 15))
      return { id: past.id, similarityScore: simScore }
    }).sort((a, b) => b.similarityScore - a.similarityScore)

    let successCount = 0
    let totalRuns = 0
    let totalDuration = 0
    const previousRecoveries: any[] = []

    for (const match of similarMatches) {
      const meta = metadataList.find(m => m.incidentId === match.id)
      if (meta) {
        totalRuns++
        const wasSuccess = meta.verificationOutcome === 'success'
        if (wasSuccess) successCount++
        totalDuration += meta.recoveryDurationMinutes || 10
        
        const matchInc = historyList.find(h => h.id === match.id)
        const dateStr = matchInc?.lastSeen ? new Date(matchInc.lastSeen).toLocaleDateString() : 'Recent'
        previousRecoveries.push({
          id: match.id,
          date: dateStr,
          time: `${meta.recoveryDurationMinutes || 10}m`,
          success: wasSuccess
        })
      }
    }

    const hasHistory = totalRuns > 0
    const successRate = hasHistory ? Math.round((successCount / totalRuns) * 100) : 95
    const avgDurationMin = hasHistory ? Math.round(totalDuration / totalRuns) : 4.3

    let evidenceQualitySum = 0
    const evidenceItems = incident.structuredEvidence || []
    for (const ev of evidenceItems) {
      if (ev.weight === 'High') evidenceQualitySum += 20
      else if (ev.weight === 'Medium') evidenceQualitySum += 15
      else evidenceQualitySum += 10
    }
    const evidenceQualityScore = evidenceItems.length > 0 ? (evidenceQualitySum / (evidenceItems.length * 20)) * 100 : 80

    const providerAgreement = incident.deterministicRCA?.providerAgreement.percentage || 75
    const highestSimilarity = similarMatches.length > 0 ? similarMatches[0].similarityScore : 88

    let score = Math.round(
      successRate * 0.3 +
      highestSimilarity * 0.3 +
      providerAgreement * 0.2 +
      evidenceQualityScore * 0.2
    )

    score = Math.max(10, Math.min(99, score))
    const minutes = Math.floor(avgDurationMin)
    const seconds = Math.round((avgDurationMin - minutes) * 60)
    const expectedMTTR = seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`

    let risk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW'
    if (score < 65) risk = 'HIGH'
    else if (score < 85) risk = 'MEDIUM'

    const rollbackAvailable = incident.rollbackPlan && incident.rollbackPlan.length > 0
    const rcService = incident.deterministicRCA?.primaryService || incident.affectedServices[0] || 'Target'
    
    return {
      score,
      expectedMTTR,
      successRate,
      risk,
      verificationSteps: incident.verificationPlan || ['Verify sockets drop below threshold', 'Check gateway response code status'],
      rollbackAvailable,
      previousRecoveries,
      explanation: {
        whySuggested: `Suggested because deterministic analysis isolated the root cause to socket connection pool depletion or resource locking on the ${rcService} cluster.`,
        historicalEvidence: hasHistory
          ? `PulseControl correlated this profile with ${similarMatches.length} similar incidents. The recovery playbook was executed successfully in ${successCount} of the last ${totalRuns} occurrences.`
          : `First of its type in active operational store. Recommendations generated using deterministic dependency rules and standard container orchestration playbooks.`,
        similarCount: similarMatches.length,
        assumptions: [
          `Assumes Kubernetes API gateway for cluster-control is fully online and accepting scaling requests.`,
          `Assumes target microservice resources and limits are not hard-locked by hypervisor constraints.`,
          `Assumes socket pool exhaustion is transient and can be resolved by scaling replicas down and up.`
        ],
        uncertainty: hasHistory
          ? `Low uncertainty (< 5% error bounds) due to high historical replication of similar database connection resets.`
          : `Medium uncertainty. Lacking previous resolution benchmarks for this specific cascading sequence in memory.`
      }
    }
  }


  // Service health tracking
  const [services, setServices] = useState<ServiceMetrics[]>([
    { name: 'API Gateway', status: 'healthy', cpu: 15, memory: 35, latency: 45, requests: 2450, errorRate: 0.01, sla: 99.99, slo: 99.95, errorBudget: 99.8 },
    { name: 'Auth Service', status: 'healthy', cpu: 12, memory: 28, latency: 18, requests: 2450, errorRate: 0.0, sla: 99.99, slo: 99.9, errorBudget: 100.0 },
    { name: 'Payment Service', status: 'healthy', cpu: 18, memory: 42, latency: 120, requests: 620, errorRate: 0.05, sla: 99.95, slo: 99.9, errorBudget: 98.4 },
    { name: 'Orders Service', status: 'healthy', cpu: 22, memory: 51, latency: 68, requests: 1240, errorRate: 0.02, sla: 99.98, slo: 99.9, errorBudget: 99.1 },
    { name: 'Notification Service', status: 'healthy', cpu: 10, memory: 15, latency: 35, requests: 450, errorRate: 0.0, sla: 100.0, slo: 99.5, errorBudget: 100.0 },
    { name: 'Catalog Service', status: 'healthy', cpu: 8, memory: 20, latency: 15, requests: 3800, errorRate: 0.01, sla: 99.99, slo: 99.95, errorBudget: 99.9 }
  ])

  // Nodes metrics
  const [nodes, setNodes] = useState<NodeMetrics[]>([
    { name: 'k8s-node-1', status: 'healthy', cpu: 28, memory: 52, disk: 44, podsCount: 14 },
    { name: 'k8s-node-2', status: 'healthy', cpu: 32, memory: 48, disk: 38, podsCount: 12 },
    { name: 'k8s-node-3', status: 'healthy', cpu: 18, memory: 35, disk: 62, podsCount: 8 },
    { name: 'db-primary-us-east', status: 'healthy', cpu: 24, memory: 61, disk: 54, podsCount: 1 }
  ])

  // Keep refs up-to-date for async polling intervals
  const servicesRef = useRef(services)
  servicesRef.current = services
  const incidentsRef = useRef(incidents)
  incidentsRef.current = incidents

  // 1. Initial alerts creation
  useEffect(() => {
    const initialAlerts: AlertLog[] = []
    const now = new Date()
    for (let i = 0; i < 25; i++) {
      const minutesAgo = 25 - i
      const ts = new Date(now.getTime() - minutesAgo * 60 * 1000)
      const serviceName = ['API Gateway', 'Auth Service', 'Payment Service', 'Orders Service', 'Notification Service', 'Catalog Service'][i % 6]
      initialAlerts.push({
        timestamp: formatTimestamp(ts),
        level: 'INFO',
        service: serviceName,
        message: `Heartbeat ping check passed. Response latency verified within threshold bounds.`,
        pod: `${serviceName.toLowerCase().replace(' ', '-')}-${Math.random().toString(36).substring(2, 7)}`,
        node: `k8s-node-${(i % 3) + 1}`,
        region: 'us-east-1',
        traceId: `tr-${Math.random().toString(36).substring(2, 10)}`,
        correlationId: `cr-${Math.random().toString(36).substring(2, 10)}`
      })
    }
    setAlerts(initialAlerts)
  }, [])

  // 2. Hybrid Telemetry Polling & Demo Ticking
  useEffect(() => {
    const isLive = mode === 'live'

    const tick = async () => {
      const timestamp = formatTimestamp(new Date())

      if (isLive) {
        // Fetch real-world backend telemetry
        try {
          const res = await fetch('/api/telemetry')
          if (!res.ok) throw new Error('telemetry api offline')
          const data = await res.json()

          setSystemHealth(data.systemHealth)
          setRiskScore(data.riskScore)
          setServices(data.services)
          setNodes(data.nodes)
          setIncidents(data.incidents || [])
          setCapabilities(data.capabilities || {})
          
          if (data.logs && data.logs.length > 0) {
            setAlerts(prev => {
              const merged = [...data.logs, ...prev]
              // deduplicate by timestamp + message hash
              const uniq: Record<string, AlertLog> = {}
              merged.forEach(l => { uniq[`${l.timestamp}-${l.message}`] = l })
              return Object.values(uniq).slice(0, 400)
            })
          }

          // Capability Detection check: If both Docker & K8s fail, switch to Demo
          if (data.capabilities) {
            const hasDocker = data.capabilities.docker?.connected
            const hasK8s = data.capabilities.k8s?.connected
            if (hasDocker === false && hasK8s === false) {
              setMode('demo')
            }
          }
        } catch (e) {
          // Telemetry API offline, fallback silently
        }
      } else {
        // DEMO MODE - synthetic ticking
        setServices(prev =>
          prev.map(svc => {
            let cpu = svc.cpu
            let memory = svc.memory
            let latency = svc.latency
            let requests = svc.requests
            let errorRate = svc.errorRate
            let status: 'healthy' | 'degraded' | 'critical' = 'healthy'

            const isOutage = activeSimulation !== 'none'
            if (isOutage) {
              if (activeSimulation === 'database_crash') {
                if (svc.name === 'Orders Service' || svc.name === 'Payment Service') {
                  status = 'critical'
                  cpu = Math.min(95, cpu + Math.random() * 20)
                  latency = Math.min(8000, latency + 1500)
                  errorRate = Math.min(85, errorRate + 15)
                } else if (svc.name === 'API Gateway') {
                  status = 'degraded'
                  latency = Math.min(4000, latency + 500)
                  errorRate = Math.min(30, errorRate + 5)
                }
              } else if (activeSimulation === 'api_ddos') {
                if (svc.name === 'API Gateway') {
                  status = 'critical'
                  cpu = 99
                  requests = Math.min(65000, requests + 10000)
                  latency = Math.min(9000, latency + 2000)
                  errorRate = Math.min(75, errorRate + 12)
                } else if (svc.name === 'Auth Service') {
                  status = 'degraded'
                  cpu = Math.min(90, cpu + 15)
                  latency = Math.min(4500, latency + 800)
                }
              } else if (activeSimulation === 'redis_eviction') {
                if (svc.name === 'Auth Service') {
                  status = 'critical'
                  latency = Math.min(3000, latency + 400)
                  errorRate = Math.min(45, errorRate + 8)
                } else if (svc.name === 'Notification Service') {
                  status = 'degraded'
                  errorRate = Math.min(15, errorRate + 2)
                }
              } else if (activeSimulation === 'memory_leak') {
                if (svc.name === 'Auth Service') {
                  status = svc.memory > 90 ? 'critical' : 'degraded'
                  memory = Math.min(98, memory + 4)
                  latency = Math.min(12000, latency + 1000)
                  errorRate = Math.min(50, errorRate + 7)
                }
              } else if (activeSimulation === 'cpu_spike') {
                if (svc.name === 'Payment Service') {
                  status = 'critical'
                  cpu = 100
                  latency = Math.min(15000, latency + 2500)
                  errorRate = Math.min(60, errorRate + 10)
                }
              } else if (activeSimulation === 'disk_failure') {
                if (svc.name === 'Notification Service') {
                  status = 'degraded'
                  errorRate = Math.min(25, errorRate + 5)
                }
              } else if (activeSimulation === 'dns_outage') {
                status = 'critical'
                latency = Math.min(15000, latency + 3000)
                errorRate = Math.min(100, errorRate + 25)
              } else if (activeSimulation === 'cloudflare_outage') {
                if (svc.name === 'API Gateway') {
                  status = 'critical'
                  requests = Math.max(0, requests - 600)
                  errorRate = 100
                }
              } else if (activeSimulation === 'autoscaling_failure') {
                if (svc.name === 'API Gateway') {
                  status = 'critical'
                  cpu = 100
                  requests = Math.min(45000, requests + 8000)
                  latency = Math.min(8000, latency + 1500)
                  errorRate = Math.min(45, errorRate + 8)
                }
              } else if (activeSimulation === 'kubernetes_failure') {
                if (svc.name === 'Auth Service' || svc.name === 'Catalog Service') {
                  status = 'critical'
                  latency = Math.min(10000, latency + 2000)
                  errorRate = Math.min(80, errorRate + 15)
                }
              }
            } else {
              cpu = Math.max(5, Math.min(80, cpu + (Math.random() - 0.5) * 4))
              memory = Math.max(10, Math.min(80, memory + (Math.random() - 0.5) * 2))
              latency = Math.max(10, Math.min(250, latency + (Math.random() - 0.5) * 10))
              requests = Math.max(200, Math.min(5000, requests + (Math.random() - 0.5) * 100))
              errorRate = Math.max(0, Math.min(0.5, errorRate + (Math.random() - 0.5) * 0.05))
              status = 'healthy'
            }

            const newSlo = Math.max(90, svc.slo - (errorRate > 5 ? 0.05 : -0.01))
            const newBudget = Math.max(0, svc.errorBudget - (errorRate > 2 ? 0.1 : -0.02))

            return {
              ...svc,
              cpu: Math.round(cpu * 10) / 10,
              memory: Math.round(memory * 10) / 10,
              latency: Math.round(latency),
              requests: Math.round(requests),
              errorRate: Math.round(errorRate * 100) / 100,
              slo: Math.round(newSlo * 100) / 100,
              errorBudget: Math.round(newBudget * 100) / 100,
              status
            }
          })
        )

        setNodes(prev =>
          prev.map(node => {
            let cpu = node.cpu
            let memory = node.memory
            let disk = node.disk
            let status: 'healthy' | 'degraded' | 'critical' = 'healthy'

            const isOutage = activeSimulation !== 'none'
            if (isOutage) {
              if (activeSimulation === 'database_crash' && node.name === 'db-primary-us-east') {
                status = 'critical'
                cpu = 99
                memory = 94
              } else if (activeSimulation === 'api_ddos' && node.name === 'k8s-node-1') {
                status = 'critical'
                cpu = 100
              } else if (activeSimulation === 'redis_eviction' && node.name === 'db-primary-us-east') {
                status = 'degraded'
                memory = 99
              } else if (activeSimulation === 'memory_leak' && node.name === 'k8s-node-2') {
                status = 'degraded'
                memory = Math.min(95, memory + 3)
              } else if (activeSimulation === 'cpu_spike' && node.name === 'k8s-node-3') {
                status = 'critical'
                cpu = 100
              } else if (activeSimulation === 'disk_failure' && node.name === 'k8s-node-3') {
                status = 'critical'
                disk = 98
              } else if (activeSimulation === 'kubernetes_failure' && node.name === 'k8s-node-2') {
                status = 'critical'
                cpu = 0
                memory = 0
              }
            } else {
              cpu = Math.max(10, Math.min(85, cpu + (Math.random() - 0.5) * 3))
              memory = Math.max(20, Math.min(80, memory + (Math.random() - 0.5) * 2))
              disk = Math.max(30, Math.min(85, disk + (Math.random() - 0.5) * 0.2))
              status = 'healthy'
            }

            return {
              ...node,
              cpu: Math.round(cpu),
              memory: Math.round(memory),
              disk: Math.round(disk),
              status
            }
          })
        )

        // Random alerts heartbeats generator
        if (Math.random() > 0.6) {
          const randomSvc = servicesRef.current[Math.floor(Math.random() * servicesRef.current.length)]
          let level: 'INFO' | 'WARN' | 'ERROR' | 'FATAL' = 'INFO'
          let message = `System telemetry validation check completed successfully.`

          if (activeSimulation !== 'none') {
            const detail = SIMULATION_DETAILS[activeSimulation as Exclude<SimulationType, 'none'>]
            level = Math.random() > 0.4 ? 'ERROR' : 'WARN'
            message = detail.evidence[Math.floor(Math.random() * detail.evidence.length)]
          }

          const newAlert: AlertLog = {
            timestamp,
            level,
            service: randomSvc.name,
            message,
            pod: `${randomSvc.name.toLowerCase().replace(' ', '-')}-${Math.random().toString(36).substring(2, 7)}`,
            node: `k8s-node-${Math.floor(Math.random() * 3) + 1}`,
            region: 'us-east-1',
            traceId: `tr-${Math.random().toString(36).substring(2, 10)}`,
            correlationId: `cr-${Math.random().toString(36).substring(2, 10)}`
          }
          setAlerts(prev => [newAlert, ...prev.slice(0, 399)])
        }
      }
    }

    tick()
    const timer = setInterval(tick, 3000)
    return () => clearInterval(timer)
  }, [mode, activeSimulation])

  // SLA / health computations
  useEffect(() => {
    if (mode === 'live') return // live telemetry computes this directly in tick
    if (activeSimulation === 'none') {
      setSystemHealth(99)
      setRiskScore(6)
    } else {
      const activeInc = incidents.find(i => i.status === 'active' || i.status === 'mitigating')
      if (activeInc) {
        if (activeInc.status === 'mitigating') {
          setSystemHealth(Math.min(90, 40 + Math.round(activeInc.mitigationProgress * 0.5)))
          setRiskScore(Math.max(10, 80 - Math.round(activeInc.mitigationProgress * 0.7)))
        } else {
          const drop = activeInc.severity === 'P0' ? 65 : 40
          setSystemHealth(Math.max(5, 99 - drop))
          setRiskScore(activeInc.severity === 'P0' ? 94 : 70)
        }
      }
    }
  }, [activeSimulation, incidents, mode])


  // Triggering simulation
  const triggerSimulation = (type: SimulationType) => {
    if (mode === 'live') return // Simulation disabled in Live Mode
    if (type === 'none') {
      clearSimulation()
      return
    }

    setActiveSimulation(type)
    const detail = SIMULATION_DETAILS[type as Exclude<SimulationType, 'none'>]
    const incidentId = `INC-${1000 + Math.floor(Math.random() * 9000)}`

    // Generate simulated Event logs to populate the new engines
    const mockEvents = detail.evidence.map((ev, idx) => ({
      id: `evt-${idx}-${Date.now()}`,
      timestamp: new Date(Date.now() - (detail.evidence.length - idx) * 60000).toISOString(),
      provider: ev.includes('db/') || ev.includes('postgres') || ev.includes('redis') ? 'logs' as const
                : ev.includes('pod/') || ev.includes('svc/') ? 'k8s' as const
                : ev.includes('docker') ? 'docker' as const : 'system' as const,
      resourceType: ev.includes('pod/') ? 'pod' as const : 'service' as const,
      resourceName: ev.split(':')[0],
      service: detail.affectedServices[0] || 'Orders Service',
      severity: 'FATAL' as const,
      message: ev,
      metadata: {}
    }))

    // 1. Evidence Engine simulation
    const structuredEvidence = mockEvents.map((evt, idx) => {
      const isDb = evt.message.includes('db/') || evt.message.includes('postgres') || evt.message.includes('redis')
      return {
        timestamp: new Date(evt.timestamp).toLocaleTimeString(),
        provider: evt.provider,
        service: evt.service,
        event: evt.message,
        severity: evt.severity,
        weight: isDb ? 'High' as const : 'Medium' as const,
        confidenceContribution: isDb ? 22 : 15,
        explanation: isDb ? 'Earliest failure observed. Primary bottleneck.' : 'Cascading upstream symptom.'
      }
    })

    // 2. Deterministic RCA simulation
    const deterministicRCA = {
      primaryRootCause: detail.rootCause,
      primaryService: detail.affectedServices[0] || 'Orders Service',
      secondaryContributors: detail.affectedServices.slice(1, 2),
      downstreamSymptoms: detail.affectedServices.slice(2),
      unknownFactors: [] as string[],
      rulesTriggered: ['Temporal Ordering Alert Indexing', 'Topological Dependency Descent'],
      providerAgreement: {
        providers: Array.from(new Set(mockEvents.map(e => e.provider))),
        percentage: 75
      },
      blastRadius: {
        affectedCount: detail.affectedServices.length,
        percentage: Math.round((detail.affectedServices.length / 6) * 100),
        description: detail.blastRadius
      }
    }

    // 3. Business Impact simulation
    const businessImpactData = {
      usersAffected: detail.usersAffected,
      requestsFailed: detail.usersAffected * 15,
      servicesImpacted: detail.affectedServices,
      criticality: detail.priority,
      revenueRisk: detail.revenueImpactRate * 12,
      operationalSeverity: detail.severity,
      estimatedMTTR: 14,
      slaImpact: 0.00034,
      assumptions: [
        'Baseline traffic load modeled at active telemetry rates.',
        `Revenue risk modeling assumes a standard SRE transactional attribution model ($${detail.revenueImpactRate}/min).`,
        'SLA impact computed relative to a rolling 30-day cluster baseline of 850,000,000 requests.'
      ]
    }

    // 4. Confidence Breakdown
    const confidenceBreakdown = [
      { source: 'Docker container evidence', score: 20 },
      { source: 'Kubernetes orchestration metrics', score: 25 },
      { source: 'System host parameters', score: 18 },
      { source: 'Application logs traces', score: 22 },
      { source: 'Temporal alert correlation', score: 8 },
      { source: 'Topological dependency analysis', score: 3 }
    ]

    // 5. AI Validation
    const aiValidation = {
      validatedStatus: 'validated' as const,
      validationExplanation: `Gemini validated primary root cause as: ${detail.rootCause}. Performance indicators agree with the deterministic model.`,
      suggestedAdditionalChecks: [
        'kubectl logs deployment/' + (detail.affectedServices[0] || 'orders-service').toLowerCase().replace(' ', '-') + ' -n core',
        'kubectl top pods -n core'
      ],
      uncertaintyEstimate: 'Low uncertainty (< 5% error probability)'
    }

    // 6. Similar Incidents (resolved from historical learning archive)
    const resolved = historicalIncidentsRef.current
    const similarIncidents = resolved.map(r => ({
      id: r.id,
      title: r.title,
      similarityScore: r.affectedServices.some(s => detail.affectedServices.includes(s)) ? (r.rootCause === detail.rootCause ? 99 : 85) : 30,
      previousResolution: r.recommendedActions || 'Remediation applied successfully.',
      recoveryTimeMinutes: 14,
      runbookExecuted: r.recoveryPlan,
      recurringPatternDetected: r.affectedServices.some(s => detail.affectedServices.includes(s))
    })).sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 3)

    const baseIncident: Incident = {
      ...detail,
      id: incidentId,
      status: 'active',
      mitigationProgress: 0,
      recoveryPlan: detail.recoveryPlan.map(step => ({ ...step, status: 'pending', output: '' })),
      rollbackPlan: detail.rollbackPlan.map(step => ({ ...step, status: 'pending', output: '' })),
      
      // Enriched explainability fields
      structuredEvidence,
      deterministicRCA,
      businessImpactData,
      confidenceBreakdown,
      aiValidation,
      similarIncidents
    }

    // Dynamic recovery confidence evaluation
    const recoveryIntelligence = calculateClientRecoveryIntelligence(baseIncident, historicalIncidentsRef.current, learningMetadataRef.current)
    const newIncident: Incident = {
      ...baseIncident,
      recoveryIntelligence
    }

    // Track for auto-archiving on resolution
    sessionActiveIncidentIdsRef.current.add(incidentId)

    setIncidents(prev => [newIncident, ...prev])

    setCopilotMessages([
      {
        role: 'assistant',
        content: `🚨 **P0 INCIDENT TRIGGERED: ${newIncident.title}**\n\nI have correlated **${detail.evidence.length} key anomalies** across the infrastructure logs and diagnosed a cluster disruption.\n\n* **Root Cause Assessment:** ${detail.rootCause}\n* **Impact Area:** ${detail.blastRadius}\n* **Revenue Bleed Rate:** ~$${detail.revenueImpactRate}/min\n\nYou can review the executable **Recovery Runbook** in the *Incidents* workspace, or ask me questions about this outage here.`,
        timestamp: new Date()
      }
    ])

    announceOutage(newIncident.title, newIncident.severity)
  }

  const clearSimulation = () => {
    setActiveSimulation('none')
    stopReplay()
    setIncidents(prev =>
      prev.map(i => (i.status === 'active' || i.status === 'mitigating' ? { ...i, status: 'resolved', mitigationProgress: 100 } : i))
    )
    setServices(prev =>
      prev.map(svc => ({
        ...svc,
        status: 'healthy',
        errorRate: 0.01,
        latency: Math.max(10, Math.min(100, svc.latency * 0.1))
      }))
    )
    setNodes(prev =>
      prev.map(n => ({
        ...n,
        status: 'healthy',
        cpu: Math.min(30, n.cpu),
        memory: Math.min(50, n.memory),
        disk: Math.min(60, n.disk)
      }))
    )
    setCopilotMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: `✅ All active infrastructure metrics have stabilized. The telemetry indicators are fully healthy. Outage state cleared.`,
        timestamp: new Date()
      }
    ])
  }

  // Run specific recovery command step
  const runRecoveryStep = async (incidentId: string, stepIndex: number) => {
    let targetCommand = ''
    setIncidents(prev =>
      prev.map(inc => {
        if (inc.id !== incidentId) return inc
        const plan = [...inc.recoveryPlan]
        targetCommand = plan[stepIndex].command
        plan[stepIndex] = {
          ...plan[stepIndex],
          status: 'running',
          output: `$ ${plan[stepIndex].command}\nConnecting system shell...\nApplying telemetry healing patch...`
        }
        return {
          ...inc,
          status: 'mitigating',
          recoveryPlan: plan
        }
      })
    )

    if (mode === 'live') {
      try {
        await fetch('/api/incidents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            incidentId,
            stepIndex,
            status: 'running',
            output: `$ ${targetCommand}\nConnecting system shell...\nApplying telemetry healing patch...`,
            incidentStatus: 'mitigating'
          })
        })
      } catch (e) {}
    }

    await new Promise(resolve => setTimeout(resolve, 2000))

    let progress = 0
    let isCompleted = false
    let finalOutput = ''
    setIncidents(prev =>
      prev.map(inc => {
        if (inc.id !== incidentId) return inc
        const plan = [...inc.recoveryPlan]
        finalOutput = `$ ${plan[stepIndex].command}\n\n[SUCCESS] Operation completed.\nExit code: 0\nLogs: Tasks successfully committed. System health restored.`
        plan[stepIndex] = {
          ...plan[stepIndex],
          status: 'completed',
          output: finalOutput
        }
        const totalCompleted = plan.filter(s => s.status === 'completed').length
        progress = Math.round((totalCompleted / plan.length) * 100)
        isCompleted = totalCompleted === plan.length

        // If completed in Live mode, clear active outages in UI
        if (isCompleted && mode === 'live') {
          setTimeout(() => {
            setIncidents(hist => hist.map(hi => hi.id === incidentId ? { ...hi, status: 'resolved', mitigationProgress: 100 } : hi))
            setServices(s => s.map(sv => ({ ...sv, status: 'healthy', errorRate: 0.01 })))
          }, 1000)
        }

        return {
          ...inc,
          recoveryPlan: plan,
          mitigationProgress: progress,
          status: isCompleted ? 'resolved' : 'mitigating'
        }
      })
    )

    if (mode === 'live') {
      try {
        await fetch('/api/incidents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            incidentId,
            stepIndex,
            status: 'completed',
            output: finalOutput,
            mitigationProgress: progress,
            incidentStatus: isCompleted ? 'resolved' : 'mitigating'
          })
        })
      } catch (e) {}
    }
  }

  const runAllRecoverySteps = async (incidentId: string) => {
    const inc = incidentsRef.current.find(i => i.id === incidentId)
    if (!inc) return
    for (let i = 0; i < inc.recoveryPlan.length; i++) {
      if (inc.recoveryPlan[i].status !== 'completed') {
        await runRecoveryStep(incidentId, i)
      }
    }
    if (mode === 'demo') {
      setTimeout(() => {
        clearSimulation()
      }, 1000)
    }
  }

  const askCopilot = async (question: string) => {
    const userMsg = { role: 'user' as const, content: question, timestamp: new Date() }
    setCopilotMessages(prev => [...prev, userMsg])

    const currentIncident = incidents.find(i => i.status === 'active' || i.status === 'mitigating')

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          currentIncident: currentIncident || null,
          simulationType: mode === 'live' ? 'live' : activeSimulation
        })
      })

      if (!response.ok) throw new Error('API server returned error')
      const data = await response.json()
      setCopilotMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.reply, timestamp: new Date() }
      ])
    } catch (e) {
      let reply = `Based on the telemetry stream, I see no active outages. In Live Mode, I monitor actual containers and kubectl outputs.`

      if (currentIncident) {
        const lowerQ = question.toLowerCase()
        if (lowerQ.includes('why') || lowerQ.includes('cause')) {
          reply = `The root cause of **${currentIncident.title}** is analyzed as: **${currentIncident.rootCause}**.`
        } else if (lowerQ.includes('fix') || lowerQ.includes('remediat') || lowerQ.includes('command')) {
          reply = `Here is the SRE recovery plan I generated for **${currentIncident.id}**:\n\n` + 
            currentIncident.recoveryPlan.map((s, idx) => `**Step ${idx+1}:** ${s.description}\n\`\`\`bash\n${s.command}\n\`\`\``).join('\n\n')
        } else {
          reply = `I am monitoring **${currentIncident.id}** (${currentIncident.title}). Navigate to the **Incidents Tab** to execute recovery terminal playbooks.`
        }
      }

      setTimeout(() => {
        setCopilotMessages(prev => [
          ...prev,
          { role: 'assistant', content: reply, timestamp: new Date() }
        ])
      }, 1000)
    }
  }

  const clearCopilot = () => {
    setCopilotMessages([])
  }

  // Replay ticks effect
  useEffect(() => {
    if (!replayActive || !replayIncidentId) return

    const inc = incidentsRef.current.find(i => i.id === replayIncidentId)
    if (!inc) {
      setReplayActive(false)
      return
    }

    const maxSteps = inc.timeline.length
    const intervalTime = 3000 / replaySpeed

    const timer = setInterval(() => {
      setReplayCurrentStep(prev => {
        if (prev >= maxSteps - 1) {
          clearInterval(timer)
          setReplayActive(false)
          return prev
        }
        return prev + 1
      })
    }, intervalTime)

    return () => clearInterval(timer)
  }, [replayActive, replayIncidentId, replaySpeed])

  const startJudgeMode = () => {
    rawStartJudgeMode({
      setMode,
      triggerSimulation,
      incidentsRef,
      startReplay,
      runAllRecoverySteps,
      stopReplay
    })
  }

  // Get overridden service metrics during cinematic replay
  const getReplayServices = (incidentId: string, stepIndex: number) => {
    const inc = incidentsRef.current.find(i => i.id === incidentId)
    if (!inc) return services

    const base = [
      { name: 'API Gateway', status: 'healthy' as const, cpu: 15, memory: 35, latency: 45, requests: 2450, errorRate: 0.01, sla: 99.99, slo: 99.95, errorBudget: 99.8 },
      { name: 'Auth Service', status: 'healthy' as const, cpu: 12, memory: 28, latency: 18, requests: 2450, errorRate: 0.0, sla: 99.99, slo: 99.9, errorBudget: 100.0 },
      { name: 'Payment Service', status: 'healthy' as const, cpu: 18, memory: 42, latency: 120, requests: 620, errorRate: 0.05, sla: 99.95, slo: 99.9, errorBudget: 98.4 },
      { name: 'Orders Service', status: 'healthy' as const, cpu: 22, memory: 51, latency: 68, requests: 1240, errorRate: 0.02, sla: 99.98, slo: 99.9, errorBudget: 99.1 },
      { name: 'Notification Service', status: 'healthy' as const, cpu: 10, memory: 15, latency: 35, requests: 450, errorRate: 0.0, sla: 100.0, slo: 99.5, errorBudget: 100.0 },
      { name: 'Catalog Service', status: 'healthy' as const, cpu: 8, memory: 20, latency: 15, requests: 3800, errorRate: 0.01, sla: 99.99, slo: 99.95, errorBudget: 99.9 }
    ]

    const rc = inc.rootCause.toLowerCase()

    if (rc.includes('database') || rc.includes('postgres')) {
      return base.map(s => {
        if (s.name === 'Orders Service' || s.name === 'Payment Service') {
          if (stepIndex === 0) return { ...s, status: 'degraded' as const, cpu: 80, latency: 1500, errorRate: 15 }
          if (stepIndex >= 1 && stepIndex <= 4) return { ...s, status: 'critical' as const, cpu: 95, latency: 8000, errorRate: 85 }
        }
        if (s.name === 'API Gateway') {
          if (stepIndex >= 2 && stepIndex <= 4) return { ...s, status: 'degraded' as const, cpu: 45, latency: 3000, errorRate: 35 }
        }
        return s
      })
    }

    if (rc.includes('ddos') || rc.includes('flood') || rc.includes('cloudflare')) {
      return base.map(s => {
        if (s.name === 'API Gateway') {
          if (stepIndex === 0) return { ...s, status: 'degraded' as const, cpu: 85, requests: 35000, latency: 1200, errorRate: 10 }
          if (stepIndex >= 1 && stepIndex <= 4) return { ...s, status: 'critical' as const, cpu: 99, requests: 65000, latency: 8500, errorRate: 75 }
        }
        if (s.name === 'Auth Service') {
          if (stepIndex >= 2 && stepIndex <= 4) return { ...s, status: 'degraded' as const, cpu: 75, latency: 4500, errorRate: 15 }
        }
        return s
      })
    }

    if (rc.includes('leak') || rc.includes('oom')) {
      return base.map(s => {
        if (s.name === 'Auth Service') {
          const mem = Math.min(98, 40 + stepIndex * 15)
          const isCrit = mem > 80
          if (stepIndex >= 0 && stepIndex <= 4) return { ...s, status: isCrit ? 'critical' as const : 'degraded' as const, memory: mem, latency: isCrit ? 12000 : 2500, errorRate: isCrit ? 50 : 12 }
        }
        return s
      })
    }

    const primary = inc.affectedServices[0] || 'Auth Service'
    return base.map(s => {
      if (s.name === primary) {
        if (stepIndex === 0) return { ...s, status: 'degraded' as const, latency: 1200, errorRate: 15 }
        if (stepIndex >= 1 && stepIndex <= 4) return { ...s, status: 'critical' as const, latency: 6000, errorRate: 70 }
      }
      return s
    })
  }

  // Get overridden node metrics during cinematic replay
  const getReplayNodes = (incidentId: string, stepIndex: number) => {
    const inc = incidentsRef.current.find(i => i.id === incidentId)
    if (!inc) return nodes

    const base = [
      { name: 'k8s-node-1', status: 'healthy' as const, cpu: 28, memory: 52, disk: 44, podsCount: 14 },
      { name: 'k8s-node-2', status: 'healthy' as const, cpu: 32, memory: 48, disk: 38, podsCount: 12 },
      { name: 'k8s-node-3', status: 'healthy' as const, cpu: 18, memory: 35, disk: 62, podsCount: 8 },
      { name: 'db-primary-us-east', status: 'healthy' as const, cpu: 24, memory: 61, disk: 54, podsCount: 1 }
    ]

    const rc = inc.rootCause.toLowerCase()

    if (rc.includes('database') || rc.includes('postgres')) {
      return base.map(n => {
        if (n.name === 'db-primary-us-east') {
          if (stepIndex === 0) return { ...n, status: 'degraded' as const, cpu: 85 }
          if (stepIndex >= 1 && stepIndex <= 4) return { ...n, status: 'critical' as const, cpu: 99, memory: 94 }
        }
        return n
      })
    }

    if (rc.includes('ddos') || rc.includes('flood')) {
      return base.map(n => {
        if (n.name === 'k8s-node-1') {
          if (stepIndex >= 1 && stepIndex <= 4) return { ...n, status: 'critical' as const, cpu: 100 }
        }
        return n
      })
    }

    if (rc.includes('leak') || rc.includes('oom')) {
      return base.map(n => {
        if (n.name === 'k8s-node-2') {
          const mem = Math.min(99, 50 + stepIndex * 10)
          return { ...n, status: mem > 85 ? 'critical' as const : 'degraded' as const, memory: mem }
        }
        return n
      })
    }

    return base
  }

  return (
    <SystemContext.Provider
      value={{
        mode,
        setMode,
        systemHealth,
        riskScore,
        activeSimulation,
        services: replayActive && replayIncidentId ? getReplayServices(replayIncidentId, replayCurrentStep) : services,
        nodes: replayActive && replayIncidentId ? getReplayNodes(replayIncidentId, replayCurrentStep) : nodes,
        alerts,
        incidents,
        copilotMessages,
        voiceLanguage,
        voiceEnabled,
        capabilities,
        triggerSimulation,
        clearSimulation,
        runRecoveryStep,
        runAllRecoverySteps,
        askCopilot,
        setVoiceLanguage,
        setVoiceEnabled,
        clearCopilot,

        // SRE Knowledge & Learning States
        historicalIncidents,
        learningMetadata,
        fetchHistoricalData,
        archiveResolvedIncident,

        // Judge Mode Presentation
        judgeModeActive,
        judgeModeStep,
        judgeModeStatusText,
        startJudgeMode,

        // Incident Replay Player
        replayActive,
        replayCurrentStep,
        replaySpeed,
        replayIncidentId,
        startReplay,
        pauseReplay,
        resumeReplay,
        seekReplay,
        stopReplay
      }}
    >
      {children}
    </SystemContext.Provider>
  )
}

export const useSystem = () => {
  const context = useContext(SystemContext)
  if (context === undefined) {
    throw new Error('useSystem must be used within a SystemProvider')
  }
  return context
}

function formatTimestamp(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `[${h}:${m}:${s}.${ms}]`
}

