
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

const CustomTooltip = ({ active, payload, label, homeTeam, awayTeam }: TooltipProps<ValueType, NameType> & { homeTeam: Team, awayTeam: Team }) => {
  if (active && payload && payload.length) {
    const homePayload = payload.find(p => p.dataKey === homeTeam.name);
    const awayPayload = payload.find(p => p.dataKey === awayTeam.name);

    return (
      <div className="bg-card p-3 border rounded-lg shadow-lg text-sm">
        <p className="font-bold text-base mb-2">{`${label}`}</p>
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
    return data.map(current => {
      const hVal = Number(current[homeTeam.name]);
      const aVal = Number(current[awayTeam.name]);
      
      // 음영이 선 밖으로 나가지 않도록 리드하지 않는 팀의 영역은 해당 지점의 낮은 선 수치로 수렴시킴
      return {
        ...current,
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
          {isMatchTrend 
            ? `${homeTeam.name}와 상대 팀의 공격 위협도 비교입니다. 음영은 상단에 위치한 팀의 색상으로 격차를 나타냅니다.` 
            : '5분 단위 슈팅 및 페널티코너 합산 위협도 추이입니다.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="interval" interval={0} />
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
              connectNulls={true}
            />

            <Area
              type="linear"
              dataKey="awayLead"
              fill={awayTeam.color}
              fillOpacity={0.3}
              stroke="none"
              legendType="none"
              tooltipType="none"
              connectNulls={true}
            />

            <Line 
              type="linear" 
              dataKey={homeTeam.name} 
              stroke={homeTeam.color} 
              strokeWidth={3} 
              dot={{ r: 6, fill: homeTeam.color }}
              activeDot={{ r: 8 }} 
            />
            <Line 
              type="linear" 
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
