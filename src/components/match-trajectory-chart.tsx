
"use client"

import React, { useMemo } from "react"
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  ReferenceArea,
  ReferenceLine,
  Label,
  Cell,
  CartesianGrid
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { MatchData, Team } from "@/lib/types"

interface MatchTrajectoryChartProps {
  data: MatchData
}

export function MatchTrajectoryChart({ data }: MatchTrajectoryChartProps) {
  const { homeTeam, awayTeam, quarterlyStats, matchStats } = data

  const processTeamData = (team: Team, isHome: boolean) => {
    const points = quarterlyStats.map(q => ({
      name: q.quarter,
      x: isHome ? q.home.attackPossession : q.away.attackPossession,
      y: isHome ? q.home.timePerCE : q.away.timePerCE,
      team: team.name
    }))

    // Add Total point
    points.push({
      name: "Total",
      x: isHome ? matchStats.home.attackPossession : matchStats.away.attackPossession,
      y: isHome ? matchStats.home.timePerCE : matchStats.away.timePerCE,
      team: team.name
    })

    return points.filter(p => p.x > 0 && p.y > 0)
  }

  const homePoints = useMemo(() => processTeamData(homeTeam, true), [homeTeam, quarterlyStats, matchStats])
  const awayPoints = useMemo(() => processTeamData(awayTeam, false), [awayTeam, quarterlyStats, matchStats])

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload
      return (
        <div className="bg-card p-2 border rounded shadow-sm text-xs">
          <p className="font-bold border-b mb-1">{p.team} - {p.name}</p>
          <p>공격 점유율: {p.x.toFixed(1)}%</p>
          <p>CE 소요시간: {p.y.toFixed(1)}s</p>
        </div>
      )
    }
    return null
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Match Trajectory Analysis (공격 효율 궤적)</CardTitle>
        <CardDescription className="text-xs">
          공격 점유율 vs 서클 진입 속도 (상단일수록 빠르고 위협적인 공격)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 40, bottom: 40, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              
              {/* Quadrant Backgrounds */}
              <ReferenceArea x1={0} x2={50} y1={0} y2={100} fill="#ff6384" fillOpacity={0.08} />
              <ReferenceArea x1={50} x2={100} y1={0} y2={100} fill="#4bc0c0" fillOpacity={0.08} />
              <ReferenceArea x1={50} x2={100} y1={100} y2={450} fill="#c8c8c8" fillOpacity={0.08} />

              <XAxis 
                type="number" 
                dataKey="x" 
                name="Possession" 
                unit="%" 
                domain={[0, 100]}
                label={{ value: 'Attack Possession (%)', position: 'bottom', offset: 20, fontSize: 12, fontWeight: 'bold' }}
              />
              <YAxis 
                type="number" 
                dataKey="y" 
                name="Time" 
                unit="s" 
                reversed 
                domain={[0, 450]}
                label={{ value: 'Time per Entry (s) [↑ Faster]', angle: -90, position: 'left', fontSize: 12, fontWeight: 'bold' }}
              />
              <ZAxis type="number" range={[100, 100]} />
              
              <Tooltip content={<CustomTooltip />} />

              <ReferenceLine x={50} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <ReferenceLine y={100} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />

              {/* Quadrant Labels */}
              <ReferenceLine x={25} stroke="none">
                <Label value="FAST & LOW POSS (Counter)" position="top" offset={-30} fill="#c0392b" fontSize={10} fontWeight="bold" />
              </ReferenceLine>
              <ReferenceLine x={75} stroke="none">
                <Label value="FAST & HIGH POSS (Dominance)" position="top" offset={-30} fill="#16a085" fontSize={10} fontWeight="bold" />
              </ReferenceLine>
              <ReferenceLine x={75} stroke="none">
                <Label value="SLOW & HIGH POSS (Sterile)" position="bottom" offset={-380} fill="#7f8c8d" fontSize={10} fontWeight="bold" />
              </ReferenceLine>

              {/* Home Team Trajectory */}
              <Scatter 
                name={homeTeam.name} 
                data={homePoints} 
                fill={homeTeam.color} 
                line={{ stroke: homeTeam.color, strokeWidth: 2 }}
                shape="circle"
              >
                <LabelList dataKey="name" position="top" offset={10} style={{ fill: homeTeam.color, fontSize: 10, fontWeight: 'bold' }} />
              </Scatter>

              {/* Away Team Trajectory */}
              <Scatter 
                name={awayTeam.name} 
                data={awayPoints} 
                fill={awayTeam.color} 
                line={{ stroke: awayTeam.color, strokeWidth: 2, strokeDasharray: '5 5' }}
                shape="square"
              >
                <LabelList dataKey="name" position="bottom" offset={10} style={{ fill: awayTeam.color, fontSize: 10, fontWeight: 'bold' }} />
              </Scatter>

            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
