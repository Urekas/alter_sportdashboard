"use client"

import React, { useState } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { MatchData, QuarterStats } from "@/lib/types"

interface BuildUpEfficiencyChartProps {
  data: MatchData
}

export function BuildUpEfficiencyChart({ data }: BuildUpEfficiencyChartProps) {
  const { homeTeam, awayTeam, quarterlyStats } = data
  const [selectedTeam, setSelectedTeam] = useState<string>("HOME")

  const chartData = quarterlyStats.map((q: QuarterStats) => {
    const teamStats = selectedTeam === "HOME" ? q.home : q.away
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

  const teamName = selectedTeam === "HOME" ? homeTeam.name : awayTeam.name

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <CardTitle>25y 진입 대비 서클 진입 효율 (쿼터별)</CardTitle>
          <CardDescription>
            {teamName}의 공격 효율성 분석 (25m 진입 횟수 vs 서클 진입 횟수)
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
           <span className="text-xs font-medium text-muted-foreground">팀 선택:</span>
           <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select Team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HOME">{homeTeam.name} (HOME)</SelectItem>
              <SelectItem value="AWAY">{awayTeam.name} (AWAY)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="quarter" />
            <YAxis yAxisId="left" label={{ value: '횟수', angle: -90, position: 'insideLeft' }} />
            <YAxis yAxisId="right" orientation="right" label={{ value: '전환율 (%)', angle: 90, position: 'insideRight' }} domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="25y Entries" fill="hsl(var(--primary) / 0.3)" radius={[4, 4, 0, 0]} barSize={60} />
            <Bar yAxisId="left" dataKey="Circle Entries" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
            <Line yAxisId="right" type="monotone" dataKey="Efficiency (%)" stroke="hsl(var(--destructive))" strokeWidth={3} dot={{ r: 6, fill: "hsl(var(--destructive))" }} label={{ position: 'top', fill: "hsl(var(--destructive))", fontSize: 12, fontWeight: 'bold' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
