
"use client"

import React, { useMemo } from "react"
import {
  Line,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
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

const CustomTooltip = ({ active, payload, homeTeam, awayTeam }: TooltipProps<ValueType, NameType> & { homeTeam: Team, awayTeam: Team }) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload;
    if (dataPoint.isIntersection) return null;

    const homePayload = payload.find(p => p.dataKey === homeTeam.name);
    const awayPayload = payload.find(p => p.dataKey === awayTeam.name);

    return (
      <div className="bg-card p-3 border rounded-lg shadow-lg text-sm">
        <p className="font-bold text-base mb-2">{`${dataPoint.interval}`}</p>
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

export function PressureBattleChart({ data, homeTeam, awayTeam, height = 350 }: PressureBattleChartProps) {
  const isMatchTrend = data.some(d => d.interval.startsWith('M'));

  const maxY = useMemo(() => {
    const vals = data.flatMap(d => [Number(d[homeTeam.name]), Number(d[awayTeam.name])]).filter(v => v > 0);
    const maxVal = vals.length > 0 ? Math.max(...vals) : 15;
    return Math.ceil(maxVal * 1.3);
  }, [data, homeTeam, awayTeam]);

  const chartData = useMemo(() => {
    const withX = data.map((d, i) => ({ ...d, x: i }));
    const result = [];
    
    for (let i = 0; i < withX.length - 1; i++) {
      const p1 = withX[i];
      const p2 = withX[i+1];
      const v1_1 = Number(p1[homeTeam.name]);
      const v1_2 = Number(p1[awayTeam.name]);
      const v2_1 = Number(p2[homeTeam.name]);
      const v2_2 = Number(p2[awayTeam.name]);

      result.push(p1);

      const diff1 = v1_1 - v1_2;
      const diff2 = v2_1 - v2_2;

      if (diff1 * diff2 < 0) {
        const t = Math.abs(diff1) / (Math.abs(diff1) + Math.abs(diff2));
        const intersectV = v1_1 + t * (v2_1 - v1_1);
        result.push({
          interval: "",
          x: i + t,
          [homeTeam.name]: intersectV,
          [awayTeam.name]: intersectV,
          isIntersection: true
        });
      }
    }
    result.push(withX[withX.length - 1]);

    return result.map(d => {
      const hVal = Number(d[homeTeam.name]);
      const aVal = Number(d[awayTeam.name]);
      
      // SPP는 낮을수록 시각적으로 상단 (reversed 축).
      return {
        ...d,
        [homeTeam.name]: hVal,
        [awayTeam.name]: aVal,
        homeLead: hVal <= aVal ? [hVal, aVal] : [aVal, aVal],
        awayLead: aVal < hVal ? [aVal, hVal] : [hVal, hVal],
      };
    });
  }, [data, homeTeam, awayTeam]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isMatchTrend ? 'Pressure Battle Trend (경기별 SPP 추이)' : 'Pressure Battle (3분 단위 SPP 추이)'}</CardTitle>
        <CardDescription>
          시각적으로 상단(높은 압박 강도)에 위치한 팀의 색상으로 격차가 표시됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis 
              type="number"
              dataKey="x"
              domain={[0, data.length - 1]}
              ticks={data.map((_, i) => i)}
              tickFormatter={(val) => data[val]?.interval || ""}
            />
            <YAxis reversed domain={[0, maxY]} label={{ value: 'SPP (s)', angle: -90, position: 'insideLeft' }} />
            <Tooltip content={<CustomTooltip homeTeam={homeTeam} awayTeam={awayTeam} />} />
            <Legend />
            
            <Area
              type="linear"
              dataKey="homeLead"
              fill={homeTeam.color}
              fillOpacity={0.3}
              stroke="none"
              legendType="none"
              tooltipType="none"
              connectNulls
            />

            <Area
              type="linear"
              dataKey="awayLead"
              fill={awayTeam.color}
              fillOpacity={0.3}
              stroke="none"
              legendType="none"
              tooltipType="none"
              connectNulls
            />

            <Line 
              type="linear" 
              dataKey={homeTeam.name} 
              stroke={homeTeam.color} 
              strokeWidth={3} 
              dot={(props: any) => {
                const { key, ...rest } = props;
                return props.payload.isIntersection ? null : <circle key={key} {...rest} r={6} fill={homeTeam.color} />;
              }}
              activeDot={{ r: 8 }} 
            />
            <Line 
              type="linear" 
              dataKey={awayTeam.name} 
              stroke={awayTeam.color} 
              strokeWidth={3} 
              dot={(props: any) => {
                const { key, ...rest } = props;
                return props.payload.isIntersection ? null : <circle key={key} {...rest} r={6} fill={awayTeam.color} />;
              }}
              activeDot={{ r: 8 }} 
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
