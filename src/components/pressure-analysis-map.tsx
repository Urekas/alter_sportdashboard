
'use client';

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
  const isTournament = matchCount > 1;

  const zoneStats = useMemo(() => {
    const calculateStats = (isHome: boolean) => {
      // Index mapping: 0: 25L, 1: 25C, 2: 25R, 3: 50L, 4: 50C, 5: 50R
      const zones: ZoneStat[] = Array(6).fill(null).map(() => ({ count: 0, success: 0, rate: 0 }));

      // 형님의 철칙 매핑 (홈팀 기준)
      // 25L(0) = 상대 100R + 본인 25L(파울)
      // 25C(1) = 상대 100C + 본인 25C(파울)
      // 25R(2) = 상대 100L + 본인 25R(파울)
      const mapping = [
        { name: "25L", oppZone: 100, oppLane: 'Right', myZone: 25, myLane: 'Left' },
        { name: "25C", oppZone: 100, oppLane: 'Center', myZone: 25, myLane: 'Center' },
        { name: "25R", oppZone: 100, oppLane: 'Left', myZone: 25, myLane: 'Right' },
        { name: "50L", oppZone: 75, oppLane: 'Right', myZone: 50, myLane: 'Left' },
        { name: "50C", oppZone: 75, oppLane: 'Center', myZone: 50, myLane: 'Center' },
        { name: "50R", oppZone: 75, oppLane: 'Left', myZone: 50, myLane: 'Right' }
      ];

      events.forEach(e => {
        const zoneInfo = mapZone(e.locationLabel || e.code);
        const teamName = e.team?.trim();
        const isMyTeam = teamName === homeTeam.name;
        
        // 형님의 지혜: 상대 팀 이름이 "대회 전체 평균"일 때를 대비해 우리 팀이 아니면 무조건 상대 팀으로 간주
        const isOppTeam = teamName !== homeTeam.name;

        const isOppError = isOppTeam && (e.type === 'turnover' || e.type === 'foul');
        const isMyFoul = isMyTeam && e.type === 'foul';
        
        const isMyError = isMyTeam && (e.type === 'turnover' || e.type === 'foul');
        const isOppFoul = isOppTeam && e.type === 'foul';

        mapping.forEach((m, idx) => {
          if (isHome) {
            // [홈팀 압박 분석]
            if (zoneInfo.zoneBand === m.oppZone && zoneInfo.lane === m.oppLane) {
              if (isOppError) {
                zones[idx].count++;
                zones[idx].success++;
              }
            }
            if (zoneInfo.zoneBand === m.myZone && zoneInfo.lane === m.myLane) {
              if (isMyFoul) {
                zones[idx].count++;
              }
            }
          } else {
            // [상대팀 압박 분석]
            if (zoneInfo.zoneBand === m.myZone && zoneInfo.lane === m.myLane) {
              if (isMyError) {
                zones[idx].count++;
                zones[idx].success++;
              }
            }
            if (zoneInfo.zoneBand === m.oppZone && zoneInfo.lane === m.oppLane) {
              if (isOppFoul) {
                zones[idx].count++;
              }
            }
          }
        });
      });

      return {
        zones: zones.map(z => ({
          ...z,
          rate: z.count > 0 ? (z.success / z.count) * 100 : 0
        })),
        totalCount: zones.reduce((acc, z) => acc + z.count, 0),
        totalSuccess: zones.reduce((acc, z) => acc + z.success, 0)
      };
    };

    const homeData = calculateStats(true);
    const awayData = calculateStats(false);
    const globalMaxCount = Math.max(...homeData.zones.map(s => s.count), ...awayData.zones.map(s => s.count), 1);

    return { home: homeData, away: awayData, globalMaxCount };
  }, [events, homeTeam.name]);

  const renderHalfPitch = (teamData: { zones: ZoneStat[], totalCount: number, totalSuccess: number }, team: Team, isHome: boolean, globalMaxCount: number) => {
    const labels = ["25L", "25C", "25R", "50L", "50C", "50R"];
    const formatNum = (val: number) => isTournament ? (val / matchCount).toFixed(1) : Math.round(val).toString();
    const totalRate = teamData.totalCount > 0 ? (teamData.totalSuccess / teamData.totalCount * 100).toFixed(1) : "0.0";
    const headerTitle = isHome ? `${team.name} 압박` : (awayHeader || `${team.name} 압박`);

    return (
      <div className="flex flex-col gap-1">
        <div className="flex flex-col items-center justify-center p-2 rounded-t-lg border-b-2" style={{ backgroundColor: `${team.color}15`, borderColor: team.color }}>
          <h3 className="text-sm font-black uppercase tracking-tighter" style={{ color: team.color }}>{headerTitle}</h3>
          <p className="text-[10px] font-bold mt-1 uppercase tracking-tight">
            {isTournament ? '평균' : '합계'} 시도: <span className="text-primary">{formatNum(teamData.totalCount)}</span> | 성공: <span className="text-emerald-600">{formatNum(teamData.totalSuccess)}</span> ({totalRate}%)
          </p>
        </div>
        <div className="relative aspect-[45.7/55] bg-green-50/50 rounded-b-lg overflow-hidden border border-muted shadow-inner">
          <svg viewBox="0 0 45.7 55" className="w-full h-full overflow-visible">
            <g stroke="#000" strokeWidth="0.3" fill="none" opacity="0.4">
              <rect x="0" y="0" width="45.7" height="55" />
              {isHome ? (
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
              const xIdx = Math.floor(i / 3); // 0 (25), 1 (50)
              const yIdx = i % 3; // 0 (L), 1 (C), 2 (R)
              const rectX = isHome ? (xIdx === 0 ? 22.85 : 0) : (xIdx === 0 ? 0 : 22.85);
              
              // 형님의 지혜: 상단이 R(yIdx=2), 하단이 L(yIdx=0)
              const rectY = (2 - yIdx) * 18.33;
              
              const intensity = stat.count > 0 ? (stat.count / globalMaxCount) * 0.45 + 0.1 : 0;

              return (
                <g key={i}>
                  <rect x={rectX} y={rectY} width="22.85" height="18.33" fill={team.color} fillOpacity={intensity} />
                  <text x={rectX + 11.42} y={rectY + 9.16} textAnchor="middle" dominantBaseline="middle" className="fill-foreground font-bold">
                    <tspan x={rectX + 11.42} dy="-4" fontSize="2.5px" fontWeight="black" fillOpacity="0.6">{labels[i]}</tspan>
                    <tspan x={rectX + 11.42} dy="4.5" fontWeight="black" fontSize="4px">{formatNum(stat.count)}</tspan>
                    <tspan x={rectX + 11.42} dy="4" fontWeight="black" fontSize="3.2px" fill="#059669">S: {formatNum(stat.success)}</tspan>
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
          압박 시도 대비 성공(상대 실책 유도) 비율. {isTournament ? `대회 ${matchCount}경기 평균.` : '경기 실제 수치.'}
        </CardDescription>
      </CardHeader>
      <CardContent className={isCompact ? "p-2" : "p-4"}>
        <div className="grid grid-cols-2 gap-4">
          {renderHalfPitch(zoneStats.home, homeTeam, true, zoneStats.globalMaxCount)}
          {renderHalfPitch(zoneStats.away, awayTeam, false, zoneStats.globalMaxCount)}
        </div>
      </CardContent>
    </Card>
  );
}
