
"use client"

// 리포트의 큰 섹션(제목+아이콘 달린 묶음, 예: "공격 성능 분석")을 화면에서 접었다 펼 수 있게
// 만드는 공용 래퍼. 인쇄(PDF)는 화면에 보이는 그대로 나갑니다 — 접어두면 그 섹션은 리포트에서
// 통째로 빠짐(예전엔 반대로 접힘 상태와 무관하게 항상 펼쳐서 인쇄했는데, "인쇄 전에 필요 없는
// 섹션을 접어서 빼고 싶다"는 사용자 피드백으로 뒤집음).
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
  // 예전엔 이 섹션 전체(제목+안의 차트 여러 개)를 통째로 break-inside-avoid로 묶었는데,
  // 안의 차트들(AttackThreatChart 등)이 이미 각자 자기 Card에 break-inside-avoid를 갖고
  // 있어서 이중으로 묶는 꼴이었음 — 차트 2개가 남은 페이지 공간에 다 안 들어가면 "둘 다"
  // 다음 페이지로 밀려버려 앞 페이지에 큰 빈 공간이 생기는 원인이었음. 이제 섹션 자체는
  // 자연스럽게 흘러가게 두고(각 차트가 알아서 안 잘리게), 제목만 break-after-avoid로
  // 보호해서 "제목만 페이지 맨 아래 혼자 남고 내용은 다음 페이지" 현상만 막는다.
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="print-hidden w-full flex items-center justify-between gap-2 text-2xl font-bold text-primary border-b-2 pb-2 hover:opacity-80 transition-opacity text-left"
      >
        <span className="flex items-center gap-2">{icon}{title}</span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 transition-transform", !open && "-rotate-90")} />
      </button>
      {open && (
        <div className="hidden print:flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2 break-after-avoid">
          {icon}{title}
        </div>
      )}
      <div className={cn(open ? "pt-4" : "hidden")}>
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
