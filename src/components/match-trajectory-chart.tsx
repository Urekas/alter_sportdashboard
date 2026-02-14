
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

export function MatchTrajectoryChart({ data }: MatchTrajectoryChartProps) {
  const { homeTeam, awayTeam, quarterlyStats, matchStats } = data

  const processTeamData = (team: Team, isHome: boolean) => {
    // 1. Trajectory (Q1-Q4)
    const trajectory = quarterlyStats.map(q => {
      const rawX = isHome ? q.home.attackPossession : q.away.attackPossession;
      const rawTime = isHome ? q.home.timePerCE : q.away.timePerCE;
      
      // Coordinate logic: 0s is top (450), failure is bottom (0)
      const visualY = rawTime === 0 ? 0 : Math.max(0, 450 - rawTime);

      return {
        name: q.quarter,
        x: rawX,
        y: visualY,
        rawTime: rawTime,
        z: 150,
        team: team.name,
        color: team.color
      };
    }).filter(p => p.x > 0);

    // 2. Total point (Isolated)
    const totalRawX = isHome ? matchStats.home.attackPossession : matchStats.away.attackPossession;
    const totalRawTime = isHome ? matchStats.home.timePerCE : matchStats.away.timePerCE;
    const totalVisualY = totalRawTime === 0 ? 0 : Math.max(0, 450 - totalRawTime);

    const total = [{
      name: "Total",
      x: totalRawX,
      y: totalVisualY,
      rawTime: totalRawTime,
      z: 1000, 
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
    <Card className="w-full border-2 shadow-xl">
      <CardHeader className="pb-2 bg-muted/20 border-b">
        <CardTitle className="text-2xl font-black text-primary italic">Match Trajectory Analysis (공격 전술 궤적)</CardTitle>
        <CardDescription className="text-sm font-bold text-muted-foreground mt-1">
          공격 점유율 vs 서클 진입 속도 (상단일수록 빠르고 효율적 / Y축 수치: 450 - CE소요시간)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[800px] w-full mt-8">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 60, right: 80, bottom: 80, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              
              {/* Quadrants Backgrounds (Based on Y=350 which is roughly 100s time) */}
              <ReferenceArea x1={0} x2={50} y1={350} y2={450} fill="#ff6384" fillOpacity={0.08} />
              <ReferenceArea x1={50} x2={100} y1={350} y2={450} fill="#4bc0c0" fillOpacity={0.08} />
              <ReferenceArea x1={50} x2={100} y1={0} y2={350} fill="#94a3b8" fillOpacity={0.08} />
              <ReferenceArea x1={0} x2={50} y1={0} y2={350} fill="#6366f1" fillOpacity={0.06} />

              <XAxis 
                type="number" 
                dataKey="x" 
                name="Possession" 
                unit="%" 
                domain={[0, 100]}
                tick={{ fontSize: 14, fontWeight: 'bold' }}
              >
                <Label value="Attack Possession (%) ➝" position="bottom" offset={40} className="fill-foreground text-base font-black uppercase tracking-widest" />
              </XAxis>
              
              <YAxis 
                type="number" 
                dataKey="y" 
                name="Efficiency" 
                domain={[0, 450]}
                tick={{ fontSize: 13, fontWeight: 'bold' }}
                label={{ value: 'Attack Speed (↑ Fast / ↓ Slow)', angle: -90, position: 'insideLeft', offset: -10, className: "fill-foreground text-base font-black uppercase tracking-widest" }}
              />
              
              <ZAxis type="number" dataKey="z" range={[200, 1200]} />
              
              <Tooltip content={<CustomTooltip />} />

              <ReferenceLine x={50} stroke="hsl(var(--foreground))" strokeDasharray="5 5" strokeWidth={2} opacity={0.4} />
              <ReferenceLine y={350} stroke="hsl(var(--foreground))" strokeDasharray="5 5" strokeWidth={2} opacity={0.4} />

              {/* Quadrant Labels */}
              <ReferenceLine x={25} stroke="none">
                <Label value="FAST & LOW POSS (Counter)" position="top" offset={-60} className="fill-rose-600 text-xs font-black uppercase tracking-tighter" />
              </ReferenceLine>
              <ReferenceLine x={75} stroke="none">
                <Label value="FAST & HIGH POSS (Dominance)" position="top" offset={-60} className="fill-teal-600 text-xs font-black uppercase tracking-tighter" />
              </ReferenceLine>
              <ReferenceLine x={75} stroke="none">
                <Label value="SLOW & HIGH POSS (Sterile)" position="insideBottom" offset={80} className="fill-slate-600 text-xs font-black uppercase tracking-tighter" />
              </ReferenceLine>
              <ReferenceLine x={25} stroke="none">
                <Label value="SLOW & LOW POSS (Inefficient)" position="insideBottom" offset={80} className="fill-indigo-700 text-xs font-black uppercase tracking-tighter" />
              </ReferenceLine>

              {/* Home Team Trajectory */}
              <Scatter 
                name={homeTeam.name} 
                data={homeData.trajectory} 
                fill={homeTeam.color} 
                line={{ stroke: homeTeam.color, strokeWidth: 5 }}
                shape="circle"
              >
                <LabelList dataKey="name" position="top" offset={20} style={{ fill: homeTeam.color, fontSize: 14, fontWeight: '900' }} />
              </Scatter>
              <Scatter 
                name={`${homeTeam.name} Total`} 
                data={homeData.total} 
                fill={homeTeam.color} 
                shape="circle"
              >
                <LabelList dataKey="name" position="top" offset={35} style={{ fill: homeTeam.color, fontSize: 20, fontWeight: '950' }} />
              </Scatter>

              {/* Away Team Trajectory */}
              <Scatter 
                name={awayTeam.name} 
                data={awayData.trajectory} 
                fill={awayTeam.color} 
                line={{ stroke: awayTeam.color, strokeWidth: 5, strokeDasharray: '10 6' }}
                shape="square"
              >
                <LabelList dataKey="name" position="bottom" offset={20} style={{ fill: awayTeam.color, fontSize: 14, fontWeight: '900' }} />
              </Scatter>
              <Scatter 
                name={`${awayTeam.name} Total`} 
                data={awayData.total} 
                fill={awayTeam.color} 
                shape="square"
              >
                <LabelList dataKey="name" position="bottom" offset={35} style={{ fill: awayTeam.color, fontSize: 20, fontWeight: '950' }} />
              </Scatter>

            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
