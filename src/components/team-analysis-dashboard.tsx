
"use client"

// 팀별 분석 — 팀을 고르면 그 팀이 뛴 대회 목록(연도별)이 나오고, 대회를 클릭하면 그 대회 안에서
// 이 팀이 나온 경기 목록이 나오고, 라인업이 저장된 경기를 클릭하면 그 자리에서 라인업을 보여줍니다.
// 선수 이름을 클릭하면 그 선수의 커리어 조회(PlayerRecordDialog, dashboard.tsx에서 관리)로 이어집니다.
// 사용자가 설명한 전체 동선(팀 → 대회 → 라인업 → 선수 → 커리어 → 경기 리포트) 중 "팀 먼저 고르는
// 진입점" 부분 — 득점/슈팅/선방 집계 + 영상 클릭연결은 사용자가 "나중에"라고 명시해서 범위 밖.
// 하키는 남자/여자 대회가 완전히 분리돼있어서(같은 "한국"이라도 다른 팀) 팀 목록을 항상
// Tournament.category로 먼저 좁힌 뒤에 팀 이름으로 찾습니다. category 없는 대회는 "미분류".
import { useMemo, useState } from "react"
import { Users, Trophy, Loader2, ChevronRight, ChevronDown, ClipboardList, ArrowRight } from "lucide-react"
import type { MatchData, Tournament } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { LineupTable } from "./lineup-section"
import { useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { collection, query } from "firebase/firestore"

interface TeamAnalysisDashboardProps {
  tournaments: Tournament[]
  onViewMatch: (match: MatchData) => void
  onPlayerClick: (playerName: string) => void
}

export function TeamAnalysisDashboard({ tournaments, onViewMatch, onPlayerClick }: TeamAnalysisDashboardProps) {
  const [category, setCategory] = useState("")
  const [teamName, setTeamName] = useState("")
  const [openTournamentId, setOpenTournamentId] = useState<string | null>(null)
  const [openMatchId, setOpenMatchId] = useState<string | null>(null)

  const db = useFirestore()
  const matchesQuery = useMemoFirebase(() => db ? query(collection(db, 'matches')) : null, [db])
  const { data: matches, isLoading } = useCollection<MatchData>(matchesQuery)

  const tournamentById = useMemo(() => new Map(tournaments.map(t => [t.id, t])), [tournaments])

  const categories = useMemo(() => {
    const set = new Set(tournaments.map(t => t.category || "미분류"))
    return Array.from(set).sort((a, b) => a === "미분류" ? 1 : b === "미분류" ? -1 : a.localeCompare(b))
  }, [tournaments])
  const effCategory = category && categories.includes(category) ? category : (categories[0] || "")

  const categoryTournamentIds = useMemo(() => new Set(tournaments.filter(t => (t.category || "미분류") === effCategory).map(t => t.id)), [tournaments, effCategory])
  const categoryMatches = useMemo(() => (matches || []).filter(m => categoryTournamentIds.has(m.tournamentId || "")), [matches, categoryTournamentIds])

  const allTeamNames = useMemo(() => {
    return Array.from(new Set(categoryMatches.flatMap(m => [m.homeTeam.name, m.awayTeam.name]))).sort()
  }, [categoryMatches])

  const effectiveTeam = teamName && allTeamNames.includes(teamName) ? teamName : (allTeamNames[0] || "")

  const teamMatches = useMemo(() => {
    if (!effectiveTeam) return []
    return categoryMatches.filter(m => m.homeTeam.name === effectiveTeam || m.awayTeam.name === effectiveTeam)
  }, [categoryMatches, effectiveTeam])

  // 대회별로 묶고, 연도별로 그룹핑(최신 연도 먼저) — 연도를 못 찾은 대회는 "미분류"로 따로 모음.
  const tournamentGroups = useMemo(() => {
    type TournamentEntry = { tournament: Tournament | undefined, tournamentId: string, tournamentName: string, matches: MatchData[] }
    const byTournament = new Map<string, TournamentEntry>()
    teamMatches.forEach(m => {
      const tid = m.tournamentId || ""
      if (!byTournament.has(tid)) {
        const t = tournamentById.get(tid)
        byTournament.set(tid, { tournament: t, tournamentId: tid, tournamentName: m.tournamentName || t?.name || "대회 미상", matches: [] })
      }
      byTournament.get(tid)!.matches.push(m)
    })

    const yearMap = new Map<string, TournamentEntry[]>()
    byTournament.forEach(entry => {
      const d = entry.tournament?.startDate ? new Date(entry.tournament.startDate) : null
      const key = d && !isNaN(d.getTime()) ? `${d.getFullYear()}년` : "미분류"
      if (!yearMap.has(key)) yearMap.set(key, [])
      yearMap.get(key)!.push(entry)
    })
    const entries = Array.from(yearMap.entries())
    const withYear = entries.filter(([k]) => k !== "미분류").sort((a, b) => b[0].localeCompare(a[0]))
    const unclassified = entries.filter(([k]) => k === "미분류")
    return [...withYear, ...unclassified]
  }, [teamMatches, tournamentById])

  const lineupCountFor = (list: MatchData[]) => list.filter(m => {
    const isHome = m.homeTeam.name === effectiveTeam
    return isHome ? !!m.lineups?.home : !!m.lineups?.away
  }).length

  return (
    <div className="space-y-8">
      <div className="border-b-4 border-primary pb-4 flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-xl font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Users className="h-5 w-5" /> 팀별 분석
          </h2>
          <p className="text-sm text-muted-foreground mt-1">팀을 고르면 그 팀이 뛴 대회 목록이 나오고, 대회 → 경기 → 라인업 → 선수 순으로 들어갈 수 있습니다.</p>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-bold text-muted-foreground uppercase">팀</Label>
          <Select value={effectiveTeam} onValueChange={(v) => { setTeamName(v); setOpenTournamentId(null); setOpenMatchId(null) }}>
            <SelectTrigger className="h-9 w-52"><SelectValue placeholder="팀 선택" /></SelectTrigger>
            <SelectContent>{allTeamNames.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />불러오는 중...</div>
      ) : categories.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">등록된 대회가 없습니다.</div>
      ) : (
        <>
          {categories.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase mr-1 flex items-center gap-1"><Users className="h-3 w-3" /> 카테고리</span>
              {categories.map(c => (
                <Button key={c} size="sm" variant={effCategory === c ? 'default' : 'outline'} className="h-7 text-[11px] font-bold px-2.5"
                  onClick={() => { setCategory(c); setTeamName(""); setOpenTournamentId(null); setOpenMatchId(null) }}>{c}</Button>
              ))}
            </div>
          )}
          {!effectiveTeam ? (
            <div className="py-20 text-center text-muted-foreground">"{effCategory}" 카테고리에 등록된 경기가 없습니다.</div>
          ) : (
        <div className="space-y-6">
          {tournamentGroups.map(([yearLabel, entries]) => (
            <div key={yearLabel} className="space-y-2">
              <h3 className="text-sm font-black text-muted-foreground uppercase tracking-widest">{yearLabel}</h3>
              <div className="space-y-2">
                {entries.map(entry => {
                  const isOpen = openTournamentId === entry.tournamentId
                  const lineupCount = lineupCountFor(entry.matches)
                  return (
                    <Card key={entry.tournamentId || entry.tournamentName} className="overflow-hidden">
                      <button
                        onClick={() => { setOpenTournamentId(isOpen ? null : entry.tournamentId); setOpenMatchId(null) }}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Trophy className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-bold truncate">{entry.tournamentName}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{entry.matches.length}경기{lineupCount > 0 && ` · 라인업 ${lineupCount}건`}</span>
                        </div>
                        {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                      </button>

                      {isOpen && (
                        <CardContent className="pt-0 pb-4 space-y-2 border-t">
                          {entry.matches.map(m => {
                            const isHome = m.homeTeam.name === effectiveTeam
                            const opponent = isHome ? m.awayTeam.name : m.homeTeam.name
                            const teamLineup = isHome ? m.lineups?.home : m.lineups?.away
                            const isMatchOpen = openMatchId === m.id
                            return (
                              <div key={m.id} className="border rounded-lg overflow-hidden mt-2">
                                <button
                                  onClick={() => setOpenMatchId(isMatchOpen ? null : (m.id || null))}
                                  className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted/30 transition-colors text-left"
                                >
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold truncate">{m.matchName || `${effectiveTeam} vs ${opponent}`}</div>
                                    <div className="text-[11px] text-muted-foreground">vs {opponent} · {isHome ? '홈' : '어웨이'}</div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {teamLineup ? (
                                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1"><ClipboardList className="h-3 w-3" /> 라인업</span>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground">라인업 없음</span>
                                    )}
                                    {isMatchOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                  </div>
                                </button>
                                {isMatchOpen && (
                                  <div className="px-3 pb-3 pt-1 border-t space-y-3">
                                    {teamLineup ? (
                                      <LineupTable
                                        team={teamLineup}
                                        teamName={effectiveTeam}
                                        teamColor={isHome ? m.homeTeam.color : m.awayTeam.color}
                                        onPlayerClick={onPlayerClick}
                                      />
                                    ) : (
                                      <p className="text-xs text-muted-foreground py-2">이 경기엔 아직 저장된 라인업이 없어요. 경기 리포트에서 TMS 라인업을 붙여넣을 수 있어요.</p>
                                    )}
                                    <Button size="sm" variant="outline" className="text-xs font-bold" onClick={() => onViewMatch(m)}>
                                      경기 리포트 보기 <ArrowRight className="h-3 w-3 ml-1.5" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </CardContent>
                      )}
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
          )}
        </>
      )}
    </div>
  )
}
