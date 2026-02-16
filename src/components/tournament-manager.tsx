
"use client"

import React, { useState, useMemo, useRef } from "react"
import { Trophy, Database, Trash2, Edit3, Save, X, Plus, ChevronRight, RefreshCw, ArrowLeft, ArrowUp, ArrowDown, Eye } from "lucide-react"
import { TournamentService } from "@/lib/tournament-service"
import type { Tournament, MatchData } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query } from "firebase/firestore"
import { parseXMLData, parseCSVData, createMatchDataFromUpload } from "@/lib/parser"

interface TournamentManagerProps {
  onViewMatch?: (match: MatchData) => void;
}

export function TournamentManager({ onViewMatch }: TournamentManagerProps) {
  const db = useFirestore()
  const { toast } = useToast()
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null)
  const [editMatchName, setEditMatchName] = useState("")
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [replaceMatchId, setReplaceMatchId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const tourneyQuery = useMemoFirebase(() => db ? query(collection(db, 'tournaments')) : null, [db]);
  const matchesQuery = useMemoFirebase(() => db ? query(collection(db, 'matches')) : null, [db]);

  const { data: rawTournaments, isLoading: loadingTourneys } = useCollection<Tournament>(tourneyQuery);
  const { data: rawMatches } = useCollection<MatchData>(matchesQuery);

  const tournaments = useMemo(() => {
    if (!rawTournaments) return [];
    return [...rawTournaments].map(t => {
      const matchCount = rawMatches?.filter(m => m.tournamentId === t.id).length || 0;
      return { ...t, matchCount };
    });
  }, [rawTournaments, rawMatches]);

  const currentTournamentMatches = useMemo(() => {
    if (!selectedTournament || !rawMatches) return [];
    return rawMatches.filter(m => m.tournamentId === selectedTournament.id)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }, [selectedTournament, rawMatches]);

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      await TournamentService.createTournament(newName, new Date().toISOString())
      setNewName("")
      setIsNewDialogOpen(false)
      toast({ title: "새 대회 생성 완료" })
    } catch (e: any) {
      toast({ title: "대회 생성 실패", description: e.message, variant: "destructive" })
    }
  }

  const handleUpdateTournament = async (id: string) => {
    if (!editName.trim()) return
    try {
      await TournamentService.updateTournament(id, editName)
      setEditingId(null)
      toast({ title: "대회 이름 수정 완료" })
    } catch (e: any) {
      toast({ title: "수정 실패", description: e.message, variant: "destructive" })
    }
  }

  const handleDeleteTournament = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation(); 
    if (!id) return;
    
    if (window.confirm("이 대회를 정말 삭제하시겠습니까? 대회에 포함된 모든 경기 정보가 함께 삭제됩니다.")) {
      try {
        await TournamentService.deleteTournament(id)
        toast({ title: "대회 삭제 완료" })
      } catch (err: any) {
        toast({ title: "삭제 실패", description: err.message, variant: "destructive" })
      }
    }
  }

  const handleDeleteMatch = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!id) return;

    if (window.confirm("이 경기를 정말 삭제하시겠습니까?")) {
      try {
        await TournamentService.deleteMatch(id)
        toast({ title: "경기 삭제 완료" })
      } catch (err: any) {
        toast({ title: "삭제 실패", description: err.message, variant: "destructive" })
      }
    }
  }

  const handleUpdateMatchName = async (matchId: string) => {
    if (!editMatchName.trim()) return
    try {
      await TournamentService.updateMatchName(matchId, editMatchName)
      setEditingMatchId(null)
      toast({ title: "경기 이름 수정 완료" })
    } catch (e: any) {
      toast({ title: "수정 실패", description: e.message, variant: "destructive" })
    }
  }

  const handleMoveOrder = async (matchId: string, currentOrder: number, direction: 'up' | 'down') => {
    const targetOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;
    if (targetOrder < 0 || targetOrder >= currentTournamentMatches.length) return;

    const swapMatch = currentTournamentMatches.find(m => m.orderIndex === targetOrder);
    if (!swapMatch || !swapMatch.id) return;

    try {
      await TournamentService.updateMatchOrder(matchId, targetOrder);
      await TournamentService.updateMatchOrder(swapMatch.id, currentOrder);
      toast({ title: "순서 변경 완료" });
    } catch (e: any) {
      toast({ title: "순서 변경 실패", description: e.message, variant: "destructive" });
    }
  }

  const handleReplaceFile = (e: React.MouseEvent, matchId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setReplaceMatchId(matchId);
    fileInputRef.current?.click();
  }

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!replaceMatchId || !event.target.files || !event.target.files[0]) return;
    const file = event.target.files[0];
    const matchName = file.name.replace(/\.[^/.]+$/, "");
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const ab = e.target?.result as ArrayBuffer;
        let content = new TextDecoder('utf-8').decode(ab);
        if ((content.match(/\ufffd/g) || []).length > 5) content = new TextDecoder('euc-kr').decode(ab);
        const parsed = file.name.endsWith('.xml') ? parseXMLData(content) : parseCSVData(content);
        const oldMatch = rawMatches?.find(m => m.id === replaceMatchId);
        const updatedData = createMatchDataFromUpload(
          parsed.events,
          parsed.teams.home,
          parsed.teams.away,
          oldMatch?.homeTeam.color || "#0066ff",
          oldMatch?.awayTeam.color || "#ef4444",
          selectedTournament?.name,
          matchName
        );
        await TournamentService.updateMatchData(replaceMatchId, updatedData);
        toast({ title: "데이터 교체 완료" });
        setReplaceMatchId(null);
      } catch (err: any) {
        toast({ title: "교체 실패", description: err.message, variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  }

  if (selectedTournament) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedTournament(null)}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div>
            <h2 className="text-3xl font-black italic text-primary uppercase tracking-tighter">{selectedTournament.name} - Match Management</h2>
            <p className="text-muted-foreground font-bold">경기 순서 조정 및 분석 바로가기</p>
          </div>
        </div>
        <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept=".xml,.csv" />
        <Card className="border-2 shadow-xl">
          <CardHeader className="bg-muted/10 border-b"><CardTitle className="text-lg flex items-center gap-2"><Database className="h-5 w-5 text-primary" /> 등록된 경기 ({currentTournamentMatches.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
             <Table>
                <TableHeader><TableRow className="bg-muted/20"><TableHead className="w-16 text-center">순서</TableHead><TableHead className="pl-6 font-black uppercase text-xs">Match Name</TableHead><TableHead className="text-center font-black uppercase text-xs">Score</TableHead><TableHead className="text-right pr-6 font-black uppercase text-xs">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {currentTournamentMatches.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">등록된 경기가 없습니다.</TableCell></TableRow>
                  ) : (
                    currentTournamentMatches.map((m, idx) => (
                      <TableRow key={m.id || idx} className="hover:bg-muted/5 group">
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === 0} onClick={(e) => { e.stopPropagation(); handleMoveOrder(m.id!, idx, 'up'); }}><ArrowUp className="h-3 w-3" /></Button>
                            <span className="text-xs font-black">{String(idx + 1).padStart(2, '0')}</span>
                            <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === currentTournamentMatches.length - 1} onClick={(e) => { e.stopPropagation(); handleMoveOrder(m.id!, idx, 'down'); }}><ArrowDown className="h-3 w-3" /></Button>
                          </div>
                        </TableCell>
                        <TableCell className="pl-6">
                          {editingMatchId === m.id ? (
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <Input value={editMatchName} onChange={(e) => setEditMatchName(e.target.value)} className="h-8 text-sm font-bold" onKeyDown={(e) => e.key === 'Enter' && handleUpdateMatchName(m.id!)} autoFocus />
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={() => handleUpdateMatchName(m.id!)}><Save className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setEditingMatchId(null)}><X className="h-4 w-4" /></Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="cursor-pointer hover:text-primary transition-colors" onClick={() => onViewMatch?.(m)}>
                                <p className="font-bold text-base flex items-center gap-2">{m.matchName} <Eye className="h-3 w-3 opacity-0 group-hover:opacity-100" /></p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">{m.homeTeam.name} vs {m.awayTeam.name}</p>
                              </div>
                              <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); setEditingMatchId(m.id!); setEditMatchName(m.matchName || ""); }}><Edit3 className="h-3 w-3" /></Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center"><span className="font-black text-primary bg-primary/10 px-3 py-1 rounded-full text-sm">{(m.matchStats.home.goals.field + m.matchStats.home.goals.pc)} : {(m.matchStats.away.goals.field + m.matchStats.away.goals.pc)}</span></TableCell>
                        <TableCell className="text-right pr-6 space-x-2" onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="sm" className="h-8 text-xs font-bold border-emerald-600 text-emerald-600 hover:bg-emerald-50" onClick={(e) => handleReplaceFile(e, m.id!)}><RefreshCw className="h-3 w-3 mr-1" /> 교체</Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={(e) => handleDeleteMatch(e, m.id!)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
             </Table>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h2 className="text-3xl font-black italic text-primary uppercase tracking-tighter">Tournament Master</h2><p className="text-muted-foreground font-bold">대회 목록 및 통합 관리</p></div>
        <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
          <DialogTrigger asChild><Button className="shadow-lg h-11 px-6 font-bold"><Plus className="mr-2 h-5 w-5" /> 새 대회 추가</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>새 대회 생성</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2"><Label>대회 이름</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="예: 2024 파리 올림픽" onKeyDown={(e) => e.key === 'Enter' && handleCreate()} /></div>
            </div>
            <DialogFooter><Button onClick={handleCreate} className="font-bold">생성하기</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="border-2 shadow-xl">
        <CardHeader className="bg-muted/10 border-b"><CardTitle className="text-lg flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /> 관리 중인 대회 목록 ({tournaments.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow className="bg-muted/20"><TableHead className="w-[40%] pl-6 font-black uppercase text-xs">Tournament Name</TableHead><TableHead className="text-center font-black uppercase text-xs">Stats</TableHead><TableHead className="text-center font-black uppercase text-xs">Created At</TableHead><TableHead className="text-right pr-6 font-black uppercase text-xs">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {loadingTourneys ? (
                <TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">데이터 로딩 중...</TableCell></TableRow>
              ) : tournaments.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">등록된 대회가 없습니다.</TableCell></TableRow>
              ) : (
                tournaments.map((t) => (
                  <TableRow key={t.id} className="hover:bg-muted/5 transition-all group cursor-pointer" onClick={() => setSelectedTournament(t)}>
                    <TableCell className="pl-6">
                      {editingId === t.id ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm font-bold" onKeyDown={(e) => e.key === 'Enter' && handleUpdateTournament(t.id)} autoFocus />
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={() => handleUpdateTournament(t.id)}><Save className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2"><span className="font-black text-lg tracking-tight">{t.name}</span><ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" /></div>
                      )}
                    </TableCell>
                    <TableCell className="text-center"><div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 rounded-full text-primary font-black text-xs uppercase"><Database className="h-3.5 w-3.5" /> {t.matchCount} Matches</div></TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground font-medium">{t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toLocaleDateString() : '-'}</TableCell>
                    <TableCell className="text-right pr-6 space-x-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); setEditingId(t.id); setEditName(t.name); }}><Edit3 className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={(e) => handleDeleteTournament(e, t.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
