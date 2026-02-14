
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

  const safeVal = (val: any, decimals: number = 0) => {
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return "0";
    return decimals === 0 ? Math.round(num).toString() : num.toFixed(decimals);
  };

  const renderTeamRows = (teamName: string, stats: any[], isHome: boolean) => {
    const colorClass = isHome ? "text-primary" : "text-chart-2";
    return (
      <>
        <TableRow className="bg-muted/10">
          <TableCell className={`font-bold ${colorClass}`} colSpan={5}>
            {teamName} ({isHome ? "홈" : "어웨이"})
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="pl-6 text-sm font-medium">득점 (필드/PC)</TableCell>
          {stats.map(q => {
            const s = isHome ? q.home : q.away;
            return (
              <TableCell key={q.quarter} className="text-center border-x">
                {safeVal(s.goals?.field)} / {safeVal(s.goals?.pc)}
              </TableCell>
            );
          })}
        </TableRow>
        <TableRow>
          <TableCell className="pl-6 text-sm font-medium">슈팅</TableCell>
          {stats.map(q => (
            <TableCell key={q.quarter} className="text-center border-x">
              {safeVal((isHome ? q.home : q.away).shots)}
            </TableCell>
          ))}
        </TableRow>
        <TableRow>
          <TableCell className="pl-6 text-sm font-medium">페널티코너 (PC)</TableCell>
          {stats.map(q => (
            <TableCell key={q.quarter} className="text-center border-x">
              {safeVal((isHome ? q.home : q.away).pcs)}
            </TableCell>
          ))}
        </TableRow>
        <TableRow>
          <TableCell className="pl-6 text-sm font-medium">서클 진입 (CE)</TableCell>
          {stats.map(q => (
            <TableCell key={q.quarter} className="text-center border-x">
              {safeVal((isHome ? q.home : q.away).circleEntries)}
            </TableCell>
          ))}
        </TableRow>
        <TableRow>
          <TableCell className="pl-6 text-sm font-medium">점유율 (%)</TableCell>
          {stats.map(q => (
            <TableCell key={q.quarter} className="text-center border-x">
              {safeVal((isHome ? q.home : q.away).possession, 1)}
            </TableCell>
          ))}
        </TableRow>
        <TableRow>
          <TableCell className="pl-6 text-sm font-medium">평균 SPP (s)</TableCell>
          {stats.map(q => (
            <TableCell key={q.quarter} className="text-center border-x">
              {safeVal((isHome ? q.home : q.away).spp, 1)}
            </TableCell>
          ))}
        </TableRow>
        <TableRow>
          <TableCell className="pl-6 text-sm font-medium">공격 점유율 (%)</TableCell>
          {stats.map(q => (
            <TableCell key={q.quarter} className="text-center border-x">
              {safeVal((isHome ? q.home : q.away).attackPossession, 1)}
            </TableCell>
          ))}
        </TableRow>
      </>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>쿼터별 경기 통계 (Quarterly Match Stats)</CardTitle>
        <CardDescription>
          %, 초(s): 소수점 1자리 / 횟수: 정수 단위로 상세 지표를 표시합니다.
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
            {renderTeamRows(homeTeam.name, quarterlyStats, true)}
            {renderTeamRows(awayTeam.name, quarterlyStats, false)}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
