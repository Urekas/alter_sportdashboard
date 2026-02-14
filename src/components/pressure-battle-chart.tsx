
"use client"

import React, { useMemo } from "react"
import {
  Area,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
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
      <div className="bg-card p-3 border rounded-lg shadow-lg text-sm">
        <p className="font-bold text-base mb-2">{`시간대: ${label}`}</p>
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
  // 음영 처리를 위한 데이터 가공 (SPP는 낮을수록 우세하므로 반대로 채움)
  const chartData = useMemo(() => {
    return data.map(d => {
      const h = Number(d[homeTeam.name]) || 0;
      const a = Number(d[awayTeam.name]) || 0;
      return {
        ...d,
        // SPP는 낮을수록(그래프상 위) 우수함. 
        // Home이 우세할 때(h < a) 범위 [Home, Away] -> Y축 Reversed이므로 상단이 낮은값
        homeDominance: h < a ? [h, a] : [a, a],
        awayDominance: a < h ? [a, h] : [h, h]
      }
    });
  }, [data, homeTeam, awayTeam]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pressure Battle (SPP 추이)</CardTitle>
        <CardDescription>
          SPP(Seconds Per Press) 추이입니다. 음영은 압박에 더 잘 대응하고 있는(그래프상 상단) 팀의 우세를 나타냅니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="interval" />
            <YAxis 
              reversed 
              domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2)]}
              label={{ value: 'SPP (s)', angle: -90, position: 'insideLeft' }} 
            />
            <Tooltip content={<CustomTooltip homeTeam={homeTeam} awayTeam={awayTeam} />} />
            <Legend />
            
            {/* 우세 구역 음영 채우기 (Reversed Y축 대응) */}
            <Area
              dataKey="homeDominance"
              stroke="none"
              fill={homeTeam.color}
              fillOpacity={0.15}
              connectNulls
              activeDot={false}
              legendType="none"
              tooltipType="none"
            />
            <Area
              dataKey="awayDominance"
              stroke="none"
              fill={awayTeam.color}
              fillOpacity={0.15}
              connectNulls
              activeDot={false}
              legendType="none"
              tooltipType="none"
            />

            <ReferenceLine x="15'" stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3">
              <Label value="Q1 | Q2" position="top" fill="hsl(var(--muted-foreground))" fontSize={11} offset={10} />
            </ReferenceLine>
            <ReferenceLine x="30'" stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3">
              <Label value="Q2 | Q3" position="top" fill="hsl(var(--muted-foreground))" fontSize={11} offset={10} />
            </ReferenceLine>
            <ReferenceLine x="45'" stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3">
              <Label value="Q3 | Q4" position="top" fill="hsl(var(--muted-foreground))" fontSize={11} offset={10} />
            </ReferenceLine>

            <Line type="monotone" dataKey={homeTeam.name} stroke={homeTeam.color} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey={awayTeam.name} stroke={awayTeam.color} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
