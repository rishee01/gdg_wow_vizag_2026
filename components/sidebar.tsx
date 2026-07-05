'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSystem } from '@/context/SystemContext'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  AlertTriangle,
  Terminal,
  Network,
  Server,
  Activity,
  Bot,
  BookOpen,
  TrendingUp,
  FileCode,
  Volume2,
  VolumeX,
  Shield,
  Brain,
  GitBranch
} from 'lucide-react'

export function Sidebar() {
  const pathname = usePathname()
  const { 
    mode, 
    setMode, 
    systemHealth, 
    riskScore, 
    activeSimulation, 
    voiceEnabled, 
    voiceLanguage, 
    setVoiceEnabled, 
    setVoiceLanguage 
  } = useSystem()
  const [timeString, setTimeString] = useState('')

  // SRE Live clock update
  useEffect(() => {
    const updateTime = () => {
      const d = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      setTimeString(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} UTC+5:30`)
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Incidents', href: '/incidents', icon: AlertTriangle, badge: activeSimulation !== 'none' || mode === 'live' ? 'Active' : undefined },
    { name: 'Incident Graph', href: '/incident-graph', icon: GitBranch },
    { name: 'Operational Knowledge', href: '/operational-knowledge', icon: Brain },
    { name: 'Alert Explorer', href: '/alerts', icon: Terminal },
    { name: 'Topology', href: '/topology', icon: Network },
    { name: 'Infrastructure', href: '/infrastructure', icon: Server },
    { name: 'Services', href: '/services', icon: Activity },
    { name: 'AI Copilot', href: '/copilot', icon: Bot },
    { name: 'Runbooks', href: '/runbooks', icon: BookOpen },
    { name: 'Analytics', href: '/analytics', icon: TrendingUp },
    { name: 'Audit Logs', href: '/audit-logs', icon: FileCode },
  ]

  const settingsSubnav = [
    { name: 'Organization', href: '/settings' },
    { name: 'Team', href: '/settings/team' },
    { name: 'API Keys', href: '/settings/api-keys' },
    { name: 'Integrations', href: '/settings/integrations' }
  ]

  return (
    <div className="flex h-full w-64 flex-col border-r border-border/40 bg-zinc-950/70 backdrop-blur-md">
      {/* Brand Section */}
      <div className="flex items-center gap-3 border-b border-border/40 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-950 border border-cyan-500/30 text-cyan-400">
          <Shield className="h-5 w-5 animate-pulse" />
        </div>
        <div>
          <span className="font-mono text-base font-bold uppercase tracking-wider text-slate-100">
            PulseControl
          </span>
          <p className="font-mono text-[9px] text-cyan-400/70 tracking-widest uppercase">
            Incident Intel
          </p>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="px-5 py-3 border-b border-border/40 bg-black/20 flex items-center justify-between font-mono text-[10px]">
        <span className="text-zinc-500 uppercase tracking-widest">Ingress</span>
        <div className="flex bg-black/60 border border-zinc-800/80 p-0.5 rounded gap-0.5">
          <button
            onClick={() => setMode('demo')}
            className={cn(
              "px-2.5 py-0.5 rounded font-mono text-[9px] uppercase transition-all",
              mode === 'demo' 
                ? "bg-zinc-800 text-slate-100 font-semibold" 
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Demo
          </button>
          <button
            onClick={() => setMode('live')}
            className={cn(
              "px-2.5 py-0.5 rounded font-mono text-[9px] uppercase transition-all",
              mode === 'live' 
                ? "bg-cyan-950/60 border border-cyan-500/20 text-cyan-400 font-semibold" 
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Live
          </button>
        </div>
      </div>

      {/* Health Status Dashboard summary */}
      <div className="p-4 border-b border-border/40 bg-zinc-900/20">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Health Index</span>
          <span className={cn(
            "font-mono text-xs font-semibold",
            systemHealth > 80 ? "text-emerald-400" : systemHealth > 40 ? "text-amber-400" : "text-rose-500"
          )}>
            {systemHealth}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-zinc-800/80 overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-1000",
              systemHealth > 80 ? "bg-emerald-500" : systemHealth > 40 ? "bg-amber-500" : "bg-rose-500"
            )}
            style={{ width: `${systemHealth}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-3 text-[11px]">
          <div className="flex flex-col">
            <span className="text-muted-foreground font-mono text-[9px] uppercase">Risk Rating</span>
            <span className={cn(
              "font-mono font-semibold",
              riskScore < 30 ? "text-emerald-400" : riskScore < 70 ? "text-amber-400" : "text-rose-400"
            )}>{riskScore}%</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-muted-foreground font-mono text-[9px] uppercase">Telemetry Ingress</span>
            <span className="font-mono font-semibold text-slate-300 uppercase text-[9px]">
              {mode === 'live' ? 'LIVE HOST' : activeSimulation !== 'none' ? 'INCIDENT' : 'STEADY'}
            </span>
          </div>
        </div>
      </div>

      {/* SRE Clock */}
      <div className="px-5 py-2 border-b border-border/40 bg-black/40">
        <span className="font-mono text-[10px] uppercase text-zinc-500 block tracking-widest">
          SRE Live Clock
        </span>
        <span className="font-mono text-xs font-bold text-zinc-300 select-all block">
          {timeString || '00:00:00 UTC'}
        </span>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center justify-between rounded-md px-3 py-2 text-xs font-mono tracking-wide transition-all',
                  isActive
                    ? 'bg-cyan-950/60 border border-cyan-500/20 text-cyan-400 font-semibold'
                    : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-slate-200 border border-transparent'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={cn(
                    'h-4 w-4 shrink-0 transition-transform group-hover:scale-105',
                    isActive ? 'text-cyan-400' : 'text-zinc-500 group-hover:text-zinc-300'
                  )} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="rounded bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-rose-400 animate-pulse">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Settings Workspace sub-group */}
        <div className="space-y-2">
          <span className="px-3 font-mono text-[9px] font-semibold uppercase tracking-widest text-zinc-600 block">
            Settings Suite
          </span>
          <div className="space-y-1.5 pl-3 border-l border-zinc-800">
            {settingsSubnav.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'block rounded px-3 py-1 font-mono text-[11px] transition-all',
                    isActive
                      ? 'text-cyan-400 font-semibold bg-cyan-950/20'
                      : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  {item.name}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Voice Announcements Settings Block */}
      <div className="border-t border-border/40 p-4 bg-zinc-950">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded border transition-all",
                voiceEnabled 
                  ? "bg-cyan-950/60 border-cyan-500/40 text-cyan-400" 
                  : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
              )}
              title={voiceEnabled ? "Mute Voice Alerts" : "Enable Voice Alerts"}
            >
              {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider">Voice Alarms</span>
          </div>

          {voiceEnabled && (
            <select
              value={voiceLanguage}
              onChange={(e) => setVoiceLanguage(e.target.value as 'en' | 'te' | 'hi')}
              className="bg-zinc-900 border border-zinc-800 rounded text-[10px] font-mono px-1 py-0.5 text-zinc-300 focus:outline-none focus:border-cyan-500/40"
            >
              <option value="en">EN (English)</option>
              <option value="te">TE (తెలుగు)</option>
              <option value="hi">HI (हिंदी)</option>
            </select>
          )}
        </div>
      </div>
    </div>
  )
}
