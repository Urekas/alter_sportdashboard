
"use client"

// Phase 7 — 슈팅 존 그리드 맵. 슈팅 태깅 도구(public/ShotTagging)가 내보내는 X_Loc/Y_Loc(필드,
// 550x230cm 기준)·X_Goal/Y_Goal(골대, 366x214cm 기준) 좌표를 그대로 SVG viewBox 단위로 써서
// 캔버스 픽셀 스케일링 없이 1:1로 그립니다(태깅 도구 자체 좌표계와 동일).
// 홈/어웨이는 한 지도에 겹쳐 그리지 않고 완전히 분리된 패널로 각각 표시합니다
// (겹쳐 두면 점이 뒤섞여 읽기 어렵다는 사용자 피드백 반영).
import { useState, useMemo, useRef, useId } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { CollapseToggleButton } from "./collapsible-section"

export interface ShotDatum {
  id: string
  side: 'A' | 'B' // A/B — 팀 구분(호출부가 의미 부여: 홈/어웨이, 우리팀/상대팀 등). 이제 각자 별도 패널에 그려짐.
  teamName: string
  player?: string
  output: 'goal' | 'save' | 'block' | 'out' | 'fail' | 'unknown'
  shotType?: string
  isPC?: boolean // 페널티코너 시도 여부 — true면 사각형, false/미지정이면 원형(필드슛)으로 그림
  xLoc?: number
  yLoc?: number
  xGoal?: number
  yGoal?: number
  outDir?: string
  matchName?: string
  quarter?: string
  time?: number
  matchId?: string       // 여러 경기를 한 번에 모아 보여줄 때(슈팅 분석 등) 어느 경기 소속인지
  videoMatchId?: string  // 그 경기에 영상이 연결돼있으면 클릭→영상 이동에 씀(없으면 이동 불가)
  code?: string          // 원본 MatchEvent.code — 비디오 도구 Events 컬렉션과의 매칭(재생목록 생성)에 씀
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

// D자 슈팅서클 기하 정보(중심점들, 반지름, 바운딩박스) — 아웃라인 path와 그리드 셀 계산이 공유.
function circleGeom(radius: number) {
  const cx = FIELD_MAX_X / 2
  const backlineY = FIELD_MAX_Y
  const straightW = (3.66 / 55.0) * FIELD_MAX_X
  const leftCx = cx - straightW / 2
  const rightCx = cx + straightW / 2
  return {
    backlineY, leftCx, rightCx, radius,
    leftStart: { x: leftCx - radius, y: backlineY },
    leftEnd: { x: leftCx, y: backlineY - radius },
    rightStart: { x: rightCx, y: backlineY - radius },
    rightEnd: { x: rightCx + radius, y: backlineY },
    boxMinX: leftCx - radius, boxMaxX: rightCx + radius,
    boxMinY: backlineY - radius, boxMaxY: backlineY,
  }
}

// 두 원(D자 슈팅서클) 아웃라인을 SVG path로 — 캔버스 arc 수식을 그대로 이식(23m=height, 55m=width 비례).
function circleOutlinePath(radius: number) {
  const { leftStart, leftEnd, rightStart, rightEnd } = circleGeom(radius)
  return `M ${leftStart.x} ${leftStart.y} A ${radius} ${radius} 0 0 1 ${leftEnd.x} ${leftEnd.y} L ${rightStart.x} ${rightStart.y} A ${radius} ${radius} 0 0 1 ${rightEnd.x} ${rightEnd.y}`
}

// 그리드를 서클 내부로만 자르는 클립용 — 위 아웃라인에 백라인을 따라 닫는 선을 더해 폐곡선으로 만듦.
function circleClipPath(radius: number) {
  const { leftStart } = circleGeom(radius)
  return `${circleOutlinePath(radius)} L ${leftStart.x} ${leftStart.y} Z`
}

// 슈팅 서클(D자) 내부 판정 — 가운데 직선 구간(leftCx~rightCx)은 사각형처럼, 양옆은 backlineY를
// 중심으로 한 사분원으로 취급(원 아웃라인 자체가 그렇게 그려지므로 그 기하와 동일하게 맞춤).
function isInsideCircle(x: number, y: number, geom: ReturnType<typeof circleGeom>): boolean {
  const { leftCx, rightCx, backlineY, radius, boxMinY, boxMaxY } = geom
  if (y < boxMinY || y > boxMaxY) return false
  if (x >= leftCx && x <= rightCx) return true
  const dCx = x < leftCx ? leftCx : rightCx
  const dx = x - dCx, dy = y - backlineY
  return dx * dx + dy * dy <= radius * radius
}

const CIRCLE_GRID_COLS = 3
const CIRCLE_GRID_ROWS = 2
const SHOOTING_CIRCLE_RADIUS = (14.63 / 23) * FIELD_MAX_Y

export type ZoneFilter = 'all' | 'field' | 'pc'

function ShotMarker({ shot, x, y, r, fill, stroke, onEnter, onMove, onLeave, onClick }: {
  shot: ShotDatum, x: number, y: number, r: number, fill: string, stroke: string,
  onEnter: (e: React.MouseEvent, shot: ShotDatum) => void, onMove: (e: React.MouseEvent) => void, onLeave: () => void,
  onClick?: (shot: ShotDatum) => void,
}) {
  const handlers = {
    onMouseEnter: (e: React.MouseEvent) => onEnter(e, shot), onMouseMove: onMove, onMouseLeave: onLeave,
    onClick: onClick ? () => onClick(shot) : undefined,
    style: { cursor: 'pointer' as const },
  }
  if (shot.isPC) {
    const s = r * 1.7
    return <rect x={x - s / 2} y={y - s / 2} width={s} height={s} rx={1.5} fill={fill} fillOpacity={0.9} stroke={stroke} strokeWidth={1.5} {...handlers} />
  }
  return <circle cx={x} cy={y} r={r} fill={fill} fillOpacity={0.9} stroke={stroke} strokeWidth={1.5} {...handlers} />
}

interface Tooltip { x: number, y: number, shot: ShotDatum }

interface GridCell { col: number, row: number, x: number, y: number, w: number, h: number, count: number, goals: number }

// 슈팅 발사 위치 그리드 — 서클 내부만, 3열(좌/중/우) x 2행(상/하) 고정 6칸.
// 서클 밖으로 찍힌 슈팅(좌표 오차/필드 먼 거리 슛 등)은 어느 칸에도 집계하지 않음.
function buildCircleGrid(shots: ShotDatum[], radius: number): GridCell[] {
  const geom = circleGeom(radius)
  const { boxMinX, boxMinY, boxMaxX, boxMaxY } = geom
  const cellW = (boxMaxX - boxMinX) / CIRCLE_GRID_COLS
  const cellH = (boxMaxY - boxMinY) / CIRCLE_GRID_ROWS
  const cells: GridCell[] = Array.from({ length: CIRCLE_GRID_COLS * CIRCLE_GRID_ROWS }, (_, i) => {
    const col = i % CIRCLE_GRID_COLS, row = Math.floor(i / CIRCLE_GRID_COLS)
    return { col, row, x: boxMinX + col * cellW, y: boxMinY + row * cellH, w: cellW, h: cellH, count: 0, goals: 0 }
  })
  shots.forEach(s => {
    const p = fieldPixel(s)
    if (!p || !isInsideCircle(p.x, p.y, geom)) return
    const col = Math.min(CIRCLE_GRID_COLS - 1, Math.max(0, Math.floor((p.x - boxMinX) / cellW)))
    const row = Math.min(CIRCLE_GRID_ROWS - 1, Math.max(0, Math.floor((p.y - boxMinY) / cellH)))
    const cell = cells[row * CIRCLE_GRID_COLS + col]
    cell.count++
    if (s.output === 'goal') cell.goals++
  })
  return cells
}

function buildGoalGrid(shots: ShotDatum[], goalGridSize: number): GridCell[] {
  const { marginX, marginYTop, goalW, goalH } = goalFrameGeom()
  const cellW = goalW / goalGridSize
  const cellH = goalH / goalGridSize
  const cells: GridCell[] = Array.from({ length: goalGridSize * goalGridSize }, (_, i) => {
    const col = i % goalGridSize, row = Math.floor(i / goalGridSize)
    return { col, row, x: marginX + col * cellW, y: marginYTop + row * cellH, w: cellW, h: cellH, count: 0, goals: 0 }
  })
  // 골대 타겟 그리드는 실제로 프레임 안(xGoal/yGoal 존재)에 도착한 슈팅만 집계 — OUT은 프레임 밖이라 제외.
  shots.filter(s => s.xGoal !== undefined && s.yGoal !== undefined).forEach(s => {
    const p = goalPixel(s)!
    const col = Math.min(goalGridSize - 1, Math.max(0, Math.floor((p.x - marginX) / cellW)))
    const row = Math.min(goalGridSize - 1, Math.max(0, Math.floor((p.y - marginYTop) / cellH)))
    const cell = cells[row * goalGridSize + col]
    cell.count++
    if (s.output === 'goal') cell.goals++
  })
  return cells
}

function SidePanel({
  label, color, shots, showGrid, zoneFilter, goalGridSize,
  onEnter, onMove, onLeave, onShotClick,
}: {
  label: string
  color: string
  shots: ShotDatum[]
  showGrid: boolean
  zoneFilter: ZoneFilter
  goalGridSize: number
  onEnter: (e: React.MouseEvent, shot: ShotDatum) => void
  onMove: (e: React.MouseEvent) => void
  onLeave: () => void
  onShotClick?: (shot: ShotDatum) => void
}) {
  const clipId = useId()
  // 슈팅 발사 위치 그리드 전용 — PC/필드슛 선택은 이 지도(그리드+마커)에만 적용됨(골대 타겟은 항상 전체).
  const zoneShots = useMemo(() => {
    if (zoneFilter === 'field') return shots.filter(s => !s.isPC)
    if (zoneFilter === 'pc') return shots.filter(s => s.isPC)
    return shots
  }, [shots, zoneFilter])
  const fieldShots = useMemo(() => zoneShots.filter(s => fieldPixel(s) !== null), [zoneShots])
  const goalShots = useMemo(() => shots.filter(s => goalPixel(s) !== null), [shots])
  const fieldGrid = useMemo(() => showGrid ? buildCircleGrid(fieldShots, SHOOTING_CIRCLE_RADIUS) : [], [showGrid, fieldShots])
  const goalGrid = useMemo(() => showGrid ? buildGoalGrid(shots, goalGridSize) : [], [showGrid, shots, goalGridSize])
  const maxFieldCount = Math.max(1, ...fieldGrid.map(c => c.count))
  const maxGoalCount = Math.max(1, ...goalGrid.map(c => c.count))
  const g = goalFrameGeom()

  const outcomeSummary = useMemo(() => {
    const counts: Record<ShotDatum['output'], number> = { goal: 0, save: 0, block: 0, out: 0, fail: 0, unknown: 0 }
    shots.forEach(s => counts[s.output]++)
    return counts
  }, [shots])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="font-bold" style={{ color }}>{label}</span>
        <span className="text-xs text-muted-foreground">· 슈팅/PC {shots.length}회</span>
      </div>

      <div className="space-y-4 max-w-md mx-auto">
        {/* 필드 슈팅 발사 위치 */}
        <div>
          <p className="text-xs font-bold text-muted-foreground mb-1">슈팅 발사 위치</p>
          <svg viewBox={`0 0 ${FIELD_MAX_X} ${FIELD_MAX_Y}`} className="w-full h-auto rounded-lg border" style={{ background: '#2d2b2b' }}>
            <defs>
              <clipPath id={clipId}>
                <path d={circleClipPath(SHOOTING_CIRCLE_RADIUS)} />
              </clipPath>
            </defs>
            <path d={circleOutlinePath(SHOOTING_CIRCLE_RADIUS)} fill="none" stroke="#eae7e7" strokeWidth={1.5} />
            <path d={circleOutlinePath(((14.63 + 5) / 23) * FIELD_MAX_Y)} fill="none" stroke="rgba(234,231,231,0.35)" strokeWidth={1} strokeDasharray="4 4" />
            <circle cx={FIELD_MAX_X / 2} cy={FIELD_MAX_Y - (6.4 / 23) * FIELD_MAX_Y} r={2.2} fill="#eae7e7" />
            <line x1={0} y1={0.5} x2={FIELD_MAX_X} y2={0.5} stroke="#eae7e7" strokeWidth={1.5} />
            <line x1={0} y1={FIELD_MAX_Y - 0.5} x2={FIELD_MAX_X} y2={FIELD_MAX_Y - 0.5} stroke="#eae7e7" strokeWidth={1.5} />

            {/* 그리드는 서클(D자) 내부로만 클립 — 3x2(좌/중/우 x 상/하) 6칸, 밖으로 삐져나가지 않음 */}
            {showGrid && (
              <g clipPath={`url(#${clipId})`}>
                {fieldGrid.map((c, i) => (
                  <g key={i}>
                    <rect x={c.x} y={c.y} width={c.w} height={c.h} fill={color} opacity={c.count > 0 ? 0.12 + (c.count / maxFieldCount) * 0.35 : 0.02} stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
                    {c.count > 0 && (
                      <text x={c.x + c.w / 2} y={c.y + c.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={13} fill="#fff" fontWeight={700}>
                        {c.goals}/{c.count}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            )}

            {fieldShots.map(s => {
              const p = fieldPixel(s)!
              return <ShotMarker key={s.id} shot={s} x={p.x} y={p.y} r={6} fill={OUTCOME_COLORS[s.output]} stroke={color} onEnter={onEnter} onMove={onMove} onLeave={onLeave} onClick={onShotClick} />
            })}
          </svg>
        </div>

        {/* 골대 도착 타겟 */}
        <div>
          <p className="text-xs font-bold text-muted-foreground mb-1">골대 도착 타겟</p>
          <svg viewBox={`0 0 ${GOAL_MAX_X} ${GOAL_MAX_Y}`} className="w-full h-auto rounded-lg border" style={{ background: '#2d2b2b' }}>
            <line x1={0} y1={g.marginYBottom} x2={GOAL_MAX_X} y2={g.marginYBottom} stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />
            <rect x={g.marginX} y={g.marginYBottom - g.goalH * 0.2} width={g.goalW} height={g.goalH * 0.2} fill="rgba(255,255,255,0.08)" />
            {Array.from({ length: 6 }, (_, i) => (
              <line key={`v${i}`} x1={g.marginX + (g.goalW / 6) * i} y1={g.marginYTop} x2={g.marginX + (g.goalW / 6) * i} y2={g.marginYBottom} stroke="rgba(255,255,255,0.06)" />
            ))}
            {Array.from({ length: 4 }, (_, i) => (
              <line key={`h${i}`} x1={g.marginX} y1={g.marginYTop + (g.goalH / 4) * i} x2={GOAL_MAX_X - g.marginX} y2={g.marginYTop + (g.goalH / 4) * i} stroke="rgba(255,255,255,0.06)" />
            ))}
            <path d={`M ${g.marginX} ${g.marginYBottom} L ${g.marginX} ${g.marginYTop} L ${GOAL_MAX_X - g.marginX} ${g.marginYTop} L ${GOAL_MAX_X - g.marginX} ${g.marginYBottom}`} fill="none" stroke="#ec3013" strokeWidth={2.5} strokeLinejoin="round" />

            {showGrid && goalGrid.map((c, i) => (
              <g key={i}>
                <rect x={c.x} y={c.y} width={c.w} height={c.h} fill={color} opacity={c.count > 0 ? 0.1 + (c.count / maxGoalCount) * 0.35 : 0.02} stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
                {c.count > 0 && (
                  <text x={c.x + c.w / 2} y={c.y + c.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={13} fill="#fff" fontWeight={700}>
                    {c.goals}/{c.count}
                  </text>
                )}
              </g>
            ))}

            {goalShots.map(s => {
              const p = goalPixel(s)!
              return <ShotMarker key={s.id} shot={s} x={p.x} y={p.y} r={6} fill={OUTCOME_COLORS[s.output]} stroke={color} onEnter={onEnter} onMove={onMove} onLeave={onLeave} onClick={onShotClick} />
            })}
          </svg>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-muted-foreground">
        {(Object.keys(OUTCOME_LABELS) as ShotDatum['output'][]).filter(k => k !== 'unknown' && outcomeSummary[k] > 0).map(k => (
          <span key={k} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: OUTCOME_COLORS[k] }} /> {OUTCOME_LABELS[k]} {outcomeSummary[k]}</span>
        ))}
      </div>
    </div>
  )
}

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
  goalGridSize?: number
  onShotClick?: (shot: ShotDatum) => void // 마커 클릭 시(예: 영상의 그 시점으로 이동) — 없으면 그냥 hover 툴팁만
}

const ZONE_FILTER_OPTIONS: { key: ZoneFilter, label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'field', label: '필드슛' },
  { key: 'pc', label: 'PC' },
]

export function ShotZoneMap({
  shots,
  sideALabel = "팀 A",
  sideBLabel = "팀 B",
  sideAColor = "#ec3013",
  sideBColor = "#2d2b2b",
  showSideB = true,
  title = "슈팅 위치 · 골대 타겟 맵",
  description,
  defaultGrid = false,
  goalGridSize = 3,
  onShotClick,
}: ShotZoneMapProps) {
  const [showGrid, setShowGrid] = useState(defaultGrid)
  const [zoneFilter, setZoneFilter] = useState<ZoneFilter>('all')
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const [open, setOpen] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  const shotsA = useMemo(() => shots.filter(s => s.side === 'A'), [shots])
  const shotsB = useMemo(() => shots.filter(s => s.side === 'B'), [shots])

  const handleEnter = (e: React.MouseEvent, shot: ShotDatum) => setTooltip({ x: e.clientX, y: e.clientY, shot })
  const handleMove = (e: React.MouseEvent) => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : t)
  const handleLeave = () => setTooltip(null)

  return (
    <Card ref={containerRef} className="relative break-inside-avoid">
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-[11px] font-bold text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full border-2 border-current" /> 필드슛</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 border-2 border-current rounded-[2px]" /> PC</span>
          </div>
          {showGrid && (
            <div className="flex items-center gap-1 print-hidden bg-muted rounded-md p-0.5">
              {ZONE_FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setZoneFilter(opt.key)}
                  className={cn(
                    "text-xs font-bold px-2 py-1 rounded transition-colors",
                    zoneFilter === opt.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 print-hidden">
            <Switch id="shot-grid-toggle" checked={showGrid} onCheckedChange={setShowGrid} />
            <Label htmlFor="shot-grid-toggle" className="text-xs font-bold cursor-pointer">구역 그리드</Label>
          </div>
          <CollapseToggleButton open={open} onClick={() => setOpen(o => !o)} />
        </div>
      </CardHeader>
      <CardContent className={cn(!open && "hidden print:block")}>
        <div className={showSideB ? "grid grid-cols-1 lg:grid-cols-2 gap-6 lg:divide-x lg:gap-x-0" : ""}>
          <div className={showSideB ? "lg:pr-6" : ""}>
            <SidePanel
              label={sideALabel} color={sideAColor} shots={shotsA} showGrid={showGrid} zoneFilter={zoneFilter}
              goalGridSize={goalGridSize}
              onEnter={handleEnter} onMove={handleMove} onLeave={handleLeave} onShotClick={onShotClick}
            />
          </div>
          {showSideB && (
            <div className="lg:pl-6">
              <SidePanel
                label={sideBLabel} color={sideBColor} shots={shotsB} showGrid={showGrid} zoneFilter={zoneFilter}
                goalGridSize={goalGridSize}
                onEnter={handleEnter} onMove={handleMove} onLeave={handleLeave} onShotClick={onShotClick}
              />
            </div>
          )}
        </div>
      </CardContent>

      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-slate-950 text-white border border-slate-700 rounded-lg p-2.5 text-xs shadow-2xl max-w-[220px]"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          <div className="font-bold" style={{ color: OUTCOME_COLORS[tooltip.shot.output] }}>{OUTCOME_LABELS[tooltip.shot.output]} {tooltip.shot.isPC && <span className="text-slate-400 font-normal">· PC</span>}</div>
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

// 페널티코너(PC) 시도인지 판별 — code 텍스트("페널티코너"/"PC") 또는 태깅 도구 Type 라벨
// (PC_direct/PC_var 등, "PC"로 시작)로 판단합니다. 지도에서 원형(필드슛)/사각형(PC) 구분에 씁니다.
export function isPcAttempt(code: string, shotType?: string): boolean {
  if (shotType && /^pc/i.test(shotType.trim())) return true
  return /페널티코너|\bPC\b/i.test(code)
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
