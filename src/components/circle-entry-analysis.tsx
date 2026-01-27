"use client"

import type { FC } from "react"
import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { CircleEntry } from "@/lib/types"

const StatDisplay: FC<{
  label: string;
  entries: number;
  success: number;
  efficiency: string;
}> = ({ label, entries, success, efficiency }) => (
  <div className="text-center bg-card/75 backdrop-blur-sm p-1 rounded-md">
    <h4 className="font-semibold text-base md:text-lg text-foreground">{label}</h4>
    <p className="text-xs md:text-sm text-muted-foreground">진입: {entries}회</p>
    <p className="text-xs md:text-sm text-muted-foreground">Success: {success}회</p>
    <p className="text-sm md:text-base font-bold text-foreground">효율: {efficiency}</p>
  </div>
);

interface CircleEntryAnalysisProps {
  entries: CircleEntry[]
}

export function CircleEntryAnalysis({ entries }: CircleEntryAnalysisProps) {
  const analysis = useMemo(() => {
    const channels = {
      Left: { entries: 0, success: 0 },
      Center: { entries: 0, success: 0 },
      Right: { entries: 0, success: 0 },
    }

    for (const entry of entries) {
      if (channels[entry.channel]) {
        channels[entry.channel].entries++
        if (entry.outcome !== "No Shot") {
          channels[entry.channel].success++
        }
      }
    }

    const calculateEfficiency = (success: number, entries: number) =>
      entries > 0 ? `${Math.round((success / entries) * 100)}%` : "0%"

    return {
      left: { ...channels.Left, efficiency: calculateEfficiency(channels.Left.success, channels.Left.entries) },
      center: { ...channels.Center, efficiency: calculateEfficiency(channels.Center.success, channels.Center.entries) },
      right: { ...channels.Right, efficiency: calculateEfficiency(channels.Right.success, channels.Right.entries) },
    }
  }, [entries])
  
  // Dimensions based on meters from the provided Python code
  const fieldW = 55.0;
  const fieldH = 25.0;
  const cx = fieldW / 2;

  const goalW = 3.66;
  const goalDepth = 1.2;
  const goalPostLeft = cx - goalW / 2;
  const goalPostRight = cx + goalW / 2;

  const circleRadius = 14.63;
  const circleStraightLineY = fieldH - circleRadius;

  const dashedRadius = circleRadius + 5.0;
  const dashedStraightLineY = fieldH - dashedRadius;

  const penaltySpotY = fieldH - 6.475;

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle>써클 진입 분석</CardTitle>
        <CardDescription>공격 채널별 진입 및 성공 효율 (공격 방향: 아래 → 위)</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center items-center p-2 sm:p-4 md:p-6">
        <div className="w-full max-w-3xl">
           <svg viewBox={`-5 -5 ${fieldW + 10} ${fieldH + 15}`} preserveAspectRatio="xMidYMin">
            <defs>
                <marker id="arrowhead" markerWidth="5" markerHeight="3.5" refX="4.5" refY="1.75" orient="auto">
                    <polygon points="0 0, 5 1.75, 0 3.5" fill="hsl(var(--accent))" />
                </marker>
            </defs>
            
            {/* 1. Background Geometry Layer */}
            <g stroke="hsl(var(--foreground))" strokeWidth="0.4" fill="none">
              {/* Pitch half boundary */}
              <rect x="0" y="0" width={fieldW} height={fieldH} />
              
              {/* Goal */}
              <rect x={goalPostLeft} y={fieldH} width={goalW} height={goalDepth} />
              
              {/* Shooting Circle Path (D-Zone) */}
              <path d={`
                  M ${goalPostLeft - circleRadius}, ${fieldH}
                  A ${circleRadius},${circleRadius} 0 0 1 ${goalPostLeft},${circleStraightLineY}
                  L ${goalPostRight},${circleStraightLineY}
                  A ${circleRadius},${circleRadius} 0 0 1 ${goalPostRight + circleRadius},${fieldH}
              `} />
              
              {/* 5m Dashed Line Path */}
               <path d={`
                  M ${goalPostLeft - dashedRadius}, ${fieldH}
                  A ${dashedRadius},${dashedRadius} 0 0 1 ${goalPostLeft},${dashedStraightLineY}
                  L ${goalPostRight},${dashedStraightLineY}
                  A ${dashedRadius},${dashedRadius} 0 0 1 ${goalPostRight + dashedRadius},${fieldH}
              `} strokeDasharray="0.8, 0.8" />

              
              {/* Penalty Spot */}
              <circle cx={cx} cy={penaltySpotY} r="0.4" fill="hsl(var(--foreground))" stroke="none"/>

              {/* Penalty Corner Markings */}
              <line x1={cx - 3} y1={fieldH} x2={cx-3} y2={fieldH-0.5} />
              <line x1={cx + 3} y1={fieldH} x2={cx+3} y2={fieldH-0.5} />
              <line x1={cx - 6} y1={fieldH} x2={cx-6} y2={fieldH-0.5} />
              <line x1={cx + 6} y1={fieldH} x2={cx+6} y2={fieldH-0.5} />

            </g>

            {/* 2. Data Visualization Layer */}
            <g>
              {/* Arrows */}
              <line x1="2.75" y1="13" x2="11.0" y2="21.0" stroke="hsl(var(--accent))" strokeWidth="1.2" markerEnd="url(#arrowhead)" />
              <line x1="27.5" y1="0" x2="27.5" y2="11.0" stroke="hsl(var(--accent))" strokeWidth="1.2" markerEnd="url(#arrowhead)" />
              <line x1="52.25" y1="13" x2="44.0" y2="21.0" stroke="hsl(var(--accent))" strokeWidth="1.2" markerEnd="url(#arrowhead)" />

              {/* Data Text using foreignObject for HTML content */}
              <foreignObject x="1" y="4" width="22" height="15">
                <StatDisplay
                  label="Left"
                  entries={analysis.left.entries}
                  success={analysis.left.success}
                  efficiency={analysis.left.efficiency}
                />
              </foreignObject>
              
              <foreignObject x={cx - 11} y="13" width="22" height="15">
                <StatDisplay
                  label="Center"
                  entries={analysis.center.entries}
                  success={analysis.center.success}
                  efficiency={analysis.center.efficiency}
                />
              </foreignObject>
              
              <foreignObject x={fieldW - 23} y="4" width="22" height="15">
                <StatDisplay
                  label="Right"
                  entries={analysis.right.entries}
                  success={analysis.right.success}
                  efficiency={analysis.right.efficiency}
                />
              </foreignObject>
            </g>
          </svg>
        </div>
      </CardContent>
    </Card>
  )
}
