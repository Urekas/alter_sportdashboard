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
  CartesianGrid
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { MatchData, Team } from "@/lib/types"

interface MatchTrajectoryChartProps {
  data: MatchData
}

/**
 * MatchTrajectoryChart
 * - X: Attack Possession (%)
 * - Y: 450 - Time per CE (s) -> Higher is Faster, 0 is No Entry
 */
export function MatchTrajectoryChart({ data }: MatchTrajectoryChartProps) {
  const { homeTeam, awayTeam, quarterlyStats, matchStats } = data

  const processTeamData = (team: Team, isHome: boolean) => {
    const transformY = (val: number) => {
      if (val === 0) return 0; // No entry = Bottom
      return Math.max(0, 450 - val); // Faster (smaller time) = Higher Y
    };

    // 1. Trajectory (Q1-Q4)
    const trajectory = quarterlyStats.map(q => {
      const rawX = isHome ? q.home.attackPossession : q.away.attackPossession;
      const rawTime = isHome ? q.home.timePerCE : q.away.timePerCE;
      return {
        name: q.quarter,
        x: rawX,
        y: transformY(rawTime),
        rawTime: rawTime,
        z: 100,
        team: team.name,
        color: team.color
      };
    }).filter(p => p.x > 0);

    // 2. Total point
    const totalRawX = isHome ? matchStats.home.attackPossession : matchStats.away.attackPossession;
    const totalRawTime = isHome ? matchStats.home.timePerCE : matchStats.away.timePerCE;
    const total = [{
      name: "Total",
      x: totalRawX,
      y: transformY(totalRawTime),
      rawTime: totalRawTime,
      z: 400, // Explicitly larger
      team: team.name,
      color: team.color
    }].filter(p => p.x > 0);

    return { trajectory, total };
  }

  const homeData = useMemo(() => processTeamData(homeTeam, true), [homeTeam, quarterlyStats, matchStats])
  const awayData = useMemo(() => processTeamData(awayTeam, false), [awayTeam, quarterlyStats, matchStats])

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload
      return (
        <div className="bg-card p-3 border rounded-lg shadow-lg text-sm">
          <p className="font-bold border-b pb-1 mb-2" style={{ color: p.color }}>{p.team} - {p.name}</p>
          <div className="space-y-1">
            <p>공격 점유율: <span className="font-bold">{p.x.toFixed(1)}%</span></p>
            <p>CE 소요시간: <span className="font-bold">{p.rawTime > 0 ? p.rawTime.toFixed(1) + 's' : '진입 없음'}</span></p>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <Card className="w-full border-2 shadow-md">
      <CardHeader className="pb-2 bg-muted/20">
        <CardTitle className="text-xl font-bold text-primary">Match Trajectory Analysis (공격 전술 궤적)</CardTitle>
        <CardDescription className="text-sm font-medium">
          공격 점유율 vs 서클 진입 속도 (상단일수록 빠르고 위협적인 공격 / 0은 진입 실패를 의미함)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[520px] w-full mt-6">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 30, right: 50, bottom: 50, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              
              {/* Quadrant Backgrounds (Y axis threshold 350 = 100s) */}
              <ReferenceArea x1={0} x2={50} y1={350} y2={450} fill="#ff6384" fillOpacity={0.06} />
              <ReferenceArea x1={50} x2={100} y1={350} y2={450} fill="#4bc0c0" fillOpacity={0.06} />
              <ReferenceArea x1={50} x2={100} y1={0} y2={350} fill="#c8c8c8" fillOpacity={0.06} />
              <ReferenceArea x1={0} x2={50} y1={0} y2={350} fill="#6366f1" fillOpacity={0.04} />

              <XAxis 
                type="number" 
                dataKey="x" 
                name="Possession" 
                unit="%" 
                domain={[0, 100]}
                tick={{ fontSize: 11, fontWeight: 'bold' }}
              >
                <Label value="Attack Possession (%) ➝" position="bottom" offset={20} className="fill-muted-foreground text-xs font-bold" />
              </XAxis>
              
              <YAxis 
                type="number" 
                dataKey="y" 
                name="Speed" 
                domain={[0, 450]}
                tick={false} // Hide raw Y values since they are transformed
              >
                <Label value="Attack Speed [↑ Faster / ↓ Slower]" angle={-90} position="left" offset={0} className="fill-muted-foreground text-xs font-bold" />
              </YAxis>
              
              <ZAxis type="number" dataKey="z" range={[80, 500]} />
              
              <Tooltip content={<CustomTooltip />} />

              <ReferenceLine x={50} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" strokeWidth={1.5} opacity={0.5} />
              <ReferenceLine y={350} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" strokeWidth={1.5} opacity={0.5} />

              {/* Quadrant Labels */}
              <ReferenceLine x={25} stroke="none">
                <Label value="FAST & LOW POSS (Counter)" position="top" offset={-40} className="fill-rose-600 text-[10px] font-black uppercase tracking-tighter" />
              </ReferenceLine>
              <ReferenceLine x={75} stroke="none">
                <Label value="FAST & HIGH POSS (Dominance)" position="top" offset={-40} className="fill-teal-600 text-[10px] font-black uppercase tracking-tighter" />
              </ReferenceLine>
              <ReferenceLine x={75} stroke="none">
                <Label value="SLOW & HIGH POSS (Sterile)" position="insideBottom" offset={40} className="fill-gray-500 text-[10px] font-black uppercase tracking-tighter" />
              </ReferenceLine>
              <ReferenceLine x={25} stroke="none">
                <Label value="SLOW & LOW POSS (Inefficient)" position="insideBottom" offset={40} className="fill-indigo-600 text-[10px] font-black uppercase tracking-tighter" />
              </ReferenceLine>

              {/* Home Team Trajectory */}
              <Scatter 
                name={homeTeam.name} 
                data={homeData.trajectory} 
                fill={homeTeam.color} 
                line={{ stroke: homeTeam.color, strokeWidth: 3 }}
                shape="circle"
              >
                <LabelList dataKey="name" position="top" offset={12} style={{ fill: homeTeam.color, fontSize: 11, fontWeight: '900' }} />
              </Scatter>
              <Scatter 
                name={`${homeTeam.name} Total`} 
                data={homeData.total} 
                fill={homeTeam.color} 
                shape="circle"
              >
                <LabelList dataKey="name" position="top" offset={22} style={{ fill: homeTeam.color, fontSize: 15, fontWeight: '900' }} />
              </Scatter>

              {/* Away Team Trajectory */}
              <Scatter 
                name={awayTeam.name} 
                data={awayData.trajectory} 
                fill={awayTeam.color} 
                line={{ stroke: awayTeam.color, strokeWidth: 3, strokeDasharray: '6 4' }}
                shape="square"
              >
                <LabelList dataKey="name" position="bottom" offset={12} style={{ fill: awayTeam.color, fontSize: 11, fontWeight: '900' }} />
              </Scatter>
              <Scatter 
                name={`${awayTeam.name} Total`} 
                data={awayData.total} 
                fill={awayTeam.color} 
                shape="square"
              >
                <LabelList dataKey="name" position="bottom" offset={22} style={{ fill: awayTeam.color, fontSize: 15, fontWeight: '900' }} />
              </Scatter>

            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
