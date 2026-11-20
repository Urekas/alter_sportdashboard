"use client"

// 통합 영상 분석: 클립 하나 재생. 다른 경기 클립이면 그 경기 유튜브로 알아서 바꿔 끼움
//  - 영상 시간 = 경기 시간(XML) - 카메라 offset (태깅 페이지와 같은 규칙)
//  - 클립 끝(+뒤 여유)에 닿으면 멈추거나, 이어보기면 다음 클립으로
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { doc, getDoc, type Firestore } from "firebase/firestore"
import { ChevronLeft, ChevronRight, Circle, ListVideo, Maximize, Minimize, Pause, PenLine, Play, Repeat, Square } from "lucide-react"
import { canGrabTab, canRecordTab, downloadBlob, grabFrame, nextFrames, startTabRecording, tabSession, type TabRecording } from "@/lib/tab-recorder"
import { InkLayer, InkToolbar, loadInkPrefs, saveInkPrefs, type InkHandle, type InkPrefs } from "./ink-layer"
import { YouTubePlayer, youTubeId, type YouTubeHandle } from "@/components/youtube-player"
import type { VideoMatchMetadata } from "@/lib/video-match-service"
import type { Clip } from "@/lib/video-index"
import { cn } from "@/lib/utils"

export type AngleKey = keyof VideoMatchMetadata["video_urls"]
export const ANGLES: { key: AngleKey; name: string }[] = [
  { key: "tactical_cam1", name: "전술 1" },
  { key: "tactical_cam2", name: "전술 2" },
  { key: "tactical_cam3", name: "전술 3" },
  { key: "broadcast_cam", name: "중계" },
]
const PAD_BEFORE = 2
const PAD_AFTER = 1

const videoCache = new Map<string, Promise<VideoMatchMetadata | null>>()
function loadVideo(db: Firestore, id: string) {
  let p = videoCache.get(id)
  if (!p) {
    p = getDoc(doc(db, "Matches", id)).then((s) => (s.exists() ? (s.data() as VideoMatchMetadata) : null))
    p.catch(() => videoCache.delete(id))
    videoCache.set(id, p)
  }
  return p
}

const mmss = (t: number) => {
  const s = Math.max(0, Math.floor(t))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

export function ClipPlayer({
  db,
  clip,
  title,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  onFromStart,
  recordName = "영상분석",
}: {
  db: Firestore
  clip: Clip | null
  title?: string
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
  /** 목록 처음 클립으로 (목록 전체 녹화) */
  onFromStart?: () => void
  recordName?: string
}) {
  const player = useRef<YouTubeHandle>(null)
  const [video, setVideo] = useState<VideoMatchMetadata | null>(null)
  const [videoFor, setVideoFor] = useState("")
  const [angle, setAngle] = useState<AngleKey>(() => {
    try {
      return (localStorage.getItem("analysis.angle") as AngleKey) || "tactical_cam1"
    } catch {
      return "tactical_cam1"
    }
  })
  const [playing, setPlaying] = useState(false)
  const [auto, setAuto] = useState(true)
  const [readyVid, setReadyVid] = useState<string | null>(null) // 준비가 끝난 유튜브 영상 (영상이 바뀌면 그 영상이 준비될 때까지 기다림)
  const [now, setNow] = useState(0)
  // 그리기: 켜면 영상을 멈추고 그 위에 그림. 다른 클립으로 넘어가면 지움
  const ink = useRef<InkHandle>(null)
  const [drawing, setDrawing] = useState(false)
  const [inkPrefs, setInkPrefs] = useState<InkPrefs>({ tool: "arrow", size: 1, color: "#ff3b30" })
  useEffect(() => setInkPrefs(loadInkPrefs()), [])
  useEffect(() => ink.current?.clear(), [clip?.key])
  // 전체화면: 영상만이 아니라 아래 조작 줄·그리기 도구까지 같이 (F 키)
  const root = useRef<HTMLDivElement>(null)
  const [fs, setFs] = useState(false)
  useEffect(() => {
    const on = () => setFs(document.fullscreenElement === root.current && !!root.current)
    document.addEventListener("fullscreenchange", on)
    return () => document.removeEventListener("fullscreenchange", on)
  }, [])
  const toggleFs = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void root.current?.requestFullscreen?.().catch(() => {})
  }, [])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.ctrlKey || e.metaKey || e.altKey || (t && (t.isContentEditable || /^(TEXTAREA|SELECT)$/.test(t.tagName) || (t.tagName === "INPUT" && !/^(range|checkbox)$/.test((t as HTMLInputElement).type))))) return
      if (e.key === "f" || e.key === "F" || e.key === "ㄹ") {
        e.preventDefault()
        toggleFs()
      }
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [toggleFs])

  // 정지 화면: 유튜브는 멈추면 제목·가운데 재생 버튼·로고를 영상 위에 띄움(끌 방법 없음, iframe 픽셀도 못 읽음)
  //  → 탭 화면 공유로 "재생 중인 깨끗한 화면"을 찍어 캔버스로 덮고 멈춤. 그 위에 그림
  //  (휴대폰은 화면 공유가 없지만 휴대폰 유튜브는 멈춤 표시가 거의 없어서 그냥 멈춤)
  const stillRef = useRef<HTMLCanvasElement>(null)
  const [still, setStill] = useState(false)
  const [grabbing, setGrabbing] = useState(false)
  const grabbingRef = useRef(false)
  const [stillNote, setStillNote] = useState("")
  const freeze = useCallback(async () => {
    const p = player.current
    if (!p || !box.current || !stillRef.current) return
    const coarse = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches
    if (!canGrabTab() || coarse) return p.pause()
    try {
      await tabSession()
      setStillNote("")
    } catch {
      setStillNote("화면 공유를 허용하면 멈춘 화면에 유튜브 표시가 안 보여요")
      return p.pause()
    }
    grabbingRef.current = true
    setGrabbing(true) // 찍는 동안 그림·정지 화면은 잠깐 숨김 (같이 찍히지 않게)
    try {
      if (!p.playing()) {
        // 멈춘 상태엔 유튜브 표시가 떠 있음 → 조금 앞에서 다시 재생해 표시가 사라진 뒤 지금 장면을 찍음
        const t0 = p.time()
        p.seek(Math.max(0, t0 - 0.9))
        p.play()
        for (let i = 0; i < 120 && !p.playing(); i++) await new Promise((r) => setTimeout(r, 50)) // 불러오는 중이면 최대 6초
        if (!p.playing()) return p.pause()
        await new Promise((r) => setTimeout(r, 850))
      }
      await nextFrames(3)
      const ok = grabFrame(box.current, stillRef.current)
      p.pause()
      // 유튜브가 pause를 늦게 받는 경우가 있어 확실히 멈출 때까지 (그동안 재생 감지로 정지 화면이 치워지지 않게)
      for (let i = 0; i < 20 && p.playing(); i++) {
        await new Promise((r) => setTimeout(r, 100))
        p.pause()
      }
      await new Promise((r) => setTimeout(r, 150))
      setStill(ok)
    } finally {
      grabbingRef.current = false
      setGrabbing(false)
    }
  }, [])
  const toggleDraw = () => {
    if (!drawing) void freeze()
    else setStill(false)
    setDrawing((d) => !d)
  }
  useEffect(() => setStill(false), [clip?.key])
  // 다시 재생하면 정지 화면 치움 (찍느라 잠깐 재생하는 건 빼고)
  useEffect(() => {
    if (playing && !grabbingRef.current) setStill(false)
  }, [playing])

  // 녹화: 이 탭의 영상 상자만 (그림 포함). all = 목록 끝까지 녹화하고 자동으로 멈춤
  const box = useRef<HTMLDivElement>(null)
  const recRef = useRef<TabRecording | null>(null)
  const [rec, setRec] = useState<"" | "manual" | "all">("")
  const [recErr, setRecErr] = useState("")
  const [recCan, setRecCan] = useState(false)
  useEffect(() => setRecCan(canRecordTab()), [])
  const stopRec = useCallback(async () => {
    const r = recRef.current
    recRef.current = null
    setRec("")
    const out = await r?.stop()
    if (out) {
      const d = new Date()
      const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`
      downloadBlob(out.blob, `${recordName.replace(/[\/:*?"<>|]+/g, "_")}_${stamp}.${out.ext}`)
    }
  }, [recordName])
  const startRec = async (mode: "manual" | "all") => {
    setRecErr("")
    if (!box.current) return
    try {
      const r = await startTabRecording(box.current)
      recRef.current = r
      r.onEnded(() => void stopRec())
      setRec(mode)
      if (mode === "all") {
        setAuto(true)
        setDrawing(false)
        setStill(false)
        playedKey.current = ""
        onFromStart?.()
        setKick((k) => k + 1) // 이미 첫 클립이어도 처음부터 다시
      }
    } catch (e) {
      setRecErr((e as Error)?.name === "NotAllowedError" ? "화면 공유를 허용해야 녹화돼요" : "이 브라우저에서는 녹화가 안 돼요 (크롬·엣지 권장)")
    }
  }
  useEffect(() => () => void recRef.current?.stop(), [])

  // 클립의 경기 영상 정보
  useEffect(() => {
    if (!clip) return
    if (clip.videoMatchId === videoFor) return
    let gone = false
    loadVideo(db, clip.videoMatchId).then((v) => {
      if (gone) return
      setVideo(v)
      setVideoFor(clip.videoMatchId)
    })
    return () => {
      gone = true
    }
  }, [db, clip, videoFor])

  const available = useMemo(() => ANGLES.filter((a) => youTubeId(video?.video_urls?.[a.key] ?? "")), [video])
  const useAngle = available.some((a) => a.key === angle) ? angle : available[0]?.key
  const vid = useAngle ? youTubeId(video?.video_urls?.[useAngle] ?? "") : null
  const offset = useAngle ? Number(video?.video_offsets?.[useAngle]) || 0 : 0

  const ready = !!vid && readyVid === vid
  const stopAt = useRef<number | null>(null)
  const start = useCallback(() => {
    if (!clip || !player.current) return
    stopAt.current = clip.end + PAD_AFTER
    player.current.seek(clip.start - PAD_BEFORE - offset)
    player.current.play()
  }, [clip, offset])

  // 클립이 바뀌거나(같은 영상) 영상이 준비되면 그 클립 처음부터
  const playedKey = useRef("")
  const [kick, setKick] = useState(0)
  useEffect(() => {
    if (!clip || !ready || videoFor !== clip.videoMatchId) return
    const k = `${clip.key}|${vid}`
    if (playedKey.current === k) return
    playedKey.current = k
    start()
  }, [clip, ready, vid, videoFor, start, kick])

  // 클립 끝 감시
  const next = useRef(onNext)
  next.current = onNext
  useEffect(() => {
    const t = setInterval(() => {
      const p = player.current
      if (!p || !ready) return
      const gameT = p.time() + offset
      setNow(gameT)
      if (stopAt.current !== null && gameT >= stopAt.current && p.playing()) {
        stopAt.current = null
        if (auto && hasNext) next.current()
        else {
          p.pause()
          if (recAll.current) void stopRec() // 목록 전체 녹화: 마지막 클립이 끝나면 저장
        }
      }
    }, 250)
    return () => clearInterval(t)
  }, [ready, offset, auto, hasNext, stopRec])
  const recAll = useRef(false)
  recAll.current = rec === "all"

  const playPause = () => {
    if (!clip || !player.current) return
    if (playing) player.current.pause()
    else if (stopAt.current === null) start()
    else player.current.play()
  }
  // 클립 안에서 앞뒤로 (유튜브 조작 막대 대신)
  const from = clip ? clip.start - PAD_BEFORE : 0
  const to = clip ? clip.end + PAD_AFTER : 0
  const seekTo = (gameT: number) => {
    if (!clip || !player.current) return
    stopAt.current = clip.end + PAD_AFTER
    player.current.seek(gameT - offset)
    setNow(gameT)
    if (drawing) {
      setStill(false)
      clearTimeout(refreeze.current)
      refreeze.current = setTimeout(() => void freeze(), 400)
    }
  }
  const refreeze = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [rate, setRate] = useState(1)
  const cycleRate = () => {
    const r = rate === 1 ? 0.5 : rate === 0.5 ? 0.25 : 1
    setRate(r)
    player.current?.setRate(r)
  }
  useEffect(() => {
    if (ready && rate !== 1) player.current?.setRate(rate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, vid])

  const pickAngle = (k: AngleKey) => {
    setAngle(k)
    playedKey.current = ""
    try {
      localStorage.setItem("analysis.angle", k)
    } catch {}
  }

  const noVideo = clip && videoFor === clip.videoMatchId && !vid
  return (
    <div ref={root} className={cn("bg-background", fs && "h-full flex flex-col justify-center bg-black text-foreground [&>*:not(:first-child)]:bg-background")}>
      <div className="relative w-full mx-auto" ref={box} style={fs ? { maxWidth: `calc((100vh - ${drawing ? 190 : 110}px) * 16 / 9)` } : undefined}>
        {vid ? (
          <YouTubePlayer ref={player} videoId={vid} onReady={() => setReadyVid(vid)} onState={setPlaying} bare />
        ) : (
          <div className="w-full aspect-video bg-[#201e1d] flex items-center justify-center text-sm text-[#bab6b6] px-6 text-center">
            {!clip ? "아래에서 클립을 고르면 여기서 재생돼요" : noVideo ? "이 경기는 유튜브 영상이 연결돼 있지 않아요" : "영상 불러오는 중…"}
          </div>
        )}
        <canvas ref={stillRef} className={cn("absolute inset-0 w-full h-full pointer-events-none", (!still || grabbing || !vid) && "invisible")} data-testid="still" />
        <div className={cn(grabbing && "invisible")}>{vid && <InkLayer ref={ink} on={drawing} prefs={inkPrefs} />}</div>
        {/* 유튜브 화면은 직접 못 누르게 덮고, 누르면 재생/정지 */}
        {vid && !drawing && <div className="absolute inset-0 cursor-pointer" onClick={playPause} data-testid="video-surface" />}
        {rec && !grabbing && <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 pointer-events-none">● 녹화 중</span>}
      </div>
      {clip && vid && (
        <div className="flex items-center gap-2 px-2 pt-1.5 text-xs text-muted-foreground tabular-nums">
          <span>{mmss(now)}</span>
          <input
            type="range"
            min={from}
            max={to}
            step={0.1}
            value={Math.min(to, Math.max(from, now))}
            onChange={(e) => seekTo(Number(e.target.value))}
            className="flex-1 accent-[#ec3013] h-1"
            aria-label="클립 안에서 이동"
            data-testid="scrub"
          />
          <span>{mmss(to)}</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-2 py-1.5 text-sm">
        <button className="h-8 w-8 inline-flex items-center justify-center border border-border disabled:opacity-40" onClick={onPrev} disabled={!hasPrev} aria-label="이전 클립">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button className="h-8 w-8 inline-flex items-center justify-center border border-border disabled:opacity-40" onClick={playPause} disabled={!clip || !vid} aria-label="재생/정지">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button className="h-8 w-8 inline-flex items-center justify-center border border-border disabled:opacity-40" onClick={onNext} disabled={!hasNext} aria-label="다음 클립">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          className={cn("h-8 px-2 inline-flex items-center gap-1 border text-xs", auto ? "border-primary text-primary" : "border-border text-muted-foreground")}
          onClick={() => setAuto((a) => !a)}
          title="클립이 끝나면 다음 클립으로"
        >
          <Repeat className="h-3.5 w-3.5" /> 이어보기
        </button>
        <button className={cn("h-8 px-2 border text-xs tabular-nums", rate !== 1 ? "border-primary text-primary" : "border-border text-muted-foreground")} onClick={cycleRate} disabled={!vid} title="느리게 보기" data-testid="rate">
          {rate}x
        </button>
        <button
          className={cn("h-8 px-2 inline-flex items-center gap-1 border text-xs", drawing ? "bg-primary text-primary-foreground border-primary" : "border-border")}
          onClick={toggleDraw}
          disabled={!vid}
          title="영상 위에 그리기 (켜면 영상이 멈춤)"
          data-testid="draw-toggle"
        >
          <PenLine className="h-3.5 w-3.5" /> 그리기
        </button>
        {recCan &&
          (rec ? (
            <button className="h-8 px-2 inline-flex items-center gap-1 border text-xs bg-primary text-primary-foreground border-primary" onClick={() => void stopRec()} data-testid="rec-stop">
              <Square className="h-3.5 w-3.5" /> 녹화 끝내고 저장
            </button>
          ) : (
            <>
              <button className="h-8 px-2 inline-flex items-center gap-1 border border-border text-xs disabled:opacity-40" onClick={() => void startRec("manual")} disabled={!vid} title="지금부터 녹화 (그림 포함) — 끝내기를 누르면 파일로 저장" data-testid="rec-start">
                <Circle className="h-3.5 w-3.5 text-primary" /> 녹화
              </button>
              {onFromStart && (
                <button className="h-8 px-2 inline-flex items-center gap-1 border border-border text-xs disabled:opacity-40" onClick={() => void startRec("all")} disabled={!hasNext && !hasPrev && !clip} title="목록 처음부터 끝까지 이어서 재생하며 녹화 → 파일 하나" data-testid="rec-all">
                  <ListVideo className="h-3.5 w-3.5" /> 목록 전체 녹화
                </button>
              )}
            </>
          ))}
        <span className="flex-1" />
        <button className="h-8 w-8 inline-flex items-center justify-center border border-border order-last" onClick={toggleFs} title="전체화면 (F)" aria-label="전체화면" data-testid="fullscreen">
          {fs ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </button>
        {available.length > 1 &&
          available.map((a) => (
            <button key={a.key} onClick={() => pickAngle(a.key)} className={cn("h-7 px-2 text-xs border", a.key === useAngle ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground")}>
              {a.name}
            </button>
          ))}
      </div>
      {drawing && (
        <InkToolbar
          prefs={inkPrefs}
          onPrefs={(p) => {
            setInkPrefs(p)
            saveInkPrefs(p)
          }}
          onUndo={() => ink.current?.undo()}
          onClear={() => ink.current?.clear()}
        />
      )}
      {recErr && <div className="px-2 py-1 text-xs text-primary border-b border-border">{recErr}</div>}
      {stillNote && drawing && <div className="px-2 py-1 text-xs text-muted-foreground border-b border-border">{stillNote}</div>}
      {rec && <div className="px-2 py-1 text-xs text-muted-foreground border-b border-border">녹화 중엔 이 탭을 그대로 두세요. 다른 탭으로 가면 그 화면이 녹화돼요.</div>}
      {clip && title && <div className="px-2 py-1 text-xs text-muted-foreground truncate border-b border-border" data-testid="now-playing">{title}</div>}
    </div>
  )
}
