
'use client'

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { MatchEvent, Team } from "@/lib/types";
import { mapZone } from "@/lib/zone-helpers";

interface ZoneStat {
  count: number;
  success: number;
  rate?: number;
}

interface PressureAnalysisMapProps {
  events?: MatchEvent[];
  homeTeam: Team;
  awayTeam: Team;
  isCompact?: boolean;
  awayHeader?: string;
  matchCount?: number;
  homeStats?: ZoneStat[];
  awayStats?: ZoneStat[];
  isTournament?: boolean;
  homeMatchCount?: number;
  awayMatchCount?: number;
  awayTitle?: string;
}

export function PressureAnalysisMap({ 
  events, 
  homeTeam, 
  awayTeam, 
  isCompact, 
  awayHeader, 
  matchCount = 1,
  homeStats,
  awayStats,
  isTournament: isTournamentProp,
  homeMatchCount,
  awayMatchCount,
  awayTitle
}: PressureAnalysisMapProps) {
  const isTournament = isTournamentProp || matchCount > 1;
  const hCount = homeMatchCount || matchCount;
  const aCount = awayMatchCount || matchCount;

  const zoneStats = useMemo(() => {
    if (homeStats && awayStats) {
      const hData = {
        zones: homeStats.map(s => ({ ...s, rate: s.count > 0 ? (s.success / s.count) * 100 : 0 })),
        totalCount: homeStats.reduce((acc, s) => acc + s.count, 0),
        totalSuccess: homeStats.reduce((acc, s) => acc + s.success, 0)
      };
      const aData = {
        zones: awayStats.map(s => ({ ...s, rate: s.count > 0 ? (s.success / s.count) * 100 : 0 })),
        totalCount: awayStats.reduce((acc, s) => acc + s.count, 0),
        totalSuccess: awayStats.reduce((acc, s) => acc + s.success, 0)
      };
      const globalMaxCount = Math.max(...hData.zones.map(s => s.count), ...aData.zones.map(s => s.count), 1);
      return { home: hData, away: aData, globalMaxCount };
    }

    const calculateStats = (isHome: boolean) => {
      const zones: ZoneStat[] = Array(6).fill(null).map(() => ({ count: 0, success: 0, rate: 0 }));
      
      const mapping = [
        { oppZone: 100, oppLane: 'Right', myZone: 25, myLane: 'Left' },  
        { oppZone: 100, oppLane: 'Center', myZone: 25, myLane: 'Center' },
        { oppZone: 100, oppLane: 'Left', myZone: 25, myLane: 'Right' },  
        { oppZone: 75, oppLane: 'Right', myZone: 50, myLane: 'Left' },    
        { oppZone: 75, oppLane: 'Center', myZone: 50, myLane: 'Center' },  
        { oppZone: 75, oppLane: 'Left', myZone: 50, myLane: 'Right' }    
      ];

      events?.forEach(e => {
        const zoneInfo = mapZone(e.locationLabel || e.code);
        if (!zoneInfo) return;

        const isMe = e.team === homeTeam.name;
        const isOpponent = e.team !== homeTeam.name;

        if (isHome) {
          const isOpponentError = isOpponent && (e.type === 'turnover' || e.type === 'foul');
          const isMyFoul = isMe && e.type === 'foul';
          if (!isOpponentError && !isMyFoul) return;

          mapping.forEach((m, idx) => {
            if (zoneInfo.zoneBand === m.oppZone && zoneInfo.lane === m.oppLane) {
              if (isOpponentError || isMyFoul) zones[idx].count++;
              if (isOpponentError) zones[idx].success++;
            }
          });
        } else {
          const isMyTeamError = isMe && (e.type === 'turnover' || e.type === 'foul');
          const isOppTeamFoul = isOpponent && e.type === 'foul';
          if (!isMyTeamError && !isOppTeamFoul) return;

          mapping.forEach((m, idx) => {
            if (isMyTeamError && zoneInfo.zoneBand === m.oppZone && zoneInfo.lane === m.oppLane) {
              zones[idx].count++;
              zones[idx].success++;
            }
            if (isOppTeamFoul && zoneInfo.zoneBand === m.myZone && zoneInfo.lane === m.myLane) {
              zones[idx].count++;
            }
          });
        }
      });

      return {
        zones: zones.map(z => ({ ...z, rate: z.count > 0 ? (z.success / z.count) * 100 : 0 })),
        totalCount: zones.reduce((acc, z) => acc + z.count, 0),
        totalSuccess: zones.reduce((acc, z) => acc + z.success, 0)
      };
    };

    const homeData = calculateStats(true);
    const awayData = calculateStats(false);
    const globalMaxCount = Math.max(...homeData.zones.map(s => s.count), ...awayData.zones.map(s => s.count), 1);

    return { home: homeData, away: awayData, globalMaxCount };
  }, [events, homeTeam, awayTeam, homeStats, awayStats]);

  const renderHalfPitch = (teamData: { zones: ZoneStat[], totalCount: number, totalSuccess: number }, team: Team, isHome: boolean, globalMaxCount: number, mCount: number) => {
    // 어웨이 팀일 경우 시각적 일관성을 위해 L과 R의 레이블 순서를 바꿈 (R을 상단으로)
    const labels = isHome ? ["25L", "25C", "25R", "50L", "50C", "50R"] : ["25R", "25C", "25L", "50R", "50C", "50L"];
    const formatNum = (val: number) => isTournament ? (val / mCount).toFixed(1) : val.toString();
    const headerTitle = isHome ? `${team.name} 압박` : (awayTitle || awayHeader || `${team.name} 압박`);
    const goalOnRight = isHome;

    return (
      <div className="flex flex-col gap-1">
        <div className="flex flex-col items-center justify-center p-2 rounded-t-lg border-b-2" style={{ backgroundColor: `${team.color}15`, borderColor: team.color }}>
          <h3 className="text-sm font-black uppercase tracking-tighter" style={{ color: team.color }}>{headerTitle}</h3>
          <p className="text-[10px] font-bold mt-1 uppercase tracking-tight">
            {isTournament ? '평균' : '합계'} 시도: <span className="text-primary">{formatNum(teamData.totalCount)}</span> | 성공: <span className="text-emerald-600">{formatNum(teamData.totalSuccess)}</span> ({teamData.totalCount > 0 ? (teamData.totalSuccess / teamData.totalCount * 100).toFixed(1) : "0.0"}%)
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

            {labels.map((label, i) => {
              const xIdx = Math.floor(i / 3);
              const yIdx = i % 3;
              let rectX = goalOnRight ? (xIdx === 0 ? 22.85 : 0) : (xIdx === 0 ? 0 : 22.85);
              const rectY = yIdx * 18.33; 

              // 어웨이 팀일 경우 인덱스 접근을 레이블에 맞게 스왑 (0번 레이블(Top)이 Right 데이터를 쓰도록)
              let dataIdx = i;
              if (!isHome) {
                if (i === 0) dataIdx = 2; // 레이블 25R -> 데이터 Index 2(Right)
                else if (i === 2) dataIdx = 0; // 레이블 25L -> 데이터 Index 0(Left)
                else if (i === 3) dataIdx = 5; // 레이블 50R -> 데이터 Index 5(Right)
                else if (i === 5) dataIdx = 3; // 레이블 50L -> 데이터 Index 3(Left)
              }
              const stat = teamData.zones[dataIdx];
              const intensity = stat.count > 0 ? (stat.count / globalMaxCount) * 0.45 + 0.1 : 0;

              return (
                <g key={i}>
                  <rect x={rectX} y={rectY} width="22.85" height="18.33" fill={team.color} fillOpacity={intensity} />
                  <text x={rectX + 11.42} y={rectY + 9.16} textAnchor="middle" dominantBaseline="middle" className="fill-foreground font-bold">
                    <tspan x={rectX + 11.42} dy="-4" fontSize="2.5px" fontWeight="black" fillOpacity="0.6">{label}</tspan>
                    <tspan x={rectX + 11.42} dy="4.5" fontWeight="black" fontSize="4px">{formatNum(stat.count)}</tspan>
                    <tspan x={rectX + 11.42} dy="4" fontWeight="black" fontSize="3.2px" fill="#059669">성공: {formatNum(stat.success)}</tspan>
                    <tspan x={rectX + 11.42} dy="3" fontSize="2.2px" fontWeight="normal" opacity="0.8">({stat.rate?.toFixed(0)}%)</tspan>
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
        <CardDescription className={isCompact ? "text-[10px]" : ""}>압박 시도 대비 순수 성공 분석. {isTournament ? `대회 평균 수치.` : '경기 실제 수치.'}</CardDescription>
      </CardHeader>
      <CardContent className={isCompact ? "p-2 md:p-4" : "p-4 md:p-6"}>
        <div className="grid grid-cols-2 gap-4">
          {renderHalfPitch(zoneStats.home, homeTeam, true, zoneStats.globalMaxCount, hCount)}
          {renderHalfPitch(zoneStats.away, awayTeam, false, zoneStats.globalMaxCount, aCount)}
        </div>
      </CardContent>
    </Card>
  );
}
