
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
import { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent'

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
  // 정밀 음영 처리를 위한 데이터 가공 (SPP는 낮을수록 우수하므로 그래프상 위에 위치함)
  const chartData = useMemo(() => {
    const result: any[] = [];
    if (data.length === 0) return result;

    for (let i = 0; i < data.length - 1; i++) {
      const current = data[i];
      const next = data[i + 1];
      const h1 = Number(current[homeTeam.name]);
      const a1 = Number(current[awayTeam.name]);
      const h2 = Number(next[homeTeam.name]);
      const a2 = Number(next[awayTeam.name]);

      const createPoint = (d: any, h: number, a: number) => ({
        ...d,
        [homeTeam.name]: h,
        [awayTeam.name]: a,
        homeDominance: h <= a ? [h, a] : [a, a],
        awayDominance: a < h ? [a, h] : [h, h]
      });

      result.push(createPoint(current, h1, a1));

      // 교차 지점 계산 (SPP는 낮을수록 우위)
      if ((h1 - a1) * (h2 - a2) < 0) {
        const ratio = Math.abs(h1 - a1) / (Math.abs(h1 - a1) + Math.abs(h2 - a2));
        const intersectVal = h1 + ratio * (h2 - h1);
        
        result.push({
          interval: `${current.interval}+`,
          isIntersect: true,
          [homeTeam.name]: intersectVal,
          [awayTeam.name]: intersectVal,
          homeDominance: [intersectVal, intersectVal],
          awayDominance: [intersectVal, intersectVal]
        });
      }
    }
    
    const last = data[data.length - 1];
    const hLast = Number(last[homeTeam.name]);
    const aLast = Number(last[awayTeam.name]);
    result.push({
      ...last,
      homeDominance: hLast <= aLast ? [hLast, aLast] : [aLast, aLast],
      awayDominance: aLast < hLast ? [aLast, hLast] : [hLast, hLast]
    });

    return result;
  }, [data, homeTeam, awayTeam]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pressure Battle (SPP 추이)</CardTitle>
        <CardDescription>
          SPP(Seconds Per Press) 추이입니다. 음영은 압박 대응이 우수한(그래프상 상단) 팀의 색으로 채워집니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="interval" interval="preserveStartEnd" />
            <YAxis 
              reversed 
              domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2)]}
              label={{ value: 'SPP (s)', angle: -90, position: 'insideLeft' }} 
            />
            <Tooltip content={<CustomTooltip homeTeam={homeTeam} awayTeam={awayTeam} />} />
            <Legend />
            
            <Area
              type="monotone"
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
              type="monotone"
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

            <Line type="monotone" dataKey={homeTeam.name} stroke={homeTeam.color} strokeWidth={3} dot={(props) => props.payload.isIntersect ? null : <circle {...props} r={4} />} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey={awayTeam.name} stroke={awayTeam.color} strokeWidth={3} dot={(props) => props.payload.isIntersect ? null : <circle {...props} r={4} />} activeDot={{ r: 6 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
