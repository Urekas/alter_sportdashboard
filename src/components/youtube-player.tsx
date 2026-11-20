"use client"

// 웹 태깅용 유튜브 플레이어 — IFrame API를 감싸서 현재 시간 읽기/이동/재생/속도를 바깥에서 쓰게 함
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { cn } from "@/lib/utils"

declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
  }
}

export interface YouTubeHandle {
  time: () => number
  duration: () => number
  seek: (t: number) => void
  play: () => void
  pause: () => void
  toggle: () => void
  playing: () => boolean
  setRate: (r: number) => void
}

let apiPromise: Promise<void> | null = null
function loadApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.YT?.Player) return Promise.resolve()
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve()
    }
    const s = document.createElement("script")
    s.src = "https://www.youtube.com/iframe_api"
    document.head.appendChild(s)
  })
  return apiPromise
}

export function youTubeId(url: string): string | null {
  const m = String(url || "").match(/(?:youtube\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|live|shorts)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

// bare: 유튜브 자체 화면(제목·조작 막대·멈춤 때 "동영상 더보기"·로고)을 안 보이게 — 바깥에서 직접 조작할 때
//  iframe을 위아래로 2배 키우면 영상은 가운데 그대로, 끝에 붙는 유튜브 UI(멈춤 때 제목·공유·로고)는 상자 밖으로 잘림
//  가운데 큰 재생 버튼은 영상 가운데라 못 자름 → 그리기 중엔 바깥(clip-player)에서 영상 전체를 어둡게 깜
export const YouTubePlayer = forwardRef<YouTubeHandle, { videoId: string; onReady?: () => void; onState?: (playing: boolean) => void; bare?: boolean }>(
  function YouTubePlayer({ videoId, onReady, onState, bare }, ref) {
    const host = useRef<HTMLDivElement>(null)
    const player = useRef<any>(null)
    const [failed, setFailed] = useState(false)
    const cb = useRef({ onReady, onState })
    cb.current = { onReady, onState }

    useEffect(() => {
      let gone = false
      setFailed(false)
      loadApi().then(() => {
        if (gone || !host.current) return
        const el = document.createElement("div")
        host.current.innerHTML = ""
        host.current.appendChild(el)
        player.current = new window.YT.Player(el, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: bare
            ? { rel: 0, modestbranding: 1, playsinline: 1, disablekb: 1, controls: 0, fs: 0, iv_load_policy: 3, cc_load_policy: 0 }
            : { rel: 0, modestbranding: 1, playsinline: 1, disablekb: 1 },
          events: {
            onReady: () => cb.current.onReady?.(),
            onStateChange: (e: any) => cb.current.onState?.(e.data === window.YT.PlayerState.PLAYING),
            onError: () => setFailed(true),
          },
        })
      })
      return () => {
        gone = true
        try {
          player.current?.destroy?.()
        } catch {}
        player.current = null
      }
    }, [videoId, bare])

    useImperativeHandle(ref, () => ({
      time: () => Number(player.current?.getCurrentTime?.() ?? 0),
      duration: () => Number(player.current?.getDuration?.() ?? 0),
      seek: (t: number) => player.current?.seekTo?.(Math.max(0, t), true),
      play: () => player.current?.playVideo?.(),
      pause: () => player.current?.pauseVideo?.(),
      toggle: () => {
        const p = player.current
        if (!p) return
        if (p.getPlayerState?.() === window.YT?.PlayerState?.PLAYING) p.pauseVideo()
        else p.playVideo()
      },
      playing: () => player.current?.getPlayerState?.() === window.YT?.PlayerState?.PLAYING,
      setRate: (r: number) => player.current?.setPlaybackRate?.(r),
    }))

    return (
      <div className={cn("relative w-full aspect-video bg-[#201e1d]", bare && "overflow-hidden")}>
        <div ref={host} className={cn("absolute [&>iframe]:w-full [&>iframe]:h-full", bare ? "inset-x-0 top-[-50%] h-[200%] pointer-events-none" : "inset-0")} />
        {failed && <div className="absolute inset-0 flex items-center justify-center text-sm text-[#bab6b6]">유튜브 영상을 불러오지 못했어요 (비공개이거나 삭제됨)</div>}
      </div>
    )
  },
)
