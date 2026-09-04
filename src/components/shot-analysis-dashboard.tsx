
"use client"

// Phase 7 — "슈팅 분석" 전용 화면. 대회(또는 전체) → 팀을 고르면 그 팀이 시도한 모든 슈팅/PC를
// 필드 발사위치·골대 타겟 두 지도로 누적해서 보여줌. 그리드 토글은 ShotZoneMap 내부에서 처리.
// 하키는 남자/여자 대회가 완전히 분리돼있어서(같은 "한국"이라도 다른 팀) "전체 대회"도 실제로는
// "선택한 카테고리 안의 전체 대회"를 뜻하도록 카테고리를 먼저 고르게 함. category 없는 대회는 "미분류".
//
// 2026-08 개편: 타임라인 로그(전체 슈팅 목록, 클릭→영상 이동) + 선수별 통계 정렬 + 우리팀/상대팀
// KPI 비교 카드 추가. 그리드 칸 크기 조절 UI는 사용자가 "나중에 직접 하겠다"고 보류한 항목이라
// 이번에도 안 건드림(gridCols/gridRows/goalGridSize는 이미 props로 존재).
import { useMemo, useState } from "react"
import { Trophy, Users, Loader2, Target, ShieldCheck, Table2, ListVideo, ArrowUp, ArrowDown, ArrowUpDown, Video, Search, RotateCcw } from "lucide-react"
import type { MatchData, Tournament } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { StatsCard } from "./stats-card"
import { ShotZoneMap, isShotAttemptCode, isShotOnlyCode, normalizeShotOutput, isPcAttempt, getShotKindDetailed, type ShotDatum, type ShotKindDetailed } from "./shot-zone-map"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { collection, query } from "firebase/firestore"
import { openInNewTab } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { VideoMatchService } from "@/lib/video-match-service"

interface ShotAnalysisDashboardProps {
  tournaments: Tournament[]
}

const OUTPUT_LABELS: Record<ShotDatum['output'], string> = {
  goal: "득점", save: "GK 선방", block: "블락", out: "아웃", fail: "실패", unknown: "미분류",
}

function openShotVideo(shot: ShotDatum) {
  if (!shot.videoMatchId || shot.time === undefined) return
  openInNewTab(`/Alter_sportsplay/index.html?matchId=${shot.videoMatchId}&time=${Math.max(0, Math.floor(shot.time))}`)
}

type PlayerStatKey = 'player' | 'total' | 'goal' | 'save' | 'block' | 'out' | 'fail'
type DefenderStatKey = 'defender' | 'total' | 'save' | 'block'

// 상단 KPI 비교 카드용 집계 — total은 isShotOnlyCode 기준("OOO 슈팅" 코드만, PC 코드 중복 제외).
// field/pc/ps는 그 total 안에서의 구분별 개수(합쳐서 total과 같음), pc는 Direct+Var 합계.
interface KpiBucket { total: number, field: number, pc: number, ps: number, goal: number, save: number, block: number }

// 필드슛/PC/PS 및 슈팅 유형(shotType)별 GK 선방율 산출용 — "선방율"은 표준 정의(선방 / (선방+실점))를
// 따름. block/out/fail은 골키퍼가 막았다기보다 다른 방식으로 무산된 시도라 분모에서 제외.
interface GkRateRow { label: string, attempts: number, saves: number, goals: number, rate: number }
function buildGkRateRows(sideShots: ShotDatum[], getKey: (s: ShotDatum) => string | undefined): GkRateRow[] {
  const map = new Map<string, { saves: number, goals: number }>()
  sideShots.forEach(s => {
    if (s.output !== 'save' && s.output !== 'goal') return
    const key = getKey(s)
    if (!key) return
    if (!map.has(key)) map.set(key, { saves: 0, goals: 0 })
    const row = map.get(key)!
    if (s.output === 'save') row.saves++; else row.goals++
  })
  return Array.from(map.entries()).map(([label, v]) => ({
    label, attempts: v.saves + v.goals, saves: v.saves, goals: v.goals,
    rate: (v.saves + v.goals) > 0 ? (v.saves / (v.saves + v.goals)) * 100 : 0,
  })).sort((a, b) => b.attempts - a.attempts)
}

// 지도(ShotZoneMap)/타임라인 로그와 동일한 shot-zone-map.tsx의 getShotKindDetailed를 그대로 써서
// 구분 기준이 화면마다 어긋나지 않게 함. 여기선 표시용 한글/영문 라벨로만 매핑.
const KIND_DETAIL_LABELS: Record<ShotKindDetailed, string> = {
  field: '필드슛', pc_direct: 'PC (Direct)', pc_var: 'PC (Var)', ps: 'PS',
}
function getKindDetailLabel(s: Pick<ShotDatum, 'code' | 'shotType' | 'shotSituation'>): string {
  return KIND_DETAIL_LABELS[getShotKindDetailed(s.code || '', s.shotType, s.shotSituation)]
}

// 득점 시점의 스코어 상황(우세/동점/열세) — 슈팅 태깅과 무관하게 원본 이벤트의 "OOO 득점" 코드
// (경기당 한 번씩 팀 이름으로 찍히는 골 이벤트, quarterly-stats 등 다른 곳에서도 이 코드로 집계함)를
// 시간순으로 훑어서 팀별 누적 스코어를 재구성한다. 슈팅 태깅 도구의 output=goal과는 별개 트랙이라
// (오래된 경기는 슈팅 태깅 자체가 없을 수 있음) 항상 정확하려면 이 원본 코드를 써야 함.
type GoalSituation = 'lead' | 'tied' | 'trail'
interface GoalSituationRow {
  matchId: string, matchName?: string, quarter?: string, time: number,
  scorer?: string, scoreLabel: string, situation: GoalSituation,
  videoMatchId?: string, code: string, team: string,
}
const SITUATION_LABELS: Record<GoalSituation, string> = { lead: '우세', tied: '동점', trail: '열세' }
const SITUATION_COLORS: Record<GoalSituation, string> = { lead: 'text-emerald-600', tied: 'text-amber-600', trail: 'text-rose-600' }

export function ShotAnalysisDashboard({ tournaments }: ShotAnalysisDashboardProps) {
  const [category, setCategory] = useState("")
  const [tournamentId, setTournamentId] = useState<string>("ALL")
  const [teamName, setTeamName] = useState<string>("")

  // 타임라인 로그 전용 하위 필터 — 위쪽 카테고리/대회/팀 캐스케이드는 안 건드림
  const [logTeamFilter, setLogTeamFilter] = useState<'ALL' | 'A' | 'B'>('ALL')
  const [logMatchFilter, setLogMatchFilter] = useState<Set<string> | null>(null) // null = 전체(필터 안 함)
  // 필드슛/PC-Direct/PC-Var/PS 구분 — 태깅 도구의 표준 Type 값(field_shot/PC_direct/PC_var/PS)을
  // 최우선으로, 없으면 code 텍스트로 대체 판별(getShotKindDetailed, shot-zone-map.tsx).
  const [logZoneFilter, setLogZoneFilter] = useState<'ALL' | ShotKindDetailed>('ALL')
  const [logTypeFilter, setLogTypeFilter] = useState<string>('ALL')
  const [logOutputFilter, setLogOutputFilter] = useState<string>('ALL')
  const [logAssistFilter, setLogAssistFilter] = useState<string>('ALL')
  const [logPressureFilter, setLogPressureFilter] = useState<string>('ALL')
  const [logSearch, setLogSearch] = useState('')

  const [playerSortKey, setPlayerSortKey] = useState<PlayerStatKey>('total')
  const [playerSortDesc, setPlayerSortDesc] = useState(true)
  const [defenderSortKey, setDefenderSortKey] = useState<DefenderStatKey>('total')
  const [defenderSortDesc, setDefenderSortDesc] = useState(true)
  // "선수별 슈팅 통계"(공격)와 "수비 기록"(블락/선방) 두 표에 공통으로 적용하는 구분 필터 —
  // PC는 Direct/Var를 합쳐서(여기선 굳이 더 안 쪼갬, 세부 구분은 GK 선방율 표에서 이미 가능).
  const [attemptKindFilter, setAttemptKindFilter] = useState<'ALL' | 'field' | 'pc' | 'ps'>('ALL')
  const matchesAttemptKindFilter = (s: ShotDatum) => {
    if (attemptKindFilter === 'ALL') return true
    const kind = getShotKindDetailed(s.code || '', s.shotType, s.shotSituation)
    return attemptKindFilter === 'pc' ? (kind === 'pc_direct' || kind === 'pc_var') : kind === attemptKindFilter
  }
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false)

  const { toast } = useToast()
  const db = useFirestore()
  const matchesQuery = useMemoFirebase(() => db ? query(collection(db, 'matches')) : null, [db])
  const { data: matches, isLoading } = useCollection<MatchData>(matchesQuery)

  const categories = useMemo(() => {
    const set = new Set(tournaments.map(t => t.category || "미분류"))
    return Array.from(set).sort((a, b) => a === "미분류" ? 1 : b === "미분류" ? -1 : a.localeCompare(b))
  }, [tournaments])
  const effCategory = category && categories.includes(category) ? category : (categories[0] || "")

  const categoryTournaments = useMemo(() => tournaments.filter(t => (t.category || "미분류") === effCategory), [tournaments, effCategory])
  const categoryTournamentIds = useMemo(() => new Set(categoryTournaments.map(t => t.id)), [categoryTournaments])
  const categoryMatches = useMemo(() => (matches || []).filter(m => categoryTournamentIds.has(m.tournamentId || "")), [matches, categoryTournamentIds])

  const scopedMatches = useMemo(() => {
    return tournamentId === "ALL" ? categoryMatches : categoryMatches.filter(m => m.tournamentId === tournamentId)
  }, [categoryMatches, tournamentId])

  const allTeamNames = useMemo(() => {
    return Array.from(new Set(scopedMatches.flatMap(m => [m.homeTeam.name, m.awayTeam.name]))).sort()
  }, [scopedMatches])

  const effectiveTeam = teamName && allTeamNames.includes(teamName) ? teamName : (allTeamNames[0] || "")

  const { shots, teamMatches, kpi } = useMemo(() => {
    const emptyBucket = (): KpiBucket => ({ total: 0, field: 0, pc: 0, ps: 0, goal: 0, save: 0, block: 0 })
    if (!effectiveTeam) return { shots: [] as ShotDatum[], teamMatches: [] as MatchData[], kpi: { us: emptyBucket(), opp: emptyBucket() } }

    const relevant = scopedMatches.filter(m => m.homeTeam.name === effectiveTeam || m.awayTeam.name === effectiveTeam)
    const result: ShotDatum[] = []
    const kpiSum = { us: emptyBucket(), opp: emptyBucket() }

    relevant.forEach(m => {
      m.events.forEach((e, idx) => {
        if (!isShotAttemptCode(e.code)) return
        // 좌표(xLoc/yLoc/xGoal/yGoal/outDir)가 없는 시도(특히 PC — 위치를 안 찍는 경우가 대부분)도
        // 지도엔 못 그리지만 타임라인 로그·통계·재생목록엔 포함해야 하므로 여기서 걸러내지 않음
        // (지도 쪽은 ShotZoneMap 내부에서 좌표 있는 것만 알아서 골라 그림).
        const isUs = e.team === effectiveTeam
        const output = normalizeShotOutput(e.shotOutput, e.resultLabel, e.outDir)
        result.push({
          // MatchEvent.id가 경기 내에서도 중복될 수 있어서(Sportscode 원본 데이터 특성,
          // match-event-timeline.tsx와 동일한 이유) 경기ID+인덱스 조합을 진짜 식별자로 씀.
          id: `${m.id}-${idx}`, side: isUs ? 'A' : 'B', teamName: e.team, player: e.shooter, defender: e.defender, output,
          shotType: e.shotType, shotSituation: e.shotSituation, isPC: isPcAttempt(e.code, e.shotType, e.shotSituation), code: e.code,
          assistType: e.assistType, defensePressure: e.defensePressure,
          xLoc: e.xLoc, yLoc: e.yLoc, xGoal: e.xGoal, yGoal: e.yGoal, outDir: e.outDir,
          matchName: m.matchName, quarter: e.quarter, time: e.time,
          matchId: m.id, videoMatchId: m.videoMatchId,
        })
        // KPI 합계는 code가 "OOO 페널티코너"로 따로 태깅된 이벤트를 빼고 "OOO 슈팅"만 센다 —
        // 그 슈팅이 PC 상황이었는지는 이미 shotSituation/shotType에 담겨 있어서, PC 코드
        // 이벤트까지 같이 세면 같은 장면이 두 번(슈팅 1 + PC 1) 잡혀 총 슈팅 수가 부풀려짐.
        // 지도(ShotZoneMap)에 넘기는 result에는 그대로 다 넣어서 PC 사각형 표시는 안 건드림.
        if (!isShotOnlyCode(e.code)) return
        const bucket = isUs ? kpiSum.us : kpiSum.opp
        bucket.total++
        const kind = getShotKindDetailed(e.code, e.shotType, e.shotSituation)
        if (kind === 'field') bucket.field++
        else if (kind === 'ps') bucket.ps++
        else bucket.pc++ // pc_direct + pc_var 합계
        if (output === 'goal') bucket.goal++
        else if (output === 'save') bucket.save++
        else if (output === 'block') bucket.block++
      })
    })

    return { shots: result, teamMatches: relevant, kpi: kpiSum }
  }, [scopedMatches, effectiveTeam])

  const playerStats = useMemo(() => {
    const map = new Map<string, { player: string, total: number, goal: number, save: number, block: number, out: number, fail: number }>()
    // KPI와 동일하게 "OOO 페널티코너" 코드는 제외 — PC 여부는 이미 shotType/badge로 표시되므로
    // "OOO 슈팅"만 세야 선수별 총 시도 수가 중복 없이 나옴.
    shots.filter(s => s.side === 'A' && s.player && isShotOnlyCode(s.code || '') && matchesAttemptKindFilter(s)).forEach(s => {
      const key = s.player!
      if (!map.has(key)) map.set(key, { player: key, total: 0, goal: 0, save: 0, block: 0, out: 0, fail: 0 })
      const row = map.get(key)!
      row.total++
      if (s.output !== 'unknown') (row as any)[s.output]++
    })
    const arr = Array.from(map.values())
    arr.sort((a, b) => {
      const av = a[playerSortKey], bv = b[playerSortKey]
      if (typeof av === 'string' || typeof bv === 'string') {
        const cmp = String(av).localeCompare(String(bv), 'ko')
        return playerSortDesc ? -cmp : cmp
      }
      return playerSortDesc ? (bv as number) - (av as number) : (av as number) - (bv as number)
    })
    return arr
  }, [shots, playerSortKey, playerSortDesc, attemptKindFilter])

  const togglePlayerSort = (key: PlayerStatKey) => {
    if (playerSortKey === key) setPlayerSortDesc(d => !d)
    else { setPlayerSortKey(key); setPlayerSortDesc(key !== 'player') }
  }

  // 상대팀이 우리 쪽 골문으로 쏜 시도(side 'B') 전체 — 이 팀 수비진(골키퍼/필드 블로커)의
  // 블락·선방 기록과 키퍼 선방율은 전부 이 집합 기준으로 계산한다.
  const ourDefenseShots = useMemo(() => shots.filter(s => s.side === 'B' && isShotOnlyCode(s.code || '')), [shots])

  const defenderStats = useMemo(() => {
    const map = new Map<string, { defender: string, save: number, block: number, total: number }>()
    ourDefenseShots.filter(s => s.defender && (s.output === 'save' || s.output === 'block') && matchesAttemptKindFilter(s)).forEach(s => {
      const key = s.defender!
      if (!map.has(key)) map.set(key, { defender: key, save: 0, block: 0, total: 0 })
      const row = map.get(key)!
      if (s.output === 'save') row.save++; else row.block++
      row.total++
    })
    const arr = Array.from(map.values())
    arr.sort((a, b) => {
      const av = a[defenderSortKey], bv = b[defenderSortKey]
      if (typeof av === 'string' || typeof bv === 'string') {
        const cmp = String(av).localeCompare(String(bv), 'ko')
        return defenderSortDesc ? -cmp : cmp
      }
      return defenderSortDesc ? (bv as number) - (av as number) : (av as number) - (bv as number)
    })
    return arr
  }, [ourDefenseShots, defenderSortKey, defenderSortDesc, attemptKindFilter])

  const toggleDefenderSort = (key: DefenderStatKey) => {
    if (defenderSortKey === key) setDefenderSortDesc(d => !d)
    else { setDefenderSortKey(key); setDefenderSortDesc(key !== 'defender') }
  }

  // 골키퍼 선택 — block은 필드 플레이어 기록이라(defender 필드가 골키퍼/필드 블로커를 같이 담음)
  // save/goal(골키퍼가 실제로 상대한 시도)에 등장한 defender만 키퍼 후보로 잡는다.
  const [selectedKeeper, setSelectedKeeper] = useState<string>('ALL')
  const keeperNames = useMemo(() => Array.from(new Set(
    ourDefenseShots.filter(s => (s.output === 'save' || s.output === 'goal') && s.defender).map(s => s.defender!)
  )).sort((a, b) => a.localeCompare(b, 'ko')), [ourDefenseShots])
  const gkScopedShots = useMemo(
    () => selectedKeeper === 'ALL' ? ourDefenseShots : ourDefenseShots.filter(s => s.defender === selectedKeeper),
    [ourDefenseShots, selectedKeeper]
  )

  // 골키퍼 선방율 — 필드슛/PC(Direct)/PC(Var)/PS 구분별, 그리고 슈팅 유형(shotType)별로 각각.
  const gkRateByKind = useMemo(() => buildGkRateRows(gkScopedShots, getKindDetailLabel), [gkScopedShots])
  const gkRateByType = useMemo(() => buildGkRateRows(gkScopedShots, s => s.shotType), [gkScopedShots])

  // effectiveTeam이 관여한 경기들의 득점 이벤트를 시간순으로 재구성해서, 각 득점이
  // 그 시점 스코어 기준 우세/동점/열세 중 어느 상황에서 나온 건지 계산.
  const goalSituations = useMemo(() => {
    if (!effectiveTeam) return [] as GoalSituationRow[]
    const rows: GoalSituationRow[] = []
    teamMatches.forEach(m => {
      const homeName = m.homeTeam.name, awayName = m.awayTeam.name
      const goalEvents = m.events
        .filter(e => e.code.trim() === `${homeName} 득점` || e.code.trim() === `${awayName} 득점`)
        .slice()
        .sort((a, b) => a.time - b.time)
      const score: Record<string, number> = { [homeName]: 0, [awayName]: 0 }
      goalEvents.forEach(e => {
        const scoringTeam = e.team
        const opponent = scoringTeam === homeName ? awayName : homeName
        const before = score[scoringTeam] ?? 0
        const oppBefore = score[opponent] ?? 0
        if (scoringTeam === effectiveTeam) {
          const situation: GoalSituation = before > oppBefore ? 'lead' : before === oppBefore ? 'tied' : 'trail'
          rows.push({
            matchId: m.id || '', matchName: m.matchName, quarter: e.quarter, time: e.time,
            scorer: e.relatedPlayer, scoreLabel: `${before + 1} : ${oppBefore}`, situation,
            videoMatchId: m.videoMatchId, code: e.code, team: e.team,
          })
        }
        score[scoringTeam] = before + 1
      })
    })
    return rows.sort((a, b) => (a.matchName || '').localeCompare(b.matchName || '') || a.time - b.time)
  }, [teamMatches, effectiveTeam])

  const goalSituationSummary = useMemo(() => {
    const c: Record<GoalSituation, number> = { lead: 0, tied: 0, trail: 0 }
    goalSituations.forEach(r => c[r.situation]++)
    return c
  }, [goalSituations])

  const openGoalVideo = (row: GoalSituationRow) => {
    if (!row.videoMatchId) return
    openInNewTab(`/Alter_sportsplay/index.html?matchId=${row.videoMatchId}&time=${Math.max(0, Math.floor(row.time))}`)
  }

  const shotTypes = useMemo(() => Array.from(new Set(shots.map(s => s.shotType).filter(Boolean))) as string[], [shots])
  const assistTypes = useMemo(() => Array.from(new Set(shots.map(s => s.assistType).filter(Boolean))) as string[], [shots])
  const pressureLevels = useMemo(() => Array.from(new Set(shots.map(s => s.defensePressure).filter(Boolean))) as string[], [shots])

  // 로그 필터 — 경기 다중선택은 null(전체)이 기본, 사용자가 한 번이라도 체크박스를 건드리면 Set으로 좁혀짐
  const logRows = useMemo(() => {
    // "OOO 페널티코너" 코드는 로그에서 제외 — 같은 시도가 "OOO 슈팅"으로 이미 한 번 잡혀
    // 있는데 PC 코드까지 별도 행으로 뜨면 중복으로 보임(사용자 피드백). PC 여부는 행의
    // "타입" 배지(getShotKind)로 그대로 표시됨.
    let rows = shots.filter(s => isShotOnlyCode(s.code || ''))
    if (logTeamFilter !== 'ALL') rows = rows.filter(s => s.side === logTeamFilter)
    if (logMatchFilter) rows = rows.filter(s => s.matchId && logMatchFilter.has(s.matchId))
    if (logZoneFilter !== 'ALL') rows = rows.filter(s => getShotKindDetailed(s.code || '', s.shotType, s.shotSituation) === logZoneFilter)
    if (logTypeFilter !== 'ALL') rows = rows.filter(s => s.shotType === logTypeFilter)
    if (logOutputFilter !== 'ALL') rows = rows.filter(s => s.output === logOutputFilter)
    if (logAssistFilter !== 'ALL') rows = rows.filter(s => s.assistType === logAssistFilter)
    if (logPressureFilter !== 'ALL') rows = rows.filter(s => s.defensePressure === logPressureFilter)
    if (logSearch.trim()) {
      const q = logSearch.trim().toLowerCase()
      rows = rows.filter(s => `${s.player || ''} ${s.matchName || ''} ${s.teamName}`.toLowerCase().includes(q))
    }
    return [...rows].sort((a, b) => (a.matchName || '').localeCompare(b.matchName || '') || (a.time ?? 0) - (b.time ?? 0))
  }, [shots, logTeamFilter, logMatchFilter, logZoneFilter, logTypeFilter, logOutputFilter, logAssistFilter, logPressureFilter, logSearch])

  const resetLogFilters = () => {
    setLogTeamFilter('ALL'); setLogMatchFilter(null); setLogZoneFilter('ALL'); setLogTypeFilter('ALL'); setLogOutputFilter('ALL')
    setLogAssistFilter('ALL'); setLogPressureFilter('ALL'); setLogSearch('')
    // 팀/대회가 바뀌면 keeperNames 후보 자체가 바뀌므로 이전 팀의 키퍼 이름이 그대로 남아
    // 빈 표로 보이지 않도록 같이 초기화.
    setSelectedKeeper('ALL')
  }

  const toggleMatchInFilter = (matchId: string, allMatchIds: string[]) => {
    setLogMatchFilter(prev => {
      const base = prev ? new Set(prev) : new Set(allMatchIds)
      if (base.has(matchId)) base.delete(matchId); else base.add(matchId)
      return base
    })
  }

  // 지금 필터에 걸린 행들만 모아서 비디오 도구 재생목록으로 만듭니다. 이 화면은 여러 경기를
  // 한 번에 모아 보여주는 화면이라(match-event-timeline.tsx의 단일 경기 버전과 달리) 필터링된
  // 행이 여러 경기에 걸쳐 있을 수 있는데, Alter_sportsplay의 연속재생은 "한 경기 영상"만 이어
  // 재생하는 구조라(player.js — 클립 넘어갈 때 경기/카메라를 안 바꾸고 그냥 seek만 함) 경기가
  // 섞인 하나의 재생목록을 만들면 다른 경기 클립은 엉뚱한 시점을 보여주게 됨. 그래서 경기별로
  // 나눠서 각각 재생목록을 만들고, 첫 번째 것만 새 탭으로 열어줌(나머지는 영상 도구 라이브러리
  // 탭에서 목록으로 볼 수 있음).
  const handleCreatePlaylist = async () => {
    if (!db || logRows.length === 0) return
    const byMatch = new Map<string, { matchName: string, rows: ShotDatum[] }>()
    logRows.forEach(s => {
      if (!s.videoMatchId || !s.code || s.time === undefined) return
      const key = s.videoMatchId
      if (!byMatch.has(key)) byMatch.set(key, { matchName: s.matchName || '경기', rows: [] })
      byMatch.get(key)!.rows.push(s)
    })
    if (byMatch.size === 0) {
      toast({ title: "영상이 연결된 행이 없어요", description: "필터에 걸린 슈팅 중 영상이 연결된 경기의 시도가 없습니다.", variant: "destructive" })
      return
    }

    setIsCreatingPlaylist(true)
    try {
      const created: { matchName: string, playlistId: string, matchedCount: number }[] = []
      for (const [videoMatchId, group] of byMatch) {
        const events = group.rows.map(s => ({ code: s.code!, team: s.teamName, time: s.time! }))
        const title = `${effectiveTeam} 슈팅분석 — ${group.matchName} (${events.length}개)`
        const { playlistId, matchedCount } = await VideoMatchService.createPlaylistFromEvents(db, videoMatchId, events, title)
        if (matchedCount > 0) created.push({ matchName: group.matchName, playlistId, matchedCount })
      }
      if (created.length === 0) {
        toast({ title: "영상 도구에서 매칭되는 클립을 찾지 못했어요", description: "영상 연결 후 이벤트가 동기화됐는지 확인해주세요.", variant: "destructive" })
        return
      }
      // 경기가 여러 개로 나뉜 경우 서로 연결해서, 영상 도구 안에서 "다음/이전 경기" 버튼으로
      // 바로 넘나들 수 있게 함 (한 선수의 PC를 여러 경기에 걸쳐 이어보는 용도).
      if (created.length > 1) {
        await VideoMatchService.linkPlaylistSiblings(db, created.map(c => c.playlistId))
      }
      const url = `${window.location.origin}/Alter_sportsplay/index.html?playlistId=${created[0].playlistId}&lock=1`
      openInNewTab(url)
      try { await navigator.clipboard.writeText(url) } catch {}
      const totalClips = created.reduce((sum, c) => sum + c.matchedCount, 0)
      toast({
        title: created.length > 1
          ? `경기 ${created.length}개로 나눠 재생목록 ${created.length}개 생성 (총 ${totalClips}개 클립)`
          : `재생목록 생성 완료 (${totalClips}개 클립)`,
        description: created.length > 1
          ? `여러 경기가 섞여 있어 경기별로 나눴어요. "${created[0].matchName}" 재생목록을 새 탭에서 열었어요 — 나머지는 영상 도구의 재생목록 목록에서 볼 수 있어요.`
          : "새 탭에서 바로 재생돼요 — 링크도 클립보드에 복사했어요.",
      })
    } catch (e: any) {
      toast({ title: "재생목록 생성 실패", description: e.message, variant: "destructive" })
    } finally {
      setIsCreatingPlaylist(false)
    }
  }

  const sortIcon = (key: PlayerStatKey) => playerSortKey !== key
    ? <ArrowUpDown className="h-3 w-3 opacity-40" />
    : playerSortDesc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />

  return (
    <div className="space-y-8">
      <div className="border-b-4 border-primary pb-4 flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-xl font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Target className="h-5 w-5" /> 슈팅 분석
          </h2>
          <p className="text-sm text-muted-foreground mt-1">대회·팀을 선택하면 태깅된 모든 슈팅/PC 시도의 발사 위치와 골대 타겟을 누적해서 보여줍니다.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />불러오는 중...</div>
      ) : categories.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">등록된 대회가 없습니다.</div>
      ) : (
        <div className="space-y-6">
          {categories.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase mr-1 flex items-center gap-1"><Users className="h-3 w-3" /> 카테고리</span>
              {categories.map(c => (
                <Button key={c} size="sm" variant={effCategory === c ? 'default' : 'outline'} className="h-7 text-[11px] font-bold px-2.5"
                  onClick={() => { setCategory(c); setTournamentId("ALL"); setTeamName(""); resetLogFilters() }}>{c}</Button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1"><Trophy className="h-3 w-3" /> 대회</Label>
              <Select value={tournamentId} onValueChange={(v) => { setTournamentId(v); setTeamName(""); resetLogFilters() }}>
                <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">전체 대회 ({effCategory})</SelectItem>
                  {categoryTournaments.map(t => <SelectItem key={t.id} value={t.id!}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1"><Users className="h-3 w-3" /> 팀</Label>
              <Select value={effectiveTeam} onValueChange={(v) => { setTeamName(v); resetLogFilters() }}>
                <SelectTrigger className="h-9 w-48"><SelectValue placeholder="팀 선택" /></SelectTrigger>
                <SelectContent>
                  {allTeamNames.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!effectiveTeam ? (
            <div className="py-16 text-center text-muted-foreground">"{effCategory}" 카테고리에 등록된 경기가 없습니다.</div>
          ) : (
        <>
          {/* 우리팀 vs 상대팀 KPI 비교 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {([['us', effectiveTeam + ' (우리팀)', 'text-primary', 'border-primary/30', 'text-emerald-600'],
               ['opp', '상대팀 전체', 'text-muted-foreground', '', 'text-rose-600']] as const).map(([key, label, titleColor, border, goalColor]) => {
              const b = kpi[key]
              const goalRate = b.total > 0 ? Math.round((b.goal / b.total) * 100) : 0
              const validShots = b.goal + b.save
              return (
                <Card key={key} className={`border-2 ${border}`}>
                  <CardContent className="pt-5">
                    <div className={`text-xs font-black uppercase tracking-widest mb-3 ${titleColor}`}>{label}</div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
                      <div><div className="text-2xl font-black">{b.total}</div><div className="text-[10px] text-muted-foreground font-bold uppercase">총 슈팅</div></div>
                      <div><div className="text-xl font-black">{b.field}</div><div className="text-[10px] text-muted-foreground font-bold uppercase">필드슛</div></div>
                      <div><div className="text-xl font-black">{b.pc}</div><div className="text-[10px] text-muted-foreground font-bold uppercase">PC</div></div>
                      <div><div className="text-xl font-black">{b.ps}</div><div className="text-[10px] text-muted-foreground font-bold uppercase">PS</div></div>
                      <div><div className={`text-2xl font-black ${goalColor}`}>{b.goal}</div><div className="text-[10px] text-muted-foreground font-bold uppercase">득점 ({goalRate}%)</div></div>
                      <div><div className="text-2xl font-black">{validShots}</div><div className="text-[10px] text-muted-foreground font-bold uppercase">유효슈팅<br />(득점+선방)</div></div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatsCard title={`${effectiveTeam} 유효슈팅률`} value={kpi.us.total > 0 ? ((kpi.us.goal + kpi.us.save) / kpi.us.total) * 100 : 0} isPercentage icon={<Target className="h-4 w-4" />} />
            <StatsCard title="득점률" value={kpi.us.total > 0 ? (kpi.us.goal / kpi.us.total) * 100 : 0} isPercentage icon={<Target className="h-4 w-4" />} />
            <StatsCard title="상대 GK 선방" value={kpi.us.save} icon={<ShieldCheck className="h-4 w-4" />} />
            <StatsCard title="상대 블락" value={kpi.us.block} icon={<ShieldCheck className="h-4 w-4" />} />
          </div>

          <ShotZoneMap
            shots={shots}
            sideALabel={effectiveTeam}
            sideBLabel="상대팀"
            title={`${effectiveTeam} 슈팅 위치 · 골대 타겟`}
            description={`${teamMatches.length}경기 누적 · 좌표가 태깅된 슈팅/PC 시도만 표시됩니다 · 점을 클릭하면 그 장면 영상으로 이동합니다`}
            defaultGrid
            onShotClick={openShotVideo}
          />

          {/* 타임라인 로그 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2"><ListVideo className="h-5 w-5" /> 타임라인 로그</CardTitle>
                <CardDescription>{logRows.length}건 표시 중 (전체 {shots.length}건) · 행을 클릭하면 영상이 연결된 경기는 그 장면으로 바로 이동합니다</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={isCreatingPlaylist || logRows.length === 0}
                  onClick={handleCreatePlaylist}
                  className="h-8 text-xs font-bold gap-1.5"
                >
                  {isCreatingPlaylist ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ListVideo className="h-3.5 w-3.5" />}
                  이 필터로 재생목록 만들기 ({logRows.length}개)
                </Button>
                <Button variant="ghost" size="sm" onClick={resetLogFilters} className="h-8 text-xs font-bold gap-1.5"><RotateCcw className="h-3.5 w-3.5" /> 필터 초기화</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-md border overflow-hidden">
                  {(['ALL', 'A', 'B'] as const).map(v => (
                    <button key={v} onClick={() => setLogTeamFilter(v)}
                      className={`px-3 py-1.5 text-xs font-bold transition-colors ${logTeamFilter === v ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}>
                      {v === 'ALL' ? '전체 팀' : v === 'A' ? effectiveTeam : '상대팀'}
                    </button>
                  ))}
                </div>

                <div className="flex rounded-md border overflow-hidden">
                  {([['ALL', '전체 유형'], ['field', '필드슛'], ['pc_direct', 'PC-Direct'], ['pc_var', 'PC-Var'], ['ps', 'PS']] as const).map(([v, label]) => (
                    <button key={v} onClick={() => setLogZoneFilter(v)}
                      className={`px-3 py-1.5 text-xs font-bold transition-colors ${logZoneFilter === v ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs font-bold">
                      경기 {logMatchFilter ? `${logMatchFilter.size}개 선택` : '전체'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 max-h-72 overflow-y-auto space-y-1">
                    {teamMatches.map(m => {
                      const allIds = teamMatches.map(x => x.id!).filter(Boolean)
                      const checked = logMatchFilter ? logMatchFilter.has(m.id!) : true
                      return (
                        <label key={m.id} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/60 cursor-pointer text-xs">
                          <Checkbox checked={checked} onCheckedChange={() => toggleMatchInFilter(m.id!, allIds)} />
                          <span className="truncate">{m.matchName || `${m.homeTeam.name} vs ${m.awayTeam.name}`}</span>
                        </label>
                      )
                    })}
                  </PopoverContent>
                </Popover>

                <Select value={logTypeFilter} onValueChange={setLogTypeFilter}>
                  <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="슈팅 종류" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">전체 종류</SelectItem>
                    {shotTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={logOutputFilter} onValueChange={setLogOutputFilter}>
                  <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="결과" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">전체 결과</SelectItem>
                    {(Object.keys(OUTPUT_LABELS) as ShotDatum['output'][]).map(k => <SelectItem key={k} value={k}>{OUTPUT_LABELS[k]}</SelectItem>)}
                  </SelectContent>
                </Select>

                {assistTypes.length > 0 && (
                  <Select value={logAssistFilter} onValueChange={setLogAssistFilter}>
                    <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="어시스트" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">전체 어시스트</SelectItem>
                      {assistTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}

                {pressureLevels.length > 0 && (
                  <Select value={logPressureFilter} onValueChange={setLogPressureFilter}>
                    <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="수비 압박" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">전체 압박강도</SelectItem>
                      {pressureLevels.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}

                <div className="relative flex-1 min-w-[160px]">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={logSearch} onChange={(e) => setLogSearch(e.target.value)} placeholder="선수/경기명 검색..." className="h-8 pl-8 text-xs" />
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>팀</TableHead>
                      <TableHead>경기</TableHead>
                      <TableHead>쿼터/시간</TableHead>
                      <TableHead>선수</TableHead>
                      <TableHead className="text-center">타입</TableHead>
                      <TableHead className="text-center">결과</TableHead>
                      <TableHead className="text-center">OUT</TableHead>
                      <TableHead className="text-center">어시스트</TableHead>
                      <TableHead className="text-center">수비 압박</TableHead>
                      <TableHead className="text-right">좌표</TableHead>
                      <TableHead className="text-center">영상</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logRows.length === 0 ? (
                      <TableRow><TableCell colSpan={11} className="text-center py-10 text-muted-foreground">조건에 맞는 슈팅이 없습니다.</TableCell></TableRow>
                    ) : logRows.map(s => {
                      const canPlay = !!s.videoMatchId
                      const min = s.time !== undefined ? Math.floor(s.time / 60) : null
                      const sec = s.time !== undefined ? Math.floor(s.time % 60) : null
                      return (
                        <TableRow
                          key={s.id}
                          className={canPlay ? "cursor-pointer hover:bg-primary/5" : ""}
                          onClick={() => canPlay && openShotVideo(s)}
                          title={canPlay ? "클릭하면 이 장면 영상으로 이동합니다" : "이 경기는 영상이 연결돼있지 않습니다"}
                        >
                          <TableCell>
                            <Badge variant={s.side === 'A' ? 'default' : 'secondary'} className="text-[10px]">{s.side === 'A' ? effectiveTeam : s.teamName}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[160px] truncate text-xs font-semibold">{s.matchName || '-'}</TableCell>
                          <TableCell className="text-xs">{s.quarter || ''} {min !== null ? `${min}:${String(sec).padStart(2, '0')}` : ''}</TableCell>
                          <TableCell className="text-xs font-bold">{s.player || '-'}</TableCell>
                          <TableCell className="text-center text-[11px]">
                            {(() => {
                              const kind = getShotKindDetailed(s.code || '', s.shotType, s.shotSituation)
                              const kindMeta = {
                                field: ['필드슛', 'outline'], pc_direct: ['PC-Direct', 'destructive'],
                                pc_var: ['PC-Var', 'default'], ps: ['PS', 'secondary'],
                              } as const
                              const [kindLabel, kindVariant] = kindMeta[kind]
                              return (
                                <div className="flex flex-col items-center gap-0.5">
                                  <Badge variant={kindVariant} className="text-[9px] px-1.5 py-0">{kindLabel}</Badge>
                                  {s.shotType && <span className="text-muted-foreground">{s.shotType}</span>}
                                </div>
                              )
                            })()}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-[10px]">{OUTPUT_LABELS[s.output]}</Badge>
                          </TableCell>
                          <TableCell className="text-center text-[11px] text-amber-600 font-bold">{s.outDir || '-'}</TableCell>
                          <TableCell className="text-center text-[11px]">{s.assistType || '-'}</TableCell>
                          <TableCell className="text-center text-[11px]">{s.defensePressure || '-'}</TableCell>
                          <TableCell className="text-right text-[10px] font-mono text-muted-foreground">
                            {s.xLoc !== undefined ? `${s.xLoc},${s.yLoc}` : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {canPlay ? <Video className="h-4 w-4 mx-auto text-primary" /> : <Video className="h-4 w-4 mx-auto opacity-20" />}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* 아래 "선수별 슈팅 통계"·"수비 기록" 두 표에 공통 적용 — 필터 결과가 0건이어도
              컨트롤 자체는 계속 보여야 하니 playerStats/defenderStats 길이로 안 가림. */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">구분 (아래 선수별 슈팅 통계 · 수비 기록 공통 적용)</span>
            <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
              {([['ALL', '전체'], ['field', '필드슛'], ['pc', 'PC'], ['ps', 'PS']] as const).map(([v, label]) => (
                <button key={v} onClick={() => setAttemptKindFilter(v)}
                  className={`text-xs font-bold px-2 py-1 rounded transition-colors ${attemptKindFilter === v ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {playerStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Table2 className="h-5 w-5" /> 선수별 슈팅 통계</CardTitle>
                <CardDescription>{effectiveTeam} 선수 기준 (슈터 라벨이 태깅된 시도만 집계) · 컬럼을 클릭하면 정렬됩니다</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {([
                        ['player', '선수', 'left'],
                        ['total', '총 시도', 'center'],
                        ['goal', '득점', 'center'],
                        ['save', 'GK 선방', 'center'],
                        ['block', '블락', 'center'],
                        ['out', '아웃', 'center'],
                        ['fail', '실패', 'center'],
                      ] as [PlayerStatKey, string, string][]).map(([key, label, align]) => (
                        <TableHead key={key} className={`cursor-pointer select-none hover:text-primary transition-colors ${align === 'center' ? 'text-center' : ''}`} onClick={() => togglePlayerSort(key)}>
                          <span className={`inline-flex items-center gap-1 ${align === 'center' ? 'justify-center' : ''}`}>{label} {sortIcon(key)}</span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {playerStats.map(row => (
                      <TableRow key={row.player}>
                        <TableCell className="font-bold">{row.player}</TableCell>
                        <TableCell className="text-center font-bold text-primary">{row.total}</TableCell>
                        <TableCell className="text-center text-emerald-600 font-bold">{row.goal}</TableCell>
                        <TableCell className="text-center">{row.save}</TableCell>
                        <TableCell className="text-center">{row.block}</TableCell>
                        <TableCell className="text-center">{row.out}</TableCell>
                        <TableCell className="text-center">{row.fail}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {defenderStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> 수비 기록 (블락 · GK 선방)</CardTitle>
                <CardDescription>{effectiveTeam}이 상대 슈팅/PC를 막은 선수 기준 · 컬럼을 클릭하면 정렬됩니다</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {([
                        ['defender', '선수', 'left'],
                        ['total', '합계', 'center'],
                        ['save', 'GK 선방', 'center'],
                        ['block', '블락', 'center'],
                      ] as [DefenderStatKey, string, string][]).map(([key, label, align]) => (
                        <TableHead key={key} className={`cursor-pointer select-none hover:text-primary transition-colors ${align === 'center' ? 'text-center' : ''}`} onClick={() => toggleDefenderSort(key)}>
                          <span className={`inline-flex items-center gap-1 ${align === 'center' ? 'justify-center' : ''}`}>{label}</span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {defenderStats.map(row => (
                      <TableRow key={row.defender}>
                        <TableCell className="font-bold">{row.defender}</TableCell>
                        <TableCell className="text-center font-bold text-primary">{row.total}</TableCell>
                        <TableCell className="text-center text-sky-600 font-bold">{row.save}</TableCell>
                        <TableCell className="text-center text-purple-600 font-bold">{row.block}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {keeperNames.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> 골키퍼 선방율</CardTitle>
                  <CardDescription>{effectiveTeam}이 막아낸 상대 슈팅/PC 기준 (선방율 = 선방 / (선방 + 실점)) · PC는 Direct/Var 구분됩니다 · 블락은 필드 플레이어 기록이라 제외</CardDescription>
                </div>
                <Select value={selectedKeeper} onValueChange={setSelectedKeeper}>
                  <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="키퍼 선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">전체 키퍼</SelectItem>
                    {keeperNames.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {gkRateByKind.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase mb-2">구분별</p>
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>구분</TableHead>
                        <TableHead className="text-center">시도</TableHead>
                        <TableHead className="text-center">선방</TableHead>
                        <TableHead className="text-center">실점</TableHead>
                        <TableHead className="text-center">선방율</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {gkRateByKind.map(row => (
                          <TableRow key={row.label}>
                            <TableCell className="font-bold">{row.label}</TableCell>
                            <TableCell className="text-center">{row.attempts}</TableCell>
                            <TableCell className="text-center text-sky-600">{row.saves}</TableCell>
                            <TableCell className="text-center text-rose-600">{row.goals}</TableCell>
                            <TableCell className="text-center font-bold text-primary">{row.rate.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {gkRateByType.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase mb-2">슈팅 유형별</p>
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>유형</TableHead>
                        <TableHead className="text-center">시도</TableHead>
                        <TableHead className="text-center">선방</TableHead>
                        <TableHead className="text-center">실점</TableHead>
                        <TableHead className="text-center">선방율</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {gkRateByType.map(row => (
                          <TableRow key={row.label}>
                            <TableCell className="font-bold">{row.label}</TableCell>
                            <TableCell className="text-center">{row.attempts}</TableCell>
                            <TableCell className="text-center text-sky-600">{row.saves}</TableCell>
                            <TableCell className="text-center text-rose-600">{row.goals}</TableCell>
                            <TableCell className="text-center font-bold text-primary">{row.rate.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {goalSituations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> 득점 상황 분석</CardTitle>
                <CardDescription>{effectiveTeam}의 득점이 그 시점 스코어 기준 우세/동점/열세 중 어느 상황에서 나왔는지</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-emerald-50 py-3">
                    <div className="text-2xl font-black text-emerald-600">{goalSituationSummary.lead}</div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase">우세 상황 득점</div>
                  </div>
                  <div className="rounded-lg bg-amber-50 py-3">
                    <div className="text-2xl font-black text-amber-600">{goalSituationSummary.tied}</div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase">동점 상황 득점</div>
                  </div>
                  <div className="rounded-lg bg-rose-50 py-3">
                    <div className="text-2xl font-black text-rose-600">{goalSituationSummary.trail}</div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase">열세 상황 득점</div>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>경기</TableHead>
                      <TableHead>쿼터/시간</TableHead>
                      <TableHead>득점자</TableHead>
                      <TableHead className="text-center">스코어</TableHead>
                      <TableHead className="text-center">상황</TableHead>
                      <TableHead className="text-center">영상</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {goalSituations.map((row, i) => {
                        const canPlay = !!row.videoMatchId
                        const min = Math.floor(row.time / 60), sec = Math.floor(row.time % 60)
                        return (
                          <TableRow
                            key={`${row.matchId}-${i}`}
                            className={canPlay ? "cursor-pointer hover:bg-primary/5" : ""}
                            onClick={() => canPlay && openGoalVideo(row)}
                            title={canPlay ? "클릭하면 이 득점 장면 영상으로 이동합니다" : "이 경기는 영상이 연결돼있지 않습니다"}
                          >
                            <TableCell className="max-w-[160px] truncate text-xs font-semibold">{row.matchName || '-'}</TableCell>
                            <TableCell className="text-xs">{row.quarter || ''} {min}:{String(sec).padStart(2, '0')}</TableCell>
                            <TableCell className="text-xs font-bold">{row.scorer || '-'}</TableCell>
                            <TableCell className="text-center text-xs font-mono">{row.scoreLabel}</TableCell>
                            <TableCell className={`text-center text-xs font-bold ${SITUATION_COLORS[row.situation]}`}>{SITUATION_LABELS[row.situation]}</TableCell>
                            <TableCell className="text-center">
                              {canPlay ? <Video className="h-4 w-4 mx-auto text-primary" /> : <Video className="h-4 w-4 mx-auto opacity-20" />}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
          )}
        </div>
      )}
    </div>
  )
}
