
"use client"

// 선수단 배포용 읽기 전용 리포트 페이지. dashboard.tsx의 관리자 화면과 달리:
//  - 업로드/저장/XML 다운로드/AI 분석/다른 경기·대회 탐색기 등 관리 기능이 전혀 없음
//  - 라인업/이벤트 타임라인의 인라인 편집(Firestore 쓰기)이 막혀 있음(readOnly)
//  - 영상 분석 도구로 가는 모든 링크가 &lock=1을 달고 나가서, 그 경기 화면에만 갇힘
// 접근 제한은 없음(현재 Firestore 규칙이 전체 공개라 링크만 있으면 누구나 열람 가능 — 의도된 상태).
import { use, useEffect, useMemo, useState } from "react"
import { Activity, Loader2, Video, AlertTriangle } from "lucide-react"
import type { MatchData } from "@/lib/types"
import { TournamentService } from "@/lib/tournament-service"
import { buildCircleEntries } from "@/lib/parser"
import { buildVideoDeepLink, cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { StatsCard } from "@/components/stats-card"
import { MatchSummaryBar } from "@/components/match-summary-bar"
import { BasicMatchStats } from "@/components/basic-match-stats"
import { ShotBreakdown } from "@/components/shot-breakdown"
import { ShotZoneMap, isShotAttemptCode, normalizeShotOutput, isPcAttempt, type ShotDatum } from "@/components/shot-zone-map"
import { MatchEventTimeline } from "@/components/match-event-timeline"
import { QuarterlyStatsTable } from "@/components/quarterly-stats-table"
import { AttackThreatChart } from "@/components/attack-threat-chart"
import { BuildUpEfficiencyChart } from "@/components/build-up-efficiency-chart"
import { MatchTrajectoryChart } from "@/components/match-trajectory-chart"
import { CircleEntryAnalysis } from "@/components/circle-entry-analysis"
import { PressureBattleChart } from "@/components/pressure-battle-chart"
import { PressureAnalysisMap } from "@/components/pressure-analysis-map"
import { TurnoverZoneMap } from "@/components/turnover-zone-map"
import { LineupTable } from "@/components/lineup-section"
import { CollapsibleSection, CollapseToggleButton } from "@/components/collapsible-section"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingDown, Target, Sword, Shield, Users } from "lucide-react"

export default function PlayerReportPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params)
  const [matchData, setMatchData] = useState<MatchData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [circleEntryMode, setCircleEntryMode] = useState<'3' | '5'>('3')
  const [lineupOpen, setLineupOpen] = useState(true)
  const liveCircleEntries = useMemo(
    () => matchData ? buildCircleEntries(matchData.events, matchData.homeTeam.name, matchData.awayTeam.name) : [],
    [matchData]
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    TournamentService.getMatchById(matchId).then(data => {
      if (cancelled) return
      if (!data) setNotFound(true)
      else setMatchData(data)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [matchId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 mr-2 animate-spin" /> 리포트를 불러오는 중...
      </div>
    )
  }

  if (notFound || !matchData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-4">
        <AlertTriangle className="h-10 w-10 text-muted-foreground/50" />
        <p className="text-lg font-bold">경기를 찾을 수 없습니다.</p>
        <p className="text-sm text-muted-foreground">링크가 정확한지 확인해주세요.</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
      <header className="border-b-4 border-primary pb-4 mb-8 flex flex-col sm:flex-row justify-between sm:items-end gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-muted-foreground uppercase tracking-widest">{matchData.tournamentName || "Tournament Report"}</h2>
          <h1 className="text-2xl sm:text-4xl font-black italic tracking-tighter text-foreground mt-1 break-words">{matchData.matchName || "Match Performance Analysis"}</h1>
        </div>
        {matchData.videoMatchId && (
          <Button asChild size="sm" className="h-10 bg-[#e15b47] hover:bg-[#e15b47]/90 font-bold shrink-0">
            <a href={buildVideoDeepLink(matchData.videoMatchId, undefined, true)} target="_blank" rel="noopener noreferrer">
              <Video className="h-4 w-4 mr-2" />
              이 경기 영상 보기
            </a>
          </Button>
        )}
      </header>

      <div className="space-y-12">
        <MatchSummaryBar data={matchData} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[matchData.homeTeam, matchData.awayTeam].map((team, i) => (
            <div key={team.name} className="space-y-3">
              <div className="flex items-center gap-2 font-bold text-xl" style={{ color: team.color }}>
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: team.color }} />
                {team.name} ({i === 0 ? '홈' : '어웨이'})
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatsCard title="득점" value={i === 0 ? matchData.matchStats.home.goals.field + matchData.matchStats.home.goals.pc : matchData.matchStats.away.goals.field + matchData.matchStats.away.goals.pc} icon={<Sword className="h-4 w-4" />} />
                <StatsCard title="압박 지수 (SPP)" value={i === 0 ? matchData.matchStats.home.spp : matchData.matchStats.away.spp} icon={<TrendingDown className="h-4 w-4" />} isTime />
                <StatsCard title="공격 점유율" value={i === 0 ? matchData.matchStats.home.attackPossession : matchData.matchStats.away.attackPossession} icon={<Target className="h-4 w-4" />} isPercentage />
                <StatsCard title="CE 소요 시간" value={i === 0 ? matchData.matchStats.home.timePerCE : matchData.matchStats.away.timePerCE} icon={<Activity className="h-4 w-4" />} isTime />
              </div>
            </div>
          ))}
        </div>

        {(matchData.lineups?.home || matchData.lineups?.away) && (
          <Card className="break-inside-avoid">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> 라인업</CardTitle>
              <CollapseToggleButton open={lineupOpen} onClick={() => setLineupOpen(o => !o)} />
            </CardHeader>
            <CardContent className={cn(!lineupOpen && "hidden print:block")}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {matchData.lineups.home && <LineupTable team={matchData.lineups.home} teamName={matchData.homeTeam.name} teamColor={matchData.homeTeam.color} onPlayerClick={() => {}} />}
                {matchData.lineups.away && <LineupTable team={matchData.lineups.away} teamName={matchData.awayTeam.name} teamColor={matchData.awayTeam.color} onPlayerClick={() => {}} />}
              </div>
            </CardContent>
          </Card>
        )}

        <BasicMatchStats data={matchData} lockedVideo />
        <ShotBreakdown data={matchData} lockedVideo />

        <ShotZoneMap
          shots={matchData.events
            .filter(e => isShotAttemptCode(e.code))
            .filter(e => e.xLoc !== undefined || e.yLoc !== undefined || e.xGoal !== undefined || e.yGoal !== undefined || e.outDir)
            .map((e): ShotDatum => ({
              id: e.id,
              side: e.team === matchData.homeTeam.name ? 'A' : 'B',
              teamName: e.team,
              player: e.shooter,
              output: normalizeShotOutput(e.shotOutput, e.resultLabel, e.outDir),
              shotType: e.shotType,
              isPC: isPcAttempt(e.code, e.shotType), code: e.code,
              xLoc: e.xLoc, yLoc: e.yLoc, xGoal: e.xGoal, yGoal: e.yGoal, outDir: e.outDir,
              matchName: matchData.matchName, quarter: e.quarter, time: e.time,
            }))}
          sideALabel={matchData.homeTeam.name}
          sideBLabel={matchData.awayTeam.name}
          sideAColor={matchData.homeTeam.color}
          sideBColor={matchData.awayTeam.color}
          title="슈팅 위치 · 골대 타겟"
          description="슈팅 태깅 도구에서 좌표가 찍힌 슈팅/PC 시도만 표시됩니다"
        />

        <MatchEventTimeline data={matchData} lockedVideo readOnly />

        <CollapsibleSection title="쿼터별 상세 데이터" icon={<Activity className="h-6 w-6" />}>
          <QuarterlyStatsTable data={matchData} />
        </CollapsibleSection>

        <CollapsibleSection title="공격 성능 분석" icon={<Sword className="h-6 w-6" />} className="space-y-8">
          {matchData.videoMatchId && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 -mt-4">
              <Video className="h-3.5 w-3.5 text-[#e15b47]" />
              아래 그래프의 지점을 클릭하면 해당 장면 영상이 열려요
            </div>
          )}
          <AttackThreatChart data={matchData.attackThreatData} homeTeam={matchData.homeTeam} awayTeam={matchData.awayTeam} videoMatchId={matchData.videoMatchId} lockedVideo />
          <BuildUpEfficiencyChart data={matchData} />
        </CollapsibleSection>

        <CollapsibleSection title="공격 점유 및 속도 분석" icon={<Target className="h-6 w-6" />} className="space-y-8">
          <MatchTrajectoryChart data={matchData} />
          <div className="flex items-center justify-end gap-1 -mb-2">
            <span className="text-xs text-muted-foreground mr-1">서클 진입 분석:</span>
            <Button size="sm" variant={circleEntryMode === '3' ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setCircleEntryMode('3')}>3방향</Button>
            <Button size="sm" variant={circleEntryMode === '5' ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setCircleEntryMode('5')}>5방향</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CircleEntryAnalysis teamName={matchData.homeTeam.name} entries={liveCircleEntries.filter(e => e.team === matchData.homeTeam.name)} teamColor={matchData.homeTeam.color} mode={circleEntryMode} />
            <CircleEntryAnalysis teamName={matchData.awayTeam.name} entries={liveCircleEntries.filter(e => e.team === matchData.awayTeam.name)} teamColor={matchData.awayTeam.color} mode={circleEntryMode} />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="압박 분석" icon={<Shield className="h-6 w-6" />} className="space-y-8">
          <PressureBattleChart data={matchData.pressureData} homeTeam={matchData.homeTeam} awayTeam={matchData.awayTeam} />
          <PressureAnalysisMap events={matchData.events} homeTeam={matchData.homeTeam} awayTeam={matchData.awayTeam} isCompact />
        </CollapsibleSection>

        <TurnoverZoneMap events={matchData.events} homeTeam={matchData.homeTeam} awayTeam={matchData.awayTeam} />
      </div>
    </div>
  )
}
