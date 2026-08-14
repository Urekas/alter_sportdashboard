
"use client"

// Phase 7 — 슈팅 존 그리드 맵. 슈팅 태깅 도구(public/ShotTagging)가 내보내는 X_Loc/Y_Loc(필드,
// 550x230cm 기준)·X_Goal/Y_Goal(골대, 366x214cm 기준) 좌표를 그대로 SVG viewBox 단위로 써서
// 캔버스 픽셀 스케일링 없이 1:1로 그립니다(태깅 도구 자체 좌표계와 동일).
import { useState, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export interface ShotDatum {
  id: string
  side: 'A' | 'B' // A=원형, B=마름모 — 팀/그룹 구분(호출부가 의미 부여: 홈/어웨이, 우리팀/상대팀 등)
  teamName: string
  player?: string
  output: 'goal' | 'save' | 'block' | 'out' | 'fail' | 'unknown'
  shotType?: string
  xLoc?: number
  yLoc?: number
  xGoal?: number
  yGoal?: number
  outDir?: string
  matchName?: string
  quarter?: string
  time?: number
}

const FIELD_MAX_X = 550
const FIELD_MAX_Y = 230
const GOAL_MAX_X = 366
const GOAL_MAX_Y = 214
const MARGIN_RATIO = 0.15

const OUTCOME_COLORS: Record<ShotDatum['output'], string> = {
  goal: '#10b981',
  save: '#38bdf8',
  block: '#a855f7',
  out: '#f59e0b',
  fail: '#ef4444',
  unknown: '#94a3b8',
}
const OUTCOME_LABELS: Record<ShotDatum['output'], string> = {
  goal: '득점', save: 'GK 선방', block: '블락', out: '아웃', fail: '실패', unknown: '미분류',
}

function goalFrameGeom() {
  const marginX = GOAL_MAX_X * MARGIN_RATIO
  const marginYTop = GOAL_MAX_Y * MARGIN_RATIO
  const marginYBottom = GOAL_MAX_Y * (1 - MARGIN_RATIO)
  return { marginX, marginYTop, marginYBottom, goalW: GOAL_MAX_X - marginX * 2, goalH: marginYBottom - marginYTop }
}

function goalPixel(shot: ShotDatum): { x: number, y: number } | null {
  const { marginX, marginYTop, marginYBottom, goalW, goalH } = goalFrameGeom()
  if (shot.xGoal !== undefined && shot.yGoal !== undefined) {
    return { x: marginX + (shot.xGoal / GOAL_MAX_X) * goalW, y: marginYBottom - (shot.yGoal / GOAL_MAX_Y) * goalH }
  }
  const dir = (shot.outDir || '').toUpperCase()
  if (dir === 'LEFT') return { x: marginX / 2, y: GOAL_MAX_Y * 0.5 }
  if (dir === 'RIGHT') return { x: GOAL_MAX_X - marginX / 2, y: GOAL_MAX_Y * 0.5 }
  if (dir === 'UP') return { x: GOAL_MAX_X * 0.5, y: marginYTop / 2 }
  return null
}

function fieldPixel(shot: ShotDatum): { x: number, y: number } | null {
  if (shot.xLoc === undefined || shot.yLoc === undefined) return null
  return { x: shot.xLoc, y: FIELD_MAX_Y - shot.yLoc }
}

// 두 원(D자 슈팅서클) 아웃라인을 SVG path로 — 캔버스 arc 수식을 그대로 이식(23m=height, 55m=width 비례).
function circleOutlinePath(radius: number) {
  const cx = FIELD_MAX_X / 2
  const backlineY = FIELD_MAX_Y
  const straightW = (3.66 / 55.0) * FIELD_MAX_X
  const leftCx = cx - straightW / 2
  const rightCx = cx + straightW / 2
  const leftStart = { x: leftCx - radius, y: backlineY }
  const leftEnd = { x: leftCx, y: backlineY - radius }
  const rightStart = { x: rightCx, y: backlineY - radius }
  const rightEnd = { x: rightCx + radius, y: backlineY }
  return `M ${leftStart.x} ${leftStart.y} A ${radius} ${radius} 0 0 1 ${leftEnd.x} ${leftEnd.y} L ${rightStart.x} ${rightStart.y} A ${radius} ${radius} 0 0 1 ${rightEnd.x} ${rightEnd.y}`
}

function Diamond({ cx, cy, r, fill, stroke, fillOpacity, strokeWidth }: { cx: number, cy: number, r: number, fill: string, stroke: string, fillOpacity?: number, strokeWidth?: number }) {
  return <path d={`M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`} fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={strokeWidth} />
}

interface Tooltip { x: number, y: number, shot: ShotDatum }

interface ShotZoneMapProps {
  shots: ShotDatum[]
  sideALabel?: string
  sideBLabel?: string
  sideAColor?: string
  sideBColor?: string
  showSideB?: boolean
  title?: string
  description?: string
  defaultGrid?: boolean
  gridCols?: number
  gridRows?: number
  goalGridSize?: number
}

export function ShotZoneMap({
  shots,
  sideALabel = "팀 A",
  sideBLabel = "팀 B",
  sideAColor = "#3b82f6",
  sideBColor = "#ef4444",
  showSideB = true,
  title = "슈팅 위치 · 골대 타겟 맵",
  description,
  defaultGrid = false,
  gridCols = 4,
  gridRows = 3,
  goalGridSize = 3,
}: ShotZoneMapProps) {
  const [showGrid, setShowGrid] = useState(defaultGrid)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const visibleShots = useMemo(() => showSideB ? shots : shots.filter(s => s.side === 'A'), [shots, showSideB])
  const fieldShots = useMemo(() => visibleShots.filter(s => fieldPixel(s) !== null), [visibleShots])
  const goalShots = useMemo(() => visibleShots.filter(s => goalPixel(s) !== null), [visibleShots])

  const fieldGrid = useMemo(() => {
    if (!showGrid) return []
    const cellW = FIELD_MAX_X / gridCols
    const cellH = FIELD_MAX_Y / gridRows
    const cells = Array.from({ length: gridCols * gridRows }, (_, i) => {
      const col = i % gridCols, row = Math.floor(i / gridCols)
      return { col, row, x: col * cellW, y: row * cellH, w: cellW, h: cellH, count: 0, goals: 0 }
    })
    fieldShots.forEach(s => {
      const p = fieldPixel(s)!
      const col = Math.min(gridCols - 1, Math.max(0, Math.floor(p.x / cellW)))
      const row = Math.min(gridRows - 1, Math.max(0, Math.floor(p.y / cellH)))
      const cell = cells[row * gridCols + col]
      cell.count++
      if (s.output === 'goal') cell.goals++
    })
    return cells
  }, [showGrid, fieldShots, gridCols, gridRows])

  const goalGrid = useMemo(() => {
    if (!showGrid) return []
    const { marginX, marginYTop, goalW, goalH } = goalFrameGeom()
    const cellW = goalW / goalGridSize
    const cellH = goalH / goalGridSize
    const cells = Array.from({ length: goalGridSize * goalGridSize }, (_, i) => {
      const col = i % goalGridSize, row = Math.floor(i / goalGridSize)
      return { col, row, x: marginX + col * cellW, y: marginYTop + row * cellH, w: cellW, h: cellH, count: 0, goals: 0 }
    })
    // 골대 타겟 그리드는 실제로 프레임 안(xGoal/yGoal 존재)에 도착한 슈팅만 집계 — OUT은 프레임 밖이라 제외.
    visibleShots.filter(s => s.xGoal !== undefined && s.yGoal !== undefined).forEach(s => {
      const p = goalPixel(s)!
      const col = Math.min(goalGridSize - 1, Math.max(0, Math.floor((p.x - marginX) / cellW)))
      const row = Math.min(goalGridSize - 1, Math.max(0, Math.floor((p.y - marginYTop) / cellH)))
      const cell = cells[row * goalGridSize + col]
      cell.count++
      if (s.output === 'goal') cell.goals++
    })
    return cells
  }, [showGrid, visibleShots, goalGridSize])

  const maxFieldCount = Math.max(1, ...fieldGrid.map(c => c.count))
  const maxGoalCount = Math.max(1, ...goalGrid.map(c => c.count))

  const handleEnter = (e: React.MouseEvent, shot: ShotDatum) => {
    setTooltip({ x: e.clientX, y: e.clientY, shot })
  }
  const handleMove = (e: React.MouseEvent) => {
    setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : t)
  }
  const handleLeave = () => setTooltip(null)

  const g = goalFrameGeom()

  const sideColor = (s: ShotDatum) => s.side === 'A' ? sideAColor : sideBColor

  return (
    <Card ref={containerRef} className="relative">
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <div className="flex items-center gap-2 print-hidden">
          <Switch id="shot-grid-toggle" checked={showGrid} onCheckedChange={setShowGrid} />
          <Label htmlFor="shot-grid-toggle" className="text-xs font-bold cursor-pointer">구역 그리드</Label>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* 필드 슈팅 발사 위치 */}
          <div className="lg:col-span-7">
            <p className="text-xs font-bold text-muted-foreground mb-1">슈팅 발사 위치</p>
            <svg viewBox={`0 0 ${FIELD_MAX_X} ${FIELD_MAX_Y}`} className="w-full h-auto rounded-lg border" style={{ background: '#1e2a3b' }}>
              <path d={circleOutlinePath((14.63 / 23) * FIELD_MAX_Y)} fill="none" stroke="#e2e8f0" strokeWidth={1.5} />
              <path d={circleOutlinePath(((14.63 + 5) / 23) * FIELD_MAX_Y)} fill="none" stroke="rgba(226,232,240,0.35)" strokeWidth={1} strokeDasharray="4 4" />
              <circle cx={FIELD_MAX_X / 2} cy={FIELD_MAX_Y - (6.4 / 23) * FIELD_MAX_Y} r={2.2} fill="#e2e8f0" />
              <line x1={0} y1={0.5} x2={FIELD_MAX_X} y2={0.5} stroke="#e2e8f0" strokeWidth={1.5} />
              <line x1={0} y1={FIELD_MAX_Y - 0.5} x2={FIELD_MAX_X} y2={FIELD_MAX_Y - 0.5} stroke="#e2e8f0" strokeWidth={1.5} />

              {showGrid && fieldGrid.map((c, i) => (
                <g key={i}>
                  <rect x={c.x} y={c.y} width={c.w} height={c.h} fill="#3b82f6" opacity={c.count > 0 ? 0.12 + (c.count / maxFieldCount) * 0.35 : 0.02} stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
                  {c.count > 0 && (
                    <text x={c.x + c.w / 2} y={c.y + c.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#fff" fontWeight={700}>
                      {c.goals}/{c.count}
                    </text>
                  )}
                </g>
              ))}

              {fieldShots.map(s => {
                const p = fieldPixel(s)!
                const color = OUTCOME_COLORS[s.output]
                const r = 5
                return (
                  <g key={s.id} onMouseEnter={(e) => handleEnter(e, s)} onMouseMove={handleMove} onMouseLeave={handleLeave} style={{ cursor: 'pointer' }}>
                    {s.side === 'A' ? (
                      <circle cx={p.x} cy={p.y} r={r} fill={color} fillOpacity={0.85} stroke={sideColor(s)} strokeWidth={1.5} />
                    ) : (
                      <Diamond cx={p.x} cy={p.y} r={r} fill={color} fillOpacity={0.85} stroke={sideColor(s)} strokeWidth={1.5} />
                    )}
                  </g>
                )
              })}
            </svg>
          </div>

          {/* 골대 도착 타겟 */}
          <div className="lg:col-span-5">
            <p className="text-xs font-bold text-muted-foreground mb-1">골대 도착 타겟</p>
            <svg viewBox={`0 0 ${GOAL_MAX_X} ${GOAL_MAX_Y}`} className="w-full h-auto rounded-lg border" style={{ background: '#0a1128' }}>
              <line x1={0} y1={g.marginYBottom} x2={GOAL_MAX_X} y2={g.marginYBottom} stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />
              <rect x={g.marginX} y={g.marginYBottom - g.goalH * 0.2} width={g.goalW} height={g.goalH * 0.2} fill="rgba(255,255,255,0.08)" />
              {Array.from({ length: 6 }, (_, i) => (
                <line key={`v${i}`} x1={g.marginX + (g.goalW / 6) * i} y1={g.marginYTop} x2={g.marginX + (g.goalW / 6) * i} y2={g.marginYBottom} stroke="rgba(255,255,255,0.06)" />
              ))}
              {Array.from({ length: 4 }, (_, i) => (
                <line key={`h${i}`} x1={g.marginX} y1={g.marginYTop + (g.goalH / 4) * i} x2={GOAL_MAX_X - g.marginX} y2={g.marginYTop + (g.goalH / 4) * i} stroke="rgba(255,255,255,0.06)" />
              ))}
              <path d={`M ${g.marginX} ${g.marginYBottom} L ${g.marginX} ${g.marginYTop} L ${GOAL_MAX_X - g.marginX} ${g.marginYTop} L ${GOAL_MAX_X - g.marginX} ${g.marginYBottom}`} fill="none" stroke="#ef4444" strokeWidth={2.5} strokeLinejoin="round" />

              {showGrid && goalGrid.map((c, i) => (
                <g key={i}>
                  <rect x={c.x} y={c.y} width={c.w} height={c.h} fill="#f43f5e" opacity={c.count > 0 ? 0.1 + (c.count / maxGoalCount) * 0.35 : 0.02} stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
                  {c.count > 0 && (
                    <text x={c.x + c.w / 2} y={c.y + c.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#fff" fontWeight={700}>
                      {c.goals}/{c.count}
                    </text>
                  )}
                </g>
              ))}

              {goalShots.map(s => {
                const p = goalPixel(s)!
                const color = OUTCOME_COLORS[s.output]
                const r = 5
                return (
                  <g key={s.id} onMouseEnter={(e) => handleEnter(e, s)} onMouseMove={handleMove} onMouseLeave={handleLeave} style={{ cursor: 'pointer' }}>
                    {s.side === 'A' ? (
                      <circle cx={p.x} cy={p.y} r={r} fill={color} fillOpacity={0.85} stroke={sideColor(s)} strokeWidth={1.5} />
                    ) : (
                      <Diamond cx={p.x} cy={p.y} r={r} fill={color} fillOpacity={0.85} stroke={sideColor(s)} strokeWidth={1.5} />
                    )}
                  </g>
                )
              })}
            </svg>
          </div>
        </div>

        {/* 범례 */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-bold bg-muted/30 rounded-lg px-3 py-2 border">
          {showSideB && (
            <>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border-2" style={{ borderColor: sideAColor, background: 'transparent' }} /> {sideALabel} (원형)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 border-2 rotate-45" style={{ borderColor: sideBColor, background: 'transparent' }} /> {sideBLabel} (마름모)</span>
              <span className="w-px h-4 bg-border" />
            </>
          )}
          {(Object.keys(OUTCOME_LABELS) as ShotDatum['output'][]).filter(k => k !== 'unknown').map(k => (
            <span key={k} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: OUTCOME_COLORS[k] }} /> {OUTCOME_LABELS[k]}</span>
          ))}
        </div>
      </CardContent>

      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-slate-950 text-white border border-slate-700 rounded-lg p-2.5 text-xs shadow-2xl max-w-[220px]"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          <div className="font-bold" style={{ color: OUTCOME_COLORS[tooltip.shot.output] }}>{OUTCOME_LABELS[tooltip.shot.output]}</div>
          {tooltip.shot.player && <div>선수: <span className="font-semibold">{tooltip.shot.player}</span></div>}
          {tooltip.shot.shotType && <div className="text-slate-400">타입: {tooltip.shot.shotType}</div>}
          {tooltip.shot.matchName && <div className="text-slate-400 truncate">{tooltip.shot.matchName}</div>}
          {tooltip.shot.quarter && <div className="text-slate-400">{tooltip.shot.quarter}</div>}
        </div>
      )}
    </Card>
  )
}

// MatchEvent[] → ShotDatum[] 변환 헬퍼. code에 "슈팅" 또는 "페널티코너"/PC가 들어간 이벤트만
// 슈팅 시도로 간주하고, 좌표(xLoc/yLoc 또는 xGoal/yGoal/outDir)가 하나도 없는 이벤트는 그릴 게
// 없으므로 제외합니다(태깅 도구에서 위치를 안 찍은 이벤트 — 좌표 없이도 이벤트 자체는 존재할 수 있음).
export function isShotAttemptCode(code: string): boolean {
  return /슈팅|페널티코너|\bPC\b/i.test(code) && !/진입/.test(code)
}

export function normalizeShotOutput(shotOutput: string | undefined, resultLabel: string | undefined, outDir: string | undefined): ShotDatum['output'] {
  const raw = (shotOutput || resultLabel || '').toLowerCase()
  if (raw.includes('goal') || raw.includes('득점')) return 'goal'
  if (raw.includes('save') || raw.includes('선방')) return 'save'
  if (raw.includes('block') || raw.includes('블락') || raw.includes('블록')) return 'block'
  if (raw.includes('out') || outDir) return 'out'
  if (raw.includes('fail') || raw.includes('실패')) return 'fail'
  return 'unknown'
}
