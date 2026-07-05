'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useSystem, type Incident } from '@/context/SystemContext'
import { type Relationship } from '@/lib/correlation-engine/persistence'
import { cn } from '@/lib/utils'
import { 
  Network, Search, Filter, RefreshCw, ZoomIn, ZoomOut, Maximize2, 
  HelpCircle, ShieldAlert, CheckCircle, AlertTriangle, Eye, ArrowRight 
} from 'lucide-react'

interface GraphNode {
  id: string
  incident: Incident
  isHistorical: boolean
  x: number
  y: number
  vx: number
  vy: number
}

interface GraphEdge {
  source: string
  target: string
  type: Relationship['type']
  confidence: number
  explanation: string
}

export default function IncidentGraphPage() {
  const { incidents, mode } = useSystem()
  
  // States
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  
  // Interaction States
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [expandNeighbors, setExpandNeighbors] = useState(false)
  const [highlightCausal, setHighlightCausal] = useState(true)
  const [highlightBlast, setHighlightBlast] = useState(false)
  const [highlightHistorical, setHighlightHistorical] = useState(false)

  // Zoom & Pan States
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement | null>(null)

  // Load relationships and historical incidents
  const fetchData = async () => {
    try {
      // 1. Fetch relationships
      const relRes = await fetch('/api/relationships')
      const relData = (relRes.ok ? await relRes.json() : []) as Relationship[]

      // 2. Fetch historical incidents
      const histRes = await fetch('/api/historical-incidents')
      const histData = (histRes.ok ? await histRes.json() : []) as Incident[]

      // 3. Combine active/mitigating incidents from context with historical incidents
      const activeList = incidents.filter(i => i.status !== 'resolved')
      
      // Deduplicate by ID
      const allIncMap: Record<string, { incident: Incident; isHistorical: boolean }> = {}
      histData.forEach(i => {
        allIncMap[i.id] = { incident: i, isHistorical: true }
      })
      activeList.forEach(i => {
        allIncMap[i.id] = { incident: i, isHistorical: false }
      })

      const combined = Object.values(allIncMap)

      // Initialize nodes with positions if not already defined
      setNodes(prevNodes => {
        return combined.map((item, idx) => {
          const existing = prevNodes.find(n => n.id === item.incident.id)
          if (existing) {
            // Keep same coordinates but update incident state
            return {
              ...existing,
              incident: item.incident,
              isHistorical: item.isHistorical
            }
          }

          // Compute initial position (active centered, historical in outer ring)
          const angle = (idx * 2 * Math.PI) / Math.max(1, combined.length)
          const radius = item.isHistorical ? 240 : 120
          const x = 400 + radius * Math.cos(angle) + (Math.random() - 0.5) * 20
          const y = 200 + radius * Math.sin(angle) + (Math.random() - 0.5) * 20

          return {
            id: item.incident.id,
            incident: item.incident,
            isHistorical: item.isHistorical,
            x,
            y,
            vx: 0,
            vy: 0
          }
        })
      })

      setEdges(relData.map(r => ({
        source: r.source,
        target: r.target,
        type: r.type,
        confidence: r.confidence,
        explanation: r.explanation
      })))

      setLoading(false)
    } catch (e) {
      console.error('Failed to load incident graph data:', e)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [incidents])

  // Simple Spring Physics Simulation loop in React for organic graph spacing
  useEffect(() => {
    if (nodes.length === 0) return

    const iterations = 40
    let currentNodes = [...nodes]

    for (let iter = 0; iter < iterations; iter++) {
      // Repulsion between all nodes
      for (let i = 0; i < currentNodes.length; i++) {
        for (let j = i + 1; j < currentNodes.length; j++) {
          const n1 = currentNodes[i]
          const n2 = currentNodes[j]
          const dx = n2.x - n1.x
          const dy = n2.y - n1.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          if (dist < 150) {
            const force = (150 - dist) / dist * 0.15
            n1.vx -= dx * force
            n1.vy -= dy * force
            n2.vx += dx * force
            n2.vy += dy * force
          }
        }
      }

      // Attraction along edges
      for (const edge of edges) {
        const n1 = currentNodes.find(n => n.id === edge.source)
        const n2 = currentNodes.find(n => n.id === edge.target)
        if (n1 && n2) {
          const dx = n2.x - n1.x
          const dy = n2.y - n1.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const targetDist = edge.type === 'SIMILAR_TO' ? 220 : 110
          if (dist > targetDist) {
            const force = (dist - targetDist) / dist * 0.08
            n1.vx += dx * force
            n1.vy += dy * force
            n2.vx -= dx * force
            n2.vy -= dy * force
          }
        }
      }

      // Gravity force to center (400, 200)
      for (const node of currentNodes) {
        const dx = 400 - node.x
        const dy = 200 - node.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        node.vx += dx * 0.005
        node.vy += dy * 0.005

        // Update positions with friction
        node.x += node.vx
        node.y += node.vy
        node.vx *= 0.8
        node.vy *= 0.8

        // Constrain bounds
        node.x = Math.max(50, Math.min(750, node.x))
        node.y = Math.max(50, Math.min(350, node.y))
      }
    }

    setNodes(currentNodes)
  }, [edges.length, loading])

  // Mouse pan triggers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return // Left click only
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setSelectedNodeId(null)
  }

  // Filter and Search logic
  const filteredNodes = nodes.filter(n => {
    const inc = n.incident
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase()
      const inId = inc.id.toLowerCase().includes(q)
      const inCause = inc.rootCause.toLowerCase().includes(q)
      const inService = inc.affectedServices.some(s => s.toLowerCase().includes(q))
      if (!inId && !inCause && !inService) return false
    }

    if (severityFilter !== 'ALL' && inc.severity !== severityFilter) return false
    
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'active' && (inc.status === 'resolved' || n.isHistorical)) return false
      if (statusFilter === 'resolved' && inc.status !== 'resolved') return false
      if (statusFilter === 'historical' && !n.isHistorical) return false
    }

    return true
  })

  // Selected Node Details
  const selectedNode = nodes.find(n => n.id === selectedNodeId)
  
  // Highlight helpers
  const getConnectedNodeIds = (nodeId: string): Set<string> => {
    const connected = new Set<string>([nodeId])
    edges.forEach(edge => {
      if (edge.source === nodeId) connected.add(edge.target)
      if (edge.target === nodeId) connected.add(edge.source)
    })
    return connected
  }

  const isEdgeHighlighted = (edge: GraphEdge): boolean => {
    if (highlightCausal && (edge.type === 'CAUSES' || edge.type === 'TRIGGERED')) return true
    if (highlightHistorical && edge.type === 'SIMILAR_TO') return true
    if (highlightBlast && (edge.type === 'AFFECTS' || edge.type === 'CAUSES' || edge.type === 'TRIGGERED')) {
      if (selectedNodeId && edge.source === selectedNodeId) return true
    }
    if (selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId)) return true
    return false
  }

  const isNodeDimmed = (nodeId: string): boolean => {
    if (searchQuery && !filteredNodes.some(fn => fn.id === nodeId)) return true
    if (selectedNodeId) {
      if (expandNeighbors) {
        const neighbors = getConnectedNodeIds(selectedNodeId)
        return !neighbors.has(nodeId)
      }
      if (highlightBlast) {
        // Highlight nodes that the selected node affects
        const affected = new Set<string>([selectedNodeId])
        edges.forEach(edge => {
          if (edge.source === selectedNodeId && (edge.type === 'CAUSES' || edge.type === 'TRIGGERED' || edge.type === 'AFFECTS')) {
            affected.add(edge.target)
          }
        })
        return !affected.has(nodeId)
      }
    }
    return false
  }

  // Get Node Color based on specifications
  const getNodeColor = (node: GraphNode) => {
    if (node.isHistorical) return 'stroke-purple-500 fill-purple-950/20 text-purple-400'
    const inc = node.incident
    if (inc.status === 'resolved') return 'stroke-emerald-500 fill-emerald-950/20 text-emerald-400'
    if (inc.status === 'mitigating') return 'stroke-amber-500 fill-amber-950/20 text-amber-400'
    if (inc.severity === 'P0') return 'stroke-rose-500 fill-rose-950/20 text-rose-400'
    return 'stroke-orange-500 fill-orange-950/20 text-orange-400'
  }

  const getEdgeColorClass = (type: GraphEdge['type']) => {
    switch (type) {
      case 'CAUSES':
      case 'TRIGGERED':
        return 'stroke-rose-500/70'
      case 'SIMILAR_TO':
        return 'stroke-purple-500/70'
      case 'DEPENDS_ON':
        return 'stroke-cyan-500/50'
      case 'RESOLVED_BY':
        return 'stroke-emerald-500/50'
      default:
        return 'stroke-zinc-700/40'
    }
  }

  return (
    <div className="p-8 h-full flex flex-col overflow-hidden">
      {/* Page Header */}
      <header className="border-b border-border/30 pb-5 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 font-mono uppercase flex items-center gap-2">
            <Network className="h-5 w-5 text-cyan-400 animate-pulse" />
            Incident Relationship Graph
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            Learn from operational history. Nodes represent active/historical outages; edges map semantic, timeline, and topological linkages.
          </p>
        </div>
      </header>

      {/* Control Filter Bar */}
      <div className="mt-4 p-4 border border-border/40 bg-zinc-950/50 rounded-lg flex flex-wrap gap-4 items-center justify-between shrink-0 font-mono text-xs">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search ID, cause..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-black border border-zinc-800 rounded pl-8 pr-3 py-1.5 w-48 text-[11px] text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-cyan-500/40"
            />
          </div>

          {/* Severity filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-zinc-500" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-black border border-zinc-850 rounded px-2.5 py-1 text-[11px] text-zinc-300 focus:outline-none focus:border-cyan-500/40"
            >
              <option value="ALL">All Severities</option>
              <option value="P0">P0</option>
              <option value="P1">P1</option>
              <option value="P2">P2</option>
              <option value="P3">P3</option>
            </select>
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-black border border-zinc-850 rounded px-2.5 py-1 text-[11px] text-zinc-300 focus:outline-none focus:border-cyan-500/40"
          >
            <option value="ALL">All States</option>
            <option value="active">Active Outages</option>
            <option value="resolved">Resolved</option>
            <option value="historical">Historical Database</option>
          </select>
        </div>

        {/* Highlight switches */}
        <div className="flex gap-4 items-center">
          <label className="flex items-center gap-1.5 cursor-pointer text-zinc-400 select-none">
            <input
              type="checkbox"
              checked={highlightCausal}
              onChange={(e) => setHighlightCausal(e.target.checked)}
              className="rounded accent-cyan-400 bg-zinc-900 border-zinc-800"
            />
            Causal Chain
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-zinc-400 select-none">
            <input
              type="checkbox"
              checked={highlightHistorical}
              onChange={(e) => setHighlightHistorical(e.target.checked)}
              className="rounded accent-purple-400 bg-zinc-900 border-zinc-800"
            />
            Historical Similarity
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-zinc-400 select-none">
            <input
              type="checkbox"
              checked={expandNeighbors}
              onChange={(e) => {
                setExpandNeighbors(e.target.checked)
                if (e.target.checked) setHighlightBlast(false)
              }}
              className="rounded accent-cyan-400 bg-zinc-900 border-zinc-800"
            />
            Expand Neighbors
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-zinc-400 select-none">
            <input
              type="checkbox"
              checked={highlightBlast}
              onChange={(e) => {
                setHighlightBlast(e.target.checked)
                if (e.target.checked) setExpandNeighbors(false)
              }}
              className="rounded accent-rose-400 bg-zinc-900 border-zinc-800"
            />
            Blast Radius
          </label>
        </div>
      </div>

      {/* Main Canvas Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 mt-6 min-h-0">
        
        {/* Canvas area */}
        <div className="flex-1 border border-border/40 bg-zinc-950/20 backdrop-blur-md rounded-lg p-4 relative overflow-hidden flex items-center justify-center min-h-[300px]">
          {loading ? (
            <div className="flex items-center gap-2 font-mono text-xs text-zinc-500">
              <RefreshCw className="h-4 w-4 animate-spin text-cyan-400" />
              Ingesting relationship linkages...
            </div>
          ) : (
            <div className="w-full h-full relative">
              {/* Pan Zoom drag handler wrapping SVG */}
              <div 
                className="w-full h-full cursor-grab active:cursor-grabbing relative overflow-hidden select-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <svg
                  ref={svgRef}
                  className="w-full h-full min-h-[420px]"
                  viewBox="0 0 800 400"
                >
                  {/* Background grid */}
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(63, 63, 70, 0.15)" strokeWidth="1" />
                    </pattern>
                    <marker
                      id="arrow"
                      viewBox="0 0 10 10"
                      refX="22"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(161, 161, 170, 0.4)" />
                    </marker>
                    <marker
                      id="arrow-causal"
                      viewBox="0 0 10 10"
                      refX="24"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
                    </marker>
                  </defs>
                  
                  <rect width="100%" height="100%" fill="url(#grid)" />

                  <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                    {/* Draw Edges */}
                    {edges.map((edge, idx) => {
                      const srcNode = nodes.find(n => n.id === edge.source)
                      const tgtNode = nodes.find(n => n.id === edge.target)
                      if (!srcNode || !tgtNode) return null

                      const isLit = isEdgeHighlighted(edge)
                      const isDimmed = isNodeDimmed(edge.source) || isNodeDimmed(edge.target)
                      
                      const isCausalEdge = edge.type === 'CAUSES' || edge.type === 'TRIGGERED'

                      return (
                        <g key={idx} className={cn("transition-opacity duration-300", isDimmed ? "opacity-15" : "opacity-100")}>
                          {/* Hover background line */}
                          <path
                            d={`M ${srcNode.x} ${srcNode.y} L ${tgtNode.x} ${tgtNode.y}`}
                            className="stroke-transparent stroke-[12] fill-none cursor-pointer"
                          >
                            <title>{`${edge.type}: ${edge.explanation}`}</title>
                          </path>
                          {/* Standard line */}
                          <path
                            d={`M ${srcNode.x} ${srcNode.y} L ${tgtNode.x} ${tgtNode.y}`}
                            className={cn(
                              "fill-none transition-all duration-500",
                              isLit ? "stroke-[2.5]" : "stroke-[1.2] opacity-50",
                              getEdgeColorClass(edge.type)
                            )}
                            markerEnd={isCausalEdge && isLit ? "url(#arrow-causal)" : "url(#arrow)"}
                            strokeDasharray={edge.type === 'SIMILAR_TO' ? '4 4' : undefined}
                          />

                          {/* Arrow animation on highlight causal path */}
                          {isLit && isCausalEdge && (
                            <path
                              d={`M ${srcNode.x} ${srcNode.y} L ${tgtNode.x} ${tgtNode.y}`}
                              className="stroke-red-500 stroke-[1.5] fill-none stroke-dasharray-[5_5] animate-marquee"
                              style={{ animationDuration: '4s' }}
                            />
                          )}
                        </g>
                      )
                    })}

                    {/* Draw Nodes */}
                    {nodes.map((node) => {
                      const inc = node.incident
                      const isSelected = selectedNodeId === node.id
                      const isHovered = hoveredNode?.id === node.id
                      const isDimmed = isNodeDimmed(node.id)
                      const isCritical = inc.severity === 'P0' && inc.status === 'active' && !node.isHistorical

                      return (
                        <g
                          key={node.id}
                          transform={`translate(${node.x}, ${node.y})`}
                          className={cn(
                            "cursor-pointer transition-all duration-300",
                            isDimmed ? "opacity-20 pointer-events-none" : "opacity-100"
                          )}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedNodeId(isSelected ? null : node.id)
                          }}
                          onMouseEnter={() => setHoveredNode(node)}
                          onMouseLeave={() => setHoveredNode(null)}
                        >
                          {/* Pulse Ring for critical active events */}
                          {isCritical && (
                            <circle
                              r="16"
                              className="stroke-rose-500/80 fill-none stroke-[2]"
                            >
                              <animate attributeName="r" values="16;40" dur="2s" repeatCount="indefinite" />
                              <animate attributeName="opacity" values="0.8;0" dur="2s" repeatCount="indefinite" />
                            </circle>
                          )}

                          {/* Outer Selection Glow */}
                          {(isSelected || isHovered) && (
                            <circle
                              r="20"
                              className={cn(
                                "fill-none stroke-2 animate-pulse",
                                node.isHistorical ? "stroke-purple-400" : inc.status === 'resolved' ? "stroke-emerald-400" : "stroke-cyan-400"
                              )}
                            />
                          )}

                          {/* Node Circle */}
                          <circle
                            r="15"
                            className={cn(
                              "stroke-[2] transition-colors fill-zinc-950",
                              getNodeColor(node)
                            )}
                          />

                          {/* Inner symbol status */}
                          {node.isHistorical ? (
                            <text y="3.5" textAnchor="middle" className="font-mono font-bold text-[9px] fill-purple-400">H</text>
                          ) : inc.status === 'resolved' ? (
                            <text y="3.5" textAnchor="middle" className="font-mono font-bold text-[9px] fill-emerald-400">✓</text>
                          ) : (
                            <text y="3.5" textAnchor="middle" className="font-mono font-bold text-[9px] fill-cyan-400">!</text>
                          )}

                          {/* ID Tag Label */}
                          <text
                            y="26"
                            textAnchor="middle"
                            className="font-mono text-[9px] font-semibold tracking-wider fill-slate-300 uppercase pointer-events-none select-none"
                          >
                            {inc.id}
                          </text>
                        </g>
                      )
                    })}
                  </g>
                </svg>

                {/* Hover overlay tooltip details card */}
                {hoveredNode && (
                  <div 
                    className="absolute bg-zinc-950/95 border border-zinc-800 rounded-lg p-4 font-mono text-[10px] w-64 shadow-2xl pointer-events-none space-y-2.5 text-zinc-300 z-50 transition-all"
                    style={{
                      left: Math.min(window.innerWidth - 300, (hoveredNode.x + pan.x) * zoom + 30),
                      top: Math.min(window.innerHeight - 250, (hoveredNode.y + pan.y) * zoom - 60)
                    }}
                  >
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5">
                      <span className="font-bold text-slate-100 flex items-center gap-1">
                        {hoveredNode.isHistorical ? (
                          <span className="bg-purple-950 border border-purple-500/20 text-purple-400 px-1 py-0.2 rounded text-[8px] uppercase">Historical</span>
                        ) : (
                          <span className="bg-cyan-950 border border-cyan-500/20 text-cyan-400 px-1 py-0.2 rounded text-[8px] uppercase">Active</span>
                        )}
                        {hoveredNode.id}
                      </span>
                      <span className={cn(
                        "text-[8px] font-bold px-1.5 py-0.2 rounded uppercase",
                        hoveredNode.incident.severity === 'P0' ? 'bg-rose-500 text-black' : 'bg-zinc-800 text-zinc-400'
                      )}>
                        {hoveredNode.incident.severity}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div>
                        <span className="text-zinc-500 uppercase text-[8px] block">Root Cause Assessment:</span>
                        <p className="leading-normal text-slate-200 line-clamp-2">{hoveredNode.incident.rootCause}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[9px] border-t border-zinc-900/60 pt-1.5">
                        <div>
                          <span className="text-zinc-500 uppercase text-[8px]">Confidence:</span>
                          <span className="text-emerald-400 font-bold block">{hoveredNode.incident.confidence}%</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 uppercase text-[8px]">MTTR:</span>
                          <span className="text-zinc-300 font-semibold block">
                            {hoveredNode.incident.recoveryIntelligence?.expectedMTTR || `${hoveredNode.incident.businessImpactData?.estimatedMTTR || 12}m`}
                          </span>
                        </div>
                      </div>

                      {hoveredNode.incident.summary && (
                        <div className="border-t border-zinc-900/60 pt-1.5">
                          <span className="text-zinc-500 uppercase text-[8px] block">AI Co-pilot Summary:</span>
                          <p className="text-zinc-400 text-[9px] leading-normal line-clamp-2">{hoveredNode.incident.summary}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Float Graph controls */}
              <div className="absolute bottom-4 left-4 flex gap-2">
                <button
                  onClick={() => setZoom(z => Math.min(2.5, z + 0.15))}
                  className="h-7 w-7 bg-zinc-900 border border-zinc-800 rounded text-zinc-300 hover:text-cyan-400 flex items-center justify-center"
                  title="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setZoom(z => Math.max(0.4, z - 0.15))}
                  className="h-7 w-7 bg-zinc-900 border border-zinc-800 rounded text-zinc-300 hover:text-cyan-400 flex items-center justify-center"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  onClick={handleReset}
                  className="h-7 w-7 bg-zinc-900 border border-zinc-800 rounded text-zinc-300 hover:text-cyan-400 flex items-center justify-center"
                  title="Reset Pan/Zoom"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Legend overlay */}
              <div className="absolute bottom-4 right-4 bg-zinc-950/80 border border-zinc-850 rounded px-3 py-2 text-[9px] font-mono uppercase text-zinc-500 select-none space-y-1.5">
                <div className="font-bold border-b border-zinc-900 pb-1 text-[8px] tracking-widest text-zinc-400">Node Status</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" /> P0 Active</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-500" /> P1/P2 Active</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Mitigating</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Resolved</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-purple-500" /> Historical</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Selected Node Inspector panel */}
        <aside className="w-full lg:w-80 shrink-0 border border-border/40 bg-zinc-950/40 rounded-lg p-5 flex flex-col justify-between font-mono">
          {selectedNode ? (
            <div className="space-y-5 flex-1 flex flex-col justify-between min-h-0">
              <div className="space-y-4 overflow-y-auto pr-1">
                {/* Node title */}
                <div className="border-b border-zinc-850 pb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{selectedNode.isHistorical ? 'Historical Outage' : 'Active Outage'}</span>
                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.2 rounded uppercase",
                      selectedNode.incident.status === 'resolved' ? 'bg-emerald-950 border border-emerald-500/30 text-emerald-400'
                      : selectedNode.incident.severity === 'P0' ? 'bg-rose-950 border border-rose-500/30 text-rose-400' : 'bg-orange-950 border border-orange-500/20 text-orange-400'
                    )}>
                      {selectedNode.incident.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-100 uppercase">{selectedNode.incident.title}</h3>
                  <span className="text-[10px] text-zinc-500 mt-1 block">ID: {selectedNode.id} | Severity: {selectedNode.incident.severity}</span>
                </div>

                {/* Root cause and services */}
                <div className="space-y-3.5 text-xs">
                  <div>
                    <span className="text-zinc-500 text-[10px] uppercase tracking-wider block mb-1">Diagnostic Root Cause</span>
                    <div className="p-3 bg-black/40 border border-zinc-900 rounded text-slate-300 leading-relaxed text-[11px]">
                      {selectedNode.incident.rootCause}
                    </div>
                  </div>

                  <div>
                    <span className="text-zinc-500 text-[10px] uppercase tracking-wider block mb-1">Affected Services</span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedNode.incident.affectedServices.map(s => (
                        <span key={s} className="bg-zinc-900 border border-zinc-800 text-slate-300 px-2 py-0.5 rounded text-[10px]">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {selectedNode.incident.summary && (
                    <div>
                      <span className="text-zinc-500 text-[10px] uppercase tracking-wider block mb-1">AI Context Summary</span>
                      <p className="text-zinc-400 text-[11px] leading-normal font-sans">
                        {selectedNode.incident.summary}
                      </p>
                    </div>
                  )}

                  {/* Playbook executed in recovery */}
                  {selectedNode.incident.recoveryPlan && selectedNode.incident.recoveryPlan.length > 0 && (
                    <div>
                      <span className="text-zinc-500 text-[10px] uppercase tracking-wider block mb-1.5">Remediation Playbook</span>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {selectedNode.incident.recoveryPlan.map((step, sIdx) => (
                          <div key={sIdx} className="bg-zinc-900/40 border border-zinc-850 p-2 rounded text-[10px] leading-relaxed">
                            <span className="text-zinc-500 font-bold block mb-0.5">Step {sIdx+1}: {step.description}</span>
                            <code className="text-cyan-300/80 font-mono text-[9px] break-all select-all block">{step.command}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Graph Neighborhood inspector */}
              <div className="mt-5 pt-4 border-t border-zinc-900/80 space-y-3">
                <span className="text-zinc-500 text-[10px] uppercase tracking-wider block">Graph Connections</span>
                <div className="space-y-1.5 text-[10px]">
                  {edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).slice(0, 3).map((edge, eIdx) => {
                    const isSource = edge.source === selectedNode.id
                    const relPartner = isSource ? edge.target : edge.source
                    return (
                      <div key={eIdx} className="flex justify-between items-center py-1 border-b border-zinc-900/60 text-zinc-400">
                        <span>
                          {isSource ? '➔' : '←'} <span className="text-zinc-500">{edge.type}</span> {isSource ? 'to' : 'from'} <span className="font-bold text-slate-300">{relPartner}</span>
                        </span>
                        <span className="text-emerald-400 font-bold">{edge.confidence}%</span>
                      </div>
                    )
                  })}
                  {edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length === 0 && (
                    <span className="text-zinc-600 block italic py-2 text-[10px]">No graph linkages generated yet for this node.</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-600 py-12">
              <HelpCircle className="h-8 w-8 text-zinc-700 mb-2" />
              <p className="text-[10px] uppercase leading-normal">Select an incident node in the relationship canvas to inspect topology linkages and AI summaries</p>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-zinc-900/60 text-[9px] text-zinc-500 leading-normal font-sans">
            Use the mouse wheel or double-click to scale the graph canvas. Drag coordinates to pan. Click nodes to trace causality paths and blast radius boundaries.
          </div>
        </aside>
      </div>
    </div>
  )
}
