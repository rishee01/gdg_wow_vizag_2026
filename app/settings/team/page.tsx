'use client'

import React, { useState } from 'react'
import { Users, Mail, UserPlus, Check, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Member {
  name: string
  email: string
  role: 'Administrator' | 'Staff SRE' | 'Incident Commander' | 'Read-only'
  status: 'active' | 'pending'
}

export default function TeamSettingsPage() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'Administrator' | 'Staff SRE' | 'Incident Commander' | 'Read-only'>('Staff SRE')
  const [invited, setInvited] = useState(false)
  const [members, setMembers] = useState<Member[]>([
    { name: 'Mahar', email: 'mahar@pulsecontrol.com', role: 'Staff SRE', status: 'active' },
    { name: 'Alex Johnson', email: 'alex.j@pulsecontrol.com', role: 'Administrator', status: 'active' },
    { name: 'Sarah Connor', email: 'sarah.c@pulsecontrol.com', role: 'Incident Commander', status: 'active' },
    { name: 'David Smith', email: 'david.s@pulsecontrol.com', role: 'Read-only', status: 'pending' }
  ])

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    const newMember: Member = {
      name: email.split('@')[0],
      email,
      role,
      status: 'pending'
    }
    setMembers([...members, newMember])
    setEmail('')
    setInvited(true)
    setTimeout(() => setInvited(false), 2000)
  }

  const handleDelete = (index: number) => {
    setMembers(members.filter((_, i) => i !== index))
  }

  return (
    <div className="p-8 space-y-6 max-w-5xl font-mono text-xs text-zinc-300">
      {/* Header */}
      <header className="border-b border-border/30 pb-5">
        <h1 className="text-xl font-bold tracking-tight text-slate-100 uppercase">
          Team Workspace Registry
        </h1>
        <p className="text-xs text-muted-foreground">
          Manage member invitations, identity access controls, and active on-call duties profiles.
        </p>
      </header>

      {/* Invite Member form */}
      <section className="border border-border/40 bg-zinc-950/40 p-6 rounded-lg space-y-4">
        <h2 className="text-slate-200 font-bold uppercase tracking-widest text-[10px] border-b border-zinc-900 pb-2">
          Invite Core SRE Engineers
        </h2>
        <form onSubmit={handleInvite} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 space-y-2">
            <label className="text-zinc-500 uppercase block">Corporate Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-600" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@pulsecontrol.com"
                className="w-full bg-black/40 border border-zinc-800 rounded pl-9 pr-4 py-2 text-slate-200 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-zinc-500 uppercase block">Workspace Role Title</label>
            <select
              value={role}
              onChange={(e: any) => setRole(e.target.value)}
              className="bg-black/40 border border-zinc-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="Staff SRE">Staff SRE</option>
              <option value="Incident Commander">Incident Commander</option>
              <option value="Administrator">Administrator</option>
              <option value="Read-only">Read-only</option>
            </select>
          </div>

          <button
            type="submit"
            className="bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-2 rounded font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 h-[34px]"
          >
            {invited ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {invited ? 'Invitation Sent' : 'Send Invite'}
          </button>
        </form>
      </section>

      {/* Members List */}
      <section className="border border-border/40 bg-black/40 rounded-lg overflow-hidden flex flex-col min-h-0">
        <div className="flex border-b border-zinc-800/80 px-4 py-3 bg-zinc-950 text-[9px] uppercase tracking-widest font-bold text-zinc-500 select-none">
          <div className="w-48 shrink-0">Member Username</div>
          <div className="flex-1">Email Endpoint</div>
          <div className="w-44 shrink-0">Authorization Role</div>
          <div className="w-24 shrink-0">Registration Status</div>
          <div className="w-16 shrink-0 text-right">Delete</div>
        </div>

        <div className="divide-y divide-zinc-900/60 leading-normal text-zinc-300">
          {members.map((m, idx) => (
            <div key={idx} className="flex px-4 py-3 items-center hover:bg-zinc-900/20">
              <div className="w-48 shrink-0 text-slate-200 font-bold capitalize">{m.name}</div>
              <div className="flex-1 text-zinc-400">{m.email}</div>
              <div className="w-44 shrink-0 text-cyan-400/90">{m.role}</div>
              <div className="w-24 shrink-0">
                <span className={cn(
                  "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border",
                  m.status === 'active' ? "border-emerald-500/20 text-emerald-400 bg-emerald-950/10" : "border-amber-500/20 text-amber-400 bg-amber-950/10"
                )}>
                  {m.status}
                </span>
              </div>
              <div className="w-16 shrink-0 text-right">
                <button
                  onClick={() => handleDelete(idx)}
                  className="text-zinc-600 hover:text-rose-400 transition-colors"
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
