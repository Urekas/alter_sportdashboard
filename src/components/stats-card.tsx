'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTime, formatPercentage } from "@/lib/utils";
import React, { useMemo } from 'react';

interface StatsCardProps {
  title: string;
  value: number;
  rank?: number | null;
  icon?: React.ReactNode;
  isTime?: boolean;
  isPercentage?: boolean;
}

export function StatsCard({ title, value, rank, icon, isTime, isPercentage }: StatsCardProps) {
  const formattedValue = useMemo(() => {
    if (value === null || value === undefined) return '-';
    if (isTime) return formatTime(value);
    if (isPercentage) return formatPercentage(value);
    if (Number.isInteger(value)) return value.toString();
    return value.toFixed(1);
  }, [value, isTime, isPercentage]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {formattedValue}
          {rank && <span className="text-sm font-medium text-muted-foreground ml-2">({rank}위)</span>}
        </div>
      </CardContent>
    </Card>
  );
}
