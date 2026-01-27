"use client"

import type { FC } from "react"

interface HockeyPitchSVGProps {
  showHalf?: "top" | "bottom"
}

export const HockeyPitchSVG: FC<HockeyPitchSVGProps> = ({ showHalf }) => {
  const viewBox = showHalf === "top" ? "0 0 100 30" : showHalf === "bottom" ? "0 30 100 30" : "0 0 100 60";
  
  return (
    <svg
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern id="grass" patternUnits="userSpaceOnUse" width="20" height="20">
           <rect width="20" height="20" fill="hsl(var(--primary))" fillOpacity="0.8" />
           <path d="M0 10 H 20 M 10 0 V 20" stroke="hsl(var(--primary))" strokeWidth="6" strokeOpacity="0.2"/>
        </pattern>
      </defs>

      <rect width="100" height="60" fill="url(#grass)" />
      <g stroke="hsl(var(--primary-foreground))" strokeWidth="0.5" fill="none" opacity="0.8">
        {/* Outlines */}
        <rect x="0" y="0" width="100" height="60" />
        {/* Halfway line */}
        {!showHalf && <line x1="50" y1="0" x2="50" y2="60" />}
        {/* 23m lines */}
        {!showHalf && <line x1="25" y1="0" x2="25" y2="60" />}
        {!showHalf && <line x1="75" y1="0" x2="75" y2="60" />}
        {/* Circles */}
        {(showHalf !== "bottom") && <path d="M 0 20.5 A 16 16 0 0 1 0 39.5" />}
        {(showHalf !== "top") && <path d="M 100 20.5 A 16 16 0 0 0 100 39.5" />}
         {/* Dashed Circles */}
        {(showHalf !== "bottom") && <path d="M 0 15.5 A 21 21 0 0 1 0 44.5" strokeDasharray="1,1" />}
        {(showHalf !== "top") && <path d="M 100 15.5 A 21 21 0 0 0 100 44.5" strokeDasharray="1,1" />}
        {/* Penalty Spots */}
        {(showHalf !== "bottom") && <circle cx="7" cy="30" r="0.5" fill="hsl(var(--primary-foreground))" />}
        {(showHalf !== "top") && <circle cx="93" cy="30" r="0.5" fill="hsl(var(--primary-foreground))" />}
      </g>
    </svg>
  );
};
