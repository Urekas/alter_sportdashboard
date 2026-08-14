
"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Video, FileJson } from "lucide-react"
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

  // stream.json (Sportscode 카메라별 export 폴더의 동기화 파일)을 읽어 segments[0].offset을 오프셋 칸에 채웁니다.
  // 슈팅 태깅 도구(슈팅위치태킹.html)의 handleSyncJsonUpload와 동일한 규칙입니다.
  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>, offsetKey: string) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string)
        const offset = json?.segments?.[0]?.offset
        if (typeof offset === 'number') {
          setForm(f => ({ ...f, [offsetKey]: String(offset) }))
          toast({ title: `오프셋 자동 입력: ${offset.toFixed(3)}초` })
        } else {
          toast({ title: "이 JSON에서 offset 값을 찾지 못했어요", variant: "destructive" })
        }
      } catch (err: any) {
        toast({ title: "JSON 파싱 실패", description: err.message, variant: "destructive" })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

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
      // 비디오 도구엔 이제 자체 XML/CSV 업로드 경로가 없어서, 대시보드에 이미 파싱돼있는
      // 이벤트가 그쪽 Scenes/Events 탭(클립 라이브러리)의 유일한 데이터 소스입니다.
      await VideoMatchService.syncEvents(db, videoMatchId, match.events)
      toast({ title: "영상 연결 저장 완료", description: `이벤트 ${match.events.length}개를 비디오 도구에 동기화했어요.` })
      onSaved?.(videoMatchId)
      onOpenChange(false)
    } catch (e: any) {
      toast({ title: "저장 실패", description: e.message, variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  // 영상 연결만 해제합니다 — 대시보드 매치(실제 통계)는 그대로 두고, 비디오 도구 쪽
  // 메타데이터(Matches/Events)만 지웁니다.
  const handleUnlink = async () => {
    if (!match || !db || !match.id || !match.videoMatchId) return
    if (!confirm("영상 연결을 해제할까요? 비디오 도구에 올라간 카메라 URL·이벤트 데이터가 삭제됩니다(대시보드 통계는 영향 없음).")) return
    setIsSaving(true)
    try {
      await VideoMatchService.deleteVideoMatch(db, match.videoMatchId)
      await TournamentService.updateVideoMatchId(db, match.id, "")
      toast({ title: "영상 연결 해제 완료" })
      onSaved?.("")
      onOpenChange(false)
    } catch (e: any) {
      toast({ title: "해제 실패", description: e.message, variant: "destructive" })
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
                    className="h-9 w-24"
                  />
                  <label
                    className="h-9 px-2 flex items-center gap-1 border rounded-md text-[11px] font-bold text-muted-foreground hover:bg-muted/50 cursor-pointer shrink-0"
                    title="stream.json 업로드해서 오프셋 자동 입력"
                  >
                    <FileJson className="h-3.5 w-3.5" /> JSON
                    <input type="file" accept=".json" className="hidden" onChange={(e) => handleJsonUpload(e, row.offsetKey)} />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          {match?.videoMatchId ? (
            <Button variant="ghost" onClick={handleUnlink} disabled={isSaving || isLoading} className="text-destructive hover:text-destructive font-bold">
              연결 해제
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
            <Button onClick={handleSave} disabled={isSaving || isLoading} className="font-bold">
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              저장
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
