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
  const { homeTeam, awayTeam, matchStats, build25Ratio, spp } = data

  const stats: StatRow[] = [
    {
      label: "득점 (필드 / PC)",
      homeValue: `${matchStats.home.goals.field} / ${matchStats.home.goals.pc}`,
      awayValue: `${matchStats.away.goals.field} / ${matchStats.away.goals.pc}`,
    },
    {
      label: "슈팅",
      homeValue: matchStats.home.shots,
      awayValue: matchStats.away.shots,
    },
    {
      label: "서클 진입 (CE)",
      homeValue: matchStats.home.circleEntries,
      awayValue: matchStats.away.circleEntries,
    },
    {
      label: "25y 진입",
      homeValue: matchStats.home.twentyFiveEntries,
      awayValue: matchStats.away.twentyFiveEntries,
    },
    {
      label: "빌드업 25m 성공률 (%)",
      homeValue: `${(build25Ratio.home * 100).toFixed(0)}%`,
      awayValue: `${(build25Ratio.away * 100).toFixed(0)}%`,
    },
    {
      label: "SPP / 허용 SPP",
      homeValue: `${spp.home.toFixed(2)} / ${matchStats.home.allowedSpp.toFixed(2)}`,
      awayValue: `${spp.away.toFixed(2)} / ${matchStats.away.allowedSpp.toFixed(2)}`,
    },
    {
      label: "점유율 %",
      homeValue: `${matchStats.home.possession.toFixed(0)}%`,
      awayValue: `${matchStats.away.possession.toFixed(0)}%`,
    },
    {
      label: "공격 점유율 %",
      homeValue: `${matchStats.home.attackPossession.toFixed(0)}%`,
      awayValue: `${matchStats.away.attackPossession.toFixed(0)}%`,
    },
    {
      label: "공격 1회당 유지 시간 (초)",
      homeValue: `${matchStats.home.avgAttackDuration.toFixed(1)}s`,
      awayValue: `${matchStats.away.avgAttackDuration.toFixed(1)}s`,
    },
    {
      label: "CE 1회당 소요 시간 (초)",
      homeValue: `${matchStats.home.timePerCE.toFixed(1)}s`,
      awayValue: `${matchStats.away.timePerCE.toFixed(1)}s`,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>기본 경기 통계 (Basic Match Stats)</CardTitle>
        <CardDescription className="pt-2 text-xs">
          (참고: 점유율 및 공격 효율 지표는 입력된 이벤트를 바탕으로 분석됩니다.)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">분석 항목</TableHead>
              <TableHead className="text-center">{homeTeam.name}</TableHead>
              <TableHead className="text-center">{awayTeam.name}</TableHead>
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
