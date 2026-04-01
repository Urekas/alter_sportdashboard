
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
  data: MatchData;
  ranks?: Record<string, number | null> | null;
}

export function BasicMatchStats({ data, ranks }: BasicMatchStatsProps) {
  const { homeTeam, awayTeam, matchStats } = data

  const getWinnerClass = (valH: number, valA: number, lowerIsBetter: boolean = false) => {
    if (valH === valA) return "";
    const hWins = lowerIsBetter ? valH < valA : valH > valA;
    return hWins ? "home-win" : "away-win";
  };

  const formatValue = (val: any) => {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  };

  const stats = [
    { 
      label: "득점 (PC / 전체득점)", 
      key: 'goals',
      h: `${formatValue(matchStats.home.goals.pc).toFixed(1)} / ${(formatValue(matchStats.home.goals.field) + formatValue(matchStats.home.goals.pc)).toFixed(1)}`, 
      a: `${formatValue(matchStats.away.goals.pc).toFixed(1)} / ${(formatValue(matchStats.away.goals.field) + formatValue(matchStats.away.goals.pc)).toFixed(1)}`,
      hVal: formatValue(matchStats.home.goals.field) + formatValue(matchStats.home.goals.pc),
      aVal: formatValue(matchStats.away.goals.field) + formatValue(matchStats.away.goals.pc)
    },
    { label: "슈팅", key: 'shots', h: formatValue(matchStats.home.shots), a: formatValue(matchStats.away.shots), isFloat: true },
    { label: "페널티코너 (PC)", key: 'pcs', h: formatValue(matchStats.home.pcs), a: formatValue(matchStats.away.pcs), isFloat: true },
    { label: "PC 성공률 (%)", key: 'pcSuccessRate', h: formatValue(matchStats.home.pcSuccessRate), a: formatValue(matchStats.away.pcSuccessRate), isFloat: true },
    { label: "서클 진입 (CE)", key: 'circleEntries', h: formatValue(matchStats.home.circleEntries), a: formatValue(matchStats.away.circleEntries), isFloat: true },
    { label: "25y 진입 (A25)", key: 'twentyFiveEntries', h: formatValue(matchStats.home.twentyFiveEntries), a: formatValue(matchStats.away.twentyFiveEntries), isFloat: true },
    { label: "빌드업 성공률 (%)", key: 'build25Ratio', h: formatValue(matchStats.home.build25Ratio), a: formatValue(matchStats.away.build25Ratio), isFloat: true },
    { label: "SPP (압박 지수, s)", key: 'spp', h: formatValue(matchStats.home.spp), a: formatValue(matchStats.away.spp), isFloat: true, lowerIsBetter: true },
    { label: "전체 점유율 (%)", key: 'possession', h: formatValue(matchStats.home.possession), a: formatValue(matchStats.away.possession), isFloat: true },
    { label: "공격 점유율 (%)", key: 'attackPossession', h: formatValue(matchStats.home.attackPossession), a: formatValue(matchStats.away.attackPossession), isFloat: true },
    { label: "빌드업 정체 비율 (%)", key: 'buildUpStagnation', h: formatValue(matchStats.home.buildUpStagnation), a: formatValue(matchStats.away.buildUpStagnation), isFloat: true, lowerIsBetter: true },
    { label: "CE 1회당 시간 (s)", key: 'timePerCE', h: formatValue(matchStats.home.timePerCE), a: formatValue(matchStats.away.timePerCE), isFloat: true, lowerIsBetter: true },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>종합 통계 비교</CardTitle>
        <CardDescription>{homeTeam.name}의 성과를 비교 대상과 대조합니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>분석 항목</TableHead>
              <TableHead className="text-center font-bold" style={{ color: homeTeam.color }}>{homeTeam.name}</TableHead>
              <TableHead className="text-center font-bold" style={{ color: awayTeam.color }}>{awayTeam.name}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.map((s) => {
              const hVal = typeof s.hVal === 'number' ? s.hVal : Number(s.h);
              const aVal = typeof s.aVal === 'number' ? s.aVal : Number(s.a);
              const winnerClass = getWinnerClass(hVal, aVal, s.lowerIsBetter);
              const rank = ranks && s.key ? ranks[s.key] : null;

              return (
                <TableRow key={s.label}>
                  <TableCell className="font-medium">{s.label}</TableCell>
                  <TableCell 
                    className="text-center" 
                    style={winnerClass === "home-win" ? { color: homeTeam.color, fontWeight: 'bold' } : {}}
                  >
                    {s.isFloat ? Number(s.h).toFixed(1) : s.h}
                    {rank && <span className="text-xs text-muted-foreground ml-1">({rank}위)</span>}
                  </TableCell>
                  <TableCell 
                    className="text-center"
                    style={winnerClass === "away-win" ? { color: awayTeam.color, fontWeight: 'bold' } : {}}
                  >
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
