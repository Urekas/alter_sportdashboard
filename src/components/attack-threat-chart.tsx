
"use client"

import React, { useMemo } from "react"
import {
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
  CartesianGrid,
  ComposedChart,
  Line,
  Area
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { AttackThreatDataPoint, Team } from "@/lib/types"
import { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent'

interface AttackThreatChartProps {
  data: AttackThreatDataPoint[]
  homeTeam: Team
  awayTeam: Team
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
          {`${homePayload.name}: ${Math.round(Number(homePayload.value))}`}
        </p>}
        {awayPayload && <p style={{ color: awayPayload.color }}>
          {`${awayPayload.name}: ${Math.round(Number(awayPayload.value))}`}
        </p>}
      </div>
    );
  }
  return null;
};

export function AttackThreatChart({ data, homeTeam, awayTeam }: AttackThreatChartProps) {
  const isMatchTrend = data.some(d => d.interval.startsWith('M'));

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

      // 두 선이 교차하는 경우 (격차의 부호가 바뀌는 경우)
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
      
      return {
        ...d,
        [homeTeam.name]: hVal,
        [awayTeam.name]: aVal,
        homeLead: hVal >= aVal ? [aVal, hVal] : [hVal, hVal],
        awayLead: aVal > hVal ? [hVal, aVal] : [aVal, aVal],
      };
    });
  }, [data, homeTeam, awayTeam]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isMatchTrend ? 'Attack Threat Trend (경기별 추이)' : 'Attack Threat Trend (5분 단위)'}</CardTitle>
        <CardDescription>
          상단에 위치한 팀의 색상으로 격차가 표시됩니다. 교차 지점에서 음영이 전환됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis 
              type="number"
              dataKey="x"
              domain={[0, data.length - 1]}
              ticks={data.map((_, i) => i)}
              tickFormatter={(val) => data[val]?.interval || ""}
            />
            <YAxis label={{ value: '공격 위협도', angle: -90, position: 'insideLeft' }} allowDecimals={false} />
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
            />

            <Area
              type="linear"
              dataKey="awayLead"
              fill={awayTeam.color}
              fillOpacity={0.3}
              stroke="none"
              legendType="none"
              tooltipType="none"
            />

            <Line 
              type="linear" 
              dataKey={homeTeam.name} 
              stroke={homeTeam.color} 
              strokeWidth={3} 
              dot={(props: any) => props.payload.isIntersection ? null : <circle {...props} r={6} fill={homeTeam.color} />}
              activeDot={{ r: 8 }} 
            />
            <Line 
              type="linear" 
              dataKey={awayTeam.name} 
              stroke={awayTeam.color} 
              strokeWidth={3} 
              dot={(props: any) => props.payload.isIntersection ? null : <circle {...props} r={6} fill={awayTeam.color} />}
              activeDot={{ r: 8 }} 
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
