
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
    // Sort client-side to avoid index requirements
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

    // 1. Selected Team Averages
    const getAvgStatsForTeam = (teamName: string): TeamMatchStats => {
      const relevant = matches.filter(m => m.homeTeam.name === teamName || m.awayTeam.name === teamName);
      const count = relevant.length || 1;
      
      const sum = { 
        goals: { field: 0, pc: 0 }, 
        shots: 0, 
        pcs: 0, 
        circleEntries: 0, 
        twentyFiveEntries: 0, 
        possession: 0, 
        attackPossession: 0, 
        spp: 0, 
        timePerCE: 0, 
        build25Ratio: 0,
        pressAttempts: 0,
        pressSuccess: 0
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
      } as TeamMatchStats;
    };

    // 2. Global Tournament Averages
    const getGlobalAvgStats = (): TeamMatchStats => {
      let totalCount = matches.length * 2;
      const sum = { 
        goals: { field: 0, pc: 0 }, 
        shots: 0, 
        pcs: 0, 
        circleEntries: 0, 
        twentyFiveEntries: 0, 
        possession: 0, 
        attackPossession: 0, 
        spp: 0, 
        timePerCE: 0, 
        build25Ratio: 0 
      };
      
      matches.forEach(m => {
        [m.matchStats.home, m.matchStats.away].forEach(s => {
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
      });

      return {
        goals: { field: sum.goals.field / totalCount, pc: sum.goals.pc / totalCount },
        shots: sum.shots / totalCount, 
        pcs: sum.pcs / totalCount, 
        circleEntries: sum.circleEntries / totalCount,
        twentyFiveEntries: sum.twentyFiveEntries / totalCount, 
        possession: sum.possession / totalCount,
        attackPossession: sum.attackPossession / totalCount, 
        spp: sum.spp / totalCount,
        timePerCE: sum.timePerCE / totalCount, 
        build25Ratio: sum.build25Ratio / totalCount,
      } as TeamMatchStats;
    };

    const teamMatches = matches.filter(m => m.homeTeam.name === currentTeam || m.awayTeam.name === currentTeam);

    // 3. Match-based Trajectory Points
    const allMatchesPoints = teamMatches.map(m => {
      const isHome = m.homeTeam.name === currentTeam;
      const hStats = m.matchStats.home;
      const aStats = m.matchStats.away;
      
      return {
        homeX: hStats.attackPossession,
        homeY: hStats.timePerCE === 0 ? 450 : Math.min(450, hStats.timePerCE),
        homeRawTime: hStats.timePerCE,
        awayX: aStats.attackPossession,
        awayY: aStats.timePerCE === 0 ? 450 : Math.min(450, aStats.timePerCE),
        awayRawTime: aStats.timePerCE
      };
    });

    const mockMatch: MatchData = {
      homeTeam: { name: currentTeam, color: 'hsl(var(--chart-1))' },
      awayTeam: { name: 'Tournament Avg', color: 'hsl(var(--chart-2))' },
      events: [],
      pressureData: teamMatches.map((m, i) => {
        const isHome = m.homeTeam.name === currentTeam;
        return {
          interval: `M${String(i + 1).padStart(2, '0')}`,
          [currentTeam]: isHome ? m.matchStats.home.spp : m.matchStats.away.spp,
          "Opponent": isHome ? m.matchStats.away.spp : m.matchStats.home.spp
        };
      }),
      circleEntries: [],
      attackThreatData: teamMatches.map((m, i) => {
        const isHome = m.homeTeam.name === currentTeam;
        return {
          interval: `M${String(i + 1).padStart(2, '0')}`,
          [currentTeam]: isHome ? m.matchStats.home.shots + m.matchStats.home.pcs : m.matchStats.away.shots + m.matchStats.away.pcs,
          "Opponent": isHome ? m.matchStats.away.shots + m.matchStats.away.pcs : m.matchStats.home.shots + m.matchStats.home.pcs
        };
      }),
      build25Ratio: { home: 0, away: 0 },
      spp: { home: 0, away: 0 },
      matchStats: { home: getAvgStatsForTeam(currentTeam), away: getGlobalAvgStats() },
      quarterlyStats: []
    };

    return { mockMatch, allTeams, currentTeam, allMatchesPoints };
  }, [matches, selectedTeamName]);

  if (loading) return <div className="py-20 text-center">Loading tournament data...</div>;
  if (matches.length === 0) return <div className="py-20 text-center text-muted-foreground">No matches found. Upload data and save to DB first.</div>;

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b-4 border-primary pb-4 gap-4">
        <div>
          <h1 className="text-4xl font-black italic text-primary uppercase tracking-tighter">Tournament Report</h1>
          <p className="text-muted-foreground font-bold text-lg">{selectedTeamName || analysisData?.currentTeam} Performance Analysis</p>
        </div>
        <div className="flex items-center gap-4 bg-card p-3 rounded-lg border shadow-sm w-full md:w-auto">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Select Team</Label>
            <Select value={selectedTeamName || (analysisData?.currentTeam || "")} onValueChange={setSelectedTeamName}>
              <SelectTrigger className="h-10 w-56 font-bold text-sm">
                <SelectValue placeholder="Select Team" />
              </SelectTrigger>
              <SelectContent>
                {analysisData?.allTeams.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="default" onClick={() => window.print()} className="h-10 bg-emerald-600 hover:bg-emerald-700 font-bold">
            <FileDown className="h-4 w-4 mr-2" /> PDF Download
          </Button>
        </div>
      </div>

      {analysisData && (
        <div className="space-y-16">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <Card className="lg:col-span-1 border-2">
                <CardHeader className="bg-muted/10 border-b">
                  <CardTitle className="text-xl font-black flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" /> Matches Analysed
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2 max-h-[450px] overflow-auto">
                  {matches.filter(m => m.homeTeam.name === analysisData.currentTeam || m.awayTeam.name === analysisData.currentTeam).map((m, i) => (
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
                   <Activity className="h-6 w-6" /> Tournament Performance Comparison
                </div>
                <BasicMatchStats data={analysisData.mockMatch} />
             </div>
          </div>

          <div className="page-break space-y-8">
            <div className="flex items-center gap-2 text-2xl font-black text-primary border-b-2 pb-1">
              <TrendingUp className="h-6 w-6" /> Match-by-Match Trends
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
            </div>
          </div>

          <div className="page-break">
            <div className="flex items-center gap-2 text-2xl font-black text-primary border-b-2 pb-1 mb-8">
              <Target className="h-6 w-6" /> Tournament Strategic Trajectory
            </div>
            <MatchTrajectoryChart 
              data={analysisData.mockMatch} 
              isTournamentView={true}
              allMatchesPoints={analysisData.allMatchesPoints}
            />
          </div>
        </div>
      )}
    </div>
  )
}
