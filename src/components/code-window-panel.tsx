"use client"

// 올린 코드윈도우를 Alter Live·Sportscode와 같은 배치로 그림 (패널 너비에 맞춰 크기 조절)
import { useLayoutEffect, useRef, useState } from "react"
import type { CodeWindow, CWButton } from "@/lib/alter/types"
import { hotkeyText } from "@/lib/tag-engine"

type Btn = CWButton & { bgPng?: string }

function fontCss(name?: string): React.CSSProperties {
  if (!name) return {}
  const n = name.toLowerCase()
  return { fontWeight: /bold|black|heavy|semibold/.test(n) ? 700 : undefined, fontStyle: /italic|oblique/.test(n) ? "italic" : undefined }
}

export function CodeWindowPanel({ cw, activeIds, onPress }: { cw: CodeWindow; activeIds: Set<string>; onPress: (id: string) => void }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  const scale = cw.width > 0 && w > 0 ? Math.min(1.6, w / cw.width) : 1
  return (
    <div ref={wrap} className="w-full" data-testid="cw-panel">
      <div className="relative overflow-hidden border border-border" style={{ width: cw.width * scale, height: cw.height * scale, background: cw.background }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0", width: cw.width, height: cw.height, position: "relative" }}>
          {(cw.buttons as Btn[]).map((b) => {
            const clickable = b.kind === "code" || b.kind === "label"
            const on = activeIds.has(b.id)
            const op = typeof b.extra?.m_buttonOpacity === "number" && b.extra.m_buttonOpacity < 1 ? Math.max(0, Number(b.extra.m_buttonOpacity)) : undefined
            const border = typeof b.extra?.m_borderWidth === "number" ? Number(b.extra.m_borderWidth) : 1
            return (
              <div
                key={b.id}
                data-b={b.id}
                data-on={on || undefined}
                className={"absolute flex items-center justify-center overflow-hidden text-center leading-tight select-none " + (clickable ? "cursor-pointer active:brightness-90" : "")}
                style={{ left: b.frame.x, top: b.frame.y, width: b.frame.w, height: b.frame.h, color: b.textColor, fontSize: b.fontSize, zIndex: clickable ? 2 : 1, ...fontCss(b.fontName) }}
                title={b.kind === "label" && b.group ? `${b.group}: ${b.name}` : b.name}
                onPointerDown={(e) => {
                  if (!clickable || e.button !== 0) return
                  e.preventDefault()
                  onPress(b.id)
                }}
              >
                <span className="absolute inset-0" style={{ background: b.bgPng ? `url(${b.bgPng}) center / 100% 100% no-repeat, ${b.color}` : b.color, opacity: op, boxShadow: border > 0 ? `inset 0 0 0 ${Math.min(4, border)}px #0004` : undefined }} />
                {b.showTitle !== false && (
                  <span className="relative px-0.5" style={{ whiteSpace: b.extra?.m_wrapText === false ? "nowrap" : undefined }}>
                    {b.kind === "location" ? `${b.name} (웹 미지원)` : b.name}
                  </span>
                )}
                {b.hotkey && clickable && <span className="absolute bottom-0 right-0.5 text-[9px] opacity-70">{hotkeyText(b.hotkey)}</span>}
                {/* 켜진 버튼: Alter Live처럼 흰 테두리 */}
                {on && <span className="pointer-events-none absolute inset-0 border-[4px] border-white" style={{ boxShadow: "inset 0 0 0 1px #0009, 0 0 0 1px #0009" }} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
