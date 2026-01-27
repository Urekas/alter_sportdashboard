"use client"

import type { FC } from "react"
import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { CircleEntry } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ArrowUp } from "lucide-react"

// A vertical view of the attacking circle, goal is at the top.
const VerticalAttackingHalf: FC = () => (
    <svg viewBox="0 0 200 250" preserveAspectRatio="xMidYMin meet" className="w-full h-full">
      <g stroke="hsl(var(--foreground))" strokeWidth="2" fill="none">
        {/* Goal */}
        <rect x="82" y="0" width="36" height="4" strokeWidth="2"/>

        {/* Back line with Ticks */}
        <line x1="0" y1="4" x2="200" y2="4" />
        <path d="M 82 4 V 1 M 118 4 V 1" strokeWidth="2" />
        <path d="M 67 4 V 2 M 52 4 V 2 M 37 4 V 2 M 22 4 V 2 M 7 4 V 2 M 133 4 V 2 M 148 4 V 2 M 163 4 V 2 M 178 4 V 2 M 193 4 V 2" strokeWidth="1.5"/>

        {/* Circle */}
        <path d="M 46 4 A 54 54 0 0 1 154 4" strokeWidth="2.5" />
        
        {/* Dashed Circle */}
        <path d="M 25 4 A 75 75 0 0 1 175 4" strokeDasharray="6,6" strokeWidth="2.5" />
        
        {/* Penalty Spot */}
        <circle cx="100" cy="30" r="2.5" fill="hsl(var(--foreground))" stroke="none" />
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
        <div className="relative w-full max-w-xs sm:max-w-sm aspect-[200/270]">
          <div className="absolute inset-0">
             <VerticalAttackingHalf />
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
