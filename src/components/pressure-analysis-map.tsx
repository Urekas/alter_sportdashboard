
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
    const calculateStats = (attackingEvents: MatchEvent[], teamName: string, opponentName: string, isHome: boolean) => {
      // 6구역 초기화: [25m-Left, 25m-Center, 25m-Right, 50m-Left, 50m-Center, 50m-Right]
      const zones: ZoneStat[] = Array(6).fill(null).map(() => ({ count: 0, success: 0, rate: 0 }));

      attackingEvents.forEach(e => {
        // 상대 골대 기준 거리 계산
        const distFromGoal = isHome ? (PITCH_LENGTH - e.x) : e.x;
        const xIdx = distFromGoal <= LINE_23M ? 0 : 1; // 0: 25m zone, 1: 50m zone
        
        // 레인 계산 (공격 방향 기준 좌/중/우)
        const y = isHome ? e.y : (PITCH_WIDTH - e.y);
        let yIdx = 0;
        if (y > PITCH_WIDTH * 0.66) yIdx = 2;
        else if (y > PITCH_WIDTH * 0.33) yIdx = 1;
        
        const zoneIdx = (xIdx * 3) + yIdx;

        if (zoneIdx >= 0 && zoneIdx < 6) {
          zones[zoneIdx].count++;
          
          const isOpponentMistake = e.team === opponentName;
          const isMyFoul = e.team === teamName && e.type === 'foul';
          
          if (isOpponentMistake) {
            zones[zoneIdx].success++;
          } else if (isMyFoul) {
            zones[zoneIdx].success--;
          }
        }
      });

      return zones.map(z => ({
        ...z,
        success: Math.max(0, z.success),
        rate: z.count > 0 ? Math.round((Math.max(0, z.success) / z.count) * 100) : 0
      }));
    };

    return {
      home: calculateStats(events.filter(e => e.x > MID_X), homeTeam.name, awayTeam.name, true),
      away: calculateStats(events.filter(e => e.x < MID_X), awayTeam.name, homeTeam.name, false)
    };
  }, [events, homeTeam, awayTeam]);

  const renderZoneGrid = (stats: ZoneStat[], team: Team, isRightSide: boolean) => {
    const zoneLabels = ["25L", "25C", "25R", "50L", "50C", "50R"];
    
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-center px-2 py-1 rounded bg-muted" style={{ color: team.color }}>
          {team.name} Attacking Half Pressure
        </h3>
        <div className="grid grid-cols-3 gap-1 relative aspect-[45.7/55] border-2 border-border rounded-lg overflow-hidden bg-muted/20">
          {/* 25m Zones (Upper in visual if Goal is top, but here x is horizontal) */}
          {/* We'll display them as a 2x3 grid: Top row is 25m, Bottom row is 50m */}
          {stats.map((stat, i) => (
            <div 
              key={i} 
              className="flex flex-col items-center justify-center p-1 border border-border/50 bg-background/50 relative group"
            >
              <span className="absolute top-1 left-1 text-[8px] font-bold text-muted-foreground opacity-50">
                {zoneLabels[i]}
              </span>
              <div className="text-center">
                <p className="text-lg font-black leading-none">{stat.rate}%</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {stat.success}/{stat.count}
                </p>
              </div>
              {/* Heatmap overlay based on success rate */}
              <div 
                className="absolute inset-0 pointer-events-none transition-opacity group-hover:opacity-40" 
                style={{ 
                  backgroundColor: team.color, 
                  opacity: stat.count > 0 ? (stat.rate / 200) : 0 
                }} 
              />
            </div>
          ))}
          
          {/* Pitch Lines Hint */}
          <svg className="absolute inset-0 pointer-events-none opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
             <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,2" />
             <line x1="33.3" y1="0" x2="33.3" y2="100" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,2" />
             <line x1="66.6" y1="0" x2="66.6" y2="100" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,2" />
          </svg>
        </div>
      </div>
    );
  };

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle>Detailed Pressure Map</CardTitle>
        <CardDescription>
          상대 진영을 6개 구역(25m/50m x 좌/중/우)으로 나누어 분석한 압박 지표입니다.
          <br />
          <span className="text-xs text-muted-foreground">성공률 = (상대 실책 - 나의 공격 파울) / 총 압박 이벤트</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {renderZoneGrid(zoneStats.away, awayTeam, false)}
          {renderZoneGrid(zoneStats.home, homeTeam, true)}
        </div>
        
        <div className="mt-6 flex flex-wrap justify-center gap-6 text-xs text-muted-foreground border-t pt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border border-dashed"></div>
            <span>25: 공격 25m 구역</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border border-dashed"></div>
            <span>50: 센터라인~25m 사이 구역</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border border-dashed"></div>
            <span>L/C/R: 좌측, 중앙, 우측 레인</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
