
"use client"

import { useState, useMemo } from "react"
import { Flag, Target, CircleDot, Trophy, PlayCircle, Check, Pencil, Shield } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useFirestore } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { TournamentService } from "@/lib/tournament-service"
import type { MatchData, MatchEvent } from "@/lib/types"

interface MatchEventTimelineProps {
  data: MatchData
  onEventsUpdate?: (events: MatchEvent[]) => void
}

type TimelineKind = 'pc' | 'shot' | 'stroke' | 'goal'

const KIND_META: Record<TimelineKind, { label: string; icon: typeof Flag; highlight?: boolean }> = {
  pc: { label: "페널티 코너", icon: Flag },
  shot: { label: "슈팅", icon: Target },
  stroke: { label: "스트로크", icon: CircleDot },
  goal: { label: "득점", icon: Trophy, highlight: true },
}

function classify(code: string): TimelineKind | null {
  const c = code.trim();
  if (/득점$/.test(c)) return 'goal';
  if (/페널티코너$/.test(c)) return 'pc';
  if (/슈팅$/.test(c)) return 'shot';
  if (/스트로크|STROKE|PS$/i.test(c)) return 'stroke';
  return null;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' + s : s}`;
}

// Sportscode에서 넘어온 이벤트 id가 실제로는 중복되는 경우가 있어서(원본 데이터 특성),
// id 문자열이 아니라 원본 events 배열의 인덱스를 진짜 식별자로 씁니다.
export function MatchEventTimeline({ data, onEventsUpdate }: MatchEventTimelineProps) {
  const db = useFirestore()
  const { toast } = useToast()
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")
  const [events, setEvents] = useState<MatchEvent[]>(data.events)
  const { homeTeam, awayTeam } = data

  // 시간순으로 정렬한 뒤, 득점이 나올 때마다 누적 스코어를 같이 기록합니다.
  const timeline = useMemo(() => {
    const withKind = events
      .map((event, index) => ({ event, index, kind: classify(event.code) }))
      .filter((x): x is { event: MatchEvent; index: number; kind: TimelineKind } => x.kind !== null)
      .sort((a, b) => a.event.time - b.event.time);

    let home = 0, away = 0;
    const withScore = withKind.map(item => {
      if (item.kind === 'goal') {
        if (item.event.team === homeTeam.name) home++;
        else if (item.event.team === awayTeam.name) away++;
      }
      return { ...item, scoreHome: home, scoreAway: away };
    });

    // 쿼터가 바뀌는 지점에 구분선을 넣기 위해 그룹 경계 인덱스도 같이 계산합니다.
    const rows: Array<{ type: 'divider'; quarter: string } | (typeof withScore[number] & { type: 'event' })> = [];
    let lastQuarter: string | null = null;
    withScore.forEach(item => {
      const q = item.event.quarter || '쿼터 미상';
      if (q !== lastQuarter) {
        rows.push({ type: 'divider', quarter: q });
        lastQuarter = q;
      }
      rows.push({ type: 'event', ...item });
    });
    return rows;
  }, [events, homeTeam.name, awayTeam.name]);

  const startEdit = (index: number, e: MatchEvent) => {
    setEditingIndex(index);
    setEditValue(e.relatedPlayer || "");
  }

  const saveEdit = async (index: number) => {
    if (!db || !data.id) return;
    try {
      const updatedEvents = events.map((e, i) => i === index ? { ...e, relatedPlayer: editValue.trim() } : e);
      await TournamentService.updateEventsField(db, data.id, updatedEvents);
      setEvents(updatedEvents);
      onEventsUpdate?.(updatedEvents);
      setEditingIndex(null);
      toast({ title: "저장 완료" });
    } catch (e: any) {
      toast({ title: "저장 실패", description: e.message, variant: "destructive" });
    }
  }

  const openClip = (time: number) => {
    if (!data.videoMatchId) return;
    window.open(`/Alter_sportsplay/index.html?matchId=${data.videoMatchId}&time=${Math.max(0, Math.floor(time))}`, '_blank');
  }

  const hasEvents = timeline.some(r => r.type === 'event');
  if (!hasEvents) return null;

  const timelineGrid = (
    <div className="grid grid-cols-[1fr_64px_1fr]">
      {timeline.map((row, i) => {
        if (row.type === 'divider') {
          return (
            <div key={`d-${i}`} className="col-span-3 text-center text-[11px] font-bold text-muted-foreground bg-muted/30 rounded py-1.5 my-2">
              {row.quarter}
            </div>
          );
        }
        const isHome = row.event.team === homeTeam.name;
        return (
          <div key={row.index} className="contents">
            <div className={`border-r ${isHome ? '' : 'opacity-0'}`}>
              {isHome && renderSide(row, 'home')}
            </div>
            <div className="flex flex-col items-center justify-center text-center px-1 border-r">
              <span className="text-[10px] text-muted-foreground font-mono">{formatTime(row.event.time)}</span>
              <span className="text-[11px] font-black">{row.scoreHome} - {row.scoreAway}</span>
            </div>
            <div className={!isHome ? '' : 'opacity-0'}>
              {!isHome && renderSide(row, 'away')}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderSide = (row: Extract<(typeof timeline)[number], { type: 'event' }>, side: 'home' | 'away') => {
    const { event, index, kind, scoreHome, scoreAway } = row;
    const meta = KIND_META[kind];
    const Icon = meta.icon;
    const team = side === 'home' ? homeTeam : awayTeam;
    const isEditing = editingIndex === index;
    const align = side === 'home' ? 'items-end text-right' : 'items-start text-left';
    const rowDir = side === 'away' ? 'flex-row-reverse' : '';
    // 슈팅 태깅 도구에서 넘어온 슈터/막은 선수 정보가 있으면 그걸 우선 보여주고,
    // 없으면 (특히 득점 행에서) 사후 수동 입력을 쓸 수 있게 합니다.
    const hasTaggedPlayers = !!(event.shooter || event.defender);

    return (
      <div className={`flex flex-col ${align} gap-1 py-2 ${side === 'home' ? 'pr-3' : 'pl-3'}`}>
        <div className={`flex items-center gap-1.5 ${rowDir}`}>
          <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${team.color}20` }}>
            <Icon className="h-2.5 w-2.5" style={{ color: team.color }} />
          </span>
          <span className={`text-xs ${meta.highlight ? 'font-bold' : ''}`}>{meta.label}</span>
          {data.videoMatchId && (
            <button onClick={() => openClip(event.time)} className="print-hidden text-muted-foreground hover:text-primary">
              <PlayCircle className="h-3 w-3" />
            </button>
          )}
        </div>

        {hasTaggedPlayers ? (
          <div className={`flex flex-col gap-0.5 ${align}`}>
            {event.shooter && (
              <span className="text-[11px] font-bold" style={{ color: team.color }}>슈터 {event.shooter}</span>
            )}
            {event.defender && (
              <span className={`text-[11px] text-muted-foreground flex items-center gap-1 ${rowDir}`}>
                <Shield className="h-2.5 w-2.5" /> 막음 {event.defender}
              </span>
            )}
          </div>
        ) : isEditing ? (
          <div className={`flex items-center gap-1.5 print-hidden ${rowDir}`}>
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="선수 입력 (예: #7 김선수)"
              className="h-7 text-[11px] w-40"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && saveEdit(index)}
            />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => saveEdit(index)}><Check className="h-3.5 w-3.5" /></Button>
          </div>
        ) : (
          <button onClick={() => startEdit(index, event)} className={`print-hidden flex items-center gap-1 text-[11px] ${event.relatedPlayer ? 'font-bold' : 'text-muted-foreground'} ${rowDir}`} style={event.relatedPlayer ? { color: team.color } : undefined}>
            {event.relatedPlayer || (meta.highlight ? '선수 입력' : '')}
            {(meta.highlight || event.relatedPlayer) && <Pencil className="h-2.5 w-2.5 opacity-50" />}
          </button>
        )}
      </div>
    );
  }

  return (
    <Card>
      <Accordion type="single" collapsible defaultValue="timeline">
        <AccordionItem value="timeline" className="border-none">
          <CardHeader className="pb-0">
            <AccordionTrigger className="hover:no-underline py-0">
              <div className="text-left">
                <CardTitle>주요 이벤트 타임라인</CardTitle>
                <CardDescription className="mt-1.5">
                  <span className="font-bold" style={{ color: homeTeam.color }}>{homeTeam.name}</span> vs{" "}
                  <span className="font-bold" style={{ color: awayTeam.color }}>{awayTeam.name}</span> — 페널티 코너 · 슈팅 · 스트로크 · 득점 흐름과 진행 스코어
                </CardDescription>
              </div>
            </AccordionTrigger>
          </CardHeader>
          <AccordionContent className="print:hidden">
            <div className="px-6 pt-4">
              {timelineGrid}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      {/* 화면에서 접힌 상태로 인쇄하더라도, 인쇄물엔 항상 펼쳐진 내용이 나오게 합니다. */}
      <div className="hidden print:block px-6 pb-6">
        {timelineGrid}
      </div>
    </Card>
  )
}
