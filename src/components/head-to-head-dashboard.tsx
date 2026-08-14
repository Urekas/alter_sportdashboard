
"use client"

// 상대 전적(Head-to-Head). 좌/우 두 팀을 고르면 역대 전적(전체 기간, 필터 무관)과
// 그 아래 경기 목록(대회/연도로 필터 가능)을 보여줌. tournament-manager.tsx의 "국가별 보기"와
// 같은 연도 계산 방식(Tournament.startDate 기준)을 그대로 씀.
import { useMemo, useState } from "react"
import { Swords, Trophy, Calendar, Loader2, ArrowLeftRight, Sword, Target, ChevronDown, Shield, Percent } from "lucide-react"
import type { MatchData, Tournament } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { collection, query } from "firebase/firestore"

interface HeadToHeadDashboardProps {
  tournaments: Tournament[]
  onViewMatch?: (match: MatchData) => void
}

function matchGoals(m: MatchData, side: 'home' | 'away'): number {
  const s = side === 'home' ? m.matchStats.home : m.matchStats.away
  return (s?.goals?.field || 0) + (s?.goals?.pc || 0)
}

export function HeadToHeadDashboard({ tournaments, onViewMatch }: HeadToHeadDashboardProps) {
  const [teamA, setTeamA] = useState("")
  const [teamB, setTeamB] = useState("")
  const [selectedTournamentIds, setSelectedTournamentIds] = useState<Set<string>>(new Set())
  const [selectedYears, setSelectedYears] = useState<Set<string>>(new Set())

  const db = useFirestore()
  const matchesQuery = useMemoFirebase(() => db ? query(collection(db, 'matches')) : null, [db])
  const { data: matches, isLoading } = useCollection<MatchData>(matchesQuery)

  const tournamentById = useMemo(() => new Map(tournaments.map(t => [t.id, t])), [tournaments])

  const allTeamNames = useMemo(() => {
    if (!matches) return []
    return Array.from(new Set(matches.flatMap(m => [m.homeTeam.name, m.awayTeam.name]))).sort()
  }, [matches])

  const effA = teamA && allTeamNames.includes(teamA) ? teamA : (allTeamNames[0] || "")
  const effB = teamB && allTeamNames.includes(teamB) && teamB !== effA ? teamB : (allTeamNames.find(t => t !== effA) || "")

  // 역대 전적(A vs B) — 필터와 무관하게 항상 두 팀 사이의 모든 경기 기준.
  const h2hMatches = useMemo(() => {
    if (!matches || !effA || !effB) return []
    return matches
      .filter(m => (m.homeTeam.name === effA && m.awayTeam.name === effB) || (m.homeTeam.name === effB && m.awayTeam.name === effA))
      .map(m => {
        const t = tournamentById.get(m.tournamentId || "")
        const d = t?.startDate ? new Date(t.startDate) : null
        const isAHome = m.homeTeam.name === effA
        const sA = isAHome ? m.matchStats.home : m.matchStats.away
        const sB = isAHome ? m.matchStats.away : m.matchStats.home
        return {
          match: m,
          tournamentName: m.tournamentName || t?.name || "대회 미상",
          year: d && !isNaN(d.getTime()) ? `${d.getFullYear()}년` : "연도 미상",
          startDate: d,
          goalsA: matchGoals(m, isAHome ? 'home' : 'away'),
          goalsB: matchGoals(m, isAHome ? 'away' : 'home'),
          shotsA: sA?.shots || 0, shotsB: sB?.shots || 0,
          pcsA: sA?.pcs || 0, pcsB: sB?.pcs || 0,
          circleEntriesA: sA?.circleEntries || 0, circleEntriesB: sB?.circleEntries || 0,
          possessionA: sA?.possession || 0, possessionB: sB?.possession || 0,
          pcSuccessRateA: sA?.pcSuccessRate || 0, pcSuccessRateB: sB?.pcSuccessRate || 0,
        }
      })
      .sort((a, b) => (b.startDate?.getTime() || 0) - (a.startDate?.getTime() || 0))
  }, [matches, effA, effB, tournamentById])

  const record = useMemo(() => {
    const sum = { winA: 0, winB: 0, draw: 0, goalsA: 0, goalsB: 0, shotsA: 0, shotsB: 0, pcsA: 0, pcsB: 0, circleEntriesA: 0, circleEntriesB: 0, possessionA: 0, possessionB: 0, pcSuccessRateA: 0, pcSuccessRateB: 0 }
    h2hMatches.forEach(r => {
      if (r.goalsA > r.goalsB) sum.winA++
      else if (r.goalsB > r.goalsA) sum.winB++
      else sum.draw++
      sum.goalsA += r.goalsA; sum.goalsB += r.goalsB
      sum.shotsA += r.shotsA; sum.shotsB += r.shotsB
      sum.pcsA += r.pcsA; sum.pcsB += r.pcsB
      sum.circleEntriesA += r.circleEntriesA; sum.circleEntriesB += r.circleEntriesB
      sum.possessionA += r.possessionA; sum.possessionB += r.possessionB
      sum.pcSuccessRateA += r.pcSuccessRateA; sum.pcSuccessRateB += r.pcSuccessRateB
    })
    const n = h2hMatches.length || 1
    return {
      winA: sum.winA, winB: sum.winB, draw: sum.draw, goalsA: sum.goalsA, goalsB: sum.goalsB,
      avgGoalsA: sum.goalsA / n, avgGoalsB: sum.goalsB / n,
      avgShotsA: sum.shotsA / n, avgShotsB: sum.shotsB / n,
      avgPcsA: sum.pcsA / n, avgPcsB: sum.pcsB / n,
      avgCircleEntriesA: sum.circleEntriesA / n, avgCircleEntriesB: sum.circleEntriesB / n,
      avgPossessionA: sum.possessionA / n, avgPossessionB: sum.possessionB / n,
      avgPcSuccessRateA: sum.pcSuccessRateA / n, avgPcSuccessRateB: sum.pcSuccessRateB / n,
    }
  }, [h2hMatches])

  // 경기 목록에만 적용되는 대회/연도 필터 (역대 전적 자체는 항상 전체 기준)
  const tournamentOptions = useMemo(() => {
    const ids = new Set(h2hMatches.map(r => r.match.tournamentId).filter(Boolean) as string[])
    return Array.from(ids).map(id => tournamentById.get(id)).filter((t): t is Tournament => !!t)
  }, [h2hMatches, tournamentById])

  // 대회목록을 연도별로 묶고, 연도를 못 찾은 대회는 "미분류"로 따로 모음 (tournament-manager.tsx 국가별 보기와 동일 패턴)
  const tournamentGroups = useMemo(() => {
    const map = new Map<string, Tournament[]>()
    tournamentOptions.forEach(t => {
      const d = t.startDate ? new Date(t.startDate) : null
      const key = d && !isNaN(d.getTime()) ? `${d.getFullYear()}년` : "미분류"
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    })
    const entries = Array.from(map.entries())
    const withYear = entries.filter(([k]) => k !== "미분류").sort((a, b) => b[0].localeCompare(a[0]))
    const unclassified = entries.filter(([k]) => k === "미분류")
    return [...withYear, ...unclassified]
  }, [tournamentOptions])

  const yearOptions = useMemo(() => Array.from(new Set(h2hMatches.map(r => r.year))).sort((a, b) => b.localeCompare(a)), [h2hMatches])

  const filteredMatches = useMemo(() => {
    return h2hMatches.filter(r => {
      if (selectedTournamentIds.size > 0 && !selectedTournamentIds.has(r.match.tournamentId || '')) return false
      if (selectedYears.size > 0 && !selectedYears.has(r.year)) return false
      return true
    })
  }, [h2hMatches, selectedTournamentIds, selectedYears])

  const toggleSet = (setter: (v: Set<string>) => void, current: Set<string>, value: string) => {
    const next = new Set(current)
    if (next.has(value)) next.delete(value); else next.add(value)
    setter(next)
  }

  const swapTeams = () => { const a = effA; setTeamA(effB); setTeamB(a) }

  const AvgRow = ({ icon, label, a, b, suffix }: { icon: React.ReactNode, label: string, a: number, b: number, suffix?: string }) => (
    <div className="flex items-center justify-between text-sm py-1">
      <span className="text-xs text-muted-foreground flex items-center gap-1.5 w-24 shrink-0">{icon} {label}</span>
      <div className="flex-1 flex items-center justify-center gap-6">
        <b className="text-blue-500 text-base">{a.toFixed(1)}{suffix}</b>
        <span className="text-muted-foreground text-xs">vs</span>
        <b className="text-red-500 text-base">{b.toFixed(1)}{suffix}</b>
      </div>
    </div>
  )

  return (
    <div className="space-y-8">
      <div className="border-b-4 border-primary pb-4 flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-xl font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Swords className="h-5 w-5" /> 상대 전적
          </h2>
          <p className="text-sm text-muted-foreground mt-1">두 팀을 고르면 대회를 가로질러 역대 전적과 경기 목록을 보여줍니다.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />불러오는 중...</div>
      ) : allTeamNames.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">등록된 경기가 없습니다.</div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">팀 A (좌)</Label>
              <Select value={effA} onValueChange={setTeamA}>
                <SelectTrigger className="h-10 w-48 font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>{allTeamNames.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={swapTeams} title="좌우 교체">
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">팀 B (우)</Label>
              <Select value={effB} onValueChange={setTeamB}>
                <SelectTrigger className="h-10 w-48 font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>{allTeamNames.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {h2hMatches.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground bg-muted/20 rounded-xl border-2 border-dashed">
              {effA}와(과) {effB}의 맞대결 기록이 없습니다.
            </div>
          ) : (
            <>
              {/* 역대 전적 카드 — 항상 전체 기간 기준 */}
              <Card className="border-2 border-primary/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <span className="text-blue-500">{effA}</span>
                    <span className="text-muted-foreground text-sm font-normal">vs</span>
                    <span className="text-red-500">{effB}</span>
                  </CardTitle>
                  <CardDescription>역대 전적 · 총 {h2hMatches.length}경기</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-center gap-6 sm:gap-10">
                    <div className="text-center">
                      <div className="text-4xl font-black text-blue-500">{record.winA}</div>
                      <div className="text-xs font-bold text-muted-foreground uppercase mt-1">{effA} 승</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-black text-muted-foreground">{record.draw}</div>
                      <div className="text-xs font-bold text-muted-foreground uppercase mt-1">무</div>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-black text-red-500">{record.winB}</div>
                      <div className="text-xs font-bold text-muted-foreground uppercase mt-1">{effB} 승</div>
                    </div>
                  </div>
                  <div className="text-center text-sm text-muted-foreground font-bold">
                    통산 득점 <span className="text-blue-500">{record.goalsA}</span> : <span className="text-red-500">{record.goalsB}</span>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="text-xs font-bold text-muted-foreground uppercase mb-2 text-center">경기당 평균 (좌: <span className="text-blue-500">{effA}</span> · 우: <span className="text-red-500">{effB}</span>)</div>
                    <div className="max-w-md mx-auto divide-y">
                      <AvgRow icon={<Target className="h-3.5 w-3.5" />} label="득점" a={record.avgGoalsA} b={record.avgGoalsB} />
                      <AvgRow icon={<Sword className="h-3.5 w-3.5" />} label="슈팅" a={record.avgShotsA} b={record.avgShotsB} />
                      <AvgRow icon={<Shield className="h-3.5 w-3.5" />} label="PC" a={record.avgPcsA} b={record.avgPcsB} />
                      <AvgRow icon={<Target className="h-3.5 w-3.5" />} label="서클 진입" a={record.avgCircleEntriesA} b={record.avgCircleEntriesB} />
                      <AvgRow icon={<Percent className="h-3.5 w-3.5" />} label="점유율" a={record.avgPossessionA} b={record.avgPossessionB} suffix="%" />
                      <AvgRow icon={<Percent className="h-3.5 w-3.5" />} label="PC 성공률" a={record.avgPcSuccessRateA} b={record.avgPcSuccessRateB} suffix="%" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 경기 목록 — 대회/연도 필터 적용 */}
              <Card>
                <CardHeader className="flex flex-col gap-3">
                  <div>
                    <CardTitle>경기 목록</CardTitle>
                    <CardDescription>{filteredMatches.length}경기 표시 중 (전체 {h2hMatches.length}경기){onViewMatch && " · 행을 클릭하면 해당 경기 리포트로 이동합니다"}</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {tournamentOptions.length > 1 && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="outline" className="h-8 text-xs font-bold gap-1.5">
                            <Trophy className="h-3.5 w-3.5" /> 대회
                            {selectedTournamentIds.size > 0 && <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[10px]">{selectedTournamentIds.size}</span>}
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 max-h-80 overflow-y-auto space-y-3" align="start">
                          {tournamentGroups.map(([groupLabel, list]) => (
                            <div key={groupLabel} className="space-y-1.5">
                              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{groupLabel}</div>
                              <div className="flex flex-wrap gap-1.5">
                                {list.map(t => (
                                  <Button key={t.id} size="sm" variant={selectedTournamentIds.has(t.id) ? 'default' : 'outline'} className="h-7 text-[11px] font-bold px-2.5"
                                    onClick={() => toggleSet(setSelectedTournamentIds, selectedTournamentIds, t.id)}>{t.name}</Button>
                                ))}
                              </div>
                            </div>
                          ))}
                          {selectedTournamentIds.size > 0 && (
                            <Button size="sm" variant="ghost" className="h-7 text-[11px] text-muted-foreground w-full" onClick={() => setSelectedTournamentIds(new Set())}>필터 초기화</Button>
                          )}
                        </PopoverContent>
                      </Popover>
                    )}
                    {yearOptions.length > 1 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase mr-1 flex items-center gap-1"><Calendar className="h-3 w-3" /> 연도</span>
                        {yearOptions.map(y => (
                          <Button key={y} size="sm" variant={selectedYears.has(y) ? 'default' : 'outline'} className="h-7 text-[11px] font-bold px-2.5"
                            onClick={() => toggleSet(setSelectedYears, selectedYears, y)}>{y}</Button>
                        ))}
                        {selectedYears.size > 0 && <Button size="sm" variant="ghost" className="h-7 text-[11px] text-muted-foreground" onClick={() => setSelectedYears(new Set())}>초기화</Button>}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>대회</TableHead>
                        <TableHead>연도</TableHead>
                        <TableHead className="text-center">결과</TableHead>
                        <TableHead className="text-center">슈팅</TableHead>
                        <TableHead className="text-center">PC</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMatches.map(r => (
                        <TableRow
                          key={r.match.id}
                          onClick={() => onViewMatch?.(r.match)}
                          className={onViewMatch ? "cursor-pointer hover:bg-muted/50" : undefined}
                        >
                          <TableCell className="font-medium truncate max-w-[220px]">{r.tournamentName}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{r.year}</TableCell>
                          <TableCell className="text-center font-bold">
                            <span className={r.goalsA > r.goalsB ? 'text-blue-500' : ''}>{r.goalsA}</span>
                            {' : '}
                            <span className={r.goalsB > r.goalsA ? 'text-red-500' : ''}>{r.goalsB}</span>
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">{r.shotsA} - {r.shotsB}</TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">{r.pcsA} - {r.pcsB}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}
