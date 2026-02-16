
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
  LabelList,
  ReferenceLine,
  ReferenceArea,
  Label,
  Cell
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface TacticalQuadrantChartProps {
  title: string
  description: string
  data: any[]
  xAxisLabel: string
  yAxisLabel: string
  avgX: number
  avgY: number
  selectedTeamName?: string
  selectedColor?: string
  reversedX?: boolean
  reversedY?: boolean
  labels: {
    tr: string
    tl: string
    br: string
    bl: string
  }
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
  reversedX,
  reversedY,
  labels
}: TacticalQuadrantChartProps) {
  
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload
      return (
        <div className="bg-card p-2 border rounded shadow-lg text-xs">
          <p className="font-bold border-b mb-1" style={{ color: p.color }}>{p.name}</p>
          <p>{xAxisLabel}: <span className="font-bold">{p.x.toFixed(1)}</span></p>
          <p>{yAxisLabel}: <span className="font-bold">{p.y.toFixed(1)}</span></p>
        </div>
      )
    }
    return null
  }

  const allX = data.map(d => d.x).concat(avgX)
  const allY = data.map(d => d.y).concat(avgY)
  const minX = Math.floor(Math.min(...allX) * 0.8)
  const maxX = Math.ceil(Math.max(...allX) * 1.2)
  const minY = Math.floor(Math.min(...allY) * 0.8)
  const maxY = Math.ceil(Math.max(...allY) * 1.2)

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold">{title}</CardTitle>
        <CardDescription className="text-[10px] leading-tight">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
              <XAxis 
                type="number" 
                dataKey="x" 
                name={xAxisLabel} 
                domain={[minX, maxX]} 
                reversed={reversedX}
                tick={{ fontSize: 10 }}
              >
                <Label value={xAxisLabel} position="bottom" offset={0} style={{ fontSize: '10px', fill: 'hsl(var(--muted-foreground))' }} />
              </XAxis>
              <YAxis 
                type="number" 
                dataKey="y" 
                name={yAxisLabel} 
                domain={[minY, maxY]} 
                reversed={reversedY}
                tick={{ fontSize: 10 }}
              >
                <Label value={yAxisLabel} angle={-90} position="insideLeft" style={{ fontSize: '10px', fill: 'hsl(var(--muted-foreground))' }} />
              </YAxis>
              <ZAxis type="number" dataKey="z" range={[100, 400]} />
              <Tooltip content={<CustomTooltip />} />
              
              <ReferenceArea x1={reversedX ? maxX : avgX} x2={reversedX ? avgX : maxX} y1={reversedY ? minY : avgY} y2={reversedY ? avgY : maxY} fill="hsl(var(--primary))" fillOpacity={0.05} />
              <ReferenceLine x={avgX} stroke="hsl(var(--foreground))" strokeDasharray="3 3" opacity={0.5} />
              <ReferenceLine y={avgY} stroke="hsl(var(--foreground))" strokeDasharray="3 3" opacity={0.5} />

              <Scatter name="Teams" data={data}>
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.name === selectedTeamName ? (selectedColor || entry.color) : entry.color} 
                    fillOpacity={entry.name === selectedTeamName ? 1 : 0.6}
                    stroke={entry.name === selectedTeamName ? "black" : "none"}
                    strokeWidth={2}
                  />
                ))}
                <LabelList dataKey="name" position="top" style={{ fontSize: '9px', fontWeight: 'bold' }} />
              </Scatter>

              <text x="95%" y="10%" textAnchor="end" className="fill-muted-foreground font-bold italic" style={{ fontSize: '10px', opacity: 0.4 }}>{labels.tr}</text>
              <text x="5%" y="10%" textAnchor="start" className="fill-muted-foreground font-bold italic" style={{ fontSize: '10px', opacity: 0.4 }}>{labels.tl}</text>
              <text x="95%" y="90%" textAnchor="end" className="fill-muted-foreground font-bold italic" style={{ fontSize: '10px', opacity: 0.4 }}>{labels.br}</text>
              <text x="5%" y="90%" textAnchor="start" className="fill-muted-foreground font-bold italic" style={{ fontSize: '10px', opacity: 0.4 }}>{labels.bl}</text>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
