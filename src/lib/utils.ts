import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// window.open(url, '_blank')는 Vercel 배포 도메인 등 "낯선" 사이트에서 Chrome이 팝업으로 취급해
// 조용히 막는 경우가 있음(로컬호스트에서는 재현 안 됨) — 실제 <a target="_blank"> 클릭(설령
// 코드로 트리거해도)은 이 차단을 안 받으므로, 클릭 핸들러 안에서 동기적으로 임시 <a>를 만들어
// 클릭시키는 방식으로 새 탭을 엽니다. 차트/테이블 행/SVG 마커처럼 실제 <a>로 감싸기 애매한
// 클릭 핸들러 전부에서 이걸로 window.open을 대체합니다.
export function openInNewTab(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// 비디오 분석 도구 딥링크를 만듭니다. locked=true면 &lock=1을 붙여서 도구가 Explorer(다른
// 경기 탐색·편집/업로드)를 숨기고 이 경기 Viewer 화면에만 갇히게 합니다(선수단 배포 링크용).
export function buildVideoDeepLink(videoMatchId: string, time?: number, locked?: boolean): string {
  const params = new URLSearchParams({ matchId: videoMatchId });
  if (typeof time === 'number' && isFinite(time)) params.set('time', String(Math.max(0, Math.floor(time))));
  if (locked) params.set('lock', '1');
  return `/Alter_sportsplay/index.html?${params.toString()}`;
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
