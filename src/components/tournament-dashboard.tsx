
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
      buildUpPoss: parseFloat((teamStatsList.reduce((a, b) => a + b.avgBuildUpPoss, 0) / globalCount).toFixed(1)),
      buildUp: parseFloat((teamStatsList.reduce((a, b) => a + b.avgBuildUp, 0) / globalCount).toFixed(1)),
      pcs: parseFloat((teamStatsList.reduce((a, b) => a + b.avgPCs, 0) / globalCount).toFixed(1)),
      pcSuccess: parseFloat((teamStatsList.reduce((a, b) => a + b.avgPCSuccess, 0) / globalCount).toFixed(1)),
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
        const sums = { field: 0, pc: 0, shots: 0, pcs: 0, circle: 0, a25: 0, poss: 0, att: 0, bup: 0, pcSucc: 0, spp: 0, ceTime: 0 };

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
              sums.bup += (my.buildUpPossession || 0);
              sums.pcSucc += (my.pcSuccessRate || 0);
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
                sums.bup += (side.buildUpPossession || 0);
                sums.pcSucc += (side.pcSuccessRate || 0);
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
          pcSuccessRate: getTeamAverages(currentTeam).avgPCSuccess,
          circleEntries: getTeamAverages(currentTeam).avgCircle,
          twentyFiveEntries: getTeamAverages(currentTeam).avg25y,
          possession: getTeamAverages(currentTeam).avgPoss,
          attackPossession: getTeamAverages(currentTeam).avgAttPoss,
          buildUpPossession: getTeamAverages(currentTeam).avgBuildUpPoss,
          spp: getTeamAverages(currentTeam).avgSPP,
          timePerCE: getTeamAverages(currentTeam).avgTimeCE,
          build25Ratio: getTeamAverages(currentTeam).avgBuildUp
        } as any, 
        away: {
          goals: { field: globalAvg.fieldGoals, pc: globalAvg.pcGoals },
          shots: globalAvg.shots,
          pcs: globalAvg.pcs,
          pcSuccessRate: globalAvg.pcSuccess,
          circleEntries: globalAvg.circle,
          twentyFiveEntries: globalAvg.entry25,
          possession: globalAvg.possession,
          attackPossession: globalAvg.attPoss,
          buildUpPossession: globalAvg.buildUpPoss,
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
// ... 후략
