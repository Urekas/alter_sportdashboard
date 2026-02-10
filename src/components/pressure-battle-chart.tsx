
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
  ReferenceLine,
  Label,
  TooltipProps,
  CartesianGrid
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
        <p className="font-bold text-lg mb-2">{`시간대: ${label}`}</p>
        {homePayload && <p style={{ color: homePayload.color }}>
          {`${homePayload.name} SPP: ${Number(homePayload.value).toFixed(1)}s`}
        </p>}
        {awayPayload && <p style={{ color: awayPayload.color }}>
          {`${awayPayload.name} SPP: ${Number(awayPayload.value).toFixed(1)}s`}
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
      x1: data[0].interval,
      dominant: data[0][homeTeam.name] <= data[0][awayTeam.name] ? homeTeam.name : awayTeam.name,
    }

    for (let i = 1; i < data.length; i++) {
      const homeValue = data[i][homeTeam.name] as number
      const awayValue = data[i][awayTeam.name] as number
      const currentDominant = homeValue <= awayValue ? homeTeam.name : awayTeam.name

      if (currentDominant !== currentSegment.dominant) {
        segments.push({ ...currentSegment, x2: data[i].interval })
        currentSegment = { x1: data[i].interval, dominant: currentDominant }
      }
    }
    segments.push({ ...currentSegment, x2: data[data.length - 1].interval })
    return segments
  }, [data, homeTeam, awayTeam])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pressure Battle (3m Avg)</CardTitle>
        <CardDescription>
          SPP(Seconds Per Press) 추이입니다. 값이 낮을수록 상대 압박에 빠르게 대응(우수)함을 의미합니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="interval" />
            <YAxis 
              reversed 
              domain={[0, 'auto']}
              label={{ value: 'SPP (s)', angle: -90, position: 'insideLeft' }} 
            />
            <Tooltip content={<CustomTooltip homeTeam={homeTeam} awayTeam={awayTeam} />} />
            <Legend />
            {dominanceSegments.map((seg, index) => (
              <ReferenceArea
                key={index}
                x1={seg.x1}
                x2={seg.x2}
                y1={0}
                y2="dataMax"
                strokeOpacity={0}
                fill={seg.dominant === homeTeam.name ? homeTeam.color : awayTeam.color}
                fillOpacity={0.05}
              />
            ))}

            <ReferenceLine x="15'" stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3">
              <Label value="Q1 | Q2" position="top" fill="hsl(var(--muted-foreground))" fontSize={12} offset={10} />
            </ReferenceLine>
            <ReferenceLine x="30'" stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3">
              <Label value="Q2 | Q3" position="top" fill="hsl(var(--muted-foreground))" fontSize={12} offset={10} />
            </ReferenceLine>
            <ReferenceLine x="45'" stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3">
              <Label value="Q3 | Q4" position="top" fill="hsl(var(--muted-foreground))" fontSize={12} offset={10} />
            </ReferenceLine>

            <Line type="monotone" dataKey={homeTeam.name} stroke={homeTeam.color} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey={awayTeam.name} stroke={awayTeam.color} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
