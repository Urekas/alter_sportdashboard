"use client"

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { MatchEvent, Team } from "@/lib/types";

interface PressureAnalysisMapProps {
  events: MatchEvent[];
  homeTeam: Team;
  awayTeam: Team;
  isCompact?: boolean;
}

type ZoneStat = {
  count: number;
  success: number;
  rate: number;
};

export function PressureAnalysisMap({ events, homeTeam, awayTeam, isCompact }: PressureAnalysisMapProps) {
  const zoneStats = useMemo(() => {
    const calculateStats = (isHome: boolean) => {
      const zones: ZoneStat[] = Array(6).fill(null).map(() => ({ count: 0, success: 0, rate: 0 }));

      const myTeam = isHome ? homeTeam.name : awayTeam.name;
      const oppTeam = isHome ? awayTeam.name : homeTeam.name;

      const mapping = isHome ? {
        0: { opp: "우_100", my: "좌_25" }, 
        1: { opp: "중_100", my: "중_25" }, 
        2: { opp: "좌_100", my: "우_25" }, 
        3: { opp: "우_75", my: "좌_50" },  
        4: { opp: "중_75", my: "중_50" },  
        5: { opp: "좌_75", my: "우_50" }   
      } : {
        0: { opp: "우_0", my: "좌_100" },   
        1: { opp: "중_0", my: "중_100" },   
        2: { opp: "좌_0", my: "우_100" },   
        3: { opp: "우_25", my: "좌_75" },   
        4: { opp: "중_25", my: "중_75" },   
        5: { opp: "좌_25", my: "우_75" }    
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

    const home = calculateStats(true);
    const away = calculateStats(false);
    
    const globalMaxCount = Math.max(...home.map(s => s.count), ...away.map(s => s.count), 1);

    return {
      home,
      away,
      globalMaxCount
    };
  }, [events, homeTeam, awayTeam]);

  const renderHalfPitch = (stats: ZoneStat[], team: Team, isHome: boolean, globalMaxCount: number) => {
    const labels = isHome 
      ? ["25L", "25C", "25R", "50L", "50C", "50R"]
      : ["25R", "25C", "25L", "50R", "50C", "50L"];

    const CX = 27.5; 
    
    return (
      <div className="flex flex-col gap-1">
        <h3 className="text-[10px] md:text-xs font-bold text-center p-1 rounded-t-lg border-b-2" style={{ backgroundColor: `${team.color}15`, color: team.color, borderColor: team.color }}>
          {team.name} 상대 진영 압박
        </h3>
        <div className="relative aspect-[45.7/55] bg-green-50/50 rounded-b-lg overflow-hidden border border-muted shadow-inner">
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
              let rectX = isHome ? (xIdx === 0 ? 22.85 : 0) : (xIdx === 0 ? 0 : 22.85);
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
                    y={rectY + 18.33/2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-foreground"
                    style={{ fontSize: '3px' }}
                  >
                    <tspan x={rectX + 11.42} dy="-4" fontWeight="bold">{labels[i]}</tspan>
                    <tspan x={rectX + 11.42} dy="4.5" fontWeight="bold">압박 : {Math.round(stat.count)}</tspan>
                    <tspan x={rectX + 11.42} dy="3.5" fontSize="2.2px" fontWeight="normal" opacity="0.8">{stat.rate.toFixed(1)}%</tspan>
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
        <CardTitle className={isCompact ? "text-lg" : ""}>Pressure Analysis Map</CardTitle>
        <CardDescription className={isCompact ? "text-[10px]" : ""}>
          구역별 압박 횟수 및 성공률 (인쇄 시에도 나란히 배치)
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
