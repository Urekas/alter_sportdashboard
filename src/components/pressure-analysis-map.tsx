"use client"

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { MatchEvent, Team } from "@/lib/types";

interface PressureAnalysisMapProps {
  events: MatchEvent[];
  homeTeam: Team;
  awayTeam: Team;
}

type ZoneStat = {
  count: number;
  success: number;
  rate: number;
};

export function PressureAnalysisMap({ events, homeTeam, awayTeam }: PressureAnalysisMapProps) {
  const zoneStats = useMemo(() => {
    const calculateStats = (isHome: boolean) => {
      // 0: 25(L or R), 1: 25C, 2: 25(R or L), 3: 50(L or R), 4: 50C, 5: 50(R or L)
      const zones: ZoneStat[] = Array(6).fill(null).map(() => ({ count: 0, success: 0, rate: 0 }));

      const myTeam = isHome ? homeTeam.name : awayTeam.name;
      const oppTeam = isHome ? awayTeam.name : homeTeam.name;

      // 정밀 매핑 (형님 철칙)
      const mapping = isHome ? {
        0: { opp: "우_100", my: "좌_25" }, // 25L (Top)
        1: { opp: "중_100", my: "중_25" }, // 25C
        2: { opp: "좌_100", my: "우_25" }, // 25R (Bottom)
        3: { opp: "우_75", my: "좌_50" },  // 50L (Top)
        4: { opp: "중_75", my: "중_50" },  // 50C
        5: { opp: "좌_75", my: "우_50" }   // 50R (Bottom)
      } : {
        0: { opp: "우_0", my: "좌_100" },   // 25R (Top) - 어웨이팀 "위가 R"
        1: { opp: "중_0", my: "중_100" },   // 25C
        2: { opp: "좌_0", my: "우_100" },   // 25L (Bottom) - 어웨이팀 "아래가 L"
        3: { opp: "우_25", my: "좌_75" },   // 50R (Top)
        4: { opp: "중_25", my: "중_75" },   // 50C
        5: { opp: "좌_25", my: "우_75" }    // 50L (Bottom)
      };

      events.forEach(e => {
        const isOpponentError = e.team === oppTeam && (e.type === 'turnover' || e.type === 'foul');
        const isMyFoul = e.team === myTeam && e.type === 'foul';

        if (!isOpponentError && !isMyFoul) return;

        const loc = e.locationLabel.trim();

        Object.entries(mapping).forEach(([idxStr, maps]) => {
          const idx = parseInt(idxStr);
          if (isOpponentError && loc === maps.opp) {
            zones[idx].count++;
            zones[idx].success++;
          }
          if (isMyFoul && loc === maps.my) {
            zones[idx].count++;
          }
        });
      });

      return zones.map(z => ({
        ...z,
        rate: z.count > 0 ? Math.round((z.success / z.count) * 100) : 0
      }));
    };

    return {
      home: calculateStats(true),
      away: calculateStats(false)
    };
  }, [events, homeTeam, awayTeam]);

  const renderHalfPitch = (stats: ZoneStat[], team: Team, isHome: boolean) => {
    // 형님 요청: 홈팀(위 L, 아래 R), 어웨이팀(위 R, 아래 L)
    const labels = isHome 
      ? ["25L", "25C", "25R", "50L", "50C", "50R"]
      : ["25R", "25C", "25L", "50R", "50C", "50L"];

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
                  <path d={`M 45.7,${CX - 14.63} A 14.63,14.63 0 0,0 31.07,${CX} A 14.63,14.63 0 0,0 45.7,${CX + 14.63}`} />
                  <path d={`M 45.7,${CX - 19.63} A 19.63,19.63 0 0,0 26.07,${CX} A 19.63,19.63 0 0,0 45.7,${CX + 19.63}`} strokeDasharray="1,1" />
                  <circle cx={45.7 - 6.47} cy={CX} r="0.3" fill="black" stroke="none" />
                  <rect x="45.7" y={CX - 1.83} width="1.2" height="3.66" />
                  <line x1="22.85" y1="0" x2="22.85" y2="55" strokeDasharray="1,1" />
                </>
              ) : (
                <>
                  <line x1="0" y1="0" x2="0" y2="55" />
                  <path d={`M 0,${CX - 14.63} A 14.63,14.63 0 0,1 14.63,${CX} A 14.63,14.63 0 0,1 0,${CX + 14.63}`} />
                  <path d={`M 0,${CX - 19.63} A 19.63,19.63 0 0,1 19.63,${CX} A 19.63,19.63 0 0,1 0,${CX + 19.63}`} strokeDasharray="1,1" />
                  <circle cx={6.47} cy={CX} r="0.3" fill="black" stroke="none" />
                  <rect x="-1.2" y={CX - 1.83} width="1.2" height="3.66" />
                  <line x1="22.85" y1="0" x2="22.85" y2="55" strokeDasharray="1,1" />
                </>
              )}
              <line x1="0" y1="18.33" x2="45.7" y2="18.33" strokeDasharray="1,1" />
              <line x1="0" y1="36.66" x2="45.7" y2="36.66" strokeDasharray="1,1" />
            </g>

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
                    className="fill-foreground"
                    style={{ fontSize: '3px' }}
                  >
                    <tspan x={rectX + rectW/2} dy="-4" fontWeight="bold">{labels[i]}</tspan>
                    <tspan x={rectX + rectW/2} dy="4.5" fontWeight="bold">압박 횟수 : {Math.round(stat.count)}</tspan>
                    <tspan x={rectX + rectW/2} dy="3.5" fontSize="2.2px" fontWeight="normal" opacity="0.8">{stat.rate.toFixed(1)}%</tspan>
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
          상대 진영 구역 내 압박 성공률입니다. (홈팀: 위L-아래R / 어웨이팀: 위R-아래L)
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