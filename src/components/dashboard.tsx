
"use client"

import React, { useState, useRef, useEffect } from "react"
import { 
  Upload, FileDown, TrendingDown, Target, Activity, ShieldCheck, 
  Sword, Shield, Trophy, Users, BookOpen, Info, Save, Database, Trash2, Plus, Settings
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
    // 수동 업로드 시에만 이 로직이 작동하도록 제어 (DB 로드 시에는 이미 matchData가 설정됨)
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
    }
  }, [parsedEvents, homeTeamName, awayTeamName, homeColor, awayColor, tournamentName, matchName]);

  const handleCreateTournament = async () => {
    if (!newTournamentName.trim()) {
      toast({ title: "대회 이름을 입력해주세요.", variant: "destructive" });
      return;
    }
    try {
      const id = await TournamentService.createTournament(newTournamentName, new Date().toISOString());
      await fetchTournaments();
      setActiveTournamentId(id);
      setIsNewTournamentDialogOpen(false);
      setNewTournamentName("");
      toast({ title: "대회 생성 완료", description: `"${newTournamentName}" 대회가 생성되었습니다.` });
    } catch (e: any) {
      console.error("Tournament creation error:", e);
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
      toast({ title: "경기 데이터 저장 완료", description: "대회 DB에 성공적으로 기록되었습니다." });
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
          const replacementCharCount = (content.match(/\ufffd/g) || []).length;
          if (replacementCharCount > 5) {
            content = new TextDecoder('euc-kr').decode(ab);
          }

          const parsed = file.name.endsWith('.xml') ? parseXMLData(content) : parseCSVData(content);
          if (parsed.events.length === 0) throw new Error("분석 가능한 데이터가 없습니다.");
          
          setParsedEvents(parsed.events);
          const uniqueTeams = Array.from(new Set(parsed.events.map(e => e.team.trim()))).filter(Boolean).sort();
          setDetectedTeams(uniqueTeams);
          
          setHomeTeamName(parsed.teams.home);
          setAwayTeamName(parsed.teams.away);
          setMatchName(detectedMatchName);
          
          toast({ title: "분석 완료", description: `${parsed.teams.home} vs ${parsed.teams.away} 데이터 로드됨` });
        } catch (error: any) {
          toast({ title: "오류 발생", description: error.message, variant: "destructive" });
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }

  // DB에서 경기를 불러와서 대시보드에 설정하는 함수
  const handleViewMatchFromDB = (data: MatchData) => {
    // 의존성들을 수동으로 설정하여 useEffect가 데이터를 덮어쓰지 않도록 함
    setParsedEvents([]); // 일단 비우고
    setHomeTeamName(data.homeTeam.name);
    setAwayTeamName(data.awayTeam.name);
    setHomeColor(data.homeTeam.color);
    setAwayColor(data.awayTeam.color);
    setTournamentName(data.tournamentName || "");
    setMatchName(data.matchName || "");
    
    // 최종 데이터 설정
    setMatchData(data);
    setViewMode('single');
    
    toast({ title: "경기 데이터 로드 완료", description: `"${data.matchName}" 분석을 시작합니다.` });
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 print-hidden gap-4">
        <div>
          <h1 className="text-4xl font-bold text-primary italic tracking-tight font-headline">Field Focus</h1>
          <div className="flex gap-4 mt-1">
            <Button 
              variant={viewMode === 'single' ? 'default' : 'ghost'} 
              size="sm" 
              onClick={() => setViewMode('single')}
              className="h-7 text-xs font-bold"
            >
              경기별 분석
            </Button>
            <Button 
              variant={viewMode === 'tournament' ? 'default' : 'ghost'} 
              size="sm" 
              onClick={() => setViewMode('tournament')}
              className="h-7 text-xs font-bold"
            >
              대회 누적 분석
            </Button>
            <Button 
              variant={viewMode === 'manage' ? 'default' : 'ghost'} 
              size="sm" 
              onClick={() => setViewMode('manage')}
              className="h-7 text-xs font-bold"
            >
              대회 관리
            </Button>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 bg-card p-3 rounded-lg border shadow-sm w-full xl:w-auto">
          <div className="flex items-center gap-3 border-r pr-4">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">대회 선택/생성</Label>
              <div className="flex gap-2">
                <Select value={activeTournamentId} onValueChange={setActiveTournamentId}>
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue placeholder="대회 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {tournaments.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={isNewTournamentDialogOpen} onOpenChange={setIsNewTournamentDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="icon" variant="outline" className="h-8 w-8"><Plus className="h-4 w-4" /></Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>새 대회 생성</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                      <div className="space-y-2">
                        <Label>대회 이름</Label>
                        <Input 
                          value={newTournamentName} 
                          onChange={(e) => setNewTournamentName(e.target.value)} 
                          placeholder="예: 2024 파리 올림픽"
                          onKeyDown={(e) => e.key === 'Enter' && handleCreateTournament()}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleCreateTournament}>대회 생성</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {(viewMode === 'single' || viewMode === 'manage') && (
            <>
              <div className="flex items-center gap-4 border-r pr-4">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">홈팀 설정</Label>
                  <div className="flex items-center gap-2">
                    <Select value={homeTeamName} onValueChange={setHomeTeamName}>
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue placeholder="홈팀 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {detectedTeams.map((team, i) => (
                          <SelectItem key={`home-${team}-${i}`} value={team}>{team}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="color" value={homeColor} onChange={(e) => setHomeColor(e.target.value)} className="w-8 h-8 p-0.5 cursor-pointer bg-transparent border-none" />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">어웨이팀 설정</Label>
                  <div className="flex items-center gap-2">
                    <Select value={awayTeamName} onValueChange={setAwayTeamName}>
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue placeholder="어웨이팀 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {detectedTeams.map((team, i) => (
                          <SelectItem key={`away-${team}-${i}`} value={team}>{team}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="color" value={awayColor} onChange={(e) => setAwayColor(e.target.value)} className="w-8 h-8 p-0.5 cursor-pointer bg-transparent border-none" />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xml,.csv" className="hidden" />
                <Button onClick={() => fileInputRef.current?.click()} className="shadow-md h-9">
                  <Upload className="mr-2 h-4 w-4" /> 데이터 업로드
                </Button>
                {matchData && (
                  <>
                    <Button variant="outline" onClick={handleSaveToDB} className="h-9 border-primary text-primary hover:bg-primary/5">
                      <Save className="mr-2 h-4 w-4" /> 대회 DB 저장
                    </Button>
                    <Button variant="default" onClick={() => window.print()} className="shadow-sm bg-emerald-600 hover:bg-emerald-700 h-9">
                      <FileDown className="mr-2 h-4 w-4" /> PDF 리포트
                    </Button>
                  </>
                )}
                {!matchData && (
                  <Button variant="outline" onClick={handleLoadMockData} className="h-9">데모</Button>
                )}
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
            <div className="border-b-4 border-primary pb-4 mb-8">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-xl font-bold text-muted-foreground uppercase tracking-widest">{matchData.tournamentName || "Tournament Report"}</h2>
                  <h1 className="text-4xl font-black italic tracking-tighter text-foreground mt-1 font-headline">{matchData.matchName || "Match Performance Analysis"}</h1>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-muted-foreground">REPORT DATE</p>
                  <p className="text-lg font-bold">{new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <div className="page-break space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[matchData.homeTeam, matchData.awayTeam].map((team, i) => (
                  <div key={`${team.name}-${i}`} className="space-y-3">
                    <div className="flex items-center gap-2 font-bold text-xl" style={{ color: team.color }}>
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: team.color }} />
                      {team.name} ({i === 0 ? '홈' : '어웨이'})
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <StatsCard title="SPP (압박 지수)" value={i === 0 ? matchData.matchStats.home.spp : matchData.matchStats.away.spp} isTime icon={<TrendingDown className="text-emerald-500 h-4 w-4" />} />
                      <StatsCard title="빌드업 성공률" value={i === 0 ? matchData.matchStats.home.build25Ratio : matchData.matchStats.away.build25Ratio} isPercentage icon={<ShieldCheck className="text-primary/60 h-4 w-4" />} />
                      <StatsCard title="공격 점유율" value={i === 0 ? matchData.matchStats.home.attackPossession : matchData.matchStats.away.attackPossession} isPercentage icon={<Target className="text-primary/60 h-4 w-4" />} />
                      <StatsCard title="CE 소요 시간" value={i === 0 ? matchData.matchStats.home.timePerCE : matchData.matchStats.away.timePerCE} isTime icon={<Activity className="text-primary/60 h-4 w-4" />} />
                    </div>
                  </div>
                ))}
              </div>
              <BasicMatchStats data={matchData} />
            </div>

            <div className="page-break space-y-8">
              <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
                <Activity className="h-6 w-6" /> 쿼터별 상세 데이터 (Quarterly Analysis)
              </div>
              <QuarterlyStatsTable data={matchData} />
            </div>

            <div className="page-break space-y-8">
              <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
                <Sword className="h-6 w-6" /> 공격 성능 분석 (Attack Analysis)
              </div>
              <AttackThreatChart data={matchData.attackThreatData} homeTeam={matchData.homeTeam} awayTeam={matchData.awayTeam} />
              <BuildUpEfficiencyChart data={matchData} />
            </div>

            <div className="page-break space-y-8 break-inside-avoid">
              <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
                <Target className="h-6 w-6" /> 서클 진입 및 공격 궤적 분석 (Circle Entry & Trajectory)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
                <CircleEntryAnalysis 
                  teamName={matchData.homeTeam.name} 
                  entries={matchData.circleEntries.filter(e => e.team === matchData.homeTeam.name)} 
                  teamColor={matchData.homeTeam.color}
                />
                <CircleEntryAnalysis 
                  teamName={matchData.awayTeam.name} 
                  entries={matchData.circleEntries.filter(e => e.team === matchData.awayTeam.name)} 
                  teamColor={matchData.awayTeam.color}
                />
              </div>
              <div className="mt-6">
                <MatchTrajectoryChart data={matchData} />
              </div>
            </div>

            <div className="page-break space-y-6 break-inside-avoid">
              <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
                <Shield className="h-6 w-6" /> 압박 및 수비 분석 (Pressure & Defense)
              </div>
              <div className="flex flex-col gap-6">
                <PressureBattleChart data={matchData.pressureData} homeTeam={matchData.homeTeam} awayTeam={matchData.awayTeam} height={260} />
                <PressureAnalysisMap events={matchData.events} homeTeam={matchData.homeTeam} awayTeam={matchData.awayTeam} isCompact />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
