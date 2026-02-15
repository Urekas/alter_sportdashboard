
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
    tr: string; // Top-Right (Positive)
    tl: string; // Top-Left
    br: string; // Bottom-Right
    bl: string; // Bottom-Left (Negative)
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
  
  // 데이터의 최대 범위를 계산하여 사분면 배경을 꽉 채움
  const maxX = Math.max(...data.map(d => d.x), avgX * 1.5, 1);
  const maxY = Math.max(...data.map(d => d.y), avgY * 1.5, 1);

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
              
              {/* 사분면 배경 및 라벨 (전술 궤적 스타일) */}
              {/* Top-Right Area (Positive) */}
              <ReferenceArea 
                x1={reversedX ? 0 : avgX} x2={reversedX ? avgX : maxX * 1.2} 
                y1={reversedY ? 0 : avgY} y2={reversedY ? avgY : maxY * 1.2} 
                fill="#4bc0c0" fillOpacity={0.1}
              >
                {labels?.tr && <Label value={labels.tr} position="insideTopRight" offset={15} className="fill-emerald-700 font-black text-[10px] uppercase italic tracking-tighter" />}
              </ReferenceArea>

              {/* Top-Left Area */}
              <ReferenceArea 
                x1={reversedX ? avgX : maxX * 1.2} x2={reversedX ? maxX * 1.2 : avgX} 
                y1={reversedY ? 0 : avgY} y2={reversedY ? avgY : maxY * 1.2} 
                fill="#4bc0c0" fillOpacity={0.04}
              >
                {labels?.tl && <Label value={labels.tl} position="insideTopLeft" offset={15} className="fill-teal-700 font-black text-[10px] uppercase italic tracking-tighter" />}
              </ReferenceArea>

              {/* Bottom-Right Area */}
              <ReferenceArea 
                x1={reversedX ? 0 : avgX} x2={reversedX ? avgX : maxX * 1.2} 
                y1={reversedY ? maxY * 1.2 : avgY} y2={reversedY ? avgY : 0} 
                fill="#94a3b8" fillOpacity={0.06}
              >
                {labels?.br && <Label value={labels.br} position="insideBottomRight" offset={15} className="fill-slate-600 font-black text-[10px] uppercase italic tracking-tighter" />}
              </ReferenceArea>

              {/* Bottom-Left Area (Negative) */}
              <ReferenceArea 
                x1={reversedX ? avgX : maxX * 1.2} x2={reversedX ? maxX * 1.2 : avgX} 
                y1={reversedY ? maxY * 1.2 : avgY} y2={reversedY ? avgY : 0} 
                fill="#6366f1" fillOpacity={0.04}
              >
                {labels?.bl && <Label value={labels.bl} position="insideBottomLeft" offset={15} className="fill-indigo-700 font-black text-[10px] uppercase italic tracking-tighter" />}
              </ReferenceArea>

              <XAxis 
                type="number" 
                dataKey="x" 
                name={xAxisLabel} 
                reversed={reversedX}
                domain={[0, 'auto']}
                tick={{ fontSize: 12, fontWeight: 'bold' }}
              >
                <Label value={`${xAxisLabel} ${reversedX ? '➝' : '➝'}`} position="bottom" offset={30} className="fill-foreground text-xs font-black uppercase tracking-widest" />
              </XAxis>
              <YAxis 
                type="number" 
                dataKey="y" 
                name={yAxisLabel} 
                reversed={reversedY}
                domain={[0, 'auto']}
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
                    strokeWidth={entry.name === selectedTeamName ? 2 : 0}
                  />
                ))}
                <LabelList 
                  dataKey="name" 
                  position="bottom" 
                  offset={12} 
                  style={{ 
                    fontSize: '11px', 
                    fontWeight: '700', 
                    fill: 'hsl(var(--muted-foreground))',
                    opacity: 0.8
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
