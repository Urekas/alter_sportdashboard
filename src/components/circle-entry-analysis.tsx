"use client"

import type { FC } from "react"
import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { CircleEntry } from "@/lib/types"
import { HockeyPitchSVG } from "./hockey-pitch-svg"

interface CircleEntryAnalysisProps {
  entries: CircleEntry[]
}

const StatDisplay: FC<{ label: string; value: string | number; subValue?: string | number, className?: string }> = ({ label, value, subValue, className }) => (
  <div className={`text-center text-white ${className}`}>
    <div className="text-2xl font-bold">{value}</div>
    <div className="text-xs uppercase tracking-wider font-semibold">{label}</div>
    {subValue && <div className="text-sm font-light">{subValue}</div>}
  </div>
)

export function CircleEntryAnalysis({ entries }: CircleEntryAnalysisProps) {
  const analysis = useMemo(() => {
    const channels = {
      Left: { entries: 0, shots: 0 },
      Center: { entries: 0, shots: 0 },
      Right: { entries: 0, shots: 0 },
    }

    for (const entry of entries) {
      channels[entry.channel].entries++
      if (entry.outcome !== "No Shot") {
        channels[entry.channel].shots++
      }
    }
    
    const calculateEfficiency = (shots: number, entries: number) =>
      entries > 0 ? ((shots / entries) * 100).toFixed(0) + "%" : "0%"

    return {
      left: { ...channels.Left, efficiency: calculateEfficiency(channels.Left.shots, channels.Left.entries) },
      center: { ...channels.Center, efficiency: calculateEfficiency(channels.Center.shots, channels.Center.entries) },
      right: { ...channels.Right, efficiency: calculateEfficiency(channels.Right.shots, channels.Right.entries) },
    }
  }, [entries])

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle>Circle Entry Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative w-full aspect-[1.8/1]">
          <HockeyPitchSVG showHalf="top" />
          <div className="absolute inset-0 flex justify-around items-center p-4">
            <StatDisplay
              label="Left Channel"
              value={analysis.left.efficiency}
              subValue={`${analysis.left.shots}/${analysis.left.entries} shots`}
              className="transform -translate-y-4"
            />
            <StatDisplay
              label="Center Channel"
              value={analysis.center.efficiency}
              subValue={`${analysis.center.shots}/${analysis.center.entries} shots`}
              className="transform translate-y-8"
            />
            <StatDisplay
              label="Right Channel"
              value={analysis.right.efficiency}
              subValue={`${analysis.right.shots}/${analysis.right.entries} shots`}
              className="transform -translate-y-4"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
