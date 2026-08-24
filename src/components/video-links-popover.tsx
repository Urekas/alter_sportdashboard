
"use client"

// 경기에 연결된 유튜브 링크를 빠르게 보여주는 팝오버. 다운로드는 안 함 — 그냥 링크를 눈에 잘 띄게
// 꺼내주기만 해서, 사용자가 원하면 자기 다운로더 도구에 직접 붙여넣기 쉽게 하는 용도.
import { useState } from "react"
import { Link2, Copy, Loader2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { VideoMatchService, type VideoMatchMetadata } from "@/lib/video-match-service"
import { useFirestore } from "@/firebase"
import { useToast } from "@/hooks/use-toast"

interface VideoLinksPopoverProps {
  videoMatchId?: string
}

const CAM_LABELS: Record<string, string> = {
  tactical_cam1: "전술캠 1",
  tactical_cam2: "전술캠 2",
  tactical_cam3: "전술캠 3",
  broadcast_cam: "중계 영상",
}

export function VideoLinksPopover({ videoMatchId }: VideoLinksPopoverProps) {
  const [meta, setMeta] = useState<VideoMatchMetadata | null>(null)
  const [loading, setLoading] = useState(false)
  const db = useFirestore()
  const { toast } = useToast()

  if (!videoMatchId) return null

  const handleOpenChange = async (open: boolean) => {
    if (open && !meta && db) {
      setLoading(true)
      const m = await VideoMatchService.get(db, videoMatchId)
      setMeta(m)
      setLoading(false)
    }
  }

  const links = meta ? (Object.entries(meta.video_urls || {}) as [string, string][]).filter(([, v]) => !!v) : []

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url)
    toast({ title: "링크 복사됨" })
  }

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8" title="유튜브 링크 보기">
          <Link2 className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase">유튜브 링크</p>
          {loading ? (
            <div className="py-4 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>
          ) : links.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">등록된 영상 링크가 없어요.</p>
          ) : (
            <div className="space-y-1.5">
              {links.map(([key, url]) => (
                <div key={key} className="flex items-center justify-between gap-2 bg-muted/30 rounded-lg px-2.5 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold text-muted-foreground">{CAM_LABELS[key] || key}</div>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate block flex items-center gap-1">
                      <span className="truncate">{url}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" title="링크 복사" onClick={() => handleCopy(url)}><Copy className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
