import React, { useMemo } from 'react';
import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, Legend } from 'recharts';

interface RadarDataPoint {
  subject: string;
  [teamName: string]: number | string;
  fullMark: number;
}

interface TournamentRadarChartProps {
  type: 'overall' | 'attack' | 'defense';
  title: string;
  currentTeam: string;
  opponentTeam: string; // usually '대회 전체 평균'
  currentTeamColor: string;
  opponentColor: string;
  allTeamsStats: any[]; // Array of { name, stats }
  globalAvg: any; // { goals, shots, ... }
  mockMatchHomeStats: any; // The selected team's aggregated stats
}

export function TournamentRadarChart({
  type,
  title,
  currentTeam,
  opponentTeam,
  currentTeamColor,
  opponentColor,
  allTeamsStats,
  globalAvg,
  mockMatchHomeStats
}: TournamentRadarChartProps) {

  const metricsConfig = useMemo(() => {
    switch(type) {
      case 'overall':
        return ['득점', '슈팅', '서클진입', '서클허용', 'SPP', 'CE 1회당 시간'];
      case 'attack':
        return ['득점', '슈팅', '서클진입', '25Yd 진입', 'PC 획득', '공격 점유율'];
      case 'defense':
        return ['실점 억제', '위협 허용 억제', '서클 방어', '상대 점유 억제', '압박 강도(SPP)', '압박 성공률'];
    }
  }, [type]);

  const rawValueExtractors: Record<string, (stats: any) => number> = {
    '득점': (s) => (s.goals?.field || 0) + (s.goals?.pc || 0),
    '슈팅': (s) => s.shots || 0,
    '서클진입': (s) => s.circleEntries || 0,
    '서클허용': (s) => s.allowedCircleEntries || 0,
    'SPP': (s) => s.spp || 0,
    'CE 1회당 시간': (s) => s.timePerCE || 0,
    '25Yd 진입': (s) => s.twentyFiveEntries || 0,
    'PC 획득': (s) => s.pcs || 0,
    '공격 점유율': (s) => s.attackPossession || 0,
    '실점 억제': (s) => s.goalsAllowed || 0, // logic handles 'lower is better'
    '위협 허용 억제': (s) => s.allowedThreat || 0,
    '서클 방어': (s) => s.allowedCircleEntries || 0,
    '상대 점유 억제': (s) => s.allowedPossession || 0,
    '압박 강도(SPP)': (s) => s.spp || 0,
    '압박 성공률': (s) => s.pressAttempts ? (s.pressSuccess / s.pressAttempts) * 100 : 0, // higher is better
  };

  const isLowerBetter = (metric: string) => {
    return ['서클허용', 'SPP', 'CE 1회당 시간', '실점 억제', '위협 허용 억제', '서클 방어', '상대 점유 억제', '압박 강도(SPP)'].includes(metric);
  };

  // 1. Calculate min/max for each metric to normalize the axes
  const metricBounds = useMemo(() => {
    const bounds: Record<string, { min: number, max: number }> = {};
    metricsConfig.forEach(m => { bounds[m] = { min: 0, max: 0.1 }; });

    allTeamsStats.forEach(t => {
      metricsConfig.forEach(m => {
        const val = rawValueExtractors[m](t.stats);
        bounds[m].max = Math.max(bounds[m].max, val);
      });
    });

    return bounds;
  }, [allTeamsStats, metricsConfig]);

  // 2. Prepare the data for the Radar chart
  const data: RadarDataPoint[] = useMemo(() => {
    return metricsConfig.map(metric => {
      const rawCurrent = rawValueExtractors[metric](mockMatchHomeStats);
      const rawOpponent = rawValueExtractors[metric](globalAvg);
      const maxVal = metricBounds[metric].max;
      
      let normCurrent = maxVal ? (rawCurrent / maxVal) * 100 : 0;
      let normOpponent = maxVal ? (rawOpponent / maxVal) * 100 : 0;

      if (isLowerBetter(metric)) {
        // Invert so that a smaller raw value gives a larger normalized (plotted) shape
        normCurrent = 100 - normCurrent;
        normOpponent = 100 - normOpponent;
        normCurrent = Math.max(0, normCurrent);
        normOpponent = Math.max(0, normOpponent);
      }

      return {
        subject: metric,
        [currentTeam]: normCurrent,
        [opponentTeam]: normOpponent,
        [`${currentTeam}_raw`]: Number(rawCurrent.toFixed(1)),
        [`${opponentTeam}_raw`]: Number(rawOpponent.toFixed(1)),
        fullMark: 100
      };
    });
  }, [currentTeam, opponentTeam, mockMatchHomeStats, globalAvg, metricBounds, metricsConfig]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/95 border shadow-lg rounded-lg p-3 text-xs">
          <p className="font-bold mb-2 border-b pb-1">{payload[0].payload.subject}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex justify-between gap-4 mb-1 border-b border-border/10 pb-1">
              <span className="font-bold" style={{ color: entry.color }}>{entry.name}</span>
              <span className="font-bold">{entry.payload[`${entry.name}_raw`]}</span>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground mt-2 text-right italic">* 원본 데이터 수치</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[450px] bg-card rounded-xl border border-border/50 flex flex-col items-center justify-center p-4">
      <h3 className="text-lg font-bold mb-4 text-primary">{title}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid strokeOpacity={0.5} />
          <PolarAngleAxis dataKey="subject" tick={{ fill: 'currentColor', fontSize: 12, fontWeight: 'bold' }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
          
          <Radar 
            name={opponentTeam} 
            dataKey={opponentTeam} 
            stroke={opponentColor} 
            fill={opponentColor} 
            fillOpacity={0.3} 
          />
          <Radar 
            name={currentTeam} 
            dataKey={currentTeam} 
            stroke={currentTeamColor} 
            fill={currentTeamColor} 
            fillOpacity={0.6} 
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
