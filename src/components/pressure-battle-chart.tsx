
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
  CartesianGrid,
  ReferenceLine,
  Label
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

  const chartData = useMemo(() => {
    // 0분 포인트 추가 (단일 경기 모드에서만)
    let baseData = [...data];
    if (!isMatchTrend && data.length > 0) {
      baseData = [
        { 
          interval: "0'", 
          [homeTeam.name]: data[0][homeTeam.name], 
          [awayTeam.name]: data[0][awayTeam.name] 
        },
        ...data
      ];
    }

    const withX = baseData.map((d, i) => ({ ...d, x: i }));
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
      const homeIsLeading = hVal <= aVal; // SPP는 낮을수록 리드(위에 위치)
      
      return {
        ...d,
        [homeTeam.name]: hVal,
        [awayTeam.name]: aVal,
        // 시각적으로 위에 있는 팀의 음영만 표시하기 위해 나머지는 겹침
        homeLead: homeIsLeading ? [aVal, hVal] : [hVal, hVal],
        awayLead: !homeIsLeading ? [hVal, aVal] : [aVal, aVal],
      };
    });
  }, [data, homeTeam, awayTeam, isMatchTrend]);

  const maxY = useMemo(() => {
    const vals = chartData.flatMap(d => [Number(d[homeTeam.name]), Number(d[awayTeam.name])]).filter(v => v > 0);
    const maxVal = vals.length > 0 ? Math.max(...vals) : 15;
    return Math.ceil(maxVal * 1.3);
  }, [chartData, homeTeam, awayTeam]);

  const quarterBoundaries = [
    { x: 5, label: 'Q1 | Q2' },
    { x: 10, label: 'Q2 | Q3' },
    { x: 15, label: 'Q3 | Q4' }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isMatchTrend ? 'Pressure Battle Trend (경기별 SPP 추이)' : 'Pressure Battle (3분 단위 SPP 추이)'}</CardTitle>
        <CardDescription>
          시각적으로 상단(높은 압박 강도)에 위치한 팀의 색상으로 격차가 표시됩니다. {!isMatchTrend && '15분 단위로 쿼터가 구분됩니다.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} margin={{ top: 30, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis 
              type="number"
              dataKey="x"
              domain={[0, 'dataMax']}
              ticks={chartData.filter(d => !d.isIntersection).map(d => d.x)}
              tickFormatter={(val) => chartData.find(d => d.x === val)?.interval || ""}
            />
            <YAxis reversed domain={[0, maxY]} label={{ value: 'SPP (s)', angle: -90, position: 'insideLeft' }} />
            <Tooltip content={<CustomTooltip homeTeam={homeTeam} awayTeam={awayTeam} />} />
            <Legend />
            
            {!isMatchTrend && quarterBoundaries.map((b, i) => (
              <ReferenceLine 
                key={i} 
                x={b.x} 
                stroke="hsl(var(--foreground))" 
                strokeDasharray="5 5" 
                strokeWidth={1}
                opacity={0.5}
              >
                <Label value={b.label} position="top" offset={10} style={{ fontSize: '10px', fontWeight: 'bold', fill: 'hsl(var(--muted-foreground))' }} />
              </ReferenceLine>
            ))}

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
                const { key, cx, cy } = props;
                if (props.payload.isIntersection) return null;
                return <circle key={key} cx={cx} cy={cy} r={6} fill={homeTeam.color} />;
              }}
              activeDot={{ r: 8 }} 
            />
            <Line 
              type="linear" 
              dataKey={awayTeam.name} 
              stroke={awayTeam.color} 
              strokeWidth={3} 
              dot={(props: any) => {
                const { key, cx, cy } = props;
                if (props.payload.isIntersection) return null;
                return <circle key={key} cx={cx} cy={cy} r={6} fill={awayTeam.color} />;
              }}
              activeDot={{ r: 8 }} 
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
