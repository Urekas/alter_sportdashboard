
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
 * 압박 분석 지도 컴포넌트
 * 
 * [로직 정의 - 형님 에디션]
 * - 압박 시도(Count): 해당 진영에서의 모든 경합 (상대 에러 + 압박하는 팀의 파울)
 * - 압박 성공(Success): 압박 시도 - 압박하는 팀의 파울 (즉, 순수하게 상대의 실책을 유도한 상황)
 * - 대회 모드 상대팀: 선택된 팀과 맞붙은 모든 실제 상대팀들의 평균.
 */
export function PressureAnalysisMap({ events, homeTeam, awayTeam, isCompact, awayHeader, matchCount = 1 }: PressureAnalysisMapProps) {
  const isTournament = matchCount > 1;

  const zoneStats = useMemo(() => {
    const calculateStats = (isHome: boolean) => {
      const zones: ZoneStat[] = Array(6).fill(null).map(() => ({ count: 0, success: 0, rate: 0 }));

      const myTeamName = homeTeam.name;
      // 대회 모드에서 awayTeam.name이 '상대팀'인 경우, selectedTeam이 아닌 모든 팀을 상대로 간주
      const isOpponentMode = !isHome && awayTeam.name === '상대팀';

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
        
        // 팀 판별 로직 (대회 모드 대응)
        const isMyTeamEvent = e.team === myTeamName;
        const isOppTeamEvent = isOpponentMode ? (e.team !== myTeamName) : (e.team === awayTeam.name);

        const isFoul = e.type === 'foul' || e.code.toUpperCase().includes('파울');
        const isTurnover = e.type === 'turnover' || e.code.toUpperCase().includes('턴오버') || e.code.toUpperCase().includes('TO');

        mapping.forEach((m, idx) => {
          if (isHome) {
            // [우리의 상대 진영 압박]
            if (zoneInfo.zoneBand === m.oppZone && zoneInfo.lane === m.oppLane) {
              if ((isOppTeamEvent && (isTurnover || isFoul)) || (isMyTeamEvent && isFoul)) {
                zones[idx].count++; // 전체 시도 (상대 실수 + 우리의 파울)
              }
              if (isOppTeamEvent && (isTurnover || isFoul)) {
                zones[idx].success++; // 우리의 압박 성공 (순수 상대 실수)
              }
            }
          } else {
            // [상대의 압박 (우리의 피압박)]
            if (zoneInfo.zoneBand === m.myZone && zoneInfo.lane === m.myLane) {
              if ((isMyTeamEvent && (isTurnover || isFoul)) || (isOppTeamEvent && isFoul)) {
                zones[idx].count++; // 상대의 전체 시도 (우리 실수 + 상대의 파울)
              }
              if (isMyTeamEvent && (isTurnover || isFoul)) {
                zones[idx].success++; // 상대의 압박 성공 (순수 우리 실수)
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
    
    const formatNum = (val: number) => {
      if (isTournament) return (val / matchCount).toFixed(1);
      return Math.round(val).toString();
    };
    
    const avgCountFormatted = formatNum(teamData.totalCount);
    const avgSuccessFormatted = formatNum(teamData.totalSuccess);
    const totalRate = teamData.totalCount > 0 ? (teamData.totalSuccess / teamData.totalCount * 100).toFixed(1) : "0.0";
    
    const headerTitle = isHome ? `${team.name} 압박` : (awayHeader || `${team.name} 압박`);

    // 단일 경기는 홈팀 골대 우측, 대회 모드는 홈팀 골대 좌측 배치 (시각적 일관성)
    const goalOnRight = isTournament ? !isHome : isHome;

    return (
      <div className="flex flex-col gap-1">
        <div className="flex flex-col items-center justify-center p-3 rounded-t-lg border-b-4" style={{ backgroundColor: `${team.color}15`, borderColor: team.color }}>
          <h3 className="text-lg font-black uppercase tracking-tighter" style={{ color: team.color }}>
            {headerTitle}
          </h3>
          <p className="text-[11px] font-black mt-1 uppercase tracking-tight font-body">
            {isTournament ? '경기당 평균' : '합계'} 시도: <span className="text-primary text-sm">{avgCountFormatted}</span>회 | 성공: <span className="text-emerald-600 text-sm">{avgSuccessFormatted}</span>회 ({totalRate}%)
          </p>
        </div>
        <div className="relative aspect-[45.7/55] bg-white rounded-b-lg overflow-hidden border-2 border-muted shadow-lg">
          <svg viewBox="0 0 45.7 55" className="w-full h-full overflow-visible">
            {/* 필드 마킹 */}
            <g stroke="#000" strokeWidth="0.4" fill="none" opacity="0.5">
              <rect x="0" y="0" width="45.7" height="55" />
              {goalOnRight ? (
                <>
                  {/* 정교한 D-Zone (찌그러짐 방지) */}
                  <path d={`M 45.7,${27.5 - 1.83 - 14.63} L 45.7,${27.5 - 1.83} A 14.63,14.63 0 0,0 31.07,27.5 A 14.63,14.63 0 0,0 45.7,${27.5 + 1.83} L 45.7,${27.5 + 1.83 + 14.63}`} />
                  <path d={`M 45.7,${27.5 - 1.83 - 19.63} A 19.63,19.63 0 0,0 26.07,27.5 A 19.63,19.63 0 0,0 45.7,${27.5 + 1.83 + 19.63}`} strokeDasharray="1.5,1.5" opacity="0.3" />
                  {/* PS 점 */}
                  <circle cx={45.7 - 6.47} cy={27.5} r="0.6" fill="black" stroke="none" />
                  {/* 직사각형 골대 */}
                  <rect x="45.7" y={27.5 - 1.83} width="2.5" height="3.66" strokeWidth="0.8" />
                </>
              ) : (
                <>
                  <path d={`M 0,${27.5 - 1.83 - 14.63} L 0,${27.5 - 1.83} A 14.63,14.63 0 0,1 14.63,27.5 A 14.63,14.63 0 0,1 0,${27.5 + 1.83} L 0,${27.5 + 1.83 + 14.63}`} />
                  <path d={`M 0,${27.5 - 1.83 - 19.63} A 19.63,19.63 0 0,1 19.63,27.5 A 19.63,19.63 0 0,1 0,${27.5 + 1.83 + 19.63}`} strokeDasharray="1.5,1.5" opacity="0.3" />
                  <circle cx={6.47} cy={27.5} r="0.6" fill="black" stroke="none" />
                  <rect x="-2.5" y={27.5 - 1.83} width="2.5" height="3.66" strokeWidth="0.8" />
                </>
              )}
              <line x1="0" y1="18.33" x2="45.7" y2="18.33" strokeDasharray="1,1" opacity="0.2" />
              <line x1="0" y1="36.66" x2="45.7" y2="36.66" strokeDasharray="1,1" opacity="0.2" />
              <line x1="22.85" y1="0" x2="22.85" y2="55" strokeDasharray="1,1" opacity="0.2" />
            </g>

            {/* 구역 데이터 */}
            {teamData.zones.map((stat, i) => {
              const xIdx = Math.floor(i / 3); 
              const yIdx = i % 3; 

              let rectX = goalOnRight ? (xIdx === 0 ? 22.85 : 0) : (xIdx === 0 ? 0 : 22.85);
              const rectY = yIdx * 18.33;
              const intensity = stat.count > 0 ? (stat.count / globalMaxCount) * 0.5 + 0.1 : 0;

              return (
                <g key={i}>
                  <rect x={rectX} y={rectY} width="22.85" height="18.33" fill={team.color} fillOpacity={intensity} />
                  <text x={rectX + 11.42} y={rectY + 9.16} textAnchor="middle" dominantBaseline="middle" className="font-body">
                    <tspan x={rectX + 11.42} dy="-4.5" fontSize="2.8px" fontWeight="900" fillOpacity="0.7" fill="#000">{labels[i]}</tspan>
                    <tspan x={rectX + 11.42} dy="5.5" fontWeight="950" fontSize="5px" fill="#000">{formatNum(stat.count)}</tspan>
                    <tspan x={rectX + 11.42} dy="4.5" fontWeight="900" fontSize="3.8px" fill="#059669">성공: {formatNum(stat.success)}</tspan>
                    <tspan x={rectX + 11.42} dy="3.5" fontSize="2.8px" fontWeight="800" fill="#444">({stat.rate.toFixed(0)}%)</tspan>
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
    <Card className="lg:col-span-3 border-2 shadow-xl">
      <CardHeader className={isCompact ? "py-3 px-6" : "py-6 px-8"}>
        <CardTitle className={isCompact ? "text-xl font-black italic" : "text-2xl font-black italic"}>
          Pressure Analysis (압박 분석)
        </CardTitle>
        <CardDescription className="text-xs font-bold text-muted-foreground uppercase">
          압박 시도 대비 순수 성공(상대 실책 유도) 분석. {isTournament ? `대회 ${matchCount}경기 평균 데이터.` : '경기 실제 데이터.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-8">
        <div className="grid grid-cols-2 gap-8">
          {renderHalfPitch(zoneStats.home, homeTeam, true, zoneStats.globalMaxCount)}
          {renderHalfPitch(zoneStats.away, awayTeam, false, zoneStats.globalMaxCount)}
        </div>
      </CardContent>
    </Card>
  );
}
