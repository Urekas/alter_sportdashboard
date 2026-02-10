
"use client"

import React, { useState, useRef } from "react"
import { Upload, Printer, TrendingDown, Target, Activity, ShieldCheck } from "lucide-react"
import type { MatchData } from "@/lib/types"
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
    toast({ title: "데모 데이터 로드됨" })
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const ab = e.target?.result as ArrayBuffer;
          
          // 인코딩 감지 로직: 한국형 엑셀 CSV 대응
          let content = new TextDecoder('utf-8').decode(ab);
          const replacementCharCount = (content.match(/\ufffd/g) || []).length;
          if (replacementCharCount > 5) {
            content = new TextDecoder('euc-kr').decode(ab);
          }

          const parsed = file.name.endsWith('.xml') ? parseXMLData(content) : parseCSVData(content);
          if (parsed.events.length === 0) throw new Error("분석 가능한 데이터가 없습니다.");
          
          const newData = createMatchDataFromUpload(parsed.events, parsed.teams.home, parsed.teams.away);
          setMatchData(newData);
          toast({ title: "분석 완료", description: `${parsed.teams.home} vs ${parsed.teams.away}` });
        } catch (error: any) {
          toast({ title: "오류 발생", description: error.message, variant: "destructive" });
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 print-hidden">
        <div>
          <h1 className="text-4xl font-bold text-primary italic tracking-tight font-headline">Field Focus</h1>
          <p className="text-muted-foreground mt-1">Advanced Hockey Performance Analytics</p>
        </div>
        <div className="flex gap-2 mt-4 md:mt-0">
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xml,.csv" className="hidden" />
          <Button onClick={() => fileInputRef.current?.click()} className="shadow-md">
            <Upload className="mr-2 h-4 w-4" /> 데이터 업로드 (XML/CSV)
          </Button>
          {matchData && (
            <Button variant="outline" onClick={() => window.print()} className="shadow-sm">
              <Printer className="mr-2 h-4 w-4" /> 리포트 인쇄
            </Button>
          )}
        </div>
      </header>

      <main className="printable-area">
        {!matchData ? (
          <div className="py-20 text-center bg-card rounded-xl border-2 border-dashed border-muted-foreground/25">
            <Activity className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">분석을 시작하세요</h2>
            <div className="flex justify-center gap-3">
              <Button onClick={() => fileInputRef.current?.click()}>파일 업로드</Button>
              <Button variant="secondary" onClick={handleLoadMockData}>데모 데이터</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[matchData.homeTeam, matchData.awayTeam].map((team, i) => (
                <div key={team.name} className="space-y-3">
                  <div className="flex items-center gap-2 font-bold" style={{ color: i === 0 ? 'hsl(var(--primary))' : 'hsl(var(--chart-2))' }}>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: i === 0 ? 'hsl(var(--primary))' : 'hsl(var(--chart-2))' }} />
                    {team.name} ({i === 0 ? '홈' : '어웨이'})
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <StatsCard title="SPP (압박 지수)" value={i === 0 ? matchData.matchStats.home.spp : matchData.matchStats.away.spp} isTime icon={<TrendingDown className="text-emerald-500 h-4 w-4" />} />
                    <StatsCard title="빌드업 성공률" value={i === 0 ? matchData.matchStats.home.build25Ratio : matchData.matchStats.away.build25Ratio} isPercentage icon={<ShieldCheck className="text-primary/60 h-4 w-4" />} />
                    <StatsCard title="공격 점유율" value={i === 0 ? matchData.matchStats.home.attackPossession : matchData.matchStats.away.attackPossession} isPercentage icon={<Target className="text-primary/60 h-4 w-4" />} />
                    <StatsCard title="CE 소요 시간" value={i === 0 ? matchData.matchStats.home.timePerCE : matchData.matchStats.away.timePerCE} isTime icon={<Activity className="text-primary/60 h-4 w-4" />} />
                  </div>
                </div>
              ))}
            </div>

            <BasicMatchStats data={matchData} />
            <PressureBattleChart data={matchData.pressureData} homeTeam={matchData.homeTeam} awayTeam={matchData.awayTeam} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <CircleEntryAnalysis teamName={matchData.homeTeam.name} entries={matchData.circleEntries.filter(e => e.team === matchData.homeTeam.name)} />
              <CircleEntryAnalysis teamName={matchData.awayTeam.name} entries={matchData.circleEntries.filter(e => e.team === matchData.awayTeam.name)} />
            </div>

            <BuildUpEfficiencyChart data={matchData} />
            <PressureAnalysisMap events={matchData.events} homeTeam={matchData.homeTeam} awayTeam={matchData.awayTeam} />
            <AttackThreatChart data={matchData.attackThreatData} homeTeam={matchData.homeTeam} awayTeam={matchData.awayTeam} />
            <QuarterlyStatsTable data={matchData} />
          </div>
        )}
      </main>
    </div>
  );
}
