
"use client"

import React, { useMemo } from "react"
import {
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { MatchData, QuarterStats } from "@/lib/types"

interface BuildUpEfficiencyChartProps {
  data: MatchData
}

export function BuildUpEfficiencyChart({ data }: BuildUpEfficiencyChartProps) {
  const { homeTeam, awayTeam, quarterlyStats } = data

  const getTeamChartData = (isHome: boolean) => {
    return quarterlyStats.map((q: QuarterStats) => {
      const teamStats = isHome ? q.home : q.away
      const twentyFive = teamStats.twentyFiveEntries || 0
      const circle = teamStats.circleEntries || 0
      const efficiency = twentyFive > 0 ? (circle / twentyFive) * 100 : 0
      
      return {
        quarter: q.quarter,
        "25y Entries": twentyFive,
        "Circle Entries": circle,
        "Efficiency (%)": Number(efficiency.toFixed(1))
      }
    })
  }

  const homeData = getTeamChartData(true)
  const awayData = getTeamChartData(false)

  // Y축 동기화를 위한 최대값 계산
  const globalMaxEntries = useMemo(() => {
    const allEntries = [...homeData, ...awayData].map(d => Math.max(d["25y Entries"], d["Circle Entries"]))
    return Math.ceil(Math.max(...allEntries, 1) * 1.1)
  }, [homeData, awayData])

  const globalMaxEfficiency = 100

  const renderChart = (chartData: any[], teamName: string, color: string) => (
    <div className="w-full">
      <h3 className="text-sm font-bold mb-4 px-2" style={{ color }}>{teamName} 공격 효율</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis dataKey="quarter" />
          <YAxis 
            yAxisId="left" 
            label={{ value: '횟수', angle: -90, position: 'insideLeft' }} 
            domain={[0, globalMaxEntries]}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            label={{ value: '효율 (%)', angle: 90, position: 'insideRight' }} 
            domain={[0, globalMaxEfficiency]} 
          />
          <Tooltip />
          <Legend formatter={(value) => {
            if (value === "25y Entries") return "25y 진입";
            if (value === "Circle Entries") return "서클 진입";
            if (value === "Efficiency (%)") return "전환 효율 (%)";
            return value;
          }} />
          <Bar yAxisId="left" dataKey="25y Entries" fill={color} fillOpacity={0.3} radius={[4, 4, 0, 0]} barSize={40} />
          <Bar yAxisId="left" dataKey="Circle Entries" fill={color} radius={[4, 4, 0, 0]} barSize={25} />
          <Line yAxisId="right" type="monotone" dataKey="Efficiency (%)" stroke="hsl(var(--destructive))" strokeWidth={3} dot={{ r: 5, fill: "hsl(var(--destructive))" }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>25y 진입 대비 서클 진입 효율 (Y축 통계 동기화)</CardTitle>
        <CardDescription>
          양팀의 공격 효율을 동일한 기준(Y축)에서 비교합니다. (25m 진입 대비 서클 진입 성공률)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-12">
        {renderChart(homeData, homeTeam.name, homeTeam.color)}
        <div className="border-t pt-8">
          {renderChart(awayData, awayTeam.name, awayTeam.color === homeTeam.color ? 'hsl(var(--chart-2))' : awayTeam.color)}
        </div>
      </CardContent>
    </Card>
  )
}
