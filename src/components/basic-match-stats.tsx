
"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { MatchData } from "@/lib/types"

interface BasicMatchStatsProps {
  data: MatchData
}

export function BasicMatchStats({ data }: BasicMatchStatsProps) {
  const { homeTeam, awayTeam, matchStats } = data

  const stats = [
    { label: "득점 (필드 / PC)", h: `${Math.round(matchStats.home.goals.field)} / ${Math.round(matchStats.home.goals.pc)}`, a: `${Math.round(matchStats.away.goals.field)} / ${Math.round(matchStats.away.goals.pc)}` },
    { label: "슈팅", h: Math.round(matchStats.home.shots), a: Math.round(matchStats.away.shots) },
    { label: "서클 진입 (CE)", h: Math.round(matchStats.home.circleEntries), a: Math.round(matchStats.away.circleEntries) },
    { label: "25y 진입 (A25)", h: Math.round(matchStats.home.twentyFiveEntries), a: Math.round(matchStats.away.twentyFiveEntries) },
    { label: "빌드업 성공률 (%)", h: matchStats.home.build25Ratio.toFixed(1), a: matchStats.away.build25Ratio.toFixed(1) },
    { label: "SPP (압박 지수, s)", h: matchStats.home.spp.toFixed(1), a: matchStats.away.spp.toFixed(1) },
    { label: "전체 점유율 (%)", h: matchStats.home.possession.toFixed(1), a: matchStats.away.possession.toFixed(1) },
    { label: "공격 점유율 (%)", h: matchStats.home.attackPossession.toFixed(1), a: matchStats.away.attackPossession.toFixed(1) },
    { label: "평균 공격 유지 시간 (s)", h: matchStats.home.avgAttackDuration.toFixed(1), a: matchStats.away.avgAttackDuration.toFixed(1) },
    { label: "CE 1회당 소요 시간 (s)", h: matchStats.home.timePerCE.toFixed(1), a: matchStats.away.timePerCE.toFixed(1) },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>기본 경기 통계 (Basic Match Stats)</CardTitle>
        <CardDescription>%, 초(s): 소수점 1자리 / 횟수: 정수 단위</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>분석 항목</TableHead>
              <TableHead className="text-center text-primary font-bold">{homeTeam.name}</TableHead>
              <TableHead className="text-center text-chart-2 font-bold">{awayTeam.name}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.map((s) => (
              <TableRow key={s.label}>
                <TableCell className="font-medium">{s.label}</TableCell>
                <TableCell className="text-center">{s.h}</TableCell>
                <TableCell className="text-center">{s.a}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
