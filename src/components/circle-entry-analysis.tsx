
"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export type CircleEntryZone5 = 'FarLeft' | 'MidLeft' | 'Center' | 'MidRight' | 'FarRight'

export interface CircleEntry {
  team: string
  channel: 'Left' | 'Center' | 'Right'
  zone5: CircleEntryZone5
  outcome: 'Goal' | 'Shot On Target' | 'Shot Missed' | 'No Shot'
}

export type CircleEntryZoneMode = '3' | '5'

interface CircleEntryAnalysisProps {
  entries: CircleEntry[]
  teamName: string
  teamColor: string
  /** '3'(좌/중/우) 또는 '5'(좌_25/CE_L 45/중_25/CE_R 45/우_25). 기본 '3'. */
  mode?: CircleEntryZoneMode
}

// 3방향(단순) 화면 — 원래 있던 좌/중/우 배치를 그대로 유지합니다. 화살표는 모두 필드 안쪽
// 지점(y1=17)에서 시작해 서클 쪽으로 들어갑니다.
const ZONES_3 = [
  { key: 'Left' as const, label: '좌측', labelEn: '(Left)', textX: 6.5, x1: 2.75, y1: 17, x2: 11.0, y2: 8 },
  { key: 'Center' as const, label: '중앙', labelEn: '(Center)', textX: 27.5, x1: 27.5, y1: 17, x2: 27.5, y2: 6 },
  { key: 'Right' as const, label: '우측', labelEn: '(Right)', textX: 48, x1: 52.25, y1: 17, x2: 44.0, y2: 8 },
]

// 5방향(세부) — 태깅 라벨 기준 왼쪽→오른쪽: 좌_25 - CE_L 45 - 중_25 - CE_R 45 - 우_25.
// 양 끝(좌_25/우_25)은 엔드라인(y1=25, 필드 맨 아래)에 붙여서 시작하고, 화살표 끝은 골대
// 방향(위쪽)을 바라보게 함 — 엔드라인을 타고 올라오는 침투를 표현. 가운데 3개(CE_L 45/중_25/
// CE_R 45)는 3방향 화살표와 동일한 시작 높이(y1=17)·도착 지점을 그대로 씁니다.
const ZONES_5 = [
  { key: 'FarLeft' as const, label: '좌_25', labelEn: '', textX: 4, x1: 2.5, y1: 24, x2: 8, y2: 9 },
  { key: 'MidLeft' as const, label: 'CE_L 45', labelEn: '', textX: 17, x1: 17, y1: 17, x2: 11.0, y2: 8 },
  { key: 'Center' as const, label: '중_25', labelEn: '', textX: 27.5, x1: 27.5, y1: 17, x2: 27.5, y2: 6 },
  { key: 'MidRight' as const, label: 'CE_R 45', labelEn: '', textX: 38, x1: 38, y1: 17, x2: 44.0, y2: 8 },
  { key: 'FarRight' as const, label: '우_25', labelEn: '', textX: 51, x1: 52.5, y1: 24, x2: 47, y2: 9 },
]

function computeStats<K extends string>(entries: CircleEntry[], getKey: (e: CircleEntry) => K, keys: readonly K[]) {
  const stats = {} as Record<K, { entries: number; success: number; eff: number }>
  keys.forEach(k => { stats[k] = { entries: 0, success: 0, eff: 0 } })
  for (const entry of entries) {
    const k = getKey(entry)
    if (!stats[k]) continue
    stats[k].entries++
    if (['Goal', 'Shot On Target', 'Shot Missed'].includes(entry.outcome)) stats[k].success++
  }
  keys.forEach(k => { stats[k].eff = stats[k].entries > 0 ? Math.round((stats[k].success / stats[k].entries) * 100) : 0 })
  return stats
}

export function CircleEntryAnalysis({ entries, teamName, teamColor, mode = '3' }: CircleEntryAnalysisProps) {
  const stats3 = useMemo(() => computeStats(entries, e => e.channel, ['Left', 'Center', 'Right'] as const), [entries])
  const stats5 = useMemo(() => computeStats(entries, e => e.zone5, ['FarLeft', 'MidLeft', 'Center', 'MidRight', 'FarRight'] as const), [entries])

  const zones = mode === '5' ? ZONES_5 : ZONES_3
  const stats: Record<string, { entries: number; success: number; eff: number }> = mode === '5' ? stats5 : stats3

  const FIELD_W = 55.0;
  const FIELD_H = 25.0;
  const TOP_PADDING = 4.0;
  const CX = FIELD_W / 2;
  const toSvgY = (diagramY: number) => diagramY + TOP_PADDING;

  const markerId = `arrow-head-${teamName.replace(/\s+/g, '-')}-${mode}`;
  const fontSize = mode === '5' ? '1.0px' : '1.2px';

  return (
    <Card className="h-full border-2 break-inside-avoid">
      <CardHeader>
        <CardTitle>{teamName} 서클 진입 분석</CardTitle>
        <CardDescription>공격 서클 진입 방향 및 효율 (골대: 상단) — {mode === '5' ? '5방향' : '3방향'}</CardDescription>
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
              {/* 배경 점선 명도 낮춤 */}
              <path
                d={`
                  M ${CX - 1.83 - 19.63} ${toSvgY(0)}
                  A 19.63 19.63 0 0 0 ${CX - 1.83} ${toSvgY(19.63)}
                  L ${CX + 1.83} ${toSvgY(19.63)}
                  A 19.63 19.63 0 0 0 ${CX + 1.83 + 19.63} ${toSvgY(0)}
                `}
                strokeWidth="0.4"
                strokeDasharray="1, 1"
                opacity="0.25"
              />
              <circle cx={CX} cy={toSvgY(6.47)} r="0.15" fill="black" stroke="none" />
            </g>

            <g stroke={teamColor} strokeWidth="0.8" markerEnd={`url(#${markerId})`} strokeOpacity={0.8}>
              {zones.map(z => (
                <line key={z.key} x1={z.x1} y1={toSvgY(z.y1)} x2={z.x2} y2={toSvgY(z.y2)} />
              ))}
            </g>

            <g className="fill-black" style={{ fontSize, textAnchor: 'middle' }}>
              {zones.map(z => (
                <text key={z.key} x={z.textX} y={toSvgY(19.5)}>
                  <tspan x={z.textX} dy="0" fontWeight="bold">{z.label}{z.labelEn ? ` ${z.labelEn}` : ''}</tspan>
                  <tspan x={z.textX} dy="1.6">진입: <tspan fontWeight="bold">{stats[z.key]?.entries ?? 0}</tspan>회</tspan>
                  <tspan x={z.textX} dy="1.6">성공: <tspan fontWeight="bold">{stats[z.key]?.success ?? 0}</tspan>회</tspan>
                  <tspan x={z.textX} dy="1.6" fill="#d62728">효율: <tspan fontWeight="bold">{stats[z.key]?.eff ?? 0}</tspan>%</tspan>
                </text>
              ))}
            </g>
          </svg>
        </div>
      </CardContent>
    </Card>
  )
}
