
"use client"

// Phase 7 — "슈팅 분석" 전용 화면. 대회(또는 전체) → 팀을 고르면 그 팀이 시도한 모든 슈팅/PC를
// 필드 발사위치·골대 타겟 두 지도로 누적해서 보여줌. 그리드 토글은 ShotZoneMap 내부에서 처리.
// 하키는 남자/여자 대회가 완전히 분리돼있어서(같은 "한국"이라도 다른 팀) "전체 대회"도 실제로는
// "선택한 카테고리 안의 전체 대회"를 뜻하도록 카테고리를 먼저 고르게 함. category 없는 대회는 "미분류".
import { useMemo, useState } from "react"
import { Trophy, Users, Loader2, Target, Sword, ShieldCheck, Table2 } from "lucide-react"
import type { MatchData, Tournament } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { StatsCard } from "./stats-card"
import { ShotZoneMap, isShotAttemptCode, normalizeShotOutput, isPcAttempt, type ShotDatum } from "./shot-zone-map"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { collection, query } from "firebase/firestore"

interface ShotAnalysisDashboardProps {
  tournaments: Tournament[]
}

export function ShotAnalysisDashboard({ tournaments }: ShotAnalysisDashboardProps) {
  const [category, setCategory] = useState("")
  const [tournamentId, setTournamentId] = useState<string>("ALL")
  const [teamName, setTeamName] = useState<string>("")

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
    if (!effectiveTeam) return { shots: [] as ShotDatum[], teamMatches: [] as MatchData[], kpi: { us: { total: 0, goal: 0, save: 0, block: 0 }, opp: { total: 0, goal: 0, save: 0, block: 0 } } }

    const relevant = scopedMatches.filter(m => m.homeTeam.name === effectiveTeam || m.awayTeam.name === effectiveTeam)
    const result: ShotDatum[] = []
    const kpiSum = { us: { total: 0, goal: 0, save: 0, block: 0 }, opp: { total: 0, goal: 0, save: 0, block: 0 } }

    relevant.forEach(m => {
      m.events.forEach(e => {
        if (!isShotAttemptCode(e.code)) return
        if (e.xLoc === undefined && e.yLoc === undefined && e.xGoal === undefined && e.yGoal === undefined && !e.outDir) return
        const isUs = e.team === effectiveTeam
        const output = normalizeShotOutput(e.shotOutput, e.resultLabel, e.outDir)
        result.push({
          id: e.id, side: isUs ? 'A' : 'B', teamName: e.team, player: e.shooter, output,
          shotType: e.shotType, isPC: isPcAttempt(e.code, e.shotType),
          xLoc: e.xLoc, yLoc: e.yLoc, xGoal: e.xGoal, yGoal: e.yGoal, outDir: e.outDir,
          matchName: m.matchName, quarter: e.quarter, time: e.time,
        })
        const bucket = isUs ? kpiSum.us : kpiSum.opp
        bucket.total++
        if (output === 'goal') bucket.goal++
        else if (output === 'save') bucket.save++
        else if (output === 'block') bucket.block++
      })
    })

    return { shots: result, teamMatches: relevant, kpi: kpiSum }
  }, [scopedMatches, effectiveTeam])

  const playerStats = useMemo(() => {
    const map = new Map<string, { player: string, total: number, goal: number, save: number, block: number, out: number, fail: number }>()
    shots.filter(s => s.side === 'A' && s.player).forEach(s => {
      const key = s.player!
      if (!map.has(key)) map.set(key, { player: key, total: 0, goal: 0, save: 0, block: 0, out: 0, fail: 0 })
      const row = map.get(key)!
      row.total++
      if (s.output !== 'unknown') (row as any)[s.output]++
    })
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [shots])

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
                  onClick={() => { setCategory(c); setTournamentId("ALL"); setTeamName("") }}>{c}</Button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1"><Trophy className="h-3 w-3" /> 대회</Label>
              <Select value={tournamentId} onValueChange={(v) => { setTournamentId(v); setTeamName("") }}>
                <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">전체 대회 ({effCategory})</SelectItem>
                  {categoryTournaments.map(t => <SelectItem key={t.id} value={t.id!}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1"><Users className="h-3 w-3" /> 팀</Label>
              <Select value={effectiveTeam} onValueChange={setTeamName}>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatsCard title={`${effectiveTeam} 슈팅 시도`} value={kpi.us.total} icon={<Sword className="h-4 w-4" />} />
            <StatsCard title="득점" value={kpi.us.goal} icon={<Target className="h-4 w-4" />} />
            <StatsCard title="득점률" value={kpi.us.total > 0 ? (kpi.us.goal / kpi.us.total) * 100 : 0} isPercentage icon={<Target className="h-4 w-4" />} />
            <StatsCard title="상대 GK 선방 + 블락" value={kpi.us.save + kpi.us.block} icon={<ShieldCheck className="h-4 w-4" />} />
          </div>

          <ShotZoneMap
            shots={shots}
            sideALabel={effectiveTeam}
            sideBLabel="상대팀"
            title={`${effectiveTeam} 슈팅 위치 · 골대 타겟`}
            description={`${teamMatches.length}경기 누적 · 좌표가 태깅된 슈팅/PC 시도만 표시됩니다`}
          />

          {playerStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Table2 className="h-5 w-5" /> 선수별 슈팅 통계</CardTitle>
                <CardDescription>{effectiveTeam} 선수 기준 (슈터 라벨이 태깅된 시도만 집계)</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>선수</TableHead>
                      <TableHead className="text-center">총 시도</TableHead>
                      <TableHead className="text-center">득점</TableHead>
                      <TableHead className="text-center">GK 선방</TableHead>
                      <TableHead className="text-center">블락</TableHead>
                      <TableHead className="text-center">아웃</TableHead>
                      <TableHead className="text-center">실패</TableHead>
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
        </>
          )}
        </div>
      )}
    </div>
  )
}
