import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return "-:--";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  const paddedSeconds = String(remainingSeconds).padStart(2, '0');
  return `${minutes}:${paddedSeconds}`;
}

export function formatPercentage(value: number): string {
  if (isNaN(value) || !isFinite(value)) return "-%" ;
  // The value is already a percentage (e.g., 43.0), not a ratio (e.g., 0.43).
  // So we just format it, without multiplying by 100.
  return `${value.toFixed(0)}%`;
}
