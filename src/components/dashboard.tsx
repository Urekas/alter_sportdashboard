
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"

export function Dashboard() {
  const [matchData, setMatchData] = useState<MatchData | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleLoadMockData = () => {
    setMatchData(mockMatchData)
    toast({
      title: "데모 데이터 로드됨",
      description: "분석 데이터를 불러왔습니다.",
    })
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          // EUC-KR(한글 엑셀) 우선 시도
          const decoder = new TextDecoder('euc-kr');
          let content = decoder.decode(arrayBuffer);
          
          // 한글 깨짐 체크 (REPLACEMENT CHARACTER 가 너무 많으면 UTF-8 시도)
          if (content.split('').filter(char => char === '').length > 10) {
             content = new TextDecoder('utf-8').decode(arrayBuffer);
          }

          let parsed;
          if (file.name.endsWith('.xml')) {
            parsed = parseXMLData(content);
          } else if (file.name.endsWith('.csv')) {
            parsed = parseCSVData(content);
          } else {
            throw new Error("지원하지 않는 파일 형식입니다. (XML, CSV 지원)");
          }

          if (parsed.events.length === 0) {
            throw new Error("분석 가능한 이벤트가 없습니다. 파일 형식을 확인하세요.");
          }
          
          const newData = createMatchDataFromUpload(parsed.events, parsed.teams.home, parsed.teams.away);
          setMatchData(newData);
          toast({ 
            title: "분석 완료", 
            description: `${parsed.teams.home} (홈) vs ${parsed.teams.away} (어웨이) 경기 데이터가 업데이트되었습니다.` 
          });
        } catch (error: any) {
          toast({ title: "오류 발생", description: error.message, variant: "destructive" });
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 print-hidden">
        <div>
          <h1 className="text-4xl font-bold text-primary font-headline tracking-tight italic">Field Focus</h1>
          <p className="text-muted-foreground mt-1">전문가용 필드 하키 퍼포먼스 분석 솔루션</p>
        </div>
        <div className="flex items-center gap-2 mt-4 md:mt-0">
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
          <div className="flex flex-col items-center justify-center text-center py-20 bg-card rounded-xl border-2 border-dashed border-muted-foreground/25">
            <Activity className="w-16 h-16 text-muted-foreground/40 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">분석을 시작하세요</h2>
            <p className="text-muted-foreground mb-6 max-w-sm">
              SportsCode XML 또는 CSV 파일을 업로드하여 실제 데이터를 분석하세요.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => fileInputRef.current?.click()}>파일 업로드</Button>
              <Button variant="secondary" onClick={handleLoadMockData}>데모 데이터</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="space-y-4">
              <h2 className="text-xl font-bold border-l-4 border-primary pl-3">핵심 퍼포먼스 요약 (Key Metrics)</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-primary font-bold">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    {matchData.homeTeam.name} (홈)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <StatsCard
                      title="SPP (압박 지수)"
                      value={matchData.matchStats.home.spp.toFixed(1)}
                      description="낮을수록 우수"
                      icon={<TrendingDown className="text-emerald-500 h-4 w-4" />}
                    />
                    <StatsCard
                      title="빌드업 성공률"
                      value={`${matchData.matchStats.home.build25Ratio.toFixed(1)}%`}
                      description="25m 진입 성공률"
                      icon={<ShieldCheck className="text-primary/60 h-4 w-4" />}
                    />
                    <StatsCard
                      title="공격 점유율"
                      value={`${matchData.matchStats.home.attackPossession.toFixed(1)}%`}
                      description="상대 진영 점유 비중"
                      icon={<Target className="text-primary/60 h-4 w-4" />}
                    />
                    <StatsCard
                      title="CE 소요 시간"
                      value={`${matchData.matchStats.home.timePerCE.toFixed(1)}s`}
                      description="진입당 시간"
                      icon={<Activity className="text-primary/60 h-4 w-4" />}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-chart-2 font-bold">
                    <div className="w-3 h-3 rounded-full bg-chart-2" />
                    {matchData.awayTeam.name} (어웨이)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <StatsCard
                      title="SPP (압박 지수)"
                      value={matchData.matchStats.away.spp.toFixed(1)}
                      description="낮을수록 우수"
                      icon={<TrendingDown className="text-emerald-500 h-4 w-4" />}
                    />
                    <StatsCard
                      title="빌드업 성공률"
                      value={`${matchData.matchStats.away.build25Ratio.toFixed(1)}%`}
                      description="25m 진입 성공률"
                      icon={<ShieldCheck className="text-primary/60 h-4 w-4" />}
                    />
                    <StatsCard
                      title="공격 점유율"
                      value={`${matchData.matchStats.away.attackPossession.toFixed(1)}%`}
                      description="상대 진영 점유 비중"
                      icon={<Target className="text-primary/60 h-4 w-4" />}
                    />
                    <StatsCard
                      title="CE 소요 시간"
                      value={`${matchData.matchStats.away.timePerCE.toFixed(1)}s`}
                      description="진입당 시간"
                      icon={<Activity className="text-primary/60 h-4 w-4" />}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
              <BasicMatchStats data={matchData} />
              <div className="w-full">
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
                    데이터 파싱 로그 ({matchData.events.length}개 이벤트)
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <div className="max-h-96 overflow-y-auto rounded-lg border bg-background shadow-inner">
                      <Table>
                        <TableHeader className="bg-muted sticky top-0 z-10">
                          <TableRow>
                            <TableHead>No.</TableHead>
                            <TableHead>팀</TableHead>
                            <TableHead>쿼터</TableHead>
                            <TableHead>코드 (Row)</TableHead>
                            <TableHead>레이블 (지역/결과)</TableHead>
                            <TableHead>시간</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {matchData.events.map((e, i) => (
                            <TableRow key={e.id}>
                              <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                              <TableCell className="font-bold">{e.team}</TableCell>
                              <TableCell className="text-xs">{e.quarter}</TableCell>
                              <TableCell className="text-sm">{e.code}</TableCell>
                              <TableCell className="text-sm text-blue-600 font-medium">
                                {e.locationLabel} / {e.resultLabel}
                              </TableCell>
                              <TableCell className="font-mono text-xs">{e.time.toFixed(1)}s</TableCell>
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
