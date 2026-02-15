
"use client"

import React, { useState, useMemo } from "react"
import { Trophy, Activity, Target, Shield, Sword, Trash2, FileDown, Database, TrendingUp, Grid3X3, ArrowRight } from "lucide-react"
import type { MatchData, TeamMatchStats, Tournament } from "@/lib/types"
import { TournamentService } from "@/lib/tournament-service"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BasicMatchStats } from "./basic-match-stats"
import { AttackThreatChart } from "./attack-threat-chart"
import { PressureBattleChart } from "./pressure-battle-chart"
import { TacticalQuadrantChart } from "./tactical-quadrant-charts"
import { MatchTrajectoryChart } from "./match-trajectory-chart"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { collection, query, where } from "firebase/firestore"

interface TournamentDashboardProps {
  tournamentId: string
}

export function TournamentDashboard({ tournamentId }: TournamentDashboardProps) {
  const [selectedTeamName, setSelectedTeamName] = useState("")
  const [selectedTeamColor, setSelectedTeamColor] = useState("#ef4444")
  const [opponentColor, setOpponentColor] = useState("#f59e0b")
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

    // 각 팀별 평균 데이터 계산 로직
    const getTeamAverages = (teamName: string) => {
      const myMatches = matches.filter(m => m.homeTeam.name === teamName || m.awayTeam.name === teamName);
      const count = myMatches.length || 1;
      
      const sum = { 
        goals: 0, shots: 0, pcs: 0, circle: 0, entry25: 0, 
        possession: 0, attPoss: 0, spp: 0, timeCE: 0, 
        allowed25: 0, allowedCircle: 0, allowedShots: 0, allowedPC: 0 
      };

      myMatches.forEach(m => {
        const isHome = m.homeTeam.name === teamName;
        const my = isHome ? m.matchStats.home : m.matchStats.away;
        const opp = isHome ? m.matchStats.away : m.matchStats.home;

        sum.goals += (my.goals?.field || 0) + (my.goals?.pc || 0);
        sum.shots += (my.shots || 0);
        sum.pcs += (my.pcs || 0);
        sum.circle += (my.circleEntries || 0);
        sum.entry25 += (my.twentyFiveEntries || 0);
        sum.possession += (my.possession || 0);
        sum.attPoss += (my.attackPossession || 0);
        sum.spp += (my.spp || 0);
        sum.timeCE += (my.timePerCE || 0);

        sum.allowed25 += (opp.twentyFiveEntries || 0);
        sum.allowedCircle += (opp.circleEntries || 0);
        sum.allowedShots += (opp.shots || 0);
        sum.allowedPC += (opp.pcs || 0);
      });

      return {
        name: teamName,
        avgGoals: sum.goals / count,
        avgShots: sum.shots / count,
        avgPCs: sum.pcs / count,
        avgCircle: sum.circle / count,
        avg25y: sum.entry25 / count,
        avgPoss: sum.possession / count,
        avgAttPoss: sum.attPoss / count,
        avgSPP: sum.spp / count,
        avgTimeCE: sum.timeCE / count,
        avgAllowed25: sum.allowed25 / count,
        avgAllowedCircle: sum.allowedCircle / count,
        avgAllowedThreat: (sum.allowedShots + sum.allowedPC) / count,
        avgThreat: (sum.shots + sum.pcs) / count
      };
    };

    const teamStatsList = allTeams.map(name => getTeamAverages(name));
    
    // 대회 전체 평균 계산
    const globalCount = teamStatsList.length || 1;
    const globalAvg = {
      entry25: teamStatsList.reduce((a, b) => a + b.avg25y, 0) / globalCount,
      circle: teamStatsList.reduce((a, b) => a + b.avgCircle, 0) / globalCount,
      threat: teamStatsList.reduce((a, b) => a + b.avgThreat, 0) / globalCount,
      allowed25: teamStatsList.reduce((a, b) => a + b.avgAllowed25, 0) / globalCount,
      allowedCircle: teamStatsList.reduce((a, b) => a + b.avgAllowedCircle, 0) / globalCount,
      allowedThreat: teamStatsList.reduce((a, b) => a + b.avgAllowedThreat, 0) / globalCount,
      spp: teamStatsList.reduce((a, b) => a + b.avgSPP, 0) / globalCount,
      attPoss: teamStatsList.reduce((a, b) => a + b.avgAttPoss, 0) / globalCount,
    };

    const quadrantData = {
      attackEfficiency: teamStatsList.map(t => ({ name: t.name, x: t.avg25y, y: t.avgCircle, z: 200 })),
      finishingEfficiency: teamStatsList.map(t => ({ name: t.name, x: t.avgCircle, y: t.avgThreat, z: 200 })),
      defensiveResilience: teamStatsList.map(t => ({ name: t.name, x: t.avgAllowed25, y: t.avgAllowedCircle, z: 200 })),
      circleDefense: teamStatsList.map(t => ({ name: t.name, x: t.avgAllowedCircle, y: t.avgAllowedThreat, z: 200 })),
      pressEfficiency: teamStatsList.map(t => ({ name: t.name, x: t.avgSPP, y: t.avgAttPoss, z: 200 }))
    };

    const teamMatches = matches.filter(m => m.homeTeam.name === currentTeam || m.awayTeam.name === currentTeam);

    const mockMatch: MatchData = {
      homeTeam: { name: currentTeam, color: selectedTeamColor },
      awayTeam: { name: '대회 전체 평균', color: opponentColor },
      events: [],
      pressureData: teamMatches.map((m, i) => {
        const isHome = m.homeTeam.name === currentTeam;
        return {
          interval: `M${String(i + 1).padStart(2, '0')}`,
          [currentTeam]: isHome ? m.matchStats.home.spp : m.matchStats.away.spp,
          "상대 팀": isHome ? m.matchStats.away.spp : m.matchStats.home.spp
        };
      }),
      circleEntries: [],
      attackThreatData: teamMatches.map((m, i) => {
        const isHome = m.homeTeam.name === currentTeam;
        return {
          interval: `M${String(i + 1).padStart(2, '0')}`,
          [currentTeam]: isHome ? m.matchStats.home.shots + m.matchStats.home.pcs : m.matchStats.away.shots + m.matchStats.away.pcs,
          "상대 팀": isHome ? m.matchStats.away.shots + m.matchStats.away.pcs : m.matchStats.home.shots + m.matchStats.home.pcs
        };
      }),
      build25Ratio: { home: 0, away: 0 },
      spp: { home: 0, away: 0 },
      matchStats: { 
        home: {
          ...getTeamAverages(currentTeam),
          goals: { field: getTeamAverages(currentTeam).avgGoals, pc: 0 },
          shots: getTeamAverages(currentTeam).avgShots,
          pcs: getTeamAverages(currentTeam).avgPCs,
          circleEntries: getTeamAverages(currentTeam).avgCircle,
          twentyFiveEntries: getTeamAverages(currentTeam).avg25y,
          possession: getTeamAverages(currentTeam).avgPoss,
          attackPossession: getTeamAverages(currentTeam).avgAttPoss,
          spp: getTeamAverages(currentTeam).avgSPP,
          timePerCE: getTeamAverages(currentTeam).avgTimeCE,
          build25Ratio: 0
        } as any, 
        away: {
          goals: { field: teamStatsList.reduce((a,b)=>a+b.avgGoals,0)/globalCount, pc: 0 },
          shots: teamStatsList.reduce((a,b)=>a+b.avgShots,0)/globalCount,
          pcs: teamStatsList.reduce((a,b)=>a+b.avgPCs,0)/globalCount,
          circleEntries: globalAvg.circle,
          twentyFiveEntries: globalAvg.entry25,
          possession: teamStatsList.reduce((a,b)=>a+b.avgPoss,0)/globalCount,
          attackPossession: globalAvg.attPoss,
          spp: globalAvg.spp,
          timePerCE: teamStatsList.reduce((a,b)=>a+b.avgTimeCE,0)/globalCount,
          build25Ratio: 0
        } as any
      },
      quarterlyStats: []
    };

    return { mockMatch, allTeams, currentTeam, teamStatsList, globalAvg, quadrantData, teamMatches };
  }, [matches, selectedTeamName, selectedTeamColor, opponentColor]);

  if (loading) return <div className="py-20 text-center">대회 데이터를 불러오는 중...</div>;
  if (matches.length === 0) return <div className="py-20 text-center text-muted-foreground">데이터가 없습니다. 분석할 경기를 업로드하고 DB에 저장해 주세요.</div>;

  const trajectoryPoints = analysisData?.teamMatches.map(m => ({
    homeX: m.homeTeam.name === analysisData.currentTeam ? m.matchStats.home.attackPossession : m.matchStats.away.attackPossession,
    homeY: m.homeTeam.name === analysisData.currentTeam ? m.matchStats.home.timePerCE : m.matchStats.away.timePerCE,
    homeRawTime: m.homeTeam.name === analysisData.currentTeam ? m.matchStats.home.timePerCE : m.matchStats.away.timePerCE,
  })) || [];

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

          <Button variant="default" onClick={() => window.print()} className="h-10 bg-emerald-600 hover:bg-emerald-700 font-bold mt-auto">
            <FileDown className="h-4 w-4 mr-2" /> PDF 다운로드
          </Button>
        </div>
      </div>

      {analysisData && (
        <div className="space-y-16">
          {/* 상단 통계 요약 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <Card className="lg:col-span-1 border-2">
                <CardHeader className="bg-muted/10 border-b">
                  <CardTitle className="text-xl font-black flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" /> 분석 대상 경기 ({analysisData.teamMatches.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2 max-h-[450px] overflow-auto">
                  {analysisData.teamMatches.map((m, i) => (
                    <div key={m.id || i} className="p-4 bg-card border rounded-xl shadow-sm hover:border-primary transition-all">
                      <p className="text-xs font-black text-muted-foreground uppercase mb-1">Match {String(i+1).padStart(2, '0')}</p>
                      <p className="font-bold text-sm">{m.matchName}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">vs {m.homeTeam.name === analysisData.currentTeam ? m.awayTeam.name : m.homeTeam.name}</p>
                    </div>
                  ))}
                </CardContent>
             </Card>

             <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center gap-2 text-2xl font-black text-primary border-b-2 pb-1">
                   <Activity className="h-6 w-6" /> 대회 평균 대비 지표 (Selected vs Global Avg)
                </div>
                <BasicMatchStats data={analysisData.mockMatch} />
             </div>
          </div>

          {/* 경기별 트렌드 (상단 배치) */}
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

          {/* 공격 전술 궤적 분석 (부활) */}
          <div className="page-break space-y-8">
            <div className="flex items-center gap-2 text-2xl font-black text-primary border-b-2 pb-1">
              <Target className="h-6 w-6" /> 팀 공격 전술 궤적 분석 (Match Trajectory Analysis)
            </div>
            <MatchTrajectoryChart 
              data={analysisData.mockMatch} 
              isTournamentView 
              allMatchesPoints={trajectoryPoints} 
            />
          </div>

          {/* 4분면 전술 분석 섹션 (대형화) */}
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
                opponentColor={opponentColor}
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
                opponentColor={opponentColor}
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
                opponentColor={opponentColor}
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
                opponentColor={opponentColor}
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
                opponentColor={opponentColor}
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
