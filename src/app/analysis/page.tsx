"use client"

// 통합 영상 분석: 범위(팀·기간·대회·상대) → 경기 칩(하나 = 그 경기, 여럿 = 묶어서) → 한국/상대 →
// 액션 × 라벨 매트릭스 → 칸을 누르면 클립 목록 → 클립을 누르면 그 경기 영상으로 바로 재생
// 데이터: VideoIndex(경기 요약, 전부) + VideoClips(고른 경기만, 경기당 읽기 1번) — src/lib/video-index.ts
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ChevronDown, Loader2, SlidersHorizontal } from "lucide-react"
import { useFirestore } from "@/firebase"
import { VideoIndexService } from "@/lib/video-index-service"
import { actionKey, actionsFor, type Clip, type VideoIndexDoc } from "@/lib/video-index"
import { ClipPlayer } from "@/components/analysis/clip-player"
import { emptyRange, matchesIn, opponentOf, RangePanel, rangeSummary, type Favorite, type Range } from "@/components/analysis/range-panel"
import { cn } from "@/lib/utils"

const ALL = "\u0000전체"
const MAX_LIST = 200

function readLS<T>(k: string, d: T): T {
  try {
    const v = localStorage.getItem(k)
    return v ? (JSON.parse(v) as T) : d
  } catch {
    return d
  }
}
function writeLS(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {}
}
const mmss = (t: number) => {
  const s = Math.max(0, Math.floor(t))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}
const shortDate = (d: string) => (d ? `${+d.slice(5, 7)}/${+d.slice(8, 10)}` : "")

export default function AnalysisPage() {
  const db = useFirestore()
  const [index, setIndex] = useState<VideoIndexDoc[] | null>(null)
  const [error, setError] = useState("")
  const [range, setRange] = useState<Range>(() => emptyRange())
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [panel, setPanel] = useState(false)
  const [picked, setPicked] = useState<string[]>([]) // 비면 범위 안 전부
  const [side, setSide] = useState<"us" | "opp">("us")
  const [group, setGroup] = useState("")
  const [cell, setCell] = useState<{ action: string; label: string } | null>(null)
  const [clips, setClips] = useState<Clip[]>([])
  const [loading, setLoading] = useState(false)
  const [current, setCurrent] = useState<string | null>(null)
  const [openRow, setOpenRow] = useState<string | null>(null)
  const [shown, setShown] = useState(MAX_LIST)
  // 클립 목록은 한 군데만 그림 (큰 화면: 영상 아래 / 작은 화면: 매트릭스 아래)
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const on = () => setWide(mq.matches)
    on()
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])

  // 경기 요약 + 지난번 범위·즐겨찾기
  useEffect(() => {
    if (!db) return
    VideoIndexService.list(db)
      .then((ix) => {
        setIndex(ix)
        setFavorites(readLS<Favorite[]>("analysis.favorites", []))
        const saved = readLS<Range | null>("analysis.range", null)
        if (saved && ix.some((m) => m.home === saved.team || m.away === saved.team)) setRange(saved)
        else {
          // 처음: 가장 많이 나온 팀(보통 우리 팀)
          const c = new Map<string, number>()
          for (const m of ix) for (const t of [m.home, m.away]) c.set(t, (c.get(t) ?? 0) + 1)
          const top = [...c].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ""
          setRange(emptyRange(top))
        }
        setGroup(readLS("analysis.group", ""))
      })
      .catch((e) => setError(String(e?.message ?? e)))
  }, [db])

  const changeRange = (r: Range) => {
    setRange(r)
    setPicked([])
    setCell(null)
    writeLS("analysis.range", r)
  }
  const changeFavorites = (f: Favorite[]) => {
    setFavorites(f)
    writeLS("analysis.favorites", f)
  }

  const inRange = useMemo(() => (index ? matchesIn(index, range) : []), [index, range])
  const active = useMemo(() => (picked.length ? inRange.filter((m) => picked.includes(m.matchId)) : inRange), [inRange, picked])
  const byId = useMemo(() => new Map((index ?? []).map((m) => [m.matchId, m])), [index])

  // 고른 경기 클립 (경기당 한 번만 읽음)
  useEffect(() => {
    if (!db || !index) return
    let gone = false
    setLoading(true)
    VideoIndexService.clips(db, active.map((m) => m.matchId))
      .then((c) => !gone && setClips(c))
      .catch((e) => !gone && setError(String(e?.message ?? e)))
      .finally(() => !gone && setLoading(false))
    return () => {
      gone = true
    }
  }, [db, index, active])

  const teamNames = useMemo(() => [...new Set((index ?? []).flatMap((m) => [m.home, m.away]))], [index])
  const sideClips = useMemo(
    () => clips.filter((c) => (range.team ? (side === "us" ? c.team === range.team : c.team && c.team !== range.team) : true)),
    [clips, side, range.team],
  )
  const actionOfClip = useMemo(() => actionsFor(clips, teamNames), [clips, teamNames])

  // 라벨 그룹 (많이 쓰인 순)
  const groups = useMemo(() => {
    const c = new Map<string, number>()
    for (const cl of sideClips) for (const g of new Set(cl.labels.map((l) => l.g))) c.set(g, (c.get(g) ?? 0) + 1)
    return [...c].sort((a, b) => b[1] - a[1]).map(([g]) => g)
  }, [sideClips])
  const useGroup = groups.includes(group) ? group : groups.find((g) => /결과|result/i.test(g)) ?? groups[0] ?? ""
  const pickGroup = (g: string) => {
    setGroup(g)
    writeLS("analysis.group", g)
    setCell((c) => (c ? { ...c, label: ALL } : c))
  }

  const matrix = useMemo(() => {
    const cols = new Map<string, number>()
    const rows = new Map<string, { total: number; cells: Map<string, number> }>()
    for (const cl of sideClips) {
      const a = actionOfClip.get(cl.key) ?? cl.code
      const r = rows.get(a) ?? { total: 0, cells: new Map() }
      r.total++
      for (const t of new Set(cl.labels.filter((l) => l.g === useGroup).map((l) => l.t))) {
        r.cells.set(t, (r.cells.get(t) ?? 0) + 1)
        cols.set(t, (cols.get(t) ?? 0) + 1)
      }
      rows.set(a, r)
    }
    return {
      cols: [...cols].sort((a, b) => b[1] - a[1]).map(([t]) => t),
      colTotal: cols,
      rows: [...rows].sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0], "ko")),
    }
  }, [sideClips, actionOfClip, useGroup])

  const list = useMemo(() => {
    if (!cell) return []
    return sideClips
      .filter((cl) => cell.action === ALL || actionKey(actionOfClip.get(cl.key) ?? cl.code) === actionKey(cell.action))
      .filter((cl) => cell.label === ALL || cl.labels.some((l) => l.g === useGroup && l.t === cell.label))
      .sort((a, b) => (byId.get(a.matchId)?.date ?? "").localeCompare(byId.get(b.matchId)?.date ?? "") || a.matchId.localeCompare(b.matchId) || a.start - b.start)
  }, [cell, sideClips, actionOfClip, useGroup, byId])

  const pickCell = (action: string, label: string) => {
    setCell({ action, label })
    setOpenRow(action)
    setShown(MAX_LIST)
    setCurrent(null)
  }
  const curIdx = list.findIndex((c) => c.key === current)
  const curClip = curIdx >= 0 ? list[curIdx] : null
  const go = useCallback((d: number) => {
    const i = curIdx + d
    if (i >= 0 && i < list.length) setCurrent(list[i].key)
  }, [curIdx, list])

  const matchLabel = (m?: VideoIndexDoc) => (m ? `${shortDate(m.date)} ${range.team ? `vs ${opponentOf(m, range.team) || m.away}` : m.name}`.trim() : "")
  const clipTitle = (c: Clip) =>
    `${matchLabel(byId.get(c.matchId))} · ${c.quarter ? c.quarter + " " : ""}${mmss(c.start)} · ${c.team} ${actionOfClip.get(c.key) ?? c.code}${c.labels.length ? " · " + c.labels.map((l) => l.t).join(", ") : ""}`

  if (error)
    return (
      <div className="min-h-screen bg-background p-6">
        <Link href="/" className="text-sm text-muted-foreground inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> 대시보드</Link>
        <p className="mt-6 text-foreground">불러오지 못했어요: {error}</p>
      </div>
    )
  if (!index)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> 불러오는 중…
      </div>
    )

  const sideName = side === "us" ? range.team || "전체" : "상대"
  const cellOn = (a: string, l: string) => cell?.action === a && cell?.label === l

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 머리: 범위 */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Link href="/" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground shrink-0"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">대시보드</span></Link>
        <span className="font-headline text-base shrink-0">영상 분석</span>
        <button onClick={() => setPanel(true)} className="ml-1 min-w-0 flex-1 sm:flex-none h-9 border border-border bg-card px-3 text-sm inline-flex items-center gap-2 hover:border-foreground/40" data-testid="range-button">
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          <span className="truncate">{rangeSummary(range, index)}</span>
          <span className="text-muted-foreground shrink-0">{inRange.length}경기</span>
        </button>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-0">
        {/* 영상: 휴대폰에선 위에 고정 */}
        <div className="sticky top-0 z-20 lg:static lg:order-2 lg:border-l lg:border-border">
          <div className="lg:sticky lg:top-0">
            <ClipPlayer db={db} clip={curClip} title={curClip ? clipTitle(curClip) : ""} onPrev={() => go(-1)} onNext={() => go(1)} hasPrev={curIdx > 0} hasNext={curIdx >= 0 && curIdx < list.length - 1} />
            {/* 큰 화면: 클립 목록은 영상 아래 */}
            {wide && clipList()}
          </div>
        </div>

        <div className="min-w-0 lg:order-1">
          {/* 경기 칩 */}
          <div className="flex gap-1.5 overflow-x-auto px-3 py-2 border-b border-border" data-testid="match-chips">
            <button onClick={() => { setPicked([]); setCell(null) }} className={cn("h-8 px-2.5 text-sm border shrink-0", !picked.length ? "bg-foreground text-background border-foreground" : "border-border bg-card")}>
              전체 {inRange.length}
            </button>
            {inRange.map((m) => {
              const on = picked.includes(m.matchId)
              return (
                <button
                  key={m.matchId}
                  title={`${m.tournamentName} · ${m.name}`}
                  onClick={() => { setPicked((p) => (on ? p.filter((x) => x !== m.matchId) : [...p, m.matchId])); setCell(null) }}
                  className={cn("h-8 px-2.5 text-sm border shrink-0 whitespace-nowrap", on ? "bg-foreground text-background border-foreground" : "border-border bg-card")}
                >
                  {matchLabel(m)}
                </button>
              )
            })}
          </div>

          {/* 시점 + 라벨 그룹 */}
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border">
            <div className="inline-flex border border-foreground" role="tablist">
              {(["us", "opp"] as const).map((s) => (
                <button key={s} onClick={() => { setSide(s); setCell(null) }} className={cn("h-8 px-3 text-sm", side === s ? "bg-foreground text-background" : "bg-card")} data-testid={`side-${s}`}>
                  {s === "us" ? range.team || "전체" : "상대"}
                </button>
              ))}
            </div>
            <span className="text-sm text-muted-foreground">{active.length === 1 ? matchLabel(active[0]) : `${active.length}경기 묶음`} · {sideName} 클립 {sideClips.length}</span>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <span className="flex-1" />
            {groups.length > 0 && (
              <label className="text-sm inline-flex items-center gap-1.5">
                <span className="text-muted-foreground">라벨</span>
                <select value={useGroup} onChange={(e) => pickGroup(e.target.value)} className="h-8 border border-border bg-card px-2 text-sm" data-testid="group-select">
                  {groups.map((g) => (
                    <option key={g} value={g}>{g || "그룹 없음"}</option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {!loading && !matrix.rows.length && <p className="p-6 text-sm text-muted-foreground">이 범위에는 클립이 없어요.</p>}

          {/* 큰 화면: 매트릭스 표 */}
          {matrix.rows.length > 0 && (
            <div className="hidden md:block overflow-auto max-h-[calc(100vh-140px)]" data-testid="matrix">
              <table className="text-sm border-collapse min-w-full">
                <thead className="sticky top-0 bg-background z-10">
                  <tr>
                    <th className="text-left font-medium text-muted-foreground px-3 py-2 border-b border-border sticky left-0 bg-background">액션</th>
                    <th className="px-2 py-2 border-b border-border font-medium">전체</th>
                    {matrix.cols.map((c) => (
                      <th key={c} className="px-2 py-2 border-b border-border font-medium whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.map(([a, r]) => (
                    <tr key={a} className="hover:bg-card">
                      <th className="text-left font-medium px-3 py-1.5 border-b border-border whitespace-nowrap sticky left-0 bg-background">{a}</th>
                      <Cell n={r.total} on={cellOn(a, ALL)} onClick={() => pickCell(a, ALL)} strong />
                      {matrix.cols.map((c) => (
                        <Cell key={c} n={r.cells.get(c) ?? 0} on={cellOn(a, c)} onClick={() => pickCell(a, c)} />
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <th className="text-left px-3 py-1.5 sticky left-0 bg-background text-muted-foreground font-medium">합계</th>
                    <Cell n={sideClips.length} on={cellOn(ALL, ALL)} onClick={() => pickCell(ALL, ALL)} strong />
                    {matrix.cols.map((c) => (
                      <Cell key={c} n={matrix.colTotal.get(c) ?? 0} on={cellOn(ALL, c)} onClick={() => pickCell(ALL, c)} />
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* 휴대폰: 액션 아코디언 + 라벨 칩 */}
          <div className="md:hidden" data-testid="matrix-mobile">
            {matrix.rows.map(([a, r]) => {
              const open = openRow === a
              return (
                <div key={a} className="border-b border-border">
                  <button onClick={() => setOpenRow(open ? null : a)} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm">
                    <span className="font-medium flex-1 text-left">{a}</span>
                    <span className="tabular-nums">{r.total}</span>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
                  </button>
                  {open && (
                    <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                      <MChip on={cellOn(a, ALL)} onClick={() => pickCell(a, ALL)} label="전체" n={r.total} />
                      {matrix.cols.filter((c) => r.cells.get(c)).map((c) => (
                        <MChip key={c} on={cellOn(a, c)} onClick={() => pickCell(a, c)} label={c} n={r.cells.get(c)!} />
                      ))}
                    </div>
                  )}
                  {/* 휴대폰: 고른 칸의 클립은 그 액션 바로 아래 */}
                  {open && !wide && cell?.action === a && clipList()}
                </div>
              )
            })}
          </div>

          {/* 휴대폰·태블릿: 클립 목록은 매트릭스 아래 */}
        </div>
      </div>

      {panel && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={(e) => e.target === e.currentTarget && setPanel(false)}>
          <div className="h-full w-full sm:w-[460px] bg-background shadow-xl">
            <RangePanel index={index} range={range} onChange={changeRange} favorites={favorites} onFavorites={changeFavorites} onClose={() => setPanel(false)} />
          </div>
        </div>
      )}
    </div>
  )

  function clipList() {
    if (!cell) return <p className="px-3 py-4 text-sm text-muted-foreground border-t border-border lg:border-t-0">매트릭스 칸을 누르면 그 클립들이 여기 나와요.</p>
    const title = `${cell.action === ALL ? "모든 액션" : cell.action}${cell.label === ALL ? "" : ` · ${cell.label}`}`
    return (
      <div className="border-t border-border lg:border-t-0" data-testid="clip-list">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card">
          <span className="text-sm font-medium truncate">{sideName} · {title}</span>
          <span className="text-sm text-muted-foreground">{list.length}개</span>
          <span className="flex-1" />
          {list.length > 0 && (
            <button onClick={() => setCurrent(list[0].key)} className="h-8 px-3 bg-primary text-primary-foreground text-sm font-bold" data-testid="play-all">
              처음부터 재생
            </button>
          )}
        </div>
        <ul className="lg:max-h-[50vh] lg:overflow-y-auto">
          {list.slice(0, shown).map((c) => {
            const m = byId.get(c.matchId)
            const on = c.key === current
            return (
              <li key={c.key}>
                <button onClick={() => setCurrent(c.key)} className={cn("w-full text-left px-3 py-2 border-b border-border flex flex-col gap-0.5", on ? "bg-[var(--tone-accent-100)]" : "hover:bg-card")} data-testid="clip">
                  <span className={cn("text-xs tabular-nums", on ? "text-primary font-bold" : "text-muted-foreground")}>
                    {[active.length > 1 ? matchLabel(m) : "", c.quarter, mmss(c.start)].filter(Boolean).join(" · ")}
                  </span>
                  <span className="text-sm min-w-0">
                    <span className="font-medium">{actionOfClip.get(c.key) ?? c.code}</span>
                    {c.labels.length > 0 && <span className="text-muted-foreground"> · {c.labels.map((l) => l.t).join(", ")}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {list.length > shown && (
          <button onClick={() => setShown((s) => s + MAX_LIST)} className="w-full py-3 text-sm text-muted-foreground border-b border-border">
            {list.length - shown}개 더 보기
          </button>
        )}
      </div>
    )
  }
}

function Cell({ n, on, onClick, strong }: { n: number; on: boolean; onClick: () => void; strong?: boolean }) {
  if (!n) return <td className="px-2 py-1.5 border-b border-border text-center text-muted-foreground/40">·</td>
  return (
    <td className="border-b border-border p-0 text-center">
      <button onClick={onClick} className={cn("w-full px-2 py-1.5 tabular-nums", strong && "font-bold", on ? "bg-primary text-primary-foreground" : "hover:bg-[var(--tone-accent-100)]")} data-testid="cell">
        {n}
      </button>
    </td>
  )
}

function MChip({ on, onClick, label, n }: { on: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button onClick={onClick} className={cn("h-8 px-2.5 text-sm border inline-flex items-center gap-1.5", on ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card")}>
      {label} <span className={cn("text-xs", on ? "opacity-80" : "text-muted-foreground")}>{n}</span>
    </button>
  )
}
