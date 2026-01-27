"use client"

import type { FC } from "react"

interface HockeyPitchSVGProps {
  showHalf?: "top" | "bottom"
}

export const HockeyPitchSVG: FC<HockeyPitchSVGProps> = ({ showHalf }) => {
  // 55m wide, 91.4m long. Ratio approx 1:1.66. Using 60:100.
  const viewBox = showHalf === "top" ? "0 0 60 50" : showHalf === "bottom" ? "0 50 60 50" : "0 0 60 100";

  // Radius of shooting circle: 14.63m -> 16 in our 100-unit length
  const circleRadius = 16;
  // Radius of broken line circle: 14.63m + 5m -> 16 + 5.5 = 21.5
  const brokenCircleRadius = 21.5;
  // Penalty spot distance from goal line: 6.4m -> 7
  const penaltySpotY = 7;

  return (
    <svg
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect width="60" height="100" fill="transparent" />
      <g stroke="hsl(var(--primary-foreground))" strokeWidth="0.5" fill="none" opacity="0.6">
        {/* Outlines */}
        <rect x="0" y="0" width="60" height="100" />
        {/* Halfway line */}
        {!showHalf && <line x1="0" y1="50" x2="60" y2="50" />}
        {/* 23m lines (22.9m) -> 25 */}
        {!showHalf && <line x1="0" y1="25" x2="60" y2="25" />}
        {!showHalf && <line x1="0" y1="75" x2="60" y2="75" />}

        {/* Top Circle */}
        {(showHalf !== "bottom") && (
          <>
            <path d={`M ${30 - circleRadius},0 A ${circleRadius},${circleRadius} 0 0,0 ${30 + circleRadius},0`} />
            <path d={`M ${30 - brokenCircleRadius},0 A ${brokenCircleRadius},${brokenCircleRadius} 0 0,0 ${30 + brokenCircleRadius},0`} strokeDasharray="2,2" />
            <circle cx="30" cy={penaltySpotY} r="0.75" fill="hsl(var(--primary-foreground))" />
          </>
        )}
        
        {/* Bottom Circle */}
        {(showHalf !== "top") && (
          <>
            <path d={`M ${30 - circleRadius},100 A ${circleRadius},${circleRadius} 0 0,1 ${30 + circleRadius},100`} />
            <path d={`M ${30 - brokenCircleRadius},100 A ${brokenCircleRadius},${brokenCircleRadius} 0 0,1 ${30 + brokenCircleRadius},100`} strokeDasharray="2,2" />
            <circle cx="30" cy={100 - penaltySpotY} r="0.75" fill="hsl(var(--primary-foreground))" />
          </>
        )}
      </g>
    </svg>
  );
};
