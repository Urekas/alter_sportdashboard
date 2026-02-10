
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon?: React.ReactNode
  isPercentage?: boolean
  isTime?: boolean
}

export function StatsCard({ title, value, description, icon, isPercentage, isTime }: StatsCardProps) {
  const numValue = typeof value === 'number' ? value : parseFloat(value);
  const formattedValue = (isPercentage || isTime) ? numValue.toFixed(1) : Math.round(numValue).toString();
  const suffix = isPercentage ? '%' : isTime ? 's' : '';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formattedValue}{suffix}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  )
}
