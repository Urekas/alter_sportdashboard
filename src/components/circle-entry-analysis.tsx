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
  // 1. 데이터 집계
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

  // 2. 파이썬 코드 기반 상수 (단위: m)
  const FIELD_W = 55.0;
  const FIELD_H = 25.0;
  const TOP_PADDING = 5.0; // 골대 표시를 위한 상단 여백
  
  // 좌표 계산 (Center X)
  const CX = FIELD_W / 2; // 27.5
  
  // Y축 변환 (파이썬 좌표 -> SVG 좌표)
  // 파이썬: y=25(Goal Line) ~ y=0(25y Line)
  // SVG: y=TOP_PADDING(Goal Line) ~ y=TOP_PADDING+25(25y Line)
  const toSvgY = (pythonY: number) => (FIELD_H - pythonY) + TOP_PADDING;

  return (
    <Card className="h-full border-2">
      <CardHeader>
        <CardTitle>{teamName} 서클 진입 분석</CardTitle>
        <CardDescription>Attacking Circle Entries (Goal at Top)</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center items-center p-4">
        
        {/* SVG 컨테이너: 상단 여백 포함하여 55 x 30 비율 설정 */}
        <div className="relative w-full max-w-2xl aspect-[55/30]">
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${FIELD_W} ${FIELD_H + TOP_PADDING}`}
            className="w-full h-full overflow-visible select-none bg-white"
          >
            <defs>
              {/* 화살표 헤드 (파란색) */}
              <marker id="arrow-head-blue" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(70, 130, 180, 0.9)" />
              </marker>
            </defs>

            {/* --- 1. Field Lines --- */}
            <g fill="none" stroke="black" strokeLinecap="round">
              
              {/* Outer Box: (0, 5) ~ (55, 30) */}
              <rect x="0" y={toSvgY(25)} width={FIELD_W} height={FIELD_H} strokeWidth="0.5" />

              {/* Goal: 파이썬 y=25 라인(SVG y=5)보다 위쪽으로 돌출 */}
              <rect 
                x={CX - 1.83} 
                y={toSvgY(25) - 1.2} // 5 - 1.2 = 3.8
                width={3.66} 
                height={1.2} 
                strokeWidth="0.5" 
              />

              {/* Back Line (Goal Line) - 두께 수정 (0.8 -> 0.5) */}
              <line x1={0} y1={toSvgY(25)} x2={FIELD_W} y2={toSvgY(25)} strokeWidth="0.5" />

              {/* Ticks (파이썬: [-6, -3, 3, 6]) */}
              {[-6, -3, 3, 6].map((dx) => (
                <line 
                  key={dx} 
                  x1={CX + dx} y1={toSvgY(25)} 
                  x2={CX + dx} y2={toSvgY(25) + 0.8} // 안쪽으로 눈금
                  strokeWidth="0.3" 
                />
              ))}

              {/* --- Shooting Circle (D-zone) --- */}
              {/* 파이썬: y=25(상단) 기준. SVG에서는 y=5에서 시작해서 아래로 둥글게 그려야 함(SweepFlag=1) */}
              <path
                d={`
                  M ${CX - 1.83} ${toSvgY(25)}
                  L ${CX - 1.83 - 14.63} ${toSvgY(25)}
                  A 14.63 14.63 0 0 0 ${CX + 1.83 + 14.63} ${toSvgY(25)}
                  L ${CX + 1.83} ${toSvgY(25)}
                `}
                strokeWidth="0.6"
              />

              {/* --- 5m Dashed Line --- */}
              {/* 반지름 14.63 + 5 = 19.63 */}
              <path
                d={`
                  M ${CX - 1.83} ${toSvgY(25)}
                  M ${CX - 1.83 - 19.63} ${toSvgY(25)}
                  A 19.63 19.63 0 0 0 ${CX + 1.83 + 19.63} ${toSvgY(25)}
                `}
                strokeWidth="0.4"
                strokeDasharray="1, 1"
              />

              {/* Penalty Spot (파이썬: back_y - 6.47) -> 약 y=18.53 */}
              <circle cx={CX} cy={toSvgY(25 - 6.47)} r="0.15" fill="black" stroke="none" />
            </g>

            {/* --- 2. Arrows (파이썬 좌표 매핑) --- */}
            <g stroke="rgba(70, 130, 180, 0.7)" strokeWidth="0.8" markerEnd="url(#arrow-head-blue)">
              {/* Left Arrow (유지) */}
              <line x1="2.75" y1={toSvgY(13)} x2="11.0" y2={toSvgY(21)} />
              
              {/* Center Arrow (Flipped to point upwards) */}
              <line x1="27.5" y1={toSvgY(4)} x2="27.5" y2={toSvgY(15)} />
              
              {/* Right Arrow (유지) */}
              <line x1="52.25" y1={toSvgY(13)} x2="44.0" y2={toSvgY(21)} />
            </g>

            {/* --- 3. Stats Text Overlay --- */}
            {/* 텍스트 위치도 toSvgY로 변환하여 화살표 꼬리 근처에 배치 */}
            <g className="fill-black font-bold" style={{ fontSize: '1.2px', textAnchor: 'middle' }}>
              {/* Left Text */}
              <text x="6.5" y={toSvgY(11)}>
                <tspan x="6.5" dy="0">Left</tspan>
                <tspan x="6.5" dy="1.5" fontWeight="normal">{analysis.Left.entries}회</tspan>
                <tspan x="6.5" dy="1.5" fill="#d62728">{analysis.Left.eff}%</tspan>
              </text>

              {/* Center Text */}
              <text x="27.5" y={toSvgY(7)}>
                <tspan x="27.5" dy="0">Center</tspan>
                <tspan x="27.5" dy="1.5" fontWeight="normal">{analysis.Center.entries}회</tspan>
                <tspan x="27.5" dy="1.5" fill="#d62728">{analysis.Center.eff}%</tspan>
              </text>

              {/* Right Text */}
              <text x="48" y={toSvgY(11)}>
                <tspan x="48" dy="0">Right</tspan>
                <tspan x="48" dy="1.5" fontWeight="normal">{analysis.Right.entries}회</tspan>
                <tspan x="48" dy="1.5" fill="#d62728">{analysis.Right.eff}%</tspan>
              </text>
            </g>

          </svg>
        </div>
      </CardContent>
    </Card>
  )
}
