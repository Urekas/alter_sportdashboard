
"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { MatchData } from "@/lib/types"

interface MatchSummaryBarProps {
  data: MatchData
}

// BasicMatchStats와 동일한 지표 세트를 기준으로 우세/열세를 집계합니다.
// 득점(결과 그 자체)은 "과정 지표 우위"를 말하는 요약에서는 제외합니다.
const SUMMARY_METRICS: { h: (d: MatchData) => number; a: (d: MatchData) => number; lowerIsBetter?: boolean }[] = [
  { h: (d) => d.matchStats.home.shots, a: (d) => d.matchStats.away.shots },
  { h: (d) => d.matchStats.home.pcSuccessRate, a: (d) => d.matchStats.away.pcSuccessRate },
  { h: (d) => d.matchStats.home.circleEntries, a: (d) => d.matchStats.away.circleEntries },
  { h: (d) => d.matchStats.home.twentyFiveEntries, a: (d) => d.matchStats.away.twentyFiveEntries },
  { h: (d) => d.matchStats.home.build25Ratio, a: (d) => d.matchStats.away.build25Ratio },
  { h: (d) => d.matchStats.home.spp, a: (d) => d.matchStats.away.spp, lowerIsBetter: true },
  { h: (d) => d.matchStats.home.possession, a: (d) => d.matchStats.away.possession },
  { h: (d) => d.matchStats.home.attackPossession, a: (d) => d.matchStats.away.attackPossession },
  { h: (d) => d.matchStats.home.buildUpStagnation, a: (d) => d.matchStats.away.buildUpStagnation, lowerIsBetter: true },
  { h: (d) => d.matchStats.home.timePerCE, a: (d) => d.matchStats.away.timePerCE, lowerIsBetter: true },
]

export function MatchSummaryBar({ data }: MatchSummaryBarProps) {
  const { homeTeam, awayTeam, matchStats } = data

  let homeWins = 0
  let awayWins = 0
  for (const m of SUMMARY_METRICS) {
    const hVal = m.h(data)
    const aVal = m.a(data)
    if (hVal === aVal || isNaN(hVal) || isNaN(aVal)) continue
    const hBetter = m.lowerIsBetter ? hVal < aVal : hVal > aVal
    if (hBetter) homeWins++
    else awayWins++
  }
  const total = SUMMARY_METRICS.length

  const homeGoals = matchStats.home.goals.field + matchStats.home.goals.pc
  const awayGoals = matchStats.away.goals.field + matchStats.away.goals.pc

  if (homeWins === awayWins) {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-5 py-4">
        <Minus className="h-5 w-5 text-muted-foreground shrink-0" />
        <div>
          <p className="font-bold text-sm">두 팀의 핵심 지표가 팽팽했습니다</p>
          <p className="text-xs text-muted-foreground mt-0.5">{total}개 핵심 지표 중 {homeWins}:{awayWins}으로 우열이 뚜렷하지 않은 경기입니다.</p>
        </div>
      </div>
    )
  }

  const leader = homeWins > awayWins ? homeTeam : awayTeam
  const leaderWins = Math.max(homeWins, awayWins)
  const leaderIsWinningScore = homeWins > awayWins ? homeGoals >= awayGoals : awayGoals >= homeGoals
  const scoreNote = leaderIsWinningScore
    ? "실제 스코어와 일치하는 결과입니다."
    : "실제 스코어와는 다른 결과입니다 — 세부 지표를 확인해보세요."

  return (
    <div
      className="flex items-center gap-3 rounded-xl border px-5 py-4"
      style={{ backgroundColor: `${leader.color}14`, borderColor: `${leader.color}40` }}
    >
      {leaderWins >= total * 0.6 ? (
        <TrendingUp className="h-5 w-5 shrink-0" style={{ color: leader.color }} />
      ) : (
        <TrendingDown className="h-5 w-5 shrink-0 opacity-60" style={{ color: leader.color }} />
      )}
      <div>
        <p className="font-bold text-sm" style={{ color: leader.color }}>
          {leader.name}이(가) {total}개 핵심 지표 중 {leaderWins}개에서 우위
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{scoreNote}</p>
      </div>
    </div>
  )
}
