
"use client"

import React, { useMemo } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
  ReferenceLine,
  ReferenceArea,
  Label,
  CartesianGrid
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { AttackThreatDataPoint, Team } from "@/lib/types"
import { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';

interface AttackThreatChartProps {
  data: AttackThreatDataPoint[]
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
          {`${homePayload.name} 위협도: ${homePayload.value}`}
        </p>}
        {awayPayload && <p style={{ color: awayPayload.color }}>
          {`${awayPayload.name} 위협도: ${awayPayload.value}`}
        </p>}
      </div>
    );
  }

  return null;
};


export function AttackThreatChart({ data, homeTeam, awayTeam }: AttackThreatChartProps) {
  const dominanceSegments = useMemo(() => {
    if (!data || data.length === 0) return []
    const segments = []
    
    for (let i = 0; i < data.length - 1; i++) {
      const h1 = Number(data[i][homeTeam.name])
      const a1 = Number(data[i][awayTeam.name])
      const dominant = h1 >= a1 ? homeTeam.name : awayTeam.name
      
      segments.push({
        x1: data[i].interval,
        x2: data[i+1].interval,
        dominant: dominant
      })
    }
    return segments
  }, [data, homeTeam, awayTeam])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attack Threat Trend (5m Avg)</CardTitle>
        <CardDescription>
          슈팅 발생 빈도 추이입니다. 선 사이의 음영은 더 많은 공격을 시도한 팀의 우세를 나타냅니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="interval" />
            <YAxis label={{ value: '공격 위협도', angle: -90, position: 'insideLeft' }} />
            <Tooltip content={<CustomTooltip homeTeam={homeTeam} awayTeam={awayTeam} />} />
            <Legend />
            
            {dominanceSegments.map((seg, idx) => (
              <ReferenceArea
                key={idx}
                x1={seg.x1}
                x2={seg.x2}
                fill={seg.dominant === homeTeam.name ? homeTeam.color : awayTeam.color}
                fillOpacity={0.1}
                strokeOpacity={0}
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
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
