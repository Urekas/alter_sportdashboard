"use client"

// 유튜브 영상 위 그리기 (Alter Live InkLayer를 웹용으로 옮김)
//  - 유튜브는 iframe이라 마우스를 다 가져가므로, 그리기를 켰을 때만 투명 SVG가 영상을 덮고 그림을 받음 (끄면 유튜브 그대로)
//  - 도형은 영상 화면 비율 좌표 → 창 크기가 바뀌어도 같은 자리
//  - 도구: 펜·화살표(실선/점선)·선·하이라이트·공간·글자·옮기기·지우개, 크기, 색, 되돌리기, 모두 지우기
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { INK_COLORS, INK_FONT, INK_SIZES, INK_TOOLS, INK_W, inkHit, inkMove, inkShapeSvg, inkTextSize, type InkShape, type InkTool } from "@/lib/alter/ink"
import { cn } from "@/lib/utils"

const SAVE_KEY = "analysis.ink"
function loadPrefs(): { tool: InkTool; size: number } {
  try {
    const v = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}")
    return { tool: INK_TOOLS.some((t) => t.tool === v.tool) ? v.tool : "arrow", size: INK_SIZES.some((x) => x.w === v.size) ? v.size : 1 }
  } catch {
    return { tool: "arrow", size: 1 }
  }
}

interface TextEdit {
  id: number
  x: number
  y: number
  value: string
  c: string
  w: number
  orig: InkShape | null
}

export interface InkHandle {
  clear: () => void
  undo: () => void
}
export interface InkPrefs {
  tool: InkTool
  size: number
  color: string
}

/** 영상(16:9 상자) 위에 얹는 그림 판. on = 그리기 켜짐 */
export const InkLayer = forwardRef<InkHandle, { on: boolean; prefs: InkPrefs }>(function InkLayer({ on, prefs }, ref) {
  const svgRef = useRef<SVGSVGElement>(null)
  const st = useRef({ shapes: [] as InkShape[], cur: null as (InkShape & { id: number }) | null, hist: [] as InkShape[][], drag: null as null | { id: number; orig: InkShape; cur: InkShape; x0: number; y0: number; moved: boolean }, textDown: null as number | null })
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs
  const [textEdit, setTextEditState] = useState<TextEdit | null>(null)
  const textRef = useRef<TextEdit | null>(null)
  const textInput = useRef<HTMLInputElement>(null)
  const setTextEdit = (t: TextEdit | null) => {
    textRef.current = t
    setTextEditState(t)
  }

  const box = () => {
    const r = svgRef.current?.getBoundingClientRect()
    return r && r.width > 0 ? { left: r.left, top: r.top, w: r.width, h: r.height, H: (INK_W * r.height) / r.width } : null
  }
  const render = useCallback(() => {
    const svg = svgRef.current
    const b = box()
    if (!svg || !b) return
    svg.setAttribute("viewBox", `0 0 ${INK_W} ${b.H}`)
    const s = st.current
    svg.innerHTML = s.shapes.map((sh) => inkShapeSvg(sh, b.H)).join("") + (s.cur ? inkShapeSvg(s.cur, b.H) : "")
  }, [])
  const snap = () => {
    st.current.hist.push([...st.current.shapes])
    if (st.current.hist.length > 100) st.current.hist.shift()
  }
  const textWidth = (sh: InkShape) => {
    const g = document.createElement("canvas").getContext("2d")!
    g.font = `700 ${inkTextSize(sh.w)}px ${INK_FONT}`
    return g.measureText(sh.text ?? "").width
  }
  const finishText = (cancel: boolean) => {
    const te = textRef.current
    if (!te) return
    const s = st.current
    setTextEdit(null)
    const text = te.value.trim()
    if (cancel) {
      if (te.orig) s.shapes = s.hist.pop() ?? s.shapes
    } else if (text) {
      if (!te.orig) snap()
      const H = box()?.H ?? (INK_W * 9) / 16
      const fs = inkTextSize(te.w)
      const x = Math.max(0, Math.min(te.x, 1 - (textWidth({ t: "text", c: te.c, w: te.w, pts: [], text }) + 8) / INK_W))
      const y = Math.max(0, Math.min(te.y, 1 - (fs * 1.2) / H))
      s.shapes.push({ t: "text", c: te.c, w: te.w, pts: [[x, y]], text })
    }
    render()
  }
  useEffect(() => {
    textInput.current?.focus()
  }, [textEdit?.id])

  const clear = useCallback(() => {
    const s = st.current
    if (s.shapes.length) snap()
    s.shapes = []
    s.cur = null
    setTextEdit(null)
    render()
  }, [render])
  const undo = useCallback(() => {
    const s = st.current
    s.shapes = s.hist.pop() ?? s.shapes
    render()
  }, [render])
  useImperativeHandle(ref, () => ({ clear, undo }), [clear, undo])

  // 그리기
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const s = st.current
    const pt = (e: PointerEvent): [number, number] => {
      const b = box()!
      return [Math.max(0, Math.min(1, (e.clientX - b.left) / b.w)), Math.max(0, Math.min(1, (e.clientY - b.top) / b.h))]
    }
    const capture = (id: number) => {
      try {
        svg.setPointerCapture(id)
      } catch {
        /* 이미 끝난 터치 등 — 캡처 없이도 그리기는 됨 */
      }
    }
    const hitAt = (e: PointerEvent) => {
      const b = box()
      if (!b) return null
      const [u, v] = pt(e)
      for (let i = s.shapes.length - 1; i >= 0; i--) if (inkHit(s.shapes[i], u, v, b.H, textWidth)) return s.shapes[i]
      return null
    }
    const openText = (e: PointerEvent, hit: InkShape | null) => {
      if (hit) {
        snap()
        s.shapes = s.shapes.filter((x) => x !== hit)
        render()
      }
      const [x, y] = hit ? hit.pts[0] : pt(e)
      setTextEdit({ id: Date.now(), x, y, value: hit?.text ?? "", c: hit?.c ?? prefsRef.current.color, w: hit?.w ?? prefsRef.current.size, orig: hit })
    }
    const down = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return
      e.preventDefault()
      const tool = prefsRef.current.tool
      if (tool === "text" || tool === "move" || tool === "erase") {
        finishText(false)
        const hit = hitAt(e)
        if (tool === "erase") {
          if (hit) {
            snap()
            s.shapes = s.shapes.filter((x) => x !== hit)
            render()
          }
          return
        }
        if (hit && (tool === "move" || hit.t === "text")) {
          s.drag = { id: e.pointerId, orig: hit, cur: hit, x0: e.clientX, y0: e.clientY, moved: false }
          capture(e.pointerId)
          return
        }
        if (tool === "text") s.textDown = e.pointerId
        return
      }
      s.cur = { t: tool, c: prefsRef.current.color, w: prefsRef.current.size, pts: [pt(e)], id: e.pointerId }
      capture(e.pointerId)
      render()
    }
    const move = (e: PointerEvent) => {
      const d = s.drag
      const b = box()
      if (d && e.pointerId === d.id && b) {
        if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4) return
        const i = s.shapes.indexOf(d.cur)
        if (i < 0) return
        if (!d.moved) snap()
        d.moved = true
        const extra = d.orig.t === "text" ? [(textWidth(d.orig) + 8) / INK_W, (inkTextSize(d.orig.w) * 1.2) / b.H] : [0, 0]
        d.cur = inkMove(d.orig, (e.clientX - d.x0) / b.w, (e.clientY - d.y0) / b.h, extra[0], extra[1])
        s.shapes[i] = d.cur
        render()
        return
      }
      if (!s.cur || e.pointerId !== s.cur.id || !b) return
      const q = pt(e)
      const last = s.cur.pts[s.cur.pts.length - 1]
      if (Math.hypot((q[0] - last[0]) * b.w, (q[1] - last[1]) * b.h) < (s.cur.t === "pen" ? 1.5 : 3)) return
      s.cur.pts.push(q)
      render()
    }
    const up = (e: PointerEvent) => {
      const d = s.drag
      if (d && e.pointerId === d.id) {
        s.drag = null
        if (!d.moved && e.type === "pointerup" && prefsRef.current.tool === "text") openText(e, d.cur)
        return
      }
      if (s.textDown === e.pointerId) {
        s.textDown = null
        if (e.type === "pointerup") openText(e, null)
        return
      }
      if (!s.cur || e.pointerId !== s.cur.id) return
      const { id: _id, ...sh } = s.cur
      s.cur = null
      if (sh.t === "area") sh.done = true
      if (sh.t === "spot" || sh.t === "pen" || sh.pts.length > 1) {
        snap()
        s.shapes.push(sh)
      }
      render()
    }
    svg.addEventListener("pointerdown", down)
    svg.addEventListener("pointermove", move)
    svg.addEventListener("pointerup", up)
    svg.addEventListener("pointercancel", up)
    const ro = new ResizeObserver(render)
    ro.observe(svg)
    return () => {
      svg.removeEventListener("pointerdown", down)
      svg.removeEventListener("pointermove", move)
      svg.removeEventListener("pointerup", up)
      svg.removeEventListener("pointercancel", up)
      ro.disconnect()
    }
  }, [render])

  const b = textEdit ? box() : null
  const host = svgRef.current?.parentElement?.getBoundingClientRect()
  return (
    <>
      <svg ref={svgRef} preserveAspectRatio="none" className={cn("absolute inset-0 w-full h-full touch-none", on ? "pointer-events-auto cursor-crosshair" : "pointer-events-none")} data-testid="ink" />
      {textEdit && b && host && (
        <input
          ref={textInput}
          value={textEdit.value}
          placeholder="글자 입력 후 Enter"
          className="absolute z-10 bg-black/40 border border-white/60 px-1 outline-none font-bold"
          style={{ left: b.left - host.left + textEdit.x * b.w, top: b.top - host.top + textEdit.y * b.h, color: textEdit.c, fontFamily: INK_FONT, fontSize: (inkTextSize(textEdit.w) * b.w) / INK_W, width: `${Math.max(9, textEdit.value.length + 2)}em` }}
          onChange={(e) => setTextEdit({ ...textEdit, value: e.target.value })}
          onBlur={() => finishText(false)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.nativeEvent.isComposing || e.keyCode === 229) return
            if (e.key === "Enter") finishText(false)
            else if (e.key === "Escape") finishText(true)
          }}
        />
      )}
    </>
  )
})

/** 도구·크기 기억 (색은 기억 안 함) */
export function loadInkPrefs(): InkPrefs {
  return { ...loadPrefs(), color: INK_COLORS[0] }
}
export function saveInkPrefs(p: InkPrefs) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ tool: p.tool, size: p.size }))
  } catch {}
}

/** 그리기 도구 막대 (영상 아래 줄에 펼쳐짐) */
export function InkToolbar({ prefs, onPrefs, onUndo, onClear }: { prefs: InkPrefs; onPrefs: (p: InkPrefs) => void; onUndo: () => void; onClear: () => void }) {
  const b = { prefs, color: prefs.color, onTool: (tool: InkTool) => onPrefs({ ...prefs, tool }), onSize: (size: number) => onPrefs({ ...prefs, size }), onColor: (color: string) => onPrefs({ ...prefs, color }), onUndo, onClear }
  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-border bg-[#201e1d]" data-testid="ink-toolbar">
      {INK_TOOLS.map((t) => (
        <button
          key={t.tool}
          title={t.title}
          onClick={() => b.onTool(t.tool)}
          className={cn("h-8 w-8 inline-flex items-center justify-center text-base text-white/85", b.prefs.tool === t.tool ? "bg-primary text-white" : "hover:bg-white/10")}
          dangerouslySetInnerHTML={{ __html: t.icon }}
          data-tool={t.tool}
        />
      ))}
      <button
        title="크기 (누를 때마다 작게 → 보통 → 크게)"
        onClick={() => {
          const i = INK_SIZES.findIndex((x) => x.w === b.prefs.size)
          b.onSize(INK_SIZES[(i + 1) % INK_SIZES.length].w)
        }}
        className="h-8 px-2 text-xs text-white/85 border border-white/20 hover:bg-white/10"
      >
        {INK_SIZES.find((x) => x.w === b.prefs.size)?.label ?? "보통"}
      </button>
      <span className="w-px h-6 bg-white/20 mx-1" />
      {INK_COLORS.map((c) => (
        <button key={c} onClick={() => b.onColor(c)} className={cn("h-6 w-6 border-2", b.color === c ? "border-white scale-110" : "border-white/20")} style={{ background: c }} aria-label={`색 ${c}`} />
      ))}
      <span className="flex-1" />
      <button title="되돌리기" onClick={b.onUndo} className="h-8 px-2 text-sm text-white/85 hover:bg-white/10">↶ 되돌리기</button>
      <button title="모두 지우기" onClick={b.onClear} className="h-8 px-2 text-sm text-white/85 hover:bg-white/10">모두 지우기</button>
    </div>
  )
}
