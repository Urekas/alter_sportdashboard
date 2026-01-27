"use client"

import type { FC } from "react"
import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { CircleEntry } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ArrowUp } from "lucide-react"

// A detailed, geometrically correct view of the attacking shooting circle.
// Based on official field hockey dimensions, scaled to a viewBox.
const HockeyShootingCircle: FC = () => {
  // ViewBox: 0 0 100 70. Goal is at the top. Attack is from bottom to top.
  // Field Dimensions to SVG unit mapping:
  // Field Width: 55m -> 90 units (5 to 95) -> 1m = 1.636 units
  // Goal Width: 3.66m -> 5.99 units
  // Circle Radius: 14.63m -> 23.94 units
  // Dashed Circle Radius: 19.63m -> 32.12 units
  // Penalty Spot Distance: 6.475m -> 10.6 units
  const goalWidth = 5.99;
  const rMain = 23.94;
  const rBroken = 32.12;
  const penaltySpotY = 10 + 10.6;
  const goalPostLeftX = 50 - goalWidth / 2;
  const goalPostRightX = 50 + goalWidth / 2;

  const dPath = [
    `M ${goalPostLeftX - rMain},10`, // Start of left arc on backline
    `A ${rMain},${rMain} 0 0 1 ${goalPostLeftX},${10 + rMain}`, // Left quadrant arc
    `L ${goalPostRightX},${10 + rMain}`, // Straight line part of the D
    `A ${rMain},${rMain} 0 0 1 ${goalPostRightX + rMain},10` // Right quadrant arc
  ].join(' ');

  const dashedDPath = [
    `M ${goalPostLeftX - rBroken},10`,
    `A ${rBroken},${rBroken} 0 0 1 ${goalPostLeftX},${10 + rBroken}`,
    `L ${goalPostRightX},${10 + rBroken}`,
    `A ${rBroken},${rBroken} 0 0 1 ${goalPostRightX + rBroken},10`
  ].join(' ');

  return (
    <svg viewBox="0 0 100 70" preserveAspectRatio="xMidYMin" className="w-full h-full">
      <g stroke="hsl(var(--foreground))" strokeWidth="0.8" fill="none">
        {/* Pitch Outline (Attacking 25m Area) */}
        <rect x="0" y="10" width="100" height="55" strokeWidth="0.5" />
        
        {/* Goal Line */}
        <line x1="0" y1="10" x2="100" y2="10" />

        {/* Goal */}
        <rect x={goalPostLeftX} y={8} width={goalWidth} height="2" strokeWidth="0.7" />

        {/* The D (Shooting Circle) */}
        <path d={dPath} />
        
        {/* Dashed Circle (5m from D) */}
        <path d={dashedDPath} strokeDasharray="3,3" />

        {/* Penalty Spot */}
        <circle cx="50" cy={penaltySpotY} r="0.75" fill="hsl(var(--foreground))" stroke="none" />
        
        {/* Penalty Corner Markings (5m and 10m from posts) */}
        {/* Left Side */}
        <line x1={goalPostLeftX - 8.18} y1="10" x2={goalPostLeftX - 8.18} y2="9" />
        <line x1={goalPostLeftX - 16.36} y1="10" x2={goalPostLeftX - 16.36} y2="9" />
        {/* Right Side */}
        <line x1={goalPostRightX + 8.18} y1="10" x2={goalPostRightX + 8.18} y2="9" />
        <line x1={goalPostRightX + 16.36} y1="10" x2={goalPostRightX + 16.36} y2="9" />
      </g>
    </svg>
  )
};


const StatDisplay: FC<{
  label: string;
  entries: number;
  success: number;
  efficiency: string;
  className?: string;
}> = ({ label, entries, success, efficiency, className }) => (
  <div className={cn("text-center", className)}>
    <h4 className="font-semibold text-lg">{label}</h4>
    <p className="text-sm">진입: {entries}회</p>
    <p className="text-sm">Success(슈팅/PC/득점): {success}회</p>
    <p className="text-base font-bold">효율: {efficiency}</p>
  </div>
);

interface CircleEntryAnalysisProps {
  entries: CircleEntry[]
}

export function CircleEntryAnalysis({ entries }: CircleEntryAnalysisProps) {
  const analysis = useMemo(() => {
    const channels = {
      Left: { entries: 0, success: 0 },
      Center: { entries: 0, success: 0 },
      Right: { entries: 0, success: 0 },
    }

    for (const entry of entries) {
      if (channels[entry.channel]) {
        channels[entry.channel].entries++
        if (entry.outcome !== "No Shot") {
          channels[entry.channel].success++
        }
      }
    }

    const calculateEfficiency = (success: number, entries: number) =>
      entries > 0 ? `${Math.round((success / entries) * 100)}%` : "0%"

    return {
      left: { ...channels.Left, efficiency: calculateEfficiency(channels.Left.success, channels.Left.entries) },
      center: { ...channels.Center, efficiency: calculateEfficiency(channels.Center.success, channels.Center.entries) },
      right: { ...channels.Right, efficiency: calculateEfficiency(channels.Right.success, channels.Right.entries) },
    }
  }, [entries])

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle>써클 진입 분석</CardTitle>
        <CardDescription>공격 채널별 진입 및 성공 효율</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center items-center p-2 sm:p-4 md:p-6">
        <div className="relative w-full max-w-lg aspect-[100/70]">
          <div className="absolute inset-0">
             <HockeyShootingCircle />
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-full h-full">

              {/* Left Channel */}
              <div className="absolute bottom-[10%] left-[5%] flex flex-col items-center gap-1 text-foreground">
                <ArrowUp className="w-16 h-16 sm:w-20 sm:h-20 text-accent opacity-80 transform -rotate-[50deg]" strokeWidth={3}/>
                 <StatDisplay
                  label="Left"
                  entries={analysis.left.entries}
                  success={analysis.left.success}
                  efficiency={analysis.left.efficiency}
                />
              </div>

              {/* Center Channel */}
              <div className="absolute bottom-[2%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-foreground">
                <ArrowUp className="w-16 h-16 sm:w-24 sm:h-24 text-accent opacity-80" strokeWidth={3}/>
                 <StatDisplay
                  label="Center"
                  entries={analysis.center.entries}
                  success={analysis.center.success}
                  efficiency={analysis.center.efficiency}
                />
              </div>

              {/* Right Channel */}
              <div className="absolute bottom-[10%] right-[5%] flex flex-col items-center gap-1 text-foreground">
                <ArrowUp className="w-16 h-16 sm:w-20 sm:h-20 text-accent opacity-80 transform rotate-[50deg]" strokeWidth={3} />
                <StatDisplay
                  label="Right"
                  entries={analysis.right.entries}
                  success={analysis.right.success}
                  efficiency={analysis.right.efficiency}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
