"use client"

import type { FC } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { TurnoverEvent, Team } from "@/lib/types"

const PITCH_LENGTH = 91.4;
const PITCH_WIDTH = 55;
const CIRCLE_RADIUS = 14.63;
const BROKEN_CIRCLE_RADIUS = CIRCLE_RADIUS + 5;
const PENALTY_SPOT_DIST = 6.4;
const LINE_23M = 22.9;

const HorizontalHockeyPitch: FC<{ events: TurnoverEvent[], homeTeam: Team, awayTeam: Team }> = ({ events, homeTeam, awayTeam }) => {
  return (
    <div className="w-full aspect-[91.4/55] bg-green-700 relative border-border rounded-lg overflow-hidden">
      <svg 
        viewBox={`-2 -2 ${PITCH_LENGTH + 4} ${PITCH_WIDTH + 4}`}
        className="w-full h-full"
        style={{ backgroundColor: "hsl(120, 39%, 41%)" }}
      >
        <g stroke="hsl(0, 0%, 100%, 0.8)" strokeWidth={0.3} fill="none">
          {/* Field boundaries */}
          <rect x="0" y="0" width={PITCH_LENGTH} height={PITCH_WIDTH} />
          <line x1={PITCH_LENGTH / 2} y1="0" x2={PITCH_LENGTH / 2} y2={PITCH_WIDTH} />
          <line x1={LINE_23M} y1="0" x2={LINE_23M} y2={PITCH_WIDTH} />
          <line x1={PITCH_LENGTH - LINE_23M} y1="0" x2={PITCH_LENGTH - LINE_23M} y2={PITCH_WIDTH} />
          
          {/* Left Circle (simplified semi-circle) */}
          <path d={`M ${CIRCLE_RADIUS},${(PITCH_WIDTH/2) - CIRCLE_RADIUS} A ${CIRCLE_RADIUS},${CIRCLE_RADIUS} 0 0,0 ${CIRCLE_RADIUS},${(PITCH_WIDTH/2) + CIRCLE_RADIUS}`} />
          <path d={`M ${BROKEN_CIRCLE_RADIUS},${(PITCH_WIDTH/2) - BROKEN_CIRCLE_RADIUS} A ${BROKEN_CIRCLE_RADIUS},${BROKEN_CIRCLE_RADIUS} 0 0,0 ${BROKEN_CIRCLE_RADIUS},${(PITCH_WIDTH/2) + BROKEN_CIRCLE_RADIUS}`} strokeDasharray="1,1"/>
          <circle cx={PENALTY_SPOT_DIST} cy={PITCH_WIDTH / 2} r={0.3} fill="white" stroke="none" />
          
          {/* Right Circle (simplified semi-circle) */}
          <path d={`M ${PITCH_LENGTH - CIRCLE_RADIUS},${(PITCH_WIDTH/2) - CIRCLE_RADIUS} A ${CIRCLE_RADIUS},${CIRCLE_RADIUS} 0 0,1 ${PITCH_LENGTH - CIRCLE_RADIUS},${(PITCH_WIDTH/2) + CIRCLE_RADIUS}`} />
          <path d={`M ${PITCH_LENGTH - BROKEN_CIRCLE_RADIUS},${(PITCH_WIDTH/2) - BROKEN_CIRCLE_RADIUS} A ${BROKEN_CIRCLE_RADIUS},${BROKEN_CIRCLE_RADIUS} 0 0,1 ${PITCH_LENGTH - BROKEN_CIRCLE_RADIUS},${(PITCH_WIDTH/2) + BROKEN_CIRCLE_RADIUS}`} strokeDasharray="1,1"/>
          <circle cx={PITCH_LENGTH - PENALTY_SPOT_DIST} cy={PITCH_WIDTH / 2} r={0.3} fill="white" stroke="none" />
        </g>
        
        {/* Data points */}
        <g>
          {events.map((evt) => (
            <circle
              key={evt.id}
              cx={evt.x}
              cy={evt.y}
              r={0.6}
              fill={evt.team === homeTeam.name ? homeTeam.color : awayTeam.color}
              stroke="white"
              strokeWidth={0.15}
              opacity={0.9}
            >
              <title>{`${evt.team} Turnover @ ${Math.round(evt.time / 60)}min`}</title>
            </circle>
          ))}
        </g>
      </svg>
      
      <div className="absolute bottom-2 left-2 bg-card/80 p-2 rounded text-xs flex gap-4 backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{backgroundColor: homeTeam.color}}></div>
          <span>{homeTeam.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{backgroundColor: awayTeam.color}}></div>
          <span>{awayTeam.name}</span>
        </div>
      </div>
    </div>
  )
}

export function TurnoverMap({ turnovers, homeTeam, awayTeam }: { turnovers: TurnoverEvent[], homeTeam: Team, awayTeam: Team }) {
  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle>Turnover Map</CardTitle>
        <CardDescription>Locations of turnovers conceded on the pitch.</CardDescription>
      </CardHeader>
      <CardContent className="p-2 sm:p-4 md:p-6">
        <HorizontalHockeyPitch 
          events={turnovers} 
          homeTeam={homeTeam} 
          awayTeam={awayTeam} 
        />
      </CardContent>
    </Card>
  )
}
