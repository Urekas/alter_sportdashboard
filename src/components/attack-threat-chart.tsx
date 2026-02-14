
"use client"

import React, { useMemo } from "react"
import {
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
  ReferenceLine,
  Label,
  CartesianGrid,
  ComposedChart,
  Line
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { AttackThreatDataPoint, Team } from "@/lib/types"
import { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent'

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
      <div className="bg-card p-3 border rounded-lg shadow-lg text-sm">
        <p className="font-bold text-base mb-2">{`시간대: ${label}`}</p>
        {homePayload && <p style={{ color: homePayload.color }}>
          {`${homePayload.name} 위협도: ${Math.round(Number(homePayload.value))}`}
        </p>}
        {awayPayload && <p style={{ color: awayPayload.color }}>
          {`${awayPayload.name} 위협도: ${Math.round(Number(awayPayload.value))}`}
        </p>}
      </div>
    );
  }
  return null;
};

export function AttackThreatChart({ data, homeTeam, awayTeam }: AttackThreatChartProps) {
  // 정밀 음영 처리를 위한 데이터 가공 (Intersection 보간 포함)
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
        homeDominance: h >= a ? [a, h] : [h, h],
        awayDominance: a > h ? [h, a] : [a, a]
      });

      result.push(createPoint(current, h1, a1));

      // 교차 지점 계산 (Intersection)
      if ((h1 - a1) * (h2 - a2) < 0) {
        const ratio = Math.abs(h1 - a1) / (Math.abs(h1 - a1) + Math.abs(h2 - a2));
        const intersectVal = h1 + ratio * (h2 - h1);
        
        // 5' -> 10' 사이면 '5'+ ' 처럼 유니크한 키 생성
        const intersectPoint = {
          interval: `${current.interval}+`, 
          isIntersect: true,
          [homeTeam.name]: intersectVal,
          [awayTeam.name]: intersectVal,
          homeDominance: [intersectVal, intersectVal],
          awayDominance: [intersectVal, intersectVal]
        };
        result.push(intersectPoint);
      }
    }
    
    const last = data[data.length - 1];
    const hLast = Number(last[homeTeam.name]);
    const aLast = Number(last[awayTeam.name]);
    result.push({
      ...last,
      homeDominance: hLast >= aLast ? [aLast, hLast] : [aLast, aLast],
      awayDominance: aLast > hLast ? [hLast, aLast] : [hLast, hLast]
    });

    return result;
  }, [data, homeTeam, awayTeam]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attack Threat Trend (슈팅+PC)</CardTitle>
        <CardDescription>
          슈팅 및 페널티코너 합산 위협도 추이입니다. 선 사이의 음영은 더 우세한 팀의 색으로 채워집니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="interval" interval="preserveStartEnd" />
            <YAxis label={{ value: '공격 위협도', angle: -90, position: 'insideLeft' }} allowDecimals={false} />
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
