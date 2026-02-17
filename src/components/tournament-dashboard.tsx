
"use client";

import React, { useState, useMemo } from "react";
import { Trophy, Activity, Grid3X3, Loader2, FileDown, Sword, Shield, TrendingUp, Target, TrendingDown, ShieldCheck } from "lucide-react";
import type { MatchData, TeamMatchStats, QuarterStats } from "@/lib/types";
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

  const analysisData = useMemo(() => {
    if (matches.length === 0) return null;

    const allTeams = Array.from(new Set(matches.flatMap(m => [m.homeTeam.name, m.awayTeam.name]))).sort();
    const currentTeam = selectedTeamName || allTeams[0];

    // Filter matches involving the selected team
    const teamMatches = matches.filter(m => m.homeTeam.name === currentTeam || m.awayTeam.name === currentTeam);

    const aggregateStats = (targetMatches: MatchData[], targetTeam?: string) => {
      const statsSum: TeamMatchStats = {
        goals: { field: 0, pc: 0 },
        shots: 0, pcs: 0, circleEntries: 0, twentyFiveEntries: 0,
        possession: 0, attackPossession: 0, buildUpStagnation: 0,
        pcSuccessRate: 0, allowedSpp: 0, avgAttackDuration: 0,
        timePerCE: 0, spp: 0, build25Ratio: 0, pressAttempts: 0, pressSuccess: 0
      };
      // For quadrant charts
      let threat = 0;
      let allowedThreat = 0;
      let allowedCircleEntries = 0;
      let allowedPossession = 0;

      targetMatches.forEach(m => {
        const isHome = targetTeam ? m.homeTeam.name === targetTeam : true;
        const s = isHome ? m.matchStats.home : m.matchStats.away;
        const opp = isHome ? m.matchStats.away : m.matchStats.home;

        statsSum.goals.field += s.goals.field;
        statsSum.goals.pc += s.goals.pc;
        statsSum.shots += s.shots;
        statsSum.pcs += s.pcs;
        statsSum.circleEntries += s.circleEntries;
        statsSum.twentyFiveEntries += s.twentyFiveEntries;
        statsSum.possession += s.possession;
        statsSum.attackPossession += s.attackPossession;
        statsSum.buildUpStagnation += s.buildUpStagnation;
        statsSum.pcSuccessRate += s.pcSuccessRate;
        statsSum.spp += s.spp;
        statsSum.timePerCE += s.timePerCE;
        statsSum.pressAttempts += s.pressAttempts;
        statsSum.pressSuccess += s.pressSuccess;
        
        // Add threat (Shots + PCs)
        threat += (s.shots + s.pcs);
        allowedThreat += (opp.shots + opp.pcs);
        allowedCircleEntries += opp.circleEntries;
        allowedPossession += opp.possession;
      });

      const count = targetMatches.length || 1;
      return {
        ...statsSum,
        goals: { field: statsSum.goals.field / count, pc: statsSum.goals.pc / count },
        shots: statsSum.shots / count,
        pcs: statsSum.pcs / count,
        circleEntries: statsSum.circleEntries / count,
        twentyFiveEntries: statsSum.twentyFiveEntries / count,
        possession: statsSum.possession / count,
        attackPossession: statsSum.attackPossession / count,
        buildUpStagnation: statsSum.buildUpStagnation / count,
        pcSuccessRate: statsSum.pcSuccessRate / count,
        spp: statsSum.spp / count,
        timePerCE: statsSum.timePerCE / count,
        pressAttempts: statsSum.pressAttempts / count,
        pressSuccess: statsSum.pressSuccess / count,
        threat: threat / count,
        allowedThreat: allowedThreat / count,
        allowedCircleEntries: allowedCircleEntries / count,
        allowedPossession: allowedPossession / count
      };
    };

    const currentTeamStats = aggregateStats(teamMatches, currentTeam);
    const globalAvg = aggregateStats(matches); // Average across ALL teams (simplified)

    // Calculate pressure stats for 6 zones (25L...50R)
    const calculatePressureStats = (targetMatches: MatchData[], targetTeamName: string | null) => {
      const zones = Array(6).fill(null).map(() => ({ count: 0, success: 0 }));
      
      const mapping = [
        { oppZone: 100, oppLane: 'Right', myZone: 25, myLane: 'Left' },  
        { oppZone: 100, oppLane: 'Center', myZone: 25, myLane: 'Center' },
        { oppZone: 100, oppLane: 'Left', myZone: 25, myLane: 'Right' },  
        { oppZone: 75, oppLane: 'Right', myZone: 50, myLane: 'Left' },    
        { oppZone: 75, oppLane: 'Center', myZone: 50, myLane: 'Center' },  
        { oppZone: 75, oppLane: 'Left', myZone: 50, myLane: 'Right' }    
      ];

      targetMatches.forEach(m => {
        const myName = targetTeamName || m.homeTeam.name; // In global mode, home team is 'us'
        
        m.events.forEach(e => {
          const zoneInfo = mapZone(e.locationLabel || e.code);
          if (!zoneInfo) return;

          const isMe = e.team === myName;
          const isOpponent = e.team !== myName;

          const isOppError = isOpponent && (e.type === 'turnover' || e.type === 'foul');
          const isMyFoul = isMe && e.type === 'foul';

          mapping.forEach((mp, idx) => {
            if (zoneInfo.zoneBand === mp.oppZone && zoneInfo.lane === mp.oppLane) {
              if (isOppError || isMyFoul) zones[idx].count++;
              if (isOppError) zones[idx].success++;
            }
          });
        });
      });
      return zones;
    };

    const teamPressureStats = calculatePressureStats(teamMatches, currentTeam);
    const globalPressureStats = calculatePressureStats(matches, null); // Global logic

    // Quarterly averages
    const getQuarterlyAverages = (q: string) => {
      const qMatches = teamMatches.filter(m => m.quarterlyStats.some(qs => qs.quarter === q));
      const homeStats = aggregateStats(qMatches, currentTeam);
      const awayStats = aggregateStats(matches.filter(m => m.quarterlyStats.some(qs => qs.quarter === q)));
      return { home: homeStats, away: awayStats };
    };

    const mockMatch: MatchData = {
      homeTeam: { name: currentTeam, color: selectedTeamColor },
      awayTeam: { name: '대회 전체 평균', color: opponentColor },
      events: [],
      pressureData: [],
      circleEntries: [],
      attackThreatData: [],
      build25Ratio: { home: currentTeamStats.build25Ratio, away: globalAvg.build25Ratio },
      spp: { home: currentTeamStats.spp, away: globalAvg.spp },
      matchStats: {
        home: currentTeamStats as any,
        away: globalAvg as any
      },
      quarterlyStats: ['Q1', 'Q2', 'Q3', 'Q4'].map(q => ({
        quarter: q,
        ...getQuarterlyAverages(q)
      })) as any
    };

    return { allTeams, currentTeam, teamMatches, teamPressureStats, globalPressureStats, mockMatch };
  }, [matches, selectedTeamName, selectedTeamColor, opponentColor]);

  if (loading) return <div className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />대회 데이터를 불러오는 중...</div>;
  if (!analysisData) return <div className="py-20 text-center">대회에 등록된 경기가 없습니다.</div>;

  const { allTeams, currentTeam, teamMatches, teamPressureStats, globalPressureStats, mockMatch } = analysisData;

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-4 border-primary pb-6">
        <div>
          <h2 className="text-xl font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2"><Trophy className="h-5 w-5" /> Tournament Report</h2>
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
              <Label className="text-[10px] font-bold uppercase">대회 전체 평균</Label>
              <Input type="color" value={opponentColor} onChange={(e) => setOpponentColor(e.target.value)} className="w-8 h-8 p-0 border-none bg-transparent" />
            </div>
          </div>
        </div>
        <Button variant="default" className="bg-emerald-600 hover:bg-emerald-700 h-11 px-6 font-bold print-hidden" onClick={() => window.print()}><FileDown className="mr-2 h-5 w-5" /> PDF 저장</Button>
      </div>

      <div className="page-break space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold text-xl" style={{ color: selectedTeamColor }}>
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: selectedTeamColor }} />
              {currentTeam} (대회 누적 평균)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatsCard title="SPP (압박 지수)" value={mockMatch.matchStats.home.spp} isTime icon={<TrendingDown className="h-4 w-4" />} />
              <StatsCard title="빌드업 정체 비율" value={mockMatch.matchStats.home.buildUpStagnation} isPercentage icon={<ShieldCheck className="h-4 w-4" />} />
              <StatsCard title="공격 점유율" value={mockMatch.matchStats.home.attackPossession} isPercentage icon={<Target className="h-4 w-4" />} />
              <StatsCard title="CE 소요 시간" value={mockMatch.matchStats.home.timePerCE} isTime icon={<Activity className="h-4 w-4" />} />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold text-xl" style={{ color: opponentColor }}>
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: opponentColor }} />
              대회 전체 평균
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatsCard title="SPP (압박 지수)" value={mockMatch.matchStats.away.spp} isTime icon={<TrendingDown className="h-4 w-4" />} />
              <StatsCard title="빌드업 정체 비율" value={mockMatch.matchStats.away.buildUpStagnation} isPercentage icon={<ShieldCheck className="h-4 w-4" />} />
              <StatsCard title="공격 점유율" value={mockMatch.matchStats.away.attackPossession} isPercentage icon={<Target className="h-4 w-4" />} />
              <StatsCard title="CE 소요 시간" value={mockMatch.matchStats.away.timePerCE} isTime icon={<Activity className="h-4 w-4" />} />
            </div>
          </div>
        </div>
        <BasicMatchStats data={mockMatch} />
      </div>

      <div className="page-break space-y-8">
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
          <Activity className="h-6 w-6" /> 쿼터별 상세 데이터 (대회 평균)
        </div>
        <QuarterlyStatsTable data={mockMatch} />
      </div>

      <div className="page-break space-y-8">
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
          <Grid3X3 className="h-6 w-6" /> 전술적 위치 비교 (대회 누적)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TacticalQuadrantChart
            title="공격 생성 효율"
            description="점유율 대비 서클 진입 생성 빈도"
            xAxisLabel="Possession (%)"
            yAxisLabel="Circle Entries"
            avgX={mockMatch.matchStats.away.possession}
            avgY={mockMatch.matchStats.away.circleEntries}
            selectedTeamName={currentTeam}
            selectedColor={selectedTeamColor}
            data={allTeams.map(name => ({
              name,
              x: matches.filter(m => m.homeTeam.name === name || m.awayTeam.name === name).reduce((acc, m) => acc + (m.homeTeam.name === name ? m.matchStats.home.possession : m.matchStats.away.possession), 0) / matches.filter(m => m.homeTeam.name === name || m.awayTeam.name === name).length,
              y: matches.filter(m => m.homeTeam.name === name || m.awayTeam.name === name).reduce((acc, m) => acc + (m.homeTeam.name === name ? m.matchStats.home.circleEntries : m.matchStats.away.circleEntries), 0) / matches.filter(m => m.homeTeam.name === name || m.awayTeam.name === name).length,
              color: getTeamColor(name, allTeams.indexOf(name))
            }))}
            labels={{ tr: "Dominant", tl: "Efficient", br: "Inefficient", bl: "Defensive" }}
          />
          <TacticalQuadrantChart
             title="피니싱 효율"
             description="서클 진입 대비 위협(슈팅+PC) 창출"
             xAxisLabel="Circle Entries"
             yAxisLabel="Threat (Shots+PC)"
             avgX={mockMatch.matchStats.away.circleEntries}
             avgY={(mockMatch.matchStats.away as any).threat || 0}
             selectedTeamName={currentTeam}
             selectedColor={selectedTeamColor}
             data={allTeams.map(name => {
               const tm = matches.filter(m => m.homeTeam.name === name || m.awayTeam.name === name);
               const ce = tm.reduce((acc, m) => acc + (m.homeTeam.name === name ? m.matchStats.home.circleEntries : m.matchStats.away.circleEntries), 0) / tm.length;
               const th = tm.reduce((acc, m) => acc + (m.homeTeam.name === name ? (m.matchStats.home.shots + m.matchStats.home.pcs) : (m.matchStats.away.shots + m.matchStats.away.pcs)), 0) / tm.length;
               return { name, x: ce, y: th, color: getTeamColor(name, allTeams.indexOf(name)) };
             })}
             labels={{ tr: "Lethal", tl: "Sharp", br: "Wasteful", bl: "Low Impact" }}
          />
          <TacticalQuadrantChart
            title="수비 복원력"
            description="상대 점유 허용 대비 서클 진입 허용"
            xAxisLabel="Allowed Possession (%)"
            yAxisLabel="Allowed Circle Entries"
            avgX={(mockMatch.matchStats.away as any).allowedPossession || 0}
            avgY={(mockMatch.matchStats.away as any).allowedCircleEntries || 0}
            reversedX reversedY
            selectedTeamName={currentTeam}
            selectedColor={selectedTeamColor}
            data={allTeams.map(name => {
              const tm = matches.filter(m => m.homeTeam.name === name || m.awayTeam.name === name);
              const ap = tm.reduce((acc, m) => acc + (m.homeTeam.name === name ? m.matchStats.away.possession : m.matchStats.home.possession), 0) / tm.length;
              const ace = tm.reduce((acc, m) => acc + (m.homeTeam.name === name ? m.matchStats.away.circleEntries : m.matchStats.home.circleEntries), 0) / tm.length;
              return { name, x: ap, y: ace, color: getTeamColor(name, allTeams.indexOf(name)) };
            })}
            labels={{ tr: "Weak", tl: "Vulnerable", br: "Resilient", bl: "Fortress" }}
          />
          <TacticalQuadrantChart
            title="서클 수비 효율"
            description="서클 허용 대비 위협(슈팅+PC) 허용 억제"
            xAxisLabel="Allowed Circle Entries"
            yAxisLabel="Allowed Threat (Shots+PC)"
            avgX={(mockMatch.matchStats.away as any).allowedCircleEntries || 0}
            avgY={(mockMatch.matchStats.away as any).allowedThreat || 0}
            reversedX reversedY
            selectedTeamName={currentTeam}
            selectedColor={selectedTeamColor}
            data={allTeams.map(name => {
               const tm = matches.filter(m => m.homeTeam.name === name || m.awayTeam.name === name);
               const ace = tm.reduce((acc, m) => acc + (m.homeTeam.name === name ? m.matchStats.away.circleEntries : m.matchStats.home.circleEntries), 0) / tm.length;
               const ath = tm.reduce((acc, m) => acc + (m.homeTeam.name === name ? (m.matchStats.away.shots + m.matchStats.away.pcs) : (m.matchStats.home.shots + m.matchStats.home.pcs)), 0) / tm.length;
               return { name, x: ace, y: ath, color: getTeamColor(name, allTeams.indexOf(name)) };
            })}
            labels={{ tr: "Brittle", tl: "Passive", br: "Solid", bl: "Impenetrable" }}
          />
        </div>
      </div>

      <div className="page-break space-y-8">
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
          <TrendingUp className="h-6 w-6" /> 매치 트래직토리 (대회 전체 흐름)
        </div>
        <MatchTrajectoryChart 
          data={mockMatch} 
          isTournamentView={true}
          allMatchesPoints={teamMatches.map(m => ({
            homeX: m.homeTeam.name === currentTeam ? m.matchStats.home.attackPossession : m.matchStats.away.attackPossession,
            homeY: m.homeTeam.name === currentTeam ? m.matchStats.home.timePerCE : m.matchStats.away.timePerCE,
            homeRawTime: m.homeTeam.name === currentTeam ? m.matchStats.home.timePerCE : m.matchStats.away.timePerCE
          }))}
        />
      </div>

      <div className="page-break space-y-8">
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2">
          <Shield className="h-6 w-6" /> 누적 압박 분석
        </div>
        <PressureAnalysisMap
            homeTeam={{ name: currentTeam, color: selectedTeamColor }}
            awayTeam={{ name: '대회 전체 평균', color: opponentColor }}
            homeStats={teamPressureStats}
            awayStats={globalPressureStats}
            isTournament={true}
            homeMatchCount={teamMatches.length || 1}
            awayMatchCount={matches.length * 2}
            awayTitle="대회 전체 평균 압박"
        />
      </div>
    </div>
  )
}
