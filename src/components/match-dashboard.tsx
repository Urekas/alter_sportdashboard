
"use client";

import { useState, useMemo } from "react";
import type { MatchData } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BasicMatchStats } from "./basic-match-stats";
import { AttackThreatChart } from "./attack-threat-chart";
import { PressureBattleChart } from "./pressure-battle-chart";
import { TacticalQuadrantChart } from "./tactical-quadrant-charts";
import { MatchTrajectoryChart } from "./match-trajectory-chart";
import { QuarterlyStatsTable } from "./quarterly-stats-table";
import { PressureAnalysisMap } from "./pressure-analysis-map";
import { useToast } from "@/hooks/use-toast";
import { Loader2, BrainCircuit, Sparkles, Info, FileDown, TrendingUp, TrendingDown, Target, Shield, Sword, Activity, Grid3X3 } from "lucide-react";
import { analyzeMatch, type MatchAnalysisOutput } from "@/ai/flows/match-analysis-flow";

interface MatchDashboardProps {
  match: MatchData;
}

export function MatchDashboard({ match }: MatchDashboardProps) {
  const [aiAnalysis, setAiAnalysis] = useState<MatchAnalysisOutput | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const { toast } = useToast();
  
  const { homeTeam, awayTeam, matchStats, attackThreatData, pressureData, events } = match;

  const handleAiAnalysis = async () => {
    setIsAiLoading(true);
    try {
      const sanitizedStats = JSON.parse(JSON.stringify(match));
      const result = await analyzeMatch({ type: 'match', matchName: `${homeTeam.name} vs ${awayTeam.name}`, homeTeam, awayTeam, stats: sanitizedStats });
      setAiAnalysis(result);
      toast({ title: "AI 분석 완료" });
    } catch (e: any) {
      toast({ title: "AI 분석 실패", description: e.message, variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-4 pb-6 print:border-b-2" style={{ borderColor: 'hsl(var(--primary))' }}>
        <div>
          <p className="text-lg font-bold text-muted-foreground uppercase tracking-widest">Match Report</p>
          <div className="flex items-end gap-4">
            <h1 className="text-5xl font-black italic uppercase tracking-tighter" style={{ color: homeTeam.color }}>{homeTeam.name}</h1>
            <span className="text-4xl font-bold text-muted-foreground">VS</span>
            <h1 className="text-5xl font-black italic uppercase tracking-tighter" style={{ color: awayTeam.color }}>{awayTeam.name}</h1>
          </div>
        </div>
        <div className="flex gap-2 print-hidden">
          <Button variant="outline" className="border-orange-500 text-orange-500 font-bold h-11" onClick={() => window.open('/Alter_sportsplay/index.html', '_blank')}>
            <Video className="h-5 w-5 mr-2" />
            비디오 분석 도구
          </Button>
          <Button variant="outline" className="border-primary text-primary font-bold h-11" onClick={handleAiAnalysis} disabled={isAiLoading}>
            {isAiLoading ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <BrainCircuit className="h-5 w-5 mr-2" />}
            AI 분석
          </Button>
          <Button variant="default" className="bg-emerald-600 hover:bg-emerald-700 h-11 px-6 font-bold" onClick={() => window.print()}><FileDown className="mr-2 h-5 w-5" /> PDF 저장</Button>
        </div>
      </div>

      <div className="page-break space-y-8">
        <div className="mb-6 hidden print:block border-b-2 pb-4">
            <h1 className="text-4xl font-black italic text-primary uppercase tracking-tighter">{homeTeam.name} vs {awayTeam.name}</h1>
            <p className="text-muted-foreground font-bold">Match Report</p>
        </div>
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
          <Grid3X3 className="h-6 w-6" /> 종합 데이터
        </div>
        <BasicMatchStats data={match} />
      </div>

      <div className="page-break space-y-8">
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
          <Activity className="h-6 w-6" /> 쿼터별 상세 데이터
        </div>
        <QuarterlyStatsTable data={match} />
      </div>

      <div className="page-break space-y-8">
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
          <Sword className="h-6 w-6" /> 공격 성능 분석
        </div>
        <AttackThreatChart data={attackThreatData} homeTeam={homeTeam} awayTeam={awayTeam} events={events} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <TacticalQuadrantChart
            title="공격 생성 효율"
            description="점유율 대비 서클 진입 생성 빈도"
            xAxisLabel="Possession (%)"
            yAxisLabel="Circle Entries"
            data={[{ name: homeTeam.name, x: matchStats.home.possession, y: matchStats.home.circleEntries, color: homeTeam.color }, { name: awayTeam.name, x: matchStats.away.possession, y: matchStats.away.circleEntries, color: awayTeam.color }]}
            labels={{ tr: "Dominant", tl: "Efficient", br: "Inefficient", bl: "Defensive" }}
          />
          <TacticalQuadrantChart
             title="피니싱 효율"
             description="서클 진입 대비 위협 창출"
             xAxisLabel="Circle Entries"
             yAxisLabel="Threat (Shots+PC)"
             data={[{ name: homeTeam.name, x: matchStats.home.circleEntries, y: matchStats.home.shots + matchStats.home.pcs, color: homeTeam.color }, { name: awayTeam.name, x: matchStats.away.circleEntries, y: matchStats.away.shots + matchStats.away.pcs, color: awayTeam.color }]}
             labels={{ tr: "Lethal", tl: "Sharp", br: "Wasteful", bl: "Low Impact" }}
          />
        </div>
      </div>

      <div className="page-break space-y-8">
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
          <TrendingUp className="h-6 w-6" /> 매치 트래직토리
        </div>
        <MatchTrajectoryChart data={match} />
      </div>

      <div className="page-break space-y-8">
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
          <Shield className="h-6 w-6" /> 압박 분석
        </div>
        <PressureBattleChart data={pressureData} homeTeam={homeTeam} awayTeam={awayTeam} />
        <div className="mt-6">
          <PressureAnalysisMap
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              homeStats={match.pressureData?.homePressures}
              awayStats={match.pressureData?.awayPressures}
              isTournament={false}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <TacticalQuadrantChart
            title="수비 복원력"
            description="상대 점유 허용 대비 서클 진입 허용"
            xAxisLabel="Allowed Possession (%)"
            yAxisLabel="Allowed Circle Entries"
            reversedX reversedY
            data={[{ name: homeTeam.name, x: matchStats.away.possession, y: matchStats.away.circleEntries, color: homeTeam.color }, { name: awayTeam.name, x: matchStats.home.possession, y: matchStats.home.circleEntries, color: awayTeam.color }]}
            labels={{ tr: "Weak", tl: "Vulnerable", br: "Resilient", bl: "Fortress" }}
          />
          <TacticalQuadrantChart
            title="서클 수비 효율"
            description="서클 허용 대비 위협 허용 억제"
            xAxisLabel="Allowed Circle Entries"
            yAxisLabel="Allowed Threat (Shots+PC)"
            reversedX reversedY
            data={[{ name: homeTeam.name, x: matchStats.away.circleEntries, y: matchStats.away.shots + matchStats.away.pcs, color: homeTeam.color }, { name: awayTeam.name, x: matchStats.home.circleEntries, y: matchStats.home.shots + matchStats.home.pcs, color: awayTeam.color }]}
            labels={{ tr: "Brittle", tl: "Passive", br: "Solid", bl: "Impenetrable" }}
          />
        </div>
      </div>

      {aiAnalysis && (
        <div className="page-break space-y-8">
          <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
            <Sparkles className="h-6 w-6" /> AI 전술 분석 리포트 (Field Focus | Hockey Analytics)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-2 border-primary/20"><CardHeader className="bg-primary/5"><CardTitle className="text-lg flex items-center gap-2"><Info className="h-5 w-5 text-primary" /> 1. 경기 최종 결과 요약</CardTitle></CardHeader><CardContent className="pt-6"><p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{aiAnalysis.matchSummary}</p></CardContent></Card>
            <Card className="border-2 border-primary/20"><CardHeader className="bg-emerald-500/5"><CardTitle className="text-lg flex items-center gap-2"><Target className="h-5 w-5 text-emerald-600" /> 2. 핵심 성능 지표 (KPI) 분석</CardTitle></CardHeader><CardContent className="pt-6"><p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{aiAnalysis.kpiAnalysis}</p></CardContent></Card>
            <Card className="border-2 border-primary/20"><CardHeader className="bg-blue-500/5"><CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5 text-blue-600" /> 3. 주요 그래프 및 데이터 해석</CardTitle></CardHeader><CardContent className="pt-6"><p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{aiAnalysis.dataInterpretation}</p></CardContent></Card>
            <Card className="border-2 border-primary/20"><CardHeader className="bg-orange-500/5"><CardTitle className="text-lg flex items-center gap-2"><Activity className="h-5 w-5 text-orange-600" /> 4. 쿼터별 세부 특징</CardTitle></CardHeader><CardContent className="pt-6"><p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{aiAnalysis.quarterlyAnalysis}</p></CardContent></Card>
          </div>
          <Card className="bg-primary text-primary-foreground border-none shadow-xl"><CardContent className="p-6 flex items-center gap-4"><div className="bg-white/20 p-3 rounded-xl"><Sparkles className="h-8 w-8 text-white" /></div><div><p className="text-xs font-bold uppercase tracking-widest opacity-80">5. 최종 분석</p><p className="text-sm font-semibold mt-2 whitespace-pre-wrap">{aiAnalysis.finalVerdict}</p></div></CardContent></Card>
        </div>
      )}
    </div>
  );
}
