
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
  opponentColor: string
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
  opponentColor,
  xUnit = "",
  yUnit = "",
  reversedY = false,
  reversedX = false,
  labels
}: TacticalQuadrantChartProps) {
  return (
    <Card className="border-2 shadow-xl">
      <CardHeader className="bg-muted/10 pb-4 border-b">
        <CardTitle className="text-2xl font-black italic text-primary uppercase tracking-tighter">{title}</CardTitle>
        <CardDescription className="text-sm font-bold text-muted-foreground uppercase">{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-8">
        <div className="h-[600px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 40, right: 100, bottom: 60, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              
              {/* 사분면 의미 라벨 영역 */}
              {labels && (
                <>
                  <ReferenceArea x1={reversedX ? avgX * 2 : avgX} x2={reversedX ? avgX : avgX * 2} y1={reversedY ? avgY : avgY * 2} y2={reversedY ? avgY * 2 : avgY} fill="transparent">
                    <Label value={labels.tr} position="insideTopRight" offset={10} className="fill-primary/40 font-black text-xs uppercase italic" />
                  </ReferenceArea>
                  <ReferenceArea x1={reversedX ? avgX : 0} x2={reversedX ? 0 : avgX} y1={reversedY ? avgY : avgY * 2} y2={reversedY ? avgY * 2 : avgY} fill="transparent">
                    <Label value={labels.tl} position="insideTopLeft" offset={10} className="fill-primary/40 font-black text-xs uppercase italic" />
                  </ReferenceArea>
                  <ReferenceArea x1={reversedX ? avgX * 2 : avgX} x2={reversedX ? avgX : avgX * 2} y1={reversedY ? 0 : avgY} y2={reversedY ? avgY : 0} fill="transparent">
                    <Label value={labels.br} position="insideBottomRight" offset={10} className="fill-primary/40 font-black text-xs uppercase italic" />
                  </ReferenceArea>
                  <ReferenceArea x1={reversedX ? avgX : 0} x2={reversedX ? 0 : avgX} y1={reversedY ? 0 : avgY} y2={reversedY ? avgY : 0} fill="transparent">
                    <Label value={labels.bl} position="insideBottomLeft" offset={10} className="fill-primary/40 font-black text-xs uppercase italic" />
                  </ReferenceArea>
                </>
              )}

              <XAxis 
                type="number" 
                dataKey="x" 
                name={xAxisLabel} 
                reversed={reversedX}
                domain={['auto', 'auto']}
                tick={{ fontSize: 12, fontWeight: 'bold' }}
              >
                <Label value={xAxisLabel} position="bottom" offset={30} className="fill-foreground text-sm font-black uppercase tracking-widest" />
              </XAxis>
              <YAxis 
                type="number" 
                dataKey="y" 
                name={yAxisLabel} 
                reversed={reversedY}
                domain={['auto', 'auto']}
                tick={{ fontSize: 12, fontWeight: 'bold' }}
              >
                <Label value={yAxisLabel} angle={-90} position="left" offset={0} className="fill-foreground text-sm font-black uppercase tracking-widest" />
              </YAxis>
              <ZAxis type="number" dataKey="z" range={[200, 800]} />
              <Tooltip content={<CustomTooltip xLabel={xAxisLabel} yLabel={yAxisLabel} xUnit={xUnit} yUnit={yUnit} />} />
              
              <ReferenceLine x={avgX} stroke="hsl(var(--foreground))" strokeDasharray="5 5" strokeWidth={2} opacity={0.4}>
                <Label value="AVG" position="top" style={{ fontSize: '10px', fontWeight: 'bold', fill: 'hsl(var(--muted-foreground))' }} />
              </ReferenceLine>
              <ReferenceLine y={avgY} stroke="hsl(var(--foreground))" strokeDasharray="5 5" strokeWidth={2} opacity={0.4}>
                <Label value="AVG" position="right" style={{ fontSize: '10px', fontWeight: 'bold', fill: 'hsl(var(--muted-foreground))' }} />
              </ReferenceLine>

              <Scatter data={data} shape="circle">
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.name === selectedTeamName ? selectedColor : opponentColor}
                    fillOpacity={entry.name === selectedTeamName ? 1 : 0.4}
                    stroke={entry.name === selectedTeamName ? 'black' : 'none'}
                    strokeWidth={2}
                  />
                ))}
                <LabelList dataKey="name" position="bottom" offset={15} style={{ fontSize: '12px', fontWeight: '900', fill: 'hsl(var(--foreground))' }} />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
