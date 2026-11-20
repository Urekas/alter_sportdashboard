"use client"

// 통합 영상 분석: 범위 고르기 — 팀 → 기간 → 대회(연도별·검색) → 상대, 즐겨찾기
import { useMemo, useState } from "react"
import { Star, Trash2, X } from "lucide-react"
import type { VideoIndexDoc } from "@/lib/video-index"
import { cn } from "@/lib/utils"

export interface Range {
  team: string
  years: string[] // 비면 전체
  tournaments: string[] // 비면 전체
  opponents: string[] // 비면 전체
}
export const emptyRange = (team = ""): Range => ({ team, years: [], tournaments: [], opponents: [] })

export const yearOf = (m: VideoIndexDoc) => (m.date || "").slice(0, 4) || "날짜 없음"
export const opponentOf = (m: VideoIndexDoc, team: string) => (m.home === team ? m.away : m.away === team ? m.home : "")

/** 범위 안 경기들 (날짜순) */
export function matchesIn(index: VideoIndexDoc[], r: Range): VideoIndexDoc[] {
  return index
    .filter((m) => !r.team || m.home === r.team || m.away === r.team)
    .filter((m) => !r.years.length || r.years.includes(yearOf(m)))
    .filter((m) => !r.tournaments.length || r.tournaments.includes(m.tournamentId))
    .filter((m) => !r.opponents.length || r.opponents.includes(opponentOf(m, r.team)))
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || a.name.localeCompare(b.name, "ko"))
}

export function rangeSummary(r: Range, index: VideoIndexDoc[]): string {
  const tn = new Map(index.map((m) => [m.tournamentId, m.tournamentName]))
  const parts = [r.team || "전체 팀"]
  parts.push(r.years.length ? r.years.join("·") : "전체 기간")
  if (r.tournaments.length) parts.push(r.tournaments.length === 1 ? tn.get(r.tournaments[0]) || "대회 1" : `대회 ${r.tournaments.length}개`)
  if (r.opponents.length) parts.push(r.opponents.length <= 2 ? `vs ${r.opponents.join("·")}` : `상대 ${r.opponents.length}팀`)
  return parts.join(" · ")
}

export type Favorite = { name: string; range: Range }

function Chip({ on, onClick, children, count }: { on: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button onClick={onClick} className={cn("h-8 px-2.5 text-sm border inline-flex items-center gap-1.5", on ? "bg-foreground text-background border-foreground" : "border-border bg-card hover:border-foreground/40")}>
      {children}
      {count !== undefined && <span className={cn("text-xs", on ? "text-background/70" : "text-muted-foreground")}>{count}</span>}
    </button>
  )
}

export function RangePanel({
  index,
  range,
  onChange,
  favorites,
  onFavorites,
  onClose,
}: {
  index: VideoIndexDoc[]
  range: Range
  onChange: (r: Range) => void
  favorites: Favorite[]
  onFavorites: (f: Favorite[]) => void
  onClose: () => void
}) {
  const [q, setQ] = useState("")
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const teams = useMemo(() => {
    const c = new Map<string, number>()
    for (const m of index) for (const t of [m.home, m.away]) if (t) c.set(t, (c.get(t) ?? 0) + 1)
    return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
  }, [index])
  const ofTeam = useMemo(() => matchesIn(index, { ...range, years: [], tournaments: [], opponents: [] }), [index, range])
  const years = useMemo(() => {
    const c = new Map<string, number>()
    for (const m of ofTeam) c.set(yearOf(m), (c.get(yearOf(m)) ?? 0) + 1)
    return [...c].sort((a, b) => b[0].localeCompare(a[0]))
  }, [ofTeam])
  const ofYears = useMemo(() => matchesIn(index, { ...range, tournaments: [], opponents: [] }), [index, range])
  const tournaments = useMemo(() => {
    const byYear = new Map<string, Map<string, { name: string; n: number; cat: string }>>()
    for (const m of ofYears) {
      const y = yearOf(m)
      const g = byYear.get(y) ?? new Map()
      const t = g.get(m.tournamentId) ?? { name: m.tournamentName || "대회 없음", n: 0, cat: m.tournamentCategory }
      t.n++
      g.set(m.tournamentId, t)
      byYear.set(y, g)
    }
    const s = q.trim().toLowerCase()
    return [...byYear]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([y, g]) => [y, [...g].filter(([, t]) => !s || `${t.name} ${t.cat}`.toLowerCase().includes(s))] as const)
      .filter(([, ts]) => ts.length)
  }, [ofYears, q])
  const ofTours = useMemo(() => matchesIn(index, { ...range, opponents: [] }), [index, range])
  const opponents = useMemo(() => {
    const c = new Map<string, number>()
    for (const m of ofTours) {
      const o = opponentOf(m, range.team)
      if (o) c.set(o, (c.get(o) ?? 0) + 1)
    }
    return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
  }, [ofTours, range.team])
  const total = matchesIn(index, range).length

  const saveFav = () => {
    const name = window.prompt("즐겨찾기 이름", rangeSummary(range, index))
    if (!name) return
    onFavorites([...favorites.filter((f) => f.name !== name), { name, range }])
  }

  return (
    <div className="flex flex-col h-full" data-testid="range-panel">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="font-headline text-base">범위 고르기</span>
        <span className="text-sm text-muted-foreground">{total}경기</span>
        <span className="flex-1" />
        <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center" aria-label="닫기">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
        {favorites.length > 0 && (
          <section>
            <h3 className="text-xs font-bold text-muted-foreground mb-2">즐겨찾기</h3>
            <div className="flex flex-wrap gap-1.5">
              {favorites.map((f) => (
                <span key={f.name} className="inline-flex">
                  <button onClick={() => onChange(f.range)} className="h-8 px-2.5 text-sm border border-primary text-primary inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5" /> {f.name}
                  </button>
                  <button onClick={() => onFavorites(favorites.filter((x) => x.name !== f.name))} className="h-8 w-7 border border-l-0 border-border text-muted-foreground inline-flex items-center justify-center" aria-label={`${f.name} 지우기`}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </section>
        )}
        <section>
          <h3 className="text-xs font-bold text-muted-foreground mb-2">1. 팀</h3>
          <div className="flex flex-wrap gap-1.5">
            {teams.map(([t, n]) => (
              <Chip key={t} on={range.team === t} count={n} onClick={() => onChange(emptyRange(t))}>
                {t}
              </Chip>
            ))}
          </div>
        </section>
        <section>
          <h3 className="text-xs font-bold text-muted-foreground mb-2">2. 기간</h3>
          <div className="flex flex-wrap gap-1.5">
            <Chip on={!range.years.length} onClick={() => onChange({ ...range, years: [], tournaments: [], opponents: [] })}>
              전체
            </Chip>
            {years.map(([y, n]) => (
              <Chip key={y} on={range.years.includes(y)} count={n} onClick={() => onChange({ ...range, years: toggle(range.years, y), tournaments: [], opponents: [] })}>
                {y}
              </Chip>
            ))}
          </div>
        </section>
        <section>
          <h3 className="text-xs font-bold text-muted-foreground mb-2">3. 대회</h3>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="대회 이름으로 찾기" className="w-full h-9 border border-border bg-card px-2 text-sm mb-2 outline-none focus:border-foreground" />
          <div className="space-y-3">
            <Chip on={!range.tournaments.length} onClick={() => onChange({ ...range, tournaments: [], opponents: [] })}>
              전체 대회
            </Chip>
            {tournaments.map(([y, ts]) => (
              <div key={y}>
                <div className="text-xs text-muted-foreground mb-1">{y}</div>
                <div className="flex flex-col gap-1">
                  {ts.map(([id, t]) => (
                    <label key={id} className={cn("flex items-center gap-2 border px-2 py-1.5 text-sm cursor-pointer", range.tournaments.includes(id) ? "border-foreground bg-card" : "border-border")}>
                      <input type="checkbox" className="accent-[#ec3013]" checked={range.tournaments.includes(id)} onChange={() => onChange({ ...range, tournaments: toggle(range.tournaments, id), opponents: [] })} />
                      <span className="flex-1 min-w-0 truncate">{t.name}</span>
                      {t.cat && <span className="text-xs text-muted-foreground">{t.cat}</span>}
                      <span className="text-xs text-muted-foreground">{t.n}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
        {range.team && (
          <section>
            <h3 className="text-xs font-bold text-muted-foreground mb-2">4. 상대</h3>
            <div className="flex flex-wrap gap-1.5">
              <Chip on={!range.opponents.length} onClick={() => onChange({ ...range, opponents: [] })}>
                전체
              </Chip>
              {opponents.map(([o, n]) => (
                <Chip key={o} on={range.opponents.includes(o)} count={n} onClick={() => onChange({ ...range, opponents: toggle(range.opponents, o) })}>
                  {o}
                </Chip>
              ))}
            </div>
          </section>
        )}
      </div>
      <div className="flex gap-2 border-t border-border px-4 py-3">
        <button onClick={saveFav} className="h-10 px-3 border border-border text-sm inline-flex items-center gap-1">
          <Star className="h-4 w-4" /> 즐겨찾기 저장
        </button>
        <span className="flex-1" />
        <button onClick={onClose} className="h-10 px-5 bg-primary text-primary-foreground text-sm font-bold" data-testid="range-apply">
          {total}경기 보기
        </button>
      </div>
    </div>
  )
}
