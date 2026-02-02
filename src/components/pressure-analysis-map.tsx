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

export function PressureAnalysisMap({ events, homeTeam, awayTeam }: PressureAnalysisMapProps) {
  const stats = useMemo(() => {
    // Home 압박 (상대 진형: x > 45.7)
    const homeAttackingEvents = events.filter(e => e.x > MID_X);
    const homePressCount = homeAttackingEvents.length;
    // 성공: (상대 턴오버 + 상대 파울) - (나의 파울)
    const awayMistakes = homeAttackingEvents.filter(e => e.team === awayTeam.name).length; // 상대가 턴오버나 파울 범함
    const homeFouls = homeAttackingEvents.filter(e => e.team === homeTeam.name && e.type === 'foul').length;
    const homeSuccess = Math.max(0, awayMistakes - homeFouls);
    const homeRate = homePressCount > 0 ? Math.round((homeSuccess / homePressCount) * 100) : 0;

    // Away 압박 (상대 진형: x < 45.7)
    const awayAttackingEvents = events.filter(e => e.x < MID_X);
    const awayPressCount = awayAttackingEvents.length;
    const homeMistakes = awayAttackingEvents.filter(e => e.team === homeTeam.name).length;
    const awayFouls = awayAttackingEvents.filter(e => e.team === awayTeam.name && e.type === 'foul').length;
    const awaySuccess = Math.max(0, homeMistakes - awayFouls);
    const awayRate = awayPressCount > 0 ? Math.round((awaySuccess / awayPressCount) * 100) : 0;

    return {
      home: { count: homePressCount, success: homeSuccess, rate: homeRate },
      away: { count: awayPressCount, success: awaySuccess, rate: awayRate }
    };
  }, [events, homeTeam, awayTeam]);

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle>Pressure Analysis Map</CardTitle>
        <CardDescription>
          상대 진영에서의 압박 횟수 및 성공 분석 (성공 = 상대 실책 - 나의 공격 파울)
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Away Team Pressure in Home's territory (Left Side) */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <h3 className="text-lg font-bold" style={{ color: awayTeam.color }}>{awayTeam.name} Pressing</h3>
                <p className="text-sm text-muted-foreground">In Opponent's Half</p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold">{stats.away.rate}%</span>
                <p className="text-xs text-muted-foreground">Success Rate</p>
              </div>
            </div>
            <div className="relative aspect-[45.7/55] bg-muted/30 border-2 border-dashed rounded-lg flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <div className="text-center">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Press Events</p>
                        <p className="text-4xl font-black">{stats.away.count}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Success</p>
                        <p className="text-2xl font-bold text-green-600">{stats.away.success}</p>
                    </div>
                </div>
                {/* Visual Hint of Pitch */}
                <svg viewBox="0 0 45.7 55" className="absolute inset-0 opacity-10 pointer-events-none">
                    <rect x="0" y="0" width="45.7" height="55" fill="none" stroke="currentColor" strokeWidth="1" />
                    <path d="M 0,12.87 A 14.63,14.63 0 0,1 14.63,27.5 A 14.63,14.63 0 0,1 0,42.13" fill="none" stroke="currentColor" strokeWidth="1" />
                </svg>
            </div>
          </div>

          {/* Home Team Pressure in Away's territory (Right Side) */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <h3 className="text-lg font-bold" style={{ color: homeTeam.color }}>{homeTeam.name} Pressing</h3>
                <p className="text-sm text-muted-foreground">In Opponent's Half</p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold">{stats.home.rate}%</span>
                <p className="text-xs text-muted-foreground">Success Rate</p>
              </div>
            </div>
            <div className="relative aspect-[45.7/55] bg-muted/30 border-2 border-dashed rounded-lg flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <div className="text-center">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Press Events</p>
                        <p className="text-4xl font-black">{stats.home.count}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Success</p>
                        <p className="text-2xl font-bold text-blue-600">{stats.home.success}</p>
                    </div>
                </div>
                {/* Visual Hint of Pitch */}
                <svg viewBox="45.7 0 45.7 55" className="absolute inset-0 opacity-10 pointer-events-none">
                    <rect x="45.7" y="0" width="45.7" height="55" fill="none" stroke="currentColor" strokeWidth="1" />
                    <path d="M 91.4,12.87 A 14.63,14.63 0 0,0 76.77,27.5 A 14.63,14.63 0 0,0 91.4,42.13" fill="none" stroke="currentColor" strokeWidth="1" />
                </svg>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
