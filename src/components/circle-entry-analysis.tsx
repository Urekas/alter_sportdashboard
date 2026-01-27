"use client"

import { useMemo, useState } from "react"
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { CircleEntry } from "@/lib/types"

interface CircleEntryAnalysisProps {
  entries: CircleEntry[]
  teamName: string
}

export function CircleEntryAnalysis({ entries, teamName }: CircleEntryAnalysisProps) {
  const [imageError, setImageError] = useState(false);

  const analysis = useMemo(() => {
    const stats: Record<'Left' | 'Center' | 'Right', { entries: number; success: number }> = {
      Left: { entries: 0, success: 0 },
      Center: { entries: 0, success: 0 },
      Right: { entries: 0, success: 0 },
    };

    for (const entry of entries) {
      if (stats[entry.channel]) {
        stats[entry.channel].entries++;
        // A success is a Goal, Shot, or PC
        if (entry.outcome === 'Goal' || entry.outcome === 'Shot On Target' || entry.outcome === 'Shot Missed') {
          stats[entry.channel].success++;
        }
      }
    }

    const calcEfficiency = (success: number, entries: number) => {
        return entries > 0 ? Math.round((success / entries) * 100) : 0;
    }

    return {
      left: { ...stats.Left, efficiency: calcEfficiency(stats.Left.success, stats.Left.entries) },
      center: { ...stats.Center, efficiency: calcEfficiency(stats.Center.success, stats.Center.entries) },
      right: { ...stats.Right, efficiency: calcEfficiency(stats.Right.success, stats.Right.entries) },
    };
  }, [entries]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{teamName} 써클 진입 분석</CardTitle>
        <CardDescription>
          공격 채널별 진입 및 성공 효율 (공격 방향: 아래 → 위)
          <span className="mt-1 block text-xs text-muted-foreground/90">
            (참고: 현재 이 데이터는 시뮬레이션으로 생성됩니다.)
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center items-center p-2 sm:p-4 md:p-6">
        <div className="relative w-full max-w-lg mx-auto aspect-[55/30]">
          {imageError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-destructive/10 text-destructive border border-dashed border-destructive rounded-lg">
                <div className="text-center p-4">
                    <p className="font-bold">이미지 로드 오류</p>
                    <p className="text-sm mt-1">
                        <code>public/pitch-diagram.png</code><br/>
                        경로에 파일이 있는지 확인 후 서버를 재시작해주세요.
                    </p>
                </div>
            </div>
          ) : (
            <Image
                src="/pitch-diagram.png"
                alt="Hockey pitch circle diagram"
                fill
                className="object-contain"
                data-ai-hint="hockey field"
                onError={() => setImageError(true)}
            />
          )}

          {/* Arrow Overlays - Hide if image fails */}
          {!imageError && (
            <div className="absolute inset-0">
                <svg width="100%" height="100%" viewBox="0 0 55 30" preserveAspectRatio="xMidYMin">
                     <defs>
                        <marker id="arrowhead-circle-analysis" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--accent))" />
                        </marker>
                    </defs>
                    {/* Left Arrow */}
                    <line x1="2.75" y1="17" x2="11" y2="9" stroke="hsl(var(--accent))" strokeWidth="1.5" opacity="0.8" markerEnd="url(#arrowhead-circle-analysis)" />
                    {/* Center Arrow */}
                    <line x1="27.5" y1="25" x2="27.5" y2="15" stroke="hsl(var(--accent))" strokeWidth="1.5" opacity="0.8" markerEnd="url(#arrowhead-circle-analysis)" />
                    {/* Right Arrow */}
                    <line x1="52.25" y1="17" x2="44" y2="9" stroke="hsl(var(--accent))" strokeWidth="1.5" opacity="0.8" markerEnd="url(#arrowhead-circle-analysis)" />
                </svg>
            </div>
          )}

         {/* Text Overlays */}
          <div
              className="absolute text-center text-card-foreground whitespace-nowrap"
              style={{ top: '72%', left: '9%', transform: 'translate(-50%, -50%)', fontSize: 'clamp(8px, 2.2vw, 13px)' }}
          >
              <b>Left</b><br />
              진입: {analysis.left.entries}회<br />
              Success: {analysis.left.success}회<br />
              효율: {analysis.left.efficiency}%
          </div>
           <div
              className="absolute text-center text-card-foreground whitespace-nowrap"
              style={{ top: '32%', left: '54.5%', transform: 'translate(-50%, -50%)', fontSize: 'clamp(8px, 2.2vw, 13px)' }}
          >
              <b>Center</b><br />
              진입: {analysis.center.entries}회<br />
              Success: {analysis.center.success}회<br />
              효율: {analysis.center.efficiency}%
          </div>
           <div
              className="absolute text-center text-card-foreground whitespace-nowrap"
              style={{ top: '72%', left: '91%', transform: 'translate(-50%, -50%)', fontSize: 'clamp(8px, 2.2vw, 13px)' }}
          >
              <b>Right</b><br />
              진입: {analysis.right.entries}회<br />
              Success: {analysis.right.success}회<br />
              효율: {analysis.right.efficiency}%
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
