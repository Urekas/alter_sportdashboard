"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { MatchData } from "@/lib/types"

interface BasicMatchStatsProps {
  data: MatchData
}

type StatRow = {
  label: string
  homeValue: string | number
  awayValue: string | number
}

export function BasicMatchStats({ data }: BasicMatchStatsProps) {
  const { homeTeam, awayTeam, matchStats, build25Ratio, spp } = data

  const stats: StatRow[] = [
    {
      label: "Goals (Field / PC)",
      homeValue: `${matchStats.home.goals.field} / ${matchStats.home.goals.pc}`,
      awayValue: `${matchStats.away.goals.field} / ${matchStats.away.goals.pc}`,
    },
    {
      label: "Shots",
      homeValue: matchStats.home.shots,
      awayValue: matchStats.away.shots,
    },
    {
      label: "Circle Entries",
      homeValue: matchStats.home.circleEntries,
      awayValue: matchStats.away.circleEntries,
    },
    {
      label: "25y Entries",
      homeValue: matchStats.home.twentyFiveEntries,
      awayValue: matchStats.away.twentyFiveEntries,
    },
    {
      label: "Build25 Ratio (%)",
      homeValue: `${(build25Ratio.home * 100).toFixed(0)}%`,
      awayValue: `${(build25Ratio.away * 100).toFixed(0)}%`,
    },
    {
      label: "SPP / Allowed SPP",
      homeValue: `${spp.home.toFixed(2)} / ${matchStats.home.allowedSpp.toFixed(2)}`,
      awayValue: `${spp.away.toFixed(2)} / ${matchStats.away.allowedSpp.toFixed(2)}`,
    },
    {
      label: "Possession %",
      homeValue: `${matchStats.home.possession.toFixed(0)}%`,
      awayValue: `${matchStats.away.possession.toFixed(0)}%`,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Match Stats</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Metric</TableHead>
              <TableHead className="text-center">{homeTeam.name}</TableHead>
              <TableHead className="text-center">{awayTeam.name}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.map((stat) => (
              <TableRow key={stat.label}>
                <TableCell className="font-medium">{stat.label}</TableCell>
                <TableCell className="text-center">{stat.homeValue}</TableCell>
                <TableCell className="text-center">{stat.awayValue}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}