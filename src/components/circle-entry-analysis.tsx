"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { CircleEntry } from "@/lib/types"

interface CircleEntryAnalysisProps {
  entries: CircleEntry[]
}

export function CircleEntryAnalysis({ entries }: CircleEntryAnalysisProps) {
  // Data processing logic and overlays will be added back once the base diagram is approved.
  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle>써클 진입 분석</CardTitle>
        <CardDescription>공격 채널별 진입 및 성공 효율 (공격 방향: 아래 → 위)</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center items-center p-2 sm:p-4 md:p-6">
        <div className="w-full max-w-lg text-foreground">
          <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMin" className="w-full h-auto">
            <g stroke="currentColor" strokeWidth="2" fill="none">
              {/* Frame */}
              <rect x="5" y="10" width="90" height="45" />

              {/* Goal */}
              <rect x="45" y="8" width="10" height="2" stroke="currentColor" />

              {/* Solid Arc (Semi-circle) */}
              <path d="M25 10 A 25 25 0 0 1 75 10" />
              
              {/* Dashed Arc (Semi-circle) */}
              <path d="M15 10 A 35 35 0 0 1 85 10" strokeDasharray="5 3" />

              {/* Penalty Spot */}
              <circle cx="50" cy="25" r="1.5" fill="currentColor" stroke="none" />

              {/* Top Tick Marks */}
              <line x1="30" y1="10" x2="30" y2="13" />
              <line x1="40" y1="10" x2="40" y2="13" />
              <line x1="60" y1="10" x2="60" y2="13" />
              <line x1="70" y1="10" x2="70" y2="13" />

              {/* Side Tick Marks */}
              <line x1="5" y1="25" x2="8" y2="25" />
              <line x1="5" y1="40" x2="8" y2="40" />
              <line x1="95" y1="25" x2="92" y2="25" />
              <line x1="95" y1="40" x2="92" y2="40" />
            </g>
          </svg>
        </div>
      </CardContent>
    </Card>
  )
}
