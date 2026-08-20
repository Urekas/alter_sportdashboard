
"use client"

// TMS 라인업 붙여넣기 → 파싱 → 홈/어웨이 배정 → 저장, 그리고 저장된 라인업 표시.
// 정확한 "1st/2nd/3rd/4th" 칸 의미는 확정할 수 없어 원문 그대로만 보여줍니다 — lineup-parser.ts 주석 참고.
import { useState } from "react"
import { Users, ClipboardPaste, Loader2, Pencil, Crown, ShieldCheck } from "lucide-react"
import type { MatchData, TeamLineup } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useFirestore } from "@/firebase"
import { TournamentService } from "@/lib/tournament-service"
import { parseTmsLineupText } from "@/lib/lineup-parser"
import { cn } from "@/lib/utils"
import { CollapseToggleButton } from "./collapsible-section"

interface LineupSectionProps {
  match: MatchData
  onSaved: (lineups: MatchData['lineups']) => void
  onPlayerClick: (playerName: string) => void
}

export function LineupTable({ team, teamName, teamColor, onPlayerClick }: { team: TeamLineup; teamName: string; teamColor: string; onPlayerClick: (n: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="font-bold flex items-center gap-2" style={{ color: teamColor }}>
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: teamColor }} />
        {teamName}
        <span className="text-xs text-muted-foreground font-normal">({team.teamName})</span>
      </div>
      <div className="border rounded-lg overflow-hidden">
        {team.players.map(p => (
          <button
            key={p.number}
            onClick={() => onPlayerClick(p.name)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm border-b last:border-b-0 hover:bg-muted/50 transition-colors text-left"
          >
            <span className="w-6 shrink-0 text-center font-mono text-xs text-muted-foreground">{p.number}</span>
            <span className="flex-1 font-medium truncate">{p.name}</span>
            {p.isCaptain && <span title="주장"><Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" /></span>}
            {p.isGoalkeeper && <span title="골키퍼"><ShieldCheck className="h-3.5 w-3.5 text-sky-500 shrink-0" /></span>}
            {p.minutes && <span className="text-[10px] text-muted-foreground font-mono shrink-0">{p.minutes}</span>}
          </button>
        ))}
      </div>
      {(team.coach || team.manager) && (
        <div className="text-xs text-muted-foreground space-y-0.5 pl-1">
          {team.coach && <div>코치: <span className="font-semibold text-foreground">{team.coach}</span></div>}
          {team.manager && <div>매니저: <span className="font-semibold text-foreground">{team.manager}</span></div>}
        </div>
      )}
    </div>
  )
}

export function LineupSection({ match, onSaved, onPlayerClick }: LineupSectionProps) {
  const [editing, setEditing] = useState(!match.lineups)
  const [open, setOpen] = useState(true)
  const hasLineups = !!match.lineups
  const [pasteText, setPasteText] = useState("")
  const [parsedBlocks, setParsedBlocks] = useState<TeamLineup[]>([])
  const [assignment, setAssignment] = useState<Record<number, 'home' | 'away' | 'skip'>>({})
  const [isSaving, setIsSaving] = useState(false)
  const db = useFirestore()
  const { toast } = useToast()

  const handleParse = () => {
    const blocks = parseTmsLineupText(pasteText)
    if (blocks.length === 0) {
      toast({ title: "인식된 라인업이 없어요", description: "TMS에서 복사한 표 형식(탭 구분)인지 확인해주세요.", variant: "destructive" })
      return
    }
    setParsedBlocks(blocks)
    const initial: Record<number, 'home' | 'away' | 'skip'> = {}
    blocks.forEach((b, i) => { initial[i] = i === 0 ? 'home' : i === 1 ? 'away' : 'skip' })
    setAssignment(initial)
    toast({ title: `${blocks.length}개 팀 라인업 인식됨`, description: "각 팀을 홈/어웨이에 배정한 뒤 저장하세요." })
  }

  const handleSave = async () => {
    if (!db || !match.id) return
    const homeBlock = parsedBlocks[Object.keys(assignment).map(Number).find(i => assignment[i] === 'home') ?? -1]
    const awayBlock = parsedBlocks[Object.keys(assignment).map(Number).find(i => assignment[i] === 'away') ?? -1]
    if (!homeBlock && !awayBlock) {
      toast({ title: "최소 한 팀은 홈 또는 어웨이에 배정해주세요.", variant: "destructive" })
      return
    }
    const lineups = { ...(homeBlock ? { home: homeBlock } : {}), ...(awayBlock ? { away: awayBlock } : {}) }
    setIsSaving(true)
    try {
      await TournamentService.updateMatchLineups(db, match.id, lineups)
      onSaved(lineups)
      setEditing(false)
      setPasteText("")
      setParsedBlocks([])
      toast({ title: "라인업 저장 완료" })
    } catch (e: any) {
      toast({ title: "저장 실패", description: e.message, variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    // 라인업이 아예 없는 경기는 인쇄(PDF)에서 텅 빈 편집 폼(붙여넣기 상자)이 보기 흉하게
    // 나오던 문제 — 데이터가 없으면 이 섹션 전체를 인쇄에서 숨김(화면 편집은 그대로 가능).
    <Card className={cn("break-inside-avoid", !hasLineups && "print-hidden")}>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> 라인업</CardTitle>
          <CardDescription className="print-hidden">TMS에서 복사한 라인업 표를 붙여넣으면 파싱됩니다.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {match.lineups && !editing && (
            <Button variant="outline" size="sm" className="print-hidden" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5 mr-1.5" /> 수정</Button>
          )}
          {hasLineups && <CollapseToggleButton open={open} onClick={() => setOpen(o => !o)} />}
        </div>
      </CardHeader>
      <CardContent className={cn("space-y-4", hasLineups && !open && "hidden print:block")}>
        {!editing && match.lineups ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {match.lineups.home && <LineupTable team={match.lineups.home} teamName={match.homeTeam.name} teamColor={match.homeTeam.color} onPlayerClick={onPlayerClick} />}
            {match.lineups.away && <LineupTable team={match.lineups.away} teamName={match.awayTeam.name} teamColor={match.awayTeam.color} onPlayerClick={onPlayerClick} />}
          </div>
        ) : (
          <div className="space-y-3 print-hidden">
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="TMS 라인업 표를 여기에 붙여넣으세요 (Ctrl+V)"
              className="min-h-[160px] font-mono text-xs"
            />
            <Button onClick={handleParse} disabled={!pasteText.trim()}><ClipboardPaste className="h-4 w-4 mr-2" /> 파싱</Button>

            {parsedBlocks.length > 0 && (
              <div className="space-y-3 border-t pt-4">
                {parsedBlocks.map((b, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 bg-muted/30 rounded-lg px-3 py-2">
                    <div className="text-sm font-bold">{b.teamName} <span className="text-xs text-muted-foreground font-normal">({b.players.length}명)</span></div>
                    <Select value={assignment[i]} onValueChange={(v) => setAssignment(a => ({ ...a, [i]: v as any }))}>
                      <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="home">홈팀 ({match.homeTeam.name})</SelectItem>
                        <SelectItem value="away">어웨이팀 ({match.awayTeam.name})</SelectItem>
                        <SelectItem value="skip">사용 안 함</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={isSaving} className="font-bold">
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} 저장
                  </Button>
                  {match.lineups && <Button variant="ghost" onClick={() => setEditing(false)}>취소</Button>}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
