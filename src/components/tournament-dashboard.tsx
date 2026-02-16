"use client"

import React, { useState, useMemo } from "react"
import { Trophy, Activity, Target, Shield, Sword, FileDown, TrendingUp, Grid3X3, Loader2, BrainCircuit, Info } from "lucide-react"
import type { MatchData, Tournament } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BasicMatchStats } from "./basic-match-stats"
import { AttackThreatChart } from "./attack-threat-chart"
import { PressureBattleChart } from "./pressure-battle-chart"
import { TacticalQuadrantChart } from "./tactical-quadrant-charts"
import { MatchTrajectoryChart } from "./match-trajectory-chart"
import { QuarterlyStatsTable } from "./quarterly-stats-table"
import { PressureAnalysisMap } from "./pressure-analysis-map"
import { StatsCard } from "./stats-card"
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
  const colors = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6"];
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
    return query(collection(db, 'matches'), where('tournamentId', '==', tournamentId));
  }, [db, tournamentId]);

  const { data: rawMatches, isLoading: loading } = useCollection<MatchData>(matchesQuery);

  const matches = useMemo(() => {
    if (!rawMatches) return [];
    return [...rawMatches].sort((a, b) => (a.uploadedAt?.seconds || 0) - (b.uploadedAt?.seconds || 0));
  }, [rawMatches]);

  const analysisData = useMemo(() => {
    if (matches.length === 0) return null;

    const allTeams = Array.from(new Set(matches.flatMap(m => [m.homeTeam.name, m.awayTeam.name]))).sort();
    const currentTeam = selectedTeamName || allTeams[0];

    const teamColorMap = new Map<string, string>();
    allTeams.forEach((name, idx) => teamColorMap.set(name, getTeamColor(name, idx)));

    const getTeamAverages = (teamName: string) => {
      const myMatches = matches.filter(m => m.homeTeam.name === teamName || m.awayTeam.name === teamName);
      const count = myMatches.length || 1;
      
      const sum = { 
        goals: 0, fieldGoals: 0, pcGoals: 0, shots: 0, pcs: 0, circle: 0, entry25: 0, 
        possession: 0, attPoss: 0, buildUpPoss: 0, pcSuccess: 0, spp: 0, timeCE: 0, buildUp: 0,
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
        sum.buildUpPoss += (my.buildUpPossession || 0);
        sum.pcSuccess += (my.pcSuccessRate || 0);
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
        avgPCSuccess: parseFloat((sum.pcSuccess / count).toFixed(1)),
        avgCircle: parseFloat((sum.circle / count).toFixed(1)),
        avg25y: parseFloat((sum.entry25 / count).toFixed(1)),
        avgPoss: parseFloat((sum.possession / count).toFixed(1)),
        avgAttPoss: parseFloat((sum.attPoss / count).toFixed(1)),
        avgBuildUpPoss: parseFloat((sum.buildUpPoss / count).toFixed(1)),
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
    
    // 선택된 팀의 경기들에서의 상대팀들 평균 데이터 추출 로직
    const myMatches = matches.filter(m => m.homeTeam.name === currentTeam || m.awayTeam.name === currentTeam);
    const oppCount = myMatches.length || 1;
    const oppSum = { field: 0, pc: 0, shots: 0, pcs: 0, ce: 0, a25: 0, poss: 0, att: 0, bup: 0, pcSucc: 0, spp: 0, tce: 0, b25: 0 };
    
    myMatches.forEach(m => {
      const opp = m.homeTeam.name === currentTeam ? m.matchStats.away : m.matchStats.home;
      oppSum.field += (opp.goals?.field || 0); oppSum.pc += (opp.goals?.pc || 0); oppSum.shots += (opp.shots || 0); oppSum.pcs += (opp.pcs || 0);
      oppSum.ce += (opp.circleEntries || 0); oppSum.a25 += (opp.twentyFiveEntries || 0); oppSum.poss += (opp.possession || 0);
      oppSum.att += (opp.attackPossession || 0); oppSum.bup += (opp.buildUpPossession || 0); oppSum.pcSucc += (opp.pcSuccessRate || 0);
      oppSum.spp += (opp.spp || 0); oppSum.tce += (opp.timePerCE || 0); oppSum.b25 += (opp.build25Ratio || 0);
    });

    const currentOppAvg = {
      fieldGoals: parseFloat((oppSum.field / oppCount).toFixed(1)),
      pcGoals: parseFloat((oppSum.pc / oppCount).toFixed(1)),
      shots: parseFloat((oppSum.shots / oppCount).toFixed(1)),
      pcs: parseFloat((oppSum.pcs / oppCount).toFixed(1)),
      circleEntries: parseFloat((oppSum.ce / oppCount).toFixed(1)),
      twentyFiveEntries: parseFloat((oppSum.a25 / oppCount).toFixed(1)),
      possession: parseFloat((oppSum.poss / oppCount).toFixed(1)),
      attackPossession: parseFloat((oppSum.att / oppCount).toFixed(1)),
      buildUpPossession: parseFloat((oppSum.bup / oppCount).toFixed(1)),
      pcSuccessRate: parseFloat((oppSum.pcSucc / oppCount).toFixed(1)),
      spp: parseFloat((oppSum.spp / oppCount).toFixed(1)),
      timePerCE: parseFloat((oppSum.tce / oppCount).toFixed(1)),
      build25Ratio: parseFloat((oppSum.b25 / oppCount).toFixed(1))
    };

    const globalAvg = {
      entry25: parseFloat((teamStatsList.reduce((a, b) => a + b.avg25y, 0) / globalCount).toFixed(1)),
      circle: parseFloat((teamStatsList.reduce((a, b) => a + b.avgCircle, 0) / globalCount).toFixed(1)),
      threat: parseFloat((teamStatsList.reduce((a, b) => a + b.avgThreat, 0) / globalCount).toFixed(1)),
      allowed25: parseFloat((teamStatsList.reduce((a, b) => a + b.avgAllowed25, 0) / globalCount).toFixed(1)),
      allowedCircle: parseFloat((teamStatsList.reduce((a, b) => a + b.avgAllowedCircle, 0) / globalCount).toFixed(1)),
      allowedThreat: parseFloat((teamStatsList.reduce((a, b) => a + b.avgAllowedThreat, 0) / globalCount).toFixed(1)),
      spp: parseFloat((teamStatsList.reduce((a, b) => a + b.avgSPP, 0) / globalCount).toFixed(1)),
      attPoss: parseFloat((teamStatsList.reduce((a, b) => a + b.avgAttPoss, 0) / globalCount).toFixed(1)),
    };

    const getQuarterlyAverages = (teamName: string | null) => {
      const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
      return quarters.map(q => {
        let relevantMatches = matches;
        if (teamName) relevantMatches = matches.filter(m => m.homeTeam.name === teamName || m.awayTeam.name === teamName);
        const count = teamName ? (relevantMatches.length || 1) : (matches.length * 2 || 1);
        const sums = { field: 0, pc: 0, shots: 0, pcs: 0, circle: 0, a25: 0, poss: 0, att: 0, bup: 0, pcSucc: 0, spp: 0, ceTime: 0 };

        relevantMatches.forEach(m => {
          const qStats = m.quarterlyStats.find(qs => qs.quarter === q);
          if (qStats) {
            const sideList = teamName ? [m.homeTeam.name === teamName ? qStats.home : qStats.away] : [qStats.home, qStats.away];
            sideList.forEach(side => {
              sums.field += (side.goals?.field || 0); sums.pc += (side.goals?.pc || 0); sums.shots += (side.shots || 0); sums.pcs += (side.pcs || 0);
              sums.circle += (side.circleEntries || 0); sums.a25 += (side.twentyFiveEntries || 0); sums.poss += (side.possession || 0);
              sums.att += (side.attackPossession || 0); sums.bup += (side.buildUpPossession || 0); sums.pcSucc += (side.pcSuccessRate || 0);
              sums.spp += (side.spp || 0); sums.ceTime += (side.timePerCE || 0);
            });
          }
        });

        return {
          goals: { field: parseFloat((sums.field / count).toFixed(1)), pc: parseFloat((sums.pc / count).toFixed(1)) },
          shots: parseFloat((sums.shots / count).toFixed(1)),
          pcs: parseFloat((sums.pcs / count).toFixed(1)),
          pcSuccessRate: parseFloat((sums.pcSucc / count).toFixed(1)),
          circleEntries: parseFloat((sums.circle / count).toFixed(1)),
          twentyFiveEntries: parseFloat((sums.a25 / count).toFixed(1)),
          possession: parseFloat((sums.poss / count).toFixed(1)),
          attackPossession: parseFloat((sums.att / count).toFixed(1)),
          buildUpPossession: parseFloat((sums.bup / count).toFixed(1)),
          spp: parseFloat((sums.spp / count).toFixed(1)),
          timePerCE: parseFloat((sums.ceTime / count).toFixed(1))
        } as any;
      });
    };

    const teamQAvgs = getQuarterlyAverages(currentTeam);
    const globalQAvgs = getQuarterlyAverages(null);

    const currentTeamStats = getTeamAverages(currentTeam);

    const mockMatch: MatchData = {
      homeTeam: { name: currentTeam, color: selectedTeamColor },
      awayTeam: { name: '상대팀', color: opponentColor },
      events: matches.filter(m => m.homeTeam.name === currentTeam || m.awayTeam.name === currentTeam).flatMap(m => m.events),
      pressureData: matches.filter(m => m.homeTeam.name === currentTeam || m.awayTeam.name === currentTeam).map((m, i) => {
        const isHome = m.homeTeam.name === currentTeam;
        return { interval: `M${String(i + 1).padStart(2, '0')}`, [currentTeam]: isHome ? m.matchStats.home.spp : m.matchStats.away.spp, "상대팀": currentOppAvg.spp };
      }),
      circleEntries: [],
      attackThreatData: matches.filter(m => m.homeTeam.name === currentTeam || m.awayTeam.name === currentTeam).map((m, i) => {
        const isHome = m.homeTeam.name === currentTeam;
        const my = isHome ? m.matchStats.home : m.matchStats.away;
        const opp = isHome ? m.matchStats.away : m.matchStats.home;
        return { interval: `M${String(i + 1).padStart(2, '0')}`, [currentTeam]: my.shots + my.pcs, "상대팀": opp.shots + opp.pcs };
      }),
      build25Ratio: { home: currentTeamStats.avgBuildUp, away: currentOppAvg.build25Ratio },
      spp: { home: currentTeamStats.avgSPP, away: currentOppAvg.spp },
      matchStats: { 
        home: { 
          goals: { field: currentTeamStats.avgFieldGoals, pc: currentTeamStats.avgPCGoals }, 
          shots: currentTeamStats.avgShots,
          pcs: currentTeamStats.avgPCs,
          pcSuccessRate: currentTeamStats.avgPCSuccess,
          circleEntries: currentTeamStats.avgCircle,
          twentyFiveEntries: currentTeamStats.avg25y,
          possession: currentTeamStats.avgPoss,
          attackPossession: currentTeamStats.avgAttPoss,
          buildUpPossession: currentTeamStats.avgBuildUpPoss,
          spp: currentTeamStats.avgSPP,
          timePerCE: currentTeamStats.avgTimeCE,
          build25Ratio: currentTeamStats.avgBuildUp
        } as any, 
        away: { 
          goals: { field: currentOppAvg.fieldGoals, pc: currentOppAvg.pcGoals }, 
          shots: currentOppAvg.shots, 
          pcs: currentOppAvg.pcs, 
          pcSuccessRate: currentOppAvg.pcSuccessRate, 
          circleEntries: currentOppAvg.circleEntries, 
          twentyFiveEntries: currentOppAvg.twentyFiveEntries, 
          possession: currentOppAvg.possession, 
          attackPossession: currentOppAvg.attackPossession, 
          buildUpPossession: currentOppAvg.buildUpPossession, 
          spp: currentOppAvg.spp, 
          timePerCE: currentOppAvg.timePerCE, 
          build25Ratio: currentOppAvg.build25Ratio 
        } as any
      },
      quarterlyStats: ['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => ({ quarter: q, home: teamQAvgs[i], away: globalQAvgs[i] }))
    };

    const quadrantData = {
      attackEfficiency: teamStatsList.map(t => ({ name: t.name, x: t.avg25y, y: t.avgCircle, z: 200, color: t.color })),
      finishingEfficiency: teamStatsList.map(t => ({ name: t.name, x: t.avgCircle, y: t.avgThreat, z: 200, color: t.color })),
      defensiveResilience: teamStatsList.map(t => ({ name: t.name, x: t.avgAllowed25, y: t.avgAllowedCircle, z: 200, color: t.color })),
      circleDefense: teamStatsList.map(t => ({ name: t.name, x: t.avgAllowedCircle, y: t.avgAllowedThreat, z: 200, color: t.color })),
      pressEfficiency: teamStatsList.map(t => ({ name: t.name, x: t.avgSPP, y: t.avgAttPoss, z: 200, color: t.color }))
    };

    const allMatchesPoints = matches.filter(m => m.homeTeam.name === currentTeam || m.awayTeam.name === currentTeam).map(m => {
      const isHome = m.homeTeam.name === currentTeam;
      const my = isHome ? m.matchStats.home : m.matchStats.away;
      return { homeX: my.attackPossession, homeY: my.timePerCE === 0 ? 450 : Math.min(450, my.timePerCE), homeRawTime: my.timePerCE };
    });

    return { mockMatch, allTeams, currentTeam, globalAvg, quadrantData, allMatchesPoints, teamMatches: matches.filter(m => m.homeTeam.name === currentTeam || m.awayTeam.name === currentTeam) };
  }, [matches, selectedTeamName, selectedTeamColor, opponentColor]);

  const handleAiAnalysis = async () => {
    if (!analysisData) return;
    setIsAiLoading(true);
    try {
      const result = await analyzeMatch({ 
        type: 'tournament', 
        homeTeam: { name: analysisData.currentTeam }, 
        awayTeam: { name: '상대팀' }, 
        stats: JSON.parse(JSON.stringify(analysisData.mockMatch)) 
      });
      setAiAnalysis(result);
      toast({ title: "AI 대회 전술 분석 완료" });
    } catch (e: any) {
      toast({ title: "AI 분석 실패", description: e.message, variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
  };

  if (loading) return <div className="py-20 text-center">대회 데이터를 불러오는 중...</div>;
  if (!analysisData) return <div className="py-20 text-center">대회에 등록된 경기가 없습니다.</div>;

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-4 border-primary pb-6">
        <div>
          <h2 className="text-xl font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2"><Trophy className="h-5 w-5" /> Tournament Report</h2>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <Select value={selectedTeamName || analysisData.allTeams[0]} onValueChange={setSelectedTeamName}>
              <SelectTrigger className="w-64 h-12 text-xl font-black italic"><SelectValue placeholder="분석 팀 선택" /></SelectTrigger>
              <SelectContent>{analysisData.allTeams.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-lg border">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">분석 팀</Label>
              <Input type="color" value={selectedTeamColor} onChange={(e) => setSelectedTeamColor(e.target.value)} className="w-8 h-8 p-0 border-none bg-transparent" />
            </div>
            <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-lg border">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">상대 팀</Label>
              <Input type="color" value={opponentColor} onChange={(e) => setOpponentColor(e.target.value)} className="w-8 h-8 p-0 border-none bg-transparent" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 print-hidden">
          <Button variant="outline" className="border-primary text-primary font-bold h-11" onClick={handleAiAnalysis} disabled={isAiLoading}>
            {isAiLoading ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <BrainCircuit className="h-5 w-5 mr-2" />} AI 전술 분석
          </Button>
          <Button variant="default" className="bg-emerald-600 hover:bg-emerald-700 h-11 px-6 font-bold" onClick={() => window.print()}><FileDown className="mr-2 h-5 w-5" /> PDF 저장</Button>
        </div>
      </div>

      <div className="page-break space-y-8">
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2"><Activity className="h-6 w-6" /> 대회 종합 성과</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="평균 득점" value={analysisData.mockMatch.matchStats.home.goals.field + analysisData.mockMatch.matchStats.home.goals.pc} />
          <StatsCard title="평균 SPP" value={analysisData.mockMatch.matchStats.home.spp} isTime />
          <StatsCard title="평균 공격 점유율" value={analysisData.mockMatch.matchStats.home.attackPossession} isPercentage />
          <StatsCard title="평균 CE당 시간" value={analysisData.mockMatch.matchStats.home.timePerCE} isTime />
        </div>
        <BasicMatchStats data={analysisData.mockMatch} />
      </div>

      <div className="page-break space-y-8">
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2"><Grid3X3 className="h-6 w-6" /> 쿼터별 상세</div>
        <QuarterlyStatsTable data={analysisData.mockMatch} />
      </div>

      <div className="page-break space-y-8">
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2"><Sword className="h-6 w-6" /> 공격 분석</div>
        <AttackThreatChart data={analysisData.mockMatch.attackThreatData} homeTeam={analysisData.mockMatch.homeTeam} awayTeam={analysisData.mockMatch.awayTeam} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TacticalQuadrantChart title="공격 생성 효율" description="25y 진입 대비 서클 진입 생성" data={analysisData.quadrantData.attackEfficiency} xAxisLabel="Avg 25y Entries" yAxisLabel="Avg Circle Entries" avgX={analysisData.globalAvg.entry25} avgY={analysisData.globalAvg.circle} selectedTeamName={analysisData.currentTeam} selectedColor={selectedTeamColor} labels={{ tr: "High Activity", tl: "Efficient Entry", br: "Inefficient", bl: "Low Activity" }} />
          <TacticalQuadrantChart title="피니싱 효율" description="서클 진입 대비 공격 위협 생성" data={analysisData.quadrantData.finishingEfficiency} xAxisLabel="Avg Circle Entries" yAxisLabel="Avg Threat" avgX={analysisData.globalAvg.circle} avgY={analysisData.globalAvg.threat} selectedTeamName={analysisData.currentTeam} selectedColor={selectedTeamColor} labels={{ tr: "Dominant Attack", tl: "High Finishing", br: "Poor Finishing", bl: "Low Threat" }} />
        </div>
      </div>

      <div className="page-break space-y-8">
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2"><TrendingUp className="h-6 w-6" /> 공격 궤적</div>
        <MatchTrajectoryChart data={analysisData.mockMatch} isTournamentView={true} allMatchesPoints={analysisData.allMatchesPoints} />
      </div>

      <div className="page-break space-y-8">
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2"><Shield className="h-6 w-6" /> 수비 및 압박</div>
        <PressureBattleChart data={analysisData.mockMatch.pressureData} homeTeam={analysisData.mockMatch.homeTeam} awayTeam={analysisData.mockMatch.awayTeam} />
        <PressureAnalysisMap events={analysisData.mockMatch.events} homeTeam={analysisData.mockMatch.homeTeam} awayTeam={analysisData.mockMatch.awayTeam} awayHeader="상대팀 평균 압박" matchCount={analysisData.teamMatches.length} />
      </div>

      {aiAnalysis && (
        <div className="page-break space-y-6 pt-12 border-t-4 border-primary">
          <div className="flex items-center gap-2 text-3xl font-black text-primary uppercase italic"><Info className="h-8 w-8" /> AI Tactical Analysis Report</div>
          <Card className="border-2 border-primary/20 shadow-2xl bg-primary/5">
            <CardContent className="pt-8 space-y-8">
              <div><h3 className="text-xl font-bold mb-3 text-primary flex items-center gap-2">전술 총평</h3><p className="text-lg leading-relaxed font-medium">{aiAnalysis.summary}</p></div>
              <div className="border-t-2 border-primary/20 pt-6 text-center"><p className="text-2xl font-black italic text-primary">" {aiAnalysis.verdict} "</p></div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
