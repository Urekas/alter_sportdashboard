
"use client"

import React, { useState, useRef, useEffect, useMemo } from "react"
import { 
  Upload, FileDown, TrendingDown, Target, Activity, ShieldCheck, 
  Sword, Shield, Trophy, Users, BookOpen, Info, Save, Database, Trash2, Plus
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
import { parseXMLData, parseCSVData, createMatchDataFromUpload } from "@/lib/parser"
import { TournamentService } from "@/lib/tournament-service"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function Dashboard() {
  const [viewMode, setViewMode] = useState<'single' | 'tournament'>('single')
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

  // 대회 목록 로드
  useEffect(() => {
    const fetchTournaments = async () => {
      const list = await TournamentService.getTournaments()
      setTournaments(list)
    }
    fetchTournaments()
  }, [])

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
    }
  }, [parsedEvents, homeTeamName, awayTeamName, homeColor, awayColor, tournamentName, matchName]);

  const handleCreateTournament = async () => {
    if (!newTournamentName) return;
    try {
      const id = await TournamentService.createTournament(newTournamentName, new Date().toISOString());
      const updatedList = await TournamentService.getTournaments();
      setTournaments(updatedList);
      setActiveTournamentId(id);
      setIsNewTournamentDialogOpen(false);
      setNewTournamentName("");
      toast({ title: "대회 생성 완료" });
    } catch (e) {
      toast({ title: "대회 생성 실패", variant: "destructive" });
    }
  }

  const handleSaveToDB = async () => {
    if (!matchData || !activeTournamentId) {
      toast({ title: "대회를 선택하거나 데이터를 먼저 로드하세요.", variant: "destructive" });
      return;
    }
    try {
      await TournamentService.addMatchToTournament(activeTournamentId, matchData);
      toast({ title: "경기 데이터 저장 완료", description: "대회 DB에 성공적으로 기록되었습니다." });
    } catch (e) {
      toast({ title: "저장 실패", variant: "destructive" });
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
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 bg-card p-3 rounded-lg border shadow-sm w-full xl:w-auto">
          {/* 대회 관리 섹션 */}
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
                        <Input value={newTournamentName} onChange={(e) => setNewTournamentName(e.target.value)} placeholder="예: 2024 파리 올림픽" />
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

          {viewMode === 'single' && (
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
        {viewMode === 'tournament' ? (
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

            {/* Page 1: Basic Stats */}
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

            {/* Page 2: Quarterly Stats */}
            <div className="page-break space-y-8">
              <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
                <Activity className="h-6 w-6" /> 쿼터별 상세 데이터 (Quarterly Analysis)
              </div>
              <QuarterlyStatsTable data={matchData} />
            </div>

            {/* Page 3: Attack Analysis */}
            <div className="page-break space-y-8">
              <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
                <Sword className="h-6 w-6" /> 공격 성능 분석 (Attack Analysis)
              </div>
              <AttackThreatChart data={matchData.attackThreatData} homeTeam={matchData.homeTeam} awayTeam={matchData.awayTeam} />
              <BuildUpEfficiencyChart data={matchData} />
            </div>

            {/* Page 4: Circle Entry & Trajectory */}
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

            {/* Page 5: Pressure Analysis */}
            <div className="page-break space-y-6 break-inside-avoid">
              <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
                <Shield className="h-6 w-6" /> 압박 및 수비 분석 (Pressure & Defense)
              </div>
              <div className="flex flex-col gap-6">
                <PressureBattleChart data={matchData.pressureData} homeTeam={matchData.homeTeam} awayTeam={matchData.awayTeam} height={260} />
                <PressureAnalysisMap events={matchData.events} homeTeam={matchData.homeTeam} awayTeam={matchData.awayTeam} isCompact />
              </div>
            </div>

            {/* Page 6: Glossary & Methodology */}
            <div className="page-break space-y-8 break-inside-avoid">
              <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
                <BookOpen className="h-6 w-6" /> 분석 지표 정의 및 산출 방식 (Glossary & Methodology)
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-l-4 border-l-primary shadow-md">
                  <CardHeader className="pb-3 bg-primary/5">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sword className="h-5 w-5 text-primary" /> 공격 지표 (Attack Metrics)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4 text-sm">
                    <div>
                      <h4 className="font-bold text-primary mb-1">공격 점유율 (Attack Possession, %)</h4>
                      <p className="text-muted-foreground leading-relaxed">
                        전체 필드 플레이 시간 중 공격 진영(ATT)에 머무른 시간의 비율입니다.<br/>
                        <span className="font-mono text-[11px] bg-muted px-1 rounded">공식: (팀 ATT 시간 / 양팀 총 ATT 시간) * 100</span>
                      </p>
                    </div>
                    <div>
                      <h4 className="font-bold text-primary mb-1">CE 1회당 소요 시간 (Time per CE, s)</h4>
                      <p className="text-muted-foreground leading-relaxed">
                        공격 서클 진입(CE) 1회를 만들기 위해 필요한 평균 팀 소유 시간입니다. 낮을수록 공격 전개 속도가 빠르고 효율적임을 의미합니다.<br/>
                        <span className="font-mono text-[11px] bg-muted px-1 rounded">공식: 팀 전체 소유(TEAM) 시간 / 서클 진입(CE) 횟수</span>
                      </p>
                    </div>
                    <div>
                      <h4 className="font-bold text-primary mb-1">빌드업 성공률 (Build-up Success, %)</h4>
                      <p className="text-muted-foreground leading-relaxed">
                        자기 진영(25m, 50m)에서 시작된 빌드업 시퀀스가 상대 25y 구역(A25) 진입에 성공한 비율입니다.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-emerald-600 shadow-md">
                  <CardHeader className="pb-3 bg-emerald-50">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Shield className="h-5 w-5 text-emerald-600" /> 압박 및 수비 지표 (Pressure Metrics)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4 text-sm">
                    <div>
                      <h4 className="font-bold text-emerald-700 mb-1">SPP (Successive Pressure Performance, s)</h4>
                      <p className="text-muted-foreground leading-relaxed">
                        상대가 빌드업을 시도하는 동안 우리가 얼마나 자주 압박 이벤트를 발생시켰는지 측정하는 압박 지수입니다. 수치가 낮을수록 압박 강도가 높음을 의미합니다.<br/>
                        <span className="font-mono text-[11px] bg-muted px-1 rounded">공식: 상대팀 빌드업 시간 / 우리팀 압박 시도(Press Attempt) 횟수</span>
                      </p>
                    </div>
                    <div>
                      <h4 className="font-bold text-emerald-700 mb-1">압박 시도 (Press Attempt)</h4>
                      <p className="text-muted-foreground leading-relaxed">
                        상대 빌드업을 방해한 유효한 수비 행위의 합계입니다.<br/>
                        <span className="font-mono text-[11px] bg-muted px-1 rounded">집계: (상대 75/100m 구역 실책) + (우리 25/50m 구역 파울)</span>
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="md:col-span-2 border-l-4 border-l-amber-500 shadow-md">
                  <CardHeader className="pb-3 bg-amber-50">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Info className="h-5 w-5 text-amber-500" /> 분석 시스템 핵심 로직 (System Logic)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                    <div className="space-y-2">
                      <h4 className="font-bold text-amber-700">15분 쿼터 정규화 (Time Normalization)</h4>
                      <p className="text-muted-foreground leading-relaxed">
                        데이터의 절대 시간과 관계없이 <span className="font-bold">Ungrouped</span> 열의 쿼터 라벨(1Q~4Q)을 기준으로 모든 데이터를 각 15분 블록에 정밀하게 매핑합니다.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-bold text-amber-700">전술 궤적 분석 (Match Trajectory)</h4>
                      <p className="text-muted-foreground leading-relaxed">
                        [공격 점유율]과 [CE 소요 시간]을 결합하여 팀의 공격 스타일을 사분면에 배치합니다. 
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
