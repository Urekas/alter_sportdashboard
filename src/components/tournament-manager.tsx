
"use client"

import React, { useState, useMemo, useRef } from "react"
import { Trophy, Database, Trash2, Edit3, Save, X, Plus, ChevronRight, RefreshCw, ArrowLeft, ArrowUp, ArrowDown, Eye, Users, Video, CalendarClock, Link2, Settings2 } from "lucide-react"
import { VideoLinkDialog } from "./video-link-dialog"
import { TournamentService } from "@/lib/tournament-service"
import type { Tournament, MatchData, ScheduleEntry, FinalStandingRule } from "@/lib/types"
import { resolveScheduleRefs, computePoolStandings, computeFinalStandings, type ResolvedScheduleEntry } from "@/lib/schedule-resolver"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query } from "firebase/firestore"
import { parseXMLData, parseCSVData, createMatchDataFromUpload } from "@/lib/parser"

// FIH TMS류 사이트에서 그대로 복사-붙여넣기한 일정표를 파싱합니다.
// 탭 구분(엑셀/TMS 표에서 복사 시 보통 탭)이 기본이고, 없으면 공백 2칸+ 로 대체 분리합니다.
// "Winner 47", "3rd Pool B" 같은 참조 문자열은 있는 그대로 저장하고(자동 치환은 다음 단계), 실제 점수/상태도 원문 그대로 보관합니다.
function parseScheduleText(text: string): ScheduleEntry[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const entries: ScheduleEntry[] = [];
  for (const line of lines) {
    let cols = line.split('\t').map(c => c.trim());
    if (cols.length < 4) cols = line.split(/ {2,}/).map(c => c.trim());
    if (cols.length < 3) continue;
    const matchNumber = parseInt(cols[0], 10);
    if (isNaN(matchNumber)) continue; // 헤더 행("Match #...") 등은 자동으로 건너뜀
    const dateTime = cols[1] || '';
    const details = cols[2] || '';
    const m = details.match(/^(.+?)\s+v\s+(.+?)\s*\(([^)]+)\)\s*$/);
    if (!m) continue;
    entries.push({
      matchNumber,
      dateTime,
      homeRef: m[1].trim(),
      awayRef: m[2].trim(),
      stage: m[3].trim(),
      score: (cols[3] || '').trim(),
      status: (cols[4] || '').trim(),
      venue: (cols[5] || '').trim(),
    });
  }
  return entries.sort((a, b) => a.matchNumber - b.matchNumber);
}

interface TournamentManagerProps {
  onViewMatch?: (match: MatchData) => void;
  onViewCumulative?: (matches: MatchData[], title: string) => void;
}

export function TournamentManager({ onViewMatch, onViewCumulative }: TournamentManagerProps) {
  const db = useFirestore()
  const { toast } = useToast()
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editCategory, setEditCategory] = useState("")
  const [editStartDate, setEditStartDate] = useState("")
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null)
  const [editMatchName, setEditMatchName] = useState("")
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newCategory, setNewCategory] = useState("")
  const [newStartDate, setNewStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [viewBy, setViewBy] = useState<'category' | 'country'>('category')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [selectedCountryCategory, setSelectedCountryCategory] = useState<string>('전체')
  const [selectedYears, setSelectedYears] = useState<Set<string>>(new Set())
  const [selectedTournamentIds, setSelectedTournamentIds] = useState<Set<string>>(new Set())
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [replaceMatchId, setReplaceMatchId] = useState<string | null>(null)
  const [videoLinkMatch, setVideoLinkMatch] = useState<MatchData | null>(null)
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false)
  const [scheduleText, setScheduleText] = useState("")
  const [isSavingSchedule, setIsSavingSchedule] = useState(false)
  const [editingMatchNumberId, setEditingMatchNumberId] = useState<string | null>(null)
  const [editMatchNumber, setEditMatchNumber] = useState("")
  const [isRulesDialogOpen, setIsRulesDialogOpen] = useState(false)
  const [rulesDraft, setRulesDraft] = useState<Record<string, Partial<FinalStandingRule>>>({})
  const [isSavingRules, setIsSavingRules] = useState(false)
  const [slotUploadEntry, setSlotUploadEntry] = useState<ResolvedScheduleEntry | null>(null)
  const [isUploadingSlot, setIsUploadingSlot] = useState(false)
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState("")
  const [isSavingDescription, setIsSavingDescription] = useState(false)
  const [editingScheduleIndex, setEditingScheduleIndex] = useState<number | null>(null)
  const [scheduleRowDraft, setScheduleRowDraft] = useState<ScheduleEntry | null>(null)
  const [isSavingScheduleRow, setIsSavingScheduleRow] = useState(false)
  const [editingTeamsMatchId, setEditingTeamsMatchId] = useState<string | null>(null)
  const [editHomeName, setEditHomeName] = useState("")
  const [editAwayName, setEditAwayName] = useState("")
  const [isSavingTeams, setIsSavingTeams] = useState(false)
  const [swappingMatchId, setSwappingMatchId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const slotFileInputRef = useRef<HTMLInputElement>(null)

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

  // 일정표 매치 번호 중 이미 실제 데이터가 업로드/연결된 것들 — "미입력 슬롯" 판별용
  const linkedMatchNumbers = useMemo(() => {
    return new Set(currentTournamentMatches.filter(m => typeof m.matchNumber === 'number').map(m => m.matchNumber as number));
  }, [currentTournamentMatches]);

  // 새 슬롯 업로드 시 팀 색상을 기존 경기와 맞추기 위한 팀명 -> 색상 맵
  const teamColorMap = useMemo(() => {
    const map = new Map<string, string>();
    currentTournamentMatches.forEach(m => {
      if (!map.has(m.homeTeam.name)) map.set(m.homeTeam.name, m.homeTeam.color);
      if (!map.has(m.awayTeam.name)) map.set(m.awayTeam.name, m.awayTeam.color);
    });
    return map;
  }, [currentTournamentMatches]);

  // Pool 순위표: 승 3점 / 무 1점 / 패 0점, 승점 -> 득실차 -> 다득점 순으로 정렬
  const standings = useMemo(() => {
    const map = new Map<string, { team: string; p: number; w: number; d: number; l: number; gf: number; ga: number }>();
    const ensure = (team: string) => {
      if (!map.has(team)) map.set(team, { team, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 });
      return map.get(team)!;
    };
    currentTournamentMatches.forEach(m => {
      const hGoals = m.matchStats.home.goals.field + m.matchStats.home.goals.pc;
      const aGoals = m.matchStats.away.goals.field + m.matchStats.away.goals.pc;
      const h = ensure(m.homeTeam.name);
      const a = ensure(m.awayTeam.name);
      h.p++; a.p++;
      h.gf += hGoals; h.ga += aGoals;
      a.gf += aGoals; a.ga += hGoals;
      if (hGoals > aGoals) { h.w++; a.l++; }
      else if (hGoals < aGoals) { a.w++; h.l++; }
      else { h.d++; a.d++; }
    });
    return Array.from(map.values())
      .map(t => ({ ...t, pts: t.w * 3 + t.d, gd: t.gf - t.ga }))
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  }, [currentTournamentMatches]);

  // 일정표 참조("Winner 47", "3rd Pool B") 자동 치환 — 연결된 실제 매치 결과 우선, 없으면 일정표 스코어 사용
  const resolvedSchedule = useMemo(() => {
    if (!selectedTournament?.schedule) return [];
    return resolveScheduleRefs(selectedTournament.schedule, currentTournamentMatches);
  }, [selectedTournament?.schedule, currentTournamentMatches]);

  // Pool(스테이지 라벨 A/B/C...)별 순위표
  const poolStandings = useMemo(() => {
    if (!selectedTournament?.schedule) return {};
    return computePoolStandings(selectedTournament.schedule, currentTournamentMatches);
  }, [selectedTournament?.schedule, currentTournamentMatches]);

  // 최종 순위 매핑에 쓸 수 있는 스테이지 라벨 후보(Pool 알파벳 제외 — 토너먼트 라운드만)
  const knockoutStageLabels = useMemo(() => {
    if (!selectedTournament?.schedule) return [];
    const set = new Set<string>();
    selectedTournament.schedule.forEach(s => {
      const stage = s.stage.trim();
      if (stage && !/^[A-Za-z]$/.test(stage)) set.add(stage);
    });
    return Array.from(set);
  }, [selectedTournament?.schedule]);

  // 일정표 진행 현황 요약(완료/대기중/미정 개수) — "미입력 경기 슬롯" 카드에 표시
  const scheduleUploadSummary = useMemo(() => {
    let done = 0, pending = 0, undetermined = 0;
    resolvedSchedule.forEach(s => {
      if (linkedMatchNumbers.has(s.matchNumber)) done++;
      else if (!s.homeIsRef && !s.awayIsRef) pending++;
      else undetermined++;
    });
    return { done, pending, undetermined };
  }, [resolvedSchedule, linkedMatchNumbers]);

  const finalStandings = useMemo(() => {
    if (!selectedTournament?.schedule) return [];
    return computeFinalStandings(selectedTournament.schedule, currentTournamentMatches, selectedTournament.finalStandingsRules);
  }, [selectedTournament?.schedule, selectedTournament?.finalStandingsRules, currentTournamentMatches]);

  // 카테고리(예: 여자대표팀)별 대회 개수 집계
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    tournaments.forEach(t => {
      const cat = t.category || "미분류";
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [tournaments]);

  // 선택된 카테고리의 대회들을 연도별로 그룹핑 (최신 연도 먼저)
  const tournamentsByYear = useMemo(() => {
    if (!selectedCategory) return [];
    const filtered = tournaments.filter(t => (t.category || "미분류") === selectedCategory);
    const yearMap = new Map<string, typeof filtered>();
    filtered.forEach(t => {
      const d = t.startDate ? new Date(t.startDate) : null;
      const year = d && !isNaN(d.getTime()) ? `${d.getFullYear()}년` : "연도 미상";
      if (!yearMap.has(year)) yearMap.set(year, []);
      yearMap.get(year)!.push(t);
    });
    return Array.from(yearMap.entries())
      .map(([year, list]) => ({
        year,
        tournaments: list.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      }))
      .sort((a, b) => b.year.localeCompare(a.year));
  }, [selectedCategory, tournaments]);

  // 국가대표 경기라 팀 이름 자체가 국가명입니다 — 별도 매핑 없이 바로 집계합니다.
  const countries = useMemo(() => {
    if (!rawMatches) return [];
    const map = new Map<string, number>();
    rawMatches.forEach(m => {
      [m.homeTeam?.name, m.awayTeam?.name].forEach(name => {
        if (!name) return;
        map.set(name, (map.get(name) || 0) + 1);
      });
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [rawMatches]);

  // 선택된 국가가 (홈이든 어웨이든) 출전한 모든 경기를 대회를 가로질러 모읍니다.
  // 각 경기에 소속 대회의 카테고리/연도 정보를 같이 붙여서, 이후 필터링에 씁니다.
  const countryMatches = useMemo(() => {
    if (!selectedCountry || !rawMatches) return [];
    const tournamentById = new Map(tournaments.map(t => [t.id, t]));
    return rawMatches
      .filter(m => m.homeTeam?.name === selectedCountry || m.awayTeam?.name === selectedCountry)
      .map(m => {
        const t = tournamentById.get(m.tournamentId || "");
        const d = t?.startDate ? new Date(t.startDate) : null;
        return {
          ...m,
          resolvedTournamentName: m.tournamentName || t?.name || "",
          resolvedCategory: t?.category || "미분류",
          resolvedYear: d && !isNaN(d.getTime()) ? `${d.getFullYear()}년` : "연도 미상",
        };
      })
      .sort((a, b) => {
        const ta = a.uploadedAt?.seconds || 0;
        const tb = b.uploadedAt?.seconds || 0;
        return tb - ta;
      });
  }, [selectedCountry, rawMatches, tournaments]);

  // 선택된 국가의 경기들이 걸쳐있는 카테고리 목록 (예: 여자대표팀/남자대표팀/미분류)
  const countryCategories = useMemo(() => {
    const set = new Set(countryMatches.map(m => m.resolvedCategory));
    return Array.from(set).sort();
  }, [countryMatches]);

  // 카테고리 필터까지 적용된 경기 목록 (연도/대회 선택 UI의 기준 데이터)
  const countryMatchesInCategory = useMemo(() => {
    if (selectedCountryCategory === '전체') return countryMatches;
    return countryMatches.filter(m => m.resolvedCategory === selectedCountryCategory);
  }, [countryMatches, selectedCountryCategory]);

  // 카테고리 필터 안에서 등장하는 연도/대회 목록 (선택 UI용)
  const countryYearsInCategory = useMemo(() => {
    const set = new Set(countryMatchesInCategory.map(m => m.resolvedYear));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [countryMatchesInCategory]);

  const countryTournamentsInCategory = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    countryMatchesInCategory.forEach(m => {
      const id = m.tournamentId || '';
      if (!id) return;
      const cur = map.get(id) || { id, name: m.resolvedTournamentName || '이름 없음', count: 0 };
      cur.count++;
      map.set(id, cur);
    });
    return Array.from(map.values());
  }, [countryMatchesInCategory]);

  // 최종 표시 목록: 카테고리 + (연도 선택 있으면 연도) + (대회 선택 있으면 대회) 순으로 좁힘
  const countryMatchesFiltered = useMemo(() => {
    let list = countryMatchesInCategory;
    if (selectedYears.size > 0) list = list.filter(m => selectedYears.has(m.resolvedYear));
    if (selectedTournamentIds.size > 0) list = list.filter(m => selectedTournamentIds.has(m.tournamentId || ''));
    return list;
  }, [countryMatchesInCategory, selectedYears, selectedTournamentIds]);

  const handleCreate = async () => {
    if (!newName.trim() || !db) return
    try {
      const isoDate = newStartDate ? new Date(newStartDate).toISOString() : new Date().toISOString();
      await TournamentService.createTournament(db, newName, isoDate, newCategory.trim() || selectedCategory || undefined)
      setNewName("")
      setNewCategory("")
      setNewStartDate(new Date().toISOString().slice(0, 10))
      setIsNewDialogOpen(false)
      toast({ title: "새 대회 생성 완료" })
    } catch (e: any) {
      toast({ title: "대회 생성 실패", description: e.message, variant: "destructive" })
    }
  }

  const handleUpdateTournament = async (id: string) => {
    if (!editName.trim() || !db) return
    try {
      const isoDate = editStartDate ? new Date(editStartDate).toISOString() : undefined
      await TournamentService.updateTournament(db, id, editName, editCategory.trim() || "미분류", isoDate)
      setEditingId(null)
      // 수정한 대회가 지금 보고 있는 카테고리에서 다른 카테고리로 옮겨간 경우 목록에서 자연히 빠집니다.
      toast({ title: "대회 정보 수정 완료" })
    } catch (e: any) {
      toast({ title: "수정 실패", description: e.message, variant: "destructive" })
    }
  }

  const startEditingTournament = (t: Tournament) => {
    setEditingId(t.id)
    setEditName(t.name)
    setEditCategory(t.category || "")
    setEditStartDate(t.startDate && !isNaN(new Date(t.startDate).getTime()) ? new Date(t.startDate).toISOString().slice(0, 10) : "")
  }

  const handleParseSchedule = async () => {
    if (!selectedTournament || !db) return;
    const parsed = parseScheduleText(scheduleText);
    if (parsed.length === 0) {
      toast({ title: "인식된 경기가 없어요", description: "표를 그대로 복사해서 붙여넣어주세요.", variant: "destructive" });
      return;
    }
    setIsSavingSchedule(true);
    try {
      await TournamentService.updateSchedule(db, selectedTournament.id, parsed);
      setSelectedTournament(prev => prev ? { ...prev, schedule: parsed } : prev);
      toast({ title: `${parsed.length}경기 일정 반영 완료` });
      setIsScheduleDialogOpen(false);
      setScheduleText("");
    } catch (e: any) {
      toast({ title: "저장 실패", description: e.message, variant: "destructive" });
    } finally {
      setIsSavingSchedule(false);
    }
  }

  // 일정표 배열 전체를 다시 저장하는 공용 헬퍼 — 행 수정/순서변경/삭제가 전부 이걸 씀
  const saveSchedule = async (nextSchedule: ScheduleEntry[]) => {
    if (!selectedTournament || !db) return;
    await TournamentService.updateSchedule(db, selectedTournament.id, nextSchedule);
    setSelectedTournament(prev => prev ? { ...prev, schedule: nextSchedule } : prev);
  }

  const startEditingScheduleRow = (index: number, entry: ScheduleEntry) => {
    setEditingScheduleIndex(index);
    setScheduleRowDraft({ ...entry });
  }

  const handleSaveScheduleRow = async () => {
    if (editingScheduleIndex === null || !scheduleRowDraft || !selectedTournament?.schedule) return;
    setIsSavingScheduleRow(true);
    try {
      const next = [...selectedTournament.schedule];
      next[editingScheduleIndex] = scheduleRowDraft;
      await saveSchedule(next);
      toast({ title: "일정 수정 완료" });
      setEditingScheduleIndex(null);
      setScheduleRowDraft(null);
    } catch (e: any) {
      toast({ title: "수정 실패", description: e.message, variant: "destructive" });
    } finally {
      setIsSavingScheduleRow(false);
    }
  }

  const handleDeleteScheduleRow = async (index: number) => {
    if (!selectedTournament?.schedule) return;
    try {
      const next = selectedTournament.schedule.filter((_, i) => i !== index);
      await saveSchedule(next);
      toast({ title: "일정 삭제 완료" });
    } catch (e: any) {
      toast({ title: "삭제 실패", description: e.message, variant: "destructive" });
    }
  }

  // 일정표 표시 순서를 직접 바꿉니다(matchNumber와는 별개 — 파싱 직후엔 번호순 정렬이지만, 이후엔 이 배열 순서가 곧 표시 순서)
  const handleMoveScheduleRow = async (index: number, direction: 'up' | 'down') => {
    if (!selectedTournament?.schedule) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedTournament.schedule.length) return;
    try {
      const next = [...selectedTournament.schedule];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      await saveSchedule(next);
    } catch (e: any) {
      toast({ title: "순서 변경 실패", description: e.message, variant: "destructive" });
    }
  }

  const handleStartEditDescription = () => {
    setDescriptionDraft(selectedTournament?.description || "");
    setIsEditingDescription(true);
  }

  const handleSaveDescription = async () => {
    if (!selectedTournament || !db) return;
    setIsSavingDescription(true);
    try {
      await TournamentService.updateTournamentDescription(db, selectedTournament.id, descriptionDraft);
      setSelectedTournament(prev => prev ? { ...prev, description: descriptionDraft } : prev);
      setIsEditingDescription(false);
      toast({ title: "대회 개요 저장 완료" });
    } catch (e: any) {
      toast({ title: "저장 실패", description: e.message, variant: "destructive" });
    } finally {
      setIsSavingDescription(false);
    }
  }

  const startEditingTeams = (m: MatchData) => {
    setEditingTeamsMatchId(m.id!);
    setEditHomeName(m.homeTeam.name);
    setEditAwayName(m.awayTeam.name);
  }

  const handleSaveTeamNames = async (matchId: string) => {
    if (!db || !editHomeName.trim() || !editAwayName.trim()) return;
    setIsSavingTeams(true);
    try {
      await TournamentService.updateMatchTeamNames(db, matchId, editHomeName.trim(), editAwayName.trim());
      setEditingTeamsMatchId(null);
      toast({ title: "팀 이름 수정 완료" });
    } catch (e: any) {
      toast({ title: "수정 실패", description: e.message, variant: "destructive" });
    } finally {
      setIsSavingTeams(false);
    }
  }

  // 홈/어웨이를 서로 바꿉니다 — 단순 이름 교체가 아니라, 이미 기록된 이벤트로 스탯을
  // 통째로 재계산해서 새 홈/어웨이 자리에 맞게 넣습니다(집계가 홈/어웨이 자리별로 계산되기 때문).
  const handleSwapHomeAway = async (m: MatchData) => {
    if (!db || !m.id) return;
    setSwappingMatchId(m.id);
    try {
      const swapped = createMatchDataFromUpload(
        m.events,
        m.awayTeam.name,
        m.homeTeam.name,
        m.awayTeam.color,
        m.homeTeam.color,
        m.tournamentName,
        m.matchName
      );
      await TournamentService.updateMatchData(db, m.id, swapped);
      toast({ title: "홈/어웨이 교체 완료" });
    } catch (e: any) {
      toast({ title: "교체 실패", description: e.message, variant: "destructive" });
    } finally {
      setSwappingMatchId(null);
    }
  }

  const handleDeleteTournament = async (id: string) => {
    if (!id || !db) return;
    try {
      await TournamentService.deleteTournament(db, id)
      toast({ title: "대회 삭제 완료" })
    } catch (err: any) {
      toast({ title: "삭제 실패", description: err.message, variant: "destructive" })
    }
  }

  const handleDeleteMatch = async (id: string) => {
    if (!id || !db) return;
    try {
      await TournamentService.deleteMatch(db, id)
      toast({ title: "경기 삭제 완료" })
    } catch (err: any) {
      toast({ title: "삭제 실패", description: err.message, variant: "destructive" })
    }
  }

  const handleUpdateMatchName = async (matchId: string) => {
    if (!editMatchName.trim() || !db) return
    try {
      await TournamentService.updateMatchName(db, matchId, editMatchName)
      setEditingMatchId(null)
      toast({ title: "경기 이름 수정 완료" })
    } catch (e: any) {
      toast({ title: "수정 실패", description: e.message, variant: "destructive" })
    }
  }

  const handleUpdateMatchNumber = async (matchId: string) => {
    if (!db) return
    const trimmed = editMatchNumber.trim();
    const num = trimmed === "" ? null : parseInt(trimmed, 10);
    if (trimmed !== "" && (num === null || isNaN(num))) {
      toast({ title: "숫자만 입력해주세요", variant: "destructive" });
      return;
    }
    try {
      await TournamentService.updateMatchNumber(db, matchId, num)
      setEditingMatchNumberId(null)
      toast({ title: num === null ? "일정 번호 연결 해제" : `일정 #${num}과 연결 완료` })
    } catch (e: any) {
      toast({ title: "연결 실패", description: e.message, variant: "destructive" })
    }
  }

  const openRulesDialog = () => {
    setRulesDraft(selectedTournament?.finalStandingsRules || {});
    setIsRulesDialogOpen(true);
  }

  const handleSaveRules = async () => {
    if (!selectedTournament || !db) return;
    setIsSavingRules(true);
    try {
      // 빈 규칙(승자 순위 미입력)은 저장하지 않음
      const cleaned: Record<string, FinalStandingRule> = {};
      Object.entries(rulesDraft).forEach(([stage, rule]) => {
        if (rule?.winnerRank) cleaned[stage] = { winnerRank: rule.winnerRank, loserRank: rule.loserRank };
      });
      await TournamentService.updateFinalStandingsRules(db, selectedTournament.id, cleaned);
      setSelectedTournament(prev => prev ? { ...prev, finalStandingsRules: cleaned } : prev);
      toast({ title: "최종 순위 규칙 저장 완료" });
      setIsRulesDialogOpen(false);
    } catch (e: any) {
      toast({ title: "저장 실패", description: e.message, variant: "destructive" });
    } finally {
      setIsSavingRules(false);
    }
  }

  const handleMoveOrder = async (matchId: string, currentOrder: number, direction: 'up' | 'down') => {
    if (!db) return;
    const targetOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;
    if (targetOrder < 0 || targetOrder >= currentTournamentMatches.length) return;

    const swapMatch = currentTournamentMatches.find(m => m.orderIndex === targetOrder);
    if (!swapMatch || !swapMatch.id) return;

    try {
      await TournamentService.updateMatchOrder(db, matchId, targetOrder);
      await TournamentService.updateMatchOrder(db, swapMatch.id, currentOrder);
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
    if (!replaceMatchId || !event.target.files || !event.target.files[0] || !db) return;
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
        updatedData.rawSourceText = content;
        updatedData.rawSourceFileName = file.name;
        await TournamentService.updateMatchData(db, replaceMatchId, updatedData);
        toast({ title: "데이터 교체 완료" });
        setReplaceMatchId(null);
      } catch (err: any) {
        toast({ title: "교체 실패", description: err.message, variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  }

  // "미입력 경기 슬롯" — 일정표에 이미 팀이 확정된(참조 미해석 아닌) 경기인데
  // 아직 실제 XML/CSV가 업로드 안 된 행에서 바로 업로드 + matchNumber 연결까지 한번에 처리
  const handleSlotUploadClick = (entry: ResolvedScheduleEntry) => {
    setSlotUploadEntry(entry);
    slotFileInputRef.current?.click();
  }

  const onSlotFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!slotUploadEntry || !event.target.files || !event.target.files[0] || !db || !selectedTournament) return;
    const entry = slotUploadEntry;
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      setIsUploadingSlot(true);
      try {
        const ab = e.target?.result as ArrayBuffer;
        let content = new TextDecoder('utf-8').decode(ab);
        if ((content.match(/�/g) || []).length > 5) content = new TextDecoder('euc-kr').decode(ab);
        const parsed = file.name.endsWith('.xml') ? parseXMLData(content) : parseCSVData(content);
        const matchName = `M${entry.matchNumber} ${entry.homeResolved} vs ${entry.awayResolved}`;
        const newMatchData = createMatchDataFromUpload(
          parsed.events,
          entry.homeResolved,
          entry.awayResolved,
          teamColorMap.get(entry.homeResolved) || "#0066ff",
          teamColorMap.get(entry.awayResolved) || "#ef4444",
          selectedTournament.name,
          matchName
        );
        newMatchData.rawSourceText = content;
        newMatchData.rawSourceFileName = file.name;
        await TournamentService.addMatchToTournament(selectedTournament.id, newMatchData, entry.matchNumber);
        toast({ title: `#${entry.matchNumber} 경기 업로드 및 연결 완료` });
        setSlotUploadEntry(null);
      } catch (err: any) {
        toast({ title: "업로드 실패", description: err.message, variant: "destructive" });
      } finally {
        setIsUploadingSlot(false);
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  }

  if (selectedTournament) {
    const hasSchedule = !!selectedTournament.schedule && selectedTournament.schedule.length > 0;
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedTournament(null)}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-3xl font-black italic text-primary uppercase tracking-tighter break-words">{selectedTournament.name}<span className="hidden sm:inline"> - Match Management</span></h2>
            <p className="text-muted-foreground font-bold text-sm sm:text-base">경기 순서 조정 및 분석 바로가기</p>
          </div>
          {knockoutStageLabels.length > 0 && (
            <Dialog open={isRulesDialogOpen} onOpenChange={setIsRulesDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="font-bold" onClick={openRulesDialog}><Settings2 className="h-4 w-4 mr-2" /> 최종순위 규칙</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>최종 순위 규칙</DialogTitle>
                  <DialogDescription>이 스테이지의 승자/패자가 각각 몇 위가 되는지 지정하세요. 예: "Final" 승자=1위 패자=2위, "3/4" 승자=3위 패자=4위. 순위가 정해지지 않는 스테이지(예: SF)는 비워두세요.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {knockoutStageLabels.map(stage => (
                    <div key={stage} className="flex items-center gap-2">
                      <span className="w-24 text-sm font-bold truncate" title={stage}>{stage}</span>
                      <Input
                        type="number"
                        placeholder="승자 순위"
                        className="h-8 text-xs"
                        value={rulesDraft[stage]?.winnerRank ?? ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? undefined : parseInt(e.target.value, 10);
                          setRulesDraft(prev => ({ ...prev, [stage]: { ...prev[stage], winnerRank: v } }));
                        }}
                      />
                      <Input
                        type="number"
                        placeholder="패자 순위(선택)"
                        className="h-8 text-xs"
                        value={rulesDraft[stage]?.loserRank ?? ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? undefined : parseInt(e.target.value, 10);
                          setRulesDraft(prev => ({ ...prev, [stage]: { ...prev[stage], loserRank: v } }));
                        }}
                      />
                    </div>
                  ))}
                </div>
                <DialogFooter>
                  <Button onClick={handleSaveRules} disabled={isSavingRules} className="font-bold">{isSavingRules ? "저장 중..." : "저장"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="font-bold"><CalendarClock className="h-4 w-4 mr-2" /> 일정표 붙여넣기</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>일정표 붙여넣기</DialogTitle>
                <DialogDescription>TMS 등에서 "Match Listing" 표를 그대로 복사해서 붙여넣으세요. 확정 안 된 팀("Winner 47", "3rd Pool B")도 그대로 인식돼요.</DialogDescription>
              </DialogHeader>
              <Textarea value={scheduleText} onChange={(e) => setScheduleText(e.target.value)} className="h-64 font-mono text-xs" placeholder="Match #	Date/Time	Details	Scoreline	Status	Venue..." />
              <DialogFooter>
                <Button onClick={handleParseSchedule} disabled={isSavingSchedule} className="font-bold">{isSavingSchedule ? "저장 중..." : "파싱 및 저장"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <Card className="border-2 shadow-sm">
          <CardContent className="p-4">
            {isEditingDescription ? (
              <div className="space-y-2">
                <Textarea value={descriptionDraft} onChange={(e) => setDescriptionDraft(e.target.value)} className="text-sm min-h-24" placeholder="대회 개요를 적어주세요 (참가팀, 방식, 일정 등 자유롭게)" autoFocus />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setIsEditingDescription(false)}>취소</Button>
                  <Button size="sm" onClick={handleSaveDescription} disabled={isSavingDescription} className="font-bold">{isSavingDescription ? "저장 중..." : "저장"}</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3 group">
                {selectedTournament.description ? (
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground flex-1">{selectedTournament.description}</p>
                ) : (
                  <p className="text-sm italic text-muted-foreground/60 flex-1">대회 개요가 아직 없어요 — 참가팀, 방식 등을 적어두면 여기 표시됩니다.</p>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100" onClick={handleStartEditDescription}><Edit3 className="h-3.5 w-3.5" /></Button>
              </div>
            )}
          </CardContent>
        </Card>
        <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept=".xml,.csv" />
        <input type="file" ref={slotFileInputRef} onChange={onSlotFileChange} className="hidden" accept=".xml,.csv" />

        {selectedTournament.schedule && selectedTournament.schedule.length > 0 && (
          <Card className="border-2 shadow-xl">
            <CardHeader className="bg-muted/10 border-b flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" /> 경기 일정 ({selectedTournament.schedule.length})</CardTitle>
              <div className="flex items-center gap-3 text-[11px] font-bold">
                <span className="text-emerald-600">완료 {scheduleUploadSummary.done}</span>
                <span className="text-amber-600">대기중 {scheduleUploadSummary.pending}</span>
                <span className="text-muted-foreground">미정 {scheduleUploadSummary.undetermined}</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow className="bg-muted/20"><TableHead className="w-10 text-center">#</TableHead><TableHead className="text-xs font-black uppercase">일시</TableHead><TableHead className="text-xs font-black uppercase">대진</TableHead><TableHead className="text-xs font-black uppercase text-center">스테이지</TableHead><TableHead className="text-xs font-black uppercase text-center">스코어</TableHead><TableHead className="text-xs font-black uppercase text-center">상태</TableHead><TableHead className="text-xs font-black uppercase text-center">데이터</TableHead><TableHead className="text-right pr-4 font-black uppercase text-xs">관리</TableHead></TableRow></TableHeader>
                <TableBody>
                  {resolvedSchedule.map((s, index) => {
                    const isLinked = linkedMatchNumbers.has(s.matchNumber);
                    const teamsConfirmed = !s.homeIsRef && !s.awayIsRef;
                    if (editingScheduleIndex === index && scheduleRowDraft) {
                      return (
                        <TableRow key={s.matchNumber}>
                          <TableCell colSpan={8} className="py-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <div className="space-y-1"><Label className="text-[10px]">Match #</Label><Input type="number" className="h-8 text-xs" value={scheduleRowDraft.matchNumber} onChange={(e) => setScheduleRowDraft({ ...scheduleRowDraft, matchNumber: parseInt(e.target.value, 10) || 0 })} /></div>
                              <div className="space-y-1"><Label className="text-[10px]">일시</Label><Input className="h-8 text-xs" value={scheduleRowDraft.dateTime} onChange={(e) => setScheduleRowDraft({ ...scheduleRowDraft, dateTime: e.target.value })} /></div>
                              <div className="space-y-1"><Label className="text-[10px]">홈</Label><Input className="h-8 text-xs" value={scheduleRowDraft.homeRef} onChange={(e) => setScheduleRowDraft({ ...scheduleRowDraft, homeRef: e.target.value })} /></div>
                              <div className="space-y-1"><Label className="text-[10px]">어웨이</Label><Input className="h-8 text-xs" value={scheduleRowDraft.awayRef} onChange={(e) => setScheduleRowDraft({ ...scheduleRowDraft, awayRef: e.target.value })} /></div>
                              <div className="space-y-1"><Label className="text-[10px]">스테이지</Label><Input className="h-8 text-xs" value={scheduleRowDraft.stage} onChange={(e) => setScheduleRowDraft({ ...scheduleRowDraft, stage: e.target.value })} /></div>
                              <div className="space-y-1"><Label className="text-[10px]">스코어</Label><Input className="h-8 text-xs" value={scheduleRowDraft.score || ''} onChange={(e) => setScheduleRowDraft({ ...scheduleRowDraft, score: e.target.value })} /></div>
                              <div className="space-y-1"><Label className="text-[10px]">상태</Label><Input className="h-8 text-xs" value={scheduleRowDraft.status || ''} onChange={(e) => setScheduleRowDraft({ ...scheduleRowDraft, status: e.target.value })} /></div>
                              <div className="space-y-1"><Label className="text-[10px]">경기장</Label><Input className="h-8 text-xs" value={scheduleRowDraft.venue || ''} onChange={(e) => setScheduleRowDraft({ ...scheduleRowDraft, venue: e.target.value })} /></div>
                            </div>
                            <div className="flex justify-end gap-2 mt-2">
                              <Button size="sm" variant="ghost" onClick={() => { setEditingScheduleIndex(null); setScheduleRowDraft(null); }}>취소</Button>
                              <Button size="sm" onClick={handleSaveScheduleRow} disabled={isSavingScheduleRow} className="font-bold">{isSavingScheduleRow ? "저장 중..." : "저장"}</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    return (
                      <TableRow key={s.matchNumber} className={(s.homeIsRef || s.awayIsRef) ? 'opacity-60' : ''}>
                        <TableCell className="text-center text-xs text-muted-foreground">{s.matchNumber}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{s.dateTime}</TableCell>
                        <TableCell className="text-sm font-bold">{s.homeResolved} v {s.awayResolved}</TableCell>
                        <TableCell className="text-center text-xs">{s.stage}</TableCell>
                        <TableCell className="text-center text-xs font-mono">{s.score || '-'}</TableCell>
                        <TableCell className="text-center text-[10px] uppercase font-bold text-muted-foreground">{s.status}</TableCell>
                        <TableCell className="text-center">
                          {isLinked ? (
                            <span className="text-[10px] font-bold text-emerald-600 uppercase">완료</span>
                          ) : teamsConfirmed ? (
                            <Button
                              size="sm" variant="outline"
                              className="h-7 text-[10px] font-bold border-amber-500 text-amber-600 hover:bg-amber-50"
                              disabled={isUploadingSlot}
                              onClick={() => handleSlotUploadClick(s)}
                            ><Video className="h-3 w-3 mr-1" /> {isUploadingSlot && slotUploadEntry?.matchNumber === s.matchNumber ? "업로드 중..." : "대기중"}</Button>
                          ) : (
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">미정</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button size="icon" variant="ghost" className="h-6 w-6" disabled={index === 0} onClick={() => handleMoveScheduleRow(index, 'up')}><ArrowUp className="h-3 w-3" /></Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" disabled={index === resolvedSchedule.length - 1} onClick={() => handleMoveScheduleRow(index, 'down')}><ArrowDown className="h-3 w-3" /></Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEditingScheduleRow(index, selectedTournament.schedule![index])}><Edit3 className="h-3 w-3" /></Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => handleDeleteScheduleRow(index)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {finalStandings.length > 0 && (
          <Card className="border-2 shadow-xl">
            <CardHeader className="bg-muted/10 border-b"><CardTitle className="text-lg flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /> 최종 순위</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  {finalStandings.map((r) => (
                    <TableRow key={`${r.rank}-${r.team}`}>
                      <TableCell className="w-14 text-center font-black text-primary">{r.rank}</TableCell>
                      <TableCell className="font-bold">{r.team}</TableCell>
                      <TableCell className="text-right pr-6 text-xs text-muted-foreground">{r.stage}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {Object.keys(poolStandings).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(poolStandings).sort(([a], [b]) => a.localeCompare(b)).map(([pool, rows]) => (
              <Card key={pool} className="border-2 shadow-xl">
                <CardHeader className="bg-muted/10 border-b py-3"><CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> Pool {pool} 순위표</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20">
                        <TableHead className="w-8 text-center">#</TableHead>
                        <TableHead className="font-black uppercase text-xs">팀</TableHead>
                        <TableHead className="text-center font-black uppercase text-xs">P</TableHead>
                        <TableHead className="text-center font-black uppercase text-xs">GD</TableHead>
                        <TableHead className="text-center font-black uppercase text-xs">Pts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((t, idx) => (
                        <TableRow key={t.team} className={idx % 2 === 0 ? '' : 'bg-muted/5'}>
                          <TableCell className="text-center text-xs text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-bold text-sm">{t.team}</TableCell>
                          <TableCell className="text-center text-xs">{t.p}</TableCell>
                          <TableCell className="text-center text-xs">{t.gd > 0 ? `+${t.gd}` : t.gd}</TableCell>
                          <TableCell className="text-center font-black text-primary text-xs">{t.pts}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {standings.length > 1 && (
          <Card className="border-2 shadow-xl">
            <CardHeader className="bg-muted/10 border-b"><CardTitle className="text-lg flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /> 전체 순위표</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead className="w-10 text-center">#</TableHead>
                    <TableHead className="font-black uppercase text-xs">팀</TableHead>
                    <TableHead className="text-center font-black uppercase text-xs">P</TableHead>
                    <TableHead className="text-center font-black uppercase text-xs">W</TableHead>
                    <TableHead className="text-center font-black uppercase text-xs">D</TableHead>
                    <TableHead className="text-center font-black uppercase text-xs">L</TableHead>
                    <TableHead className="text-center font-black uppercase text-xs">GF</TableHead>
                    <TableHead className="text-center font-black uppercase text-xs">GA</TableHead>
                    <TableHead className="text-center font-black uppercase text-xs">GD</TableHead>
                    <TableHead className="text-center font-black uppercase text-xs">Pts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standings.map((t, idx) => (
                    <TableRow key={t.team} className={idx % 2 === 0 ? '' : 'bg-muted/5'}>
                      <TableCell className="text-center text-xs text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-bold">{t.team}</TableCell>
                      <TableCell className="text-center">{t.p}</TableCell>
                      <TableCell className="text-center">{t.w}</TableCell>
                      <TableCell className="text-center">{t.d}</TableCell>
                      <TableCell className="text-center">{t.l}</TableCell>
                      <TableCell className="text-center">{t.gf}</TableCell>
                      <TableCell className="text-center">{t.ga}</TableCell>
                      <TableCell className="text-center">{t.gd > 0 ? `+${t.gd}` : t.gd}</TableCell>
                      <TableCell className="text-center font-black text-primary">{t.pts}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card className="border-2 shadow-xl">
          <CardHeader className="bg-muted/10 border-b"><CardTitle className="text-lg flex items-center gap-2"><Database className="h-5 w-5 text-primary" /> 등록된 경기 ({currentTournamentMatches.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
             <Table>
                <TableHeader><TableRow className="bg-muted/20"><TableHead className="w-16 text-center">순서</TableHead><TableHead className="pl-6 font-black uppercase text-xs">Match Name</TableHead><TableHead className="text-center font-black uppercase text-xs">Score</TableHead>{hasSchedule && <TableHead className="text-center font-black uppercase text-xs">일정#</TableHead>}<TableHead className="text-right pr-6 font-black uppercase text-xs">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {currentTournamentMatches.length === 0 ? (
                    <TableRow><TableCell colSpan={hasSchedule ? 5 : 4} className="text-center py-20 text-muted-foreground italic">등록된 경기가 없습니다.</TableCell></TableRow>
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
                                {editingTeamsMatchId === m.id ? (
                                  <div className="flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                                    <Input value={editHomeName} onChange={(e) => setEditHomeName(e.target.value)} className="h-7 w-28 text-xs" onKeyDown={(e) => e.key === 'Enter' && handleSaveTeamNames(m.id!)} autoFocus />
                                    <span className="text-[10px] text-muted-foreground">vs</span>
                                    <Input value={editAwayName} onChange={(e) => setEditAwayName(e.target.value)} className="h-7 w-28 text-xs" onKeyDown={(e) => e.key === 'Enter' && handleSaveTeamNames(m.id!)} />
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" disabled={isSavingTeams} onClick={() => handleSaveTeamNames(m.id!)}><Save className="h-3.5 w-3.5" /></Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setEditingTeamsMatchId(null)}><X className="h-3.5 w-3.5" /></Button>
                                  </div>
                                ) : (
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase">{m.homeTeam.name} vs {m.awayTeam.name}</p>
                                )}
                              </div>
                              {editingTeamsMatchId !== m.id && (
                                <div className="flex items-center opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" title="경기명 수정" onClick={() => { setEditingMatchId(m.id!); setEditMatchName(m.matchName || ""); }}><Edit3 className="h-3 w-3" /></Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" title="팀 이름 수정" onClick={() => startEditingTeams(m)}><Users className="h-3 w-3" /></Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" title="홈/어웨이 바꾸기" disabled={swappingMatchId === m.id} onClick={() => handleSwapHomeAway(m)}><RefreshCw className={`h-3 w-3 ${swappingMatchId === m.id ? 'animate-spin' : ''}`} /></Button>
                                </div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center"><span className="font-black text-primary bg-primary/10 px-3 py-1 rounded-full text-sm">{(m.matchStats.home.goals.field + m.matchStats.home.goals.pc)} : {(m.matchStats.away.goals.field + m.matchStats.away.goals.pc)}</span></TableCell>
                        {hasSchedule && (
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            {editingMatchNumberId === m.id ? (
                              <div className="flex items-center justify-center gap-1">
                                <Input type="number" value={editMatchNumber} onChange={(e) => setEditMatchNumber(e.target.value)} className="h-8 w-16 text-xs text-center" onKeyDown={(e) => e.key === 'Enter' && handleUpdateMatchNumber(m.id!)} autoFocus />
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={() => handleUpdateMatchNumber(m.id!)}><Save className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setEditingMatchNumberId(null)}><X className="h-4 w-4" /></Button>
                              </div>
                            ) : (
                              <Button
                                variant="outline" size="sm"
                                className={`h-7 text-xs font-bold ${typeof m.matchNumber === 'number' ? 'border-emerald-600 text-emerald-600' : 'border-muted-foreground/40 text-muted-foreground'}`}
                                onClick={() => { setEditingMatchNumberId(m.id!); setEditMatchNumber(typeof m.matchNumber === 'number' ? String(m.matchNumber) : ""); }}
                              ><Link2 className="h-3 w-3 mr-1" /> {typeof m.matchNumber === 'number' ? `#${m.matchNumber}` : '연결'}</Button>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-right pr-6 space-x-2" onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="sm" className={`h-8 text-xs font-bold ${m.videoMatchId ? 'border-orange-500 text-orange-500 hover:bg-orange-50' : 'border-muted-foreground/40 text-muted-foreground hover:bg-muted/50'}`} onClick={() => setVideoLinkMatch(m)}><Video className="h-3 w-3 mr-1" /> 영상</Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs font-bold border-emerald-600 text-emerald-600 hover:bg-emerald-50" onClick={(e) => handleReplaceFile(e, m.id!)}><RefreshCw className="h-3 w-3 mr-1" /> 교체</Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>경기를 삭제하시겠습니까?</AlertDialogTitle>
                                <AlertDialogDescription>이 작업은 되돌릴 수 없습니다. 해당 경기 데이터가 영구적으로 삭제됩니다.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteMatch(m.id!)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
             </Table>
          </CardContent>
        </Card>
        <VideoLinkDialog match={videoLinkMatch} open={!!videoLinkMatch} onOpenChange={(o) => !o && setVideoLinkMatch(null)} />
      </div>
    )
  }

  const renderNewTournamentDialog = () => (
    <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
      <DialogTrigger asChild><Button className="shadow-lg h-11 px-6 font-bold"><Plus className="mr-2 h-5 w-5" /> 새 대회 추가</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>새 대회 생성</DialogTitle></DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2"><Label>대회 이름</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="예: 2024 파리 올림픽" onKeyDown={(e) => e.key === 'Enter' && handleCreate()} /></div>
          <div className="space-y-2">
            <Label>카테고리 (예: 여자대표팀)</Label>
            <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder={selectedCategory || "예: 여자대표팀"} />
          </div>
          <div className="space-y-2"><Label>대회 시작일</Label><Input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={handleCreate} className="font-bold">생성하기</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const renderViewToggle = () => (
    <div className="flex p-1 bg-muted/40 rounded-lg w-fit gap-1">
      <Button
        variant={viewBy === 'category' ? 'default' : 'ghost'} size="sm"
        onClick={() => { setViewBy('category'); setSelectedCountry(null); }}
        className="h-8 text-xs font-bold"
      >카테고리별</Button>
      <Button
        variant={viewBy === 'country' ? 'default' : 'ghost'} size="sm"
        onClick={() => { setViewBy('country'); setSelectedCategory(null); }}
        className="h-8 text-xs font-bold"
      >국가별</Button>
    </div>
  )

  // 국가별 보기: 선택된 국가가 출전한 모든 경기를 대회 가로질러 모아보기
  if (viewBy === 'country') {
    if (selectedCountry) {
      const toggleInSet = (setter: typeof setSelectedYears, current: Set<string>, value: string) => {
        const next = new Set(current);
        if (next.has(value)) next.delete(value); else next.add(value);
        setter(next);
      };

      return (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={() => { setSelectedCountry(null); setSelectedCountryCategory('전체'); setSelectedYears(new Set()); setSelectedTournamentIds(new Set()); }}>
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-3xl font-black italic text-primary uppercase tracking-tighter break-words">{selectedCountry}</h2>
              <p className="text-muted-foreground font-bold text-sm sm:text-base">{countryMatchesFiltered.length} / {countryMatches.length}경기 표시 중</p>
            </div>
            {onViewCumulative && countryMatchesFiltered.length > 0 && (
              <Button
                className="font-bold"
                onClick={() => onViewCumulative(countryMatchesFiltered, `${selectedCountry} 누적분석 (${countryMatchesFiltered.length}경기)`)}
              >
                <Database className="h-4 w-4 mr-2" /> 이 경기들로 누적분석 보기
              </Button>
            )}
          </div>

          {/* 카테고리 필터: 여자대표팀/남자대표팀 등 */}
          {countryCategories.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {['전체', ...countryCategories].map(cat => (
                <Button
                  key={cat}
                  size="sm"
                  variant={selectedCountryCategory === cat ? 'default' : 'outline'}
                  className="h-8 text-xs font-bold"
                  onClick={() => { setSelectedCountryCategory(cat); setSelectedYears(new Set()); setSelectedTournamentIds(new Set()); }}
                >{cat}</Button>
              ))}
            </div>
          )}

          {/* 연도 다중 선택 */}
          {countryYearsInCategory.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase mr-1">연도</span>
              {countryYearsInCategory.map(year => (
                <Button
                  key={year}
                  size="sm"
                  variant={selectedYears.has(year) ? 'default' : 'outline'}
                  className="h-7 text-[11px] font-bold px-2.5"
                  onClick={() => toggleInSet(setSelectedYears, selectedYears, year)}
                >{year}</Button>
              ))}
              {selectedYears.size > 0 && (
                <Button size="sm" variant="ghost" className="h-7 text-[11px] text-muted-foreground" onClick={() => setSelectedYears(new Set())}>초기화</Button>
              )}
            </div>
          )}

          {/* 대회 다중 선택 */}
          {countryTournamentsInCategory.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase mr-1">대회</span>
              {countryTournamentsInCategory.map(t => (
                <Button
                  key={t.id}
                  size="sm"
                  variant={selectedTournamentIds.has(t.id) ? 'default' : 'outline'}
                  className="h-7 text-[11px] font-bold px-2.5"
                  onClick={() => toggleInSet(setSelectedTournamentIds, selectedTournamentIds, t.id)}
                >{t.name} ({t.count})</Button>
              ))}
              {selectedTournamentIds.size > 0 && (
                <Button size="sm" variant="ghost" className="h-7 text-[11px] text-muted-foreground" onClick={() => setSelectedTournamentIds(new Set())}>초기화</Button>
              )}
            </div>
          )}

          <Card className="border-2 shadow-xl">
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow className="bg-muted/20"><TableHead className="pl-6 font-black uppercase text-xs">대회</TableHead><TableHead className="font-black uppercase text-xs">경기</TableHead><TableHead className="text-center font-black uppercase text-xs">스코어</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {countryMatchesFiltered.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">조건에 맞는 경기가 없습니다.</TableCell></TableRow>
                  ) : (
                    countryMatchesFiltered.map((m, idx) => {
                      const isHome = m.homeTeam?.name === selectedCountry;
                      const opponent = isHome ? m.awayTeam?.name : m.homeTeam?.name;
                      const myGoals = isHome ? m.matchStats.home.goals.field + m.matchStats.home.goals.pc : m.matchStats.away.goals.field + m.matchStats.away.goals.pc;
                      const oppGoals = isHome ? m.matchStats.away.goals.field + m.matchStats.away.goals.pc : m.matchStats.home.goals.field + m.matchStats.home.goals.pc;
                      return (
                        <TableRow key={m.id || idx} className="hover:bg-muted/5 cursor-pointer group" onClick={() => editingMatchId !== m.id && onViewMatch?.(m)}>
                          <TableCell className="pl-6 text-xs text-muted-foreground font-bold">{m.resolvedTournamentName || '-'}</TableCell>
                          <TableCell>
                            {editingMatchId === m.id ? (
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <Input value={editMatchName} onChange={(e) => setEditMatchName(e.target.value)} className="h-8 text-sm font-bold" onKeyDown={(e) => e.key === 'Enter' && handleUpdateMatchName(m.id!)} autoFocus />
                                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-emerald-600" onClick={() => handleUpdateMatchName(m.id!)}><Save className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" onClick={() => setEditingMatchId(null)}><X className="h-4 w-4" /></Button>
                              </div>
                            ) : (
                              <>
                                <p className="font-bold text-base flex items-center gap-2">{m.matchName || `${m.homeTeam?.name} vs ${m.awayTeam?.name}`} <Eye className="h-3 w-3 opacity-0 group-hover:opacity-100" /></p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">{selectedCountry} vs {opponent}</p>
                              </>
                            )}
                          </TableCell>
                          <TableCell className="text-center"><span className="font-black text-primary bg-primary/10 px-3 py-1 rounded-full text-sm">{myGoals} : {oppGoals}</span></TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()} className="whitespace-nowrap">
                            {editingMatchId !== m.id && (
                              <>
                                <Button size="icon" variant="ghost" className={`h-8 w-8 ${m.videoMatchId ? 'text-orange-500' : 'opacity-0 group-hover:opacity-100'}`} onClick={() => setVideoLinkMatch(m)}><Video className="h-3.5 w-3.5" /></Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={() => { setEditingMatchId(m.id!); setEditMatchName(m.matchName || ""); }}><Edit3 className="h-3.5 w-3.5" /></Button>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <VideoLinkDialog match={videoLinkMatch} open={!!videoLinkMatch} onOpenChange={(o) => !o && setVideoLinkMatch(null)} />
        </div>
      )
    }
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div><h2 className="text-3xl font-black italic text-primary uppercase tracking-tighter">Tournament Master</h2><p className="text-muted-foreground font-bold">국가를 선택해 전체 대회의 경기를 확인하세요</p></div>
        </div>
        {renderViewToggle()}
        {countries.length === 0 ? (
          <p className="text-center py-20 text-muted-foreground italic">경기 데이터가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {countries.map((c) => (
              <Card
                key={c.name}
                className="border-2 shadow-sm hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer"
                onClick={() => { setSelectedCountry(c.name); setSelectedCountryCategory('전체'); setSelectedYears(new Set()); setSelectedTournamentIds(new Set()); }}
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="bg-primary/10 p-3 rounded-xl"><Trophy className="h-6 w-6 text-primary" /></div>
                  <div>
                    <p className="font-black text-lg tracking-tight">{c.name}</p>
                    <p className="text-xs text-muted-foreground font-bold">{c.count}경기 출전</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }

  // 2단계: 카테고리 안에서 대회 목록 (연도별 그룹)
  if (selectedCategory) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => setSelectedCategory(null)}>
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-3xl font-black italic text-primary uppercase tracking-tighter break-words">{selectedCategory}</h2>
              <p className="text-muted-foreground font-bold text-sm sm:text-base">연도별 대회 목록</p>
            </div>
          </div>
          {renderNewTournamentDialog()}
        </div>

        {loadingTourneys ? (
          <p className="text-center py-20 text-muted-foreground italic">데이터 로딩 중...</p>
        ) : tournamentsByYear.length === 0 ? (
          <p className="text-center py-20 text-muted-foreground italic">이 카테고리에 등록된 대회가 없습니다.</p>
        ) : (
          tournamentsByYear.map(({ year, tournaments: yearTournaments }) => (
            <div key={year} className="space-y-2">
              <h3 className="text-sm font-black text-muted-foreground uppercase tracking-widest">{year}</h3>
              <Card className="border-2 shadow-sm">
                <CardContent className="p-0">
                  <Table>
                    <TableBody>
                      {yearTournaments.map((t) => (
                        <TableRow key={t.id} className="hover:bg-muted/5 transition-all group cursor-pointer" onClick={() => setSelectedTournament(t)}>
                          <TableCell className="pl-6 w-[40%]">
                            {editingId === t.id ? (
                              <div className="flex flex-col gap-1.5 py-1" onClick={(e) => e.stopPropagation()}>
                                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm font-bold" placeholder="대회 이름" onKeyDown={(e) => e.key === 'Enter' && handleUpdateTournament(t.id)} autoFocus />
                                <div className="flex gap-1.5">
                                  <Input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="h-8 text-xs" placeholder="카테고리 (예: 여자대표팀)" />
                                  <Input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} className="h-8 text-xs" />
                                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-emerald-600" onClick={() => handleUpdateTournament(t.id)}><Save className="h-4 w-4" /></Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2"><span className="font-black text-lg tracking-tight">{t.name}</span><ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" /></div>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground font-medium">
                            {t.startDate && !isNaN(new Date(t.startDate).getTime()) ? new Date(t.startDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' }) : '-'}
                          </TableCell>
                          <TableCell className="text-center"><div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 rounded-full text-primary font-black text-xs uppercase"><Database className="h-3.5 w-3.5" /> {t.matchCount} Matches</div></TableCell>
                          <TableCell className="text-right pr-6 space-x-1" onClick={(e) => e.stopPropagation()}>
                            <Button size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); startEditingTournament(t); }}><Edit3 className="h-4 w-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>대회를 삭제하시겠습니까?</AlertDialogTitle>
                                  <AlertDialogDescription>이 작업은 되돌릴 수 없습니다. 대회와 포함된 모든 경기 데이터가 영구적으로 삭제됩니다.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>취소</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteTournament(t.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          ))
        )}
      </div>
    )
  }

  // 1단계(기본 화면): 카테고리 선택
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h2 className="text-3xl font-black italic text-primary uppercase tracking-tighter">Tournament Master</h2><p className="text-muted-foreground font-bold">카테고리를 선택해 대회 목록을 확인하세요</p></div>
        {renderNewTournamentDialog()}
      </div>
      {renderViewToggle()}
      {loadingTourneys ? (
        <p className="text-center py-20 text-muted-foreground italic">데이터 로딩 중...</p>
      ) : categories.length === 0 ? (
        <p className="text-center py-20 text-muted-foreground italic">등록된 대회가 없습니다. "새 대회 추가"로 시작하세요.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((c) => (
            <Card
              key={c.name}
              className="border-2 shadow-sm hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer"
              onClick={() => setSelectedCategory(c.name)}
            >
              <CardContent className="p-6 flex items-center gap-4">
                <div className="bg-primary/10 p-3 rounded-xl"><Users className="h-6 w-6 text-primary" /></div>
                <div>
                  <p className="font-black text-lg tracking-tight">{c.name}</p>
                  <p className="text-xs text-muted-foreground font-bold">{c.count}개 대회</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
