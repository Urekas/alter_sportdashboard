
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

export function BasicMatchStats({ data }: BasicMatchStatsProps) {
  const { homeTeam, awayTeam, matchStats } = data

  const formatValue = (val: any, type: 'count' | 'float') => {
    const num = parseFloat(val);
    if (isNaN(num)) return "0";
    // 횟수(count)는 정수로, 비율/시간(float)은 소수점 1자리로 표시
    return type === 'float' ? num.toFixed(1) : Math.round(num).toString();
  };

  const stats = [
    { label: "득점 (필드 / PC)", h: `${Math.round(matchStats.home.goals.field)} / ${Math.round(matchStats.home.goals.pc)}`, a: `${Math.round(matchStats.away.goals.field)} / ${Math.round(matchStats.away.goals.pc)}` },
    { label: "슈팅", h: formatValue(matchStats.home.shots, 'count'), a: formatValue(matchStats.away.shots, 'count') },
    { label: "서클 진입 (CE)", h: formatValue(matchStats.home.circleEntries, 'count'), a: formatValue(matchStats.away.circleEntries, 'count') },
    { label: "25y 진입 (A25)", h: formatValue(matchStats.home.twentyFiveEntries, 'count'), a: formatValue(matchStats.away.twentyFiveEntries, 'count') },
    { label: "빌드업 성공률 (%)", h: formatValue(matchStats.home.build25Ratio, 'float'), a: formatValue(matchStats.away.build25Ratio, 'float') },
    { label: "SPP (압박 지수, s)", h: formatValue(matchStats.home.spp, 'float'), a: formatValue(matchStats.away.spp, 'float') },
    { label: "전체 점유율 (%)", h: formatValue(matchStats.home.possession, 'float'), a: formatValue(matchStats.away.possession, 'float') },
    { label: "공격 점유율 (%)", h: formatValue(matchStats.home.attackPossession, 'float'), a: formatValue(matchStats.away.attackPossession, 'float') },
    { label: "평균 공격 유지 시간 (s)", h: formatValue(matchStats.home.avgAttackDuration, 'float'), a: formatValue(matchStats.away.avgAttackDuration, 'float') },
    { label: "CE 1회당 소요 시간 (s)", h: formatValue(matchStats.home.timePerCE, 'float'), a: formatValue(matchStats.away.timePerCE, 'float') },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>기본 경기 통계 (Basic Match Stats)</CardTitle>
        <CardDescription>%, 초(s): 소수점 1자리 / 횟수: 정수 단위</CardDescription>
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
            {stats.map((s) => (
              <TableRow key={s.label}>
                <TableCell className="font-medium">{s.label}</TableCell>
                <TableCell className="text-center">{s.h}</TableCell>
                <TableCell className="text-center">{s.a}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
