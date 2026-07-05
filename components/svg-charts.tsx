'use client'

import React from 'react'

// 1. Reusable Area Chart Component (Premium custom SVG)
interface AreaChartProps {
  data: number[]
  labels?: string[]
  height?: number
  colorClassName?: string
  fillColorClassName?: string
  gridCount?: number
  minVal?: number
  maxVal?: number
}

export function AreaChart({
  data,
  labels,
  height = 120,
  colorClassName = 'stroke-cyan-500',
  fillColorClassName = 'fill-cyan-500/10',
  gridCount = 4,
  minVal,
  maxVal
}: AreaChartProps) {
  const pointsCount = data.length
  if (pointsCount === 0) return <div className="h-full w-full bg-zinc-900 animate-pulse" />

  const dataMin = minVal !== undefined ? minVal : Math.min(...data)
  const dataMax = maxVal !== undefined ? maxVal : Math.max(...data)
  const range = dataMax - dataMin === 0 ? 1 : dataMax - dataMin

  const width = 500
  const paddingX = 10
  const paddingY = 15
  const chartHeight = height - paddingY * 2
  const chartWidth = width - paddingX * 2

  // Map values to coordinates
  const coords = data.map((val, idx) => {
    const x = paddingX + (idx / (pointsCount - 1)) * chartWidth
    const y = paddingY + chartHeight - ((val - dataMin) / range) * chartHeight
    return { x, y }
  })

  // Create path strings
  const linePath = coords.reduce((acc, c, idx) => {
    return acc + (idx === 0 ? `M ${c.x} ${c.y}` : ` L ${c.x} ${c.y}`)
  }, '')

  const fillPath = coords.length > 0
    ? `${linePath} L ${coords[coords.length - 1].x} ${height - paddingY} L ${coords[0].x} ${height - paddingY} Z`
    : ''

  // Generate gridlines
  const grids = []
  for (let i = 0; i <= gridCount; i++) {
    const yVal = paddingY + (i / gridCount) * chartHeight
    grids.push(yVal)
  }

  return (
    <div className="relative w-full" style={{ height: `${height}px` }}>
      <svg className="h-full w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {/* Gridlines */}
        {grids.map((y, idx) => (
          <line
            key={idx}
            x1="0"
            y1={y}
            x2={width}
            y2={y}
            className="stroke-zinc-800/80 stroke-1"
            strokeDasharray="4 4"
          />
        ))}

        {/* Shaded Area */}
        <path d={fillPath} className={fillColorClassName} />

        {/* Trendline */}
        <path
          d={linePath}
          fill="none"
          className={colorClassName}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {coords.map((c, idx) => {
          if (idx === coords.length - 1 || idx === 0) {
            return (
              <circle
                key={idx}
                cx={c.x}
                cy={c.y}
                r="3"
                className={colorClassName.replace('stroke', 'fill') + ' stroke-zinc-950 stroke-1'}
              />
            )
          }
          return null
        })}
      </svg>
    </div>
  )
}

// 2. Incident Heatmap Component (7x24 grid representing incident storm volume)
interface HeatmapProps {
  intensity: 'low' | 'medium' | 'high'
}

export function IncidentHeatmap({ intensity }: HeatmapProps) {
  // Generate pseudo-random intensity matrix
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
  const hours = Array.from({ length: 24 }, (_, i) => i)

  const getWeight = (dayIdx: number, hour: number) => {
    // Inject some fixed high zones for specific hours (e.g. deployments at 14:00, cron jobs at 03:00)
    let w = (dayIdx * 3 + hour * 7) % 5
    if (hour === 14 || hour === 15) w += 2
    if (hour === 3) w += 1
    if (intensity === 'high') w += 2
    if (intensity === 'low') w = Math.max(0, w - 2)
    return Math.min(4, Math.max(0, w))
  }

  const colorMap = [
    'bg-zinc-900/60 border-zinc-800/40', // 0: None
    'bg-cyan-950/40 border-cyan-800/20 text-cyan-900', // 1: Low
    'bg-cyan-900/60 border-cyan-700/30 text-cyan-700', // 2: Med
    'bg-cyan-600/60 border-cyan-500/30 text-cyan-500', // 3: High
    'bg-cyan-400 border-cyan-300 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.4)]' // 4: Critical
  ]

  return (
    <div className="w-full space-y-2 overflow-x-auto select-none">
      <div className="min-w-[640px] space-y-1">
        {days.map((day, dayIdx) => (
          <div key={day} className="flex items-center gap-1">
            <span className="w-8 font-mono text-[9px] text-zinc-500 font-bold">{day}</span>
            <div className="flex flex-1 gap-1">
              {hours.map((hour) => {
                const weight = getWeight(dayIdx, hour)
                return (
                  <div
                    key={hour}
                    className={`h-4 flex-1 rounded-[2px] border ${colorMap[weight]} transition-colors duration-300`}
                    title={`Day: ${day}, Hour: ${hour}:00 - Alert Count Category: ${weight}`}
                  />
                )
              })}
            </div>
          </div>
        ))}
        {/* Hour legends */}
        <div className="flex gap-1 pl-9 pt-1">
          {hours.map((hour) => (
            <span key={hour} className="flex-1 font-mono text-[8px] text-zinc-600 text-center">
              {hour % 4 === 0 ? `${hour}h` : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// 3. Mini Sparkline Component (For card widgets)
export function Sparkline({ data, height = 30, color = 'stroke-cyan-400' }: { data: number[]; height?: number; color?: string }) {
  if (data.length === 0) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min === 0 ? 1 : max - min

  const w = 120
  const pts = data.map((val, i) => {
    const x = (i / (data.length - 1)) * w
    const y = height - ((val - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={w} height={height} className="overflow-visible">
      <polyline
        fill="none"
        className={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  )
}

// 4. Circle Radial Progress Component (For MTTR/MTTD SLAs)
interface RadialProgressProps {
  value: number // 0 to 100
  size?: number
  strokeWidth?: number
  label?: string
  sublabel?: string
  colorClass?: string
}

export function RadialGauge({
  value,
  size = 120,
  strokeWidth = 8,
  label,
  sublabel,
  colorClass = 'stroke-cyan-500'
}: RadialProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-zinc-800/80 fill-none"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={`${colorClass} fill-none transition-all duration-1000 ease-out`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      {/* Center content */}
      <div className="absolute text-center flex flex-col items-center">
        {label && <span className="font-mono text-lg font-bold text-slate-100">{label}</span>}
        {sublabel && <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{sublabel}</span>}
      </div>
    </div>
  )
}
