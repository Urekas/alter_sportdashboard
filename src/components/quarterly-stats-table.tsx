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

interface QuarterlyStatsTableProps {
  data: MatchData
}

export function QuarterlyStatsTable({ data }: QuarterlyStatsTableProps) {
  const { homeTeam, awayTeam, quarterlyStats } = data

  return (
    <Card>
      <CardHeader>
        <CardTitle>쿼터별 경기 통계 (Quarterly Match Stats)</CardTitle>
        <CardDescription>
          각 쿼터별 세부 지표 분석 데이터입니다. 홈 팀이 상단에 배치됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>분석 항목 / 쿼터</TableHead>
              {quarterlyStats.map(q => (
                <TableHead key={q.quarter} className="text-center font-bold border-x bg-muted/30">
                  {q.quarter}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Team Rows - HOME */}
            <TableRow className="bg-muted/10">
              <TableCell className="font-bold text-primary" colSpan={5}>
                {homeTeam.name} (Home)
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">득점 (필드/PC)</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">
                  {q.home.goals?.field} / {q.home.goals?.pc}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">슈팅</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.home.shots}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">서클 진입 (CE)</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.home.circleEntries}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">25y 진입</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.home.twentyFiveEntries}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">점유율 (%)</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.home.possession}%</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">공격 점유율 (%)</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.home.attackPossession}%</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">평균 SPP (s)</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.home.spp.toFixed(1)}s</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">공격 유지 시간 (s)</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.home.avgAttackDuration?.toFixed(1)}s</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">CE당 소요 시간 (s)</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.home.timePerCE?.toFixed(1)}s</TableCell>
              ))}
            </TableRow>

            {/* Team Rows - AWAY */}
            <TableRow className="bg-muted/10">
              <TableCell className="font-bold text-chart-2" colSpan={5}>
                {awayTeam.name} (Away)
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">득점 (필드/PC)</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">
                  {q.away.goals?.field} / {q.away.goals?.pc}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">슈팅</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.away.shots}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">서클 진입 (CE)</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.away.circleEntries}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">25y 진입</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.away.twentyFiveEntries}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">점유율 (%)</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.away.possession}%</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">공격 점유율 (%)</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.away.attackPossession}%</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">평균 SPP (s)</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.away.spp.toFixed(1)}s</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">공격 유지 시간 (s)</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.away.avgAttackDuration?.toFixed(1)}s</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">CE당 소요 시간 (s)</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.away.timePerCE?.toFixed(1)}s</TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
