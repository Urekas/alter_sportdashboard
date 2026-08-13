
"use client"

import { useState } from "react"
import { Info, PlayCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import type { MatchData, MatchEvent } from "@/lib/types"

interface BasicMatchStatsProps {
  data: MatchData;
  ranks?: Record<string, number | null> | null;
}

// 하단 "지표 정의 가이드"와 동일한 문구를 짧게 재사용합니다.
const METRIC_INFO: Record<string, string> = {
  pcSuccessRate: "페널티코너 시도 중 득점으로 연결된 비율입니다.",
  build25Ratio: "전체 빌드업 시도 중 상대방 25m 구역(A25) 진입에 성공한 비율입니다.",
  spp: "상대 빌드업 시간을 우리 팀 압박 시도 횟수로 나눈 값. 낮을수록 압박이 강함을 의미합니다.",
  attackPossession: "양 팀 공격 구역(ATT) 점유 시간 합계 대비, 해당 팀이 차지한 비중입니다.",
  buildUpStagnation: "공격 구역에 진입하지 못하고 후방·미드필드에 머문 시간의 비중. 높을수록 전개가 느림을 의미합니다.",
  timePerCE: "서클 진입(CE) 1회를 만드는 데 평균적으로 걸린 점유 시간. 낮을수록 빠르고 직선적인 공격입니다.",
}

// 스탯 항목(key) -> 해당 지표를 만든 개별 이벤트를 찾기 위한 이벤트 코드 접미사.
// parser.ts의 `${team} 슈팅` 같은 코드 규칙과 동일합니다.
const STAT_EVENT_CODE: Record<string, string> = {
  shots: '슈팅',
  pcs: '페널티코너',
  circleEntries: '슈팅서클 진입',
  twentyFiveEntries: 'A25 START',
}

function formatEventTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' + s : s}`;
}

export function BasicMatchStats({ data, ranks }: BasicMatchStatsProps) {
  const { homeTeam, awayTeam, matchStats, events, videoMatchId } = data
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const formatValue = (val: any) => {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  };

  const getClipEvents = (key: string, teamName: string): MatchEvent[] => {
    const codeSuffix = STAT_EVENT_CODE[key];
    if (!codeSuffix || !events) return [];
    return events
      .filter(e => e.team === teamName && e.code.trim() === `${teamName} ${codeSuffix}`)
      .sort((a, b) => a.time - b.time);
  }

  const openClip = (time: number) => {
    if (!videoMatchId) return;
    window.open(`/Alter_sportsplay/index.html?matchId=${videoMatchId}&time=${Math.max(0, Math.floor(time))}`, '_blank');
  }

  const stats = [
    {
      label: "득점 (PC / 전체득점)",
      key: 'goals',
      h: `${formatValue(matchStats.home.goals.pc).toFixed(1)} / ${(formatValue(matchStats.home.goals.field) + formatValue(matchStats.home.goals.pc)).toFixed(1)}`,
      a: `${formatValue(matchStats.away.goals.pc).toFixed(1)} / ${(formatValue(matchStats.away.goals.field) + formatValue(matchStats.away.goals.pc)).toFixed(1)}`,
      hVal: formatValue(matchStats.home.goals.field) + formatValue(matchStats.home.goals.pc),
      aVal: formatValue(matchStats.away.goals.field) + formatValue(matchStats.away.goals.pc)
    },
    { label: "슈팅", key: 'shots', h: formatValue(matchStats.home.shots), a: formatValue(matchStats.away.shots), isFloat: true },
    { label: "페널티코너 (PC)", key: 'pcs', h: formatValue(matchStats.home.pcs), a: formatValue(matchStats.away.pcs), isFloat: true },
    { label: "PC 성공률 (%)", key: 'pcSuccessRate', h: formatValue(matchStats.home.pcSuccessRate), a: formatValue(matchStats.away.pcSuccessRate), isFloat: true, isPercent: true },
    { label: "서클 진입 (CE)", key: 'circleEntries', h: formatValue(matchStats.home.circleEntries), a: formatValue(matchStats.away.circleEntries), isFloat: true },
    { label: "25y 진입 (A25)", key: 'twentyFiveEntries', h: formatValue(matchStats.home.twentyFiveEntries), a: formatValue(matchStats.away.twentyFiveEntries), isFloat: true },
    { label: "빌드업 성공률 (Build25)", key: 'build25Ratio', h: formatValue(matchStats.home.build25Ratio), a: formatValue(matchStats.away.build25Ratio), isFloat: true, isPercent: true },
    { label: "SPP (압박 지수, s)", key: 'spp', h: formatValue(matchStats.home.spp), a: formatValue(matchStats.away.spp), isFloat: true, lowerIsBetter: true },
    { label: "전체 점유율 (%)", key: 'possession', h: formatValue(matchStats.home.possession), a: formatValue(matchStats.away.possession), isFloat: true, isPercent: true },
    { label: "공격 점유율 (%)", key: 'attackPossession', h: formatValue(matchStats.home.attackPossession), a: formatValue(matchStats.away.attackPossession), isFloat: true, isPercent: true },
    { label: "빌드업 정체 비율 (%)", key: 'buildUpStagnation', h: formatValue(matchStats.home.buildUpStagnation), a: formatValue(matchStats.away.buildUpStagnation), isFloat: true, lowerIsBetter: true, isPercent: true },
    { label: "CE 1회당 시간 (s)", key: 'timePerCE', h: formatValue(matchStats.home.timePerCE), a: formatValue(matchStats.away.timePerCE), isFloat: true, lowerIsBetter: true },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>종합 통계 비교</CardTitle>
        <CardDescription>
          <span className="font-bold" style={{ color: homeTeam.color }}>{homeTeam.name}</span> vs{" "}
          <span className="font-bold" style={{ color: awayTeam.color }}>{awayTeam.name}</span> — 우세한 쪽이 강조 표시됩니다.
          {videoMatchId && <span className="print-hidden"> 숫자를 클릭하면 해당 장면 영상을 볼 수 있어요.</span>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={200}>
          <div className="flex flex-col gap-4">
            {stats.map((s) => {
              const hVal = typeof s.hVal === 'number' ? s.hVal : Number(s.h);
              const aVal = typeof s.aVal === 'number' ? s.aVal : Number(s.a);
              const rank = ranks && s.key ? ranks[s.key] : null;
              const info = METRIC_INFO[s.key];

              const hasDiff = hVal !== aVal && !isNaN(hVal) && !isNaN(aVal);
              const hWins = hasDiff && (s.lowerIsBetter ? hVal < aVal : hVal > aVal);
              const aWins = hasDiff && !hWins;

              const sum = Math.abs(hVal) + Math.abs(aVal);
              // lowerIsBetter 지표는 "적은 쪽이 좋다"는 의미를 바 길이가 아니라 색상으로만 표현합니다.
              // (바 길이는 항상 실측 비중을 그대로 보여줌 — 값이 클수록 바가 김)
              const hPct = sum === 0 ? 50 : (Math.abs(hVal) / sum) * 100;
              const aPct = 100 - hPct;

              const clipsEnabled = !!videoMatchId && !!STAT_EVENT_CODE[s.key];
              const hClips = clipsEnabled ? getClipEvents(s.key, homeTeam.name) : [];
              const aClips = clipsEnabled ? getClipEvents(s.key, awayTeam.name) : [];
              const hKey = `${s.key}-h`;
              const aKey = `${s.key}-a`;

              const ValueEl = ({ side, val, clips, colorWin, teamColor }: { side: 'h' | 'a'; val: string; clips: MatchEvent[]; colorWin: boolean; teamColor: string }) => {
                const rowKey = side === 'h' ? hKey : aKey;
                const clickable = clipsEnabled && clips.length > 0;
                const content = (
                  <>
                    {val}
                    {rank && side === 'h' && <span className="text-xs font-normal ml-1">({rank}위)</span>}
                  </>
                );
                const colorStyle = colorWin ? { color: teamColor } : { color: 'var(--muted-foreground)' };
                if (!clickable) {
                  return <span className={`font-bold min-w-[64px] ${side === 'a' ? 'text-right' : ''}`} style={colorStyle}>{content}</span>;
                }
                return (
                  <button
                    type="button"
                    className={`font-bold min-w-[64px] print-hidden hover:underline underline-offset-2 inline-flex items-center gap-1 ${side === 'a' ? 'justify-end text-right' : ''}`}
                    style={colorStyle}
                    onClick={() => setExpandedKey(expandedKey === rowKey ? null : rowKey)}
                  >
                    {content}
                    <PlayCircle className="h-3 w-3 opacity-60" />
                  </button>
                );
              };

              return (
                <div key={s.label}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <ValueEl side="h" val={s.isFloat ? Number(s.h).toFixed(1) : s.h} clips={hClips} colorWin={hWins} teamColor={homeTeam.color} />
                    <span className="text-muted-foreground text-xs flex items-center gap-1">
                      {s.label}
                      {info && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[240px] text-xs">{info}</TooltipContent>
                        </Tooltip>
                      )}
                    </span>
                    <ValueEl side="a" val={s.isFloat ? Number(s.a).toFixed(1) : s.a} clips={aClips} colorWin={aWins} teamColor={awayTeam.color} />
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                    <div
                      className="h-full transition-all"
                      style={{ width: `${hPct}%`, backgroundColor: hWins ? homeTeam.color : 'var(--muted-foreground)', opacity: hWins ? 1 : 0.25 }}
                    />
                    <div
                      className="h-full transition-all"
                      style={{ width: `${aPct}%`, backgroundColor: aWins ? awayTeam.color : 'var(--muted-foreground)', opacity: aWins ? 1 : 0.25 }}
                    />
                  </div>
                  {expandedKey === hKey && hClips.length > 0 && (
                    <div className="print-hidden mt-2 p-2 bg-muted/40 rounded-md">
                      <p className="text-[10px] font-bold text-muted-foreground mb-1.5">{homeTeam.name} {s.label} 장면 {hClips.length}개</p>
                      <div className="flex flex-wrap gap-1.5">
                        {hClips.map((e, i) => (
                          <button key={i} onClick={() => openClip(e.time)} className="text-[11px] font-mono bg-background border rounded px-2 py-0.5 hover:border-primary hover:text-primary transition-colors" style={{ color: homeTeam.color }}>
                            {formatEventTime(e.time)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {expandedKey === aKey && aClips.length > 0 && (
                    <div className="print-hidden mt-2 p-2 bg-muted/40 rounded-md">
                      <p className="text-[10px] font-bold text-muted-foreground mb-1.5">{awayTeam.name} {s.label} 장면 {aClips.length}개</p>
                      <div className="flex flex-wrap gap-1.5">
                        {aClips.map((e, i) => (
                          <button key={i} onClick={() => openClip(e.time)} className="text-[11px] font-mono bg-background border rounded px-2 py-0.5 hover:border-primary hover:text-primary transition-colors" style={{ color: awayTeam.color }}>
                            {formatEventTime(e.time)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
