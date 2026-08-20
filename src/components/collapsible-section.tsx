
"use client"

// 리포트의 큰 섹션(제목+아이콘 달린 묶음, 예: "공격 성능 분석")을 화면에서 접었다 펼 수 있게
// 만드는 공용 래퍼. 인쇄(PDF)할 땐 접힘 상태와 무관하게 항상 펼쳐서 보여줍니다 — 내용을
// 조건부 렌더링(hidden ? null : children)하지 않고 CSS display만 토글해서, 접힌 채로
// 인쇄해도 내용이 그대로 나옵니다(react-recharts 등은 마운트 후 CSS로만 숨겨도 정상 동작).
import { useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface CollapsibleSectionProps {
  title: string
  icon: ReactNode
  children: ReactNode
  className?: string
  defaultOpen?: boolean
}

export function CollapsibleSection({ title, icon, children, className, defaultOpen = true }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={cn("break-inside-avoid", className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="print-hidden w-full flex items-center justify-between gap-2 text-2xl font-bold text-primary border-b-2 pb-2 hover:opacity-80 transition-opacity text-left"
      >
        <span className="flex items-center gap-2">{icon}{title}</span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 transition-transform", !open && "-rotate-90")} />
      </button>
      <div className="hidden print:flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
        {icon}{title}
      </div>
      <div className={cn(open ? "pt-4" : "hidden print:block print:pt-4")}>
        {children}
      </div>
    </div>
  )
}

// Card 자체가 이미 제목을 갖고 있는 컴포넌트(예: "종합 통계 비교" CardTitle)들 안에서 쓰는
// 작은 접기 버튼 — CardHeader 오른쪽에 놓고, 누르면 그 아래 CardContent를 접습니다.
export function CollapseToggleButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="print-hidden shrink-0 p-1 -m-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      aria-label={open ? "접기" : "펼치기"}
    >
      <ChevronDown className={cn("h-5 w-5 transition-transform", !open && "-rotate-90")} />
    </button>
  )
}
