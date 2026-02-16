
"use client"

import React, { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { mapZone } from "@/lib/parser"

interface PressureAnalysisMapProps {
  events: any[]
  homeTeam: { name: string; color: string }
  awayTeam: { name: string; color: string }
  awayHeader?: string
  matchCount?: number
}

interface ZoneStat {
  attempt: number
  success: number
  rate: number
}

export function PressureAnalysisMap({ events, homeTeam, awayTeam, awayHeader, matchCount = 1 }: PressureAnalysisMapProps) {
  const calculatePressureStats = (target: string, opponent: string) => {
    const stats: Record<string, ZoneStat> = {
      "25L": { attempt: 0, success: 0, rate: 0 },
      "25C": { attempt: 0, success: 0, rate: 0 },
      "25R": { attempt: 0, success: 0, rate: 0 },
      "50L": { attempt: 0, success: 0, rate: 0 },
      "50C": { attempt: 0, success: 0, rate: 0 },
      "50R": { attempt: 0, success: 0, rate: 0 },
    };

    const getEvents = (team: string, type: string, zone: number, lane: string) => {
      return events.filter(e => {
        const z = mapZone(e.locationLabel || e.code);
        return e.team === team && e.type === type && z.zoneBand === zone && z.lane === lane;
      }).length;
    };

    // 안정적인 이전 매핑 방식 복구
    const zones = [
      { id: "25L", zone: 100, lane: "Left", myFoulZone: 25, myFoulLane: "Left" },
      { id: "25C", zone: 100, lane: "Center", myFoulZone: 25, myFoulLane: "Center" },
      { id: "25R", zone: 100, lane: "Right", myFoulZone: 25, myFoulLane: "Right" },
      { id: "50L", zone: 75, lane: "Left", myFoulZone: 50, myFoulLane: "Left" },
      { id: "50C", zone: 75, lane: "Center", myFoulZone: 50, myFoulLane: "Center" },
      { id: "50R", zone: 75, lane: "Right", myFoulZone: 50, myFoulLane: "Right" },
    ];

    zones.forEach(z => {
      const oppTO = getEvents(opponent, "turnover", z.zone, z.lane);
      const oppFoul = getEvents(opponent, "foul", z.zone, z.lane);
      const myFoul = getEvents(target, "foul", z.myFoulZone, z.myFoulLane);

      stats[z.id].attempt = oppTO + oppFoul + myFoul;
      stats[z.id].success = oppTO + oppFoul;
      stats[z.id].rate = stats[z.id].attempt > 0 ? Math.round((stats[z.id].success / stats[z.id].attempt) * 100) : 0;
      
      // 평균치 계산
      stats[z.id].attempt = parseFloat((stats[z.id].attempt / matchCount).toFixed(1));
      stats[z.id].success = parseFloat((stats[z.id].success / matchCount).toFixed(1));
    });

    return stats;
  };

  const homeStats = useMemo(() => calculatePressureStats(homeTeam.name, awayTeam.name), [events, homeTeam, awayTeam, matchCount]);
  const awayStats = useMemo(() => calculatePressureStats(awayTeam.name, homeTeam.name), [events, homeTeam, awayTeam, matchCount]);

  const renderPitch = (teamStats: Record<string, ZoneStat>, teamName: string, color: string) => (
    <div className="flex flex-col items-center">
      <h3 className="text-sm font-bold mb-2 uppercase tracking-tight" style={{ color }}>{teamName} 압박 효율</h3>
      <div className="relative w-full max-w-sm aspect-[50/35] bg-emerald-800/10 border-2 border-emerald-900/20 rounded-lg overflow-hidden flex">
        {/* 25y Zone */}
        <div className="w-1/2 h-full border-r border-dashed border-emerald-900/30 grid grid-rows-3">
          {["25L", "25C", "25R"].map(zone => (
            <div key={zone} className="border-b last:border-b-0 border-emerald-900/10 flex flex-col items-center justify-center p-1 text-[10px]">
              <span className="font-bold opacity-40">{zone}</span>
              <div className="flex flex-col items-center leading-tight">
                <span className="font-black text-primary">{teamStats[zone].attempt} <span className="text-[8px] font-normal opacity-60">시도</span></span>
                <span className="font-black text-emerald-600">{teamStats[zone].success} <span className="text-[8px] font-normal opacity-60">성공</span></span>
                <span className="mt-1 px-2 py-0.5 bg-primary/10 rounded-full font-bold text-primary">{teamStats[zone].rate}%</span>
              </div>
            </div>
          ))}
        </div>
        {/* 50y Zone */}
        <div className="w-1/2 h-full grid grid-rows-3">
          {["50L", "50C", "50R"].map(zone => (
            <div key={zone} className="border-b last:border-b-0 border-emerald-900/10 flex flex-col items-center justify-center p-1 text-[10px]">
              <span className="font-bold opacity-40">{zone}</span>
              <div className="flex flex-col items-center leading-tight">
                <span className="font-black text-primary">{teamStats[zone].attempt} <span className="text-[8px] font-normal opacity-60">시도</span></span>
                <span className="font-black text-emerald-600">{teamStats[zone].success} <span className="text-[8px] font-normal opacity-60">성공</span></span>
                <span className="mt-1 px-2 py-0.5 bg-primary/10 rounded-full font-bold text-primary">{teamStats[zone].rate}%</span>
              </div>
            </div>
          ))}
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 font-black text-4xl italic">PRESS</div>
      </div>
      <div className="mt-2 text-[10px] font-bold text-muted-foreground uppercase flex gap-4">
        <span>TOP: L (Left)</span>
        <span>BOTTOM: R (Right)</span>
      </div>
    </div>
  );

  return (
    <Card className="border-2">
      <CardHeader className="pb-2">
        <CardTitle>Pressure Analysis Map (압박 분석 지도)</CardTitle>
        <CardDescription className="text-xs">
          시도: (상대 실책 @75,100) + (본인 파울 @25,50) | 성공: 시도 - 본인 파울
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
        {renderPitch(homeStats, homeTeam.name, homeTeam.color)}
        {renderPitch(awayStats, awayHeader || awayTeam.name, awayTeam.color)}
      </CardContent>
    </Card>
  )
}
