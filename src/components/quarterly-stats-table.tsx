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
import { cn } from "@/lib/utils"

interface QuarterlyStatsTableProps {
  data: MatchData
}

export function QuarterlyStatsTable({ data }: QuarterlyStatsTableProps) {
  const { homeTeam, awayTeam, quarterlyStats } = data

  const safeVal = (val: any, decimals: number = 0) => {
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return decimals === 0 ? "0" : "0.0";
    return decimals === 0 ? Math.round(num).toString() : num.toFixed(decimals);
  };

  const getWinnerClass = (valH: number, valA: number, lowerIsBetter: boolean = false) => {
    if (valH === valA) return "";
    const hWins = lowerIsBetter ? valH < valA : valH > valA;
    return hWins ? "text-primary font-bold" : "text-chart-2 font-bold";
  };

  const renderStatRow = (label: string, field: string, decimals: number = 0, lowerIsBetter: boolean = false) => {
    return (
      <TableRow>
        <TableCell className="pl-6 text-sm font-medium">{label}</TableCell>
        {quarterlyStats.map(q => {
          const hVal = (q.home as any)[field];
          const aVal = (q.away as any)[field];
          const winnerClass = getWinnerClass(hVal, aVal, lowerIsBetter);
          return (
            <TableCell key={q.quarter} className="text-center border-x p-0">
              <div className="flex flex-col">
                <span className={cn("py-1 border-b", winnerClass.includes("text-primary") && winnerClass)}>
                  {safeVal(hVal, decimals)}
                </span>
                <span className={cn("py-1", winnerClass.includes("text-chart-2") && winnerClass)}>
                  {safeVal(aVal, decimals)}
                </span>
              </div>
            </TableCell>
          );
        })}
      </TableRow>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>쿼터별 경기 통계 (Quarterly Match Stats)</CardTitle>
        <CardDescription>
          상단: {homeTeam.name} / 하단: {awayTeam.name} (우세 지표 컬러 강조)
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
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">득점 (필드/PC)</TableCell>
              {quarterlyStats.map(q => {
                const hTot = (q.home.goals?.field || 0) + (q.home.goals?.pc || 0);
                const aTot = (q.away.goals?.field || 0) + (q.away.goals?.pc || 0);
                const winnerClass = getWinnerClass(hTot, aTot);
                return (
                  <TableCell key={q.quarter} className="text-center border-x p-0">
                    <div className="flex flex-col">
                      <span className={cn("py-1 border-b", winnerClass.includes("text-primary") && winnerClass)}>
                        {safeVal(q.home.goals?.field)}/{safeVal(q.home.goals?.pc)}
                      </span>
                      <span className={cn("py-1", winnerClass.includes("text-chart-2") && winnerClass)}>
                        {safeVal(q.away.goals?.field)}/{safeVal(q.away.goals?.pc)}
                      </span>
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>
            {renderStatRow("슈팅", "shots")}
            {renderStatRow("페널티코너 (PC)", "pcs")}
            {renderStatRow("서클 진입 (CE)", "circleEntries")}
            {renderStatRow("점유율 (%)", "possession", 1)}
            {renderStatRow("공격 점유율 (%)", "attackPossession", 1)}
            {renderStatRow("평균 SPP (s)", "spp", 1, true)}
            {renderStatRow("CE당 소요시간 (s)", "timePerCE", 1, true)}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}