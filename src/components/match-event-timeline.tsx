
"use client"

import { useState, useMemo } from "react"
import { Flag, Target, CircleDot, Trophy, PlayCircle, User, Check, Pencil } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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

  const grouped = useMemo(() => {
    const withKind = events
      .map((event, index) => ({ event, index, kind: classify(event.code) }))
      .filter((x): x is { event: MatchEvent; index: number; kind: TimelineKind } => x.kind !== null)
      .sort((a, b) => a.event.time - b.event.time);

    const map = new Map<string, typeof withKind>();
    withKind.forEach(item => {
      const q = item.event.quarter || '쿼터 미상';
      if (!map.has(q)) map.set(q, []);
      map.get(q)!.push(item);
    });
    return Array.from(map.entries());
  }, [events]);

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

  if (grouped.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>주요 이벤트 타임라인</CardTitle>
        <CardDescription>페널티 코너 · 슈팅 · 스트로크 · 득점 흐름. 득점/선방/블록엔 관련 선수를 나중에 입력할 수 있어요.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border-l-2 pl-4 flex flex-col gap-3.5">
          {grouped.map(([quarter, items]) => (
            <div key={quarter}>
              <p className="text-[11px] text-muted-foreground font-bold mb-2">{quarter}</p>
              <div className="flex flex-col gap-2">
                {items.map(({ event, index, kind }) => {
                  const meta = KIND_META[kind];
                  const Icon = meta.icon;
                  const teamColor = event.team === data.homeTeam.name ? data.homeTeam.color : data.awayTeam.color;
                  const isEditing = editingIndex === index;

                  return (
                    <div
                      key={index}
                      className={meta.highlight ? "rounded-lg p-2.5" : ""}
                      style={meta.highlight ? { backgroundColor: `${teamColor}12` } : undefined}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${teamColor}20` }}
                        >
                          <Icon className="h-3 w-3" style={{ color: teamColor }} />
                        </span>
                        <span className={`text-xs flex-1 ${meta.highlight ? 'font-bold' : ''}`}>{meta.label}</span>
                        <span className="text-xs font-bold" style={{ color: teamColor }}>{event.team}</span>
                        <span className="text-xs text-muted-foreground font-mono">{formatTime(event.time)}</span>
                        {data.videoMatchId && (
                          <button onClick={() => openClip(event.time)} className="print-hidden text-muted-foreground hover:text-primary">
                            <PlayCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {!isEditing && (
                          <button onClick={() => startEdit(index, event)} className="print-hidden text-muted-foreground hover:text-primary">
                            {event.relatedPlayer ? <User className="h-3.5 w-3.5" style={{ color: teamColor }} /> : <Pencil className="h-3 w-3" />}
                          </button>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-2 mt-2 pl-8 print-hidden">
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            placeholder="관련 선수 입력 (예: #7 김선수)"
                            className="h-8 text-xs flex-1"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit(index)}
                          />
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={() => saveEdit(index)}><Check className="h-4 w-4" /></Button>
                        </div>
                      ) : event.relatedPlayer ? (
                        <p className="text-[11px] text-muted-foreground pl-8 mt-1">{event.relatedPlayer}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
