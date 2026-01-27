"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface CircleEntryAnalysisProps {
  // entries: CircleEntry[] // Data props removed for now
}

export function CircleEntryAnalysis({}: CircleEntryAnalysisProps) {
  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle>써클 진입 분석</CardTitle>
        <CardDescription>공격 채널별 진입 및 성공 효율 (공격 방향: 아래 → 위)</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center items-center p-2 sm:p-4 md:p-6">
        <div className="w-full max-w-3xl text-foreground">
          <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMin" className="w-full h-full">
            <g stroke="currentColor" strokeWidth="1.5" fill="none">
              {/* Frame */}
              <rect x="5" y="10" width="90" height="45" />

              {/* Goal */}
              <rect x="45" y="8" width="10" height="2" />

              {/* Top Tick Marks */}
              <line x1="20" y1="10" x2="20" y2="13" />
              <line x1="35" y1="10" x2="35" y2="13" />
              <line x1="65" y1="10" x2="65" y2="13" />
              <line x1="80" y1="10" x2="80" y2="13" />

              {/* Side Tick Marks */}
              <line x1="5" y1="25" x2="8" y2="25" />
              <line x1="5" y1="40" x2="8" y2="40" />
              <line x1="95" y1="25" x2="92" y2="25" />
              <line x1="95" y1="40" x2="92" y2="40" />

              {/* Penalty Spot */}
              <circle cx="50" cy="27" r="1.5" fill="currentColor" />

              {/* Solid Arc */}
              <path d="M 27 10 C 27 38, 73 38, 73 10" />

              {/* Dashed Arc */}
              <path d="M 18 10 C 18 48, 82 48, 82 10" strokeDasharray="4, 4" />
            </g>
          </svg>
        </div>
      </CardContent>
    </Card>
  )
}
