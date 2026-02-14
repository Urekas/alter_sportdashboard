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
    const trajectory = quarterlyStats.map(q => ({
      name: q.quarter,
      x: isHome ? q.home.attackPossession : q.away.attackPossession,
      y: isHome ? q.home.timePerCE : q.away.timePerCE,
      z: 100, // Regular size for quarters
      team: team.name,
      color: team.color,
      isTotal: false
    })).filter(p => p.x > 0 && p.y > 0);

    // 2. Total point (Standalone & Bigger)
    const total = {
      name: "Total",
      x: isHome ? matchStats.home.attackPossession : matchStats.away.attackPossession,
      y: isHome ? matchStats.home.timePerCE : matchStats.away.timePerCE,
      z: 300, // Larger size for Total
      team: team.name,
      color: team.color,
      isTotal: true
    };

    return { trajectory, total: [total].filter(p => p.x > 0 && p.y > 0) };
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
            <p>CE 소요시간: <span className="font-bold">{p.y.toFixed(1)}s</span></p>
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
          공격 점유율 vs 서클 진입 속도 (상단일수록 빠르고 위협적인 공격 / Total은 쿼터별 흐름과 분리하여 별도로 강조됨)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[520px] w-full mt-6">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 30, right: 50, bottom: 50, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              
              <ReferenceArea x1={0} x2={50} y1={0} y2={100} fill="#ff6384" fillOpacity={0.06} />
              <ReferenceArea x1={50} x2={100} y1={0} y2={100} fill="#4bc0c0" fillOpacity={0.06} />
              <ReferenceArea x1={50} x2={100} y1={100} y2={450} fill="#c8c8c8" fillOpacity={0.06} />

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
                name="Time" 
                unit="s" 
                reversed 
                domain={[0, 450]}
                tick={{ fontSize: 11, fontWeight: 'bold' }}
              >
                <Label value="Time per Entry (s) [↑ Faster]" angle={-90} position="left" offset={0} className="fill-muted-foreground text-xs font-bold" />
              </YAxis>
              
              <ZAxis type="number" dataKey="z" range={[80, 450]} />
              
              <Tooltip content={<CustomTooltip />} />

              <ReferenceLine x={50} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" strokeWidth={1.5} opacity={0.5} />
              <ReferenceLine y={100} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" strokeWidth={1.5} opacity={0.5} />

              <ReferenceLine x={25} stroke="none">
                <Label value="FAST & LOW POSS (Counter)" position="top" offset={-40} className="fill-rose-600 text-[10px] font-black uppercase tracking-tighter" />
              </ReferenceLine>
              <ReferenceLine x={75} stroke="none">
                <Label value="FAST & HIGH POSS (Dominance)" position="top" offset={-40} className="fill-teal-600 text-[10px] font-black uppercase tracking-tighter" />
              </ReferenceLine>
              <ReferenceLine x={75} stroke="none">
                {/* 레이블 위치를 아래 구역(Sterile)으로 명확히 이동 */}
                <Label value="SLOW & HIGH POSS (Sterile)" position="insideBottom" offset={40} className="fill-gray-500 text-[10px] font-black uppercase tracking-tighter" />
              </ReferenceLine>

              {/* 홈팀 궤적 (Q1-Q4) */}
              <Scatter 
                name={homeTeam.name} 
                data={homeData.trajectory} 
                fill={homeTeam.color} 
                line={{ stroke: homeTeam.color, strokeWidth: 3 }}
                shape="circle"
              >
                <LabelList dataKey="name" position="top" offset={12} style={{ fill: homeTeam.color, fontSize: 11, fontWeight: '900' }} />
              </Scatter>
              {/* 홈팀 Total (Standalone & Bigger, No Line) */}
              <Scatter 
                name={`${homeTeam.name} Total`} 
                data={homeData.total} 
                fill={homeTeam.color} 
                shape="circle"
              >
                <LabelList dataKey="name" position="top" offset={18} style={{ fill: homeTeam.color, fontSize: 14, fontWeight: '900' }} />
              </Scatter>

              {/* 어웨이팀 궤적 (Q1-Q4) */}
              <Scatter 
                name={awayTeam.name} 
                data={awayData.trajectory} 
                fill={awayTeam.color} 
                line={{ stroke: awayTeam.color, strokeWidth: 3, strokeDasharray: '6 4' }}
                shape="square"
              >
                <LabelList dataKey="name" position="bottom" offset={12} style={{ fill: awayTeam.color, fontSize: 11, fontWeight: '900' }} />
              </Scatter>
              {/* 어웨이팀 Total (Standalone & Bigger, No Line) */}
              <Scatter 
                name={`${awayTeam.name} Total`} 
                data={awayData.total} 
                fill={awayTeam.color} 
                shape="square"
              >
                <LabelList dataKey="name" position="bottom" offset={18} style={{ fill: awayTeam.color, fontSize: 14, fontWeight: '900' }} />
              </Scatter>

            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}