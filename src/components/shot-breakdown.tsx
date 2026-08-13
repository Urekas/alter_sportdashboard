
"use client"

import { useMemo, useState } from "react"
import { PlayCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { MatchData, MatchEvent, Team } from "@/lib/types"

interface ShotBreakdownProps {
  data: MatchData;
}

type Outcome = 'goal' | 'save' | 'block' | 'pcWon' | 'miss' | 'post' | 'other' | 'unrecorded';

const OUTCOME_ORDER: Outcome[] = ['goal', 'save', 'block', 'pcWon', 'miss', 'post', 'other', 'unrecorded'];
const OUTCOME_LABEL: Record<Outcome, string> = {
  goal: '득점', save: 'GK 선방', block: '블록', pcWon: 'PC 유도', miss: '빗나감/아웃', post: '포스트', other: '기타', unrecorded: '결과 미기록',
};

// 태깅 도구의 "Output" 필드는 자유 텍스트라 태그마다 표기가 다를 수 있어 느슨하게 매칭합니다.
// (실제 운영 데이터 기준 확인된 표기: GOAL, GK_save, PC, 그리고 결과 미입력(빈 값)이 상당수)
function classifyOutcome(resultLabel: string): Outcome {
  const r = (resultLabel || '').trim();
  if (!r) return 'unrecorded';
  if (/POST|포스트|골대/i.test(r)) return 'post';
  if (/GOAL|득점|^골$/i.test(r)) return 'goal';
  if (/SAVE|막힘|선방|GK/i.test(r)) return 'save';
  if (/BLOCK|블록/i.test(r)) return 'block';
  if (/OUT|WIDE|MISS|빗나|아웃|FAIL/i.test(r)) return 'miss';
  if (/^PC$/i.test(r)) return 'pcWon'; // 이 슈팅 시도가 추가 PC를 얻어낸 경우
  return 'other';
}

function formatEventTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' + s : s}`;
}

// 슈팅(필드) + 페널티코너 시도를 합쳐 "골대를 향한 시도"로 보고, 결과별로 묶습니다.
function collectShotEvents(events: MatchEvent[], team: string): MatchEvent[] {
  return events.filter(e => e.team === team && (e.code.trim() === `${team} 슈팅` || e.code.trim() === `${team} 페널티코너`));
}

export function ShotBreakdown({ data }: ShotBreakdownProps) {
  const { homeTeam, awayTeam, events, videoMatchId } = data;
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const build = (team: Team) => {
      const shots = collectShotEvents(events, team.name);
      const byOutcome = new Map<Outcome, MatchEvent[]>();
      OUTCOME_ORDER.forEach(o => byOutcome.set(o, []));
      shots.forEach(e => byOutcome.get(classifyOutcome(e.resultLabel))!.push(e));
      return { total: shots.length, byOutcome };
    };
    return { home: build(homeTeam), away: build(awayTeam) };
  }, [events, homeTeam, awayTeam]);

  const openClip = (time: number) => {
    if (!videoMatchId) return;
    window.open(`/Alter_sportsplay/index.html?matchId=${videoMatchId}&time=${Math.max(0, Math.floor(time))}`, '_blank');
  }

  if (grouped.home.total === 0 && grouped.away.total === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>슈팅 결과 브레이크다운</CardTitle>
        <CardDescription>
          <span className="font-bold" style={{ color: homeTeam.color }}>{homeTeam.name}</span> vs{" "}
          <span className="font-bold" style={{ color: awayTeam.color }}>{awayTeam.name}</span> — 슈팅+PC 시도가 어떤 결과로 끝났는지
          {videoMatchId && <span className="print-hidden"> · 숫자를 클릭하면 해당 장면 영상을 볼 수 있어요.</span>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm font-bold mb-4 pb-3 border-b">
          <span style={{ color: homeTeam.color }}>전체 시도 {grouped.home.total}</span>
          <span className="text-muted-foreground text-xs">슈팅 + PC</span>
          <span style={{ color: awayTeam.color }}>전체 시도 {grouped.away.total}</span>
        </div>
        <div className="flex flex-col gap-4">
          {OUTCOME_ORDER.map(outcome => {
            const hClips = grouped.home.byOutcome.get(outcome) || [];
            const aClips = grouped.away.byOutcome.get(outcome) || [];
            const hCount = hClips.length, aCount = aClips.length;
            if (hCount === 0 && aCount === 0) return null;

            const sum = hCount + aCount;
            const hPct = sum === 0 ? 50 : (hCount / sum) * 100;
            const aPct = 100 - hPct;
            const hKey = `${outcome}-h`, aKey = `${outcome}-a`;

            const ValueEl = ({ side, count, clips, teamColor }: { side: 'h' | 'a'; count: number; clips: MatchEvent[]; teamColor: string }) => {
              const rowKey = side === 'h' ? hKey : aKey;
              const clickable = !!videoMatchId && clips.length > 0;
              if (!clickable) {
                return <span className={`font-bold min-w-[40px] ${side === 'a' ? 'text-right' : ''}`} style={{ color: teamColor }}>{count}</span>;
              }
              return (
                <button
                  type="button"
                  className={`font-bold min-w-[40px] print-hidden hover:underline underline-offset-2 inline-flex items-center gap-1 ${side === 'a' ? 'justify-end text-right' : ''}`}
                  style={{ color: teamColor }}
                  onClick={() => setExpandedKey(expandedKey === rowKey ? null : rowKey)}
                >
                  {count}
                  <PlayCircle className="h-3 w-3 opacity-60" />
                </button>
              );
            };

            return (
              <div key={outcome}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <ValueEl side="h" count={hCount} clips={hClips} teamColor={homeTeam.color} />
                  <span className="text-muted-foreground text-xs">{OUTCOME_LABEL[outcome]}</span>
                  <ValueEl side="a" count={aCount} clips={aClips} teamColor={awayTeam.color} />
                </div>
                <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                  <div className="h-full transition-all" style={{ width: `${hPct}%`, backgroundColor: homeTeam.color, opacity: hCount > 0 ? 1 : 0 }} />
                  <div className="h-full transition-all" style={{ width: `${aPct}%`, backgroundColor: awayTeam.color, opacity: aCount > 0 ? 1 : 0 }} />
                </div>
                {expandedKey === hKey && hCount > 0 && (
                  <div className="print-hidden mt-2 p-2 bg-muted/40 rounded-md">
                    <p className="text-[10px] font-bold text-muted-foreground mb-1.5">{homeTeam.name} {OUTCOME_LABEL[outcome]} 장면 {hCount}개</p>
                    <div className="flex flex-wrap gap-1.5">
                      {hClips.map((e, i) => (
                        <button key={i} onClick={() => openClip(e.time)} className="text-[11px] font-mono bg-background border rounded px-2 py-0.5 hover:border-primary hover:text-primary transition-colors" style={{ color: homeTeam.color }}>
                          {formatEventTime(e.time)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {expandedKey === aKey && aCount > 0 && (
                  <div className="print-hidden mt-2 p-2 bg-muted/40 rounded-md">
                    <p className="text-[10px] font-bold text-muted-foreground mb-1.5">{awayTeam.name} {OUTCOME_LABEL[outcome]} 장면 {aCount}개</p>
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
      </CardContent>
    </Card>
  )
}
