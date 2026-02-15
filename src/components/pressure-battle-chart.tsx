
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

const CustomTooltip = ({ active, payload, label, homeTeam, awayTeam }: TooltipProps<ValueType, NameType> & { homeTeam: Team, awayTeam: Team }) => {
  if (active && payload && payload.length) {
    const homePayload = payload.find(p => p.dataKey === homeTeam.name);
    const awayPayload = payload.find(p => p.dataKey === awayTeam.name);

    return (
      <div className="bg-card p-3 border rounded-lg shadow-lg text-sm">
        <p className="font-bold text-base mb-2">{`${label}`}</p>
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
    return data.map(d => {
      const hVal = Number(d[homeTeam.name]);
      const aVal = Number(d[awayTeam.name]);
      
      // SPP는 축이 반전되어 있으므로 수치가 낮을수록 시각적으로 위에 있음
      // 시각적으로 위에 있는 팀의 색상으로 격차를 채우기 위해 리드하지 않는 구간은 null 처리
      return {
        ...d,
        [homeTeam.name]: hVal,
        [awayTeam.name]: aVal,
        // 홈팀이 시각적으로 우세(위에 있음)할 때: hVal <= aVal
        homeLead: hVal <= aVal ? [hVal, aVal] : null,
        // 상대팀이 시각적으로 우세(위에 있음)할 때: aVal < hVal
        awayLead: aVal < hVal ? [aVal, hVal] : null,
      };
    });
  }, [data, homeTeam, awayTeam]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isMatchTrend ? 'Pressure Battle Trend (경기별 SPP 추이)' : 'Pressure Battle (3분 단위 SPP 추이)'}</CardTitle>
        <CardDescription>
          {isMatchTrend 
            ? `${homeTeam.name}와 상대 팀의 SPP(압박 지수) 변화입니다. 음영은 시각적으로 상단(높은 압박)에 위치한 팀의 색상입니다.` 
            : 'SPP 추이입니다. 상단에 위치할수록 압박 강도가 높음을 의미합니다.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="interval" interval={0} />
            <YAxis reversed domain={[0, maxY]} label={{ value: 'SPP (s)', angle: -90, position: 'insideLeft' }} />
            <Tooltip content={<CustomTooltip homeTeam={homeTeam} awayTeam={awayTeam} />} />
            <Legend />
            
            {/* 홈팀 우세 구간 음영 */}
            <Area
              type="monotone"
              dataKey="homeLead"
              fill={homeTeam.color}
              fillOpacity={0.2}
              stroke="none"
              legendType="none"
              tooltipType="none"
              connectNulls={false}
            />

            {/* 상대팀 우세 구간 음영 */}
            <Area
              type="monotone"
              dataKey="awayLead"
              fill={awayTeam.color}
              fillOpacity={0.2}
              stroke="none"
              legendType="none"
              tooltipType="none"
              connectNulls={false}
            />

            <Line 
              type="monotone" 
              dataKey={homeTeam.name} 
              stroke={homeTeam.color} 
              strokeWidth={3} 
              dot={{ r: 6, fill: homeTeam.color }}
              activeDot={{ r: 8 }} 
            />
            <Line 
              type="monotone" 
              dataKey={awayTeam.name} 
              stroke={awayTeam.color} 
              strokeWidth={3} 
              dot={{ r: 6, fill: awayTeam.color }}
              activeDot={{ r: 8 }} 
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
