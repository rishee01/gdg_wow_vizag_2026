'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useSystem } from '@/context/SystemContext'
import { cn } from '@/lib/utils'
import { Bot, User, Send, Trash2, ArrowUpRight, Loader } from 'lucide-react'

export default function CopilotPage() {
  const { copilotMessages, askCopilot, clearCopilot, activeSimulation } = useSystem()
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const threadEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages update
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [copilotMessages])

  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return
    setLoading(true)
    setQuestion('')
    await askCopilot(text)
    setLoading(false)
  }

  const suggestionChips = [
    { label: 'Why did this happen?', action: 'Why did this happen?' },
    { label: 'Show remediation plan', action: 'Show remediation plan' },
    { label: 'Generate Terraform fix', action: 'Generate Terraform fix' },
    { label: 'Predict next failure', action: 'Predict next failure' }
  ]

  return (
    <div className="p-8 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-border/30 pb-5 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 font-mono uppercase">
            AI Copilot Assistant
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            Context-aware Gemini model generated debugging assistant.
          </p>
        </div>

        {/* Clear log history */}
        <button
          onClick={clearCopilot}
          className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded font-mono text-[10px] uppercase transition-all"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Reset Chat
        </button>
      </header>

      {/* Main chat window container */}
      <div className="flex-1 flex flex-col border border-border/40 bg-black/40 rounded-lg mt-6 min-h-0 relative overflow-hidden">
        {/* Messages list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {copilotMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-4">
              <div className="h-10 w-10 rounded-lg bg-cyan-950 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-mono text-xs font-semibold text-slate-300 uppercase">PulseControl AI SRE Co-pilot</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Ask infrastructure diagnostic questions, request custom recovery shell scripts, or simulate failure impacts.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {copilotMessages.map((msg, idx) => {
                const isAssistant = msg.role === 'assistant'
                return (
                  <div key={idx} className={cn("flex gap-4 max-w-4xl", isAssistant ? "mr-12" : "ml-auto flex-row-reverse pl-12")}>
                    {/* Avatar */}
                    <div className={cn(
                      "h-8 w-8 rounded shrink-0 flex items-center justify-center border",
                      isAssistant 
                        ? "bg-cyan-950/40 border-cyan-500/30 text-cyan-400" 
                        : "bg-zinc-900 border-zinc-800 text-zinc-400"
                    )}>
                      {isAssistant ? <Bot className="h-4.5 w-4.5" /> : <User className="h-4.5 w-4.5" />}
                    </div>

                    {/* Chat Bubble content */}
                    <div className={cn(
                      "rounded-lg p-4 font-mono text-xs leading-relaxed overflow-hidden",
                      isAssistant 
                        ? "bg-zinc-900/40 border border-zinc-800 text-slate-300 select-text" 
                        : "bg-cyan-950/20 border border-cyan-500/20 text-cyan-200 select-all"
                    )}>
                      {/* Formatted markdown text wrapper */}
                      <div className="prose prose-invert max-w-none text-xs whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </div>
                      <span className="text-[8px] text-zinc-600 block mt-2 text-right">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  </div>
                )
              })}

              {/* Typing indicator */}
              {loading && (
                <div className="flex gap-4 max-w-4xl">
                  <div className="h-8 w-8 rounded shrink-0 flex items-center justify-center bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 animate-pulse">
                    <Loader className="h-4 w-4 animate-spin" />
                  </div>
                  <div className="bg-zinc-900/20 border border-zinc-900/60 rounded-lg px-4 py-3 font-mono text-xs text-zinc-500 animate-pulse">
                    Gemini model correlates events and formulates SRE reasoning...
                  </div>
                </div>
              )}
              <div ref={threadEndRef} />
            </div>
          )}
        </div>

        {/* Suggestion Chips */}
        {activeSimulation !== 'none' && (
          <div className="px-6 py-2 bg-zinc-950/60 border-t border-zinc-900 flex flex-wrap gap-2 shrink-0 select-none">
            {suggestionChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(chip.action)}
                className="flex items-center gap-1 rounded-full border border-cyan-500/10 hover:border-cyan-500/30 bg-cyan-950/10 hover:bg-cyan-950/30 px-3 py-1 font-mono text-[9px] text-cyan-400/80 hover:text-cyan-300 transition-all uppercase tracking-wide"
              >
                {chip.label}
                <ArrowUpRight className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}

        {/* Prompt Input Form */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(question); }}
          className="p-4 bg-zinc-950 border-t border-border/40 flex gap-3 shrink-0"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading}
            placeholder="Type SRE diagnostic queries or recovery commands..."
            className="flex-1 bg-black/40 border border-zinc-800 rounded px-4 py-3 font-mono text-xs text-slate-200 placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-3 rounded font-mono text-xs font-bold uppercase transition-all flex items-center justify-center shrink-0 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
