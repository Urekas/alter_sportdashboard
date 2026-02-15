"use client"

import React, { useState, useMemo } from "react"
import { Trophy, Activity, Target, Shield, Sword, Trash2, FileDown, Database } from "lucide-react"
import type { MatchData, QuarterStats, TeamMatchStats } from "@/lib/types"
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

  // 1. 대회별 경기 목록 쿼리 생성 및 메모이제이션
  const matchesQuery = useMemoFirebase(() => {
    if (!db || !tournamentId) return null;
    return query(
      collection(db, 'matches'),
      where('tournamentId', '==', tournamentId)
    );
  }, [db, tournamentId]);

  // 2. 실시간 데이터 구독
  const { data: rawMatches, isLoading: loading } = useCollection<MatchData>(matchesQuery);

  // 3. 클라이언트 측 정렬 (인덱스 에러 방지)
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

  // 대회 전체 평균 데이터 계산
  const tournamentStats = useMemo(() => {
    if (matches.length === 0) return null;

    // 첫 번째 경기의 팀명을 기본 선택값으로 설정
    const currentTeam = selectedTeamName || matches[0].homeTeam.name;

    const avgStats = (teamName: string): TeamMatchStats => {
      const relevant = matches.filter(m => m.homeTeam.name === teamName || m.awayTeam.name === teamName);
      const count = relevant.length || 1;
      
      const sum = {
        goals: { field: 0, pc: 0 },
        shots: 0, pcs: 0, circleEntries: 0, twentyFiveEntries: 0,
        possession: 0, attackPossession: 0, spp: 0, timePerCE: 0, build25Ratio: 0
      };

      relevant.forEach(m => {
        const s = m.homeTeam.name === teamName ? m.matchStats.home : m.matchStats.away;
        sum.goals.field += (s.goals?.field || 0);
        sum.goals.pc += (s.goals?.pc || 0);
        sum.shots += (s.shots || 0);
        sum.pcs += (s.pcs || 0);
        sum.circleEntries += (s.circleEntries || 0);
        sum.twentyFiveEntries += (s.twentyFiveEntries || 0);
        sum.possession += (s.possession || 0);
        sum.attackPossession += (s.attackPossession || 0);
        sum.spp += (s.spp || 0);
        sum.timePerCE += (s.timePerCE || 0);
        sum.build25Ratio += (s.build25Ratio || 0);
      });

      return {
        goals: { field: sum.goals.field / count, pc: sum.goals.pc / count },
        shots: sum.shots / count,
        pcs: sum.pcs / count,
        circleEntries: sum.circleEntries / count,
        twentyFiveEntries: sum.twentyFiveEntries / count,
        possession: sum.possession / count,
        attackPossession: sum.attackPossession / count,
        spp: sum.spp / count,
        timePerCE: sum.timePerCE / count,
        build25Ratio: sum.build25Ratio / count,
        allowedSpp: 0, avgAttackDuration: 0, pressAttempts: 0, pressSuccess: 0
      } as TeamMatchStats;
    };

    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const avgQuarterly = quarters.map(q => {
      const qHomeSums: any = { shots: 0, spp: 0, timePerCE: 0, possession: 0, attackPossession: 0 };
      const qAwaySums: any = { shots: 0, spp: 0, timePerCE: 0, possession: 0, attackPossession: 0 };
      
      matches.forEach(m => {
        const qData = m.quarterlyStats?.find(qs => qs.quarter === q);
        if (qData) {
          ['shots', 'spp', 'timePerCE', 'possession', 'attackPossession'].forEach(key => {
            qHomeSums[key] += (qData.home as any)[key] || 0;
            qAwaySums[key] += (qData.away as any)[key] || 0;
          });
        }
      });

      const count = matches.length || 1;
      const normalize = (sums: any) => {
        const res: any = {};
        Object.keys(sums).forEach(k => res[k] = sums[k] / count);
        return res;
      };

      return {
        quarter: q,
        home: { ...normalize(qHomeSums), goals: { field: 0, pc: 0 }, pcs: 0, circleEntries: 0, twentyFiveEntries: 0, build25Ratio: 0 },
        away: { ...normalize(qAwaySums), goals: { field: 0, pc: 0 }, pcs: 0, circleEntries: 0, twentyFiveEntries: 0, build25Ratio: 0 }
      } as QuarterStats;
    });

    const trajectoryData = matches.map((m, i) => {
      const isHome = m.homeTeam.name === currentTeam;
      return {
        quarter: `M${String(i + 1).padStart(2, '0')}`,
        home: isHome ? m.matchStats.home : m.matchStats.away,
        away: isHome ? m.matchStats.away : m.matchStats.home
      } as QuarterStats;
    });

    const avgThreat = matches[0].attackThreatData?.map((d, idx) => {
      let hSum = 0, aSum = 0;
      matches.forEach(m => {
        hSum += Number(m.attackThreatData[idx]?.[m.homeTeam.name] || 0);
        aSum += Number(m.attackThreatData[idx]?.[m.awayTeam.name] || 0);
      });
      return {
        interval: d.interval,
        [matches[0].homeTeam.name]: hSum / matches.length,
        [matches[0].awayTeam.name]: aSum / matches.length
      };
    }) || [];

    const avgPressure = matches[0].pressureData?.map((d, idx) => {
      let hSum = 0, aSum = 0;
      matches.forEach(m => {
        hSum += Number(m.pressureData[idx]?.[m.homeTeam.name] || 0);
        aSum += Number(m.pressureData[idx]?.[m.awayTeam.name] || 0);
      });
      return {
        interval: d.interval,
        [matches[0].homeTeam.name]: hSum / matches.length,
        [matches[0].awayTeam.name]: aSum / matches.length
      };
    }) || [];

    const mockMatch: MatchData = {
      homeTeam: matches[0].homeTeam,
      awayTeam: matches[0].awayTeam,
      events: [],
      pressureData: avgPressure,
      circleEntries: [],
      attackThreatData: avgThreat,
      build25Ratio: { home: 0, away: 0 },
      spp: { home: 0, away: 0 },
      matchStats: { home: avgStats(matches[0].homeTeam.name), away: avgStats(matches[0].awayTeam.name) },
      quarterlyStats: avgQuarterly
    };

    return { mockMatch, trajectoryData, currentTeam };
  }, [matches, selectedTeamName]);

  if (loading) return <div className="py-20 text-center">대회 데이터를 불러오는 중...</div>;
  if (matches.length === 0) return <div className="py-20 text-center text-muted-foreground">이 대회에 저장된 경기가 없습니다. 경기 분석 후 '대회 DB 저장'을 눌러주세요.</div>;

  const allTeams = Array.from(new Set(matches.flatMap(m => [m.homeTeam.name, m.awayTeam.name]))).sort();

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b-2 pb-4 gap-4">
        <div>
          <h1 className="text-3xl font-black italic text-primary uppercase">Tournament Aggregate Analysis</h1>
          <p className="text-muted-foreground font-bold">대회 누적 데이터 및 평균 성과 분석 리포트</p>
        </div>
        <div className="flex items-center gap-4 bg-card p-3 rounded-lg border shadow-sm w-full md:w-auto">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase">팀별 성과 조회</Label>
            <Select value={selectedTeamName || (tournamentStats?.currentTeam || "")} onValueChange={setSelectedTeamName}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="팀 선택" />
              </SelectTrigger>
              <SelectContent>
                {allTeams.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="default" onClick={() => window.print()} className="h-9 bg-emerald-600">
            <FileDown className="h-4 w-4 mr-2" /> 대회 리포트 PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">경기 목록 (Matches in Tournament)</CardTitle>
            <CardDescription>대회에 포함된 개별 경기 리스트</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {matches.map((m, i) => (
              <div key={m.id || i} className="flex justify-between items-center p-3 bg-muted/20 rounded-lg border group">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-muted-foreground">M{String(i+1).padStart(2, '0')}</span>
                  <div>
                    <p className="text-sm font-bold">{m.matchName}</p>
                    <p className="text-[10px] text-muted-foreground">{m.uploadedAt?.seconds ? new Date(m.uploadedAt.seconds * 1000).toLocaleDateString() : '최근 업로드'}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteMatch(m.id!)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {tournamentStats && (
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-2 text-xl font-bold text-primary border-b pb-1">
              <Database className="h-5 w-5" /> 대회 평균 퍼포먼스 (Average Stats)
            </div>
            <BasicMatchStats data={tournamentStats.mockMatch} />
          </div>
        )}
      </div>

      {tournamentStats && (
        <div className="space-y-12 mt-12">
          <div className="page-break">
             <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2 mb-6">
               <Activity className="h-6 w-6" /> 대회 쿼터별 평균 추이 (Tournament Avg. Quarterly)
             </div>
             <QuarterlyStatsTable data={tournamentStats.mockMatch} />
          </div>

          <div className="page-break">
            <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2 mb-6">
              <Sword className="h-6 w-6" /> 대회 공격 및 압박 밸런스 (Avg. Threat & Pressure)
            </div>
            <div className="grid grid-cols-1 gap-8">
              <AttackThreatChart data={tournamentStats.mockMatch.attackThreatData} homeTeam={tournamentStats.mockMatch.homeTeam} awayTeam={tournamentStats.mockMatch.awayTeam} />
              <PressureBattleChart data={tournamentStats.mockMatch.pressureData} homeTeam={tournamentStats.mockMatch.homeTeam} awayTeam={tournamentStats.mockMatch.awayTeam} height={300} />
            </div>
          </div>

          <div className="page-break">
            <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2 mb-6">
              <Target className="h-6 w-6" /> 대회 전술 궤적 흐름 (Tournament Trajectory)
            </div>
            <MatchTrajectoryChart data={{
              ...tournamentStats.mockMatch,
              quarterlyStats: tournamentStats.trajectoryData
            }} />
            <p className="text-xs text-muted-foreground mt-4 text-center font-bold">
              * M01, M02 등은 각 경기의 수치를 나타내며, 배경의 큰 팀명은 대회 전체의 평균 위치를 의미합니다.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
