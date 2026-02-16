
"use client"

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { MatchEvent, Team } from "@/lib/types";
import { mapZone } from "@/lib/parser";

interface PressureAnalysisMapProps {
  events: MatchEvent[];
  homeTeam: Team;
  awayTeam: Team;
  isCompact?: boolean;
  awayHeader?: string;
  matchCount?: number;
}

type ZoneStat = {
  count: number;
  success: number;
  rate: number;
};

export function PressureAnalysisMap({ events, homeTeam, awayTeam, isCompact, awayHeader, matchCount = 1 }: PressureAnalysisMapProps) {
  const zoneStats = useMemo(() => {
    const calculateStats = (isHome: boolean) => {
      const zones: ZoneStat[] = Array(6).fill(null).map(() => ({ count: 0, success: 0, rate: 0 }));

      const myTeam = isHome ? homeTeam.name : awayTeam.name;
      const oppTeam = isHome ? awayTeam.name : homeTeam.name;

      // 0-2: 25y band (L, C, R), 3-5: 50y band (L, C, R)
      const mapping = [
        { oppZone: 100, oppLane: 'Right', myZone: 25, myLane: 'Left' },   // 0: 25L
        { oppZone: 100, oppLane: 'Center', myZone: 25, myLane: 'Center' }, // 1: 25C
        { oppZone: 100, oppLane: 'Left', myZone: 25, myLane: 'Right' },  // 2: 25R
        { oppZone: 75, oppLane: 'Right', myZone: 50, myLane: 'Left' },    // 3: 50L
        { oppZone: 75, oppLane: 'Center', myZone: 50, myLane: 'Center' },  // 4: 50C
        { oppZone: 75, oppLane: 'Left', myZone: 50, myLane: 'Right' }     // 5: 50R
      ];

      events.forEach(e => {
        const zoneInfo = mapZone(e.locationLabel || e.code);
        const isOppError = e.team === oppTeam && (e.type === 'turnover' || e.type === 'foul');
        const isMyFoul = e.team === myTeam && e.type === 'foul';

        mapping.forEach((m, idx) => {
          if (isOppError && zoneInfo.zoneBand === m.oppZone && zoneInfo.lane === m.oppLane) {
            zones[idx].count++;
            zones[idx].success++;
          }
          if (isMyFoul && zoneInfo.zoneBand === m.myZone && zoneInfo.lane === m.myLane) {
            zones[idx].count++;
          }
        });
      });

      const totalCount = zones.reduce((acc, z) => acc + z.count, 0);
      const totalSuccess = zones.reduce((acc, z) => acc + z.success, 0);

      return {
        zones: zones.map(z => ({
          ...z,
          rate: z.count > 0 ? (z.success / z.count) * 100 : 0
        })),
        totalCount,
        totalSuccess
      };
    };

    const homeData = calculateStats(true);
    const awayData = calculateStats(false);
    const globalMaxCount = Math.max(...homeData.zones.map(s => s.count), ...awayData.zones.map(s => s.count), 1);

    return { home: homeData, away: awayData, globalMaxCount };
  }, [events, homeTeam, awayTeam]);

  const renderHalfPitch = (teamData: { zones: ZoneStat[], totalCount: number, totalSuccess: number }, team: Team, isHome: boolean, globalMaxCount: number) => {
    const labels = ["25L", "25C", "25R", "50L", "50C", "50R"];
    const avgCount = (teamData.totalCount / matchCount).toFixed(1);
    const avgSuccess = (teamData.totalSuccess / matchCount).toFixed(1);
    const totalRate = teamData.totalCount > 0 ? (teamData.totalSuccess / teamData.totalCount * 100).toFixed(1) : "0.0";
    
    const headerTitle = isHome ? `${team.name} 상대 진영 압박` : (awayHeader || `${team.name} 상대 진영 압박`);

    return (
      <div className="flex flex-col gap-1">
        <div className="flex flex-col items-center justify-center p-2 rounded-t-lg border-b-2" style={{ backgroundColor: `${team.color}15`, borderColor: team.color }}>
          <h3 className="text-sm font-black uppercase tracking-tighter" style={{ color: team.color }}>
            {headerTitle}
          </h3>
          <p className="text-[10px] font-bold mt-1 uppercase tracking-tight">
            경기당 평균 {isHome ? '압박' : '피압박'}: <span className="text-primary">{avgCount}</span>회 | 성공: <span className="text-emerald-600">{avgSuccess}</span>회 ({totalRate}%)
          </p>
        </div>
        <div className="relative aspect-[45.7/55] bg-green-50/50 rounded-b-lg overflow-hidden border border-muted shadow-inner">
          <svg viewBox="0 0 45.7 55" className="w-full h-full overflow-visible">
            {/* 필드 배경 및 라인 */}
            <g stroke="#000" strokeWidth="0.3" fill="none" opacity="0.4">
              <rect x="0" y="0" width="45.7" height="55" />
              {isHome ? (
                // 홈 팀 시점: 골대가 오른쪽 (x=45.7)
                <>
                  <path d={`M 45.7,${27.5 - 14.63} A 14.63,14.63 0 0,0 31.07,27.5 A 14.63,14.63 0 0,0 45.7,${27.5 + 14.63}`} />
                  <path d={`M 45.7,${27.5 - 19.63} A 19.63,19.63 0 0,0 26.07,27.5 A 19.63,19.63 0 0,0 45.7,${27.5 + 19.63}`} strokeDasharray="1,1" />
                  <circle cx={45.7 - 6.47} cy={27.5} r="0.5" fill="black" stroke="none" />
                  <line x1="45.7" y1={27.5 - 1.83} x2="46.9" y2={27.5 - 1.83} />
                  <line x1="45.7" y1={27.5 + 1.83} x2="46.9" y2={27.5 + 1.83} />
                  <line x1="46.9" y1={27.5 - 1.83} x2="46.9" y2={27.5 + 1.83} />
                </>
              ) : (
                // 어웨이 팀 시점: 골대가 왼쪽 (x=0)
                <>
                  <path d={`M 0,${27.5 - 14.63} A 14.63,14.63 0 0,1 14.63,27.5 A 14.63,14.63 0 0,1 0,${27.5 + 14.63}`} />
                  <path d={`M 0,${27.5 - 19.63} A 19.63,19.63 0 0,1 19.63,27.5 A 19.63,19.63 0 0,1 0,${27.5 + 19.63}`} strokeDasharray="1,1" />
                  <circle cx={6.47} cy={27.5} r="0.5" fill="black" stroke="none" />
                  <line x1="0" y1={27.5 - 1.83} x2="-1.2" y2={27.5 - 1.83} />
                  <line x1="0" y1={27.5 + 1.83} x2="-1.2" y2={27.5 + 1.83} />
                  <line x1="-1.2" y1={27.5 - 1.83} x2="-1.2" y2={27.5 + 1.83} />
                </>
              )}
              {/* 공통 구분선 */}
              <line x1="0" y1="18.33" x2="45.7" y2="18.33" strokeDasharray="1,1" />
              <line x1="0" y1="36.66" x2="45.7" y2="36.66" strokeDasharray="1,1" />
              <line x1="22.85" y1="0" x2="22.85" y2="55" strokeDasharray="1,1" />
            </g>

            {/* 구역 히트맵 및 데이터 */}
            {teamData.zones.map((stat, i) => {
              const xIdx = Math.floor(i / 3); // 0: 25y band, 1: 50y band
              let yIdx = i % 3; // 0: L, 1: C, 2: R

              // 가로 위치 결정 (반전 반영)
              // isHome이면 25y(xIdx=0)는 오른쪽(22.85~45.7), 50y(xIdx=1)는 왼쪽(0~22.85)
              let rectX = 0;
              if (isHome) {
                rectX = xIdx === 0 ? 22.85 : 0;
              } else {
                rectX = xIdx === 0 ? 0 : 22.85;
              }

              // 세로 위치 결정 (어웨이팀 시점 lane 반전)
              let actualYIdx = yIdx;
              if (!isHome) {
                if (yIdx === 0) actualYIdx = 2; // Left -> 하단
                else if (yIdx === 2) actualYIdx = 0; // Right -> 상단
              }
              const rectY = actualYIdx * 18.33;

              const intensity = stat.count > 0 ? (stat.count / globalMaxCount) * 0.45 + 0.1 : 0;

              return (
                <g key={i}>
                  <rect 
                    x={rectX} 
                    y={rectY} 
                    width="22.85" 
                    height="18.33" 
                    fill={team.color} 
                    fillOpacity={intensity} 
                  />
                  <text 
                    x={rectX + 11.42} 
                    y={rectY + 9.16} 
                    textAnchor="middle" 
                    dominantBaseline="middle" 
                    className="fill-foreground font-bold"
                    style={{ fontSize: '3px' }}
                  >
                    <tspan x={rectX + 11.42} dy="-4" fontSize="2px" fontWeight="black" fillOpacity="0.6">{labels[i]}</tspan>
                    <tspan x={rectX + 11.42} dy="4" fontWeight="black" fontSize="4px">{(stat.count / matchCount).toFixed(1)}</tspan>
                    <tspan x={rectX + 11.42} dy="4" fontWeight="black" fontSize="3px" fill="#059669">{(stat.success / matchCount).toFixed(1)}</tspan>
                    <tspan x={rectX + 11.42} dy="3" fontSize="2.2px" fontWeight="normal" opacity="0.8">({stat.rate.toFixed(0)}%)</tspan>
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

  return (
    <Card className="lg:col-span-3">
      <CardHeader className={isCompact ? "py-2 px-4" : ""}>
        <CardTitle className={isCompact ? "text-lg" : ""}>Tournament Pressure Analysis Map</CardTitle>
        <CardDescription className={isCompact ? "text-[10px]" : ""}>
          {matchCount > 1 ? `대회 ${matchCount}경기 평균 수치.` : '경기별 분석 수치.'} {awayHeader ? '공격적 압박 시도와 수비적 탈압박 성공률 분석.' : '구역별 압박 시도, 성공 횟수 및 성공률.'}
        </CardDescription>
      </CardHeader>
      <CardContent className={isCompact ? "p-2 md:p-4" : "p-4 md:p-6"}>
        <div className="grid grid-cols-2 gap-4">
          {renderHalfPitch(zoneStats.home, homeTeam, true, zoneStats.globalMaxCount)}
          {renderHalfPitch(zoneStats.away, awayTeam, false, zoneStats.globalMaxCount)}
        </div>
      </CardContent>
    </Card>
  );
}
