
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
const BROKEN_CIRCLE_RADIUS = 19.63; 
const PENALTY_SPOT_DIST = 6.47;

type ZoneStat = {
  count: number;
  success: number;
  rate: number;
};

export function PressureAnalysisMap({ events, homeTeam, awayTeam }: PressureAnalysisMapProps) {
  const zoneStats = useMemo(() => {
    const calculateStats = (teamName: string, opponentName: string, isHome: boolean) => {
      // 0: 25L, 1: 25C, 2: 25R, 3: 50L, 4: 50C, 5: 50R
      const zones: ZoneStat[] = Array(6).fill(null).map(() => ({ count: 0, success: 0, rate: 0 }));

      const pressureEvents = events.filter(e => e.type === 'turnover' || e.type === 'foul');

      pressureEvents.forEach(e => {
        const isAttackingHalf = isHome ? (e.x > MID_X) : (e.x < MID_X);
        if (!isAttackingHalf) return;

        const loc = e.locationLabel.toUpperCase();
        let laneIdx = 1; // Center
        if (loc.includes('좌') || loc.includes('LEFT') || loc.startsWith('L_')) laneIdx = 0;
        else if (loc.includes('우') || loc.includes('RIGHT') || loc.startsWith('R_')) laneIdx = 2;

        let zoneIdx = -1;
        if (loc.includes('25')) zoneIdx = 0 + laneIdx;
        else if (loc.includes('50')) zoneIdx = 3 + laneIdx;

        if (zoneIdx < 0 || zoneIdx >= 6) return;

        // 분모: 나의 파울 + 상대 턴오버 + 상대 파울
        zones[zoneIdx].count++;

        // 성공: 상대 실책 (상대의 턴오버 또는 파울)
        if (e.team === opponentName) {
          zones[zoneIdx].success++;
        }
      });

      return zones.map(z => ({
        ...z,
        rate: z.count > 0 ? Math.round((z.success / z.count) * 100) : 0
      }));
    };

    return {
      home: calculateStats(homeTeam.name, awayTeam.name, true),
      away: calculateStats(awayTeam.name, homeTeam.name, false)
    };
  }, [events, homeTeam, awayTeam]);

  const renderHalfPitch = (stats: ZoneStat[], team: Team, isHome: boolean) => {
    const labels = ["25L", "25C", "25R", "50L", "50C", "50R"];
    const CX = 27.5; 
    
    return (
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-bold text-center p-2 rounded-t-lg border-b-2" style={{ backgroundColor: `${team.color}15`, color: team.color, borderColor: team.color }}>
          {team.name} 상대 진영 압박
        </h3>
        <div className="relative aspect-[45.7/55] bg-green-50/50 rounded-b-lg overflow-hidden border-2 border-muted shadow-inner">
          <svg viewBox="-2 0 49.7 55" className="w-full h-full overflow-visible">
            <g stroke="#000" strokeWidth="0.25" fill="none" opacity="0.4">
              <rect x="0" y="0" width="45.7" height="55" />
              {isHome ? (
                <>
                  <line x1="45.7" y1="0" x2="45.7" y2="55" /> 
                  <path d={`M 45.7,${CX - CIRCLE_RADIUS} A ${CIRCLE_RADIUS},${CIRCLE_RADIUS} 0 0,0 31.07,${CX} A ${CIRCLE_RADIUS},${CIRCLE_RADIUS} 0 0,0 45.7,${CX + CIRCLE_RADIUS}`} />
                  <path d={`M 45.7,${CX - BROKEN_CIRCLE_RADIUS} A ${BROKEN_CIRCLE_RADIUS},${BROKEN_CIRCLE_RADIUS} 0 0,0 26.07,${CX} A ${BROKEN_CIRCLE_RADIUS},${BROKEN_CIRCLE_RADIUS} 0 0,0 45.7,${CX + BROKEN_CIRCLE_RADIUS}`} strokeDasharray="1,1" />
                  <circle cx={45.7 - PENALTY_SPOT_DIST} cy={CX} r="0.3" fill="black" stroke="none" />
                  <rect x="45.7" y={CX - 1.83} width="1.2" height="3.66" />
                  <line x1="22.85" y1="0" x2="22.85" y2="55" strokeDasharray="1,1" />
                </>
              ) : (
                <>
                  <line x1="0" y1="0" x2="0" y2="55" />
                  <path d={`M 0,${CX - CIRCLE_RADIUS} A ${CIRCLE_RADIUS},${CIRCLE_RADIUS} 0 0,1 ${CIRCLE_RADIUS},${CX} A ${CIRCLE_RADIUS},${CIRCLE_RADIUS} 0 0,1 0,${CX + CIRCLE_RADIUS}`} />
                  <path d={`M 0,${CX - BROKEN_CIRCLE_RADIUS} A ${BROKEN_CIRCLE_RADIUS},${BROKEN_CIRCLE_RADIUS} 0 0,1 ${BROKEN_CIRCLE_RADIUS},${CX} A ${BROKEN_CIRCLE_RADIUS},${BROKEN_CIRCLE_RADIUS} 0 0,1 0,${CX + BROKEN_CIRCLE_RADIUS}`} strokeDasharray="1,1" />
                  <circle cx={PENALTY_SPOT_DIST} cy={CX} r="0.3" fill="black" stroke="none" />
                  <rect x="-1.2" y={CX - 1.83} width="1.2" height="3.66" />
                  <line x1="22.85" y1="0" x2="22.85" y2="55" strokeDasharray="1,1" />
                </>
              )}
              <line x1="0" y1="18.33" x2="45.7" y2="18.33" strokeDasharray="1,1" />
              <line x1="0" y1="36.66" x2="45.7" y2="36.66" strokeDasharray="1,1" />
            </g>

            {stats.map((stat, i) => {
              const xIdx = Math.floor(i / 3); // 0 (25y), 1 (50y)
              const yIdx = i % 3; // 0 (Left), 1 (Center), 2 (Right)
              let rectX = 0;
              let rectW = 22.85;
              if (isHome) {
                rectX = xIdx === 0 ? 22.85 : 0;
              } else {
                rectX = xIdx === 0 ? 0 : 22.85;
              }
              const rectY = yIdx * 18.33;
              const intensity = stat.count > 0 ? (Math.abs(stat.rate) / 100) * 0.4 + 0.1 : 0;

              return (
                <g key={i}>
                  <rect
                    x={rectX}
                    y={rectY}
                    width={rectW}
                    height="18.33"
                    fill={team.color}
                    fillOpacity={intensity}
                  />
                  <text
                    x={rectX + rectW/2}
                    y={rectY + 18.33/2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="font-bold fill-foreground"
                  >
                    <tspan x={rectX + rectW/2} dy="-3" fontSize="3">{labels[i]}</tspan>
                    <tspan x={rectX + rectW/2} dy="4" fontSize="2.5" fontWeight="normal">압박 횟수 : {stat.count}</tspan>
                    <tspan x={rectX + rectW/2} dy="3.5" fontSize="2" fontWeight="bold" opacity="0.8">{stat.rate}%</tspan>
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
          상대 진영 구역 내 압박 성공률입니다.
          <br />
          <span className="text-xs text-muted-foreground font-medium">성공률 = (상대 실책 합계) / 총 압박 이벤트 (나의 파울 + 상대 턴오버/파울)</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {renderHalfPitch(zoneStats.home, homeTeam, true)}
          {renderHalfPitch(zoneStats.away, awayTeam, false)}
        </div>
      </CardContent>
    </Card>
  );
}
