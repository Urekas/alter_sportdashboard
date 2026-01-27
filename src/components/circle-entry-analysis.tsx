"use client"

import type { FC } from "react"
import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { CircleEntry } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ArrowUp } from "lucide-react"

const HockeyShootingCircle: FC = () => {
  return (
    <svg viewBox="0 0 120 90" preserveAspectRatio="xMidYMin" className="w-full h-full">
      <g stroke="hsl(var(--foreground))" strokeWidth="2.5" fill="none">
        {/* Outer Box */}
        <path d="M 10,20 V 80 H 110 V 20" />
        
        {/* Top line with Goal notch */}
        <path d="M 10,20 H 54 V 25 H 66 V 20 H 110" />

        {/* Arcs */}
        <path d="M 25,20 A 35,35 0 0 1 95,20" />
        <path d="M 15,20 A 45,45 0 0 1 105,20" strokeDasharray="6,6" />
        
        {/* Penalty Spot */}
        <circle cx="60" cy="45" r="2" fill="hsl(var(--foreground))" stroke="none" />
        
        {/* Top & Side Ticks */}
        <path d="M 30,20 V 16 M 42,20 V 16 M 78,20 V 16 M 90,20 V 16 M 10,45 H 6 M 10,65 H 6 M 110,45 H 114 M 110,65 H 114" />
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
        <div className="relative w-full max-w-2xl aspect-[120/90]">
          <div className="absolute inset-0">
             <HockeyShootingCircle />
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-full h-full">

              {/* Data Overlay: Positioned relative to the parent container */}
              
              {/* Left Channel */}
              <div className="absolute top-[55%] left-[15%] flex flex-col items-center gap-1 text-foreground">
                <ArrowUp className="w-16 h-16 sm:w-20 sm:h-20 text-accent opacity-80 transform -rotate-[50deg]" strokeWidth={3}/>
                 <StatDisplay
                  label="Left"
                  entries={analysis.left.entries}
                  success={analysis.left.success}
                  efficiency={analysis.left.efficiency}
                />
              </div>

              {/* Center Channel */}
              <div className="absolute top-[65%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-foreground">
                <ArrowUp className="w-16 h-16 sm:w-24 sm:h-24 text-accent opacity-80" strokeWidth={3}/>
                 <StatDisplay
                  label="Center"
                  entries={analysis.center.entries}
                  success={analysis.center.success}
                  efficiency={analysis.center.efficiency}
                />
              </div>

              {/* Right Channel */}
              <div className="absolute top-[55%] right-[15%] flex flex-col items-center gap-1 text-foreground">
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
