
"use client"

import React, { useState, useRef, useEffect } from "react"
import { 
  Upload, FileDown, TrendingDown, Target, Activity, ShieldCheck, 
  Sword, Shield, Trophy, Save, Plus, BrainCircuit, Loader2, Sparkles, Info, MessageSquare, Video
} from "lucide-react"
import type { MatchData, MatchEvent, Tournament } from "@/lib/types"
import { mockMatchData } from "@/lib/data"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { StatsCard } from "./stats-card"
import { PressureBattleChart } from "./pressure-battle-chart"
import { PressureAnalysisMap } from "./pressure-analysis-map"
import { CircleEntryAnalysis } from "./circle-entry-analysis"
import { BasicMatchStats } from "./basic-match-stats"
import { AttackThreatChart } from "./attack-threat-chart"
import { QuarterlyStatsTable } from "./quarterly-stats-table"
import { BuildUpEfficiencyChart } from "./build-up-efficiency-chart"
import { MatchTrajectoryChart } from "./match-trajectory-chart"
import { TournamentDashboard } from "./tournament-dashboard"
import { TournamentManager } from "./tournament-manager"
import { parseXMLData, parseCSVData, createMatchDataFromUpload } from "@/lib/parser"
import { TournamentService } from "@/lib/tournament-service"
import { db } from "@/lib/firebase"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { analyzeMatch, type MatchAnalysisOutput } from "@/ai/flows/match-analysis-flow"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

export function Dashboard() {
  const [viewMode, setViewMode] = useState<'single' | 'tournament' | 'manage'>('single')
  const [matchData, setMatchData] = useState<MatchData | null>(null)
  const [parsedEvents, setParsedEvents] = useState<MatchEvent[]>([])
  const [detectedTeams, setDetectedTeams] = useState<string[]>([])
  const [homeTeamName, setHomeTeamName] = useState("")
  const [awayTeamName, setAwayTeamName] = useState("")
  
  const [tournamentName, setTournamentName] = useState("")
  const [matchName, setMatchName] = useState("")
  const [homeColor, setHomeColor] = useState("#0066ff") 
  const [awayColor, setAwayColor] = useState("#ef4444") 

  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [activeTournamentId, setActiveTournamentId] = useState<string>("")
  const [isNewTournamentDialogOpen, setIsNewTournamentDialogOpen] = useState(false)
  const [newTournamentName, setNewTournamentName] = useState("")

  const [aiAnalysis, setAiAnalysis] = useState<MatchAnalysisOutput | null>(null)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [researcherComment, setResearcherComment] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const fetchTournaments = async () => {
    try {
      const list = await TournamentService.getTournaments();
      setTournaments(list);
    } catch (e) {
      console.error("Failed to fetch tournaments", e);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, [viewMode])

  useEffect(() => {
    if (parsedEvents.length > 0 && homeTeamName && awayTeamName) {
      const newData = createMatchDataFromUpload(
        parsedEvents,
        homeTeamName,
        awayTeamName,
        homeColor,
        awayColor,
        tournamentName,
        matchName
      );
      setMatchData(newData);
      setAiAnalysis(null);
      setResearcherComment("");
    }
  }, [parsedEvents, homeTeamName, awayTeamName, homeColor, awayColor, tournamentName, matchName]);

  const handleAiAnalysis = async () => {
    if (!matchData) return;
    setIsAiLoading(true);
    try {
      const sanitizedStats = JSON.parse(JSON.stringify(matchData));
      const result = await analyzeMatch({
        type: 'single',
        matchName: matchData.matchName,
        homeTeam: { name: matchData.homeTeam.name },
        awayTeam: { name: matchData.awayTeam.name },
        stats: sanitizedStats 
      });
      setAiAnalysis(result);
      toast({ title: "AI 전술 분석 완료" });
    } catch (e: any) {
      toast({ title: "AI 분석 실패", description: e.message, variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleCreateTournament = async () => {
    if (!newTournamentName.trim()) {
      toast({ title: "대회 이름을 입력해주세요.", variant: "destructive" });
      return;
    }
    try {
      const id = await TournamentService.createTournament(db, newTournamentName, new Date().toISOString());
      await fetchTournaments();
      setActiveTournamentId(id);
      setTournamentName(newTournamentName);
      setIsNewTournamentDialogOpen(false);
      setNewTournamentName("");
      toast({ title: "대회 생성 완료" });
    } catch (e: any) {
      toast({ title: "대회 생성 실패", description: e.message, variant: "destructive" });
    }
  }

  const handleSaveToDB = async () => {
    if (!matchData) {
      toast({ title: "데이터를 먼저 업로드하세요.", variant: "destructive" });
      return;
    }
    if (!activeTournamentId) {
      toast({ title: "저장할 대회를 먼저 선택해주세요.", variant: "destructive" });
      return;
    }
    try {
      await TournamentService.addMatchToTournament(activeTournamentId, matchData);
      toast({ title: "저장 완료" });
    } catch (e: any) {
      toast({ title: "저장 실패", description: e.message, variant: "destructive" });
    }
  }

  const handleLoadMockData = () => {
    setParsedEvents(mockMatchData.events);
    const uniqueTeams = Array.from(new Set(mockMatchData.events.map(e => e.team.trim()))).filter(Boolean);
    setDetectedTeams(uniqueTeams);
    setHomeTeamName(mockMatchData.homeTeam.name);
    setAwayTeamName(mockMatchData.awayTeam.name);
    setTournamentName("데모 대회");
    setMatchName("Korea vs Netherlands (Demo)");
    setResearcherComment("");
    toast({ title: "데모 데이터 로드됨" });
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const detectedMatchName = file.name.replace(/\.[^/.]+$/, "");
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const ab = e.target?.result as ArrayBuffer;
          let content = new TextDecoder('utf-8').decode(ab);
          if ((content.match(/\ufffd/g) || []).length > 5) content = new TextDecoder('euc-kr').decode(ab);

          const parsed = file.name.endsWith('.xml') ? parseXMLData(content) : parseCSVData(content);
          setParsedEvents(parsed.events);
          setDetectedTeams(Array.from(new Set(parsed.events.map(e => e.team.trim()))).filter(Boolean).sort());
          setHomeTeamName(parsed.teams.home);
          setAwayTeamName(parsed.teams.away);
          setMatchName(detectedMatchName);
          toast({ title: "데이터 로드 완료" });
        } catch (error: any) {
          toast({ title: "오류 발생", description: error.message, variant: "destructive" });
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }

  const handleViewMatchFromDB = (data: MatchData) => {
    setMatchData(data);
    setTournamentName(data.tournamentName || "");
    setMatchName(data.matchName || "");
    setViewMode('single');
    setAiAnalysis(null);
    setResearcherComment("");
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 print-hidden gap-4">
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-bold text-primary italic tracking-tight font-headline">Field Focus</h1>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 border-orange-500 text-orange-500 font-bold hover:bg-orange-500/10"
              onClick={() => window.open('/Alter_sportsplay/index.html', '_blank')}
            >
              <Video className="h-4 w-4 mr-2" />
              비디오 분석 도구
            </Button>
          </div>
          <div className="flex gap-4 mt-1">
            {['single', 'tournament', 'manage'].map((mode) => (
              <Button 
                key={mode}
                variant={viewMode === mode ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setViewMode(mode as any)}
                className="h-7 text-xs font-bold"
              >
                {mode === 'single' ? '경기별 분석' : mode === 'tournament' ? '대회 누적 분석' : '대회 관리'}
              </Button>
            ))}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 bg-card p-3 rounded-lg border shadow-sm w-full xl:w-auto">
          <div className="flex items-center gap-3 border-r pr-4">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            <Select 
              value={activeTournamentId} 
              onValueChange={(id) => {
                setActiveTournamentId(id);
                const selected = tournaments.find(t => t.id === id);
                if (selected) setTournamentName(selected.name);
              }}
            >
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="대회 선택" />
              </SelectTrigger>
              <SelectContent>
                {tournaments.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setIsNewTournamentDialogOpen(true)}><Plus className="h-4 w-4" /></Button>
          </div>

          {viewMode !== 'tournament' && (
            <>
              <div className="flex items-center gap-4 border-r pr-4">
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">대회명 / 경기명</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      placeholder="대회명" 
                      value={tournamentName} 
                      onChange={(e) => setTournamentName(e.target.value)} 
                      className="h-8 w-32 text-xs font-bold" 
                    />
                    <Input 
                      placeholder="경기명" 
                      value={matchName} 
                      onChange={(e) => setMatchName(e.target.value)} 
                      className="h-8 w-40 text-xs font-bold" 
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 border-r pr-4">
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">홈 / 어웨이 설정</Label>
                  <div className="flex items-center gap-2">
                    <Select value={homeTeamName} onValueChange={setHomeTeamName}>
                      <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="홈" /></SelectTrigger>
                      <SelectContent>{detectedTeams.map(t => <SelectItem key={`h-${t}`} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="color" value={homeColor} onChange={(e) => setHomeColor(e.target.value)} className="w-6 h-6 p-0 border-none bg-transparent" />
                    <Select value={awayTeamName} onValueChange={setAwayTeamName}>
                      <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="어웨이" /></SelectTrigger>
                      <SelectContent>{detectedTeams.map(t => <SelectItem key={`a-${t}`} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="color" value={awayColor} onChange={(e) => setAwayColor(e.target.value)} className="w-6 h-6 p-0 border-none bg-transparent" />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xml,.csv" className="hidden" />
                <Button onClick={() => fileInputRef.current?.click()} className="h-9"><Upload className="mr-2 h-4 w-4" /> 업로드</Button>
                {matchData && (
                  <>
                    <Button variant="outline" onClick={handleSaveToDB} className="h-9 border-primary text-primary hover:bg-primary/5"><Save className="mr-2 h-4 w-4" /> 저장</Button>
                    <Button variant="default" onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700 h-9"><FileDown className="mr-2 h-4 w-4" /> PDF</Button>
                  </>
                )}
                {!matchData && <Button variant="outline" onClick={handleLoadMockData} className="h-9">데모</Button>}
              </div>
            </>
          )}
        </div>
      </header>

      <main className="printable-area">
        {viewMode === 'manage' ? (
          <TournamentManager onViewMatch={handleViewMatchFromDB} />
        ) : viewMode === 'tournament' ? (
          <TournamentDashboard tournamentId={activeTournamentId} />
        ) : !matchData ? (
          <div className="py-20 text-center bg-card rounded-xl border-2 border-dashed border-muted-foreground/25">
            <Activity className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2 font-headline">분석을 시작하세요</h2>
            <p className="text-muted-foreground mb-6">데이터를 업로드하여 심층 분석 리포트를 생성하세요.</p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => fileInputRef.current?.click()}>파일 업로드</Button>
              <Button variant="secondary" onClick={handleLoadMockData}>데모 데이터</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            <div className="border-b-4 border-primary pb-4 mb-8 flex justify-between items-end">
              <div>
                <h2 className="text-xl font-bold text-muted-foreground uppercase tracking-widest block print:text-primary print:text-2xl print:mb-2">{tournamentName || "Tournament Report"}</h2>
                <h1 className="text-4xl font-black italic tracking-tighter text-foreground mt-1 font-headline print:text-3xl">{matchData.matchName || "Match Performance Analysis"}</h1>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="print-hidden border-orange-500 text-orange-500 font-bold h-9" 
                  onClick={() => window.open('/Alter_sportsplay/index.html', '_blank')}>
                  <Video className="h-4 w-4 mr-2" />
                  비디오 분석 도구
                </Button>
                <Button variant="outline" size="sm" className="print-hidden border-primary text-primary font-bold h-9" onClick={handleAiAnalysis} disabled={isAiLoading}>
                  {isAiLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BrainCircuit className="h-4 w-4 mr-2" />}
                  AI 전술 분석 실행
                </Button>
                {matchData.videoMatchId && (
                  <Button variant="outline" size="sm" className="print-hidden border-orange-500 text-orange-500 font-bold h-9" 
                    onClick={() => window.open(`/Alter_sportsplay/index.html?matchId=${matchData.videoMatchId}`, '_blank')}>
                    <Video className="h-4 w-4 mr-2" />
                    비디오 분석 보기
                  </Button>
                )}
              </div>
            </div>

            <div className="break-inside-avoid space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[matchData.homeTeam, matchData.awayTeam].map((team, i) => (
                  <div key={team.name} className="space-y-3">
                    <div className="flex items-center gap-2 font-bold text-xl" style={{ color: team.color }}>
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: team.color }} />
                      {team.name} ({i === 0 ? '홈' : '어웨이'})
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <StatsCard title="득점" value={i === 0 ? matchData.matchStats.home.goals.field + matchData.matchStats.home.goals.pc : matchData.matchStats.away.goals.field + matchData.matchStats.away.goals.pc} icon={<Sword className="h-4 w-4" />} />
                      <StatsCard title="압박 지수 (SPP)" value={i === 0 ? matchData.matchStats.home.spp : matchData.matchStats.away.spp} icon={<TrendingDown className="h-4 w-4" />} isTime />
                      <StatsCard title="공격 점유율" value={i === 0 ? matchData.matchStats.home.attackPossession : matchData.matchStats.away.attackPossession} icon={<Target className="h-4 w-4" />} isPercentage />
                      <StatsCard title="CE 소요 시간" value={i === 0 ? matchData.matchStats.home.timePerCE : matchData.matchStats.away.timePerCE} icon={<Activity className="h-4 w-4" />} isTime />
                    </div>
                  </div>
                ))}
              </div>
              <BasicMatchStats data={matchData} />
            </div>

            <div className="break-inside-avoid space-y-8">
              <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
                <Activity className="h-6 w-6" /> 쿼터별 상세 데이터
              </div>
              <QuarterlyStatsTable data={matchData} />
            </div>

            <div className="break-inside-avoid space-y-8">
              <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
                <Sword className="h-6 w-6" /> 공격 성능 분석
              </div>
              <AttackThreatChart data={matchData.attackThreatData} homeTeam={matchData.homeTeam} awayTeam={matchData.awayTeam} videoMatchId={matchData.videoMatchId} />
              <BuildUpEfficiencyChart data={matchData} />
            </div>

            <div className="break-inside-avoid space-y-8">
              <div className="space-y-8">
                <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
                  <Target className="h-6 w-6" /> 공격 점유 및 속도 분석
                </div>
                <MatchTrajectoryChart data={matchData} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <CircleEntryAnalysis teamName={matchData.homeTeam.name} entries={matchData.circleEntries.filter(e => e.team === matchData.homeTeam.name)} teamColor={matchData.homeTeam.color} />
                  <CircleEntryAnalysis teamName={matchData.awayTeam.name} entries={matchData.circleEntries.filter(e => e.team === matchData.awayTeam.name)} teamColor={matchData.awayTeam.color} />
                </div>
              </div>

              <div className="pt-8 space-y-8 border-t-2 border-dashed">
                <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
                  <Shield className="h-6 w-6" /> 압박 분석
                </div>
                <PressureBattleChart data={matchData.pressureData} homeTeam={matchData.homeTeam} awayTeam={matchData.awayTeam} />
                <PressureAnalysisMap events={matchData.events} homeTeam={matchData.homeTeam} awayTeam={matchData.awayTeam} />
              </div>
            </div>

            {aiAnalysis && (
              <div className="break-inside-avoid space-y-8">
                <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
                  <Sparkles className="h-6 w-6" /> AI 전술 분석 리포트
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-2 border-primary/20">
                    <CardHeader className="bg-primary/5">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Info className="h-5 w-5 text-primary" /> 분석 요약
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{aiAnalysis.summary}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-primary/20">
                    <CardHeader className="bg-emerald-500/5">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Target className="h-5 w-5 text-emerald-600" /> 전술적 주요 포인트
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <ul className="space-y-3">
                        {aiAnalysis.tacticalAnalysis.map((point, idx) => (
                          <li key={idx} className="flex gap-2 text-sm">
                            <span className="font-bold text-emerald-600 shrink-0">{idx + 1}.</span>
                            <span className="text-muted-foreground">{point}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-primary/20">
                    <CardHeader className="bg-blue-500/5">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Activity className="h-5 w-5 text-blue-600" /> 팀의 강점
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <ul className="space-y-3">
                        {aiAnalysis.strengths.map((s, idx) => (
                          <li key={idx} className="flex gap-2 text-sm">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                            <span className="text-muted-foreground">{s}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-primary/20">
                    <CardHeader className="bg-orange-500/5">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingDown className="h-5 w-5 text-orange-600" /> 개선 필요 사항
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <ul className="space-y-3">
                        {aiAnalysis.weaknesses.map((w, idx) => (
                          <li key={idx} className="flex gap-2 text-sm">
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-600 mt-1.5 shrink-0" />
                            <span className="text-muted-foreground">{w}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
                <Card className="bg-primary text-primary-foreground border-none shadow-xl">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="bg-white/20 p-3 rounded-xl">
                      <Sparkles className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest opacity-80">최종 분석 한줄평 (Verdict)</p>
                      <p className="text-xl font-black italic mt-1">"{aiAnalysis.verdict}"</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {(matchData || viewMode === 'tournament') && (
          <div className="mt-12 space-y-12">
            <div className="break-inside-avoid space-y-8">
              <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
                <MessageSquare className="h-6 w-6" /> 분석 연구원 comment
              </div>
              <Card className="border-2 shadow-sm">
                <CardContent className="pt-6">
                  <div className="relative">
                    <Textarea 
                      placeholder="여기에 경기/대회 전술에 대한 분석관의 직접적인 코멘트를 입력하세요..." 
                      className="min-h-[200px] text-base leading-relaxed resize-y border-none focus-visible:ring-0 p-0 print:hidden"
                      value={researcherComment}
                      onChange={(e) => setResearcherComment(e.target.value)}
                    />
                    <div className="hidden print:block whitespace-pre-wrap text-base leading-relaxed min-h-[200px]">
                      {researcherComment || "입력된 코멘트가 없습니다."}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="break-inside-avoid pt-12 border-t-4 border-muted">
              <div className="flex items-center gap-2 text-2xl font-bold text-muted-foreground mb-6">
                <Info className="h-6 w-6" /> 지표 정의 및 산출 가이드 (Metrics Definition)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="bg-muted/10 border-none shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-primary uppercase">SPP (Seconds Per Press)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs leading-relaxed text-muted-foreground">상대 팀의 빌드업 시간(우리 팀의 수비 상황)을 우리 팀의 압박 시도 횟수(상대 실책 유도 + 본인 파울 발생)로 나눈 값입니다. 수치가 낮을수록 압박 강도가 강하고 공격적임을 의미합니다.</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/10 border-none shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-primary uppercase">공격 점유율 (Attack Possession)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs leading-relaxed text-muted-foreground">양 팀의 공격 구역(ATT) 점유 시간 총합 대비 해당 팀의 공격 구역 점유 비중을 나타냅니다. 실질적인 위협 지역에서의 제어력을 평가합니다.</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/10 border-none shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-primary uppercase">빌드업 성공률 (Build25 Ratio)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs leading-relaxed text-muted-foreground">우리 팀의 전체 빌드업 시도 중 상대방 25m 구역(A25) 진입에 성공한 비율입니다. 팀의 후방 빌드업 전개 능력과 전진 패스 효율성을 나타냅니다.</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/10 border-none shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-primary uppercase">빌드업 정체 비율 (Stagnation Rate)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs leading-relaxed text-muted-foreground">팀의 전체 점유 시간 중 공격 구역(ATT)에 진입하지 못하고 후방 및 미드필드에 머무른 시간의 비중입니다. 높을수록 공격 전개 속도가 느림을 의미합니다.</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/10 border-none shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-primary uppercase">CE 1회당 소요 시간 (Time per CE)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs leading-relaxed text-muted-foreground">슈팅 서클 진입(Circle Entry) 1회를 기록하기 위해 평균적으로 소요된 팀 점유 시간입니다. 수치가 낮을수록 더 빠르고 직선적인 공격이 이루어졌음을 나타냅니다.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </main>

      <Dialog open={isNewTournamentDialogOpen} onOpenChange={setIsNewTournamentDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>새 대회 생성</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <Label>대회 이름</Label>
            <Input value={newTournamentName} onChange={(e) => setNewTournamentName(e.target.value)} placeholder="예: 2024 파리 올림픽" onKeyDown={(e) => e.key === 'Enter' && handleCreateTournament()} />
          </div>
          <DialogFooter><Button onClick={handleCreateTournament}>생성</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
