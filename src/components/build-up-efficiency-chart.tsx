"use client"

import React from "react"
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

  const getChartData = (isHome: boolean) => {
    return quarterlyStats.map((q: QuarterStats) => {
      const teamStats = isHome ? q.home : q.away
      const twentyFive = teamStats.twentyFiveEntries || 1
      const circle = teamStats.circleEntries || 0
      const efficiency = Math.round((circle / twentyFive) * 100)
      
      return {
        quarter: q.quarter,
        "25y Entries": twentyFive,
        "Circle Entries": circle,
        "Efficiency (%)": efficiency
      }
    })
  }

  const homeData = getChartData(true)
  const awayData = getChartData(false)

  const renderChart = (chartData: any[], teamName: string, color: string) => (
    <div className="w-full">
      <h3 className="text-sm font-bold mb-4 px-2" style={{ color }}>{teamName} Efficiency</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis dataKey="quarter" />
          <YAxis yAxisId="left" label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
          <YAxis yAxisId="right" orientation="right" label={{ value: 'Eff (%)', angle: 90, position: 'insideRight' }} domain={[0, 100]} />
          <Tooltip />
          <Legend />
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
        <CardTitle>25y 진입 대비 서클 진입 효율 (양팀 비교)</CardTitle>
        <CardDescription>
          각 팀의 공격 효율성 분석 (25m 진입 횟수 대비 서클 진입 전환율)
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
