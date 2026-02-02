"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { MatchData } from "@/lib/types"

interface QuarterlyStatsTableProps {
  data: MatchData
}

export function QuarterlyStatsTable({ data }: QuarterlyStatsTableProps) {
  const { homeTeam, awayTeam, quarterlyStats } = data

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quarterly Match Stats</CardTitle>
        <CardDescription>
          Detailed breakdown of key metrics for each quarter.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric / Quarter</TableHead>
              {quarterlyStats.map(q => (
                <TableHead key={q.quarter} className="text-center font-bold border-x bg-muted/30">
                  {q.quarter}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Team Rows - HOME */}
            <TableRow className="bg-muted/10">
              <TableCell className="font-bold text-primary" colSpan={5}>
                {homeTeam.name} (Home)
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">Goals (Field/PC)</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">
                  {q.home.goals?.field} / {q.home.goals?.pc}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">Shots</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.home.shots}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">Circle Entries</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.home.circleEntries}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">Possession (%)</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.home.possession}%</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">ATT Possession (%)</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.home.attackPossession}%</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">Avg SPP (s)</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.home.spp.toFixed(1)}s</TableCell>
              ))}
            </TableRow>

            {/* Team Rows - AWAY */}
            <TableRow className="bg-muted/10">
              <TableCell className="font-bold text-chart-2" colSpan={5}>
                {awayTeam.name} (Away)
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">Goals (Field/PC)</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">
                  {q.away.goals?.field} / {q.away.goals?.pc}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">Shots</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.away.shots}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">Circle Entries</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.away.circleEntries}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">Possession (%)</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.away.possession}%</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">ATT Possession (%)</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.away.attackPossession}%</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="pl-6 text-sm font-medium">Avg SPP (s)</TableCell>
              {quarterlyStats.map(q => (
                <TableCell key={q.quarter} className="text-center border-x">{q.away.spp.toFixed(1)}s</TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
