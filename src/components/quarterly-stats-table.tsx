
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
import { Settings2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { useState } from "react"

interface QuarterlyStatsTableProps {
  data: MatchData
}

export function QuarterlyStatsTable({ data }: QuarterlyStatsTableProps) {
  const { homeTeam, awayTeam, quarterlyStats, matchStats } = data
  const [fontSize, setFontSize] = useState(13)
  const [tableScale, setTableScale] = useState(100)

  const safeVal = (val: any, decimals: number = 0) => {
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return decimals === 0 ? "0" : "0.00";
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
          <TableCell className="pl-6 font-medium whitespace-nowrap">{label} ({homeTeam.name})</TableCell>
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
          <TableCell className="pl-6 font-medium whitespace-nowrap">{label} ({awayTeam.name})</TableCell>
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
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>쿼터별 경기 통계 (Quarterly Match Stats)</CardTitle>
          <CardDescription>
            지표별 상단: {homeTeam.name} / 하단: {awayTeam.name} (대회 누적 시 평균 수치로 표시)
          </CardDescription>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8 print-hidden"><Settings2 className="h-4 w-4" /></Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-4">
              <h4 className="font-bold text-sm">표 표시 설정</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <Label>글꼴 크기</Label>
                  <span className="font-bold">{fontSize}px</span>
                </div>
                <Slider value={[fontSize]} min={8} max={24} step={1} onValueChange={([v]) => setFontSize(v)} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <Label>표 배율</Label>
                  <span className="font-bold">{tableScale}%</span>
                </div>
                <Slider value={[tableScale]} min={50} max={150} step={5} onValueChange={([v]) => setTableScale(v)} />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent>
        <div style={{ transform: `scale(${tableScale / 100})`, transformOrigin: 'top left', width: `${100 / (tableScale / 100)}%` }}>
          <Table style={{ fontSize: `${fontSize}px` }}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">분석 항목 / 쿼터</TableHead>
                {quarterlyStats.map(q => (
                  <TableHead key={q.quarter} className="text-center font-bold border-x bg-muted/30">
                    {q.quarter}
                  </TableHead>
                ))}
                <TableHead className="text-center font-bold border-x bg-muted/50 text-foreground">
                  전체 평균
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-primary/5">
                <TableCell className="pl-6 font-medium whitespace-nowrap">득점 (PC/전체득점) ({homeTeam.name})</TableCell>
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
                      {safeVal(q.home.goals?.pc, 2)} / {safeVal(hTot, 2)}
                    </TableCell>
                  );
                })}
                <TableCell 
                  className="text-center border-x bg-muted/30 font-bold"
                  style={getWinnerClass(matchStats.home.goals.field + matchStats.home.goals.pc, matchStats.away.goals.field + matchStats.away.goals.pc) === "home-win" ? { color: homeTeam.color } : {}}
                >
                  {safeVal(matchStats.home.goals.pc, 2)} / {safeVal(matchStats.home.goals.field + matchStats.home.goals.pc, 2)}
                </TableCell>
              </TableRow>
              <TableRow className="bg-chart-2/5 border-b-[4px] border-b-foreground/30">
                <TableCell className="pl-6 font-medium whitespace-nowrap">득점 (PC/전체득점) ({awayTeam.name})</TableCell>
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
                      {safeVal(q.away.goals?.pc, 2)} / {safeVal(aTot, 2)}
                    </TableCell>
                  );
                })}
                <TableCell 
                  className="text-center border-x bg-muted/30 font-bold"
                  style={getWinnerClass(matchStats.home.goals.field + matchStats.home.goals.pc, matchStats.away.goals.field + matchStats.away.goals.pc) === "away-win" ? { color: awayTeam.color } : {}}
                >
                  {safeVal(matchStats.away.goals.pc, 2)} / {safeVal(matchStats.away.goals.field + matchStats.away.goals.pc, 2)}
                </TableCell>
              </TableRow>

              {renderStatRows("슈팅", "shots", 2)}
              {renderStatRows("페널티코너 (PC)", "pcs", 1)}
              {renderStatRows("PC 성공률 (%)", "pcSuccessRate", 1)}
              {renderStatRows("서클 진입 (CE)", "circleEntries", 1)}
              {renderStatRows("25y 진입 (A25)", "twentyFiveEntries", 1)}
              {renderStatRows("전체 점유율 (%)", "possession", 1)}
              {renderStatRows("공격 점유율 (%)", "attackPossession", 1)}
              {renderStatRows("빌드업 정체 비율 (%)", "buildUpStagnation", 1)}
              {renderStatRows("평균 SPP (s)", "spp", 1, true)}
              {renderStatRows("CE당 소요시간 (s)", "timePerCE", 1, true)}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
