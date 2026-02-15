
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
        <p className="font-bold border-b pb-1 mb-2 text-primary uppercase italic">{p.name}</p>
        <div className="space-y-1">
          <p>{xLabel}: <span className="font-bold">{p.x.toFixed(1)}{xUnit}</span></p>
          <p>{yLabel}: <span className="font-bold">{p.y.toFixed(1)}{yUnit}</span></p>
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
  
  // 축의 가시 범위를 명시적으로 계산 (데이터 + 여백)
  const maxX = Math.max(...data.map(d => d.x), avgX * 1.5, 10) * 1.1;
  const maxY = Math.max(...data.map(d => d.y), avgY * 1.5, 10) * 1.1;

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
              
              {/* 4분면 배경색 - 계산된 maxX, maxY 범위 내에서 꽉 채움 */}
              {/* TR: High X, High Y */}
              <ReferenceArea 
                x1={avgX} x2={maxX} 
                y1={avgY} y2={maxY} 
                fill="#4bc0c0" fillOpacity={0.15}
              >
                {labels?.tr && <Label value={labels.tr} position="insideTopRight" offset={20} style={{ fill: '#065f46', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }} />}
              </ReferenceArea>

              {/* TL: Low X, High Y */}
              <ReferenceArea 
                x1={0} x2={avgX} 
                y1={avgY} y2={maxY} 
                fill="#4bc0c0" fillOpacity={0.08}
              >
                {labels?.tl && <Label value={labels.tl} position="insideTopLeft" offset={20} style={{ fill: '#0f766e', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }} />}
              </ReferenceArea>

              {/* BR: High X, Low Y */}
              <ReferenceArea 
                x1={avgX} x2={maxX} 
                y1={0} y2={avgY} 
                fill="#94a3b8" fillOpacity={0.1}
              >
                {labels?.br && <Label value={labels.br} position="insideBottomRight" offset={20} style={{ fill: '#334155', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }} />}
              </ReferenceArea>

              {/* BL: Low X, Low Y */}
              <ReferenceArea 
                x1={0} x2={avgX} 
                y1={0} y2={avgY} 
                fill="#6366f1" fillOpacity={0.06}
              >
                {labels?.bl && <Label value={labels.bl} position="insideBottomLeft" offset={20} style={{ fill: '#3730a3', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }} />}
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
                    fillOpacity={entry.name === selectedTeamName ? 1 : 0.7}
                    stroke={entry.name === selectedTeamName ? '#000' : 'none'}
                    strokeWidth={entry.name === selectedTeamName ? 2 : 0}
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
                          fontWeight: isSelected ? '600' : '500',
                          opacity: isSelected ? 1 : 0.8
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
