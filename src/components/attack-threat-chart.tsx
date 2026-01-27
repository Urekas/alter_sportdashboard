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
  TooltipProps
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
        <p className="font-bold text-lg mb-2">{`Quarter: ${label}`}</p>
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
        <CardTitle>Attack Threat Trend</CardTitle>
        <CardDescription>Total shots and penalty corners per quarter.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <XAxis dataKey="quarter" />
            <YAxis label={{ value: 'Threat Count', angle: -90, position: 'insideLeft' }} />
            <Tooltip content={<CustomTooltip homeTeam={homeTeam} awayTeam={awayTeam} />} />
            <Legend />
            <Line type="monotone" dataKey={homeTeam.name} stroke={homeTeam.color} strokeWidth={2} />
            <Line type="monotone" dataKey={awayTeam.name} stroke={awayTeam.color} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
