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
  isTournamentView?: boolean
  allMatchesPoints?: any[] // 대회 모드일 때 개별 경기 점수들
}

export function MatchTrajectoryChart({ data, isTournamentView, allMatchesPoints }: MatchTrajectoryChartProps) {
  const { homeTeam, awayTeam, quarterlyStats, matchStats } = data

  const processTeamData = (team: Team, isHome: boolean) => {
    // 1. 궤적 점들 (단일 경기면 쿼터별, 대회 모드면 경기별)
    let trajectory = [];
    
    if (isTournamentView) {
      // 대회 모드: 홈 팀(선택된 팀)에 대해서만 경기별 궤적 생성
      if (isHome && allMatchesPoints) {
        trajectory = allMatchesPoints.map((p, idx) => ({
          name: `M${String(idx + 1).padStart(2, '0')}`,
          x: p.homeX,
          y: p.homeY,
          rawTime: p.homeRawTime,
          z: 150,
          team: team.name,
          color: team.color
        })).filter(p => p.x > 0);
      } else {
        // 어웨이 팀(대회 평균 등)은 궤적을 그리지 않음 (단일 점만 표시)
        trajectory = [];
      }
    } else {
      // 단일 경기 모드: 쿼터별 데이터 사용
      trajectory = quarterlyStats.map(q => {
        const rawX = isHome ? q.home.attackPossession : q.away.attackPossession;
        const rawTime = isHome ? q.home.timePerCE : q.away.timePerCE;
        const visualY = rawTime === 0 ? 450 : Math.min(450, rawTime);

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
    }

    // 2. 전체 평균 점
    const totalRawX = isHome ? matchStats.home.attackPossession : matchStats.away.attackPossession;
    const totalRawTime = isHome ? matchStats.home.timePerCE : matchStats.away.timePerCE;
    const totalVisualY = totalRawTime === 0 ? 450 : Math.min(450, totalRawTime);

    const total = [{
      name: team.name === "대회 전체 평균" ? "GLOBAL AVG" : team.name, 
      x: totalRawX,
      y: totalVisualY,
      rawTime: totalRawTime,
      z: 1200, 
      team: team.name,
      color: team.color
    }].filter(p => p.x > 0);

    return { trajectory, total };
  }

  const homeData = useMemo(() => processTeamData(homeTeam, true), [homeTeam, quarterlyStats, matchStats, isTournamentView, allMatchesPoints])
  const awayData = useMemo(() => processTeamData(awayTeam, false), [awayTeam, quarterlyStats, matchStats, isTournamentView, allMatchesPoints])

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
          {isTournamentView ? '경기별 궤적 흐름 및 대회 전체 평균 비교' : '쿼터별 궤적 흐름'} (상단 0s일수록 효율적 / 하단 450s일수록 비효율적)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[700px] w-full mt-8">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 60, right: 80, bottom: 80, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              
              <ReferenceArea x1={50} x2={100} y1={0} y2={100} fill="#4bc0c0" fillOpacity={0.15}>
                <Label value="Efficient Dominance" position="insideTopRight" offset={20} className="fill-emerald-700 font-black text-xs uppercase tracking-tighter" />
              </ReferenceArea>
              
              <ReferenceArea x1={0} x2={50} y1={0} y2={100} fill="#4bc0c0" fillOpacity={0.08}>
                <Label value="Direct & Fast" position="insideTopLeft" offset={20} className="fill-teal-700 font-black text-xs uppercase tracking-tighter" />
              </ReferenceArea>
              
              <ReferenceArea x1={50} x2={100} y1={100} y2={450} fill="#94a3b8" fillOpacity={0.08}>
                <Label value="Slow Buildup" position="insideBottomRight" offset={20} className="fill-slate-600 font-black text-xs uppercase tracking-tighter" />
              </ReferenceArea>
              
              <ReferenceArea x1={0} x2={50} y1={100} y2={450} fill="#6366f1" fillOpacity={0.06}>
                <Label value="Inefficient" position="insideBottomLeft" offset={20} className="fill-indigo-700 font-black text-xs uppercase tracking-tighter" />
              </ReferenceArea>

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
                name="CE Time" 
                unit="s"
                domain={[0, 450]}
                reversed
                tick={{ fontSize: 13, fontWeight: 'bold' }}
                label={{ value: 'CE Time (s) (↑ Fast / ↓ Slow)', angle: -90, position: 'insideLeft', offset: -10, className: "fill-foreground text-base font-black uppercase tracking-widest" }}
              />
              
              <ZAxis type="number" dataKey="z" range={[300, 1500]} />
              
              <Tooltip content={<CustomTooltip />} />

              <ReferenceLine x={50} stroke="hsl(var(--foreground))" strokeDasharray="5 5" strokeWidth={2} opacity={0.4} />
              <ReferenceLine y={100} stroke="hsl(var(--foreground))" strokeDasharray="5 5" strokeWidth={2} opacity={0.4} />

              {/* 홈 팀 궤적: 대회 모드에서는 점선 없이 점만 표시 */}
              <Scatter 
                name={homeTeam.name} 
                data={homeData.trajectory} 
                fill={homeTeam.color} 
                line={isTournamentView ? false : { stroke: homeTeam.color, strokeWidth: 5, strokeDasharray: '10 6' }} 
                shape="circle"
              >
                <LabelList dataKey="name" position="top" offset={20} style={{ fill: homeTeam.color, fontSize: 16, fontWeight: '900' }} />
              </Scatter>

              {/* 어웨이 팀 궤적: 단일 경기 모드에서만 표시 (대회 모드에서는 전체 평균 점만) */}
              {!isTournamentView && (
                <Scatter 
                  name={awayTeam.name} 
                  data={awayData.trajectory} 
                  fill={awayTeam.color} 
                  line={{ stroke: awayTeam.color, strokeWidth: 5, strokeDasharray: '10 6' }} 
                  shape="square"
                >
                  <LabelList dataKey="name" position="bottom" offset={20} style={{ fill: awayTeam.color, fontSize: 16, fontWeight: '900' }} />
                </Scatter>
              )}

              {/* 홈 팀 전체 평균 (큰 원) */}
              <Scatter name={`${homeTeam.name} Avg`} data={homeData.total} fill={homeTeam.color} fillOpacity={0.2} stroke={homeTeam.color} strokeWidth={2} shape="circle">
                <LabelList dataKey="name" position="top" offset={45} style={{ fill: homeTeam.color, fontSize: 24, fontWeight: '950', opacity: 0.3 }} />
              </Scatter>

              {/* 대회 전체 평균 (큰 사각형) */}
              <Scatter name={`${awayTeam.name} Avg`} data={awayData.total} fill={awayTeam.color} fillOpacity={0.2} stroke={awayTeam.color} strokeWidth={2} shape="square">
                <LabelList dataKey="name" position="bottom" offset={45} style={{ fill: awayTeam.color, fontSize: 24, fontWeight: '950', opacity: 0.3 }} />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
