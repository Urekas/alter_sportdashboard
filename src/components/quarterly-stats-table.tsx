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
  const { homeTeam, awayTeam, quarterlyStats, matchStats } = data

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

  const renderStatRows = (label: string, field: string, decimals: number = 0, lowerIsBetter: boolean = false) => {
    const hTotal = (matchStats.home as any)[field];
    const aTotal = (matchStats.away as any)[field];
    const totalWinnerClass = getWinnerClass(hTotal, aTotal, lowerIsBetter);

    return (
      <>
        <TableRow className="bg-primary/5">
          <TableCell className="pl-6 text-sm font-medium">{label} ({homeTeam.name})</TableCell>
          {quarterlyStats.map(q => {
            const hVal = (q.home as any)[field];
            const aVal = (q.away as any)[field];
            const winnerClass = getWinnerClass(hVal, aVal, lowerIsBetter);
            return (
              <TableCell key={q.quarter} className={cn("text-center border-x", winnerClass.includes("text-primary") && winnerClass)}>
                {safeVal(hVal, decimals)}
              </TableCell>
            );
          })}
          {/* 경기 전체 열 */}
          <TableCell className={cn("text-center border-x bg-muted/30 font-bold", totalWinnerClass.includes("text-primary") && totalWinnerClass)}>
            {safeVal(hTotal, decimals)}
          </TableCell>
        </TableRow>
        <TableRow className="bg-chart-2/5 border-b-[3px] border-b-foreground/20">
          <TableCell className="pl-6 text-sm font-medium">{label} ({awayTeam.name})</TableCell>
          {quarterlyStats.map(q => {
            const hVal = (q.home as any)[field];
            const aVal = (q.away as any)[field];
            const winnerClass = getWinnerClass(hVal, aVal, lowerIsBetter);
            return (
              <TableCell key={q.quarter} className={cn("text-center border-x", winnerClass.includes("text-chart-2") && winnerClass)}>
                {safeVal(aVal, decimals)}
              </TableCell>
            );
          })}
          {/* 경기 전체 열 */}
          <TableCell className={cn("text-center border-x bg-muted/30 font-bold", totalWinnerClass.includes("text-chart-2") && totalWinnerClass)}>
            {safeVal(aTotal, decimals)}
          </TableCell>
        </TableRow>
      </>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>쿼터별 경기 통계 (Quarterly Match Stats)</CardTitle>
        <CardDescription>
          지표별 상단: {homeTeam.name} / 하단: {awayTeam.name} (진한 구분선으로 지표 구분)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">분석 항목 / 쿼터</TableHead>
              {quarterlyStats.map(q => (
                <TableHead key={q.quarter} className="text-center font-bold border-x bg-muted/30">
                  {q.quarter}
                </TableHead>
              ))}
              <TableHead className="text-center font-bold border-x bg-muted/50 text-foreground">
                경기 전체
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* 득점 섹션 */}
            <TableRow className="bg-primary/5">
              <TableCell className="pl-6 text-sm font-medium">득점 (필드/PC) ({homeTeam.name})</TableCell>
              {quarterlyStats.map(q => {
                const hTot = (q.home.goals?.field || 0) + (q.home.goals?.pc || 0);
                const aTot = (q.away.goals?.field || 0) + (q.away.goals?.pc || 0);
                const winnerClass = getWinnerClass(hTot, aTot);
                return (
                  <TableCell key={q.quarter} className={cn("text-center border-x", winnerClass.includes("text-primary") && winnerClass)}>
                    {safeVal(q.home.goals?.field)}/{safeVal(q.home.goals?.pc)}
                  </TableCell>
                );
              })}
              <TableCell className={cn("text-center border-x bg-muted/30 font-bold", getWinnerClass(matchStats.home.goals.field + matchStats.home.goals.pc, matchStats.away.goals.field + matchStats.away.goals.pc).includes("text-primary") && "text-primary")}>
                {safeVal(matchStats.home.goals.field)}/{safeVal(matchStats.home.goals.pc)}
              </TableCell>
            </TableRow>
            <TableRow className="bg-chart-2/5 border-b-[3px] border-b-foreground/20">
              <TableCell className="pl-6 text-sm font-medium">득점 (필드/PC) ({awayTeam.name})</TableCell>
              {quarterlyStats.map(q => {
                const hTot = (q.home.goals?.field || 0) + (q.home.goals?.pc || 0);
                const aTot = (q.away.goals?.field || 0) + (q.away.goals?.pc || 0);
                const winnerClass = getWinnerClass(hTot, aTot);
                return (
                  <TableCell key={q.quarter} className={cn("text-center border-x", winnerClass.includes("text-chart-2") && winnerClass)}>
                    {safeVal(q.away.goals?.field)}/{safeVal(q.away.goals?.pc)}
                  </TableCell>
                );
              })}
              <TableCell className={cn("text-center border-x bg-muted/30 font-bold", getWinnerClass(matchStats.home.goals.field + matchStats.home.goals.pc, matchStats.away.goals.field + matchStats.away.goals.pc).includes("text-chart-2") && "text-chart-2")}>
                {safeVal(matchStats.away.goals.field)}/{safeVal(matchStats.away.goals.pc)}
              </TableCell>
            </TableRow>

            {/* 나머지 지표 섹션들 */}
            {renderStatRows("슈팅", "shots")}
            {renderStatRows("페널티코너 (PC)", "pcs")}
            {renderStatRows("서클 진입 (CE)", "circleEntries")}
            {renderStatRows("25y 진입 (A25)", "twentyFiveEntries")}
            {renderStatRows("전체 점유율 (%)", "possession", 1)}
            {renderStatRows("공격 점유율 (%)", "attackPossession", 1)}
            {renderStatRows("평균 SPP (s)", "spp", 1, true)}
            {renderStatRows("CE당 소요시간 (s)", "timePerCE", 1, true)}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}