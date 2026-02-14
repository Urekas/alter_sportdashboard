"use client"

import React, { useState, useRef, useEffect } from "react"
import { Upload, FileDown, TrendingDown, Target, Activity, ShieldCheck, Sword, Shield, Settings2, Trophy } from "lucide-react"
import type { MatchData } from "@/lib/types"
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
import { parseXMLData, parseCSVData, createMatchDataFromUpload } from "@/lib/parser"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function Dashboard() {
  const [matchData, setMatchData] = useState<MatchData | null>(null)
  const [tournamentName, setTournamentName] = useState("")
  const [matchName, setMatchName] = useState("")
  const [homeColor, setHomeColor] = useState("#0066ff") // Vivid Blue
  const [awayColor, setAwayColor] = useState("#ef4444") // Red-Orange
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (matchData) {
      setMatchData(prev => prev ? {
        ...prev,
        tournamentName: tournamentName || prev.tournamentName,
        matchName: matchName || prev.matchName,
        homeTeam: { ...prev.homeTeam, color: homeColor },
        awayTeam: { ...prev.awayTeam, color: awayColor }
      } : null);
    }
  }, [homeColor, awayColor, tournamentName, matchName]);

  const handleLoadMockData = () => {
    const data = {
      ...mockMatchData,
      tournamentName: tournamentName || "데모 대회 (Demo Tournament)",
      matchName: "Korea vs Netherlands (Friendly Match)",
      homeTeam: { ...mockMatchData.homeTeam, color: homeColor },
      awayTeam: { ...mockMatchData.awayTeam, color: awayColor }
    };
    setMatchData(data)
    toast({ title: "데모 데이터 로드됨" })
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
          
          setMatchName(detectedMatchName);
          const newData = createMatchDataFromUpload(
            parsed.events, 
            parsed.teams.home, 
            parsed.teams.away, 
            homeColor, 
            awayColor,
            tournamentName,
            detectedMatchName
          );
          setMatchData(newData);
          toast({ title: "분석 완료", description: `${parsed.teams.home} vs ${parsed.teams.away}` });
        } catch (error: any) {
          toast({ title: "오류 발생", description: error.message, variant: "destructive" });
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 print-hidden gap-4">
        <div>
          <h1 className="text-4xl font-bold text-primary italic tracking-tight font-headline">Field Focus</h1>
          <p className="text-muted-foreground mt-1">Advanced Hockey Performance Analytics</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 bg-card p-3 rounded-lg border shadow-sm">
          <div className="flex items-center gap-3 border-r pr-4">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <Label htmlFor="tournament-input" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">대회 이름 (Tournament)</Label>
              <Input 
                id="tournament-input"
                placeholder="대회 이름을 입력하세요"
                value={tournamentName}
                onChange={(e) => setTournamentName(e.target.value)}
                className="h-8 text-xs w-48"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 border-r pr-4">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <Label htmlFor="home-color" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">홈팀 색상</Label>
              <Input 
                id="home-color"
                type="color" 
                value={homeColor} 
                onChange={(e) => setHomeColor(e.target.value)}
                className="w-12 h-8 p-1 cursor-pointer bg-transparent border-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="away-color" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">어웨이팀 색상</Label>
              <Input 
                id="away-color"
                type="color" 
                value={awayColor} 
                onChange={(e) => setAwayColor(e.target.value)}
                className="w-12 h-8 p-1 cursor-pointer bg-transparent border-none"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xml,.csv" className="hidden" />
            <Button onClick={() => fileInputRef.current?.click()} className="shadow-md h-9">
              <Upload className="mr-2 h-4 w-4" /> 데이터 업로드
            </Button>
            {matchData && (
              <Button variant="default" onClick={() => window.print()} className="shadow-sm bg-emerald-600 hover:bg-emerald-700 h-9">
                <FileDown className="mr-2 h-4 w-4" /> PDF 리포트 다운로드
              </Button>
            )}
            {!matchData && (
              <Button variant="outline" onClick={handleLoadMockData} className="h-9">데모</Button>
            )}
          </div>
        </div>
      </header>

      <main className="printable-area">
        {!matchData ? (
          <div className="py-20 text-center bg-card rounded-xl border-2 border-dashed border-muted-foreground/25">
            <Activity className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">분석을 시작하세요</h2>
            <p className="text-muted-foreground mb-6">상단에서 대회 이름을 입력하고 팀 컬러를 선택한 후 데이터를 업로드하세요.</p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => fileInputRef.current?.click()}>파일 업로드</Button>
              <Button variant="secondary" onClick={handleLoadMockData}>데모 데이터</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {/* 리포트 메인 헤더 (Page 1 Top) */}
            <div className="border-b-4 border-primary pb-4 mb-8">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-xl font-bold text-muted-foreground uppercase tracking-widest">{matchData.tournamentName || "Tournament Report"}</h2>
                  <h1 className="text-4xl font-black italic tracking-tighter text-foreground mt-1">{matchData.matchName || "Match Performance Analysis"}</h1>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-muted-foreground">REPORT DATE</p>
                  <p className="text-lg font-bold">{new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* 페이지 1: 기본 통계 요약 */}
            <div className="page-break space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[matchData.homeTeam, matchData.awayTeam].map((team, i) => (
                  <div key={team.name} className="space-y-3">
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

            {/* 페이지 2: 쿼터별 상세 데이터 (독립 페이지) */}
            <div className="page-break space-y-8">
              <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
                <Activity className="h-6 w-6" /> 쿼터별 상세 데이터 (Quarterly Analysis)
              </div>
              <QuarterlyStatsTable data={matchData} />
            </div>

            {/* 페이지 3: 공격 성능 분석 */}
            <div className="page-break space-y-8">
              <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
                <Sword className="h-6 w-6" /> 공격 성능 분석 (Attack Analysis)
              </div>
              <AttackThreatChart data={matchData.attackThreatData} homeTeam={matchData.homeTeam} awayTeam={matchData.awayTeam} />
              <BuildUpEfficiencyChart data={matchData} />
            </div>

            {/* 페이지 4: 서클 진입 및 공격 궤적 분석 (한 장에 꽉 차게) */}
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

            {/* 페이지 5: 압박 및 수비 분석 (한 장에 통합) */}
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
