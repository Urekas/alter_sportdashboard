
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
import type { MatchData, QuarterStats } from "@/lib/types"

interface BuildUpEfficiencyChartProps {
  data: MatchData
}

export function BuildUpEfficiencyChart({ data }: BuildUpEfficiencyChartProps) {
  const { homeTeam, awayTeam, quarterlyStats } = data

  const getRows = (isHome: boolean) => {
    const perQuarter = quarterlyStats.map((q: QuarterStats) => {
      const teamStats = isHome ? q.home : q.away
      const twentyFive = teamStats.twentyFiveEntries || 0
      const circle = teamStats.circleEntries || 0
      const efficiency = twentyFive > 0 ? (circle / twentyFive) * 100 : 0
      return { twentyFive, circle, efficiency }
    })
    const totalTwentyFive = perQuarter.reduce((acc, q) => acc + q.twentyFive, 0)
    const totalCircle = perQuarter.reduce((acc, q) => acc + q.circle, 0)
    const totalEfficiency = totalTwentyFive > 0 ? (totalCircle / totalTwentyFive) * 100 : 0

    return {
      twentyFive: [totalTwentyFive, ...perQuarter.map(q => q.twentyFive)],
      circle: [totalCircle, ...perQuarter.map(q => q.circle)],
      efficiency: [totalEfficiency, ...perQuarter.map(q => q.efficiency)],
    }
  }

  const renderTeamRows = (team: typeof homeTeam) => {
    const rows = getRows(team === homeTeam)
    return (
      <>
        <TableRow className="border-t-2">
          <TableCell colSpan={6} className="font-black py-2" style={{ color: team.color }}>{team.name}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="pl-6 text-muted-foreground">25y 진입</TableCell>
          {rows.twentyFive.map((v, i) => <TableCell key={i} className="text-center">{v.toFixed(1)}</TableCell>)}
        </TableRow>
        <TableRow>
          <TableCell className="pl-6 text-muted-foreground">서클 진입 (CE)</TableCell>
          {rows.circle.map((v, i) => <TableCell key={i} className="text-center">{v.toFixed(1)}</TableCell>)}
        </TableRow>
        <TableRow>
          <TableCell className="pl-6 text-muted-foreground">전환 효율 (%)</TableCell>
          {rows.efficiency.map((v, i) => <TableCell key={i} className="text-center font-bold" style={{ color: team.color }}>{v.toFixed(1)}</TableCell>)}
        </TableRow>
      </>
    )
  }

  return (
    <Card className="w-full break-inside-avoid">
      <CardHeader>
        <CardTitle>25y 진입 대비 서클 진입 효율</CardTitle>
        <CardDescription>
          양팀의 공격 효율을 비교합니다. (25m 진입 대비 서클 진입 성공률)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>지표</TableHead>
              <TableHead className="text-center">전체</TableHead>
              {quarterlyStats.map((q) => <TableHead key={q.quarter} className="text-center">{q.quarter}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {renderTeamRows(homeTeam)}
            {renderTeamRows(awayTeam)}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
