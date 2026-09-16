
"use client"

// PDF(인쇄) 출력에 기관 로고(한국스포츠과학원 국가대표스포츠과학지원센터)를 넣을지 말지
// 사용자가 직접 켜고 끌 수 있게 하는 공용 부품. 경기별 분석(dashboard.tsx)·대회 누적 분석
// (tournament-dashboard.tsx) 리포트 상단에서 공유. 로고 자체는 항상 인쇄 전용(hidden print:*)
// 이라 화면엔 절대 안 보이고, 켜고 끄는 스위치만 화면에 보임(print-hidden). 토글 상태는
// 기기별 개인 취향이라 Firestore가 아니라 로컬(localStorage)에만 기억함 — 대회/경기가 바뀌어도
// 유지되고, 다른 사람 브라우저에는 영향 없음.
import { useEffect, useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ImageIcon } from "lucide-react"

const STORAGE_KEY = "alterFocus.printLogoEnabled"

export function usePrintLogoEnabled() {
  const [enabled, setEnabledState] = useState(false)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved !== null) setEnabledState(saved === "1")
    } catch {}
  }, [])
  const setEnabled = (v: boolean) => {
    setEnabledState(v)
    try { window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0") } catch {}
  }
  return [enabled, setEnabled] as const
}

export function PrintLogoSwitch({ enabled, onChange }: { enabled: boolean, onChange: (v: boolean) => void }) {
  return (
    <div className="print-hidden flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-lg border">
      <ImageIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Switch id="print-logo-switch" checked={enabled} onCheckedChange={onChange} />
      <Label htmlFor="print-logo-switch" className="text-[10px] font-bold uppercase cursor-pointer whitespace-nowrap">PDF에 로고 포함</Label>
    </div>
  )
}

// 인쇄될 때만 나타나는 로고 이미지 — 토글이 꺼져 있으면 아예 렌더링하지 않음(인쇄 CSS만으로
// 숨기면 DOM엔 남아있어 혹시 모를 이미지 로드 요청이 발생하므로, 꺼진 경우는 null 반환).
export function PrintLogoMark({ enabled, className }: { enabled: boolean, className?: string }) {
  if (!enabled) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 인쇄 전용 정적 이미지, next/image의
    // lazy-load/최적화가 필요 없고 오히려 인쇄 타이밍에 안 그려질 위험만 늘림.
    <img
      src="/branding/kspo-logo.png"
      alt="한국스포츠과학원 국가대표스포츠과학지원센터"
      className={className ?? "hidden print:block"}
      style={{ height: "9mm", width: "auto" }}
    />
  )
}
