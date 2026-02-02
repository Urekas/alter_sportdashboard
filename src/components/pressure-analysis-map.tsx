
"use client"

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { MatchEvent, Team } from "@/lib/types";

interface PressureAnalysisMapProps {
  events: MatchEvent[];
  homeTeam: Team;
  awayTeam: Team;
}

const PITCH_LENGTH = 91.4;
const PITCH_WIDTH = 55;
const MID_X = PITCH_LENGTH / 2;
const LINE_23M = 22.9;

type ZoneStat = {
  count: number;
  success: number;
  rate: number;
};

export function PressureAnalysisMap({ events, homeTeam, awayTeam }: PressureAnalysisMapProps) {
  const zoneStats = useMemo(() => {
    const calculateStats = (teamName: string, opponentName: string, isHome: boolean) => {
      // 6구역: [25L, 25C, 25R, 50L, 50C, 50R]
      const zones: ZoneStat[] = Array(6).fill(null).map(() => ({ count: 0, success: 0, rate: 0 }));

      events.forEach(e => {
        // 해당 팀의 공격 진영 이벤트인지 확인
        const isAttackingHalf = isHome ? (e.x > MID_X) : (e.x < MID_X);
        if (!isAttackingHalf) return;

        // 압박 성공/실패 여부 판단 (사용자 정의 공식 적용)
        // 성공: 상대 실책(턴오버/파울), 실패: 나의 공격 파울
        let isSuccess = false;
        let isFailure = false;

        if (e.team === opponentName) {
          isSuccess = true;
        } else if (e.team === teamName && e.type === 'foul') {
          isFailure = true;
        } else {
          return; // 압박 지표에 포함되지 않는 이벤트(나의 턴오버 등)는 건너뜀
        }

        // 구역 계산 (상대 골대 라인 기준 거리)
        const distFromGoal = isHome ? (PITCH_LENGTH - e.x) : e.x;
        const xIdx = distFromGoal <= LINE_23M ? 0 : 1; // 0: 25m zone, 1: 50m zone
        
        // 레인 계산 (공격 방향 기준 좌/중/우)
        // Y=0이 좌측 레인이라고 가정
        const laneY = isHome ? e.y : (PITCH_WIDTH - e.y);
        let yIdx = 0;
        if (laneY > PITCH_WIDTH * 0.66) yIdx = 2; // Right
        else if (laneY > PITCH_WIDTH * 0.33) yIdx = 1; // Center
        
        const zoneIdx = (xIdx * 3) + yIdx;

        if (zoneIdx >= 0 && zoneIdx < 6) {
          zones[zoneIdx].count++;
          if (isSuccess) zones[zoneIdx].success++;
          if (isFailure) zones[zoneIdx].success--;
        }
      });

      return zones.map(z => ({
        ...z,
        success: Math.max(0, z.success),
        rate: z.count > 0 ? Math.round((Math.max(0, z.success) / z.count) * 100) : 0
      }));
    };

    return {
      home: calculateStats(homeTeam.name, awayTeam.name, true),
      away: calculateStats(awayTeam.name, homeTeam.name, false)
    };
  }, [events, homeTeam, awayTeam]);

  const renderHalfPitch = (stats: ZoneStat[], team: Team, isHome: boolean) => {
    const labels = ["25L", "25C", "25R", "50L", "50C", "50R"];
    
    return (
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-bold text-center p-2 rounded-t-lg border-b-2" style={{ backgroundColor: `${team.color}15`, color: team.color, borderColor: team.color }}>
          {team.name} Attacking Half
        </h3>
        <div className="relative aspect-[45.7/55] bg-green-50/50 rounded-b-lg overflow-hidden border-2 border-muted shadow-inner">
          <svg viewBox="0 0 45.7 55" className="w-full h-full">
            {/* Pitch Markings (Half Pitch) */}
            <g stroke="#000" strokeWidth="0.2" fill="none" opacity="0.3">
              <rect x="0" y="0" width="45.7" height="55" />
              {/* Goal Line & Circle */}
              {isHome ? (
                <>
                  <line x1="45.7" y1="0" x2="45.7" y2="55" /> {/* Goal Line (Right side) */}
                  <path d="M 45.7,12.87 A 14.63,14.63 0 0,0 31.07,27.5 A 14.63,14.63 0 0,0 45.7,42.13" />
                  <line x1="22.9" y1="0" x2="22.9" y2="55" strokeDasharray="1,1" /> {/* 23m line */}
                </>
              ) : (
                <>
                  <line x1="0" y1="0" x2="0" y2="55" /> {/* Goal Line (Left side) */}
                  <path d="M 0,12.87 A 14.63,14.63 0 0,1 14.63,27.5 A 14.63,14.63 0 0,1 0,42.13" />
                  <line x1="22.8" y1="0" x2="22.8" y2="55" strokeDasharray="1,1" /> {/* 23m line */}
                </>
              )}
              {/* Lane Lines */}
              <line x1="0" y1="18.33" x2="45.7" y2="18.33" strokeDasharray="1,1" />
              <line x1="0" y1="36.66" x2="45.7" y2="36.66" strokeDasharray="1,1" />
            </g>

            {/* Zones Heatmap Overlay */}
            {stats.map((stat, i) => {
              const xIdx = Math.floor(i / 3);
              const yIdx = i % 3;
              
              let rectX = 0;
              let rectW = 22.85;
              
              if (isHome) {
                // Team Home attacks Right. 25m zone is 22.85 to 45.7, 50m zone is 0 to 22.85 (relative to center)
                rectX = xIdx === 0 ? 22.85 : 0;
              } else {
                // Team Away attacks Left. 25m zone is 0 to 22.85, 50m zone is 22.85 to 45.7
                rectX = xIdx === 0 ? 0 : 22.85;
              }
              
              const rectY = yIdx * 18.33;
              const intensity = stat.count > 0 ? (stat.rate / 150) + 0.05 : 0;

              return (
                <g key={i}>
                  <rect
                    x={rectX}
                    y={rectY}
                    width={rectW}
                    height="18.33"
                    fill={team.color}
                    fillOpacity={intensity}
                    className="transition-all hover:fill-opacity-40"
                  />
                  <text
                    x={rectX + rectW/2}
                    y={rectY + 18.33/2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="3"
                    className="font-bold fill-foreground select-none pointer-events-none"
                  >
                    <tspan x={rectX + rectW/2} dy="-1.5" fontSize="2.5" opacity="0.6">{labels[i]}</tspan>
                    <tspan x={rectX + rectW/2} dy="3" fontSize="4">{stat.rate}%</tspan>
                    <tspan x={rectX + rectW/2} dy="3" fontSize="2" opacity="0.6">{stat.success}/{stat.count}</tspan>
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
      <CardHeader>
        <CardTitle>Pressure Analysis Map</CardTitle>
        <CardDescription>
          상대 진영을 6개 구역으로 나누어 분석한 압박 지표입니다. (공격 방향 기준)
          <br />
          <span className="text-xs text-muted-foreground font-medium">압박 성공률 = (상대 실책 - 나의 공격 파울) / 총 압박 이벤트</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {renderHalfPitch(zoneStats.away, awayTeam, false)}
          {renderHalfPitch(zoneStats.home, homeTeam, true)}
        </div>
        
        <div className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-2 text-xs text-muted-foreground border-t pt-4 bg-muted/20 rounded-b-lg px-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-primary">25:</span> 공격 25m 구역
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-primary">50:</span> 하프라인 ~ 25m 구역
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-primary">L/C/R:</span> 공격 방향 기준 좌/중/우 레인
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
