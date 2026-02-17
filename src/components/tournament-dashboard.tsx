
"use client";

import React, { useState, useMemo } from "react";
import { Trophy, Activity, Grid3X3, Loader2, FileDown, Sword, Shield, TrendingUp } from "lucide-react";
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
import { mapZone, flipZone, flipSubZone, zoneMapping } from "@/lib/zone-helpers";

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

    const getTeamAverages = (teamName: string) => {
      const myMatches = matches.filter(m => m.homeTeam.name === teamName || m.awayTeam.name === teamName);
      const count = myMatches.length || 1;
      const sum = { fieldGoals: 0, pcGoals: 0, shots: 0, pcs: 0, circle: 0, entry25: 0, possession: 0, attPoss: 0, buildUpStagnation: 0, pcSuccess: 0, spp: 0, timeCE: 0, buildUp: 0, allowed25: 0, allowedCircle: 0, allowedShots: 0, allowedPC: 0, pressAttempts: 0, pressSuccess: 0 };

      myMatches.forEach(m => {
        const isHome = m.homeTeam.name === teamName;
        const my = isHome ? m.matchStats.home : m.matchStats.away;
        const opp = isHome ? m.matchStats.away : m.matchStats.home;
        sum.fieldGoals += (my.goals?.field || 0); sum.pcGoals += (my.goals?.pc || 0);
        sum.shots += (my.shots || 0); sum.pcs += (my.pcs || 0); sum.circle += (my.circleEntries || 0); sum.entry25 += (my.twentyFiveEntries || 0);
        sum.possession += (my.possession || 0); sum.attPoss += (my.attackPossession || 0); sum.buildUpStagnation += (my.buildUpStagnation || 0);
        sum.pcSuccess += (my.pcSuccessRate || 0); sum.spp += (my.spp || 0); sum.timeCE += (my.timePerCE || 0); sum.buildUp += (my.build25Ratio || 0);
        sum.allowed25 += (opp.twentyFiveEntries || 0); sum.allowedCircle += (opp.circleEntries || 0); sum.allowedShots += (opp.shots || 0); sum.allowedPC += (opp.pcs || 0);
        sum.pressAttempts += (my.pressAttempts || 0); sum.pressSuccess += (my.pressSuccess || 0);
      });

      return {
        name: teamName,
        goals: { field: sum.fieldGoals / count, pc: sum.pcGoals / count },
        shots: sum.shots / count, pcs: sum.pcs / count, pcSuccessRate: sum.pcSuccess / count,
        circleEntries: sum.circle / count, twentyFiveEntries: sum.entry25 / count, possession: sum.possession / count,
        attackPossession: sum.attPoss / count, buildUpStagnation: sum.buildUpStagnation / count,
        spp: sum.spp / count, timePerCE: sum.timeCE / count, build25Ratio: sum.buildUp / count,
        pressAttempts: sum.pressAttempts / count, pressSuccess: sum.pressSuccess / count,
        allowedThreat: (sum.allowedShots + sum.allowedPC) / count, threat: (sum.shots + sum.pcs) / count,
      };
    };

    const getQuarterlyAverages = (teamName: string, quarter: string) => {
      const myMatches = matches.filter(m => m.homeTeam.name === teamName || m.awayTeam.name === teamName);
      const qStats = myMatches.map(m => {
        const isHome = m.homeTeam.name === teamName;
        const qData = m.quarterlyStats?.find(qs => qs.quarter === quarter);
        return isHome ? qData?.home : qData?.away;
      }).filter(Boolean);

      const count = qStats.length || 1;
      const sum = qStats.reduce((acc: any, curr: any) => ({
        fieldGoals: acc.fieldGoals + (curr.goals?.field || 0),
        pcGoals: acc.pcGoals + (curr.goals?.pc || 0),
        shots: acc.shots + (curr.shots || 0),
        pcs: acc.pcs + (curr.pcs || 0),
        pcSuccess: acc.pcSuccess + (curr.pcSuccessRate || 0),
        circle: acc.circle + (curr.circleEntries || 0),
        entry25: acc.entry25 + (curr.twentyFiveEntries || 0),
        possession: acc.possession + (curr.possession || 0),
        attPoss: acc.attPoss + (curr.attackPossession || 0),
        stagnation: acc.stagnation + (curr.buildUpStagnation || 0),
        spp: acc.spp + (curr.spp || 0),
        timeCE: acc.timeCE + (curr.timePerCE || 0)
      }), { fieldGoals: 0, pcGoals: 0, shots: 0, pcs: 0, pcSuccess: 0, circle: 0, entry25: 0, possession: 0, attPoss: 0, stagnation: 0, spp: 0, timeCE: 0 });

      return {
        goals: { field: sum.fieldGoals / count, pc: sum.pcGoals / count },
        shots: sum.shots / count, pcs: sum.pcs / count, pcSuccessRate: sum.pcSuccess / count,
        circleEntries: sum.circle / count, twentyFiveEntries: sum.entry25 / count, possession: sum.possession / count,
        attackPossession: sum.attPoss / count, buildUpStagnation: sum.stagnation / count,
        spp: sum.spp / count, timePerCE: sum.timeCE / count
      };
    };

    const calculateTeamPressureStats = (targetTeamName: string, teamMatches: MatchData[]) => {
      const zones = zoneMapping.map(() => ({ count: 0, success: 0 }));
      teamMatches.forEach(match => {
        const isHome = match.homeTeam.name === targetTeamName;
        match.events.forEach(event => {
          const zoneInfo = mapZone(event.locationLabel || event.code);
          if (!zoneInfo || !event.team) return;
          
          const isOpponentError = event.team !== targetTeamName && (event.type === 'turnover' || event.type === 'foul');
          const isMyFoul = event.team === targetTeamName && event.type === 'foul';
          if (!isOpponentError && !isMyFoul) return;

          let { zone: effectiveZone, subZone: effectiveSubZone } = zoneInfo;
          if (!isHome) {
            effectiveZone = flipZone(zoneInfo.zone);
            effectiveSubZone = flipSubZone(zoneInfo.subZone);
          }

          const zoneIndex = zoneMapping.findIndex(m => m.zone === effectiveZone && m.subZone === effectiveSubZone);
          if (zoneIndex !== -1) {
            const isPressureZone = effectiveZone === 'A' || effectiveZone === 'M';
            if (isPressureZone) {
              if (isOpponentError || isMyFoul) zones[zoneIndex].count++;
              if (isOpponentError) zones[zoneIndex].success++;
            }
          }
        });
      });
      return zones;
    };

    const calculateGlobalPressureStats = (allMatches: MatchData[]) => {
      const zones = zoneMapping.map(() => ({ count: 0, success: 0 }));
      allMatches.forEach(match => {
        // 모든 팀의 압박 성과를 중립적으로 집계
        [match.homeTeam.name, match.awayTeam.name].forEach(teamName => {
          const isHome = match.homeTeam.name === teamName;
          match.events.forEach(event => {
            const zoneInfo = mapZone(event.locationLabel || event.code);
            if (!zoneInfo || !event.team) return;

            const isOpponentError = event.team !== teamName && (event.type === 'turnover' || event.type === 'foul');
            const isMyFoul = event.team === teamName && event.type === 'foul';
            if (!isOpponentError && !isMyFoul) return;

            let { zone: effectiveZone, subZone: effectiveSubZone } = zoneInfo;
            if (!isHome) {
              effectiveZone = flipZone(zoneInfo.zone);
              effectiveSubZone = flipSubZone(zoneInfo.subZone);
            }

            const zoneIndex = zoneMapping.findIndex(m => m.zone === effectiveZone && m.subZone === effectiveSubZone);
            if (zoneIndex !== -1 && (effectiveZone === 'A' || effectiveZone === 'M')) {
              zones[zoneIndex].count++;
              if (isOpponentError) zones[zoneIndex].success++;
            }
          });
        });
      });
      return zones;
    };

    const teamMatches = matches.filter(m => m.homeTeam.name === currentTeam || m.awayTeam.name === currentTeam);
    const currentTeamStats = getTeamAverages(currentTeam);
    
    const globalSum = allTeams.reduce((acc, name) => {
      const stats = getTeamAverages(name);
      return {
        fieldGoals: acc.fieldGoals + stats.goals.field,
        pcGoals: acc.pcGoals + stats.goals.pc,
        shots: acc.shots + stats.shots,
        pcs: acc.pcs + stats.pcs,
        circle: acc.circle + stats.circleEntries,
        entry25: acc.entry25 + stats.twentyFiveEntries,
        possession: acc.possession + stats.possession,
        attPoss: acc.attPoss + stats.attackPossession,
        stagnation: acc.stagnation + stats.buildUpStagnation,
        pcSuccess: acc.pcSuccess + stats.pcSuccessRate,
        spp: acc.spp + stats.spp,
        timeCE: acc.timeCE + stats.timePerCE,
        threat: acc.threat + stats.threat,
        allowedThreat: acc.allowedThreat + stats.allowedThreat
      };
    }, { fieldGoals: 0, pcGoals: 0, shots: 0, pcs: 0, circle: 0, entry25: 0, possession: 0, attPoss: 0, stagnation: 0, pcSuccess: 0, spp: 0, timeCE: 0, threat: 0, allowedThreat: 0 });

    const teamCount = allTeams.length || 1;
    const globalAvg = {
      name: "대회 전체 평균",
      goals: { field: globalSum.fieldGoals / teamCount, pc: globalSum.pcGoals / teamCount },
      shots: globalSum.shots / teamCount, pcs: globalSum.pcs / teamCount, pcSuccessRate: globalSum.pcSuccess / teamCount,
      circleEntries: globalSum.circle / teamCount, twentyFiveEntries: globalSum.entry25 / teamCount, possession: globalSum.possession / teamCount,
      attackPossession: globalSum.attPoss / teamCount, buildUpStagnation: globalSum.stagnation / teamCount,
      spp: globalSum.spp / teamCount, timePerCE: globalSum.timeCE / teamCount,
      threat: globalSum.threat / teamCount, allowedThreat: globalSum.allowedThreat / teamCount
    };

    const teamPressureStats = calculateTeamPressureStats(currentTeam, teamMatches);
    const globalPressureStats = calculateGlobalPressureStats(matches);

    const mockMatchForCharts = {
      homeTeam: { name: currentTeam, color: selectedTeamColor },
      awayTeam: { name: '대회 전체 평균', color: opponentColor },
      matchStats: { home: currentTeamStats as any, away: globalAvg as any },
      quarterlyStats: ['Q1', 'Q2', 'Q3', 'Q4'].map(q => ({
        quarter: q,
        home: getQuarterlyAverages(currentTeam, q) as any,
        away: ['Q1', 'Q2', 'Q3', 'Q4'].map(innerQ => {
           const qSums = allTeams.map(name => getQuarterlyAverages(name, q));
           const c = qSums.length || 1;
           return {
             goals: { field: qSums.reduce((a, b) => a + b.goals.field, 0) / c, pc: qSums.reduce((a, b) => a + b.goals.pc, 0) / c },
             shots: qSums.reduce((a, b) => a + b.shots, 0) / c,
             pcs: qSums.reduce((a, b) => a + b.pcs, 0) / c,
             pcSuccessRate: qSums.reduce((a, b) => a + b.pcSuccessRate, 0) / c,
             circleEntries: qSums.reduce((a, b) => a + b.circleEntries, 0) / c,
             twentyFiveEntries: qSums.reduce((a, b) => a + b.twentyFiveEntries, 0) / c,
             possession: qSums.reduce((a, b) => a + b.possession, 0) / c,
             attackPossession: qSums.reduce((a, b) => a + b.attackPossession, 0) / c,
             buildUpStagnation: qSums.reduce((a, b) => a + b.buildUpStagnation, 0) / c,
             spp: qSums.reduce((a, b) => a + b.spp, 0) / c,
             timePerCE: qSums.reduce((a, b) => a + b.timePerCE, 0) / c
           };
        })[0] as any
      })),
      pressureData: teamMatches.map((m, i) => {
        const isHome = m.homeTeam.name === currentTeam;
        return { interval: `M${i + 1}`, [currentTeam]: isHome ? m.matchStats.home.spp : m.matchStats.away.spp, ['상대팀']: isHome ? m.matchStats.away.spp : m.matchStats.home.spp };
      }),
      attackThreatData: teamMatches.map((m, i) => {
        const isHome = m.homeTeam.name === currentTeam;
        const my = isHome ? m.matchStats.home : m.matchStats.away;
        const opp = isHome ? m.matchStats.away : m.matchStats.home;
        return { interval: `M${i + 1}`, [currentTeam]: (my.shots || 0) + (my.pcs || 0), ['상대팀']: (opp.shots || 0) + (opp.pcs || 0) };
      }),
    };

    return { allTeams, currentTeam, teamMatches, currentTeamStats, globalAvg, teamPressureStats, globalPressureStats, mockMatchForCharts };
  }, [matches, selectedTeamName, selectedTeamColor, opponentColor]);

  if (loading) return <div className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />대회 데이터를 불러오는 중...</div>;
  if (!analysisData) return <div className="py-20 text-center">대회에 등록된 경기가 없습니다.</div>;

  const { allTeams, currentTeam, teamMatches, currentTeamStats, globalAvg, teamPressureStats, globalPressureStats, mockMatchForCharts } = analysisData;

  const quadrantData = allTeams.map(name => {
    const stats = matches.filter(m => m.homeTeam.name === name || m.awayTeam.name === name).reduce((acc, m) => {
      const isHome = m.homeTeam.name === name;
      const my = isHome ? m.matchStats.home : m.matchStats.away;
      const opp = isHome ? m.matchStats.away : m.matchStats.home;
      return { 
        shots: acc.shots + (my.shots || 0), 
        pcs: acc.pcs + (my.pcs || 0), 
        circle: acc.circle + (my.circleEntries || 0),
        attPoss: acc.attPoss + (my.attackPossession || 0),
        timeCE: acc.timeCE + (my.timePerCE || 0),
        allowedShots: acc.allowedShots + (opp.shots || 0),
        allowedPC: acc.allowedPC + (opp.pcs || 0),
        count: acc.count + 1
      };
    }, { shots: 0, pcs: 0, circle: 0, attPoss: 0, timeCE: 0, allowedShots: 0, allowedPC: 0, count: 0 });

    const c = stats.count || 1;
    return {
      name,
      color: name === currentTeam ? selectedTeamColor : getTeamColor(name, allTeams.indexOf(name)),
      attPoss: stats.attPoss / c,
      timeCE: stats.timeCE / c,
      threat: (stats.shots + stats.pcs) / c,
      circle: stats.circle / c,
      allowedThreat: (stats.allowedShots + stats.allowedPC) / c
    };
  });

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
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2"><TrendingUp className="h-6 w-6" /> 주요 지표 비교</div>
        <BasicMatchStats data={mockMatchForCharts as any} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="압박 시도 (경기당)" value={currentTeamStats.pressAttempts} />
          <StatsCard title="압박 성공 (경기당)" value={currentTeamStats.pressSuccess} />
          <StatsCard title="성공률 (%)" value={currentTeamStats.pressAttempts > 0 ? (currentTeamStats.pressSuccess / currentTeamStats.pressAttempts) * 100 : 0} isPercentage />
          <StatsCard title="SPP" value={currentTeamStats.spp} isTime />
        </div>
      </div>

      <div className="page-break space-y-8">
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2"><Activity className="h-6 w-6" /> 쿼터별 상세 데이터</div>
        <QuarterlyStatsTable data={mockMatchForCharts as any} />
      </div>

      <div className="page-break space-y-8">
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2"><Shield className="h-6 w-6" /> 수비 및 압박</div>
        <PressureBattleChart data={mockMatchForCharts.pressureData} homeTeam={mockMatchForCharts.homeTeam} awayTeam={{ name: '상대팀', color: opponentColor }} />
        <PressureAnalysisMap
          homeTeam={{ name: currentTeam, color: selectedTeamColor }}
          awayTeam={{ name: '대회 전체 평균', color: opponentColor }}
          homeStats={teamPressureStats}
          awayStats={globalPressureStats}
          isTournament={true}
          homeMatchCount={teamMatches.length}
          awayMatchCount={matches.length * 2}
          awayTitle="대회 전체 평균 압박"
        />
      </div>

      <div className="page-break space-y-8">
        <div className="flex items-center gap-2 text-2xl font-bold text-primary border-b-2 pb-2"><Sword className="h-6 w-6" /> 전술 포지셔닝 (4분면 분석)</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TacticalQuadrantChart
            title="피니싱 효율 (Finishing Efficiency)"
            description="서클 진입 대비 실제 위협 생성 능력"
            xAxisLabel="Circle Entries" yAxisLabel="Threat (Shots+PC)"
            data={quadrantData.map(d => ({ ...d, x: d.circle, y: d.threat }))}
            avgX={globalAvg.circleEntries} avgY={globalAvg.threat}
            selectedTeamName={currentTeam} selectedColor={selectedTeamColor}
            labels={{ tr: "High Precision", tl: "Efficiency Over Volume", br: "Volume Without Finish", bl: "Low Threat" }}
          />
          <TacticalQuadrantChart
            title="공격 생성 효율 (Attack Creation)"
            description="점유율 대비 서클 진입 속도"
            xAxisLabel="Attack Possession (%)" yAxisLabel="CE Time (s)"
            data={quadrantData.map(d => ({ ...d, x: d.attPoss, y: d.timeCE }))}
            avgX={globalAvg.attackPossession} avgY={globalAvg.timePerCE}
            selectedTeamName={currentTeam} selectedColor={selectedTeamColor}
            reversedY
            labels={{ tr: "Fast Dominance", tl: "Direct Attack", br: "Slow Buildup", bl: "Struggling Control" }}
          />
          <TacticalQuadrantChart
            title="서클 수비 효율 (Circle Defense)"
            description="상대 서클 진입 허용 대비 위협 차단 능력"
            xAxisLabel="Allowed CE" yAxisLabel="Allowed Threat"
            data={quadrantData.map(d => ({ ...d, x: globalAvg.circleEntries, y: d.allowedThreat }))}
            avgX={globalAvg.circleEntries} avgY={globalAvg.allowedThreat}
            selectedTeamName={currentTeam} selectedColor={selectedTeamColor}
            reversedX reversedY
            labels={{ tr: "Solid Defense", tl: "Vulnerable Circle", br: "High Pressure Risk", bl: "Low Volume Def" }}
          />
        </div>
      </div>
    </div>
  )
}
