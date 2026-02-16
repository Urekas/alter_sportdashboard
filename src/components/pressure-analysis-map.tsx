
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

/**
 * 압박 및 피압박 분석 지도 컴포넌트
 * 
 * [로직 정의 - 형님 에디션]
 * - 압박 시도(Count): 해당 진영에서의 모든 경합 (에러 상황 + 압박하는 팀의 파울)
 * - 압박 성공(Success): 압박 시도 - 압박하는 팀의 파울 (즉, 순수하게 상대의 실책을 유도한 상황)
 * 
 * [좌측: 우리 팀의 상대 진영 압박]
 * - 시도: 상대 진영(75, 100)에서의 (상대 에러 + 우리의 파울)
 * - 성공: 상대 에러 (우리가 압박을 잘해서 상대가 실수함)
 * 
 * [우측: 우리 팀의 피압박 상황]
 * - 시도: 우리 진영(25, 50)에서의 (우리 에러 + 상대의 파울)
 * - 상대 성공: 우리 에러 (상대가 압박을 잘해서 우리가 실수함)
 */
export function PressureAnalysisMap({ events, homeTeam, awayTeam, isCompact, awayHeader, matchCount = 1 }: PressureAnalysisMapProps) {
  const isTournament = matchCount > 1;

  const zoneStats = useMemo(() => {
    const calculateStats = (isHome: boolean) => {
      const zones: ZoneStat[] = Array(6).fill(null).map(() => ({ count: 0, success: 0, rate: 0 }));

      const myTeam = isHome ? homeTeam.name : awayTeam.name;
      const oppTeam = isHome ? awayTeam.name : homeTeam.name;

      const mapping = [
        { oppZone: 100, oppLane: 'Right', myZone: 25, myLane: 'Left' },   
        { oppZone: 100, oppLane: 'Center', myZone: 25, myLane: 'Center' }, 
        { oppZone: 100, oppLane: 'Left', myZone: 25, myLane: 'Right' },  
        { oppZone: 75, oppLane: 'Right', myZone: 50, myLane: 'Left' },    
        { oppZone: 75, oppLane: 'Center', myZone: 50, myLane: 'Center' },  
        { oppZone: 75, oppLane: 'Left', myZone: 50, myLane: 'Right' }     
      ];

      events.forEach(e => {
        const zoneInfo = mapZone(e.locationLabel || e.code);
        
        const isOppError = e.team === oppTeam && (e.type === 'turnover' || e.type === 'foul');
        const isMyError = e.team === myTeam && (e.type === 'turnover' || e.type === 'foul');
        const isMyFoul = e.team === myTeam && e.type === 'foul';
        const isOppFoul = e.team === oppTeam && e.type === 'foul';

        mapping.forEach((m, idx) => {
          if (isHome) {
            // [우리의 상대 진영 압박]
            if (zoneInfo.zoneBand === m.oppZone && zoneInfo.lane === m.oppLane) {
              if (isOppError || isMyFoul) {
                zones[idx].count++; // 전체 시도 (상대 실수 + 우리의 파울)
              }
              if (isOppError) {
                zones[idx].success++; // 우리의 압박 성공 (상대 실수)
              }
            }
          } else {
            // [우리의 피압박 분석 (상대 압박)]
            if (zoneInfo.zoneBand === m.myZone && zoneInfo.lane === m.myLane) {
              if (isMyError || isOppFoul) {
                zones[idx].count++; // 상대의 전체 시도 (우리 실수 + 상대의 파울)
              }
              if (isMyError) {
                zones[idx].success++; // 상대의 압박 성공 (우리 실수)
              }
            }
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
    const isDePressing = !isHome && !!awayHeader;
    
    const formatNum = (val: number) => {
      return isTournament 
        ? (val / matchCount).toFixed(1) 
        : Math.round(val / matchCount).toString();
    };
    
    const avgCountFormatted = formatNum(teamData.totalCount);
    const avgSuccessFormatted = formatNum(teamData.totalSuccess);
    const totalRate = teamData.totalCount > 0 ? (teamData.totalSuccess / teamData.totalCount * 100).toFixed(1) : "0.0";
    
    const headerTitle = isHome ? `${team.name} 상대 진영 압박` : (awayHeader || `${team.name} 피압박 (상대 압박 성공)`);

    // 단일 경기 분석 (matchCount === 1) -> 지금 그대로 (홈 우측, 어웨이 좌측)
    // 대회 누적 분석 (matchCount > 1) -> 요청대로 반전 (홈 좌측, 어웨이 우측)
    let goalOnRight = false;
    if (isTournament) {
      goalOnRight = !isHome; 
    } else {
      goalOnRight = isHome;  
    }

    return (
      <div className="flex flex-col gap-1">
        <div className="flex flex-col items-center justify-center p-2 rounded-t-lg border-b-2" style={{ backgroundColor: `${team.color}15`, borderColor: team.color }}>
          <h3 className="text-sm font-black uppercase tracking-tighter" style={{ color: team.color }}>
            {headerTitle}
          </h3>
          <p className="text-[10px] font-bold mt-1 uppercase tracking-tight">
            {isTournament ? '경기당 평균' : '합계'} 시도: <span className="text-primary">{avgCountFormatted}</span>회 | {isDePressing ? '상대 성공' : '성공'}: <span className="text-emerald-600">{avgSuccessFormatted}</span>회 ({totalRate}%)
          </p>
        </div>
        <div className="relative aspect-[45.7/55] bg-green-50/50 rounded-b-lg overflow-hidden border border-muted shadow-inner">
          <svg viewBox="0 0 45.7 55" className="w-full h-full overflow-visible">
            <g stroke="#000" strokeWidth="0.3" fill="none" opacity="0.4">
              <rect x="0" y="0" width="45.7" height="55" />
              {goalOnRight ? (
                <>
                  <path d={`M 45.7,${27.5 - 14.63} A 14.63,14.63 0 0,0 31.07,27.5 A 14.63,14.63 0 0,0 45.7,${27.5 + 14.63}`} />
                  <path d={`M 45.7,${27.5 - 19.63} A 19.63,19.63 0 0,0 26.07,27.5 A 19.63,19.63 0 0,0 45.7,${27.5 + 19.63}`} strokeDasharray="1,1" />
                  <circle cx={45.7 - 6.47} cy={27.5} r="0.5" fill="black" stroke="none" />
                  <rect x="45.7" y={27.5 - 1.83} width="1.2" height="3.66" />
                </>
              ) : (
                <>
                  <path d={`M 0,${27.5 - 14.63} A 14.63,14.63 0 0,1 14.63,27.5 A 14.63,14.63 0 0,1 0,${27.5 + 14.63}`} />
                  <path d={`M 0,${27.5 - 19.63} A 19.63,19.63 0 0,1 19.63,27.5 A 19.63,19.63 0 0,1 0,${27.5 + 19.63}`} strokeDasharray="1,1" />
                  <circle cx={6.47} cy={27.5} r="0.5" fill="black" stroke="none" />
                  <rect x="-1.2" y={27.5 - 1.83} width="1.2" height="3.66" />
                </>
              )}
              <line x1="0" y1="18.33" x2="45.7" y2="18.33" strokeDasharray="1,1" />
              <line x1="0" y1="36.66" x2="45.7" y2="36.66" strokeDasharray="1,1" />
              <line x1="22.85" y1="0" x2="22.85" y2="55" strokeDasharray="1,1" />
            </g>

            {teamData.zones.map((stat, i) => {
              const xIdx = Math.floor(i / 3); 
              const yIdx = i % 3; 

              let rectX = 0;
              if (goalOnRight) {
                rectX = xIdx === 0 ? 22.85 : 0;
              } else {
                rectX = xIdx === 0 ? 0 : 22.85;
              }

              const rectY = yIdx * 18.33;
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
                  >
                    <tspan x={rectX + 11.42} dy="-4" fontSize="2.5px" fontWeight="black" fillOpacity="0.6">{labels[i]}</tspan>
                    <tspan x={rectX + 11.42} dy="4.5" fontWeight="black" fontSize="4px">{formatNum(stat.count)}</tspan>
                    <tspan x={rectX + 11.42} dy="4" fontWeight="black" fontSize="3.2px" fill="#059669">{isDePressing ? '상대성공' : '성공'}: {formatNum(stat.success)}</tspan>
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
        <CardTitle className={isCompact ? "text-lg" : ""}>Pressure Analysis</CardTitle>
        <CardDescription className={isCompact ? "text-[10px]" : ""}>
          {isTournament ? `대회 ${matchCount}경기 평균 수치.` : '경기 데이터 실제 수치.'} 압박 시도 대비 순수 성공(상대 실책 유도) 비율 분석.
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
