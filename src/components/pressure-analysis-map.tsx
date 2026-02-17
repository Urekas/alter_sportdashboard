
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Team } from "@/lib/types";

interface PressureAnalysisMapProps {
  homeTeam: Team;
  awayTeam: Team;
  homeStats: any[]; 
  awayStats: any[]; 
  isTournament: boolean;
  homeMatchCount: number;
  awayMatchCount: number; 
  awayTitle?: string;
}

const zoneMapping = [
  { zone: 'D', subZone: 'L', x: 5, y: 42.5 }, { zone: 'D', subZone: 'C', x: 5, y: 25 }, { zone: 'D', subZone: 'R', x: 5, y: 7.5 },
  { zone: 'M', subZone: 'L', x: 27.5, y: 42.5 }, { zone: 'M', subZone: 'C', x: 27.5, y: 25 }, { zone: 'M', subZone: 'R', x: 27.5, y: 7.5 },
  { zone: 'A', subZone: 'L', x: 50, y: 42.5 }, { zone: 'A', subZone: 'C', x: 50, y: 25 }, { zone: 'A', subZone: 'R', x: 50, y: 7.5 },
];

const formatNum = (val: number, isTournament: boolean, matchCount: number) => {
  if (matchCount === 0) return "0";
  return isTournament ? (val / matchCount).toFixed(1) : Math.round(val).toString();
};

const TeamPressureDisplay = (
    { title, team, stats, isTournament, matchCount, isHome }: 
    { title: string, team: Team, stats: any[], isTournament: boolean, matchCount: number, isHome: boolean }
) => {
    if (!stats || stats.length === 0) {
      return (
        <div>
          <h3 className="font-bold text-lg" style={{color: team.color}}>{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">데이터가 없습니다.</p>
        </div>
      );
    }
    const totalAttempts = stats.reduce((sum, z) => sum + z.count, 0);
    const totalSuccesses = stats.reduce((sum, z) => sum + z.success, 0);
    const globalMaxCount = Math.max(...stats.map(z => z.count), 0) || 1;
    const maxCountForScaling = isTournament && matchCount > 0 ? globalMaxCount / matchCount : globalMaxCount;

    return (
        <div>
            <h3 className="font-bold text-lg" style={{color: team.color}}>{title}</h3>
            <CardDescription className="mt-1">
                총 압박 시도: <span className="font-bold text-primary">{formatNum(totalAttempts, isTournament, matchCount)}</span>회,
                총 압박 성공: <span className="font-bold text-emerald-600">{formatNum(totalSuccesses, isTournament, matchCount)}</span>회
                {isTournament && " (경기당 평균)"}
            </CardDescription>
            <div className="relative mt-2 aspect-[45.7/55] bg-green-50/50 rounded-lg overflow-hidden border border-muted shadow-inner">
                <svg viewBox="0 0 45.7 55" className="w-full h-full overflow-visible">
                    <defs>
                        <linearGradient id={`${team.name.replace(/\s+/g, '')}-successGradient`} x1="0" x2="1" y1="0" y2="0">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.1" />
                        </linearGradient>
                        <linearGradient id={`${team.name.replace(/\s+/g, '')}-attemptGradient`} x1="0" x2="1" y1="0" y2="0">
                            <stop offset="0%" stopColor={team.color || '#000000'} />
                            <stop offset="100%" stopColor={team.color || '#000000'} stopOpacity="0.1" />
                        </linearGradient>
                    </defs>

                    {/* 피치 라인 아트 */}
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

                    {stats.map((zone, i) => {
                        if (!zoneMapping[i]) return null;

                        const avgCount = isTournament && matchCount > 0 ? zone.count / matchCount : zone.count;
                        const maxAvgCount = maxCountForScaling > 0 ? maxCountForScaling : 1;
                        
                        const successRate = zone.count > 0 ? (zone.success / zone.count) : 0;
                        const attemptWidth = (avgCount / maxAvgCount) * 18;
                        const successWidth = attemptWidth * successRate;
                        
                        return (
                            <g key={i} transform={`translate(${zoneMapping[i].x}, ${zoneMapping[i].y})`}>
                                <rect y="-3" width={attemptWidth} height="3" fill={`url(#${team.name.replace(/\s+/g, '')}-attemptGradient)`} />
                                <rect y="-0.5" width={successWidth} height="3" fill={`url(#${team.name.replace(/\s+/g, '')}-successGradient)`} />
                                <text y="3" fontSize="2.5" fill="#374151" fontWeight="bold">
                                    {zoneMapping[i].zone}{zoneMapping[i].subZone}: S {formatNum(zone.success, isTournament, matchCount)} / A {formatNum(zone.count, isTournament, matchCount)}
                                </text>
                            </g>
                        );
                    })}
                </svg>
            </div>
        </div>
    );
}

export function PressureAnalysisMap({ homeTeam, awayTeam, homeStats, awayStats, isTournament, homeMatchCount, awayMatchCount, awayTitle }: PressureAnalysisMapProps) {
  return (
    <Card>
        <CardHeader>
            <CardTitle>구역별 압박 분석</CardTitle>
            <CardDescription>
              {isTournament ? '선택팀과 대회 전체의 경기당 평균 압박 데이터 비교' : '홈 팀과 어웨이 팀의 압박 데이터'}
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <TeamPressureDisplay 
                title={`${homeTeam.name} 압박`}
                team={homeTeam} 
                stats={homeStats} 
                isTournament={isTournament} 
                matchCount={homeMatchCount} 
                isHome={true}
            />
            <div className="border-t border-dashed" />
            <TeamPressureDisplay 
                title={awayTitle || `${awayTeam.name} 압박`}
                team={awayTeam} 
                stats={awayStats} 
                isTournament={isTournament} 
                matchCount={awayMatchCount} 
                isHome={false}
            />
        </CardContent>
    </Card>
  );
}
