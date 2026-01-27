"use client"

import React, { useMemo } from "react"
import {
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea,
  TooltipProps,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { PressureDataPoint, Team } from "@/lib/types"
import { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';

interface PressureBattleChartProps {
  data: PressureDataPoint[]
  homeTeam: Team
  awayTeam: Team
}

const CustomTooltip = ({ active, payload, label, homeTeam, awayTeam }: TooltipProps<ValueType, NameType> & { homeTeam: Team, awayTeam: Team }) => {
  if (active && payload && payload.length) {
    const homePayload = payload.find(p => p.dataKey === homeTeam.name);
    const awayPayload = payload.find(p => p.dataKey === awayTeam.name);

    return (
      <div className="bg-card p-3 border rounded-lg shadow-lg">
        <p className="font-bold text-lg mb-2">{`Minute: ${label}`}</p>
        {homePayload && <p style={{ color: homePayload.color }}>
          {`${homePayload.name} SPP: ${Number(homePayload.value).toFixed(2)}s`}
        </p>}
        {awayPayload && <p style={{ color: awayPayload.color }}>
          {`${awayPayload.name} SPP: ${Number(awayPayload.value).toFixed(2)}s`}
        </p>}
      </div>
    );
  }

  return null;
};


export function PressureBattleChart({ data, homeTeam, awayTeam }: PressureBattleChartProps) {
  const dominanceSegments = useMemo(() => {
    if (!data || data.length === 0) return []

    const segments = []
    let currentSegment = {
      x1: data[0].minute,
      dominant: data[0][homeTeam.name] <= data[0][awayTeam.name] ? homeTeam.name : awayTeam.name,
    }

    for (let i = 1; i < data.length; i++) {
      const homeValue = data[i][homeTeam.name]
      const awayValue = data[i][awayTeam.name]
      const currentDominant = homeValue <= awayValue ? homeTeam.name : awayTeam.name

      if (currentDominant !== currentSegment.dominant) {
        segments.push({ ...currentSegment, x2: data[i].minute })
        currentSegment = { x1: data[i].minute, dominant: currentDominant }
      }
    }
    segments.push({ ...currentSegment, x2: data[data.length - 1].minute })
    return segments
  }, [data, homeTeam, awayTeam])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pressure Battle</CardTitle>
        <CardDescription>Seconds Per Press (SPP) over time. Lower is better.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data}>
            <XAxis dataKey="minute" unit="&apos;" />
            <YAxis reversed label={{ value: 'SPP (s)', angle: -90, position: 'insideLeft' }} />
            <Tooltip content={<CustomTooltip homeTeam={homeTeam} awayTeam={awayTeam} />} />
            <Legend />
            {dominanceSegments.map((seg, index) => (
              <ReferenceArea
                key={index}
                x1={seg.x1}
                x2={seg.x2}
                y1={0}
                y2="dataMax"
                strokeOpacity={0.1}
                fill={seg.dominant === homeTeam.name ? homeTeam.color : awayTeam.color}
                fillOpacity={0.1}
              />
            ))}
            <Line type="monotone" dataKey={homeTeam.name} stroke={homeTeam.color} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey={awayTeam.name} stroke={awayTeam.color} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
