
"use client"

// 라인업에서 선수 이름을 클릭하면 뜨는 다이얼로그. 저장된 모든 경기의 lineups.home/away.players를
// 이름으로 검색해서(별도 선수 로스터 컬렉션 없이, 이미 저장된 라인업 데이터만으로) 그 선수가
// 뛴 경기 목록을 보여주고, 클릭하면 그 경기 리포트로 이동합니다.
// 득점/슈팅/선방 집계 + 영상 연결은 사용자가 명시적으로 "나중에"라고 한 범위라 여기 포함 안 함.
import { useMemo } from "react"
import { User, Loader2, Trophy, Crown, ShieldCheck } from "lucide-react"
import type { MatchData, Tournament } from "@/lib/types"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { collection, query } from "firebase/firestore"

interface PlayerRecordDialogProps {
  playerName: string | null
  onClose: () => void
  onViewMatch: (match: MatchData) => void
  tournaments: Tournament[]
}

const norm = (s: string) => s.trim().toLowerCase()

export function PlayerRecordDialog({ playerName, onClose, onViewMatch, tournaments }: PlayerRecordDialogProps) {
  const db = useFirestore()
  const matchesQuery = useMemoFirebase(() => (db && playerName) ? query(collection(db, 'matches')) : null, [db, playerName])
  const { data: matches, isLoading } = useCollection<MatchData>(matchesQuery)

  const tournamentById = useMemo(() => new Map(tournaments.map(t => [t.id, t])), [tournaments])

  const appearances = useMemo(() => {
    if (!matches || !playerName) return []
    const target = norm(playerName)
    const rows: { match: MatchData; side: 'home' | 'away'; teamName: string; isCaptain?: boolean; isGoalkeeper?: boolean; minutes?: string; startDate: Date | null }[] = []
    matches.forEach(m => {
      const t = tournamentById.get(m.tournamentId || "")
      const startDate = t?.startDate ? new Date(t.startDate) : null
      const homePlayer = m.lineups?.home?.players.find(p => norm(p.name) === target)
      if (homePlayer) rows.push({ match: m, side: 'home', teamName: m.homeTeam.name, isCaptain: homePlayer.isCaptain, isGoalkeeper: homePlayer.isGoalkeeper, minutes: homePlayer.minutes, startDate: startDate && !isNaN(startDate.getTime()) ? startDate : null })
      const awayPlayer = m.lineups?.away?.players.find(p => norm(p.name) === target)
      if (awayPlayer) rows.push({ match: m, side: 'away', teamName: m.awayTeam.name, isCaptain: awayPlayer.isCaptain, isGoalkeeper: awayPlayer.isGoalkeeper, minutes: awayPlayer.minutes, startDate: startDate && !isNaN(startDate.getTime()) ? startDate : null })
    })
    return rows.sort((a, b) => (b.startDate?.getTime() || 0) - (a.startDate?.getTime() || 0))
  }, [matches, playerName, tournamentById])

  return (
    <Dialog open={!!playerName} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary" /> {playerName}</DialogTitle>
          <DialogDescription>이 선수가 라인업에 등록된 모든 경기 (저장된 라인업 기준)</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : appearances.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">라인업에 이 선수가 등록된 경기가 없어요.</div>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto space-y-1.5">
            {appearances.map((a, i) => (
              <button
                key={`${a.match.id}-${i}`}
                onClick={() => { onViewMatch(a.match); onClose() }}
                className="w-full text-left flex items-center justify-between gap-3 px-3 py-2 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate flex items-center gap-1.5">
                    {a.match.matchName || `${a.match.homeTeam.name} vs ${a.match.awayTeam.name}`}
                    {a.isCaptain && <Crown className="h-3 w-3 text-amber-500 shrink-0" />}
                    {a.isGoalkeeper && <ShieldCheck className="h-3 w-3 text-sky-500 shrink-0" />}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                    <Trophy className="h-3 w-3 shrink-0" /> {a.match.tournamentName || tournamentById.get(a.match.tournamentId || "")?.name || "대회 미상"}
                    {a.startDate && <span> · {a.startDate.getFullYear()}년</span>}
                  </div>
                </div>
                <span className="text-[10px] font-bold shrink-0 px-2 py-1 rounded-full" style={{ color: a.teamName === a.match.homeTeam.name ? a.match.homeTeam.color : a.match.awayTeam.color, backgroundColor: `${a.teamName === a.match.homeTeam.name ? a.match.homeTeam.color : a.match.awayTeam.color}20` }}>
                  {a.teamName}
                </span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
