"use client"

import React, { useState, useMemo } from "react"
import { Trophy, Activity, Target, Shield, Sword, Trash2, FileDown, Database, TrendingUp, Grid3X3, ArrowRight, Table as TableIcon, Map as MapIcon, BrainCircuit, Loader2, Sparkles, ShieldCheck, TrendingDown, Info } from "lucide-react"
import type { MatchData, TeamMatchStats, Tournament, QuarterStats } from "@/lib/types"
import { TournamentService } from "@/lib/tournament-service"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BasicMatchStats } from "./basic-match-stats"
import { AttackThreatChart } from "./attack-threat-chart"
import { PressureBattleChart } from "./pressure-battle-chart"
import { TacticalQuadrantChart } from "./tactical-quadrant-charts"
import { MatchTrajectoryChart } from "./match-trajectory-chart"
import { QuarterlyStatsTable } from "./quarterly-stats-table"
import { PressureAnalysisMap } from "./pressure-analysis-map"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { collection, query, where } from "firebase/firestore"
import { analyzeMatch, type MatchAnalysisOutput } from "@/ai/flows/match-analysis-flow"

interface TournamentDashboardProps {
  tournamentId: string
}

const getTeamColor = (name: string, index: number): string => {
  const colors = [
    "#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", 
    "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6"
  ];
  return colors[index % colors.length];
};

export function TournamentDashboard({ tournamentId }: TournamentDashboardProps) {
  const [selectedTeamName, setSelectedTeamName] = useState("")
  const [selectedTeamColor, setSelectedTeamColor] = useState("#ef4444")
  const [opponentColor, setOpponentColor] = useState("#f59e0b")
  const [aiAnalysis, setAiAnalysis] = useState<MatchAnalysisOutput | null>(null)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const { toast } = useToast()
  const db = useFirestore()

  const matchesQuery = useMemoFirebase(() => {
    if (!db || !tournamentId) return null;
    return query(
      collection(db, 'matches'),
      where('tournamentId', '==', tournamentId)
    );
  }, [db, tournamentId]);

  const { data: rawMatches, isLoading: loading } = useCollection<MatchData>(matchesQuery);

  const matches = useMemo(() => {
    if (!rawMatches) return [];
    return [...rawMatches].sort((a, b) => {
      const timeA = a.uploadedAt?.seconds || 0;
      const timeB = b.uploadedAt?.seconds || 0;
      return timeA - timeB;
    });
  }, [rawMatches]);

  const analysisData = useMemo(() => {
    if (matches.length === 0) return null;

    const allTeams = Array.from(new Set(matches.flatMap(m => [m.homeTeam.name, m.awayTeam.name]))).sort();
    const currentTeam = selectedTeamName || allTeams[0];

    const teamColorMap = new Map<string, string>();
    allTeams.forEach((name, idx) => {
      teamColorMap.set(name, getTeamColor(name, idx));
    });

    const getTeamAverages = (teamName: string) => {
      const myMatches = matches.filter(m => m.homeTeam.name === teamName || m.awayTeam.name === teamName);
      const count = myMatches.length || 1;
      
      const sum = { 
        goals: 0, fieldGoals: 0, pcGoals: 0, shots: 0, pcs: 0, circle: 0, entry25: 0, 
        possession: 0, attPoss: 0, spp: 0, timeCE: 0, buildUp: 0,
        allowed25: 0, allowedCircle: 0, allowedShots: 0, allowedPC: 0 
      };

      myMatches.forEach(m => {
        const isHome = m.homeTeam.name === teamName;
        const my = isHome ? m.matchStats.home : m.matchStats.away;
        const opp = isHome ? m.matchStats.away : m.matchStats.home;

        sum.fieldGoals += (my.goals?.field || 0);
        sum.pcGoals += (my.goals?.pc || 0);
        sum.goals += (my.goals?.field || 0) + (my.goals?.pc || 0);
        sum.shots += (my.shots || 0);
        sum.pcs += (my.pcs || 0);
        sum.circle += (my.circleEntries || 0);
        sum.entry25 += (my.twentyFiveEntries || 0);
        sum.possession += (my.possession || 0);
        sum.attPoss += (my.attackPossession || 0);
        sum.spp += (my.spp || 0);
        sum.timeCE += (my.timePerCE || 0);
        sum.buildUp += (my.build25Ratio || 0);

        sum.allowed25 += (opp.twentyFiveEntries || 0);
        sum.allowedCircle += (opp.circleEntries || 0);
        sum.allowedShots += (opp.shots || 0);
        sum.allowedPC += (opp.pcs || 0);
      });

      return {
        name: teamName,
        color: teamColorMap.get(teamName),
        avgGoals: parseFloat((sum.goals / count).toFixed(1)),
        avgFieldGoals: parseFloat((sum.fieldGoals / count).toFixed(1)),
        avgPCGoals: parseFloat((sum.pcGoals / count).toFixed(1)),
        avgShots: parseFloat((sum.shots / count).toFixed(1)),
        avgPCs: parseFloat((sum.pcs / count).toFixed(1)),
        avgCircle: parseFloat((sum.circle / count).toFixed(1)),
        avg25y: parseFloat((sum.entry25 / count).toFixed(1)),
        avgPoss: parseFloat((sum.possession / count).toFixed(1)),
        avgAttPoss: parseFloat((sum.attPoss / count).toFixed(1)),
        avgSPP: parseFloat((sum.spp / count).toFixed(1)),
        avgTimeCE: parseFloat((sum.timeCE / count).toFixed(1)),
        avgBuildUp: parseFloat((sum.buildUp / count).toFixed(1)),
        avgAllowed25: parseFloat((sum.allowed25 / count).toFixed(1)),
        avgAllowedCircle: parseFloat((sum.allowedCircle / count).toFixed(1)),
        avgAllowedThreat: parseFloat(((sum.allowedShots + sum.allowedPC) / count).toFixed(1)),
        avgThreat: parseFloat(((sum.shots + sum.pcs) / count).toFixed(1))
      };
    };

    const teamStatsList = allTeams.map(name => getTeamAverages(name));
    
    const globalCount = teamStatsList.length || 1;
    const globalAvg = {
      fieldGoals: parseFloat((teamStatsList.reduce((a, b) => a + b.avgFieldGoals, 0) / globalCount).toFixed(1)),
      pcGoals: parseFloat((teamStatsList.reduce((a, b) => a + b.avgPCGoals, 0) / globalCount).toFixed(1)),
      entry25: parseFloat((teamStatsList.reduce((a, b) => a + b.avg25y, 0) / globalCount).toFixed(1)),
      circle: parseFloat((teamStatsList.reduce((a, b) => a + b.avgCircle, 0) / globalCount).toFixed(1)),
      threat: parseFloat((teamStatsList.reduce((a, b) => a + b.avgThreat, 0) / globalCount).toFixed(1)),
      allowed25: parseFloat((teamStatsList.reduce((a, b) => a + b.avgAllowed25, 0) / globalCount).toFixed(1)),
      allowedCircle: parseFloat((teamStatsList.reduce((a, b) => a + b.avgAllowedCircle, 0) / globalCount).toFixed(1)),
      allowedThreat: parseFloat((teamStatsList.reduce((a, b) => a + b.avgAllowedThreat, 0) / globalCount).toFixed(1)),
      spp: parseFloat((teamStatsList.reduce((a, b) => a + b.avgSPP, 0) / globalCount).toFixed(1)),
      attPoss: parseFloat((teamStatsList.reduce((a, b) => a + b.avgAttPoss, 0) / globalCount).toFixed(1)),
      buildUp: parseFloat((teamStatsList.reduce((a, b) => a + b.avgBuildUp, 0) / globalCount).toFixed(1)),
      pcs: parseFloat((teamStatsList.reduce((a, b) => a + b.avgPCs, 0) / globalCount).toFixed(1)),
      shots: parseFloat((teamStatsList.reduce((a, b) => a + b.avgShots, 0) / globalCount).toFixed(1)),
      possession: parseFloat((teamStatsList.reduce((a, b) => a + b.avgPoss, 0) / globalCount).toFixed(1)),
      timeCE: parseFloat((teamStatsList.reduce((a, b) => a + b.avgTimeCE, 0) / globalCount).toFixed(1)),
    };

    const getQuarterlyAverages = (teamName: string | null) => {
      const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
      return quarters.map(q => {
        let relevantMatches = matches;
        if (teamName) {
          relevantMatches = matches.filter(m => m.homeTeam.name === teamName || m.awayTeam.name === teamName);
        }
        
        const count = teamName ? (relevantMatches.length || 1) : (matches.length * 2 || 1);
        const sums = { field: 0, pc: 0, shots: 0, pcs: 0, circle: 0, a25: 0, poss: 0, att: 0, spp: 0, ceTime: 0 };

        relevantMatches.forEach(m => {
          const qStats = m.quarterlyStats.find(qs => qs.quarter === q);
          if (qStats) {
            if (teamName) {
              const my = m.homeTeam.name === teamName ? qStats.home : qStats.away;
              sums.field += (my.goals?.field || 0);
              sums.pc += (my.goals?.pc || 0);
              sums.shots += (my.shots || 0);
              sums.pcs += (my.pcs || 0);
              sums.circle += (my.circleEntries || 0);
              sums.a25 += (my.twentyFiveEntries || 0);
              sums.poss += (my.possession || 0);
              sums.att += (my.attackPossession || 0);
              sums.spp += (my.spp || 0);
              sums.ceTime += (my.timePerCE || 0);
            } else {
              [qStats.home, qStats.away].forEach(side => {
                sums.field += (side.goals?.field || 0);
                sums.pc += (side.goals?.pc || 0);
                sums.shots += (side.shots || 0);
                sums.pcs += (side.pcs || 0);
                sums.circle += (side.circleEntries || 0);
                sums.a25 += (side.twentyFiveEntries || 0);
                sums.poss += (side.possession || 0);
                sums.att += (side.attackPossession || 0);
                sums.spp += (side.spp || 0);
                sums.ceTime += (side.timePerCE || 0);
              });
            }
          }
        });

        return {
          goals: { field: parseFloat((sums.field / count).toFixed(1)), pc: parseFloat((sums.pc / count).toFixed(1)) },
          shots: parseFloat((sums.shots / count).toFixed(1)),
          pcs: parseFloat((sums.pcs / count).toFixed(1)),
          circleEntries: parseFloat((sums.circle / count).toFixed(1)),
          twentyFiveEntries: parseFloat((sums.a25 / count).toFixed(1)),
          possession: parseFloat((sums.poss / count).toFixed(1)),
          attackPossession: parseFloat((sums.att / count).toFixed(1)),
          spp: parseFloat((sums.spp / count).toFixed(1)),
          timePerCE: parseFloat((sums.ceTime / count).toFixed(1))
        } as any;
      });
    };

    const teamQAvgs = getQuarterlyAverages(currentTeam);
    const globalQAvgs = getQuarterlyAverages(null);

    const mockMatch: MatchData = {
      homeTeam: { name: currentTeam, color: selectedTeamColor },
      awayTeam: { name: '대회 전체 평균', color: opponentColor },
      events: [],
      pressureData: matches.filter(m => m.homeTeam.name === currentTeam || m.awayTeam.name === currentTeam).map((m, i) => {
        const isHome = m.homeTeam.name === currentTeam;
        const opponent = isHome ? m.awayTeam.name : m.homeTeam.name;
        return {
          interval: `M${String(i + 1).padStart(2, '0')} vs ${opponent}`,
          [currentTeam]: isHome ? m.matchStats.home.spp : m.matchStats.away.spp,
          "상대 팀": isHome ? m.matchStats.away.spp : m.matchStats.home.spp
        };
      }),
      circleEntries: [],
      attackThreatData: matches.filter(m => m.homeTeam.name === currentTeam || m.awayTeam.name === currentTeam).map((m, i) => {
        const isHome = m.homeTeam.name === currentTeam;
        const opponent = isHome ? m.awayTeam.name : m.homeTeam.name;
        return {
          interval: `M${String(i + 1).padStart(2, '0')} vs ${opponent}`,
          [currentTeam]: isHome ? m.matchStats.home.shots + m.matchStats.home.pcs : m.matchStats.away.shots + m.matchStats.away.pcs,
          "상대 팀": isHome ? m.matchStats.away.shots + m.matchStats.away.pcs : m.matchStats.home.shots + m.matchStats.home.pcs
        };
      }),
      build25Ratio: { home: getTeamAverages(currentTeam).avgBuildUp, away: globalAvg.buildUp },
      spp: { home: getTeamAverages(currentTeam).avgSPP, away: globalAvg.spp },
      matchStats: { 
        home: {
          ...getTeamAverages(currentTeam),
          goals: { field: getTeamAverages(currentTeam).avgFieldGoals, pc: getTeamAverages(currentTeam).avgPCGoals },
          shots: getTeamAverages(currentTeam).avgShots,
          pcs: getTeamAverages(currentTeam).avgPCs,
          circleEntries: getTeamAverages(currentTeam).avgCircle,
          twentyFiveEntries: getTeamAverages(currentTeam).avg25y,
          possession: getTeamAverages(currentTeam).avgPoss,
          attackPossession: getTeamAverages(currentTeam).avgAttPoss,
          spp: getTeamAverages(currentTeam).avgSPP,
          timePerCE: getTeamAverages(currentTeam).avgTimeCE,
          build25Ratio: getTeamAverages(currentTeam).avgBuildUp
        } as any, 
        away: {
          goals: { field: globalAvg.fieldGoals, pc: globalAvg.pcGoals },
          shots: globalAvg.shots,
          pcs: globalAvg.pcs,
          circleEntries: globalAvg.circle,
          twentyFiveEntries: globalAvg.entry25,
          possession: globalAvg.possession,
          attackPossession: globalAvg.attPoss,
          spp: globalAvg.spp,
          timePerCE: globalAvg.timeCE,
          build25Ratio: globalAvg.buildUp
        } as any
      },
      quarterlyStats: ['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => ({
        quarter: q,
        home: teamQAvgs[i],
        away: globalQAvgs[i]
      }))
    };

    const quadrantData = {
      attackEfficiency: teamStatsList.map(t => ({ name: t.name, x: t.avg25y, y: t.avgCircle, z: 200, color: t.color })),
      finishingEfficiency: teamStatsList.map(t => ({ name: t.name, x: t.avgCircle, y: t.avgThreat, z: 200, color: t.color })),
      defensiveResilience: teamStatsList.map(t => ({ name: t.name, x: t.avgAllowed25, y: t.avgAllowedCircle, z: 200, color: t.color })),
      circleDefense: teamStatsList.map(t => ({ name: t.name, x: t.avgAllowedCircle, y: t.avgAllowedThreat, z: 200, color: t.color })),
      pressEfficiency: teamStatsList.map(t => ({ name: t.name, x: t.avgSPP, y: t.avgAttPoss, z: 200, color: t.color }))
    };

    return { 
      mockMatch, 
      allTeams, 
      currentTeam, 
      teamStatsList, 
      globalAvg, 
      quadrantData, 
      teamMatches: matches.filter(m => m.homeTeam.name === currentTeam || m.awayTeam.name === currentTeam) 
    };
  }, [matches, selectedTeamName, selectedTeamColor, opponentColor]);

  const handleAiAnalysis = async () => {
    if (!analysisData) return;
    setIsAiLoading(true);
    try {
      const result = await analyzeMatch({
        type: 'tournament',
        matchName: `${analysisData.currentTeam} 대회 누적 분석`,
        homeTeam: { name: analysisData.currentTeam },
        awayTeam: { name: '대회 평균' },
        stats: {
          tournamentAvg: analysisData.globalAvg,
          teamAvg: analysisData.mockMatch.matchStats.home,
          matchTrends: analysisData.mockMatch.attackThreatData
        }
      });
      setAiAnalysis(result);
      toast({ title: "AI 대회 전술 분석 완료" });
    } catch (e: any) {
      toast({ title: "AI 분석 실패", description: e.message, variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
  };

  const aggregatedEvents = useMemo(() => {
    if (!analysisData?.teamMatches) return [];
    const currentTeam = analysisData.currentTeam;
    return analysisData.teamMatches.flatMap(m => {
      return m.events.map(e => ({
        ...e,
        team: e.team === currentTeam ? currentTeam : '상대팀 평균'
      }));
    });
  }, [analysisData]);

  if (loading) return <div className="py-20 text-center">대회 데이터를 불러오는 중...</div>;
  if (matches.length === 0) return <div className="py-20 text-center text-muted-foreground">데이터가 없습니다. 분석할 경기를 업로드하고 DB에 저장해 주세요.</div>;

  const trajectoryPoints = analysisData?.teamMatches.map(m => ({
    homeX: m.homeTeam.name === analysisData.currentTeam ? m.matchStats.home.attackPossession : m.matchStats.away.attackPossession,
    homeY: m.homeTeam.name === analysisData.currentTeam ? m.matchStats.home.timePerCE : m.matchStats.away.timePerCE,
    homeRawTime: m.homeTeam.name === analysisData.currentTeam ? m.matchStats.home.timePerCE : m.matchStats.away.timePerCE,
  })) || [];

  const matchCount = analysisData?.teamMatches.length || 1;

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center border-b-4 border-primary pb-4 gap-4">
        <div>
          <h1 className="text-4xl font-black italic text-primary uppercase tracking-tighter">Tournament Report</h1>
          <p className="text-muted-foreground font-bold text-lg">{selectedTeamName || analysisData?.currentTeam} 성과 분석</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 bg-card p-3 rounded-lg border shadow-sm w-full xl:w-auto">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">분석 대상 팀</Label>
            <Select value={selectedTeamName || (analysisData?.currentTeam || "")} onValueChange={setSelectedTeamName}>
              <SelectTrigger className="h-10 w-44 font-bold text-sm">
                <SelectValue placeholder="팀 선택" />
              </SelectTrigger>
              <SelectContent>
                {analysisData?.allTeams.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">우리 팀 색상</Label>
            <Input type="color" value={selectedTeamColor} onChange={(e) => setSelectedTeamColor(e.target.value)} className="w-16 h-10 p-1 cursor-pointer" />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">상대 팀 색상</Label>
            <Input type="color" value={opponentColor} onChange={(e) => setOpponentColor(e.target.value)} className="w-16 h-10 p-1 cursor-pointer" />
          </div>

          <div className="flex gap-2 mt-auto">
            <Button 
              variant="outline" 
              onClick={handleAiAnalysis} 
              disabled={isAiLoading}
              className="h-10 border-primary text-primary font-bold"
            >
              {isAiLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BrainCircuit className="h-4 w-4 mr-2" />}
              AI 대회 총평 생성
            </Button>
            <Button variant="default" onClick={() => window.print()} className="h-10 bg-emerald-600 hover:bg-emerald-700 font-bold">
              <FileDown className="h-4 w-4 mr-2" /> PDF 다운로드
            </Button>
          </div>
        </div>
      </div>

      {aiAnalysis && (
        <div className="page-break space-y-6">
          <div className="flex items-center gap-2 text-2xl font-black text-primary border-b-2 pb-1">
            <Sparkles className="h-6 w-6" /> AI 대회 통합 전술 리포트 (Cumulative Tactical Insight)
          </div>
          <Card className="border-4 border-primary/20 shadow-2xl bg-primary/5">
            <CardContent className="pt-8 space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-6">
                  <div>
                    <h3 className="text-xl font-black mb-3 text-primary flex items-center gap-2 italic uppercase">
                      <Info className="h-6 w-6" /> Tournament Summary
                    </h3>
                    <p className="text-lg leading-relaxed font-semibold italic">"{aiAnalysis.summary}"</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h4 className="font-black text-emerald-600 flex items-center gap-2 uppercase tracking-tighter">
                        <ShieldCheck className="h-5 w-5" /> Key Strategic Strengths
                      </h4>
                      <ul className="space-y-2">
                        {[...aiAnalysis.tacticalAnalysis, ...aiAnalysis.strengths].map((item, i) => (
                          <li key={i} className="flex gap-2 text-sm font-bold bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                            <span className="text-emerald-500">•</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-4">
                      <h4 className="font-black text-amber-600 flex items-center gap-2 uppercase tracking-tighter">
                        <TrendingDown className="h-5 w-5" /> Areas for Tactical Growth
                      </h4>
                      <ul className="space-y-2">
                        {aiAnalysis.weaknesses.map((item, i) => (
                          <li key={i} className="flex gap-2 text-sm font-bold bg-amber-50 p-2 rounded-lg border border-amber-100">
                            <span className="text-amber-500">•</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-4 flex items-center justify-center border-l-2 pl-8 border-primary/10">
                  <div className="text-center space-y-4">
                    <div className="inline-block p-4 rounded-full bg-primary/10 mb-2">
                      <BrainCircuit className="h-12 w-12 text-primary" />
                    </div>
                    <h4 className="font-black text-primary uppercase tracking-widest text-sm">Final Tactical Verdict</h4>
                    <p className="text-2xl font-black italic text-foreground leading-tight">
                      "{aiAnalysis.verdict}"
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {analysisData && (
        <div className="space-y-16">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <Card className="lg:col-span-1 border-2">
                <CardHeader className="bg-muted/10 border-b">
                  <CardTitle className="text-xl font-black flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" /> 분석 대상 경기 ({analysisData.teamMatches.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2 max-h-[550px] overflow-auto">
                  {analysisData.teamMatches.map((m, i) => (
                    <div key={m.id || i} className="p-4 bg-card border rounded-xl shadow-sm hover:border-primary transition-all">
                      <p className="text-xs font-black text-muted-foreground uppercase mb-1">Match {String(i+1).padStart(2, '0')}</p>
                      <p className="font-bold text-sm">{m.matchName}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">vs {m.homeTeam.name === analysisData.currentTeam ? m.awayTeam.name : m.homeTeam.name}</p>
                    </div>
                  ))}
                </CardContent>
             </Card>

             <div className="lg:col-span-2 space-y-8">
                <div className="flex items-center gap-2 text-2xl font-black text-primary border-b-2 pb-1">
                   <Activity className="h-6 w-6" /> 대회 평균 대비 지표 (Selected vs Global Avg)
                </div>
                <BasicMatchStats data={analysisData.mockMatch} />
                
                <div className="flex items-center gap-2 text-2xl font-black text-primary border-b-2 pb-1 pt-4">
                   <TableIcon className="h-6 w-6" /> 대회 평균 대비 쿼터별 지표 (Quarterly Comparison)
                </div>
                <QuarterlyStatsTable data={analysisData.mockMatch} />
             </div>
          </div>

          <div className="page-break space-y-8">
            <div className="flex items-center gap-2 text-2xl font-black text-primary border-b-2 pb-1">
              <TrendingUp className="h-6 w-6" /> 경기별 트렌드 추이 (Match-by-Match Trend)
            </div>
            <div className="grid grid-cols-1 gap-8">
              <AttackThreatChart 
                data={analysisData.mockMatch.attackThreatData} 
                homeTeam={{ name: analysisData.currentTeam, color: selectedTeamColor }} 
                awayTeam={{ name: '상대 팀', color: opponentColor }} 
              />
              <PressureBattleChart 
                data={analysisData.mockMatch.pressureData} 
                homeTeam={{ name: analysisData.currentTeam, color: selectedTeamColor }} 
                awayTeam={{ name: '상대 팀', color: opponentColor }} 
                height={300} 
              />
            </div>
          </div>

          <div className="page-break space-y-8">
            <div className="flex items-center gap-2 text-2xl font-black text-primary border-b-2 pb-1">
              <Target className="h-6 w-6" /> 팀 공격 전술 궤적 분석 (Match Trajectory Analysis)
            </div>
            <MatchTrajectoryChart 
              data={analysisData.mockMatch} 
              isTournamentView 
              allMatchesPoints={trajectoryPoints} 
            />
            
            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-2 text-2xl font-black text-primary border-b-2 pb-1">
                <MapIcon className="h-6 w-6" /> 대회 통합 압박 분석 (Tournament Pressure Map)
              </div>
              <PressureAnalysisMap 
                events={aggregatedEvents} 
                homeTeam={{ name: analysisData.currentTeam, color: selectedTeamColor }} 
                awayTeam={{ name: '상대팀 평균', color: opponentColor }} 
                awayHeader="상대팀 평균 압박"
                matchCount={matchCount}
              />
            </div>
          </div>

          <div className="page-break space-y-12">
            <div className="flex items-center gap-2 text-2xl font-black text-primary border-b-2 pb-1">
              <Grid3X3 className="h-6 w-6" /> 대회 전술 4분면 분석 (Tactical Quadrant Analysis)
            </div>
            
            <div className="grid grid-cols-1 gap-12">
              <TacticalQuadrantChart 
                title="공격 전개 효율"
                description="25y 진입 대비 서클 진입 전환력"
                data={analysisData.quadrantData.attackEfficiency}
                xAxisLabel="평균 25y 진입 (A25)"
                yAxisLabel="평균 서클 진입 (CE)"
                avgX={analysisData.globalAvg.entry25}
                avgY={analysisData.globalAvg.circle}
                selectedTeamName={analysisData.currentTeam}
                selectedColor={selectedTeamColor}
                labels={{
                  tr: "Efficient Dominance (효율적 공격 지배)",
                  tl: "Direct & High Volume (공격 빈도는 낮으나 효율적)",
                  br: "Inefficient Volume (진입은 많으나 서클 전환 부족)",
                  bl: "Low Intensity (전체적인 공격력 저조)"
                }}
              />
              <TacticalQuadrantChart 
                title="공격 결정력"
                description="서클 진입 대비 기회 창출력"
                data={analysisData.quadrantData.finishingEfficiency}
                xAxisLabel="평균 서클 진입 (CE)"
                yAxisLabel="평균 슈팅+PC"
                avgX={analysisData.globalAvg.circle}
                avgY={analysisData.globalAvg.threat}
                selectedTeamName={analysisData.currentTeam}
                selectedColor={selectedTeamColor}
                labels={{
                  tr: "High Conversion (높은 기회 창출력)",
                  tl: "Clinical Efficiency (진입 대비 높은 집중력)",
                  br: "Poor Final Ball (서클 진입 후 마무리 부족)",
                  bl: "Ineffective Attack (서클 내 기회 창출 부족)"
                }}
              />
              <TacticalQuadrantChart 
                title="수비 복원력"
                description="상대 25y 진입 대비 서클 허용 억제"
                data={analysisData.quadrantData.defensiveResilience}
                xAxisLabel="평균 25y 허용"
                yAxisLabel="평균 서클 허용"
                avgX={analysisData.globalAvg.allowed25}
                avgY={analysisData.globalAvg.allowedCircle}
                selectedTeamName={analysisData.currentTeam}
                selectedColor={selectedTeamColor}
                reversedX reversedY
                labels={{
                  tr: "Defensive Fortress (철벽 수비)",
                  tl: "Resilient Defense (25y 허용 대비 서클 방어 우수)",
                  br: "Vulnerable Shell (25y 진입 시 쉽게 서클 허용)",
                  bl: "Defensive Weakness (전체적인 수비 불안)"
                }}
              />
              <TacticalQuadrantChart 
                title="서클 수비력"
                description="상대 서클 진입 대비 슈팅 허용 억제"
                data={analysisData.quadrantData.circleDefense}
                xAxisLabel="평균 서클 허용"
                yAxisLabel="평균 슈팅+PC 허용"
                avgX={analysisData.globalAvg.allowedCircle}
                avgY={analysisData.globalAvg.allowedThreat}
                selectedTeamName={analysisData.currentTeam}
                selectedColor={selectedTeamColor}
                reversedX reversedY
                labels={{
                  tr: "Elite Circle Defense (서클 내 완벽 차단)",
                  tl: "Good Survival (서클 진입 후 슈팅 억제 우수)",
                  br: "Soft Center (서클 진입 시 높은 슈팅 허용)",
                  bl: "Critical Vulnerability (위험 지역 수비 부재)"
                }}
              />
              <TacticalQuadrantChart 
                title="압박 및 점유 효율"
                description="압박 강도와 공격 점유율의 상관관계"
                data={analysisData.quadrantData.pressEfficiency}
                xAxisLabel="압박 지수 (SPP, 초)"
                yAxisLabel="공격 점유율 (%)"
                avgX={analysisData.globalAvg.spp}
                avgY={analysisData.globalAvg.attPoss}
                selectedTeamName={analysisData.currentTeam}
                selectedColor={selectedTeamColor}
                reversedX 
                xUnit="s"
                yUnit="%"
                labels={{
                  tr: "Aggressive Dominance (강한 압박과 주도권)",
                  tl: "High Press / Low Return (강하게 압박하나 점유 부족)",
                  br: "Passive Control (압박은 낮으나 점유율 유지)",
                  bl: "Passive & Dominated (압박도 낮고 주도권도 없음)"
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
