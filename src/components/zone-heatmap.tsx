"use client"

import React, { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { TurnoverEvent } from "@/lib/types"
import { HockeyPitchLandscapeSVG } from "./hockey-pitch-landscape-svg"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface ZoneHeatmapProps {
  turnovers: TurnoverEvent[]
  homeTeamName: string
}

// Corresponds to landscape pitch layout
const ZONES_X = 10; // Zones along the length
const ZONES_Y = 6; // Zones across the width

export function ZoneHeatmap({ turnovers, homeTeamName }: ZoneHeatmapProps) {
  const heatmapData = useMemo(() => {
    const grid = Array(ZONES_X * ZONES_Y)
      .fill(0)
      .map(() => ({ total: 0, home: 0, away: 0 }))

    // For landscape pitch: turnover.x is along pitch length (ZONES_X), turnover.y is along pitch width (ZONES_Y)
    turnovers.forEach((turnover) => {
      const x = Math.min(Math.floor(turnover.x / (100 / ZONES_X)), ZONES_X - 1)
      const y = Math.min(Math.floor(turnover.y / (100 / ZONES_Y)), ZONES_Y - 1)
      
      const index = y * ZONES_X + x;
      if(index >= 0 && index < grid.length) {
        grid[index].total++;
        if (turnover.team === homeTeamName) {
          grid[index].home++;
        } else {
          grid[index].away++;
        }
      }
    })

    const maxTurnovers = Math.max(...grid.map((cell) => cell.total), 1)

    return grid.map((cell) => ({
      ...cell,
      intensity: cell.total / maxTurnovers,
    }))
  }, [turnovers, homeTeamName])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Turnover Heatmap</CardTitle>
        <CardDescription>Frequency of turnovers across pitch zones.</CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="relative w-full aspect-video max-w-2xl mx-auto">
            <HockeyPitchLandscapeSVG />
            <div className="absolute inset-0 grid grid-cols-10 grid-rows-6">
              {heatmapData.map((cell, index) => (
                <Tooltip key={index} delayDuration={100}>
                  <TooltipTrigger asChild>
                    <div
                      className="border border-white/10 transition-colors hover:bg-white/20"
                      style={{
                        backgroundColor: `hsl(var(--accent) / ${cell.intensity * 0.9})`,
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total Turnovers: {cell.total}</p>
                    <p>{homeTeamName}: {cell.home}</p>
                    <p>Opponent: {cell.away}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
