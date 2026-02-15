
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
  Label,
  Cell
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
  reversedX = false
}: TacticalQuadrantChartProps) {
  return (
    <Card className="border-2 shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="bg-muted/10 pb-2 border-b">
        <CardTitle className="text-lg font-black italic text-primary uppercase tracking-tighter">{title}</CardTitle>
        <CardDescription className="text-[10px] font-bold text-muted-foreground uppercase">{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
              <XAxis 
                type="number" 
                dataKey="x" 
                name={xAxisLabel} 
                reversed={reversedX}
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fontWeight: 'bold' }}
              >
                <Label value={xAxisLabel} position="bottom" offset={0} className="fill-muted-foreground text-[10px] font-black uppercase" />
              </XAxis>
              <YAxis 
                type="number" 
                dataKey="y" 
                name={yAxisLabel} 
                reversed={reversedY}
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fontWeight: 'bold' }}
              >
                <Label value={yAxisLabel} angle={-90} position="left" className="fill-muted-foreground text-[10px] font-black uppercase" />
              </YAxis>
              <ZAxis type="number" dataKey="z" range={[100, 400]} />
              <Tooltip content={<CustomTooltip xLabel={xAxisLabel} yLabel={yAxisLabel} xUnit={xUnit} yUnit={yUnit} />} />
              
              {/* 대회 평균선 */}
              <ReferenceLine x={avgX} stroke="hsl(var(--foreground))" strokeDasharray="3 3" opacity={0.3}>
                <Label value="AVG" position="top" style={{ fontSize: '8px', fontWeight: 'bold', fill: 'hsl(var(--muted-foreground))' }} />
              </ReferenceLine>
              <ReferenceLine y={avgY} stroke="hsl(var(--foreground))" strokeDasharray="3 3" opacity={0.3}>
                <Label value="AVG" position="right" style={{ fontSize: '8px', fontWeight: 'bold', fill: 'hsl(var(--muted-foreground))' }} />
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
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
