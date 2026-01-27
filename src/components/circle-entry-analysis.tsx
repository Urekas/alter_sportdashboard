"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { CircleEntry } from "@/lib/types"

interface CircleEntryAnalysisProps {
  entries: CircleEntry[]
}

export function CircleEntryAnalysis({ entries }: CircleEntryAnalysisProps) {
  
  // Dimensions based on meters.
  const fieldW = 55.0;
  const fieldH = 25.0; // Height of the half-pitch
  const cx = fieldW / 2; // Center X

  const circleRadius = 14.63;
  
  // SVG path for a semi-circle pointing downwards from the top line (y=0)
  const dZonePath = `M ${cx - circleRadius},0 A ${circleRadius},${circleRadius} 0 0 1 ${cx + circleRadius},0`;

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle>써클 진입 분석</CardTitle>
        <CardDescription>공격 채널별 진입 및 성공 효율 (공격 방향: 아래 → 위)</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center items-center p-2 sm:p-4 md:p-6">
        <div className="w-full max-w-3xl">
           <svg viewBox={`-5 -5 ${fieldW + 10} ${fieldH + 15}`} preserveAspectRatio="xMidYMin">
            
            <g stroke="hsl(var(--foreground))" strokeWidth="1" fill="none">
              {/* Outer rectangle representing the half-pitch */}
              <rect x="0" y="0" width={fieldW} height={fieldH} />
              
              {/* Shooting Circle (D-Zone) as a semi-circle pointing downwards */}
              <path d={dZonePath} />
            </g>
            
          </svg>
        </div>
      </CardContent>
    </Card>
  )
}
