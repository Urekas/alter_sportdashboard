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
  // ViewBox centered around a 110-unit width to give some padding.
  // Proportions based on official FIH rules, scaled to fit the viewBox.
  // 1m = 2 units for easy scaling.
  const scale = (meters: number) => meters * 2;

  const viewBoxWidth = 110; // 55m width
  const viewBoxHeight = 70; // Enough for 23m area + goal
  const cx = viewBoxWidth / 2;

  // Position the goal line at the top
  const goalLineY = 20;

  const goalWidth = scale(3.66);
  const goalDepth = scale(1.2);
  const goalPostLeftX = cx - goalWidth / 2;
  const goalPostRightX = cx + goalWidth / 2;

  // The D is a semi-circle with a radius of 14.63m centered on the goal's midpoint.
  const dRadius = scale(14.63);
  // The sweep-flag is 0 to draw the arc downwards (into the pitch).
  const dPath = `M ${cx - dRadius},${goalLineY} A ${dRadius},${dRadius} 0 0 0 ${cx + dRadius},${goalLineY}`;
  
  // The broken circle is 5m outside the D.
  const brokenDRadius = scale(14.63 + 5);
  // The sweep-flag is 0 to draw the arc downwards.
  const brokenDPath = `M ${cx - brokenDRadius},${goalLineY} A ${brokenDRadius},${brokenDRadius} 0 0 0 ${cx + brokenDRadius},${goalLineY}`;

  // Penalty spot is 6.475m from the goal line.
  const penaltySpotY = goalLineY + scale(6.475);
  
  // Penalty corner markings are 5m and 10m from each goal post.
  const pcMark5m = scale(5);
  const pcMark10m = scale(10);
  const markHeight = scale(0.3); // 300mm long

  return (
    <svg viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} preserveAspectRatio="xMidYMin" className="w-full h-full">
      <g stroke="hsl(var(--foreground))" strokeWidth="1.5" fill="none">
        
        {/* Goal */}
        <rect x={goalPostLeftX} y={goalLineY - goalDepth} width={goalWidth} height={goalDepth} strokeWidth="1.5" />
        
        {/* Goal Line */}
        <line x1="0" y1={goalLineY} x2={viewBoxWidth} y2={goalLineY} strokeWidth="1.5" />
        
        {/* The D (Shooting Circle) */}
        <path d={dPath} strokeWidth="1.5" />
        
        {/* Dashed Circle (5m from D) */}
        <path d={brokenDPath} strokeDasharray="4,4" strokeWidth="1.5" />
        
        {/* Penalty Spot */}
        <circle cx={cx} cy={penaltySpotY} r="1" fill="hsl(var(--foreground))" stroke="none" />
        
        {/* Penalty Corner Markings */}
        {/* Left Side */}
        <line x1={goalPostLeftX - pcMark5m} y1={goalLineY} x2={goalPostLeftX - pcMark5m} y2={goalLineY + markHeight} />
        <line x1={goalPostLeftX - pcMark10m} y1={goalLineY} x2={goalPostLeftX - pcMark10m} y2={goalLineY + markHeight} />
        {/* Right Side */}
        <line x1={goalPostRightX + pcMark5m} y1={goalLineY} x2={goalPostRightX + pcMark5m} y2={goalLineY + markHeight} />
        <line x1={goalPostRightX + pcMark10m} y1={goalLineY} x2={goalPostRightX + pcMark10m} y2={goalLineY + markHeight} />
      </g>
    </svg>
  );
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
        <div className="relative w-full max-w-2xl aspect-[110/70]">
          <div className="absolute inset-0">
             <HockeyShootingCircle />
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-full h-full">

              {/* Data Overlay: Positioned relative to the parent container */}
              
              {/* Left Channel */}
              <div className="absolute bottom-[5%] left-[10%] flex flex-col items-center gap-1 text-foreground">
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
              <div className="absolute bottom-[5%] right-[10%] flex flex-col items-center gap-1 text-foreground">
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
