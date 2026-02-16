
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
    const nH = parseFloat(valH as any);
    const nA = parseFloat(valA as any);
    if (isNaN(nH) || isNaN(nA) || nH === nA) return "";
    const hWins = lowerIsBetter ? nH < nA : nH > nA;
    return hWins ? "home-win" : "away-win";
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
              <TableCell 
                key={q.quarter} 
                className="text-center border-x"
                style={winnerClass === "home-win" ? { color: homeTeam.color, fontWeight: 'bold' } : {}}
              >
                {safeVal(hVal, decimals)}
              </TableCell>
            );
          })}
          <TableCell 
            className="text-center border-x bg-muted/30 font-bold"
            style={totalWinnerClass === "home-win" ? { color: homeTeam.color } : {}}
          >
            {safeVal(hTotal, decimals)}
          </TableCell>
        </TableRow>
        <TableRow className="bg-chart-2/5 border-b-[4px] border-b-foreground/30">
          <TableCell className="pl-6 text-sm font-medium">{label} ({awayTeam.name})</TableCell>
          {quarterlyStats.map(q => {
            const hVal = (q.home as any)[field];
            const aVal = (q.away as any)[field];
            const winnerClass = getWinnerClass(hVal, aVal, lowerIsBetter);
            return (
              <TableCell 
                key={q.quarter} 
                className="text-center border-x"
                style={winnerClass === "away-win" ? { color: awayTeam.color, fontWeight: 'bold' } : {}}
              >
                {safeVal(aVal, decimals)}
              </TableCell>
            );
          })}
          <TableCell 
            className="text-center border-x bg-muted/30 font-bold"
            style={totalWinnerClass === "away-win" ? { color: awayTeam.color } : {}}
          >
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
              <TableCell className="pl-6 text-sm font-medium">득점 (PC/전체득점) ({homeTeam.name})</TableCell>
              {quarterlyStats.map(q => {
                const hTot = (q.home.goals?.field || 0) + (q.home.goals?.pc || 0);
                const aTot = (q.away.goals?.field || 0) + (q.away.goals?.pc || 0);
                const winnerClass = getWinnerClass(hTot, aTot);
                return (
                  <TableCell 
                    key={q.quarter} 
                    className="text-center border-x"
                    style={winnerClass === "home-win" ? { color: homeTeam.color, fontWeight: 'bold' } : {}}
                  >
                    {safeVal(q.home.goals?.pc)} / {safeVal(hTot)}
                  </TableCell>
                );
              })}
              <TableCell 
                className="text-center border-x bg-muted/30 font-bold"
                style={getWinnerClass(matchStats.home.goals.field + matchStats.home.goals.pc, matchStats.away.goals.field + matchStats.away.goals.pc) === "home-win" ? { color: homeTeam.color } : {}}
              >
                {safeVal(matchStats.home.goals.pc)} / {safeVal(matchStats.home.goals.field + matchStats.home.goals.pc)}
              </TableCell>
            </TableRow>
            <TableRow className="bg-chart-2/5 border-b-[4px] border-b-foreground/30">
              <TableCell className="pl-6 text-sm font-medium">득점 (PC/전체득점) ({awayTeam.name})</TableCell>
              {quarterlyStats.map(q => {
                const hTot = (q.home.goals?.field || 0) + (q.home.goals?.pc || 0);
                const aTot = (q.away.goals?.field || 0) + (q.away.goals?.pc || 0);
                const winnerClass = getWinnerClass(hTot, aTot);
                return (
                  <TableCell 
                    key={q.quarter} 
                    className="text-center border-x"
                    style={winnerClass === "away-win" ? { color: awayTeam.color, fontWeight: 'bold' } : {}}
                  >
                    {safeVal(q.away.goals?.pc)} / {safeVal(aTot)}
                  </TableCell>
                );
              })}
              <TableCell 
                className="text-center border-x bg-muted/30 font-bold"
                style={getWinnerClass(matchStats.home.goals.field + matchStats.home.goals.pc, matchStats.away.goals.field + matchStats.away.goals.pc) === "away-win" ? { color: awayTeam.color } : {}}
              >
                {safeVal(matchStats.away.goals.pc)} / {safeVal(matchStats.away.goals.field + matchStats.away.goals.pc)}
              </TableCell>
            </TableRow>

            {/* 나머지 지표 섹션들 */}
            {renderStatRows("슈팅", "shots")}
            {renderStatRows("페널티코너 (PC)", "pcs")}
            {renderStatRows("PC 성공률 (%)", "pcSuccessRate", 1)}
            {renderStatRows("서클 진입 (CE)", "circleEntries")}
            {renderStatRows("25y 진입 (A25)", "twentyFiveEntries")}
            {renderStatRows("전체 점유율 (%)", "possession", 1)}
            {renderStatRows("공격 점유율 (%)", "attackPossession", 1)}
            {renderStatRows("빌드업 점유 비중 (%)", "buildUpPossession", 1)}
            {renderStatRows("평균 SPP (s)", "spp", 1, true)}
            {renderStatRows("CE당 소요시간 (s)", "timePerCE", 1, true)}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
