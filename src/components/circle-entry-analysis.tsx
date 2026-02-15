
"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export interface CircleEntry {
  team: string
  channel: 'Left' | 'Center' | 'Right'
  outcome: 'Goal' | 'Shot On Target' | 'Shot Missed' | 'No Shot'
}

interface CircleEntryAnalysisProps {
  entries: CircleEntry[]
  teamName: string
  teamColor: string
}

export function CircleEntryAnalysis({ entries, teamName, teamColor }: CircleEntryAnalysisProps) {
  const analysis = useMemo(() => {
    const stats: Record<'Left' | 'Center' | 'Right', { entries: number; success: number }> = {
      Left: { entries: 0, success: 0 },
      Center: { entries: 0, success: 0 },
      Right: { entries: 0, success: 0 },
    };

    for (const entry of entries) {
      if (stats[entry.channel]) {
        stats[entry.channel].entries++;
        if (['Goal', 'Shot On Target', 'Shot Missed'].includes(entry.outcome)) {
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

  const FIELD_W = 55.0;
  const FIELD_H = 25.0;
  const TOP_PADDING = 4.0;
  const CX = FIELD_W / 2;
  const toSvgY = (diagramY: number) => diagramY + TOP_PADDING;

  const markerId = `arrow-head-${teamName.replace(/\s+/g, '-')}`;

  return (
    <Card className="h-full border-2">
      <CardHeader>
        <CardTitle>{teamName} 서클 진입 분석</CardTitle>
        <CardDescription>공격 서클 진입 방향 및 효율 (골대: 상단)</CardDescription>
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
              <marker id={markerId} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={teamColor} />
              </marker>
            </defs>

            <g fill="none" stroke="black" strokeLinecap="round">
              <rect x="0" y={toSvgY(0)} width={FIELD_W} height={FIELD_H} strokeWidth="0.5" />
              <rect x={CX - 1.83} y={toSvgY(0) - 1.2} width={3.66} height={1.2} strokeWidth="0.5" />
              <line x1={0} y1={toSvgY(0)} x2={FIELD_W} y2={toSvgY(0)} strokeWidth="0.5" />
              <path
                d={`
                  M ${CX - 1.83 - 14.63} ${toSvgY(0)}
                  A 14.63 14.63 0 0 0 ${CX - 1.83} ${toSvgY(14.63)}
                  L ${CX + 1.83} ${toSvgY(14.63)}
                  A 14.63 14.63 0 0 0 ${CX + 1.83 + 14.63} ${toSvgY(0)}
                `}
                strokeWidth="0.6"
              />
              <path
                d={`
                  M ${CX - 1.83 - 19.63} ${toSvgY(0)}
                  A 19.63 19.63 0 0 0 ${CX - 1.83} ${toSvgY(19.63)}
                  L ${CX + 1.83} ${toSvgY(19.63)}
                  A 19.63 19.63 0 0 0 ${CX + 1.83 + 19.63} ${toSvgY(0)}
                `}
                strokeWidth="0.4"
                strokeDasharray="1, 1"
              />
              <circle cx={CX} cy={toSvgY(6.47)} r="0.15" fill="black" stroke="none" />
            </g>

            <g stroke={teamColor} strokeWidth="0.8" markerEnd={`url(#${markerId})`} strokeOpacity={0.8}>
              <line x1="2.75" y1={toSvgY(17)} x2="11.0" y2={toSvgY(8)} />
              <line x1="27.5" y1={toSvgY(17)} x2="27.5" y2={toSvgY(6)} />
              <line x1="52.25" y1={toSvgY(17)} x2="44.0" y2={toSvgY(8)} />
            </g>

            <g className="fill-black" style={{ fontSize: '1.1px', textAnchor: 'middle' }}>
              <text x="6.5" y={toSvgY(19)}>
                <tspan x="6.5" dy="0" fontWeight="bold">좌측 (Left)</tspan>
                <tspan x="6.5" dy="1.6" fontWeight="bold">진입: {analysis.Left.entries}회</tspan>
                <tspan x="6.5" dy="1.6" fontWeight="bold">성공: {analysis.Left.success}회</tspan>
                <tspan x="6.5" dy="1.6" fontWeight="bold" fill="#d62728">효율: {analysis.Left.eff}%</tspan>
              </text>

              <text x="27.5" y={toSvgY(19)}>
                <tspan x="27.5" dy="0" fontWeight="bold">중앙 (Center)</tspan>
                <tspan x="27.5" dy="1.6" fontWeight="bold">진입: {analysis.Center.entries}회</tspan>
                <tspan x="27.5" dy="1.6" fontWeight="bold">성공: {analysis.Center.success}회</tspan>
                <tspan x="27.5" dy="1.6" fontWeight="bold" fill="#d62728">효율: {analysis.Center.eff}%</tspan>
              </text>

              <text x="48" y={toSvgY(19)}>
                <tspan x="48" dy="0" fontWeight="bold">우측 (Right)</tspan>
                <tspan x="48" dy="1.6" fontWeight="bold">진입: {analysis.Right.entries}회</tspan>
                <tspan x="48" dy="1.6" fontWeight="bold">성공: {analysis.Right.success}회</tspan>
                <tspan x="48" dy="1.6" fontWeight="bold" fill="#d62728">효율: {analysis.Right.eff}%</tspan>
              </text>
            </g>
          </svg>
        </div>
      </CardContent>
    </Card>
  )
}
