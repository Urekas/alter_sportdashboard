
"use client"

import React, { useState, useMemo } from "react"
import { Trophy, Activity, Target, Shield, Sword, Trash2, FileDown, Database, TrendingUp } from "lucide-react"
import type { MatchData, QuarterStats, TeamMatchStats, Team } from "@/lib/types"
import { TournamentService } from "@/lib/tournament-service"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BasicMatchStats } from "./basic-match-stats"
import { QuarterlyStatsTable } from "./quarterly-stats-table"
import { MatchTrajectoryChart } from "./match-trajectory-chart"
import { AttackThreatChart } from "./attack-threat-chart"
import { PressureBattleChart } from "./pressure-battle-chart"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { collection, query, where } from "firebase/firestore"

interface TournamentDashboardProps {
  tournamentId: string
}

export function TournamentDashboard({ tournamentId }: TournamentDashboardProps) {
  const [selectedTeamName, setSelectedTeamName] = useState("")
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

  const handleDeleteMatch = async (id: string) => {
    if (!confirm("이 경기를 삭제하시겠습니까?")) return;
    try {
      await TournamentService.deleteMatch(id);
      toast({ title: "경기 삭제됨" });
    } catch (e: any) {
      toast({ title: "삭제 실패", description: e.message, variant: "destructive" });
    }
  }

  const analysisData = useMemo(() => {
    if (matches.length === 0) return null;

    const allTeams = Array.from(new Set(matches.flatMap(m => [m.homeTeam.name, m.awayTeam.name]))).sort();
    const currentTeam = selectedTeamName || allTeams[0];

    // 1. 선택한 국가의 평균 성과 계산
    const getAvgStatsForTeam = (teamName: string): TeamMatchStats => {
      const relevant = matches.filter(m => m.homeTeam.name === teamName || m.awayTeam.name === teamName);
      const count = relevant.length || 1;
      
      const sum = { goals: { field: 0, pc: 0 }, shots: 0, pcs: 0, circleEntries: 0, twentyFiveEntries: 0, possession: 0, attackPossession: 0, spp: 0, timePerCE: 0, build25Ratio: 0 };
      relevant.forEach(m => {
        const s = m.homeTeam.name === teamName ? m.matchStats.home : m.matchStats.away;
        sum.goals.field += (s.goals?.field || 0); sum.goals.pc += (s.goals?.pc || 0);
        sum.shots += (s.shots || 0); sum.pcs += (s.pcs || 0); sum.circleEntries += (s.circleEntries || 0);
        sum.twentyFiveEntries += (s.twentyFiveEntries || 0); sum.possession += (s.possession || 0);
        sum.attackPossession += (s.attackPossession || 0); sum.spp += (s.spp || 0);
        sum.timePerCE += (s.timePerCE || 0); sum.build25Ratio += (s.build25Ratio || 0);
      });

      return {
        goals: { field: sum.goals.field / count, pc: sum.goals.pc / count },
        shots: sum.shots / count, pcs: sum.pcs / count, circleEntries: sum.circleEntries / count,
        twentyFiveEntries: sum.twentyFiveEntries / count, possession: sum.possession / count,
        attackPossession: sum.attackPossession / count, spp: sum.spp / count,
        timePerCE: sum.timePerCE / count, build25Ratio: sum.build25Ratio / count,
        allowedSpp: 0, avgAttackDuration: 0, pressAttempts: 0, pressSuccess: 0
      } as TeamMatchStats;
    };

    // 2. 대회 전체 평균 (모든 경기의 모든 팀 평균)
    const getGlobalAvgStats = (): TeamMatchStats => {
      let totalCount = matches.length * 2;
      const sum = { goals: { field: 0, pc: 0 }, shots: 0, pcs: 0, circleEntries: 0, twentyFiveEntries: 0, possession: 0, attackPossession: 0, spp: 0, timePerCE: 0, build25Ratio: 0 };
      
      matches.forEach(m => {
        [m.matchStats.home, m.matchStats.away].forEach(s => {
          sum.goals.field += (s.goals?.field || 0); sum.goals.pc += (s.goals?.pc || 0);
          sum.shots += (s.shots || 0); sum.pcs += (s.pcs || 0); sum.circleEntries += (s.circleEntries || 0);
          sum.twentyFiveEntries += (s.twentyFiveEntries || 0); sum.possession += (s.possession || 0);
          sum.attackPossession += (s.attackPossession || 0); sum.spp += (s.spp || 0);
          sum.timePerCE += (s.timePerCE || 0); sum.build25Ratio += (s.build25Ratio || 0);
        });
      });

      return {
        goals: { field: sum.goals.field / totalCount, pc: sum.goals.pc / totalCount },
        shots: sum.shots / totalCount, pcs: sum.pcs / totalCount, circleEntries: sum.circleEntries / totalCount,
        twentyFiveEntries: sum.twentyFiveEntries / totalCount, possession: sum.possession / totalCount,
        attackPossession: sum.attackPossession / totalCount, spp: sum.spp / totalCount,
        timePerCE: sum.timePerCE / totalCount, build25Ratio: sum.build25Ratio / totalCount,
        allowedSpp: 0, avgAttackDuration: 0, pressAttempts: 0, pressSuccess: 0
      } as TeamMatchStats;
    };

    // 3. 쿼터별 통계 (선택 팀 vs 대회 평균)
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const avgQuarterly = quarters.map(q => {
      const teamRelevant = matches.filter(m => m.homeTeam.name === currentTeam || m.awayTeam.name === currentTeam);
      const teamCount = teamRelevant.length || 1;
      const globalCount = matches.length || 1;

      const getQStats = (matchList: MatchData[], tName?: string) => {
        const sums: any = { shots: 0, spp: 0, timePerCE: 0, possession: 0, attackPossession: 0, pcs: 0, circleEntries: 0, twentyFiveEntries: 0 };
        matchList.forEach(m => {
          const s = tName ? (m.homeTeam.name === tName ? m.quarterlyStats.find(qs => qs.quarter === q)?.home : m.quarterlyStats.find(qs => qs.quarter === q)?.away) 
                         : m.quarterlyStats.find(qs => qs.quarter === q);
          if (s) {
            const data = tName ? s : [(s as any).home, (s as any).away];
            (Array.isArray(data) ? data : [data]).forEach(d => {
              Object.keys(sums).forEach(k => sums[k] += (d as any)[k] || 0);
            });
          }
        });
        const divider = tName ? teamCount : globalCount * 2;
        Object.keys(sums).forEach(k => sums[k] /= divider);
        return { ...sums, goals: { field: 0, pc: 0 } };
      };

      return {
        quarter: q,
        home: getQStats(teamRelevant, currentTeam),
        away: getQStats(matches)
      } as QuarterStats;
    });

    // 4. 경기별 트렌드 데이터 (Attack Threat & Pressure)
    // 파랑: 선택팀 수치, 빨강: 상대팀 수치
    const teamMatches = matches.filter(m => m.homeTeam.name === currentTeam || m.awayTeam.name === currentTeam);
    const trendAttackThreat = teamMatches.map((m, i) => {
      const isHome = m.homeTeam.name === currentTeam;
      return {
        interval: `M${String(i + 1).padStart(2, '0')}`,
        [currentTeam]: isHome ? m.matchStats.home.shots + m.matchStats.home.pcs : m.matchStats.away.shots + m.matchStats.away.pcs,
        "Opponent": isHome ? m.matchStats.away.shots + m.matchStats.away.pcs : m.matchStats.home.shots + m.matchStats.home.pcs
      };
    });

    const trendPressure = teamMatches.map((m, i) => {
      const isHome = m.homeTeam.name === currentTeam;
      return {
        interval: `M${String(i + 1).padStart(2, '0')}`,
        [currentTeam]: isHome ? m.matchStats.home.spp : m.matchStats.away.spp,
        "Opponent": isHome ? m.matchStats.away.spp : m.matchStats.home.spp
      };
    });

    const mockMatch: MatchData = {
      homeTeam: { name: currentTeam, color: 'hsl(var(--chart-1))' },
      awayTeam: { name: '대회 전체 평균', color: 'hsl(var(--chart-2))' },
      events: [],
      pressureData: trendPressure,
      circleEntries: [],
      attackThreatData: trendAttackThreat,
      build25Ratio: { home: 0, away: 0 },
      spp: { home: 0, away: 0 },
      matchStats: { home: getAvgStatsForTeam(currentTeam), away: getGlobalAvgStats() },
      quarterlyStats: avgQuarterly
    };

    return { mockMatch, allTeams, currentTeam };
  }, [matches, selectedTeamName]);

  if (loading) return <div className="py-20 text-center">대회 데이터를 불러오는 중...</div>;
  if (matches.length === 0) return <div className="py-20 text-center text-muted-foreground">이 대회에 저장된 경기가 없습니다. 경기 분석 후 '대회 DB 저장'을 눌러주세요.</div>;

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b-2 pb-4 gap-4">
        <div>
          <h1 className="text-3xl font-black italic text-primary uppercase">Tournament Aggregate Analysis</h1>
          <p className="text-muted-foreground font-bold">국가별 성과 vs 대회 평균 비교 리포트</p>
        </div>
        <div className="flex items-center gap-4 bg-card p-3 rounded-lg border shadow-sm w-full md:w-auto">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase">분석 대상 국가 선택</Label>
            <Select value={selectedTeamName || (analysisData?.currentTeam || "")} onValueChange={setSelectedTeamName}>
              <SelectTrigger className="h-8 w-48 text-xs font-bold">
                <SelectValue placeholder="팀 선택" />
              </SelectTrigger>
              <SelectContent>
                {analysisData?.allTeams.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="default" onClick={() => window.print()} className="h-9 bg-emerald-600">
            <FileDown className="h-4 w-4 mr-2" /> 대회 리포트 PDF
          </Button>
        </div>
      </div>

      {analysisData && (
        <div className="space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">분석 대상 경기 목록</CardTitle>
                <CardDescription>{analysisData.currentTeam}가 치른 {matches.filter(m => m.homeTeam.name === analysisData.currentTeam || m.awayTeam.name === analysisData.currentTeam).length}개의 경기</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[400px] overflow-auto">
                {matches.filter(m => m.homeTeam.name === analysisData.currentTeam || m.awayTeam.name === analysisData.currentTeam).map((m, i) => (
                  <div key={m.id || i} className="flex justify-between items-center p-3 bg-muted/20 rounded-lg border group">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-muted-foreground">M{String(i+1).padStart(2, '0')}</span>
                      <div>
                        <p className="text-sm font-bold">{m.matchName}</p>
                        <p className="text-[10px] text-muted-foreground">vs {m.homeTeam.name === analysisData.currentTeam ? m.awayTeam.name : m.homeTeam.name}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center gap-2 text-xl font-bold text-primary border-b pb-1">
                <Database className="h-5 w-5" /> 누적 성과 요약 ({analysisData.currentTeam} vs 대회 평균)
              </div>
              <BasicMatchStats data={analysisData.mockMatch} />
            </div>
          </div>

          <div className="page-break">
             <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2 mb-6">
               <Activity className="h-6 w-6" /> 쿼터별 평균 퍼포먼스 비교
             </div>
             <QuarterlyStatsTable data={analysisData.mockMatch} />
          </div>

          <div className="page-break">
            <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2 mb-6">
              <TrendingUp className="h-6 w-6" /> 경기별 트렌드 분석 (Trend Analysis)
            </div>
            <div className="grid grid-cols-1 gap-8">
              <AttackThreatChart 
                data={analysisData.mockMatch.attackThreatData} 
                homeTeam={{ name: analysisData.currentTeam, color: 'hsl(var(--chart-1))' }} 
                awayTeam={{ name: 'Opponent', color: 'hsl(var(--chart-2))' }} 
              />
              <PressureBattleChart 
                data={analysisData.mockMatch.pressureData} 
                homeTeam={{ name: analysisData.currentTeam, color: 'hsl(var(--chart-1))' }} 
                awayTeam={{ name: 'Opponent', color: 'hsl(var(--chart-2))' }} 
                height={300} 
              />
              <p className="text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg italic">
                * 위 차트의 X축은 시간(5분)이 아닌 해당 국가가 치른 <b>경기 순서(Match Number)</b>를 나타냅니다.<br/>
                * <b>{analysisData.currentTeam} (Blue)</b>: 해당 경기에서의 우리 팀 수치 / <b>상대팀 (Red)</b>: 해당 경기에서 맞붙은 팀의 수치
              </p>
            </div>
          </div>

          <div className="page-break">
            <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2 mb-6">
              <Target className="h-6 w-6" /> 대회 전술 위치 분석 (Global Positioning)
            </div>
            <MatchTrajectoryChart data={analysisData.mockMatch} />
            <p className="text-xs text-muted-foreground mt-4 text-center font-bold">
              * 파란색 원은 <b>{analysisData.currentTeam}</b>의 대회 전체 평균이며, 빨간색 원은 대회에 참가한 <b>모든 국가의 전체 평균</b>입니다.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
