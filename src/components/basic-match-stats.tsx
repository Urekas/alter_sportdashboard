
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

type StatRow = {
  label: string
  homeValue: string | number
  awayValue: string | number
}

export function BasicMatchStats({ data }: BasicMatchStatsProps) {
  const { homeTeam, awayTeam, matchStats } = data

  const stats: StatRow[] = [
    {
      label: "득점 (필드 / PC)",
      homeValue: `${Math.round(matchStats.home.goals.field)} / ${Math.round(matchStats.home.goals.pc)}`,
      awayValue: `${Math.round(matchStats.away.goals.field)} / ${Math.round(matchStats.away.goals.pc)}`,
    },
    {
      label: "슈팅",
      homeValue: Math.round(matchStats.home.shots),
      awayValue: Math.round(matchStats.away.shots),
    },
    {
      label: "서클 진입 (CE)",
      homeValue: Math.round(matchStats.home.circleEntries),
      awayValue: Math.round(matchStats.away.circleEntries),
    },
    {
      label: "25y 진입",
      homeValue: Math.round(matchStats.home.twentyFiveEntries),
      awayValue: Math.round(matchStats.away.twentyFiveEntries),
    },
    {
      label: "빌드업 성공률 (%)",
      homeValue: matchStats.home.build25Ratio.toFixed(1),
      awayValue: matchStats.away.build25Ratio.toFixed(1),
    },
    {
      label: "SPP (압박 지수, s)",
      homeValue: matchStats.home.spp.toFixed(1),
      awayValue: matchStats.away.spp.toFixed(1),
    },
    {
      label: "전체 점유율 (%)",
      homeValue: matchStats.home.possession.toFixed(1),
      awayValue: matchStats.away.possession.toFixed(1),
    },
    {
      label: "공격 점유율 (%)",
      homeValue: matchStats.home.attackPossession.toFixed(1),
      awayValue: matchStats.away.attackPossession.toFixed(1),
    },
    {
      label: "평균 공격 유지 시간 (s)",
      homeValue: matchStats.home.avgAttackDuration.toFixed(1),
      awayValue: matchStats.away.avgAttackDuration.toFixed(1),
    },
    {
      label: "CE 1회당 소요 시간 (s)",
      homeValue: matchStats.home.timePerCE.toFixed(1),
      awayValue: matchStats.away.timePerCE.toFixed(1),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>기본 경기 통계 (Basic Match Stats)</CardTitle>
        <CardDescription className="pt-2 text-xs">
          %, 초(s): 소수점 1자리 / 횟수: 정수 단위로 표시됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">분석 항목</TableHead>
              <TableHead className="text-center font-bold text-primary">{homeTeam.name} (홈)</TableHead>
              <TableHead className="text-center font-bold text-chart-2">{awayTeam.name} (어웨이)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.map((stat) => (
              <TableRow key={stat.label}>
                <TableCell className="font-medium">{stat.label}</TableCell>
                <TableCell className="text-center">{stat.homeValue}</TableCell>
                <TableCell className="text-center">{stat.awayValue}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
