"use client"

// 통합 영상 분석: 클립 하나 재생. 다른 경기 클립이면 그 경기 유튜브로 알아서 바꿔 끼움
//  - 영상 시간 = 경기 시간(XML) - 카메라 offset (태깅 페이지와 같은 규칙)
//  - 클립 끝(+뒤 여유)에 닿으면 멈추거나, 이어보기면 다음 클립으로
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { doc, getDoc, type Firestore } from "firebase/firestore"
import { ChevronLeft, ChevronRight, Pause, Play, Repeat } from "lucide-react"
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
}: {
  db: Firestore
  clip: Clip | null
  title?: string
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
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
  useEffect(() => {
    if (!clip || !ready || videoFor !== clip.videoMatchId) return
    const k = `${clip.key}|${vid}`
    if (playedKey.current === k) return
    playedKey.current = k
    start()
  }, [clip, ready, vid, videoFor, start])

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
        else p.pause()
      }
    }, 250)
    return () => clearInterval(t)
  }, [ready, offset, auto, hasNext])

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
      <div className="relative">
        {vid ? (
          <YouTubePlayer ref={player} videoId={vid} onReady={() => setReadyVid(vid)} onState={setPlaying} />
        ) : (
          <div className="w-full aspect-video bg-[#201e1d] flex items-center justify-center text-sm text-[#bab6b6] px-6 text-center">
            {!clip ? "아래에서 클립을 고르면 여기서 재생돼요" : noVideo ? "이 경기는 유튜브 영상이 연결돼 있지 않아요" : "영상 불러오는 중…"}
          </div>
        )}
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
        <span className="flex-1" />
        {available.length > 1 &&
          available.map((a) => (
            <button key={a.key} onClick={() => pickAngle(a.key)} className={cn("h-7 px-2 text-xs border", a.key === useAngle ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground")}>
              {a.name}
            </button>
          ))}
      </div>
      {clip && title && <div className="px-2 py-1 text-xs text-muted-foreground truncate border-b border-border" data-testid="now-playing">{title}</div>}
    </div>
  )
}
