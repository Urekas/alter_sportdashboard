"use client"

import type { FC } from "react"
import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { CircleEntry } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ArrowUp } from "lucide-react"

// A detailed view of the attacking shooting circle, based on user's specific geometric instructions.
const HockeyShootingCircle: FC = () => (
    <svg viewBox="0 0 100 65" preserveAspectRatio="xMidYMin" className="w-full h-full">
      <g stroke="hsl(var(--foreground))" strokeWidth="2" fill="none">
        {/* The D-shape: a line and a semi-circle arc */}
        {/* Straight line part of the D (also serves as goal line) */}
        <line x1="15" y1="10" x2="85" y2="10" />
        {/* Arc part of the D */}
        <path d="M 15 10 A 35 35 0 0 1 85 10" />
        
        {/* Goal */}
        <rect x="45.6" y="4" width="8.8" height="6" strokeWidth="1.5" />
        
        {/* Dashed Circle (5m from D) */}
        <path d="M 5 10 A 45 45 0 0 1 95 10" strokeDasharray="5,5" />
        
        {/* Penalty Spot */}
        <circle cx="50" cy="27" r="1.5" fill="hsl(var(--foreground))" stroke="none" />
        
        {/* Markings on Goal Line for Penalty Corner */}
        <line x1="33" y1="10" x2="33" y2="7" />
        <line x1="67" y1="10" x2="67" y2="7" />
        <line x1="23" y1="10" x2="23" y2="7" />
        <line x1="77" y1="10" x2="77" y2="7" />

        {/* Sideline Ticks (Decorative) */}
        <path d="M 0 25 H 3 M 0 45 H 3" />
        <path d="M 100 25 H 97 M 100 45 H 97" />
      </g>
    </svg>
);


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
      channels[entry.channel].entries++
      if (entry.outcome !== "No Shot") {
        channels[entry.channel].success++
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
      <CardContent className="flex justify-center items-center p-2 sm:p-6">
        <div className="relative w-full max-w-sm sm:max-w-md aspect-[100/75]">
          <div className="absolute inset-0">
             <HockeyShootingCircle />
          </div>

          {/* Left Channel */}
          <div className="absolute bottom-[5%] left-[-10%] sm:left-0 flex flex-col-reverse items-center gap-2 text-foreground">
            <StatDisplay
              label="Left"
              entries={analysis.left.entries}
              success={analysis.left.success}
              efficiency={analysis.left.efficiency}
            />
            <ArrowUp className="w-16 h-16 sm:w-20 sm:h-20 text-accent opacity-60 transform -rotate-[35deg]" />
          </div>

          {/* Center Channel */}
          <div className="absolute bottom-[20%] sm:bottom-[30%] left-1/2 -translate-x-1/2 flex flex-col-reverse items-center gap-2 text-foreground">
             <StatDisplay
              label="Center"
              entries={analysis.center.entries}
              success={analysis.center.success}
              efficiency={analysis.center.efficiency}
            />
            <ArrowUp className="w-16 h-16 sm:w-24 sm:h-24 text-accent opacity-60" />
          </div>

          {/* Right Channel */}
          <div className="absolute bottom-[5%] right-[-10%] sm:right-0 flex flex-col-reverse items-center gap-2 text-foreground">
            <StatDisplay
              label="Right"
              entries={analysis.right.entries}
              success={analysis.right.success}
              efficiency={analysis.right.efficiency}
            />
            <ArrowUp className="w-16 h-16 sm:w-20 sm:h-20 text-accent opacity-60 transform rotate-[35deg]" />
          </div>

        </div>
      </CardContent>
    </Card>
  )
}
