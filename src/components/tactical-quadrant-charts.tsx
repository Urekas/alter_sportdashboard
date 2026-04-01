
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
  height?: number
  fontSize?: number
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
  labels,
  height = 350,
  fontSize = 10
}: TacticalQuadrantChartProps) {
  
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload
      return (
        <div className="bg-card p-2 border rounded shadow-lg" style={{ fontSize: `${fontSize + 2}px` }}>
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
    <Card className="w-full border-2">
      <CardHeader className="pb-2 bg-muted/5 border-b">
        <CardTitle className="text-lg font-bold">{title}</CardTitle>
        <CardDescription className="text-[10px] leading-tight font-medium">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ height: `${height}px` }} className="w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 30, right: 30, bottom: 30, left: 10 }}>
              <XAxis 
                type="number" 
                dataKey="x" 
                name={xAxisLabel} 
                domain={[minX, maxX]} 
                reversed={reversedX}
                tick={{ fontSize, fontWeight: 'bold' }}
              >
                <Label value={xAxisLabel} position="bottom" offset={0} style={{ fontSize: `${fontSize + 1}px`, fontWeight: 'bold', fill: 'hsl(var(--muted-foreground))' }} />
              </XAxis>
              <YAxis 
                type="number" 
                dataKey="y" 
                name={yAxisLabel} 
                domain={[minY, maxY]} 
                reversed={reversedY}
                tick={{ fontSize, fontWeight: 'bold' }}
              >
                <Label value={yAxisLabel} angle={-90} position="insideLeft" style={{ fontSize: `${fontSize + 1}px`, fontWeight: 'bold', fill: 'hsl(var(--muted-foreground))' }} />
              </YAxis>
              <ZAxis type="number" dataKey="z" range={[150, 500]} />
              <Tooltip content={<CustomTooltip />} />
              
              <ReferenceArea 
                x1={avgX} x2={reversedX ? minX : maxX} 
                y1={avgY} y2={reversedY ? minY : maxY} 
                fill="#4bc0c0" fillOpacity={0.1} 
              />
              
              <ReferenceArea 
                x1={reversedX ? maxX : minX} x2={avgX} 
                y1={avgY} y2={reversedY ? minY : maxY} 
                fill="#4bc0c0" fillOpacity={0.05} 
              />
              
              <ReferenceArea 
                x1={avgX} x2={reversedX ? minX : maxX} 
                y1={reversedY ? maxY : minY} y2={avgY} 
                fill="#94a3b8" fillOpacity={0.06} 
              />
              
              <ReferenceArea 
                x1={reversedX ? maxX : minX} x2={avgX} 
                y1={reversedY ? maxY : minY} y2={avgY} 
                fill="#6366f1" fillOpacity={0.04} 
              />

              <ReferenceLine x={avgX} stroke="hsl(var(--foreground))" strokeDasharray="5 5" strokeWidth={1.5} opacity={0.6} />
              <ReferenceLine y={avgY} stroke="hsl(var(--foreground))" strokeDasharray="5 5" strokeWidth={1.5} opacity={0.6} />

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
                <LabelList dataKey="name" position="top" style={{ fontSize: `${fontSize}px`, fontWeight: 'black', fill: 'hsl(var(--foreground))' }} />
              </Scatter>

              <text x="96%" y="8%" textAnchor="end" className="fill-emerald-800 font-black italic uppercase tracking-tighter" style={{ fontSize: `${fontSize + 1}px`, opacity: 0.6 }}>{labels.tr}</text>
              <text x="4%" y="8%" textAnchor="start" className="fill-teal-800 font-black italic uppercase tracking-tighter" style={{ fontSize: `${fontSize + 1}px`, opacity: 0.6 }}>{labels.tl}</text>
              <text x="96%" y="92%" textAnchor="end" className="fill-slate-700 font-black italic uppercase tracking-tighter" style={{ fontSize: `${fontSize + 1}px`, opacity: 0.6 }}>{labels.br}</text>
              <text x="4%" y="92%" textAnchor="start" className="fill-indigo-800 font-black italic uppercase tracking-tighter" style={{ fontSize: `${fontSize + 1}px`, opacity: 0.6 }}>{labels.bl}</text>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
