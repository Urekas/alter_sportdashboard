"use client"

import React, { useState, useRef } from "react"
import { Upload, Printer, FileText, TrendingUp, TrendingDown } from "lucide-react"
import type { MatchData } from "@/lib/types"
import { mockMatchData } from "@/lib/data"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { StatsCard } from "./stats-card"
import { PressureBattleChart } from "./pressure-battle-chart"
import { TurnoverHeatmap } from "./turnover-heatmap"
import { CircleEntryAnalysis } from "./circle-entry-analysis"
import { BasicMatchStats } from "./basic-match-stats"
import { AttackThreatChart } from "./attack-threat-chart"
import { parseXMLData } from "@/lib/parser"


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
          
          if (file.name.endsWith('.xml')) {
            const turnovers = parseXMLData(content, mockMatchData.homeTeam.name, mockMatchData.awayTeam.name);
            
            // Create a new match data object, replacing turnovers but keeping other mock data
            const newMatchData: MatchData = {
              ...mockMatchData,
              turnovers: turnovers,
            };
            
            setMatchData(newMatchData);
            toast({
              title: "XML Parsed Successfully",
              description: `${turnovers.length} turnover events loaded. Other charts still use demo data.`,
            });
          } else {
             toast({
              title: "File Type Not Supported",
              description: `CSV parsing is not yet implemented. Please upload a SportsCode XML file.`,
              variant: "destructive"
            });
          }
        } catch (error) {
          console.error("File parsing error:", error);
          toast({
            title: "File Parsing Error",
            description: "Could not parse the file. Please ensure it is a valid SportsCode XML.",
            variant: "destructive",
          });
          // Load mock data as a fallback
          setMatchData(mockMatchData);
        }
      };
      
      reader.onerror = () => {
        toast({
            title: "File Read Error",
            description: "Could not read the selected file.",
            variant: "destructive"
        });
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
            <Button onClick={handleLoadMockData}>Load Demo Data</Button>
          </div>
        ) : (
          <div className="space-y-6">
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
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-3">
                 <PressureBattleChart
                    data={matchData.pressureData}
                    homeTeam={matchData.homeTeam}
                    awayTeam={matchData.awayTeam}
                  />
              </div>
              <CircleEntryAnalysis entries={matchData.circleEntries} />
              <AttackThreatChart
                data={matchData.attackThreatData}
                homeTeam={matchData.homeTeam}
                awayTeam={matchData.awayTeam}
              />
               <TurnoverHeatmap
                    turnovers={matchData.turnovers}
                    homeTeam={matchData.homeTeam}
                    awayTeam={matchData.awayTeam}
                  />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

    