
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
  Area,
  ReferenceLine,
  Label
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { AttackThreatDataPoint, Team, MatchEvent } from "@/lib/types"
import { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent'

interface AttackThreatChartProps {
  data: AttackThreatDataPoint[]
  homeTeam: Team
  awayTeam: Team
  events?: MatchEvent[]
}

const CustomTooltip = ({ active, payload, homeTeam, awayTeam }: TooltipProps<ValueType, NameType> & { homeTeam: Team, awayTeam: Team }) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload;
    if (dataPoint.isIntersection) return null;

    const homePayload = payload.find(p => p.dataKey === homeTeam.name);
    const awayPayload = payload.find(p => p.dataKey === awayTeam.name);
    
    const lastGoal = dataPoint.goals && dataPoint.goals.length > 0 
      ? dataPoint.goals[dataPoint.goals.length - 1] 
      : null;

    return (
      <div className="bg-card p-3 border rounded-lg shadow-lg text-sm">
        {lastGoal && (
          <div className="mb-2 pb-2 border-b">
            <p className="text-lg font-bold text-amber-500 animate-pulse">⚽ GOAL! ({lastGoal.team})</p>
             <p className="font-semibold text-muted-foreground">{`Time: ${lastGoal.time.minute}'${lastGoal.time.second}"`}</p>
            <p className="font-semibold text-muted-foreground">{`Score: ${lastGoal.score}`}</p>
          </div>
        )}
        <p className="font-bold text-base mb-2">{dataPoint.interval ? dataPoint.interval : `${Math.floor(dataPoint.x)}' - ${Math.ceil(dataPoint.x)}'`}</p>
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

const CustomDot = (props: any) => {
    const { cx, cy, payload, color, teamName } = props;

    if (payload.isIntersection) {
        return null;
    }

    const teamGoals = payload.goals ? payload.goals.filter((g: any) => g.team === teamName) : [];

    return (
        <g>
            <circle cx={cx} cy={cy} r={4} fill={color} />
            
            {teamGoals.map((goal: any, index: number) => (
                 <g key={goal.time.minute * 60 + goal.time.second} transform={`translate(${cx}, ${cy - index * 18})`}>
                     <defs>
                        <filter id="shadow-sm" x="-50%" y="-50%" width="200%" height="200%">
                            <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000000" floodOpacity="0.5"/>
                        </filter>
                    </defs>
                    <circle cx={0} cy={0} r={8} fill={color} stroke="#fff" strokeWidth={1} filter="url(#shadow-sm)"/>
                    <text x={0} y={0} dy={4} textAnchor="middle" fill="white" fontSize="10">⚽</text>
                </g>
            ))}
        </g>
    );
};


export function AttackThreatChart({ data, homeTeam, awayTeam, events = [] }: AttackThreatChartProps) {
  const isMatchTrend = data.some(d => d.interval.startsWith('M'));
  const TIME_INTERVAL = 3;

  const chartData = useMemo(() => {
    if (isMatchTrend) {
        return data.map((d, i) => ({ ...d, x: i }));
    }

    const originalData = data.map(d => ({
      ...d,
      x: parseInt(d.interval.replace("'", "")),
    }));
    originalData.unshift({ interval: "0'", [homeTeam.name]: 0, [awayTeam.name]: 0, x: 0 });
    originalData.sort((a,b) => a.x - b.x);

    const maxTime = Math.max(...originalData.map(p => p.x));
    let baseData = []; 

    for (let time = 0; time <= maxTime; time += TIME_INTERVAL) {
        const p_after = originalData.find(p => p.x >= time);
        const p_before = originalData.slice().reverse().find(p => p.x <= time);

        if (!p_before || !p_after) {
            continue;
        }

        let homeValue, awayValue;

        if (p_before.x === p_after.x) { 
            homeValue = Number(p_before[homeTeam.name]);
            awayValue = Number(p_before[awayTeam.name]);
        } else { 
            const t = (time - p_before.x) / (p_after.x - p_before.x);
            homeValue = Number(p_before[homeTeam.name]) + t * (Number(p_after[homeTeam.name]) - Number(p_before[homeTeam.name]));
            awayValue = Number(p_before[awayTeam.name]) + t * (Number(p_after[awayTeam.name]) - Number(p_before[awayTeam.name]));
        }

        baseData.push({
            interval: `${time}'`,
            x: time,
            [homeTeam.name]: homeValue,
            [awayTeam.name]: awayValue,
            goals: [] as any[]
        });
    }

    if (events.length > 0) {
        let homeScore = 0;
        let awayScore = 0;
        const sortedGoals = [...events]
            .filter(e => e.type === 'goal')
            .sort((a, b) => (a.time * 60) - (b.time * 60));

        sortedGoals.forEach(goal => {
            if (goal.team === homeTeam.name) homeScore++;
            else if (goal.team === awayTeam.name) awayScore++;
            const currentScore = `${homeScore} - ${awayScore}`;

            const timeInMinutes = goal.time / 60;
            
            let k = Math.ceil(timeInMinutes / TIME_INTERVAL);
            if (timeInMinutes > 0 && k === 0) { 
                k = 1;
            }
            const targetX = k * TIME_INTERVAL;

            const targetDataPoint = baseData.find(p => p.x === targetX);
            if (targetDataPoint) {
                targetDataPoint.goals.push({...goal, score: currentScore, time: { minute: Math.floor(goal.time/60), second: Math.floor(goal.time%60) } });
            }
        });
    }

    const sortedBaseData = baseData.sort((a, b) => a.x - b.x);
    const result = [];
    for (let i = 0; i < sortedBaseData.length - 1; i++) {
        const p1 = sortedBaseData[i];
        const p2 = sortedBaseData[i + 1];
        result.push(p1);

        const v1_1 = Number(p1[homeTeam.name]);
        const v1_2 = Number(p1[awayTeam.name]);
        const v2_1 = Number(p2[homeTeam.name]);
        const v2_2 = Number(p2[awayTeam.name]);
        const diff1 = v1_1 - v1_2;
        const diff2 = v2_1 - v2_2;

        if (diff1 * diff2 < 0) {
            const t = Math.abs(diff1) / (Math.abs(diff1) + Math.abs(diff2));
            const intersectX = p1.x + t * (p2.x - p1.x);
            const intersectV = v1_1 + t * (v2_1 - v1_1);
            result.push({
                interval: "",
                x: intersectX,
                [homeTeam.name]: intersectV,
                [awayTeam.name]: intersectV,
                isIntersection: true,
                goals: []
            });
        }
    }
    result.push(sortedBaseData[sortedBaseData.length - 1]);

    return result.sort((a,b)=> a.x - b.x).map(d => ({
        ...d,
        [homeTeam.name]: Number(d[homeTeam.name]),
        [awayTeam.name]: Number(d[awayTeam.name]),
        homeLead: Number(d[homeTeam.name]) >= Number(d[awayTeam.name]) ? [Number(d[awayTeam.name]), Number(d[homeTeam.name])] : [Number(d[homeTeam.name]), Number(d[homeTeam.name])],
        awayLead: Number(d[awayTeam.name]) > Number(d[homeTeam.name]) ? [Number(d[homeTeam.name]), Number(d[awayTeam.name])] : [Number(d[awayTeam.name]), Number(d[awayTeam.name])],
    }));
  }, [data, homeTeam, awayTeam, isMatchTrend, events]);

  const quarterBoundaries = [
    { x: 15, label: 'Q1 | Q2' },
    { x: 30, label: 'H.T.' },
    { x: 45, label: 'Q3 | Q4' }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isMatchTrend ? 'Attack Threat Trend (경기별 추이)' : 'Attack Threat Trend (3분 단위)'}</CardTitle>
        <CardDescription>
          상단에 위치한 팀의 색상으로 격차가 표시됩니다. {!isMatchTrend && '15분 단위로 쿼터가 구분됩니다. 득점 발생 시점에 ⚽ 아이콘이 표시됩니다.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={chartData} margin={{ top: 30, right: 30, left: 20, bottom: isMatchTrend ? 50 : 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis
                    type="number"
                    dataKey="x"
                    domain={[0, 'dataMax']}
                    ticks={chartData.filter(d => d.interval && !d.isIntersection).map(d => d.x)}
                    tickFormatter={(val) => chartData.find(d => d.x === val)?.interval || ""}
                    tick={{ fontSize: 10 }}
                    height={isMatchTrend ? 60 : 30}
                    angle={isMatchTrend ? -45 : 0}
                    textAnchor={isMatchTrend ? 'end' : 'middle'}
                    allowDecimals={false}
                />
                <YAxis 
                  label={{ value: '공격 위협도(슈팅+PC)', angle: -90, position: 'insideLeft' }} 
                  allowDecimals={false} 
                  domain={[0, 8]}
                />
                <Tooltip content={<CustomTooltip homeTeam={homeTeam} awayTeam={awayTeam} />} />
                <Legend verticalAlign="top" height={36} />
                
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

                <Area type="linear" dataKey="homeLead" fill={homeTeam.color} fillOpacity={0.3} stroke="none" legendType="none" tooltipType="none" connectNulls />
                <Area type="linear" dataKey="awayLead" fill={awayTeam.color} fillOpacity={0.3} stroke="none" legendType="none" tooltipType="none" connectNulls />

                <Line 
                  type="linear" 
                  dataKey={homeTeam.name} 
                  stroke={homeTeam.color} 
                  strokeWidth={3} 
                  dot={<CustomDot color={homeTeam.color} teamName={homeTeam.name}/>}
                  activeDot={{ r: 8 }} 
                  connectNulls
                />
                <Line 
                  type="linear" 
                  dataKey={awayTeam.name} 
                  stroke={awayTeam.color} 
                  strokeWidth={3} 
                  dot={<CustomDot color={awayTeam.color} teamName={awayTeam.name}/>}
                  activeDot={{ r: 8 }} 
                  connectNulls
                />
            </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
