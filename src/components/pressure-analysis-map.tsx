
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

    // 홈팀 기준 공식 적용 (형님의 철칙)
    // 25L: 상대 TO 우_100 + 상대 파울 우_100 + 본인 파울 좌_25
    stats["25L"].attempt = getEvents(opponent, "turnover", 100, "Right") + getEvents(opponent, "foul", 100, "Right") + getEvents(target, "foul", 25, "Left");
    stats["25L"].success = stats["25L"].attempt - getEvents(target, "foul", 25, "Left");

    // 25C: 상대 TO 중_100 + 상대 파울 중_100 + 본인 파울 중_25
    stats["25C"].attempt = getEvents(opponent, "turnover", 100, "Center") + getEvents(opponent, "foul", 100, "Center") + getEvents(target, "foul", 25, "Center");
    stats["25C"].success = stats["25C"].attempt - getEvents(target, "foul", 25, "Center");

    // 25R: 상대 TO 좌_100 + 상대 파울 좌_100 + 본인 파울 우_25
    stats["25R"].attempt = getEvents(opponent, "turnover", 100, "Left") + getEvents(opponent, "foul", 100, "Left") + getEvents(target, "foul", 25, "Right");
    stats["25R"].success = stats["25R"].attempt - getEvents(target, "foul", 25, "Right");

    // 50L: 상대 TO 우_75 + 상대 파울 우_75 + 본인 파울 좌_50
    stats["50L"].attempt = getEvents(opponent, "turnover", 75, "Right") + getEvents(opponent, "foul", 75, "Right") + getEvents(target, "foul", 50, "Left");
    stats["50L"].success = stats["50L"].attempt - getEvents(target, "foul", 50, "Left");

    // 50C: 상대 TO 중_75 + 상대 파울 중_75 + 본인 파울 중_50
    stats["50C"].attempt = getEvents(opponent, "turnover", 75, "Center") + getEvents(opponent, "foul", 75, "Center") + getEvents(target, "foul", 50, "Center");
    stats["50C"].success = stats["50C"].attempt - getEvents(target, "foul", 50, "Center");

    // 50R: 상대 TO 좌_75 + 상대 파울 좌_75 + 본인 파울 우_50
    stats["50R"].attempt = getEvents(opponent, "turnover", 75, "Left") + getEvents(opponent, "foul", 75, "Left") + getEvents(target, "foul", 50, "Right");
    stats["50R"].success = stats["50R"].attempt - getEvents(target, "foul", 50, "Right");

    Object.keys(stats).forEach(k => {
      const s = stats[k];
      s.rate = s.attempt > 0 ? Math.round((s.success / s.attempt) * 100) : 0;
      // 평균치 계산
      s.attempt = parseFloat((s.attempt / matchCount).toFixed(1));
      s.success = parseFloat((s.success / matchCount).toFixed(1));
    });

    return stats;
  };

  const homeStats = useMemo(() => calculatePressureStats(homeTeam.name, awayTeam.name), [events, homeTeam, awayTeam, matchCount]);
  const awayStats = useMemo(() => calculatePressureStats(awayTeam.name, homeTeam.name), [events, homeTeam, awayTeam, matchCount]);

  const renderPitch = (teamStats: Record<string, ZoneStat>, teamName: string, color: string) => (
    <div className="flex flex-col items-center">
      <h3 className="text-sm font-bold mb-2 uppercase tracking-tight" style={{ color }}>{teamName} 압박 효율</h3>
      <div className="relative w-full max-w-sm aspect-[50/35] bg-emerald-800/10 border-2 border-emerald-900/20 rounded-lg overflow-hidden flex">
        {/* 25y Zone (Right Side of Map visually) */}
        <div className="w-1/2 h-full border-r border-dashed border-emerald-900/30 grid grid-rows-3">
          {["25R", "25C", "25L"].map(zone => (
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
        {/* 50y Zone (Left Side of Map visually) */}
        <div className="w-1/2 h-full grid grid-rows-3">
          {["50R", "50C", "50L"].map(zone => (
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
        <span>TOP: R (Right)</span>
        <span>BOTTOM: L (Left)</span>
      </div>
    </div>
  );

  return (
    <Card className="border-2">
      <CardHeader className="pb-2">
        <CardTitle>Pressure Analysis Map (압박 분석 지도)</CardTitle>
        <CardDescription className="text-xs">
          시도: (상대 턴오버/파울 @75,100) + (본인 파울 @25,50) | 성공: 시도 - 본인 파울
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
        {renderPitch(homeStats, homeTeam.name, homeTeam.color)}
        {renderPitch(awayStats, awayHeader || awayTeam.name, awayTeam.color)}
      </CardContent>
    </Card>
  )
}
