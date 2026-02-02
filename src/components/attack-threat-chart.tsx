"use client"

import React from "react"
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
  Label
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
        <p className="font-bold text-lg mb-2">{`Interval: ${label}`}</p>
        {homePayload && <p style={{ color: homePayload.color }}>
          {`${homePayload.name} Threat: ${homePayload.value}`}
        </p>}
        {awayPayload && <p style={{ color: awayPayload.color }}>
          {`${awayPayload.name} Threat: ${awayPayload.value}`}
        </p>}
      </div>
    );
  }

  return null;
};


export function AttackThreatChart({ data, homeTeam, awayTeam }: AttackThreatChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Attack Threat Trend (5m Avg)</CardTitle>
        <CardDescription>
          Total attack threat (shots, PCs, circle entries) averaged every 5 minutes, divided by quarters.
          <span className="mt-1 block text-xs text-muted-foreground/90">
            (참고: 현재 이 데이터는 시뮬레이션으로 생성됩니다.)
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <XAxis dataKey="interval" />
            <YAxis label={{ value: 'Threat Index', angle: -90, position: 'insideLeft' }} />
            <Tooltip content={<CustomTooltip homeTeam={homeTeam} awayTeam={awayTeam} />} />
            <Legend />
            
            {/* Quarter Separators */}
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
