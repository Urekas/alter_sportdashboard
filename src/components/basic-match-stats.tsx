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

interface BasicMatchStatsProps {
  data: MatchData
}

export function BasicMatchStats({ data }: BasicMatchStatsProps) {
  const { homeTeam, awayTeam, matchStats } = data

  const getWinnerClass = (valH: number, valA: number, lowerIsBetter: boolean = false) => {
    if (valH === valA) return "";
    const hWins = lowerIsBetter ? valH < valA : valH > valA;
    return hWins ? "text-primary font-bold" : "text-chart-2 font-bold";
  };

  const formatValue = (val: any) => {
    const num = parseFloat(val);
    return isNaN(num) ? "0" : num;
  };

  const stats = [
    { 
      label: "득점 (필드 / PC)", 
      h: `${Math.round(matchStats.home.goals.field)} / ${Math.round(matchStats.home.goals.pc)}`, 
      a: `${Math.round(matchStats.away.goals.field)} / ${Math.round(matchStats.away.goals.pc)}`,
      hVal: matchStats.home.goals.field + matchStats.home.goals.pc,
      aVal: matchStats.away.goals.field + matchStats.away.goals.pc
    },
    { label: "슈팅", h: formatValue(matchStats.home.shots), a: formatValue(matchStats.away.shots) },
    { label: "페널티코너 (PC)", h: formatValue(matchStats.home.pcs), a: formatValue(matchStats.away.pcs) },
    { label: "서클 진입 (CE)", h: formatValue(matchStats.home.circleEntries), a: formatValue(matchStats.away.circleEntries) },
    { label: "25y 진입 (A25)", h: formatValue(matchStats.home.twentyFiveEntries), a: formatValue(matchStats.away.twentyFiveEntries) },
    { label: "빌드업 성공률 (%)", h: formatValue(matchStats.home.build25Ratio), a: formatValue(matchStats.away.build25Ratio), isFloat: true },
    { label: "SPP (압박 지수, s)", h: formatValue(matchStats.home.spp), a: formatValue(matchStats.away.spp), isFloat: true, lowerIsBetter: true },
    { label: "전체 점유율 (%)", h: formatValue(matchStats.home.possession), a: formatValue(matchStats.away.possession), isFloat: true },
    { label: "공격 점유율 (%)", h: formatValue(matchStats.home.attackPossession), a: formatValue(matchStats.away.attackPossession), isFloat: true },
    { label: "CE 1회당 소요 시간 (s)", h: formatValue(matchStats.home.timePerCE), a: formatValue(matchStats.away.timePerCE), isFloat: true, lowerIsBetter: true },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>기본 경기 통계 (Basic Match Stats)</CardTitle>
        <CardDescription>%, 초(s): 소수점 1자리 / 횟수: 정수 단위 (우세한 팀 색상 강조)</CardDescription>
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
            {stats.map((s) => {
              const hVal = typeof s.hVal === 'number' ? s.hVal : Number(s.h);
              const aVal = typeof s.aVal === 'number' ? s.aVal : Number(s.a);
              const winnerClass = getWinnerClass(hVal, aVal, s.lowerIsBetter);
              
              return (
                <TableRow key={s.label}>
                  <TableCell className="font-medium">{s.label}</TableCell>
                  <TableCell className={cn("text-center", winnerClass.includes("text-primary") && winnerClass)}>
                    {s.isFloat ? Number(s.h).toFixed(1) : s.h}
                  </TableCell>
                  <TableCell className={cn("text-center", winnerClass.includes("text-chart-2") && winnerClass)}>
                    {s.isFloat ? Number(s.a).toFixed(1) : s.a}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}