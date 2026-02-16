
"use client"

import React, { useState, useMemo } from "react"
import { Trophy, Activity, TrendingUp, Grid3X3, Loader2, BrainCircuit, FileDown, Sword, Shield } from "lucide-react"
import type { MatchData } from "@/lib/types"
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
  const [selectedTeamColor, setSelectedTeamColor] = useState("#0066ff")
  const [opponentColor, setOpponentColor] = useState("#ef4444")
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
    return [...rawMatches].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
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
      const sum = { goals: 0, fieldGoals: 0, pcGoals: 0, shots: 0, pcs: 0, circle: 0, entry25: 0, possession: 0, attPoss: 0, buildUpStagnation: 0, pcSuccess: 0, spp: 0, timeCE: 0, buildUp: 0, allowed25: 0, allowedCircle: 0, allowedShots: 0, allowedPC: 0 };

      myMatches.forEach(m => {
        const isHome = m.homeTeam.name === teamName;
        const my = isHome ? m.matchStats.home : m.matchStats.away;
        const opp = isHome ? m.matchStats.away : m.matchStats.home;
        sum.fieldGoals += (my.goals?.field || 0); sum.pcGoals += (my.goals?.pc || 0); sum.goals += (my.goals?.field || 0) + (my.goals?.pc || 0);
        sum.shots += (my.shots || 0); sum.pcs += (my.pcs || 0); sum.circle += (my.circleEntries || 0); sum.entry25 += (my.twentyFiveEntries || 0);
        sum.possession += (my.possession || 0); sum.attPoss += (my.attackPossession || 0); sum.buildUpStagnation += (my.buildUpStagnation || 0);
        sum.pcSuccess += (my.pcSuccessRate || 0); sum.spp += (my.spp || 0); sum.timeCE += (my.timePerCE || 0); sum.buildUp += (my.build25Ratio || 0);
        sum.allowed25 += (opp.twentyFiveEntries || 0); sum.allowedCircle += (opp.circleEntries || 0); sum.allowedShots += (opp.shots || 0); sum.allowedPC += (opp.pcs || 0);
      });

      return {
        name: teamName, color: teamColorMap.get(teamName),
        avgGoals: sum.goals / count, avgFieldGoals: sum.fieldGoals / count, avgPCGoals: sum.pcGoals / count,
        avgShots: sum.shots / count, avgPCs: sum.pcs / count, avgPCSuccess: sum.pcSuccess / count,
        avgCircle: sum.circle / count, avg25y: sum.entry25 / count, avgPoss: sum.possession / count,
        avgAttPoss: sum.attPoss / count, avgBuildUpStagnation: sum.buildUpStagnation / count,
        avgSPP: sum.spp / count, avgTimeCE: sum.timeCE / count, avgBuildUp: sum.buildUp / count,
        avgAllowed25: sum.allowed25 / count, avgAllowedCircle: sum.allowedCircle / count,
        avgAllowedThreat: (sum.allowedShots + sum.allowedPC) / count, avgThreat: (sum.shots + sum.pcs) / count
      };
    };

    const teamStatsList = allTeams.map(name => getTeamAverages(name));
    const globalCount = (matches.length * 2) || 1;
    const gSums = matches.reduce((acc, m) => {
      [m.matchStats.home, m.matchStats.away].forEach(s => {
        acc.goals += (s.goals?.field || 0) + (s.goals?.pc || 0); acc.shots += (s.shots || 0); acc.pcs += (s.pcs || 0);
        acc.circle += (s.circleEntries || 0); acc.a25 += (s.twentyFiveEntries || 0); acc.poss += (s.possession || 0);
        acc.att += (s.attackPossession || 0); acc.bup += (s.buildUpStagnation || 0); acc.pcSucc += (s.pcSuccessRate || 0);
        acc.spp += (s.spp || 0); acc.ceTime += (s.timePerCE || 0); acc.b25 += (s.build25Ratio || 0);
      });
      return acc;
    }, { goals: 0, shots: 0, pcs: 0, circle: 0, a25: 0, poss: 0, att: 0, bup: 0, pcSucc: 0, spp: 0, ceTime: 0, b25: 0 });

    const globalAvg = {
      goals: gSums.goals / globalCount, shots: gSums.shots / globalCount, pcs: gSums.pcs / globalCount,
      pcSuccess: gSums.pcSucc / globalCount, circle: gSums.circle / globalCount, entry25: gSums.a25 / globalCount,
      possession: gSums.poss / globalCount, attPoss: gSums.att / globalCount, stagnation: gSums.bup / globalCount,
      spp: gSums.spp / globalCount, timeCE: gSums.ceTime / globalCount, build25: gSums.b25 / globalCount,
      threat: (gSums.shots + gSums.pcs) / globalCount, allowed25: gSums.a25 / globalCount, allowedCircle: gSums.circle / globalCount, allowedThreat: (gSums.shots + gSums.pcs) / globalCount
    };

    const currentTeamStats = getTeamAverages(currentTeam);
    const mockMatch: MatchData = {
      homeTeam: { name: currentTeam, color: selectedTeamColor },
      awayTeam: { name: '대회 전체 평균', color: opponentColor },
      events: matches.filter(m => m.homeTeam.name === currentTeam || m.awayTeam.name === currentTeam).flatMap(m => m.events),
      pressureData: matches.filter(m => m.homeTeam.name === currentTeam || m.awayTeam.name === currentTeam).map((m, i) => {
        const isHome = m.homeTeam.name === currentTeam;
        return { interval: `M${String(i + 1).padStart(2, '0')} vs ${isHome ? m.awayTeam.name : m.homeTeam.name}`, [currentTeam]: isHome ? m.matchStats.home.spp : m.matchStats.away.spp, "대회 전체 평균": isHome ? m.matchStats.away.spp : m.matchStats.home.spp };
      }),
      circleEntries: [],
      attackThreatData: matches.filter(m => m.homeTeam.name === currentTeam || m.awayTeam.name === currentTeam).map((m, i) => {
        const isHome = m.homeTeam.name === currentTeam;
        const my = isHome ? m.matchStats.home : m.matchStats.away;
        const opp = isHome ? m.matchStats.away : m.matchStats.home;
        return { interval: `M${String(i + 1).padStart(2, '0')} vs ${isHome ? m.awayTeam.name : m.homeTeam.name}`, [currentTeam]: my.shots + my.pcs, "대회 전체 평균": opp.shots + opp.pcs };
      }),
      build25Ratio: { home: currentTeamStats.avgBuildUp, away: globalAvg.build25 },
      spp: { home: currentTeamStats.avgSPP, away: globalAvg.spp },
      matchStats: {
        home: { goals: { field: currentTeamStats.avgFieldGoals, pc: currentTeamStats.avgPCGoals }, shots: currentTeamStats.avgShots, pcs: currentTeamStats.avgPCs, pcSuccessRate: currentTeamStats.avgPCSuccess, circleEntries: currentTeamStats.avgCircle, twentyFiveEntries: currentTeamStats.avg25y, possession: currentTeamStats.avgPoss, attackPossession: currentTeamStats.avgAttPoss, buildUpStagnation: currentTeamStats.avgBuildUpStagnation, spp: currentTeamStats.avgSPP, timePerCE: currentTeamStats.avgTimeCE, build25Ratio: currentTeamStats.avgBuildUp } as any,
        away: { goals: { field: globalAvg.goals - globalAvg.pcSuccess/100*globalAvg.pcs, pc: globalAvg.pcSuccess/100*globalAvg.pcs }, shots: globalAvg.shots, pcs: globalAvg.pcs, pcSuccessRate: globalAvg.pcSuccess, circleEntries: globalAvg.circle, twentyFiveEntries: globalAvg.entry25, possession: globalAvg.possession, attackPossession: globalAvg.attPoss, buildUpStagnation: globalAvg.stagnation, spp: globalAvg.spp, timePerCE: globalAvg.timeCE, build25Ratio: globalAvg.build25 } as any
      },
      quarterlyStats: ['Q1', 'Q2', 'Q3', 'Q4'].map(q => ({ quarter: q, home: currentTeamStats as any, away: globalAvg as any }))
    };

    const quadrantData = {
      attackEfficiency: teamStatsList.map(t => ({ name: t.name, x: t.avg25y, y: t.avgCircle, z: 200, color: t.color })),
      finishingEfficiency: teamStatsList.map(t => ({ name: t.name, x: t.avgCircle, y: t.avgThreat, z: 200, color: t.color })),
      defensiveResilience: teamStatsList.map(t => ({ name: t.name, x: t.avgAllowed25, y: t.avgAllowedCircle, z: 200, color: t.color })),
      circleDefense: teamStatsList.map(t => ({ name: t.name, x: t.avgAllowedCircle, y: t.avgAllowedThreat, z: 200, color: t.color }))
    };

    return { mockMatch, allTeams, currentTeam, globalAvg, quadrantData, teamMatches: matches.filter(m => m.homeTeam.name === currentTeam || m.awayTeam.name === currentTeam) };
  }, [matches, selectedTeamName, selectedTeamColor, opponentColor]);

  if (loading) return <div className="py-20 text-center">대회 데이터를 불러오는 중...</div>;
  if (!analysisData) return <div className="py-20 text-center">대회에 등록된 경기가 없습니다.</div>;

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-4 border-primary pb-6">
        <div>
          <h2 className="text-xl font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2"><Trophy className="h-5 w-5" /> Tournament Report</h2>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <Select value={selectedTeamName || analysisData.allTeams[0]} onValueChange={setSelectedTeamName}><SelectTrigger className="w-64 h-12 text-xl font-black italic"><SelectValue placeholder="분석 팀 선택" /></SelectTrigger><SelectContent>{analysisData.allTeams.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select>
            <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-lg border"><Label className="text-[10px] font-bold uppercase">분석 팀 색상</Label><Input type="color" value={selectedTeamColor} onChange={(e) => setSelectedTeamColor(e.target.value)} className="w-8 h-8 p-0 border-none bg-transparent" /></div>
            <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-lg border"><Label className="text-[10px] font-bold uppercase">대회 평균 색상</Label><Input type="color" value={opponentColor} onChange={(e) => setOpponentColor(e.target.value)} className="w-8 h-8 p-0 border-none bg-transparent" /></div>
          </div>
        </div>
        <div className="flex gap-3 print-hidden">
          <Button variant="outline" className="border-primary text-primary font-bold h-11" onClick={() => toast({ title: "준비 중입니다." })}><BrainCircuit className="h-5 w-5 mr-2" /> AI 전술 분석</Button>
          <Button variant="default" className="bg-emerald-600 hover:bg-emerald-700 h-11 px-6 font-bold" onClick={() => window.print()}><FileDown className="mr-2 h-5 w-5" /> PDF 저장</Button>
        </div>
      </div>

      <div className="page-break space-y-8">
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2"><Activity className="h-6 w-6" /> 대회 종합 성과 (vs 대회 전체 평균)</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="평균 득점" value={analysisData.mockMatch.matchStats.home.goals.field + analysisData.mockMatch.matchStats.home.goals.pc} />
          <StatsCard title="평균 SPP" value={analysisData.mockMatch.matchStats.home.spp} isTime />
          <StatsCard title="평균 공격 점유율" value={analysisData.mockMatch.matchStats.home.attackPossession} isPercentage />
          <StatsCard title="평균 CE당 시간" value={analysisData.mockMatch.matchStats.home.timePerCE} isTime />
        </div>
        <BasicMatchStats data={analysisData.mockMatch} />
      </div>

      <div className="page-break space-y-8">
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2"><Grid3X3 className="h-6 w-6" /> 쿼터별 상세 (vs 대회 전체 평균)</div>
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
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2"><Shield className="h-6 w-6" /> 수비 및 압박</div>
        <PressureBattleChart data={analysisData.mockMatch.pressureData} homeTeam={analysisData.mockMatch.homeTeam} awayTeam={analysisData.mockMatch.awayTeam} />
        <PressureAnalysisMap events={analysisData.mockMatch.events} homeTeam={analysisData.mockMatch.homeTeam} awayTeam={analysisData.mockMatch.awayTeam} awayHeader="상대팀 평균 압박" matchCount={analysisData.teamMatches.length} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TacticalQuadrantChart title="수비 복원력" description="상대 25y 진입 대비 서클 진입 허용 비율" data={analysisData.quadrantData.defensiveResilience} xAxisLabel="상대 A25 허용 (평균)" yAxisLabel="상대 CE 허용 (평균)" avgX={analysisData.globalAvg.allowed25} avgY={analysisData.globalAvg.allowedCircle} selectedTeamName={analysisData.currentTeam} selectedColor={selectedTeamColor} labels={{ tr: "Vulnerable", tl: "Weak Core", br: "Solid Core", bl: "Elite Defense" }} />
          <TacticalQuadrantChart title="서클 수비 효율" description="상대 서클 진입 대비 위협 허용 비율" data={analysisData.quadrantData.circleDefense} xAxisLabel="상대 CE 허용 (평균)" yAxisLabel="상대 위협 허용 (평균)" avgX={analysisData.globalAvg.allowedCircle} avgY={analysisData.globalAvg.allowedThreat} selectedTeamName={analysisData.currentTeam} selectedColor={selectedTeamColor} labels={{ tr: "Open Circle", tl: "Weak Perimeter", br: "Solid Defense", bl: "Elite Defense" }} />
        </div>
      </div>
    </div>
  )
}
