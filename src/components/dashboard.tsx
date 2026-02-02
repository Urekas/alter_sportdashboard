
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
import { parseXMLData, createMatchDataFromUpload } from "@/lib/parser"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export function Dashboard() {
  const [matchData, setMatchData] = useState<MatchData | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleLoadMockData = () => {
    setMatchData(mockMatchData)
    toast({
      title: "데모 데이터 로드됨",
      description: "Korea vs Netherlands 분석 데이터를 불러왔습니다.",
    })
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          if (file.name.endsWith('.xml')) {
            const { events, teams } = parseXMLData(content);
            if (events.length === 0) {
              throw new Error("분석 가능한 이벤트가 없습니다. XML 형식을 확인하세요.");
            }
            const newData = createMatchDataFromUpload(events, teams.home, teams.away);
            setMatchData(newData);
            toast({ title: "분석 완료", description: `${teams.home} vs ${teams.away} 경기 데이터가 업데이트되었습니다.` });
          } else {
            throw new Error("XML 파일만 지원합니다.");
          }
        } catch (error: any) {
          toast({ title: "오류 발생", description: error.message, variant: "destructive" });
        }
      };
      reader.readAsText(file);
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 print-hidden">
        <div>
          <h1 className="text-4xl font-bold text-primary font-headline tracking-tight">Field Focus</h1>
          <p className="text-muted-foreground mt-1">전문가용 필드 하키 퍼포먼스 분석 솔루션</p>
        </div>
        <div className="flex items-center gap-2 mt-4 md:mt-0">
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xml" className="hidden" />
          <Button onClick={() => fileInputRef.current?.click()} className="shadow-md">
            <Upload className="mr-2 h-4 w-4" /> 데이터 업로드
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
          <div className="flex flex-col items-center justify-center text-center py-20 bg-card rounded-xl border-2 border-dashed border-muted-foreground/25">
            <Activity className="w-16 h-16 text-muted-foreground/40 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">분석을 시작하세요</h2>
            <p className="text-muted-foreground mb-6 max-w-sm">
              SportsCode XML 파일을 업로드하여 실제 데이터를 분석하세요. (예: 아시안컵 일본 vs 인도)
            </p>
            <div className="flex gap-3">
              <Button onClick={() => fileInputRef.current?.click()}>파일 업로드</Button>
              <Button variant="secondary" onClick={handleLoadMockData}>데모 데이터</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* 요약 카드 섹션 */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatsCard
                title={`${matchData.homeTeam.name} SPP`}
                value={(matchData.matchStats.home.spp || 0).toFixed(2)}
                description="압박 지수 (낮을수록 우수)"
                icon={<TrendingDown className="text-emerald-500" />}
              />
              <StatsCard
                title={`${matchData.homeTeam.name} 빌드업 성공률`}
                value={`${((matchData.matchStats.home.build25Ratio || 0) * 100).toFixed(2)}%`}
                description="25m 진입 성공률"
                icon={<ShieldCheck className="text-primary/60" />}
              />
              <StatsCard
                title={`${matchData.homeTeam.name} 공격 유지 시간`}
                value={`${(matchData.matchStats.home.avgAttackDuration || 0).toFixed(2)}s`}
                description="공격 1회당 평균 유지 시간"
                icon={<Target className="text-primary/60" />}
              />
              <StatsCard
                title={`${matchData.homeTeam.name} CE 소요 시간`}
                value={`${(matchData.matchStats.home.timePerCE || 0).toFixed(2)}s`}
                description="서클 진입당 소요 시간"
                icon={<Activity className="text-primary/60" />}
              />
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <BasicMatchStats data={matchData} />
              </div>
              <div className="lg:col-span-1">
                <PressureBattleChart data={matchData.pressureData} homeTeam={matchData.homeTeam} awayTeam={matchData.awayTeam} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <CircleEntryAnalysis teamName={matchData.homeTeam.name} entries={matchData.circleEntries.filter(e => e.team === matchData.homeTeam.name)} />
              <CircleEntryAnalysis teamName={matchData.awayTeam.name} entries={matchData.circleEntries.filter(e => e.team === matchData.awayTeam.name)} />
            </div>

            <BuildUpEfficiencyChart data={matchData} />
            
            <PressureAnalysisMap events={matchData.events} homeTeam={matchData.homeTeam} awayTeam={matchData.awayTeam} />
            
            <AttackThreatChart data={matchData.attackThreatData} homeTeam={matchData.homeTeam} awayTeam={matchData.awayTeam} />

            <div className="pt-8">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Activity className="h-6 w-6 text-primary" /> 쿼터별 상세 분석 데이터
              </h2>
              <QuarterlyStatsTable data={matchData} />
            </div>

            <div className="pt-12 print-hidden">
              <Accordion type="single" collapsible className="w-full border rounded-xl bg-muted/20">
                <AccordionItem value="log" className="border-none">
                  <AccordionTrigger className="px-6 py-4 hover:no-underline font-semibold text-primary">
                    데이터 파싱 로그 및 원본 데이터 검증 ({matchData.events.length}개 이벤트)
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <div className="max-h-96 overflow-y-auto rounded-lg border bg-background shadow-inner">
                      <Table>
                        <TableHeader className="bg-muted sticky top-0 z-10">
                          <TableRow>
                            <TableHead>No.</TableHead>
                            <TableHead>팀</TableHead>
                            <TableHead>코드(Row)</TableHead>
                            <TableHead>위치(지역)</TableHead>
                            <TableHead>결과</TableHead>
                            <TableHead>시간</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {matchData.events.map((e, i) => (
                            <TableRow key={e.id}>
                              <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                              <TableCell className="font-bold">{e.team}</TableCell>
                              <TableCell className="text-sm">{e.code}</TableCell>
                              <TableCell className="text-sm">{e.locationLabel}</TableCell>
                              <TableCell className="text-sm text-emerald-600 font-medium">{e.resultLabel}</TableCell>
                              <TableCell className="font-mono text-xs">{e.time.toFixed(2)}s</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
