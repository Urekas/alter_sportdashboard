
'use client';

import React, { useState, useMemo } from "react";
import { Trophy, Activity, Grid3X3, Loader2, FileDown, Sword, Shield, TrendingUp, Target, TrendingDown, ShieldCheck, BrainCircuit, Sparkles, Info, MessageSquare } from "lucide-react";
import type { MatchData, TeamMatchStats } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BasicMatchStats } from "./basic-match-stats";
import { AttackThreatChart } from "./attack-threat-chart";
import { PressureBattleChart } from "./pressure-battle-chart";
import { TacticalQuadrantChart } from "./tactical-quadrant-charts";
import { MatchTrajectoryChart } from "./match-trajectory-chart";
import { QuarterlyStatsTable } from "./quarterly-stats-table";
import { PressureAnalysisMap } from "./pressure-analysis-map";
import { StatsCard } from "./stats-card";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useFirestore, useMemoFirebase, useCollection } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { mapZone } from "@/lib/parser";
import { analyzeMatch, type MatchAnalysisOutput } from "@/ai/flows/match-analysis-flow";

interface TournamentDashboardProps {
  tournamentId: string;
}

const getTeamColor = (name: string, index: number): string => {
  const colors = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6"];
  return colors[index % colors.length];
};

export function TournamentDashboard({ tournamentId }: TournamentDashboardProps) {
  const [selectedTeamName, setSelectedTeamName] = useState("");
  const [selectedTeamColor, setSelectedTeamColor] = useState("#0066ff");
  const [opponentColor, setOpponentColor] = useState("#ef4444");
  const [aiAnalysis, setAiAnalysis] = useState<MatchAnalysisOutput | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const db = useFirestore();
  const { toast } = useToast();

  const matchesQuery = useMemoFirebase(() => {
    if (!db || !tournamentId) return null;
    return query(collection(db, 'matches'), where('tournamentId', '==', tournamentId));
  }, [db, tournamentId]);

  const { data: rawMatches, isLoading: loading } = useCollection<MatchData>(matchesQuery);

  const matches = useMemo(() => {
    if (!rawMatches) return [];
    return [...rawMatches].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }, [rawMatches]);

  const tournamentName = useMemo(() => {
    if (matches.length > 0) return matches[0].tournamentName || "Tournament Report";
    return "Tournament Report";
  }, [matches]);

  const analysisData = useMemo(() => {
    if (matches.length === 0) return null;

    const allTeams = Array.from(new Set(matches.flatMap(m => [m.homeTeam.name, m.awayTeam.name]))).sort();
    const currentTeam = selectedTeamName || allTeams[0];
    const teamMatches = matches.filter(m => m.homeTeam.name === currentTeam || m.awayTeam.name === currentTeam);

    const aggregateStats = (targetMatches: MatchData[], teamName?: string) => {
        const relevantMatches = teamName ? targetMatches.filter(m => m.homeTeam.name === teamName || m.awayTeam.name === teamName) : targetMatches;
        
        const statsSum = {
            shots: 0, pcs: 0, circleEntries: 0, twentyFiveEntries: 0,
            possession: 0, attackPossession: 0, buildUpStagnation: 0, spp: 0,
            timePerCE: 0, pressAttempts: 0, pressSuccess: 0, threat: 0,
            allowedThreat: 0, allowedCircleEntries: 0, allowedPossession: 0,
            goals: { field: 0, pc: 0 },
            pcSuccessRate: 0,
            build25Ratio: 0,
            goalsAllowed: 0
        };

        if (relevantMatches.length === 0) {
           return { ...statsSum, timePerCE: 0 };
        }

        relevantMatches.forEach(m => {
            const isHome = !teamName || m.homeTeam.name === teamName;
            const s = isHome ? m.matchStats.home : m.matchStats.away;
            const opp = isHome ? m.matchStats.away : m.matchStats.home;

            statsSum.goals.field += s.goals.field; statsSum.goals.pc += s.goals.pc;
            statsSum.shots += s.shots; statsSum.pcs += s.pcs; statsSum.circleEntries += s.circleEntries;
            statsSum.twentyFiveEntries += s.twentyFiveEntries; statsSum.possession += s.possession;
            statsSum.attackPossession += s.attackPossession; statsSum.buildUpStagnation += s.buildUpStagnation;
            statsSum.pcSuccessRate += s.pcSuccessRate; 
            statsSum.spp += s.spp;
            statsSum.timePerCE += s.timePerCE;
            statsSum.build25Ratio += s.build25Ratio;
            statsSum.pressAttempts += s.pressAttempts; statsSum.pressSuccess += s.pressSuccess;
            statsSum.threat += (s.shots + s.pcs);
            statsSum.allowedThreat += (opp.shots + opp.pcs);
            statsSum.allowedCircleEntries += opp.circleEntries; 
            statsSum.allowedPossession += opp.possession;
            statsSum.goalsAllowed += (opp.goals.field + opp.goals.pc);
        });

        const count = relevantMatches.length;
        const div = count || 1;
        const aggregated = Object.fromEntries(
            Object.entries(statsSum).map(([key, value]) => {
                if (key === 'goals') return [key, { field: value.field / div, pc: value.pc / div }];
                if (typeof value === 'number') return [key, value / div];
                return [key, value];
            })
        ) as any;

        return aggregated;
    };
    
    const allTeamsStats = allTeams.map(teamName => ({ name: teamName, stats: aggregateStats(matches, teamName) }));

    const getRank = (metric: string, order: 'asc' | 'desc') => {
        const sorted = [...allTeamsStats].sort((a, b) => {
            const valA = (metric === 'goals' ? a.stats.goals.field + a.stats.goals.pc : metric === 'goalsAllowed' ? a.stats.goalsAllowed : a.stats[metric]) as number;
            const valB = (metric === 'goals' ? b.stats.goals.field + b.stats.goals.pc : metric === 'goalsAllowed' ? b.stats.goalsAllowed : b.stats[metric]) as number;
            return order === 'asc' ? valA - valB : valB - valA;
        });
        const rank = sorted.findIndex(t => t.name === currentTeam) + 1;
        return rank > 0 ? rank : null;
    };

    const teamRanks = {
        goals: getRank('goals', 'desc'),
        goalsAllowed: getRank('goalsAllowed', 'asc'),
        shots: getRank('shots', 'desc'),
        pcs: getRank('pcs', 'desc'),
        pcSuccessRate: getRank('pcSuccessRate', 'desc'),
        circleEntries: getRank('circleEntries', 'desc'),
        twentyFiveEntries: getRank('twentyFiveEntries', 'desc'),
        build25Ratio: getRank('build25Ratio', 'desc'),
        spp: getRank('spp', 'asc'),
        possession: getRank('possession', 'desc'),
        attackPossession: getRank('attackPossession', 'desc'),
        buildUpStagnation: getRank('buildUpStagnation', 'asc'),
        timePerCE: getRank('timePerCE', 'asc'),
    };

    const currentTeamStats = allTeamsStats.find(t => t.name === currentTeam)?.stats ?? aggregateStats([], undefined);
    const globalAvg = aggregateStats(matches);

    const matchTrendData = teamMatches.map((m, idx) => {
      const isHome = m.homeTeam.name === currentTeam;
      const myStats = isHome ? m.matchStats.home : m.matchStats.away;
      const oppStats = isHome ? m.matchStats.away : m.matchStats.home;
      const oppName = isHome ? m.awayTeam.name : m.homeTeam.name;
      const intervalLabel = `M${String(idx + 1).padStart(2, '0')} vs ${oppName}`;
      return { 
        interval: intervalLabel, 
        [currentTeam]: myStats.spp, 
        ["상대팀"]: oppStats.spp, 
        threat: myStats.shots + myStats.pcs, 
        oppThreat: oppStats.shots + oppStats.pcs 
      };
    });

    const pressureData = matchTrendData.map(d => ({ interval: d.interval, [currentTeam]: d[currentTeam], ["상대팀"]: d["상대팀"] }));
    const attackThreatData = matchTrendData.map(d => ({ interval: d.interval, [currentTeam]: d.threat, ["상대팀"]: d.oppThreat }));
    
    // 정밀 타격: 압박 데이터 집계 로직 복구
    const calculatePressureStatsForMatch = (match: MatchData, teamSide: 'home' | 'away') => {
      const zones = Array(6).fill(null).map(() => ({ count: 0, success: 0 }));
      const mapping = [
          { oppZone: 100, oppLane: 'Right', myZone: 25, myLane: 'Left' },  
          { oppZone: 100, oppLane: 'Center', myZone: 25, myLane: 'Center' },
          { oppZone: 100, oppLane: 'Left', myZone: 25, myLane: 'Right' },  
          { oppZone: 75, oppLane: 'Right', myZone: 50, myLane: 'Left' },    
          { oppZone: 75, oppLane: 'Center', myZone: 50, myLane: 'Center' },  
          { oppZone: 75, oppLane: 'Left', myZone: 50, myLane: 'Right' }    
      ];

      match.events.forEach(e => {
          const zoneInfo = mapZone(e.locationLabel || e.code);
          if (!zoneInfo) return;

          const isHomePressing = teamSide === 'home';
          const pressingTeamName = isHomePressing ? match.homeTeam.name : match.awayTeam.name;
          const buildingTeamName = isHomePressing ? match.awayTeam.name : match.homeTeam.name;

          // 골든 로직: 빌드업 팀에 따라 체크할 구역 매핑
          // Home(빌드업)은 25/50 구역, Away(빌드업)은 100/75 구역
          const isBuildingHome = buildingTeamName === match.homeTeam.name;
          const buildZoneToMatch = isBuildingHome ? 'myZone' : 'oppZone';
          const buildLaneToMatch = isBuildingHome ? 'myLane' : 'oppLane';

          const isOppError = e.team === buildingTeamName && (e.type === 'turnover' || e.type === 'foul');
          const isOppTurnover = e.team === buildingTeamName && e.type === 'turnover';
          const isPressingFoul = e.team === pressingTeamName && e.type === 'foul';

          mapping.forEach((m, idx) => {
              if (zoneInfo.zoneBand === m[buildZoneToMatch] && zoneInfo.lane === m[buildLaneToMatch]) {
                  if (isOppError || isPressingFoul) zones[idx].count++;
                  if (isOppTurnover) zones[idx].success++;
              }
          });
      });
      return zones;
    };

    const teamPressureStats = Array(6).fill(null).map(() => ({ count: 0, success: 0 }));
    const opponentPressureStats = Array(6).fill(null).map(() => ({ count: 0, success: 0 }));

    teamMatches.forEach(match => {
        const isHome = match.homeTeam.name === currentTeam;
        const teamStatsForMatch = calculatePressureStatsForMatch(match, isHome ? 'home' : 'away');
        const opponentStatsForMatch = calculatePressureStatsForMatch(match, isHome ? 'away' : 'home');

        teamStatsForMatch.forEach((stat, i) => {
            teamPressureStats[i].count += stat.count;
            teamPressureStats[i].success += stat.success;
        });
        opponentStatsForMatch.forEach((stat, i) => {
            opponentPressureStats[i].count += stat.count;
            opponentPressureStats[i].success += stat.success;
        });
    });

    const getQuarterlyAverages = (q: string) => {
      const qMatchesTeam = teamMatches.filter(m => m.quarterlyStats.some(qs => qs.quarter === q));
      const qMatchesAll = matches.filter(m => m.quarterlyStats.some(qs => qs.quarter === q));
      const aggregateQ = (ms: MatchData[], tName?: string) => {
        let qsSum = { goals: { field: 0, pc: 0 }, shots: 0, pcs: 0, circleEntries: 0, twentyFiveEntries: 0, possession: 0, attackPossession: 0, buildUpStagnation: 0, spp: 0, timePerCE: 0, build25Ratio: 0, pcSuccessRate: 0 };
        let c = 0;
        ms.forEach(m => {
          const qData = m.quarterlyStats.find(qs => qs.quarter === q);
          if (qData) {
            const isH = !tName || m.homeTeam.name === tName;
            const s = isH ? qData.home : qData.away;
            qsSum.goals.field += s.goals.field; qsSum.goals.pc += s.goals.pc; qsSum.shots += s.shots;
            qsSum.pcs += s.pcs; qsSum.circleEntries += s.circleEntries; qsSum.twentyFiveEntries += s.twentyFiveEntries;
            qsSum.possession += s.possession; qsSum.attackPossession += s.attackPossession;
            qsSum.buildUpStagnation += s.buildUpStagnation; qsSum.spp += s.spp; qsSum.timePerCE += s.timePerCE;
            qsSum.build25Ratio += s.build25Ratio;
            qsSum.pcSuccessRate += s.pcSuccessRate;
            c++;
          }
        });
        const div = c || 1;
        return Object.fromEntries(
            Object.entries(qsSum).map(([key, value]) => {
                if (key === 'goals') return [key, { field: value.field / div, pc: value.pc / div }];
                if (typeof value === 'number') return [key, value / div];
                return [key, value];
            })
        );
      };
      return { home: aggregateQ(qMatchesTeam, currentTeam), away: aggregateQ(qMatchesAll) };
    };

    const mockMatch: MatchData = {
      homeTeam: { name: currentTeam, color: selectedTeamColor },
      awayTeam: { name: '대회 전체 평균', color: opponentColor },
      events: [],
      pressureData,
      circleEntries: [],
      attackThreatData,
      matchStats: { home: currentTeamStats, away: globalAvg },
      quarterlyStats: ['Q1', 'Q2', 'Q3', 'Q4'].map(q => ({ quarter: q, ...getQuarterlyAverages(q) })) as any
    };

    return { allTeams, currentTeam, teamMatches, teamPressureStats, opponentPressureStats, mockMatch, teamRanks, allTeamsStats, globalAvg };
  }, [matches, selectedTeamName, selectedTeamColor, opponentColor]);

  const handleAiAnalysis = async () => {
    if (!analysisData) return;
    setIsAiLoading(true);
    try {
      const sanitizedStats = JSON.parse(JSON.stringify(analysisData.mockMatch));
      const result = await analyzeMatch({ 
        type: 'tournament', 
        matchName: tournamentName, 
        homeTeam: { name: analysisData.currentTeam }, 
        awayTeam: { name: '대회 전체 평균' }, 
        stats: sanitizedStats 
      });
      setAiAnalysis(result);
      toast({ title: "대회 누적 AI 분석 완료" });
    } catch (e: any) {
      toast({ title: "AI 분석 실패", description: e.message, variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
  };

  if (loading) return <div className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />대회 데이터를 불러오는 중...</div>;
  if (!analysisData) return <div className="py-20 text-center">대회에 등록된 경기가 없습니다.</div>;

  const { allTeams, currentTeam, teamMatches, teamPressureStats, opponentPressureStats, mockMatch, teamRanks, allTeamsStats, globalAvg } = analysisData;

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-4 border-primary pb-6">
        <div>
          <h2 className="text-xl font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 print:text-primary print:text-2xl print:mb-2"><Trophy className="h-5 w-5" /> {tournamentName}</h2>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <Select value={currentTeam} onValueChange={setSelectedTeamName}>
              <SelectTrigger className="w-64 h-12 text-xl font-black italic"><SelectValue /></SelectTrigger>
              <SelectContent>{allTeams.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-lg border">
              <Label className="text-[10px] font-bold uppercase">분석 팀</Label>
              <Input type="color" value={selectedTeamColor} onChange={(e) => setSelectedTeamColor(e.target.value)} className="w-8 h-8 p-0 border-none bg-transparent" />
            </div>
            <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-lg border">
              <Label className="text-[10px] font-bold uppercase">상대팀 비교</Label>
              <Input type="color" value={opponentColor} onChange={(e) => setOpponentColor(e.target.value)} className="w-8 h-8 p-0 border-none bg-transparent" />
            </div>
          </div>
        </div>
        <div className="flex gap-2 print-hidden">
          <Button variant="outline" className="border-primary text-primary font-bold h-11" onClick={handleAiAnalysis} disabled={isAiLoading}>
            {isAiLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BrainCircuit className="h-4 w-4 mr-2" />}
            대회 누적 AI 분석
          </Button>
          <Button variant="default" className="bg-emerald-600 hover:bg-emerald-700 h-11 px-6 font-bold" onClick={() => window.print()}><FileDown className="mr-2 h-5 w-5" /> PDF 저장</Button>
        </div>
      </div>

      <div className="break-inside-avoid space-y-8">
        <div className="mb-6 hidden print:block border-b-2 pb-4">
          <h1 className="text-4xl font-black italic text-primary uppercase tracking-tighter">{tournamentName}</h1>
          <p className="text-muted-foreground font-bold">Cumulative Performance Analysis: {currentTeam}</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold text-xl" style={{ color: selectedTeamColor }}>
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: selectedTeamColor }} />
              {currentTeam} (누적 평균)
            </div>
             <div className="grid grid-cols-2 gap-3">
              <StatsCard title="득점" value={mockMatch.matchStats.home.goals.field + mockMatch.matchStats.home.goals.pc} rank={teamRanks?.goals} icon={<Sword className="h-4 w-4" />} />
              <StatsCard title="실점" value={mockMatch.matchStats.home.goalsAllowed} rank={teamRanks?.goalsAllowed} icon={<ShieldCheck className="h-4 w-4" />} />
              <StatsCard title="공격 점유율" value={mockMatch.matchStats.home.attackPossession} rank={teamRanks?.attackPossession} icon={<Target className="h-4 w-4" />} isPercentage />
              <StatsCard title="압박 지수 (SPP)" value={mockMatch.matchStats.home.spp} rank={teamRanks?.spp} icon={<TrendingDown className="h-4 w-4" />} isTime />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold text-xl" style={{ color: opponentColor }}>
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: opponentColor }} />
              대회 전체 평균
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatsCard title="득점" value={mockMatch.matchStats.away.goals.field + mockMatch.matchStats.away.goals.pc} icon={<Sword className="h-4 w-4" />} />
              <StatsCard title="실점" value={mockMatch.matchStats.away.goalsAllowed} icon={<ShieldCheck className="h-4 w-4" />} />
              <StatsCard title="공격 점유율" value={mockMatch.matchStats.away.attackPossession} icon={<Target className="h-4 w-4" />} isPercentage />
              <StatsCard title="압박 지수 (SPP)" value={mockMatch.matchStats.away.spp} icon={<TrendingDown className="h-4 w-4" />} isTime />
            </div>
          </div>
        </div>
        <BasicMatchStats data={mockMatch} ranks={teamRanks} />
      </div>

      <div className="break-inside-avoid space-y-8">
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
          <Activity className="h-6 w-6" /> 쿼터별 상세 데이터 (평균)
        </div>
        <QuarterlyStatsTable data={mockMatch} />
      </div>

      <div className="break-inside-avoid space-y-8">
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
          <Sword className="h-6 w-6" /> 공격 성능 분석
        </div>
        <AttackThreatChart 
          data={mockMatch.attackThreatData} 
          homeTeam={{ name: currentTeam, color: selectedTeamColor }} 
          awayTeam={{ name: '상대팀', color: opponentColor }} 
        />
        <div className="space-y-8 mt-6">
          <div className="break-inside-avoid">
            <TacticalQuadrantChart
              title="공격 생성 효율"
              description="점유율 대비 서클 진입 생성 빈도"
              xAxisLabel="Possession (%)"
              yAxisLabel="Circle Entries"
              avgX={globalAvg.possession}
              avgY={globalAvg.circleEntries}
              selectedTeamName={currentTeam}
              selectedColor={selectedTeamColor}
              data={allTeamsStats.map((t, i) => ({ name: t.name, x: t.stats.possession, y: t.stats.circleEntries, color: getTeamColor(t.name, i) }))}
              labels={{ tr: "Dominant", tl: "Efficient", br: "Inefficient", bl: "Defensive" }}
            />
          </div>
          <div className="break-inside-avoid">
            <TacticalQuadrantChart
               title="피니싱 효율"
               description="서클 진입 대비 위협 창출"
               xAxisLabel="Circle Entries"
               yAxisLabel="Threat (Shots+PC)"
               avgX={globalAvg.circleEntries}
               avgY={globalAvg.threat}
               selectedTeamName={currentTeam}
               selectedColor={selectedTeamColor}
               data={allTeamsStats.map((t, i) => ({ name: t.name, x: t.stats.circleEntries, y: t.stats.threat, color: getTeamColor(t.name, i) }))}
               labels={{ tr: "Lethal", tl: "Sharp", br: "Wasteful", bl: "Low Impact" }}
            />
          </div>
        </div>
      </div>

      <div className="break-inside-avoid space-y-8">
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
          <TrendingUp className="h-6 w-6" /> 공격 점유 및 속도 분석 (대회 전체 흐름)
        </div>
        <MatchTrajectoryChart 
          data={mockMatch} 
          isTournamentView={true} 
          allMatchesPoints={teamMatches.map(m => {
            const isH = m.homeTeam.name === currentTeam;
            return {
              homeX: isH ? m.matchStats.home.attackPossession : m.matchStats.away.attackPossession,
              homeY: isH ? m.matchStats.home.timePerCE : m.matchStats.away.timePerCE,
              homeRawTime: isH ? m.matchStats.home.timePerCE : m.matchStats.away.timePerCE
            };
          })} 
        />
      </div>

      <div className="break-inside-avoid space-y-8">
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
          <Shield className="h-6 w-6" /> 압박 분석
        </div>
        <PressureBattleChart data={mockMatch.pressureData} homeTeam={{ name: currentTeam, color: selectedTeamColor }} awayTeam={{ name: '상대팀', color: opponentColor }} />
        <div className="mt-6">
          <PressureAnalysisMap
              homeTeam={{ name: currentTeam, color: selectedTeamColor }}
              awayTeam={{ name: '상대팀 누적', color: opponentColor }}
              homeStats={teamPressureStats}
              awayStats={opponentPressureStats}
              isTournament={true}
              homeMatchCount={teamMatches.length || 1}
              awayMatchCount={teamMatches.length || 1}
              awayTitle="상대팀 누적 압박"
          />
        </div>
        <div className="space-y-8 mt-6">
          <div className="break-inside-avoid">
            <TacticalQuadrantChart
              title="수비 복원력"
              description="상대 점유 허용 대비 서클 진입 허용"
              xAxisLabel="Allowed Possession (%)"
              yAxisLabel="Allowed Circle Entries"
              avgX={globalAvg.allowedPossession}
              avgY={globalAvg.allowedCircleEntries}
              reversedX reversedY
              selectedTeamName={currentTeam}
              selectedColor={selectedTeamColor}
              data={allTeamsStats.map((t, i) => ({ 
                name: t.name, 
                x: t.stats.allowedPossession, 
                y: t.stats.allowedCircleEntries, 
                color: getTeamColor(t.name, i) 
              }))}
              labels={{ tr: "Weak", tl: "Vulnerable", br: "Resilient", bl: "Fortress" }}
            />
          </div>
          <div className="break-inside-avoid">
            <TacticalQuadrantChart
              title="서클 수비 효율"
              description="서클 허용 대비 위협 허용 억제"
              xAxisLabel="Allowed Circle Entries"
              yAxisLabel="Allowed Threat (Shots+PC)"
              avgX={globalAvg.allowedCircleEntries}
              avgY={globalAvg.allowedThreat}
              reversedX reversedY
              selectedTeamName={currentTeam}
              selectedColor={selectedTeamColor}
              data={allTeamsStats.map((t, i) => ({ 
                name: t.name, 
                x: t.stats.allowedCircleEntries, 
                y: t.stats.allowedThreat, 
                color: getTeamColor(t.name, i) 
              }))}
              labels={{ tr: "Brittle", tl: "Passive", br: "Solid", bl: "Impenetrable" }}
            />
          </div>
        </div>
      </div>

      {aiAnalysis && (
        <div className="break-inside-avoid space-y-8">
          <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
            <Sparkles className="h-6 w-6" /> AI 누적 전술 분석 리포트
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-2 border-primary/20"><CardHeader className="bg-primary/5"><CardTitle className="text-lg flex items-center gap-2"><Info className="h-5 w-5 text-primary" /> 분석 요약</CardTitle></CardHeader><CardContent className="pt-6"><p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{aiAnalysis.summary}</p></CardContent></Card>
            <Card className="border-2 border-primary/20"><CardHeader className="bg-emerald-500/5"><CardTitle className="text-lg flex items-center gap-2"><Target className="h-5 w-5 text-emerald-600" /> 전술적 주요 포인트</CardTitle></CardHeader><CardContent className="pt-6"><ul className="space-y-3">{aiAnalysis.tacticalAnalysis.map((point, idx) => (<li key={idx} className="flex gap-2 text-sm"><span className="font-bold text-emerald-600 shrink-0">{idx + 1}.</span><span className="text-muted-foreground">{point}</span></li>))}</ul></CardContent></Card>
            <Card className="border-2 border-primary/20"><CardHeader className="bg-blue-500/5"><CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5 text-blue-600" /> 팀의 강점 (Strengths)</CardTitle></CardHeader><CardContent className="pt-6"><ul className="space-y-3">{aiAnalysis.strengths.map((s, idx) => (<li key={idx} className="flex gap-2 text-sm"><div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" /><span className="text-muted-foreground">{s}</span></li>))}</ul></CardContent></Card>
            <Card className="border-2 border-primary/20"><CardHeader className="bg-orange-500/5"><CardTitle className="text-lg flex items-center gap-2"><TrendingDown className="h-5 w-5 text-orange-600" /> 개선 필요 사항 (Weaknesses)</CardTitle></CardHeader><CardContent className="pt-6"><ul className="space-y-3">{aiAnalysis.weaknesses.map((w, idx) => (<li key={idx} className="flex gap-2 text-sm"><div className="w-1.5 h-1.5 rounded-full bg-orange-600 mt-1.5 shrink-0" /><span className="text-muted-foreground">{w}</span></li>))}</ul></CardContent></Card>
          </div>
          <Card className="bg-primary text-primary-foreground border-none shadow-xl"><CardContent className="p-6 flex items-center gap-4"><div className="bg-white/20 p-3 rounded-xl"><Sparkles className="h-8 w-8 text-white" /></div><div><p className="text-xs font-bold uppercase tracking-widest opacity-80">최종 분석 한줄평 (Verdict)</p><p className="text-xl font-black italic mt-1">"{aiAnalysis.verdict}"</p></div></CardContent></Card>
        </div>
      )}
    </div>
  )
}
