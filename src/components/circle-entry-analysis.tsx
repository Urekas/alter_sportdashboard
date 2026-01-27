"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

// --- Type Definition ---
export interface CircleEntry {
  id: string
  team: string
  quarter: number
  time: string
  channel: 'Left' | 'Center' | 'Right'
  outcome: 'Goal' | 'Shot On Target' | 'Shot Missed' | 'Turnover' | 'Foul'
}

interface CircleEntryAnalysisProps {
  entries: CircleEntry[]
  teamName: string
}

export function CircleEntryAnalysis({ entries, teamName }: CircleEntryAnalysisProps) {
  const analysis = useMemo(() => {
    const stats: Record<'Left' | 'Center' | 'Right', { entries: number; success: number }> = {
      Left: { entries: 0, success: 0 },
      Center: { entries: 0, success: 0 },
      Right: { entries: 0, success: 0 },
    };

    for (const entry of entries) {
      if (stats[entry.channel]) {
        stats[entry.channel].entries++;
        if (['Goal', 'Shot On Target', 'Shot Missed', 'PC'].includes(entry.outcome)) {
          stats[entry.channel].success++;
        }
      }
    }

    const calcEff = (succ: number, tot: number) => tot > 0 ? Math.round((succ / tot) * 100) : 0;

    return {
      Left: { ...stats.Left, eff: calcEff(stats.Left.success, stats.Left.entries) },
      Center: { ...stats.Center, eff: calcEff(stats.Center.success, stats.Center.entries) },
      Right: { ...stats.Right, eff: calcEff(stats.Right.success, stats.Right.entries) },
    };
  }, [entries]);

  // SVG 좌표계 상수 (단위: m)
  const FIELD_W = 55.0;
  const FIELD_H = 25.0;
  const TOP_PADDING = 4.0;
  
  const CX = FIELD_W / 2;
  
  // Y축 변환 (SVG 좌표계 직접 사용, 위쪽이 0)
  // 골대가 위(y=TOP_PADDING)에, 25야드 라인이 아래(y=TOP_PADDING+25)에 위치
  const toSvgY = (diagramY: number) => diagramY + TOP_PADDING;

  return (
    <Card className="h-full border-2">
      <CardHeader>
        <CardTitle>{teamName} 서클 진입 분석</CardTitle>
        <CardDescription>Attacking Circle Entries (Goal at Top)</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center items-center p-4">
        
        <div className="relative w-full max-w-2xl aspect-[55/29]">
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${FIELD_W} ${FIELD_H + TOP_PADDING}`}
            className="w-full h-full overflow-visible select-none bg-white"
          >
            <defs>
              <marker id="arrow-head-blue" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(70, 130, 180, 0.9)" />
              </marker>
            </defs>

            {/* --- 1. Field Lines --- */}
            <g fill="none" stroke="black" strokeLinecap="round">
              
              {/* Outer Box (25y line to goal line) */}
              <rect x="0" y={toSvgY(0)} width={FIELD_W} height={FIELD_H} strokeWidth="0.5" />

              {/* Goal */}
              <rect 
                x={CX - 1.83} 
                y={toSvgY(0) - 1.2} 
                width={3.66} 
                height={1.2} 
                strokeWidth="0.5" 
              />

              {/* Back Line (Goal Line) */}
              <line x1={0} y1={toSvgY(0)} x2={FIELD_W} y2={toSvgY(0)} strokeWidth="0.5" />

              {/* Ticks on goal line */}
              {[-6, -3, 3, 6].map((dx) => (
                <line 
                  key={dx} 
                  x1={CX + dx} y1={toSvgY(0)} 
                  x2={CX + dx} y2={toSvgY(0) - 0.8} // 바깥쪽으로 눈금
                  strokeWidth="0.3" 
                />
              ))}

              {/* --- Shooting Circle (D-zone) --- */}
              <path
                d={`
                  M ${CX - 1.83 - 14.63} ${toSvgY(0)}
                  A 14.63 14.63 0 0 1 ${CX + 1.83 + 14.63} ${toSvgY(0)}
                `}
                strokeWidth="0.6"
              />
              <line x1={CX - 1.83 - 14.63} y1={toSvgY(0)} x2={CX - 1.83 - 14.63} y2={toSvgY(14.63)} strokeWidth="0.6" />
              <line x1={CX + 1.83 + 14.63} y1={toSvgY(0)} x2={CX + 1.83 + 14.63} y2={toSvgY(14.63)} strokeWidth="0.6" />


              {/* --- 5m Dashed Line --- */}
              <path
                d={`
                  M ${CX - 1.83 - 19.63} ${toSvgY(0)}
                  A 19.63 19.63 0 0 1 ${CX + 1.83 + 19.63} ${toSvgY(0)}
                `}
                strokeWidth="0.4"
                strokeDasharray="1, 1"
              />

              {/* Penalty Spot */}
              <circle cx={CX} cy={toSvgY(6.47)} r="0.15" fill="black" stroke="none" />
            </g>

            {/* --- 2. Arrows --- */}
            <g stroke="rgba(70, 130, 180, 0.7)" strokeWidth="0.8" markerEnd="url(#arrow-head-blue)">
              {/* Left Arrow */}
              <line x1="2.75" y1={toSvgY(13)} x2="11.0" y2={toSvgY(4)} />
              
              {/* Center Arrow */}
              <line x1="27.5" y1={toSvgY(9)} x2="27.5" y2={toSvgY(1)} />
              
              {/* Right Arrow */}
              <line x1="52.25" y1={toSvgY(13)} x2="44.0" y2={toSvgY(4)} />
            </g>

            {/* --- 3. Stats Text Overlay --- */}
            <g className="fill-black" style={{ fontSize: '1.1px', textAnchor: 'middle' }}>
              {/* Left Text */}
              <text x="6.5" y={toSvgY(15)}>
                <tspan x="6.5" dy="0" fontWeight="bold">Left</tspan>
                <tspan x="6.5" dy="1.6" fontWeight="normal">진입: {analysis.Left.entries}회</tspan>
                <tspan x="6.5" dy="1.6" fontWeight="normal">Success(슈팅/pc/득점): {analysis.Left.success}회</tspan>
                <tspan x="6.5" dy="1.6" fontWeight="bold" fill="#d62728">효율: {analysis.Left.eff}%</tspan>
              </text>

              {/* Center Text */}
              <text x="27.5" y={toSvgY(11)}>
                <tspan x="27.5" dy="0" fontWeight="bold">Center</tspan>
                <tspan x="27.5" dy="1.6" fontWeight="normal">진입: {analysis.Center.entries}회</tspan>
                <tspan x="27.5" dy="1.6" fontWeight="normal">Success(슈팅/pc/득점): {analysis.Center.success}회</tspan>
                <tspan x="27.5" dy="1.6" fontWeight="bold" fill="#d62728">효율: {analysis.Center.eff}%</tspan>
              </text>

              {/* Right Text */}
              <text x="48" y={toSvgY(15)}>
                <tspan x="48" dy="0" fontWeight="bold">Right</tspan>
                <tspan x="48" dy="1.6" fontWeight="normal">진입: {analysis.Right.entries}회</tspan>
                <tspan x="48" dy="1.6" fontWeight="normal">Success(슈팅/pc/득점): {analysis.Right.success}회</tspan>
                <tspan x="48" dy="1.6" fontWeight="bold" fill="#d62728">효율: {analysis.Right.eff}%</tspan>
              </text>
            </g>

          </svg>
        </div>
      </CardContent>
    </Card>
  )
}
