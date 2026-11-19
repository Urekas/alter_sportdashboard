"use client"

// 웹 태깅: 유튜브가 연결되고 원본 XML이 저장된 경기의 태그를 영상 보면서 고치고 더함
//  - 버튼 동작은 Alter Live 태깅 엔진 그대로 (src/lib/alter/engine.ts): 토글/한 번 누름(lead·lag), 링크(활성·배타·비활성), 라벨
//  - 코드윈도우: 올린 것(.CWcode2SC / Alter Live JSON)을 고르면 같은 배치·단축키, 안 고르면 XML에 있는 코드·라벨로 간단 버튼
//  - 라벨: 켜진 태그에 붙음, 켜진 게 없으면 고른(또는 방금 만든) 태그에
//  - 저장: 고친 XML로 대시보드 분석을 다시 계산해서 덮어씀, 직전 XML은 따로 보관 (되돌리기)
//  - ?dry=1 이면 저장하지 않고 계산 결과만 보여줌 (테스트용, 코드윈도우도 저장 안 함)
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Save, Undo2, Redo2, Trash2, Play, Pause, History, Square, Upload } from "lucide-react"
import { useFirestore } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { TournamentService } from "@/lib/tournament-service"
import { VideoMatchService, type VideoMatchMetadata } from "@/lib/video-match-service"
import type { MatchData } from "@/lib/types"
import { YouTubePlayer, youTubeId, type YouTubeHandle } from "@/components/youtube-player"
import { CodeWindowPanel } from "@/components/code-window-panel"
import { autoLabelsAt, codeList, fmtTime, isAutoLabel, parseScXml, rowColor, serializeScXml, textOn, type ScInstance, type ScTimeline } from "@/lib/sc-xml"
import { deactivateAll, press, type EngineState } from "@/lib/alter/engine"
import type { CodeWindow } from "@/lib/alter/types"
import { emptyExtras, fromEngine, hotkeyMatches, syntheticCW, teamNamedCW, toEngine, type EngineExtras } from "@/lib/tag-engine"
import { getCodeWindow, listCodeWindows, readCodeWindowFile, saveCodeWindow, setMatchCodeWindow } from "@/lib/codewindow-service"
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
type Snap = { tl: ScTimeline; eng: EngineExtras }

export default function TagPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params)
  const db = useFirestore()
  const { toast } = useToast()
  const [match, setMatch] = useState<MatchData | null>(null)
  const [video, setVideo] = useState<VideoMatchMetadata | null>(null)
  const [tournamentName, setTournamentName] = useState<string>("")
  const [loadError, setLoadError] = useState("")
  const [tl, setTl] = useState<ScTimeline>({ instances: [], rows: [] })
  const [eng, setEng] = useState<EngineExtras>(emptyExtras)
  const [past, setPast] = useState<Snap[]>([])
  const [future, setFuture] = useState<Snap[]>([])
  const [savedXml, setSavedXml] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [angle, setAngle] = useState<string>("")
  const [clock, setClock] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const [pps, setPps] = useState(4) // 타임라인 1초당 픽셀
  const [saving, setSaving] = useState(false)
  const [dry, setDry] = useState(false)
  // 코드윈도우: null = XML 코드로 만든 간단 버튼
  const [cwList, setCwList] = useState<{ id: string; name: string }[]>([])
  const [cwId, setCwId] = useState<string>("")
  const [realCw, setRealCw] = useState<CodeWindow | null>(null)
  const [cwBusy, setCwBusy] = useState(false)
  const player = useRef<YouTubeHandle>(null)
  const tlScroll = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

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
      listCodeWindows(db).then((l) => !gone && setCwList(l)).catch(() => {})
      const savedCw = (m as MatchData & { codeWindowId?: string }).codeWindowId
      if (savedCw) {
        const c = await getCodeWindow(db, savedCw).catch(() => null)
        if (!gone && c) {
          setCwId(c.id)
          setRealCw(c.cw)
        }
      }
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

  // ---- 상태 바꾸기 (모든 변경은 여기를 거쳐서 되돌리기 기록) ----
  const tlRef = useRef(tl)
  tlRef.current = tl
  const engRef = useRef(eng)
  engRef.current = eng
  const commit = useCallback((nextTl: ScTimeline, nextEng: EngineExtras = engRef.current) => {
    setPast((p) => [...p.slice(-199), { tl: tlRef.current, eng: engRef.current }])
    setFuture([])
    tlRef.current = nextTl
    engRef.current = nextEng
    setTl(nextTl)
    setEng(nextEng)
  }, [])
  const patchInst = (key: string, fn: (i: ScInstance) => ScInstance) => commit({ ...tl, instances: tl.instances.map((i) => (i.key === key ? fn(i) : i)) })

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p
      const last = p[p.length - 1]
      setFuture((f) => [{ tl: tlRef.current, eng: engRef.current }, ...f])
      setTl(last.tl)
      setEng(last.eng)
      return p.slice(0, -1)
    })
  }, [])
  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f
      setPast((p) => [...p, { tl: tlRef.current, eng: engRef.current }])
      setTl(f[0].tl)
      setEng(f[0].eng)
      return f.slice(1)
    })
  }, [])

  const synthetic = useMemo(() => syntheticCW(tl), [tl])
  // 올린 코드윈도우가 HOME/AWAY 이름이면 이 경기 팀 이름으로 (대시보드 통계가 팀 이름 코드로 계산됨)
  const namedCw = useMemo(() => (realCw && match ? teamNamedCW(realCw, tl, match.homeTeam.name, match.awayTeam.name) : null), [realCw, match, tl])
  const cw = namedCw ?? synthetic
  const sel = tl.instances.find((i) => i.key === selected) ?? null
  const dirty = useMemo(() => serializeScXml(tl) !== savedXml, [tl, savedXml])
  const activeIds = useMemo(() => new Set(eng.active.map((a) => a.buttonId)), [eng])
  // 타임라인 행: XML 코드 + 지금 켜진 코드
  const rowsShown = useMemo(() => [...new Set([...codeList(tl), ...eng.active.map((a) => a.rowName)])], [tl, eng])
  const btnColor = (code: string) => {
    const r = tl.rows.find((x) => x.code === code)
    return r ? rowColor(tl.rows, code) : cw.buttons.find((b) => b.kind === "code" && b.name === code)?.color ?? rowColor(tl.rows, code)
  }
  const duration = useMemo(() => Math.max(player.current?.duration?.() ? player.current.duration() + offset : 0, ...tl.instances.map((i) => i.end), 60) + 30, [tl, offset, clock > 0])

  // ---- 엔진으로 버튼 누르기 ----
  const engineState = (t: number, base: ScTimeline = tlRef.current, e: EngineExtras = engRef.current): EngineState => {
    const selInst = base.instances.find((i) => i.key === selected)
    return {
      timeline: toEngine(base),
      ...e,
      // 켜진 태그가 없을 때 라벨은 고른 태그에 붙게
      lastInstance: selInst ? { rowName: selInst.code, uniqueId: selInst.key } : e.lastInstance,
      autoLabels: autoLabelsAt(base, t).map((l) => ({ group: l.group ?? "", name: l.text })),
    }
  }
  const apply = (next: EngineState, before: EngineState) => {
    commit(fromEngine(next.timeline, tlRef.current), { active: next.active, lastInstance: next.lastInstance, open: next.open ?? [] })
    if (next.lastInstance && next.lastInstance.uniqueId !== before.lastInstance?.uniqueId) setSelected(next.lastInstance.uniqueId)
  }
  const pressButton = (id: string) => {
    const t = now()
    const before = engineState(t)
    apply(press(before, cw, id, t), before)
  }
  const endAll = useCallback(() => {
    if (!engRef.current.active.length) return
    const t = now()
    const before = engineState(t)
    apply(deactivateAll(before, cw, t), before)
  }, [cw, now, selected])

  const removeSelected = useCallback(() => {
    if (!selected) return
    commit({ ...tlRef.current, instances: tlRef.current.instances.filter((i) => i.key !== selected) }, { ...engRef.current, lastInstance: null, open: (engRef.current.open ?? []).filter((o) => o.uniqueId !== selected) })
    setSelected(null)
  }, [selected, commit])

  // ---- 코드윈도우 고르기/올리기 ----
  const chooseCw = async (id: string) => {
    if (engRef.current.active.length) endAll()
    setCwId(id)
    if (!id) {
      setRealCw(null)
    } else {
      setCwBusy(true)
      const c = await getCodeWindow(db, id).catch(() => null)
      setCwBusy(false)
      if (!c) return toast({ title: "코드윈도우를 불러오지 못했어요", variant: "destructive" })
      setRealCw(c.cw)
    }
    if (!dry) setMatchCodeWindow(db, matchId, id || null).catch(() => {})
  }
  const uploadCw = async (file: File) => {
    setCwBusy(true)
    try {
      const c = await readCodeWindowFile(file)
      if (engRef.current.active.length) endAll()
      if (dry) {
        setCwId("__local")
        setCwList((l) => [{ id: "__local", name: `${c.name} (저장 안 함)` }, ...l.filter((x) => x.id !== "__local")])
        setRealCw(c)
      } else {
        const id = await saveCodeWindow(db, c)
        setCwList((l) => [{ id, name: c.name }, ...l])
        setCwId(id)
        setRealCw(c)
        setMatchCodeWindow(db, matchId, id).catch(() => {})
      }
      toast({ title: `코드윈도우 "${c.name}" — 버튼 ${c.buttons.length}개, 링크 ${c.links.length}개` })
    } catch (e: any) {
      toast({ title: "코드윈도우를 읽지 못했어요", description: String(e?.message ?? e), variant: "destructive" })
    } finally {
      setCwBusy(false)
    }
  }

  // ---- 키보드 ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      if (e.repeat) return
      // 코드윈도우 단축키가 먼저
      if (realCw) {
        const b = realCw.buttons.find((x) => (x.kind === "code" || x.kind === "label") && hotkeyMatches(x.hotkey, e))
        if (b) {
          e.preventDefault()
          return pressButton(b.id)
        }
      }
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
      if (dirty || eng.active.length) e.preventDefault()
    }
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [dirty, eng])

  async function doSave() {
    if (!match || saving) return
    // 켜진 태그는 지금 시간에 끝내고 저장
    let finalTl = tlRef.current
    if (engRef.current.active.length) {
      const t = now()
      const before = engineState(t)
      const next = deactivateAll(before, cw, t)
      finalTl = fromEngine(next.timeline, tlRef.current)
      apply(next, before)
    }
    setSaving(true)
    try {
      const xml = serializeScXml(finalTl)
      const r = await saveTagging(db, match, xml, { dry, tournamentName })
      if (r.dry) {
        const g = r.data.matchStats
        toast({ title: `저장 안 함 (테스트) — 이벤트 ${r.events}개로 다시 계산됨`, description: `${r.data.homeTeam.name} ${g.home.goals.field + g.home.goals.pc} : ${g.away.goals.field + g.away.goals.pc} ${r.data.awayTeam.name}` })
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
    commit(parseScXml(xml), emptyExtras())
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
  const labelBtns = synthetic.buttons.filter((b) => b.kind === "label")
  const labelGroupsShown = [...new Set(labelBtns.map((b) => b.group))]

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
        <Button size="sm" onClick={doSave} disabled={saving || (!dirty && !dry && !eng.active.length)} title="저장 (Ctrl+S)">
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} 저장
        </Button>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
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
                  <span className="inline-block h-3 w-3" style={{ background: btnColor(sel.code) }} />
                  <select className="h-8 border border-input bg-background px-2 font-medium" value={sel.code} onChange={(e) => patchInst(sel.key, (i) => ({ ...i, code: e.target.value }))} data-testid="sel-code">
                    {[...new Set([...codeList(tl), ...cw.buttons.filter((b) => b.kind === "code").map((b) => b.name)])].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span className="flex-1" />
                  <Button variant="outline" size="sm" onClick={() => seek(sel.start)}><Play className="h-3 w-3 mr-1" /> 이 장면</Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={removeSelected} title="삭제 (Delete)"><Trash2 className="h-3 w-3 mr-1" /> 삭제</Button>
                </div>
                {(["start", "end"] as const).map((k) => (
                  <div key={k} className="flex flex-wrap items-center gap-1">
                    <span className="w-8 text-muted-foreground">{k === "start" ? "시작" : "끝"}</span>
                    <span className="w-20 font-mono tabular-nums" data-testid={`sel-${k}`}>{fmtTime(sel[k])}</span>
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

        {/* 코드윈도우 */}
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">코드윈도우</span>
            <select className="h-8 min-w-0 max-w-[220px] border border-input bg-background px-2 text-sm" value={cwId} onChange={(e) => chooseCw(e.target.value)} data-testid="cw-select" disabled={cwBusy}>
              <option value="">XML 코드로 (간단 버튼)</option>
              {cwList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={cwBusy} title="Sportscode .CWcode2SC 또는 Alter Live 코드윈도우 JSON">
              {cwBusy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />} 올리기
            </Button>
            <input ref={fileInput} type="file" accept=".CWcode2SC,.cwcode2sc,.json" className="hidden" data-testid="cw-file"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadCw(f) }} />
            <span className="flex-1" />
            <Button variant="outline" size="sm" onClick={endAll} disabled={!eng.active.length} title="켜진 코드 모두 끝 (Tab)"><Square className="h-3 w-3 mr-1" /> 모두 끝{eng.active.length ? ` (${eng.active.length})` : ""}</Button>
          </div>

          {realCw ? (
            <>
              <CodeWindowPanel cw={namedCw ?? realCw} activeIds={activeIds} onPress={pressButton} />
              <p className="text-xs text-muted-foreground">단축키·링크·리드/래그는 코드윈도우 설정 그대로 · 라벨은 켜진 태그에, 없으면 고른 태그에 붙어요</p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3" data-testid="code-buttons">
                {synthetic.buttons.filter((b) => b.kind === "code").map((b) => {
                  const bg = btnColor(b.name)
                  const on = activeIds.has(b.id)
                  return (
                    <button key={b.id} onClick={() => pressButton(b.id)} className="relative min-h-9 px-2 py-1.5 text-xs font-medium leading-tight" style={{ background: bg, color: textOn(bg) }} data-on={on || undefined}>
                      {b.name}
                      {on && <span className="pointer-events-none absolute inset-0 border-[3px] border-[#201e1d]" />}
                    </button>
                  )
                })}
              </div>
              <div className="space-y-2 pt-1" data-testid="label-buttons">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">라벨</span>
                  <span className="text-xs text-muted-foreground">켜진 태그에, 없으면 고른 태그에 붙어요 (빼기는 위 태그 칸에서 ×)</span>
                </div>
                {labelGroupsShown.map((g) => (
                  <div key={g} className="flex flex-wrap items-center gap-1">
                    <span className="w-14 shrink-0 text-xs text-muted-foreground">{g || "기타"}</span>
                    {labelBtns.filter((b) => b.group === g).slice(0, 40).map((b) => {
                      const on = !!sel?.labels.some((l) => (l.group ?? "") === g && l.text === b.name)
                      return (
                        <button key={b.id} onClick={() => pressButton(b.id)} className={cn("border px-2 py-1 text-xs", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-foreground")}>{b.name}</button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 타임라인 */}
      <div className="border-t border-border px-4 pb-6 pt-2">
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="text-sm font-medium text-foreground">타임라인</span>
          <span>태그 {tl.instances.length}개 · 빈 곳 누르면 그 위치로 · Space 재생 · ←/→ 1초 · Tab 모두 끝 · Delete 삭제 · Ctrl+Z 되돌리기</span>
          <span className="flex-1" />
          <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setPps((p) => Math.max(0.5, p / 1.5))}>-</Button>
          <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setPps((p) => Math.min(60, p * 1.5))}>+</Button>
        </div>
        <div ref={tlScroll} className="relative max-h-[420px] overflow-auto border border-border bg-card" data-testid="timeline">
          <div style={{ width: NAME_W + duration * pps, height: rowsShown.length * ROW_H + 20 }} className="relative">
            {/* 시간 눈금 */}
            <div className="sticky top-0 z-20 h-5 border-b border-border bg-card" style={{ width: NAME_W + duration * pps }}
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek((e.clientX - r.left - NAME_W) / pps) }}>
              {Array.from({ length: Math.ceil(duration / tickStep(pps)) }, (_, n) => n * tickStep(pps)).map((t) => (
                <span key={t} className="absolute top-0.5 text-[10px] text-muted-foreground" style={{ left: NAME_W + t * pps + 2 }}>{fmtTime(t).replace(/\.\d$/, "")}</span>
              ))}
            </div>
            {rowsShown.map((c, r) => (
              <div key={c} className="absolute left-0 flex" style={{ top: 20 + r * ROW_H, height: ROW_H, width: NAME_W + duration * pps }}>
                <div className="sticky left-0 z-10 flex shrink-0 items-center gap-1 truncate border-b border-r border-border bg-card px-2 text-[11px]" style={{ width: NAME_W }} title={c}>
                  <span className="inline-block h-2 w-2 shrink-0" style={{ background: btnColor(c) }} />{c}
                </div>
                <div className="relative flex-1 border-b border-border/50" onClick={(e) => { const rr = e.currentTarget.getBoundingClientRect(); seek((e.clientX - rr.left) / pps) }}>
                  {tl.instances.filter((i) => i.code === c).map((i) => (
                    <div key={i.key} onClick={(e) => { e.stopPropagation(); setSelected(i.key); seek(i.start) }}
                      className={cn("absolute top-[3px] h-[15px] cursor-pointer", selected === i.key && "outline outline-2 outline-[#201e1d] z-10")}
                      style={{ left: i.start * pps, width: Math.max(3, (i.end - i.start) * pps), background: btnColor(c) }}
                      title={`${c} ${fmtTime(i.start)}~${fmtTime(i.end)}\n${i.labels.map((l) => (l.group ? `${l.group}: ` : "") + l.text).join("\n")}`}
                      data-key={i.key} />
                  ))}
                  {/* 켜져 있는 코드: 지금까지 늘어나는 막대 */}
                  {eng.active.filter((a) => a.rowName === c).map((a) => (
                    <div key={a.buttonId + a.startTime} className="absolute top-[3px] h-[15px] border-2 border-dashed border-[#201e1d]" data-active="1"
                      style={{ left: a.startTime * pps, width: Math.max(3, (clock - a.startTime) * pps), background: btnColor(c), opacity: 0.7 }} />
                  ))}
                </div>
              </div>
            ))}
            {/* 재생 위치 */}
            <div className="pointer-events-none absolute top-0 z-30 w-px bg-primary" style={{ left: NAME_W + clock * pps, height: rowsShown.length * ROW_H + 20 }} />
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
