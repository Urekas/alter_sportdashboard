
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { MatchEvent, Team } from "@/lib/types"
import { mapZone } from "@/lib/zone-helpers"
import { cn } from "@/lib/utils"
import { CollapseToggleButton } from "./collapsible-section"

interface TurnoverZoneMapProps {
  events: MatchEvent[]
  homeTeam: Team
  awayTeam: Team
}

// 자기 진영(25/50)에서 먼 순서로 왼쪽 -> 상대 진영(75/100) 오른쪽 순서로 배치합니다.
const ZONES = [25, 50, 75, 100] as const

interface ZoneStats {
  counts: Record<number, number>
  total: number
  ownHalf: number
  oppHalf: number
}

function buildStats(events: MatchEvent[], teamName: string): ZoneStats {
  const counts: Record<number, number> = { 25: 0, 50: 0, 75: 0, 100: 0 }
  let total = 0
  events.forEach((e) => {
    if (e.type !== 'turnover' || e.team !== teamName) return
    const zoneInfo = mapZone(e.locationLabel || e.code)
    if (!zoneInfo) return
    const z = (ZONES as readonly number[]).includes(zoneInfo.zoneBand) ? zoneInfo.zoneBand : 50
    counts[z] = (counts[z] || 0) + 1
    total++
  })
  return { counts, total, ownHalf: counts[25] + counts[50], oppHalf: counts[75] + counts[100] }
}

function ZoneRow({ team, stats }: { team: Team; stats: ZoneStats }) {
  const max = Math.max(...ZONES.map((z) => stats.counts[z]), 1)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold" style={{ color: team.color }}>{team.name}</span>
        <span className="text-muted-foreground">총 {stats.total}회</span>
      </div>
      <div className="flex h-10 rounded-md overflow-hidden border">
        {ZONES.map((z) => {
          const count = stats.counts[z]
          const intensity = count > 0 ? (count / max) * 0.7 + 0.2 : 0.06
          return (
            <div
              key={z}
              className="flex-1 flex items-center justify-center border-r last:border-r-0"
              style={{ backgroundColor: team.color, opacity: intensity }}
            >
              <span className="text-[11px] font-black text-white drop-shadow">{count}</span>
            </div>
          )
        })}
      </div>
      <div className="flex text-[9px] text-muted-foreground justify-between px-1">
        <span>자기 진영 (25)</span><span>50</span><span>75</span><span>상대 진영 (100)</span>
      </div>
    </div>
  )
}

export function TurnoverZoneMap({ events, homeTeam, awayTeam }: TurnoverZoneMapProps) {
  const [open, setOpen] = useState(true)
  const home = buildStats(events, homeTeam.name)
  const away = buildStats(events, awayTeam.name)

  const describe = (team: Team, stats: ZoneStats) => {
    if (stats.total === 0) return `${team.name}: 턴오버 기록 없음`
    const ownMore = stats.ownHalf >= stats.oppHalf
    return ownMore
      ? `${team.name}는 자기 진영(하프라인 아래)에서 턴오버가 더 많음 (${stats.ownHalf} vs ${stats.oppHalf})`
      : `${team.name}는 상대 진영에서 턴오버가 더 많음 (${stats.oppHalf} vs ${stats.ownHalf})`
  }

  return (
    <Card className="break-inside-avoid">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>턴오버 지도</CardTitle>
          <CardDescription>
            {describe(homeTeam, home)} · {describe(awayTeam, away)}
          </CardDescription>
        </div>
        <CollapseToggleButton open={open} onClick={() => setOpen(o => !o)} />
      </CardHeader>
      <CardContent className={cn("space-y-4 max-w-xl mx-auto", !open && "hidden print:block")}>
        <ZoneRow team={homeTeam} stats={home} />
        <ZoneRow team={awayTeam} stats={away} />
      </CardContent>
    </Card>
  )
}
