
"use client"

import React from "react"
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Label,
  Cell,
  LabelList,
  CartesianGrid
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface QuadrantPoint {
  name: string
  x: number
  y: number
  z: number
  color?: string
}

interface TacticalQuadrantChartProps {
  title: string
  description: string
  data: QuadrantPoint[]
  xAxisLabel: string
  yAxisLabel: string
  avgX: number
  avgY: number
  selectedTeamName: string
  selectedColor: string
  xUnit?: string
  yUnit?: string
  reversedY?: boolean
  reversedX?: boolean
  labels?: {
    tr: string; // Top-Right
    tl: string; // Top-Left
    br: string; // Bottom-Right
    bl: string; // Bottom-Left
  }
}

const CustomTooltip = ({ active, payload, xLabel, yLabel, xUnit, yUnit }: any) => {
  if (active && payload && payload.length) {
    const p = payload[0].payload
    return (
      <div className="bg-card p-3 border-2 rounded-lg shadow-xl text-xs">
        <p className="font-black border-b pb-1 mb-2 text-primary uppercase italic">{p.name}</p>
        <div className="space-y-1 font-bold">
          <p>{xLabel}: <span className="text-primary">{p.x.toFixed(1)}{xUnit}</span></p>
          <p>{yLabel}: <span className="text-primary">{p.y.toFixed(1)}{yUnit}</span></p>
        </div>
      </div>
    )
  }
  return null
}

export function TacticalQuadrantChart({
  title,
  description,
  data,
  xAxisLabel,
  yAxisLabel,
  avgX,
  avgY,
  selectedTeamName,
  selectedColor,
  xUnit = "",
  yUnit = "",
  reversedY = false,
  reversedX = false,
  labels
}: TacticalQuadrantChartProps) {
  
  // 데이터 가시 범위 계산 (배경색이 잘리거나 안 보이는 현상 방지)
  const maxX = Math.max(...data.map(d => d.x), avgX * 1.5, 10) * 1.1;
  const maxY = Math.max(...data.map(d => d.y), avgY * 1.5, 10) * 1.1;

  // 배경 영역을 위한 충분히 큰 값
  const farX = maxX * 2;
  const farY = maxY * 2;

  return (
    <Card className="border-2 shadow-xl overflow-hidden">
      <CardHeader className="bg-muted/10 pb-4 border-b">
        <CardTitle className="text-2xl font-black italic text-primary uppercase tracking-tighter">{title}</CardTitle>
        <CardDescription className="text-sm font-bold text-muted-foreground uppercase">{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-8">
        <div className="h-[650px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 40, right: 60, bottom: 60, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              
              {/* 4분면 배경색 - 데이터가 어느 범위에 있든 항상 보이도록 avgX/avgY 기준으로 영역 분할 */}
              {/* TR: High X, High Y */}
              <ReferenceArea 
                x1={avgX} x2={farX} 
                y1={avgY} y2={farY} 
                fill="#4bc0c0" fillOpacity={0.12}
              >
                {labels?.tr && <Label value={labels.tr} position="insideTopRight" offset={15} className="fill-emerald-800 font-black text-[11px] uppercase italic tracking-tighter" />}
              </ReferenceArea>

              {/* TL: Low X, High Y */}
              <ReferenceArea 
                x1={0} x2={avgX} 
                y1={avgY} y2={farY} 
                fill="#4bc0c0" fillOpacity={0.06}
              >
                {labels?.tl && <Label value={labels.tl} position="insideTopLeft" offset={15} className="fill-teal-800 font-black text-[11px] uppercase italic tracking-tighter" />}
              </ReferenceArea>

              {/* BR: High X, Low Y */}
              <ReferenceArea 
                x1={avgX} x2={farX} 
                y1={0} y2={avgY} 
                fill="#94a3b8" fillOpacity={0.08}
              >
                {labels?.br && <Label value={labels.br} position="insideBottomRight" offset={15} className="fill-slate-700 font-black text-[11px] uppercase italic tracking-tighter" />}
              </ReferenceArea>

              {/* BL: Low X, Low Y */}
              <ReferenceArea 
                x1={0} x2={avgX} 
                y1={0} y2={avgY} 
                fill="#6366f1" fillOpacity={0.05}
              >
                {labels?.bl && <Label value={labels.bl} position="insideBottomLeft" offset={15} className="fill-indigo-800 font-black text-[11px] uppercase italic tracking-tighter" />}
              </ReferenceArea>

              <XAxis 
                type="number" 
                dataKey="x" 
                name={xAxisLabel} 
                reversed={reversedX}
                domain={[0, maxX]}
                tick={{ fontSize: 12, fontWeight: 'bold' }}
              >
                <Label value={`${xAxisLabel} ➝`} position="bottom" offset={30} className="fill-foreground text-xs font-black uppercase tracking-widest" />
              </XAxis>
              <YAxis 
                type="number" 
                dataKey="y" 
                name={yAxisLabel} 
                reversed={reversedY}
                domain={[0, maxY]}
                tick={{ fontSize: 12, fontWeight: 'bold' }}
                label={{ value: `${yAxisLabel} (↑ High / ↓ Low)`, angle: -90, position: 'insideLeft', className: "fill-foreground text-xs font-black uppercase tracking-widest" }}
              />
              <ZAxis type="number" dataKey="z" range={[400, 1000]} />
              <Tooltip content={<CustomTooltip xLabel={xAxisLabel} yLabel={yAxisLabel} xUnit={xUnit} yUnit={yUnit} />} />
              
              <ReferenceLine x={avgX} stroke="hsl(var(--foreground))" strokeDasharray="3 3" strokeWidth={1} opacity={0.3} />
              <ReferenceLine y={avgY} stroke="hsl(var(--foreground))" strokeDasharray="3 3" strokeWidth={1} opacity={0.3} />

              <Scatter data={data} shape="circle">
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.name === selectedTeamName ? selectedColor : (entry.color || "#94a3b8")}
                    fillOpacity={entry.name === selectedTeamName ? 1 : 0.6}
                    stroke={entry.name === selectedTeamName ? 'black' : 'none'}
                    strokeWidth={entry.name === selectedTeamName ? 1.5 : 0}
                  />
                ))}
                <LabelList 
                  dataKey="name" 
                  position="top" 
                  offset={10} 
                  content={(props: any) => {
                    const { x, y, value } = props;
                    const isSelected = value === selectedTeamName;
                    return (
                      <text 
                        x={x} 
                        y={y - 12} 
                        textAnchor="middle" 
                        fill={isSelected ? selectedColor : "hsl(var(--muted-foreground))"}
                        style={{ 
                          fontSize: '11px', 
                          fontWeight: isSelected ? '600' : '500', // 너무 굵지 않게 조정
                          paintOrder: 'stroke',
                          stroke: 'white',
                          strokeWidth: 2
                        }}
                      >
                        {value}
                      </text>
                    );
                  }}
                />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
