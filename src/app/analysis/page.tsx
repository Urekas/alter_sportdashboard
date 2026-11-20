"use client"

// 통합 영상 분석 — 왼쪽에서 위→아래로 ① 경기 ② 누구 ③ 장면 ④ 결과를 고르면, 오른쪽 큰 영상 바로 아래에 재생목록
//  - 경기: 대회별로 묶인 체크 목록 (팀을 바꾸면 그 팀 최근 대회가 골라짐)
//  - 장면: 슈팅·서클 진입처럼 보고 싶은 것만 위에, 구간 코드(TEAM·ATT·START…)는 접어 둠
//  - 표로 보기: 장면 × 결과 숫자 표 (칸 누르면 그 장면·결과로)
// 데이터: VideoIndex(경기 요약, 전부) + VideoClips(고른 경기만, 경기당 읽기 1번) — src/lib/video-index.ts
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ChevronDown, Loader2, Search } from "lucide-react"
import { useFirestore } from "@/firebase"
import { VideoIndexService } from "@/lib/video-index-service"
import { actionKey, actionsFor, type Clip, type VideoIndexDoc } from "@/lib/video-index"
import { ClipPlayer } from "@/components/analysis/clip-player"
import { cn } from "@/lib/utils"

const MAX_LIST = 200
const ALL = "\u0000전체"
// 구간·기타 코드 — 장면 목록에서 아래로 접음
const PHASE = /^(team|att)$|start$|하프라인|비디오|^s\.?o$|^home|^away/i

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
const opponentOf = (m: VideoIndexDoc, team: string) => (m.home === team ? m.away : m.away === team ? m.home : "")

type Group = { id: string; name: string; cat: string; last: string; matches: VideoIndexDoc[] }

export default function AnalysisPage() {
  const db = useFirestore()
  const [index, setIndex] = useState<VideoIndexDoc[] | null>(null)
  const [error, setError] = useState("")
  const [team, setTeam] = useState("")
  const [sel, setSel] = useState<string[]>([])
  const [side, setSide] = useState<"us" | "opp">("us")
  const [action, setAction] = useState<string | null>(null)
  const [labels, setLabels] = useState<string[]>([])
  const [group, setGroup] = useState("")
  const [mode, setMode] = useState<"pick" | "table">("pick")
  const [clips, setClips] = useState<Clip[]>([])
  const [loading, setLoading] = useState(false)
  const [current, setCurrent] = useState<string | null>(null)
  const [shown, setShown] = useState(MAX_LIST)
  const [q, setQ] = useState("")
  const [openGroups, setOpenGroups] = useState<string[]>([])
  const [showPhase, setShowPhase] = useState(false)
  const [mobileMatches, setMobileMatches] = useState(false)

  const byId = useMemo(() => new Map((index ?? []).map((m) => [m.matchId, m])), [index])

  // 팀의 대회 묶음 (최근 대회 먼저)
  const groupsOf = useCallback((ix: VideoIndexDoc[], t: string): Group[] => {
    const g = new Map<string, Group>()
    for (const m of ix) {
      if (t && m.home !== t && m.away !== t) continue
      const x = g.get(m.tournamentId) ?? { id: m.tournamentId, name: m.tournamentName || "대회 없음", cat: m.tournamentCategory, last: "", matches: [] }
      x.matches.push(m)
      if ((m.date || "") > x.last) x.last = m.date || ""
      g.set(m.tournamentId, x)
    }
    for (const x of g.values()) x.matches.sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.name.localeCompare(b.name, "ko"))
    return [...g.values()].sort((a, b) => b.last.localeCompare(a.last))
  }, [])

  const chooseTeam = useCallback(
    (ix: VideoIndexDoc[], t: string, keep?: string[]) => {
      const gs = groupsOf(ix, t)
      const valid = new Set(gs.flatMap((g) => g.matches.map((m) => m.matchId)))
      const kept = keep?.filter((id) => valid.has(id)) ?? []
      const next = kept.length ? kept : gs[0]?.matches.map((m) => m.matchId) ?? []
      setTeam(t)
      setSel(next)
      setCurrent(null)
      setOpenGroups(gs.filter((g) => g.matches.some((m) => next.includes(m.matchId))).map((g) => g.id))
      writeLS("analysis.sel", { team: t, matchIds: next })
    },
    [groupsOf],
  )

  // 처음: 지난번 고른 팀·경기, 없으면 가장 많이 나온 팀(보통 우리 팀)의 최근 대회
  useEffect(() => {
    if (!db) return
    VideoIndexService.list(db)
      .then((ix) => {
        setIndex(ix)
        const saved = readLS<{ team: string; matchIds: string[] } | null>("analysis.sel", null)
        const c = new Map<string, number>()
        for (const m of ix) for (const t of [m.home, m.away]) c.set(t, (c.get(t) ?? 0) + 1)
        const top = [...c].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ""
        const t = saved && c.has(saved.team) ? saved.team : top
        chooseTeam(ix, t, saved?.team === t ? saved.matchIds : undefined)
        setGroup(readLS("analysis.group", ""))
      })
      .catch((e) => setError(String(e?.message ?? e)))
  }, [db, chooseTeam])

  const groups = useMemo(() => (index ? groupsOf(index, team) : []), [index, team, groupsOf])
  const teams = useMemo(() => {
    const c = new Map<string, number>()
    for (const m of index ?? []) for (const t of [m.home, m.away]) if (t) c.set(t, (c.get(t) ?? 0) + 1)
    return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
  }, [index])

  const setSelection = (ids: string[]) => {
    setSel(ids)
    setCurrent(null)
    writeLS("analysis.sel", { team, matchIds: ids })
  }
  const toggleMatch = (id: string) => setSelection(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id])
  const toggleGroup = (g: Group) => {
    const ids = g.matches.map((m) => m.matchId)
    const all = ids.every((id) => sel.includes(id))
    setSelection(all ? sel.filter((id) => !ids.includes(id)) : [...new Set([...sel, ...ids])])
  }

  // 고른 경기 클립 (경기당 한 번만 읽음)
  const selKey = sel.slice().sort().join(",")
  useEffect(() => {
    if (!db || !index) return
    let gone = false
    setLoading(true)
    VideoIndexService.clips(db, sel)
      .then((c) => !gone && setClips(c))
      .catch((e) => !gone && setError(String(e?.message ?? e)))
      .finally(() => !gone && setLoading(false))
    return () => {
      gone = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, index, selKey])

  const teamNames = useMemo(() => [...new Set((index ?? []).flatMap((m) => [m.home, m.away]))], [index])
  const actionOfClip = useMemo(() => actionsFor(clips, teamNames), [clips, teamNames])
  const sideClips = useMemo(() => clips.filter((c) => (side === "us" ? c.team === team : c.team && c.team !== team)), [clips, side, team])
  const actOf = useCallback((c: Clip) => actionOfClip.get(c.key) ?? c.code, [actionOfClip])

  // ③ 장면 목록
  const actions = useMemo(() => {
    const c = new Map<string, number>()
    for (const cl of sideClips) c.set(actOf(cl), (c.get(actOf(cl)) ?? 0) + 1)
    const all = [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    return { main: all.filter(([a]) => !PHASE.test(a.trim())), phase: all.filter(([a]) => PHASE.test(a.trim())) }
  }, [sideClips, actOf])
  // 고른 장면이 없거나 사라지면: 슈팅 → 첫 장면
  const useAction = useMemo(() => {
    const has = (a: string | null) => !!a && [...actions.main, ...actions.phase].some(([x]) => actionKey(x) === actionKey(a))
    if (has(action)) return action!
    return actions.main.find(([a]) => actionKey(a) === actionKey("슈팅"))?.[0] ?? actions.main[0]?.[0] ?? actions.phase[0]?.[0] ?? null
  }, [action, actions])
  const actionClips = useMemo(() => (useAction ? sideClips.filter((c) => actionKey(actOf(c)) === actionKey(useAction)) : []), [sideClips, useAction, actOf])

  // ④ 결과(라벨) — 라벨 묶음은 이 장면에서 많이 쓰인 순
  const labelGroups = useMemo(() => {
    const c = new Map<string, number>()
    for (const cl of actionClips) for (const g of new Set(cl.labels.map((l) => l.g))) c.set(g, (c.get(g) ?? 0) + 1)
    return [...c].sort((a, b) => b[1] - a[1]).map(([g]) => g)
  }, [actionClips])
  const useGroup = labelGroups.includes(group) ? group : labelGroups.find((g) => /결과|result|outcome/i.test(g)) ?? labelGroups[0] ?? ""
  const labelCounts = useMemo(() => {
    const c = new Map<string, number>()
    for (const cl of actionClips) for (const t of new Set(cl.labels.filter((l) => l.g === useGroup).map((l) => l.t))) c.set(t, (c.get(t) ?? 0) + 1)
    return [...c].sort((a, b) => b[1] - a[1])
  }, [actionClips, useGroup])
  const useLabels = labels.filter((l) => labelCounts.some(([t]) => t === l))

  const list = useMemo(
    () =>
      actionClips
        .filter((cl) => !useLabels.length || cl.labels.some((l) => l.g === useGroup && useLabels.includes(l.t)))
        .sort((a, b) => (byId.get(a.matchId)?.date ?? "").localeCompare(byId.get(b.matchId)?.date ?? "") || a.matchId.localeCompare(b.matchId) || a.start - b.start),
    [actionClips, useLabels, useGroup, byId],
  )

  const pickAction = (a: string) => {
    setAction(a)
    setLabels([])
    setShown(MAX_LIST)
    setCurrent(null)
  }
  const toggleLabel = (t: string) => {
    setLabels(useLabels.includes(t) ? useLabels.filter((x) => x !== t) : [...useLabels, t])
    setShown(MAX_LIST)
    setCurrent(null)
  }
  const pickGroup = (g: string) => {
    setGroup(g)
    setLabels([])
    writeLS("analysis.group", g)
  }

  const curIdx = list.findIndex((c) => c.key === current)
  const curClip = curIdx >= 0 ? list[curIdx] : null
  const go = (d: number) => {
    const i = curIdx + d
    if (i >= 0 && i < list.length) setCurrent(list[i].key)
  }
  const matchLabel = (m?: VideoIndexDoc) => (m ? `${shortDate(m.date)} ${opponentOf(m, team) || m.away}`.trim() : "")
  const clipTitle = (c: Clip) => `${matchLabel(byId.get(c.matchId))} · ${c.quarter ? c.quarter + " " : ""}${mmss(c.start)} · ${c.team} ${actOf(c)}${c.labels.length ? " · " + c.labels.map((l) => l.t).join(", ") : ""}`
  const listTitle = `${side === "us" ? team : "상대"} · ${useAction ?? "장면 없음"}${useLabels.length ? " · " + useLabels.join(", ") : ""}`
  const selSummary = (() => {
    const gs = groups.filter((g) => g.matches.some((m) => sel.includes(m.matchId)))
    if (!sel.length) return "경기를 골라 주세요"
    return gs.length === 1 ? `${gs[0].name} · ${sel.length}경기` : `${gs.length}개 대회 · ${sel.length}경기`
  })()

  // 표로 보기: 장면 × 결과
  const matrix = useMemo(() => {
    if (mode !== "table") return null
    const cols = new Map<string, number>()
    const rows = new Map<string, { total: number; cells: Map<string, number> }>()
    for (const cl of sideClips) {
      const a = actOf(cl)
      const r = rows.get(a) ?? { total: 0, cells: new Map() }
      r.total++
      for (const t of new Set(cl.labels.filter((l) => l.g === useGroup).map((l) => l.t))) {
        r.cells.set(t, (r.cells.get(t) ?? 0) + 1)
        cols.set(t, (cols.get(t) ?? 0) + 1)
      }
      rows.set(a, r)
    }
    const all = [...rows].sort((a, b) => b[1].total - a[1].total)
    return { cols: [...cols].sort((a, b) => b[1] - a[1]).map(([t]) => t), rows: [...all.filter(([a]) => !PHASE.test(a)), ...all.filter(([a]) => PHASE.test(a))] }
  }, [mode, sideClips, actOf, useGroup])

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

  const step = (n: number, title: string, extra?: React.ReactNode) => (
    <div className="flex items-center gap-2 mb-2">
      <span className="h-5 w-5 rounded-full bg-foreground text-background text-[11px] font-bold inline-flex items-center justify-center shrink-0">{n}</span>
      <span className="text-sm font-bold">{title}</span>
      {extra}
    </div>
  )

  const s = q.trim().toLowerCase()
  const matchPicker = (
    <div data-testid="match-picker">
      <div className="flex gap-1.5 mb-2">
        <select value={team} onChange={(e) => chooseTeam(index, e.target.value)} className="h-9 border border-border bg-card px-2 text-sm min-w-0 flex-1" data-testid="team-select" aria-label="팀">
          {teams.map(([t, n]) => (
            <option key={t} value={t}>{t} ({n}경기)</option>
          ))}
        </select>
        <label className="h-9 border border-border bg-card px-2 inline-flex items-center gap-1 flex-1 min-w-0">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="대회·상대 찾기" className="bg-transparent outline-none text-sm min-w-0 w-full" />
        </label>
      </div>
      <div className="space-y-1">
        {groups.map((g) => {
          const ms = g.matches.filter((m) => !s || `${g.name} ${g.cat} ${opponentOf(m, team)} ${m.name}`.toLowerCase().includes(s))
          if (!ms.length) return null
          const nSel = g.matches.filter((m) => sel.includes(m.matchId)).length
          const open = !!s || openGroups.includes(g.id)
          return (
            <div key={g.id} className="border border-border bg-card" data-testid="tournament">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <input type="checkbox" className="accent-[#ec3013] h-4 w-4 shrink-0" checked={nSel === g.matches.length} ref={(el) => { if (el) el.indeterminate = nSel > 0 && nSel < g.matches.length }} onChange={() => toggleGroup(g)} aria-label={`${g.name} 전체`} />
                <button onClick={() => setOpenGroups((o) => (o.includes(g.id) ? o.filter((x) => x !== g.id) : [...o, g.id]))} className="flex-1 min-w-0 flex items-center gap-1.5 text-left">
                  <span className="text-sm font-medium truncate">{g.name}</span>
                  {g.cat && <span className="text-[11px] text-muted-foreground shrink-0">{g.cat.replace("대표팀", "")}</span>}
                  <span className="flex-1" />
                  <span className={cn("text-xs shrink-0 tabular-nums", nSel ? "text-primary font-bold" : "text-muted-foreground")}>{nSel}/{g.matches.length}</span>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
                </button>
              </div>
              {open && (
                <div className="border-t border-border">
                  {ms.map((m) => (
                    <label key={m.matchId} className="flex items-center gap-2 px-2 py-1 text-sm cursor-pointer hover:bg-background" title={m.name}>
                      <input type="checkbox" className="accent-[#ec3013] h-4 w-4 shrink-0" checked={sel.includes(m.matchId)} onChange={() => toggleMatch(m.matchId)} />
                      <span className="text-xs text-muted-foreground tabular-nums w-10 shrink-0">{shortDate(m.date)}</span>
                      <span className="truncate">vs {opponentOf(m, team) || m.away}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  const sidePicker = (
    <div className="flex border border-foreground w-full" role="tablist">
      {(["us", "opp"] as const).map((x) => (
        <button key={x} onClick={() => { setSide(x); setCurrent(null) }} className={cn("h-9 flex-1 text-sm", side === x ? "bg-foreground text-background" : "bg-card")} data-testid={`side-${x}`}>
          {x === "us" ? team : "상대팀"}
        </button>
      ))}
    </div>
  )

  const actionRow = ([a, n]: [string, number]) => {
    const on = useAction !== null && actionKey(a) === actionKey(useAction)
    return (
      <button key={a} onClick={() => pickAction(a)} className={cn("w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-sm text-left", on ? "bg-primary text-primary-foreground font-bold" : "hover:bg-card")} data-testid="action">
        <span className="truncate">{a}</span>
        <span className={cn("tabular-nums text-xs", on ? "" : "text-muted-foreground")}>{n}</span>
      </button>
    )
  }
  const actionPicker = (
    <div data-testid="action-picker">
      <div className="border border-border bg-background max-lg:grid max-lg:grid-cols-2">{actions.main.map(actionRow)}</div>
      {actions.phase.length > 0 && (
        <>
          <button onClick={() => setShowPhase((v) => !v)} className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1" data-testid="phase-toggle">
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showPhase && "rotate-180")} /> 구간·기타 코드 {actions.phase.length}개 (TEAM·ATT·START…)
          </button>
          {showPhase && <div className="mt-1 border border-border bg-background max-lg:grid max-lg:grid-cols-2">{actions.phase.map(actionRow)}</div>}
        </>
      )}
      {!actions.main.length && !actions.phase.length && <p className="text-sm text-muted-foreground">{loading ? "불러오는 중…" : "고른 경기에 클립이 없어요"}</p>}
    </div>
  )

  const labelPicker = (
    <div data-testid="label-picker">
      {labelCounts.length ? (
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setLabels([])} className={cn("h-8 px-2.5 text-sm border", !useLabels.length ? "bg-foreground text-background border-foreground" : "border-border bg-card")}>
            전체 <span className="text-xs opacity-70">{actionClips.length}</span>
          </button>
          {labelCounts.map(([t, n]) => (
            <button key={t} onClick={() => toggleLabel(t)} className={cn("h-8 px-2.5 text-sm border", useLabels.includes(t) ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card")} data-testid="label">
              {t} <span className="text-xs opacity-70">{n}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">이 장면엔 결과 라벨이 없어요</p>
      )}
    </div>
  )
  const groupSelect =
    labelGroups.length > 1 ? (
      <select value={useGroup} onChange={(e) => pickGroup(e.target.value)} className="ml-auto h-7 border border-border bg-card px-1.5 text-xs max-w-[50%]" data-testid="group-select" aria-label="라벨 묶음">
        {labelGroups.map((g) => (
          <option key={g} value={g}>{g || "그룹 없음"}</option>
        ))}
      </select>
    ) : undefined

  const table = matrix && (
    <div className="overflow-auto border border-border bg-background max-h-[70vh]" data-testid="matrix">
      <table className="text-xs border-collapse min-w-full">
        <thead className="sticky top-0 bg-background z-10">
          <tr>
            <th className="text-left font-medium text-muted-foreground px-2 py-1.5 border-b border-border sticky left-0 bg-background">장면</th>
            <th className="px-1.5 py-1.5 border-b border-border font-medium">전체</th>
            {matrix.cols.map((c) => (
              <th key={c} className="px-1.5 py-1.5 border-b border-border font-medium whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map(([a, r]) => (
            <tr key={a}>
              <th className={cn("text-left font-medium px-2 py-1 border-b border-border whitespace-nowrap sticky left-0 bg-background", PHASE.test(a) && "text-muted-foreground font-normal")}>{a}</th>
              {[ALL, ...matrix.cols].map((c) => {
                const n = c === ALL ? r.total : r.cells.get(c) ?? 0
                const on = useAction !== null && actionKey(a) === actionKey(useAction) && (c === ALL ? !useLabels.length : useLabels.length === 1 && useLabels[0] === c)
                if (!n) return <td key={c} className="px-1.5 py-1 border-b border-border text-center text-muted-foreground/40">·</td>
                return (
                  <td key={c} className="border-b border-border p-0 text-center">
                    <button onClick={() => { setAction(a); setLabels(c === ALL ? [] : [c]); setCurrent(null); setShown(MAX_LIST) }} className={cn("w-full px-1.5 py-1 tabular-nums", c === ALL && "font-bold", on ? "bg-primary text-primary-foreground" : "hover:bg-[var(--tone-accent-100)]")} data-testid="cell">
                      {n}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const playlist = (
    <div className="flex flex-col min-h-0 lg:flex-1" data-testid="clip-list">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card shrink-0">
        <span className="text-sm font-bold truncate">{listTitle}</span>
        <span className="text-sm text-muted-foreground shrink-0">{list.length}개</span>
        <span className="flex-1" />
        {list.length > 0 && (
          <button onClick={() => setCurrent(list[0].key)} className="h-8 px-3 bg-primary text-primary-foreground text-sm font-bold shrink-0" data-testid="play-all">
            처음부터 재생
          </button>
        )}
      </div>
      <ul className="lg:overflow-y-auto lg:flex-1 lg:min-h-0">
        {list.slice(0, shown).map((c, i) => {
          const m = byId.get(c.matchId)
          const on = c.key === current
          return (
            <li key={c.key}>
              <button onClick={() => setCurrent(c.key)} className={cn("w-full text-left px-3 py-1.5 border-b border-border flex items-center gap-3", on ? "bg-[var(--tone-accent-100)]" : "hover:bg-card")} data-testid="clip">
                <span className={cn("w-6 text-right text-xs tabular-nums shrink-0", on ? "text-primary font-bold" : "text-muted-foreground")}>{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-xs tabular-nums", on ? "text-primary font-bold" : "text-muted-foreground")}>
                    {[sel.length > 1 ? matchLabel(m) : "", c.quarter, mmss(c.start)].filter(Boolean).join(" · ")}
                  </span>
                  <span className="block text-sm truncate">
                    <span className="font-medium">{actOf(c)}</span>
                    {c.labels.length > 0 && <span className="text-muted-foreground"> · {c.labels.map((l) => l.t).join(", ")}</span>}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
        {!list.length && <li className="px-3 py-6 text-sm text-muted-foreground">{loading ? "불러오는 중…" : "장면을 고르면 여기 목록이 나와요"}</li>}
        {list.length > shown && (
          <li>
            <button onClick={() => setShown((x) => x + MAX_LIST)} className="w-full py-2 text-sm text-muted-foreground border-b border-border">
              {list.length - shown}개 더 보기
            </button>
          </li>
        )}
      </ul>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground lg:h-screen lg:flex lg:flex-col lg:overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-3 h-12 shrink-0">
        <Link href="/" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground shrink-0"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">대시보드</span></Link>
        <span className="font-headline text-base shrink-0">영상 분석</span>
        <span className="text-sm text-muted-foreground truncate hidden sm:inline">{selSummary}</span>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
        <span className="flex-1" />
        <div className="inline-flex border border-border shrink-0" role="tablist">
          {(["pick", "table"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cn("h-8 px-3 text-sm", mode === m ? "bg-foreground text-background" : "bg-card")} data-testid={`mode-${m}`}>
              {m === "pick" ? "골라 보기" : "표로 보기"}
            </button>
          ))}
        </div>
      </div>

      <div className={cn("lg:flex-1 lg:min-h-0 lg:grid", mode === "table" ? "lg:grid-cols-[minmax(420px,1.1fr)_minmax(0,1.5fr)]" : "lg:grid-cols-[340px_minmax(0,1fr)]")}>
        {/* 오른쪽(휴대폰은 맨 위): 큰 영상 + 바로 아래 재생목록 */}
        <div className="sticky top-0 z-20 lg:static lg:order-2 lg:flex lg:flex-col lg:min-h-0 lg:border-l lg:border-border bg-background">
          <div className="lg:shrink-0 lg:w-full lg:max-w-[calc((100vh-330px)*16/9)] lg:mx-auto">
            <ClipPlayer
              db={db}
              clip={curClip}
              title={curClip ? clipTitle(curClip) : ""}
              onPrev={() => go(-1)}
              onNext={() => go(1)}
              hasPrev={curIdx > 0}
              hasNext={curIdx >= 0 ? curIdx < list.length - 1 : list.length > 0}
              onFromStart={() => list.length && setCurrent(list[0].key)}
              recordName={listTitle.replace(/ · /g, "_")}
            />
          </div>
          <div className="hidden lg:flex lg:flex-col lg:flex-1 lg:min-h-0 lg:border-t lg:border-border">{playlist}</div>
        </div>

        {/* 왼쪽: ① 경기 ② 누구 ③ 장면 ④ 결과 (위에서 아래로) */}
        <div className="lg:order-1 lg:overflow-y-auto px-3 py-3 space-y-5 min-w-0">
          <section>
            {step(
              1,
              "경기",
              <button onClick={() => setMobileMatches((v) => !v)} className="lg:hidden ml-auto text-xs text-muted-foreground inline-flex items-center gap-1 min-w-0" data-testid="match-toggle">
                <span className="truncate">{selSummary}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 shrink-0", mobileMatches && "rotate-180")} />
              </button>,
            )}
            <div className={cn(!mobileMatches && "max-lg:hidden")}>{matchPicker}</div>
          </section>
          <section>
            {step(2, "누구")}
            {sidePicker}
          </section>
          {mode === "pick" ? (
            <>
              <section>
                {step(3, "장면")}
                {actionPicker}
              </section>
              <section>
                {step(4, "결과", groupSelect)}
                {labelPicker}
              </section>
            </>
          ) : (
            <section>
              {step(3, "장면 × 결과", groupSelect)}
              {table}
            </section>
          )}
          {/* 휴대폰: 재생목록은 고르는 곳 바로 아래 */}
          <div className="lg:hidden -mx-3 border-t border-border">{playlist}</div>
        </div>
      </div>
    </div>
  )
}
