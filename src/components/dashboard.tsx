"use client"

import React, { useState, useRef } from "react"
import { Upload, Printer, FileText, TrendingUp, TrendingDown } from "lucide-react"
import type { MatchData, MatchEvent } from "@/lib/types"
import { mockMatchData } from "@/lib/data"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { StatsCard } from "./stats-card"
import { PressureBattleChart } from "./pressure-battle-chart"
import { PressureAnalysisMap } from "./pressure-analysis-map"
import { CircleEntryAnalysis } from "./circle-entry-analysis"
import { BasicMatchStats } from "./basic-match-stats"
import { AttackThreatChart } from "./attack-threat-chart"
import { QuarterlyStatsTable } from "./quarterly-stats-table"
import { BuildUpEfficiencyChart } from "./build-up-efficiency-chart"
import { parseXMLData, parseCSVData, createMatchDataFromUpload } from "@/lib/parser"


export function Dashboard() {
  const [matchData, setMatchData] = useState<MatchData | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleLoadMockData = () => {
    setMatchData(mockMatchData)
    toast({
      title: "Demo Data Loaded",
      description: "Showing sample analysis for a mock match.",
    })
  }

  const handlePrint = () => {
    window.print()
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          let events: MatchEvent[] = [];
          let homeName = "Home";
          let awayName = "Away";
          
          if (file.name.endsWith('.xml')) {
            const result = parseXMLData(content);
            events = result.events;
            homeName = result.teams.home;
            awayName = result.teams.away;
          } else if (file.name.endsWith('.csv')) {
            events = parseCSVData(content);
            if (events.length > 0) {
              homeName = events[0].team;
              const otherTeam = events.find(ev => ev.team !== homeName);
              if (otherTeam) awayName = otherTeam.team;
            }
          } else {
             toast({
              title: "File Type Not Supported",
              description: `Please upload a SportsCode XML or a CSV file.`,
              variant: "destructive"
            });
            return;
          }

          if (events.length === 0) {
              toast({
                title: "No Events Found",
                description: 'The file was read, but no match events were found. Please check the file content.',
                variant: "destructive",
              });
              return;
          }
            
          const newMatchData = createMatchDataFromUpload(events, homeName, awayName);
            
          setMatchData(newMatchData);
          toast({
            title: "Analysis Complete",
            description: `Teams: ${homeName} vs ${awayName}. Processed ${events.length} events.`,
          });

        } catch (error: any) {
          console.error("File processing error:", error);
          toast({
            title: "File Processing Error",
            description: error.message || "Could not process the file. Please ensure it is a valid format.",
            variant: "destructive",
          });
        }
      };
      
      reader.readAsText(file);
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 print-hidden">
        <div>
          <h1 className="text-4xl font-bold text-primary font-headline">Field Focus</h1>
          <p className="text-muted-foreground mt-1">Advanced Field Hockey Analytics</p>
        </div>
        <div className="flex items-center gap-2 mt-4 md:mt-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xml,.csv"
            className="hidden"
          />
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2" />
            Upload Data
          </Button>
          {matchData && (
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2" />
              Print Report
            </Button>
          )}
        </div>
      </header>

      <main className="printable-area">
        {!matchData ? (
          <div className="flex flex-col items-center justify-center text-center py-20 bg-card rounded-lg border-2 border-dashed">
            <FileText className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2 font-headline">No Data Loaded</h2>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Upload a SportsCode XML or CSV file to begin your analysis, or use our demo data to explore the features.
            </p>
            <div className="flex items-center gap-4">
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2" />
                Upload Data
              </Button>
              <Button variant="secondary" onClick={handleLoadMockData}>Load Demo Data</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4 font-headline">Key Metrics</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <StatsCard
                  title={`${matchData.homeTeam.name} SPP`}
                  value={matchData.spp.home.toFixed(2)}
                  description="Seconds Per Press"
                  icon={<TrendingDown className="text-green-500" />}
                />
                <StatsCard
                  title={`${matchData.awayTeam.name} SPP`}
                  value={matchData.spp.away.toFixed(2)}
                  description="Seconds Per Press"
                  icon={<TrendingUp className="text-red-500" />}
                />
                <StatsCard
                  title={`${matchData.homeTeam.name} Build25`}
                  value={`${(matchData.build25Ratio.home * 100).toFixed(0)}%`}
                  description="Build-up to 25m Ratio"
                />
                <StatsCard
                  title={`${matchData.awayTeam.name} Build25`}
                  value={`${(matchData.build25Ratio.away * 100).toFixed(0)}%`}
                  description="Build-up to 25m Ratio"
                />
              </div>
            </section>

            <BasicMatchStats data={matchData} />
            
            <div className="grid grid-cols-1 gap-8">
              <div className="w-full">
                 <PressureBattleChart
                    data={matchData.pressureData}
                    homeTeam={matchData.homeTeam}
                    awayTeam={matchData.awayTeam}
                  />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                <CircleEntryAnalysis
                  teamName={matchData.homeTeam.name}
                  entries={matchData.circleEntries.filter(e => e.team === matchData.homeTeam.name)}
                />
                <CircleEntryAnalysis
                  teamName={matchData.awayTeam.name}
                  entries={matchData.circleEntries.filter(e => e.team === matchData.awayTeam.name)}
                />
              </div>

              <div className="w-full">
                <BuildUpEfficiencyChart data={matchData} />
              </div>

              <div className="w-full">
                <PressureAnalysisMap
                    events={matchData.events}
                    homeTeam={matchData.homeTeam}
                    awayTeam={matchData.awayTeam}
                  />
              </div>

              <div className="w-full">
                <AttackThreatChart
                  data={matchData.attackThreatData}
                  homeTeam={matchData.homeTeam}
                  awayTeam={matchData.awayTeam}
                />
              </div>

              {/* Quarterly Stats Table at the bottom */}
              <div className="w-full pt-8">
                <h2 className="text-2xl font-semibold mb-4 font-headline">Quarterly Detailed Analysis</h2>
                <QuarterlyStatsTable data={matchData} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
