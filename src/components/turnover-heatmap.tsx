"use client"

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { TurnoverEvent, Team } from "@/lib/types";

const PITCH_LENGTH = 91.4;
const PITCH_WIDTH = 55;
const CIRCLE_RADIUS = 14.63;
const PENALTY_SPOT_DIST = 6.4;
const LINE_23M = 22.9;

const BANDS = [0, LINE_23M, PITCH_LENGTH / 2, PITCH_LENGTH - LINE_23M, PITCH_LENGTH];
const LANES = [0, PITCH_WIDTH / 3, (PITCH_WIDTH / 3) * 2, PITCH_WIDTH];

const HorizontalPitchWithHeatmap: React.FC<{ turnovers: TurnoverEvent[], homeTeam: Team, awayTeam: Team }> = ({ turnovers, homeTeam, awayTeam }) => {

  const { counts, maxCount } = useMemo(() => {
    const counts: number[][] = Array(BANDS.length - 1).fill(0).map(() => Array(LANES.length - 1).fill(0));
    
    turnovers.forEach(turnover => {
      let { x, y } = turnover;
      // Standardize coordinates: all turnovers are mapped as if attacking from left to right.
      // If the turnover was by the away team (who we assume attacks right to left), we flip the coordinates.
      if (turnover.team === awayTeam.name) {
        x = PITCH_LENGTH - x;
        y = PITCH_WIDTH - y;
      }

      const bandIndex = BANDS.findIndex(band => x <= band) - 1;
      const laneIndex = LANES.findIndex(lane => y <= lane) - 1;
      
      if (bandIndex >= 0 && laneIndex >= 0 && bandIndex < counts.length && laneIndex < counts[0].length) {
        counts[bandIndex][laneIndex]++;
      }
    });

    const maxCount = Math.max(...counts.flat(), 1);
    return { counts, maxCount };
  }, [turnovers, awayTeam.name]);

  return (
    <div className="w-full aspect-[91.4/55] bg-green-700 relative border-border rounded-lg overflow-hidden">
      <svg 
        viewBox={`-2 -2 ${PITCH_LENGTH + 4} ${PITCH_WIDTH + 4}`}
        className="w-full h-full"
        style={{ backgroundColor: "hsl(120, 39%, 41%)" }}
      >
        {/* Heatmap Rectangles */}
        <g>
          {counts.map((band, i) =>
            band.map((count, j) => {
              if (count > 0) {
                const intensity = 0.15 + 0.8 * (count / maxCount);
                const fill = `rgba(220, 38, 38, ${intensity})`;
                return (
                  <rect
                    key={`rect-${i}-${j}`}
                    x={BANDS[i]}
                    y={LANES[j]}
                    width={BANDS[i+1] - BANDS[i]}
                    height={LANES[j+1] - LANES[j]}
                    fill={fill}
                  />
                );
              }
              return null;
            })
          )}
        </g>
        
        {/* Pitch Markings */}
        <g stroke="hsl(0, 0%, 100%, 0.7)" strokeWidth={0.3} fill="none">
          <rect x="0" y="0" width={PITCH_LENGTH} height={PITCH_WIDTH} />
          <line x1={PITCH_LENGTH / 2} y1="0" x2={PITCH_LENGTH / 2} y2={PITCH_WIDTH} />
          <line x1={LINE_23M} y1="0" x2={LINE_23M} y2={PITCH_WIDTH} />
          <line x1={PITCH_LENGTH - LINE_23M} y1="0" x2={PITCH_LENGTH - LINE_23M} y2={PITCH_WIDTH} />
          
          <path d={`M ${CIRCLE_RADIUS},${(PITCH_WIDTH/2) - CIRCLE_RADIUS} A ${CIRCLE_RADIUS},${CIRCLE_RADIUS} 0 0,0 ${CIRCLE_RADIUS},${(PITCH_WIDTH/2) + CIRCLE_RADIUS}`} />
          <path d={`M ${PITCH_LENGTH - CIRCLE_RADIUS},${(PITCH_WIDTH/2) - CIRCLE_RADIUS} A ${CIRCLE_RADIUS},${CIRCLE_RADIUS} 0 0,1 ${PITCH_LENGTH - CIRCLE_RADIUS},${(PITCH_WIDTH/2) + CIRCLE_RADIUS}`} />
          
          <circle cx={PENALTY_SPOT_DIST} cy={PITCH_WIDTH / 2} r={0.3} fill="white" stroke="none" />
          <circle cx={PITCH_LENGTH - PENALTY_SPOT_DIST} cy={PITCH_WIDTH / 2} r={0.3} fill="white" stroke="none" />
        </g>
        
        {/* Text Counts */}
        <g>
          {counts.map((band, i) =>
            band.map((count, j) => {
              if (count > 0) {
                return (
                  <text
                    key={`text-${i}-${j}`}
                    x={(BANDS[i] + BANDS[i+1]) / 2}
                    y={(LANES[j] + LANES[j+1]) / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="2.5"
                    fontWeight="bold"
                    stroke="black"
                    strokeWidth="0.1"
                  >
                    {count}
                  </text>
                );
              }
              return null;
            })
          )}
        </g>
      </svg>
    </div>
  );
};

export function TurnoverHeatmap({ turnovers, homeTeam, awayTeam }: { turnovers: TurnoverEvent[], homeTeam: Team, awayTeam: Team }) {
  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle>Turnover Heatmap</CardTitle>
        <CardDescription>Frequency of turnovers across pitch zones. All data is standardized to a left-to-right attack direction.</CardDescription>
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