'use client'

import React, { useState } from 'react'
import { Key, Copy, Check, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KeyData {
  id: string
  name: string
  secret: string
  created: string
  lastUsed: string
  revealed: boolean
}

export default function ApiKeysSettingsPage() {
  const [keyName, setKeyName] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [keys, setKeys] = useState<KeyData[]>([
    {
      id: 'key-01',
      name: 'Datadog Ingress Integration',
      secret: 'pc_live_4a81d4cf9ca0128fd267a1b8',
      created: '2026-06-15',
      lastUsed: '2 minutes ago',
      revealed: false
    },
    {
      id: 'key-02',
      name: 'Prometheus Collector Webhook',
      secret: 'pc_live_99b8214a1a094b81094b2210',
      created: '2026-06-20',
      lastUsed: '1 hour ago',
      revealed: false
    }
  ])

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!keyName) return
    const randomHex = Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
    const newKey: KeyData = {
      id: `key-0${keys.length + 1}`,
      name: keyName,
      secret: `pc_live_${randomHex}`,
      created: new Date().toISOString().split('T')[0],
      lastUsed: 'Never',
      revealed: false
    }
    setKeys([...keys, newKey])
    setKeyName('')
  }

  const toggleReveal = (id: string) => {
    setKeys(keys.map(k => k.id === id ? { ...k, revealed: !k.revealed } : k))
  }

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleDelete = (id: string) => {
    setKeys(keys.filter(k => k.id !== id))
  }

  return (
    <div className="p-8 space-y-6 max-w-5xl font-mono text-xs text-zinc-300">
      {/* Header */}
      <header className="border-b border-border/30 pb-5">
        <h1 className="text-xl font-bold tracking-tight text-slate-100 uppercase">
          Cryptographic API Tokens
        </h1>
        <p className="text-xs text-muted-foreground">
          Generate security authentication tokens for collectors, alerts systems, and automated rollbacks.
        </p>
      </header>

      {/* Generate API Key */}
      <section className="border border-border/40 bg-zinc-950/40 p-6 rounded-lg space-y-4">
        <h2 className="text-slate-200 font-bold uppercase tracking-widest text-[10px] border-b border-zinc-900 pb-2">
          Provision Authentication API Token
        </h2>
        <form onSubmit={handleGenerate} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 space-y-2">
            <label className="text-zinc-500 uppercase block">Token Identifier Description</label>
            <input
              type="text"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="e.g. Grafana Outbound Alerting Hook"
              className="w-full bg-black/40 border border-zinc-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <button
            type="submit"
            className="bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-2 rounded font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 h-[34px]"
          >
            <Plus className="h-4 w-4" />
            Provision Token
          </button>
        </form>
      </section>

      {/* Key Table List */}
      <section className="border border-border/40 bg-black/40 rounded-lg overflow-hidden flex flex-col min-h-0">
        <div className="flex border-b border-zinc-800/80 px-4 py-3 bg-zinc-950 text-[9px] uppercase tracking-widest font-bold text-zinc-500 select-none">
          <div className="w-48 shrink-0">Token Name</div>
          <div className="flex-1">Secret Credentials Token Mapping</div>
          <div className="w-28 shrink-0">Created</div>
          <div className="w-32 shrink-0">Last Active</div>
          <div className="w-24 shrink-0 text-right font-semibold">Actions</div>
        </div>

        <div className="divide-y divide-zinc-900/60 leading-normal text-zinc-300">
          {keys.map((k) => (
            <div key={k.id} className="flex px-4 py-3 items-center hover:bg-zinc-900/20">
              <div className="w-48 shrink-0 text-slate-200 font-bold truncate pr-2">{k.name}</div>
              
              {/* Masked secret */}
              <div className="flex-grow flex items-center gap-2 select-all font-mono">
                <span className="text-zinc-400">
                  {k.revealed ? k.secret : `${k.secret.substring(0, 8)}************************`}
                </span>
                <button
                  onClick={() => toggleReveal(k.id)}
                  className="text-zinc-600 hover:text-zinc-400"
                >
                  {k.revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>

              <div className="w-28 shrink-0 text-zinc-500">{k.created}</div>
              <div className="w-32 shrink-0 text-zinc-400">{k.lastUsed}</div>

              <div className="w-24 shrink-0 flex items-center justify-end gap-3 select-none">
                <button
                  onClick={() => handleCopy(k.secret, k.id)}
                  className="text-zinc-500 hover:text-cyan-400 transition-colors"
                  title="Copy secret"
                >
                  {copiedId === k.id ? <Check className="h-4 w-4 text-cyan-400" /> : <Copy className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => handleDelete(k.id)}
                  className="text-zinc-600 hover:text-rose-400 transition-colors"
                  title="Delete key"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
