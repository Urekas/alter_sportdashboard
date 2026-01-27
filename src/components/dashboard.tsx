"use client"

import React, { useState, useRef } from "react"
import { Upload, Printer, FileText, TrendingUp, TrendingDown } from "lucide-react"
import type { MatchData } from "@/lib/types"
import { mockMatchData } from "@/lib/data"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { StatsCard } from "./stats-card"
import { PressureBattleChart } from "./pressure-battle-chart"
import { ZoneHeatmap } from "./zone-heatmap"
import { CircleEntryAnalysis } from "./circle-entry-analysis"

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
      const fileName = event.target.files[0].name
      toast({
        title: "File Uploaded",
        description: `${fileName} is being processed.`,
      })
      // In a real app, you'd parse the file here.
      // For now, we'll just load the mock data as a demonstration and inform the user.
      setTimeout(() => {
        setMatchData(mockMatchData)
        toast({
          title: "Showing Demo Analysis",
          description: `File parsing for "${fileName}" is not yet implemented. Displaying sample data instead.`,
        })
      }, 1000)
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
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                 <PressureBattleChart
                    data={matchData.pressureData}
                    homeTeam={matchData.homeTeam}
                    awayTeam={matchData.awayTeam}
                  />
              </div>
              <div className="lg:col-span-1">
                 <ZoneHeatmap
                    turnovers={matchData.turnovers}
                    homeTeamName={matchData.homeTeam.name}
                  />
              </div>
              <CircleEntryAnalysis entries={matchData.circleEntries} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
