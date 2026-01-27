"use client"

import type { FC } from "react"
import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { CircleEntry } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ArrowUp } from "lucide-react"

// A vertical view of the attacking circle, based on official dimensions.
const VerticalAttackingHalf: FC = () => (
    <svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMin meet" className="w-full h-full">
      <g stroke="hsl(var(--foreground))" strokeWidth="1.5" fill="none">
        {/* Goal (3.66m wide) */}
        <rect x="91" y="0" width="18" height="4" strokeWidth="1.5"/>

        {/* Back line */}
        <line x1="0" y1="4" x2="200" y2="4" />

        {/* Markings on backline */}
        {/* Goal posts */}
        <path d="M 91 4 V 1 M 109 4 V 1" strokeWidth="1.5" />
        {/* 5m and 10m PC marks from posts */}
        <path d="M 67 4 V 2 M 133 4 V 2" strokeWidth="1" /> {/* 5m marks */}
        <path d="M 43 4 V 2 M 157 4 V 2" strokeWidth="1" /> {/* 10m marks */}

        {/* Circle (D) - 14.63m radius */}
        <path d="M 29 4 L 171 4" strokeWidth="2" /> {/* Straight part of the D */}
        <path d="M 29 4 A 71 71 0 0 1 171 4" strokeWidth="2" /> {/* Arc part of the D */}
        
        {/* Dashed Circle (5m from D) */}
        <path d="M 5 4 A 95 95 0 0 1 195 4" strokeDasharray="4,4" strokeWidth="2" />
        
        {/* Penalty Spot - 6.475m from goal line */}
        <circle cx="100" cy="35" r="2" fill="hsl(var(--foreground))" stroke="none" />
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
        <div className="relative w-full max-w-sm sm:max-w-md aspect-[200/200]">
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
