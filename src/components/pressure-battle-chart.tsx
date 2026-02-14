
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
  height?: number
}

const CustomTooltip = ({ active, payload, label, homeTeam, awayTeam, maxY }: TooltipProps<ValueType, NameType> & { homeTeam: Team, awayTeam: Team, maxY: number }) => {
  if (active && payload && payload.length) {
    const homePayload = payload.find(p => p.dataKey === homeTeam.name);
    const awayPayload = payload.find(p => p.dataKey === awayTeam.name);

    const formatSpp = (val: any) => {
      const n = Number(val);
      if (n >= maxY) return "0.0s (No Press)";
      return `${n.toFixed(1)}s`;
    };

    return (
      <div className="bg-card p-3 border rounded-lg shadow-lg text-sm">
        <p className="font-bold text-base mb-2">{`시간대: ${label}`}</p>
        {homePayload && <p style={{ color: homePayload.color }}>
          {`${homePayload.name} SPP: ${formatSpp(homePayload.value)}`}
        </p>}
        {awayPayload && <p style={{ color: awayPayload.color }}>
          {`${awayPayload.name} SPP: ${formatSpp(awayPayload.value)}`}
        </p>}
      </div>
    );
  }
  return null;
};

export function PressureBattleChart({ data, homeTeam, awayTeam, height = 350 }: PressureBattleChartProps) {
  const maxY = useMemo(() => {
    const vals = data.flatMap(d => [Number(d[homeTeam.name]), Number(d[awayTeam.name])]).filter(v => v > 0);
    const maxVal = vals.length > 0 ? Math.max(...vals) : 15;
    return Math.ceil(maxVal * 1.3); // 상단에 여유를 줌 (역방향이므로 큰 값이 아래)
  }, [data, homeTeam, awayTeam]);

  const chartData = useMemo(() => {
    const result: any[] = [];
    if (data.length === 0) return result;

    const normalize = (v: any) => {
      const n = Number(v);
      return n === 0 ? maxY : n;
    };

    for (let i = 0; i < data.length - 1; i++) {
      const current = data[i];
      const next = data[i + 1];
      const h1 = normalize(current[homeTeam.name]);
      const a1 = normalize(current[awayTeam.name]);
      const h2 = normalize(next[homeTeam.name]);
      const a2 = normalize(next[awayTeam.name]);

      const createPoint = (d: any, h: number, a: number) => ({
        ...d,
        [homeTeam.name]: h,
        [awayTeam.name]: a,
        // SPP는 작을수록 좋으므로(상단), 더 작은 값이 dominance(음영)를 가짐
        homeDominance: h <= a ? [h, a] : [a, a],
        awayDominance: a < h ? [a, h] : [h, h]
      });

      result.push(createPoint(current, h1, a1));

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
    const hLast = normalize(last[homeTeam.name]);
    const aLast = normalize(last[awayTeam.name]);
    result.push({
      ...last,
      [homeTeam.name]: hLast,
      [awayTeam.name]: aLast,
      homeDominance: hLast <= aLast ? [hLast, aLast] : [aLast, aLast],
      awayDominance: aLast > hLast ? [aLast, hLast] : [hLast, hLast]
    });

    return result;
  }, [data, homeTeam, awayTeam, maxY]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pressure Battle (SPP 추이)</CardTitle>
        <CardDescription>
          SPP가 0(압박 없음)인 경우 차트 최하단에 표시됩니다. 상단에 위치할수록 압박 강도가 높음을 의미합니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="interval" interval="preserveStartEnd" />
            <YAxis 
              reversed 
              domain={[0, maxY]}
              label={{ value: 'SPP (s)', angle: -90, position: 'insideLeft' }} 
            />
            <Tooltip content={<CustomTooltip homeTeam={homeTeam} awayTeam={awayTeam} maxY={maxY} />} />
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

            <Line 
              type="monotone" 
              dataKey={homeTeam.name} 
              stroke={homeTeam.color} 
              strokeWidth={3} 
              dot={(props: any) => {
                const { cx, cy, payload, key } = props;
                if (payload.isIntersect) return <path key={`inter-${key}`} d="" />;
                return <circle key={key} cx={cx} cy={cy} r={4} fill={homeTeam.color} stroke="none" />;
              }} 
              activeDot={{ r: 6 }} 
            />
            <Line 
              type="monotone" 
              dataKey={awayTeam.name} 
              stroke={awayTeam.color} 
              strokeWidth={3} 
              dot={(props: any) => {
                const { cx, cy, payload, key } = props;
                if (payload.isIntersect) return <path key={`inter-${key}`} d="" />;
                return <circle key={key} cx={cx} cy={cy} r={4} fill={awayTeam.color} stroke="none" />;
              }} 
              activeDot={{ r: 6 }} 
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
