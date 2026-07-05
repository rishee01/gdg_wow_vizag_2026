'use client'

import React, { useState } from 'react'
import { Shield, Building, Globe, Check } from 'lucide-react'

export default function SettingsPage() {
  const [orgName, setOrgName] = useState('PulseControl Enterprise')
  const [domain, setDomain] = useState('pulsecontrol.com')
  const [saved, setSaved] = useState(false)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-8 space-y-6 max-w-4xl font-mono text-xs text-zinc-300">
      {/* Header */}
      <header className="border-b border-border/30 pb-5">
        <h1 className="text-xl font-bold tracking-tight text-slate-100 uppercase">
          Organization Workspace Settings
        </h1>
        <p className="text-xs text-muted-foreground">
          Configure corporate directory credentials and default namespace routing profiles.
        </p>
      </header>

      {/* Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="border border-border/40 bg-zinc-950/40 p-6 rounded-lg space-y-4">
          <h2 className="text-slate-200 font-bold uppercase tracking-widest text-[10px] border-b border-zinc-900 pb-2">
            Company Profile
          </h2>
          
          <div className="space-y-2">
            <label className="text-zinc-500 uppercase block">Organization Identifier Name</label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full max-w-md bg-black/40 border border-zinc-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-zinc-500 uppercase block">Primary Corporate Ingress Route Domain</label>
            <div className="flex max-w-md">
              <span className="bg-zinc-900 border border-r-0 border-zinc-800 rounded-l px-3 py-2 text-zinc-500 select-none">https://</span>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="flex-1 bg-black/40 border border-zinc-800 rounded-r px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>
        </div>

        <div className="border border-border/40 bg-zinc-950/40 p-6 rounded-lg space-y-4">
          <h2 className="text-slate-200 font-bold uppercase tracking-widest text-[10px] border-b border-zinc-900 pb-2">
            Security Directory Single-Sign-On
          </h2>
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded bg-cyan-950 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Shield className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-slate-300 font-bold">OIDC / SAML Active Integration Profile</p>
              <p className="text-[10px] text-zinc-500">Corporate users validate authorizations against active Google Workspaces directories.</p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="bg-cyan-500 hover:bg-cyan-400 text-black px-5 py-2.5 rounded font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
        >
          {saved ? <Check className="h-4 w-4" /> : null}
          {saved ? 'Settings Saved' : 'Commit Settings'}
        </button>
      </form>
    </div>
  )
}
