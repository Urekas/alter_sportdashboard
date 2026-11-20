"use client"

// 통합 영상 분석: 클립 하나 재생. 다른 경기 클립이면 그 경기 유튜브로 알아서 바꿔 끼움
//  - 영상 시간 = 경기 시간(XML) - 카메라 offset (태깅 페이지와 같은 규칙)
//  - 클립 끝(+뒤 여유)에 닿으면 멈추거나, 이어보기면 다음 클립으로
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { doc, getDoc, type Firestore } from "firebase/firestore"
import { ChevronLeft, ChevronRight, Circle, ListVideo, Pause, PenLine, Play, Repeat, Square } from "lucide-react"
import { canRecordTab, downloadBlob, startTabRecording, type TabRecording } from "@/lib/tab-recorder"
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
  const toggleDraw = () => {
    if (!drawing) player.current?.pause()
    setDrawing((d) => !d)
  }

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

  const pickAngle = (k: AngleKey) => {
    setAngle(k)
    playedKey.current = ""
    try {
      localStorage.setItem("analysis.angle", k)
    } catch {}
  }

  const noVideo = clip && videoFor === clip.videoMatchId && !vid
  return (
    <div className="bg-background">
      <div className="relative" ref={box}>
        {vid ? (
          <YouTubePlayer ref={player} videoId={vid} onReady={() => setReadyVid(vid)} onState={setPlaying} />
        ) : (
          <div className="w-full aspect-video bg-[#201e1d] flex items-center justify-center text-sm text-[#bab6b6] px-6 text-center">
            {!clip ? "아래에서 클립을 고르면 여기서 재생돼요" : noVideo ? "이 경기는 유튜브 영상이 연결돼 있지 않아요" : "영상 불러오는 중…"}
          </div>
        )}
        {vid && <InkLayer ref={ink} on={drawing} prefs={inkPrefs} />}
        {/* 녹화 중엔 마우스가 영상 위에 와도 유튜브 조작 막대가 안 뜨게 덮음 */}
        {rec && !drawing && <div className="absolute inset-0" />}
        {rec && <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 pointer-events-none">● 녹화 중</span>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-2 py-1.5 text-sm">
        <button className="h-8 w-8 inline-flex items-center justify-center border border-border disabled:opacity-40" onClick={onPrev} disabled={!hasPrev} aria-label="이전 클립">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button className="h-8 w-8 inline-flex items-center justify-center border border-border disabled:opacity-40" onClick={() => (playing ? player.current?.pause() : clip && (stopAt.current === null ? start() : player.current?.play()))} disabled={!clip || !vid} aria-label="재생/정지">
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
        {clip && <span className="text-xs text-muted-foreground tabular-nums">{mmss(now)}</span>}
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
      {rec && <div className="px-2 py-1 text-xs text-muted-foreground border-b border-border">녹화 중엔 이 탭을 그대로 두세요. 다른 탭으로 가면 그 화면이 녹화돼요.</div>}
      {clip && title && <div className="px-2 py-1 text-xs text-muted-foreground truncate border-b border-border" data-testid="now-playing">{title}</div>}
    </div>
  )
}
