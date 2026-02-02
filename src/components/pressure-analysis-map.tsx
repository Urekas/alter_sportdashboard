
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
const CIRCLE_RADIUS = 14.63;
const BROKEN_CIRCLE_RADIUS = 19.63; // 14.63 + 5
const PENALTY_SPOT_DIST = 6.47;

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
        const isAttackingHalf = isHome ? (e.x > MID_X) : (e.x < MID_X);
        if (!isAttackingHalf) return;

        let isSuccess = false;
        let isFailure = false;

        if (e.team === opponentName) {
          isSuccess = true;
        } else if (e.team === teamName && e.type === 'foul') {
          isFailure = true;
        } else {
          return;
        }

        const distFromGoal = isHome ? (PITCH_LENGTH - e.x) : e.x;
        const xIdx = distFromGoal <= LINE_23M ? 0 : 1; 
        
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
    const CX = 27.5; // Center Y of pitch
    
    return (
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-bold text-center p-2 rounded-t-lg border-b-2" style={{ backgroundColor: `${team.color}15`, color: team.color, borderColor: team.color }}>
          {team.name} Attacking Half
        </h3>
        <div className="relative aspect-[45.7/55] bg-green-50/50 rounded-b-lg overflow-hidden border-2 border-muted shadow-inner">
          <svg viewBox="-2 0 49.7 55" className="w-full h-full overflow-visible">
            {/* Pitch Markings (Half Pitch) */}
            <g stroke="#000" strokeWidth="0.25" fill="none" opacity="0.4">
              <rect x="0" y="0" width="45.7" height="55" />
              {isHome ? (
                <>
                  <line x1="45.7" y1="0" x2="45.7" y2="55" /> {/* Goal Line */}
                  {/* Shooting Circle */}
                  <path d={`M 45.7,${CX - CIRCLE_RADIUS} A ${CIRCLE_RADIUS},${CIRCLE_RADIUS} 0 0,0 31.07,${CX} A ${CIRCLE_RADIUS},${CIRCLE_RADIUS} 0 0,0 45.7,${CX + CIRCLE_RADIUS}`} />
                  {/* 5m Broken Circle */}
                  <path d={`M 45.7,${CX - BROKEN_CIRCLE_RADIUS} A ${BROKEN_CIRCLE_RADIUS},${BROKEN_CIRCLE_RADIUS} 0 0,0 26.07,${CX} A ${BROKEN_CIRCLE_RADIUS},${BROKEN_CIRCLE_RADIUS} 0 0,0 45.7,${CX + BROKEN_CIRCLE_RADIUS}`} strokeDasharray="1,1" />
                  {/* Penalty Spot */}
                  <circle cx={45.7 - PENALTY_SPOT_DIST} cy={CX} r="0.3" fill="black" stroke="none" />
                  {/* Goal Box */}
                  <rect x="45.7" y={CX - 1.83} width="1.2" height="3.66" />
                  <line x1="22.85" y1="0" x2="22.85" y2="55" strokeDasharray="1,1" /> {/* 23m line */}
                </>
              ) : (
                <>
                  <line x1="0" y1="0" x2="0" y2="55" /> {/* Goal Line */}
                  {/* Shooting Circle */}
                  <path d={`M 0,${CX - CIRCLE_RADIUS} A ${CIRCLE_RADIUS},${CIRCLE_RADIUS} 0 0,1 ${CIRCLE_RADIUS},${CX} A ${CIRCLE_RADIUS},${CIRCLE_RADIUS} 0 0,1 0,${CX + CIRCLE_RADIUS}`} />
                  {/* 5m Broken Circle */}
                  <path d={`M 0,${CX - BROKEN_CIRCLE_RADIUS} A ${BROKEN_CIRCLE_RADIUS},${BROKEN_CIRCLE_RADIUS} 0 0,1 ${BROKEN_CIRCLE_RADIUS},${CX} A ${BROKEN_CIRCLE_RADIUS},${BROKEN_CIRCLE_RADIUS} 0 0,1 0,${CX + BROKEN_CIRCLE_RADIUS}`} strokeDasharray="1,1" />
                  {/* Penalty Spot */}
                  <circle cx={PENALTY_SPOT_DIST} cy={CX} r="0.3" fill="black" stroke="none" />
                  {/* Goal Box */}
                  <rect x="-1.2" y={CX - 1.83} width="1.2" height="3.66" />
                  <line x1="22.85" y1="0" x2="22.85" y2="55" strokeDasharray="1,1" /> {/* 23m line */}
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
                rectX = xIdx === 0 ? 22.85 : 0;
              } else {
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
          상대 진영을 6개 구역으로 나누어 분석한 압박 지표입니다. (골대 방향 기준)
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
            <span className="font-bold text-primary">25:</span> 공격 25m 구역 (골대 인접)
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
