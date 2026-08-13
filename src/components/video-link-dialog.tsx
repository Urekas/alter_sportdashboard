
"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Video } from "lucide-react"
import { useFirestore } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { TournamentService } from "@/lib/tournament-service"
import { VideoMatchService } from "@/lib/video-match-service"
import type { MatchData } from "@/lib/types"

interface VideoLinkDialogProps {
  match: MatchData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (videoMatchId: string) => void
}

const emptyForm = {
  matchDate: "",
  tacticalUrl1: "",
  tacticalOffset1: "0",
  tacticalUrl2: "",
  tacticalOffset2: "0",
  broadcastUrl: "",
  broadcastOffset: "0",
}

export function VideoLinkDialog({ match, open, onOpenChange, onSaved }: VideoLinkDialogProps) {
  const db = useFirestore()
  const { toast } = useToast()
  const [form, setForm] = useState(emptyForm)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open || !match) return
    setForm(emptyForm)
    if (match.videoMatchId && db) {
      setIsLoading(true)
      VideoMatchService.get(db, match.videoMatchId).then((meta) => {
        if (meta) {
          setForm({
            matchDate: meta.match_date || "",
            tacticalUrl1: meta.video_urls?.tactical_cam1 || "",
            tacticalOffset1: String(meta.video_offsets?.tactical_cam1 ?? 0),
            tacticalUrl2: meta.video_urls?.tactical_cam2 || "",
            tacticalOffset2: String(meta.video_offsets?.tactical_cam2 ?? 0),
            broadcastUrl: meta.video_urls?.broadcast_cam || "",
            broadcastOffset: String(meta.video_offsets?.broadcast_cam ?? 0),
          })
        }
        setIsLoading(false)
      })
    }
  }, [open, match, db])

  const handleSave = async () => {
    if (!match || !db || !match.id) return
    setIsSaving(true)
    try {
      const videoMatchId = await VideoMatchService.upsert(db, match.videoMatchId, {
        match_name: match.matchName || "",
        match_date: form.matchDate,
        home_team: match.homeTeam.name,
        away_team: match.awayTeam.name,
        tournament_id: match.tournamentId || "",
        video_urls: {
          tactical_cam1: form.tacticalUrl1.trim(),
          tactical_cam2: form.tacticalUrl2.trim(),
          broadcast_cam: form.broadcastUrl.trim(),
        },
        video_offsets: {
          tactical_cam1: parseFloat(form.tacticalOffset1) || 0,
          tactical_cam2: parseFloat(form.tacticalOffset2) || 0,
          broadcast_cam: parseFloat(form.broadcastOffset) || 0,
        },
      })
      await TournamentService.updateVideoMatchId(db, match.id, videoMatchId)
      toast({ title: "영상 연결 저장 완료" })
      onSaved?.(videoMatchId)
      onOpenChange(false)
    } catch (e: any) {
      toast({ title: "저장 실패", description: e.message, variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Video className="h-5 w-5 text-orange-500" /> 영상 연결</DialogTitle>
          <DialogDescription>
            {match?.matchName} — 유튜브 앵글별 URL과 싱크 오프셋(초)을 입력하면 비디오 분석 도구에서 여러 각도를 맞춰 볼 수 있어요.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-bold">경기 날짜</Label>
              <Input type="date" value={form.matchDate} onChange={(e) => setForm(f => ({ ...f, matchDate: e.target.value }))} className="h-9" />
            </div>

            {[
              { label: "전술캠 1", urlKey: 'tacticalUrl1', offsetKey: 'tacticalOffset1' },
              { label: "전술캠 2", urlKey: 'tacticalUrl2', offsetKey: 'tacticalOffset2' },
              { label: "중계 영상", urlKey: 'broadcastUrl', offsetKey: 'broadcastOffset' },
            ].map((row) => (
              <div key={row.urlKey} className="space-y-1 border-t pt-3">
                <Label className="text-xs font-bold text-orange-600">{row.label}</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="유튜브 URL"
                    value={(form as any)[row.urlKey]}
                    onChange={(e) => setForm(f => ({ ...f, [row.urlKey]: e.target.value }))}
                    className="h-9 flex-1"
                  />
                  <Input
                    type="number" step="0.1"
                    placeholder="오프셋(초)"
                    value={(form as any)[row.offsetKey]}
                    onChange={(e) => setForm(f => ({ ...f, [row.offsetKey]: e.target.value }))}
                    className="h-9 w-28"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading} className="font-bold">
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
