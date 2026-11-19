"use client"

// 웹 태깅: 유튜브가 연결되고 원본 XML이 저장된 경기의 태그를 영상 보면서 고치고 더함
//  - 코드 버튼: 한 번 누르면 시작, 다시 누르면 끝 (Alter Live·Sportscode와 같은 방식)
//  - 라벨 버튼: 고른 태그에 붙이기/떼기 (그룹이 있으면 그룹당 하나)
//  - 저장: 고친 XML로 대시보드 분석을 다시 계산해서 덮어씀, 직전 XML은 따로 보관 (되돌리기)
//  - ?dry=1 이면 저장하지 않고 계산 결과만 보여줌 (테스트용)
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Save, Undo2, Redo2, Trash2, Play, Pause, History, Square } from "lucide-react"
import { useFirestore } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { TournamentService } from "@/lib/tournament-service"
import { VideoMatchService, type VideoMatchMetadata } from "@/lib/video-match-service"
import type { MatchData } from "@/lib/types"
import { YouTubePlayer, youTubeId, type YouTubeHandle } from "@/components/youtube-player"
import {
  autoLabelsAt, codeList, fmtTime, isAutoLabel, labelGroups, newKey, parseScXml, rowColor, serializeScXml, textOn,
  type ScInstance, type ScLabel, type ScTimeline,
} from "@/lib/sc-xml"
import { loadBackup, saveTagging } from "@/lib/tag-save"
import { cn } from "@/lib/utils"

const ANGLES: { key: keyof VideoMatchMetadata["video_urls"]; name: string }[] = [
  { key: "tactical_cam1", name: "전술 1" },
  { key: "tactical_cam2", name: "전술 2" },
  { key: "tactical_cam3", name: "전술 3" },
  { key: "broadcast_cam", name: "중계" },
]
const ROW_H = 22
const NAME_W = 150

export default function TagPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params)
  const db = useFirestore()
  const { toast } = useToast()
  const [match, setMatch] = useState<MatchData | null>(null)
  const [video, setVideo] = useState<VideoMatchMetadata | null>(null)
  const [tournamentName, setTournamentName] = useState<string>("")
  const [loadError, setLoadError] = useState("")
  const [tl, setTl] = useState<ScTimeline>({ instances: [], rows: [] })
  const [past, setPast] = useState<ScTimeline[]>([])
  const [future, setFuture] = useState<ScTimeline[]>([])
  const [savedXml, setSavedXml] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  /** 지금 켜져 있는(시작만 하고 아직 안 끝낸) 태그: 코드 → 인스턴스 key */
  const [open, setOpen] = useState<Record<string, string>>({})
  const [angle, setAngle] = useState<string>("")
  const [clock, setClock] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const [pps, setPps] = useState(4) // 타임라인 1초당 픽셀
  const [saving, setSaving] = useState(false)
  const [dry, setDry] = useState(false)
  const player = useRef<YouTubeHandle>(null)
  const tlScroll = useRef<HTMLDivElement>(null)

  useEffect(() => setDry(new URLSearchParams(window.location.search).get("dry") === "1"), [])

  // ---- 불러오기 ----
  useEffect(() => {
    let gone = false
    ;(async () => {
      const m = await TournamentService.getMatchById(matchId)
      if (gone) return
      if (!m) return setLoadError("경기를 찾을 수 없어요")
      if (!m.rawSourceText || !/<instance>/.test(m.rawSourceText)) return setLoadError("이 경기에는 저장된 Sportscode XML이 없어요 (CSV로 올린 경기는 아직 안 돼요)")
      const v = m.videoMatchId ? await VideoMatchService.get(db, m.videoMatchId) : null
      if (gone) return
      const first = v ? ANGLES.find((a) => youTubeId(v.video_urls?.[a.key] ?? "")) : undefined
      if (!v || !first) return setLoadError("이 경기에 연결된 유튜브 영상이 없어요 — 경기 목록의 \"영상\"에서 먼저 연결해 주세요")
      const parsed = parseScXml(m.rawSourceText)
      setMatch(m)
      if (new URLSearchParams(window.location.search).get("dry") === "1") (window as any).__tagMatch = m // 테스트용 비교
      setVideo(v)
      setAngle(first.key)
      setTl(parsed)
      setSavedXml(serializeScXml(parsed))
      if (m.tournamentId) {
        const ts = await TournamentService.getTournaments()
        if (!gone) setTournamentName(ts.find((t) => t.id === m.tournamentId)?.name ?? m.tournamentName ?? "")
      }
    })().catch((e) => !gone && setLoadError(String(e?.message ?? e)))
    return () => {
      gone = true
    }
  }, [matchId, db])

  const offset = useMemo(() => Number(video?.video_offsets?.[angle as keyof VideoMatchMetadata["video_offsets"]]) || 0, [video, angle])
  const videoId = useMemo(() => youTubeId(video?.video_urls?.[angle as keyof VideoMatchMetadata["video_urls"]] ?? ""), [video, angle])
  // 경기 시간(XML 시간) = 영상 시간 + offset
  const now = useCallback(() => (player.current?.time() ?? 0) + offset, [offset])
  const seek = useCallback((t: number) => player.current?.seek(t - offset), [offset])

  useEffect(() => {
    const id = setInterval(() => setClock(now()), 100)
    return () => clearInterval(id)
  }, [now])

  // ---- 편집 (모든 변경은 여기를 거쳐서 되돌리기 기록) ----
  const tlRef = useRef(tl)
  tlRef.current = tl
  const edit = useCallback((fn: (t: ScTimeline) => ScTimeline) => {
    const before = tlRef.current
    const after = fn(before)
    if (after === before) return
    setPast((p) => [...p.slice(-199), before])
    setFuture([])
    setTl(after)
  }, [])
  const patchInst = (key: string, fn: (i: ScInstance) => ScInstance) =>
    edit((t) => ({ ...t, instances: t.instances.map((i) => (i.key === key ? fn(i) : i)) }))

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p
      setFuture((f) => [tlRef.current, ...f])
      setTl(p[p.length - 1])
      return p.slice(0, -1)
    })
    setOpen({})
  }, [])
  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f
      setPast((p) => [...p, tlRef.current])
      setTl(f[0])
      return f.slice(1)
    })
  }, [])

  const codes = useMemo(() => codeList(tl), [tl])
  const groups = useMemo(() => labelGroups(tl), [tl])
  const sel = tl.instances.find((i) => i.key === selected) ?? null
  const dirty = useMemo(() => serializeScXml(tl) !== savedXml, [tl, savedXml])
  const duration = useMemo(() => Math.max(player.current?.duration?.() ? player.current.duration() + offset : 0, ...tl.instances.map((i) => i.end), 60) + 30, [tl, offset, clock > 0])

  // 켜져 있는 태그는 끝이 지금 시간을 따라감 (화면에만, 끝낼 때 확정)
  const shownEnd = (i: ScInstance) => (Object.values(open).includes(i.key) ? Math.max(i.start, clock) : i.end)

  // ---- 코드 버튼 ----
  const pressCode = (code: string) => {
    const t = now()
    const k = open[code]
    if (k) {
      patchInst(k, (i) => ({ ...i, end: Math.max(i.start, t) }))
      const { [code]: _, ...rest } = open
      setOpen(rest)
      setSelected(k)
      return
    }
    const key = newKey()
    edit((x) => ({ ...x, instances: [...x.instances, { key, start: t, end: t, code, labels: autoLabelsAt(x, t), extra: "" }] }))
    setOpen((o) => ({ ...o, [code]: key }))
    setSelected(key)
  }
  const endAll = useCallback(() => {
    const t = now()
    const keys = Object.values(open)
    if (!keys.length) return
    edit((x) => ({ ...x, instances: x.instances.map((i) => (keys.includes(i.key) ? { ...i, end: Math.max(i.start, t) } : i)) }))
    setOpen({})
  }, [open, now, edit])

  // ---- 라벨 버튼: 고른 태그에 붙이기/떼기 ----
  const toggleLabel = (group: string, text: string) => {
    if (!sel) return toast({ title: "라벨을 붙일 태그를 먼저 골라 주세요" })
    patchInst(sel.key, (i) => {
      const g = group === "" ? undefined : group
      const has = i.labels.some((l) => (l.group ?? "") === group && l.text === text)
      if (has) return { ...i, labels: i.labels.filter((l) => !((l.group ?? "") === group && l.text === text)) }
      // 같은 그룹에 여러 개도 됨 (실제 데이터에 "결과: GK_save + PC" 같은 게 있음)
      return { ...i, labels: [...i.labels, { ...(g !== undefined ? { group: g } : {}), text }] }
    })
  }

  const removeSelected = useCallback(() => {
    if (!selected) return
    edit((x) => ({ ...x, instances: x.instances.filter((i) => i.key !== selected) }))
    setOpen((o) => Object.fromEntries(Object.entries(o).filter(([, k]) => k !== selected)))
    setSelected(null)
  }, [selected, edit])

  // ---- 키보드 ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault()
        return e.shiftKey ? redo() : undo()
      }
      if (mod && e.key.toLowerCase() === "y") return e.preventDefault(), redo()
      if (mod && e.key.toLowerCase() === "s") return e.preventDefault(), void doSave()
      if (e.code === "Space") return e.preventDefault(), player.current?.toggle()
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault()
        const d = (e.shiftKey ? 5 : 1) * (e.key === "ArrowLeft" ? -1 : 1)
        return seek(now() + d)
      }
      if (e.key === "Tab") return e.preventDefault(), endAll()
      if (e.key === "Delete" || e.key === "Backspace") return e.preventDefault(), removeSelected()
      if (e.key === "Escape") return setSelected(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  // 재생 중엔 타임라인이 재생 위치를 따라감
  useEffect(() => {
    const el = tlScroll.current
    if (!el || !playing) return
    const x = clock * pps
    if (x < el.scrollLeft + 40 || x > el.scrollLeft + el.clientWidth - NAME_W - 60) el.scrollLeft = Math.max(0, x - 120)
  }, [clock, playing, pps])

  // 저장 안 하고 나가려 하면 확인
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault()
    }
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [dirty])

  async function doSave() {
    if (!match || saving) return
    if (Object.keys(open).length) endAll()
    setSaving(true)
    try {
      const xml = serializeScXml(tlRef.current)
      const r = await saveTagging(db, match, xml, { dry, tournamentName })
      if (r.dry) {
        toast({ title: `저장 안 함 (테스트) — 이벤트 ${r.events}개로 다시 계산됨`, description: `${r.data.homeTeam.name} ${r.data.matchStats.home.goals.field + r.data.matchStats.home.goals.pc} : ${r.data.matchStats.away.goals.field + r.data.matchStats.away.goals.pc} ${r.data.awayTeam.name}` })
        ;(window as any).__tagDry = r.data
      } else {
        setMatch({ ...match, ...r.data, id: match.id })
        setSavedXml(xml)
        toast({ title: `저장했어요 — 대시보드 다시 계산됨 (이벤트 ${r.events}개)` })
      }
    } catch (e: any) {
      toast({ title: "저장하지 못했어요", description: String(e?.message ?? e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function restoreBackup() {
    const xml = await loadBackup(db, matchId).catch(() => null)
    if (!xml) return toast({ title: "되돌릴 이전 저장본이 없어요" })
    if (!confirm("직전 저장 전 상태를 불러올까요? (저장을 눌러야 실제로 바뀌어요)")) return
    edit(() => parseScXml(xml))
    setOpen({})
    setSelected(null)
  }

  // ---- 화면 ----
  if (loadError)
    return (
      <div className="min-h-screen bg-background p-8">
        <Link href="/" className="text-sm text-muted-foreground inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> 대시보드</Link>
        <p className="mt-6 text-foreground">{loadError}</p>
      </div>
    )
  if (!match || !video)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> 불러오는 중…
      </div>
    )

  const anglesWithVideo = ANGLES.filter((a) => youTubeId(video.video_urls?.[a.key] ?? ""))
  const openKeys = Object.values(open)

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 상단 */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2">
        <Link href="/" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="h-4 w-4" /> 대시보드</Link>
        <span className="font-headline text-base">태깅</span>
        <span className="text-sm text-muted-foreground truncate">{tournamentName ? `${tournamentName} › ` : ""}{match.matchName || `${match.homeTeam.name} vs ${match.awayTeam.name}`}</span>
        <span className="flex-1" />
        {dry && <span className="text-xs border border-primary text-primary px-2 py-0.5">테스트 모드 — 저장 안 됨</span>}
        <span className={cn("text-xs", dirty ? "text-primary" : "text-muted-foreground")} data-testid="dirty">{dirty ? "저장 안 한 변경 있음" : "저장됨"}</span>
        <Button variant="outline" size="sm" onClick={undo} disabled={!past.length} title="되돌리기 (Ctrl+Z)"><Undo2 className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" onClick={redo} disabled={!future.length} title="다시 하기 (Ctrl+Shift+Z)"><Redo2 className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" onClick={restoreBackup} title="직전 저장 전 상태 불러오기"><History className="h-4 w-4 mr-1" /> 이전 저장본</Button>
        <Button size="sm" onClick={doSave} disabled={saving || (!dirty && !dry)} title="저장 (Ctrl+S)">
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} 저장
        </Button>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* 영상 + 고른 태그 */}
        <div className="min-w-0 space-y-3">
          {videoId && <YouTubePlayer ref={player} videoId={videoId} onState={setPlaying} onReady={() => player.current?.setRate(rate)} />}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button variant="outline" size="sm" onClick={() => seek(now() - 5)}>-5s</Button>
            <Button variant="outline" size="sm" onClick={() => seek(now() - 1)}>-1s</Button>
            <Button variant="outline" size="sm" onClick={() => player.current?.toggle()} aria-label="재생/정지">{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
            <Button variant="outline" size="sm" onClick={() => seek(now() + 1)}>+1s</Button>
            <Button variant="outline" size="sm" onClick={() => seek(now() + 5)}>+5s</Button>
            <select className="h-9 border border-input bg-background px-2" value={rate} onChange={(e) => { const r = Number(e.target.value); setRate(r); player.current?.setRate(r) }}>
              {[0.25, 0.5, 1, 1.5, 2].map((r) => <option key={r} value={r}>{r}x</option>)}
            </select>
            <span className="font-mono tabular-nums" data-testid="clock">{fmtTime(clock)}</span>
            <span className="flex-1" />
            {anglesWithVideo.length > 1 && (
              <select className="h-9 border border-input bg-background px-2" value={angle} onChange={(e) => { const t = now(); setAngle(e.target.value); setTimeout(() => seek(t), 1500) }}>
                {anglesWithVideo.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
              </select>
            )}
          </div>

          {/* 고른 태그 */}
          <div className="border border-border bg-card p-3 text-sm" data-testid="inspector">
            {!sel ? (
              <p className="text-muted-foreground">타임라인에서 태그를 누르면 여기서 고칠 수 있어요. 코드 버튼을 누르면 지금 위치에 새 태그가 생겨요.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-block h-3 w-3" style={{ background: rowColor(tl.rows, sel.code) }} />
                  <select className="h-8 border border-input bg-background px-2 font-medium" value={sel.code} onChange={(e) => patchInst(sel.key, (i) => ({ ...i, code: e.target.value }))} data-testid="sel-code">
                    {codes.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {openKeys.includes(sel.key) && <span className="text-xs text-primary">진행 중</span>}
                  <span className="flex-1" />
                  <Button variant="outline" size="sm" onClick={() => seek(sel.start)}><Play className="h-3 w-3 mr-1" /> 이 장면</Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={removeSelected} title="삭제 (Delete)"><Trash2 className="h-3 w-3 mr-1" /> 삭제</Button>
                </div>
                {(["start", "end"] as const).map((k) => (
                  <div key={k} className="flex flex-wrap items-center gap-1">
                    <span className="w-8 text-muted-foreground">{k === "start" ? "시작" : "끝"}</span>
                    <span className="w-20 font-mono tabular-nums" data-testid={`sel-${k}`}>{fmtTime(k === "end" ? shownEnd(sel) : sel[k])}</span>
                    {[-1, -0.2, 0.2, 1].map((d) => (
                      <Button key={d} variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => patchInst(sel.key, (i) => fix({ ...i, [k]: i[k] + d }, k))}>{d > 0 ? `+${d}` : d}</Button>
                    ))}
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => patchInst(sel.key, (i) => fix({ ...i, [k]: now() }, k))}>지금으로</Button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-1 pt-1" data-testid="sel-labels">
                  {sel.labels.length === 0 && <span className="text-muted-foreground">라벨 없음</span>}
                  {sel.labels.map((l, n) => (
                    <button key={n} className={cn("border px-2 py-0.5 text-xs", isAutoLabel(l) ? "border-border text-muted-foreground" : "border-foreground")}
                      title="누르면 라벨 빼기" onClick={() => patchInst(sel.key, (i) => ({ ...i, labels: i.labels.filter((_, m) => m !== n) }))}>
                      {l.group ? `${l.group}: ` : ""}{l.text} ×
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 코드 · 라벨 버튼 */}
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">코드</span>
            <span className="text-xs text-muted-foreground">한 번 = 시작, 다시 = 끝</span>
            <span className="flex-1" />
            <Button variant="outline" size="sm" onClick={endAll} disabled={!openKeys.length} title="켜진 코드 모두 끝 (Tab)"><Square className="h-3 w-3 mr-1" /> 모두 끝{openKeys.length ? ` (${openKeys.length})` : ""}</Button>
          </div>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3" data-testid="code-buttons">
            {codes.map((c) => {
              const bg = rowColor(tl.rows, c)
              const on = !!open[c]
              return (
                <button key={c} onClick={() => pressCode(c)} className="relative min-h-9 px-2 py-1.5 text-xs font-medium leading-tight" style={{ background: bg, color: textOn(bg) }} data-on={on || undefined}>
                  {c}
                  {on && <span className="pointer-events-none absolute inset-0 border-[3px] border-[#201e1d]" />}
                </button>
              )
            })}
          </div>
          <div className="space-y-2 pt-1" data-testid="label-buttons">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">라벨</span>
              <span className="text-xs text-muted-foreground">{sel ? "고른 태그에 붙이기/빼기" : "태그를 먼저 고르세요"}</span>
            </div>
            {groups.map((g) => (
              <div key={g.group} className="flex flex-wrap items-center gap-1">
                <span className="w-14 shrink-0 text-xs text-muted-foreground">{g.group || "기타"}</span>
                {g.texts.slice(0, 40).map((t) => {
                  const on = !!sel?.labels.some((l) => (l.group ?? "") === g.group && l.text === t)
                  return (
                    <button key={t} onClick={() => toggleLabel(g.group, t)} className={cn("border px-2 py-1 text-xs", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-foreground")}>{t}</button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 타임라인 */}
      <div className="border-t border-border px-4 pb-6 pt-2">
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="text-sm font-medium text-foreground">타임라인</span>
          <span>태그 {tl.instances.length}개 · 빈 곳 누르면 그 위치로 · Space 재생 · ←/→ 1초 · Delete 삭제 · Ctrl+Z 되돌리기</span>
          <span className="flex-1" />
          <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setPps((p) => Math.max(0.5, p / 1.5))}>-</Button>
          <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setPps((p) => Math.min(60, p * 1.5))}>+</Button>
        </div>
        <div ref={tlScroll} className="relative max-h-[420px] overflow-auto border border-border bg-card" data-testid="timeline">
          <div style={{ width: NAME_W + duration * pps, height: codes.length * ROW_H + 20 }} className="relative">
            {/* 시간 눈금 */}
            <div className="sticky top-0 z-20 h-5 border-b border-border bg-card" style={{ width: NAME_W + duration * pps }}
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek((e.clientX - r.left - NAME_W) / pps) }}>
              {Array.from({ length: Math.ceil(duration / tickStep(pps)) }, (_, n) => n * tickStep(pps)).map((t) => (
                <span key={t} className="absolute top-0.5 text-[10px] text-muted-foreground" style={{ left: NAME_W + t * pps + 2 }}>{fmtTime(t).replace(/\.\d$/, "")}</span>
              ))}
            </div>
            {codes.map((c, r) => (
              <div key={c} className="absolute left-0 flex" style={{ top: 20 + r * ROW_H, height: ROW_H, width: NAME_W + duration * pps }}>
                <div className="sticky left-0 z-10 flex shrink-0 items-center gap-1 truncate border-b border-r border-border bg-card px-2 text-[11px]" style={{ width: NAME_W }} title={c}>
                  <span className="inline-block h-2 w-2 shrink-0" style={{ background: rowColor(tl.rows, c) }} />{c}
                </div>
                <div className="relative flex-1 border-b border-border/50" onClick={(e) => { const rr = e.currentTarget.getBoundingClientRect(); seek((e.clientX - rr.left) / pps) }}>
                  {tl.instances.filter((i) => i.code === c).map((i) => (
                    <div key={i.key} onClick={(e) => { e.stopPropagation(); setSelected(i.key); seek(i.start) }}
                      className={cn("absolute top-[3px] h-[15px] cursor-pointer", selected === i.key && "outline outline-2 outline-[#201e1d] z-10")}
                      style={{ left: i.start * pps, width: Math.max(3, (shownEnd(i) - i.start) * pps), background: rowColor(tl.rows, c) }}
                      title={`${c} ${fmtTime(i.start)}~${fmtTime(i.end)}\n${i.labels.map((l) => (l.group ? `${l.group}: ` : "") + l.text).join("\n")}`}
                      data-key={i.key} />
                  ))}
                </div>
              </div>
            ))}
            {/* 재생 위치 */}
            <div className="pointer-events-none absolute top-0 z-30 w-px bg-primary" style={{ left: NAME_W + clock * pps, height: codes.length * ROW_H + 20 }} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** 시작이 끝보다 뒤로 가지 않게 */
function fix(i: ScInstance, moved: "start" | "end"): ScInstance {
  if (i.start <= i.end) return i
  return moved === "start" ? { ...i, end: i.start } : { ...i, start: i.end }
}

function tickStep(pps: number): number {
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
  return steps.find((s) => s * pps >= 70) ?? 600
}

export type { ScLabel }
