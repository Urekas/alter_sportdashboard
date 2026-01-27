"use client"

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { TurnoverEvent, Team } from "@/lib/types";

const PITCH_LENGTH = 91.4;
const PITCH_WIDTH = 55;
const LINE_23M = 22.9;

// Define zones for the heatmap
const BANDS = [0, LINE_23M, PITCH_LENGTH / 2, PITCH_LENGTH - LINE_23M, PITCH_LENGTH];
const LANES = [0, PITCH_WIDTH / 3, (PITCH_WIDTH / 3) * 2, PITCH_WIDTH];

const HorizontalPitchWithHeatmap: React.FC<{ turnovers: TurnoverEvent[], homeTeam: Team, awayTeam: Team }> = ({ turnovers, homeTeam, awayTeam }) => {

  const { zoneStats, maxAbsDiff } = useMemo(() => {
    // Initialize grids for home and away turnovers
    const homeCounts: number[][] = Array(BANDS.length - 1).fill(0).map(() => Array(LANES.length - 1).fill(0));
    const awayCounts: number[][] = Array(BANDS.length - 1).fill(0).map(() => Array(LANES.length - 1).fill(0));
    
    turnovers.forEach(turnover => {
      // Standardize coordinates: all turnovers are mapped as if attacking from left to right.
      const isHomeTeamEvent = turnover.team === homeTeam.name;
      const x = isHomeTeamEvent ? turnover.x : PITCH_LENGTH - turnover.x;
      const y = isHomeTeamEvent ? turnover.y : PITCH_WIDTH - turnover.y;

      const bandIndex = BANDS.findIndex(band => x <= band) - 1;
      const laneIndex = LANES.findIndex(lane => y <= lane) - 1;
      
      if (bandIndex >= 0 && laneIndex >= 0 && bandIndex < homeCounts.length && laneIndex < homeCounts[0].length) {
        if (isHomeTeamEvent) {
            homeCounts[bandIndex][laneIndex]++;
        } else {
            awayCounts[bandIndex][laneIndex]++;
        }
      }
    });

    const zoneStats: { i: number, j: number, home: number, away: number, diff: number }[] = [];
    let maxAbsDiff = 0;

    for(let i=0; i < BANDS.length - 1; i++) {
        for(let j=0; j < LANES.length - 1; j++) {
            const home = homeCounts[i][j];
            const away = awayCounts[i][j];
            if(home > 0 || away > 0) {
                const diff = home - away;
                if (Math.abs(diff) > maxAbsDiff) {
                    maxAbsDiff = Math.abs(diff);
                }
                zoneStats.push({ i, j, home, away, diff });
            }
        }
    }
    
    return { zoneStats, maxAbsDiff: Math.max(1, maxAbsDiff) };
  }, [turnovers, homeTeam, awayTeam]);

  return (
    <div className="w-full aspect-[91.4/55] bg-green-700 relative border-border rounded-lg overflow-hidden">
      <svg 
        viewBox={`-2 -2 ${PITCH_LENGTH + 4} ${PITCH_WIDTH + 4}`}
        className="w-full h-full"
        style={{ backgroundColor: "hsl(120, 39%, 41%)" }}
      >
        {/* Heatmap Rectangles */}
        <g>
          {zoneStats.map(({ i, j, diff }) => {
              const intensity = Math.abs(diff) / maxAbsDiff;
              // Home team (blue) is positive diff, Away team (red) is negative diff
              const color = diff > 0 
                  ? `rgba(59, 130, 246, ${0.15 + 0.8 * intensity})` // Blue for Home
                  : `rgba(239, 68, 68, ${0.15 + 0.8 * intensity})`;  // Red for Away
              
              return (
                <rect
                  key={`rect-${i}-${j}`}
                  x={BANDS[i]}
                  y={LANES[j]}
                  width={BANDS[i+1] - BANDS[i]}
                  height={LANES[j+1] - LANES[j]}
                  fill={color}
                />
              );
          })}
        </g>
        
        {/* Pitch Markings */}
        <g stroke="hsl(0, 0%, 100%, 0.7)" strokeWidth={0.3} fill="none">
          <rect x="0" y="0" width={PITCH_LENGTH} height={PITCH_WIDTH} />
          <line x1={PITCH_LENGTH / 2} y1="0" x2={PITCH_LENGTH / 2} y2={PITCH_WIDTH} />
          <line x1={LINE_23M} y1="0" x2={LINE_23M} y2={PITCH_WIDTH} />
          <line x1={PITCH_LENGTH - LINE_23M} y1="0" x2={PITCH_LENGTH - LINE_23M} y2={PITCH_WIDTH} />
          
          {/* Circles using path `A` command for arc */}
          <path d={`M 0,${(PITCH_WIDTH/2) - 14.63} A 14.63,14.63 0 0,1 14.63,${PITCH_WIDTH/2} A 14.63,14.63 0 0,1 0,${(PITCH_WIDTH/2) + 14.63}`} />
          <path d={`M ${PITCH_LENGTH},${(PITCH_WIDTH/2) - 14.63} A 14.63,14.63 0 0,0 ${PITCH_LENGTH - 14.63},${PITCH_WIDTH/2} A 14.63,14.63 0 0,0 ${PITCH_LENGTH},${(PITCH_WIDTH/2) + 14.63}`} />

          <circle cx={6.4} cy={PITCH_WIDTH / 2} r={0.3} fill="white" stroke="none" />
          <circle cx={PITCH_LENGTH - 6.4} cy={PITCH_WIDTH / 2} r={0.3} fill="white" stroke="none" />
        </g>
        
        {/* Text Counts */}
        <g>
          {zoneStats.map(({ i, j, home, away }) => {
              return (
                <text
                  key={`text-${i}-${j}`}
                  x={(BANDS[i] + BANDS[i+1]) / 2}
                  y={(LANES[j] + LANES[j+1]) / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize="2"
                  fontWeight="bold"
                  stroke="black"
                  strokeWidth="0.1"
                >
                  <tspan fill="lightblue" dx="-2.5">{home}</tspan>
                  <tspan fill="white"> | </tspan>
                  <tspan fill="lightcoral" dx="0.5">{away}</tspan>
                </text>
              );
          })}
        </g>
      </svg>
      <div className="absolute bottom-2 left-2 bg-card/80 p-2 rounded text-xs flex gap-4 backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{backgroundColor: 'lightblue'}}></div>
          <span>{homeTeam.name} Turnovers</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{backgroundColor: 'lightcoral'}}></div>
          <span>{awayTeam.name} Turnovers</span>
        </div>
      </div>
    </div>
  );
};

export function TurnoverHeatmap({ turnovers, homeTeam, awayTeam }: { turnovers: TurnoverEvent[], homeTeam: Team, awayTeam: Team }) {
  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle>Turnover Dominance Heatmap</CardTitle>
        <CardDescription>Comparison of turnovers conceded by zone. Colors indicate which team lost possession more in an area. (Standardized L-R attack)</CardDescription>
      </CardHeader>
      <CardContent className="p-2 sm:p-4 md:p-6">
        <HorizontalPitchWithHeatmap 
          turnovers={turnovers} 
          homeTeam={homeTeam} 
          awayTeam={awayTeam} 
        />
      </CardContent>
    </Card>
  );
}

    