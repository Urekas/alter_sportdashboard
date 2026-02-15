
"use client"

import React, { useState, useEffect } from "react"
import { Trophy, Calendar, Database, Trash2, Edit3, Save, X, Plus } from "lucide-react"
import { TournamentService } from "@/lib/tournament-service"
import type { Tournament } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

export function TournamentManager() {
  const [tournaments, setTournaments] = useState<(Tournament & { matchCount: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const { toast } = useToast()

  const fetchTournaments = async () => {
    try {
      setLoading(true)
      const list = await TournamentService.getTournaments()
      const listWithCounts = await Promise.all(
        list.map(async (t) => {
          const count = await TournamentService.getMatchCount(t.id)
          return { ...t, matchCount: count }
        })
      )
      setTournaments(listWithCounts)
    } catch (e) {
      console.error("Failed to fetch tournaments", e)
      toast({ title: "대회 목록 로드 실패", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTournaments()
  }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      await TournamentService.createTournament(newName, new Date().toISOString())
      setNewName("")
      setIsNewDialogOpen(false)
      fetchTournaments()
      toast({ title: "새 대회 생성 완료" })
    } catch (e: any) {
      toast({ title: "대회 생성 실패", description: e.message, variant: "destructive" })
    }
  }

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return
    try {
      await TournamentService.updateTournament(id, editName)
      setEditingId(null)
      fetchTournaments()
      toast({ title: "대회 이름 수정 완료" })
    } catch (e: any) {
      toast({ title: "수정 실패", description: e.message, variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("이 대회를 삭제하시겠습니까? 대회에 포함된 모든 경기 요약 정보가 관리 목록에서 사라집니다.")) return
    try {
      await TournamentService.deleteTournament(id)
      fetchTournaments()
      toast({ title: "대회 삭제 완료" })
    } catch (e: any) {
      toast({ title: "삭제 실패", description: e.message, variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black italic text-primary uppercase">Tournament Management</h2>
          <p className="text-muted-foreground font-bold">대회 목록 관리 및 데이터 현황</p>
        </div>
        <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg"><Plus className="mr-2 h-4 w-4" /> 새 대회 추가</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 대회 생성</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label>대회 이름</Label>
                <Input 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  placeholder="예: 2024 파리 올림픽"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate}>생성하기</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-2">
        <CardHeader className="bg-muted/10 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" /> 등록된 대회 목록
          </CardTitle>
          <CardDescription>총 {tournaments.length}개의 대회가 관리되고 있습니다.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20">
                <TableHead className="w-[40%] pl-6">대회 명칭</TableHead>
                <TableHead className="text-center">등록 경기 수</TableHead>
                <TableHead className="text-center">생성 일시</TableHead>
                <TableHead className="text-right pr-6">관리 액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic">데이터를 불러오는 중...</TableCell>
                </TableRow>
              ) : tournaments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic">등록된 대회가 없습니다.</TableCell>
                </TableRow>
              ) : (
                tournaments.map((t) => (
                  <TableRow key={t.id} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="pl-6">
                      {editingId === t.id ? (
                        <div className="flex items-center gap-2">
                          <Input 
                            value={editName} 
                            onChange={(e) => setEditName(e.target.value)} 
                            className="h-8 text-sm"
                            onKeyDown={(e) => e.key === 'Enter' && handleUpdate(t.id)}
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={() => handleUpdate(t.id)}><Save className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                        </div>
                      ) : (
                        <span className="font-bold text-base">{t.name}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-primary font-black text-xs">
                        <Database className="h-3 w-3" /> {t.matchCount} Matches
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toLocaleString() : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right pr-6 space-x-1">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => {
                          setEditingId(t.id)
                          setEditName(t.name)
                        }}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(t.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
