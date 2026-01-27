"use client"

import type { FC } from "react"

export const HockeyPitchLandscapeSVG: FC = () => {
  const viewBox = "0 0 100 60";

  const length = 100;
  const width = 60;
  const centerY = width / 2;

  // Proportions from 91.4m length.
  const scale = length / 91.4;

  const circleRadius = 14.63 * scale;
  const brokenCircleRadius = (14.63 + 5) * scale;
  const penaltySpotX = 6.4 * scale;
  const twentyThreeMeterLineX = 22.9 * scale;

  return (
    <svg
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect width={length} height={width} fill="transparent" />
      <g stroke="hsl(var(--primary-foreground))" strokeWidth="0.5" fill="none" opacity="0.6">
        {/* Outlines */}
        <rect x="0" y="0" width={length} height={width} />
        {/* Halfway line */}
        <line x1={length / 2} y1="0" x2={length / 2} y2={width} />
        {/* 23m lines */}
        <line x1={twentyThreeMeterLineX} y1="0" x2={twentyThreeMeterLineX} y2={width} />
        <line x1={length - twentyThreeMeterLineX} y1="0" x2={length - twentyThreeMeterLineX} y2={width} />

        {/* Left Circle (simplified semi-circle) */}
        <path d={`M 0,${centerY - circleRadius} A ${circleRadius},${circleRadius} 0 0,1 0,${centerY + circleRadius}`} />
        <path d={`M 0,${centerY - brokenCircleRadius} A ${brokenCircleRadius},${brokenCircleRadius} 0 0,1 0,${centerY + brokenCircleRadius}`} strokeDasharray="2,2" />
        <circle cx={penaltySpotX} cy={centerY} r="0.75" fill="hsl(var(--primary-foreground))" />
        
        {/* Right Circle (simplified semi-circle) */}
        <path d={`M ${length},${centerY - circleRadius} A ${circleRadius},${circleRadius} 0 0,0 ${length},${centerY + circleRadius}`} />
        <path d={`M ${length},${centerY - brokenCircleRadius} A ${brokenCircleRadius},${brokenCircleRadius} 0 0,0 ${length},${centerY + brokenCircleRadius}`} strokeDasharray="2,2" />
        <circle cx={length - penaltySpotX} cy={centerY} r="0.75" fill="hsl(var(--primary-foreground))" />
      </g>
    </svg>
  );
};
