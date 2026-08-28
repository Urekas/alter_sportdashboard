
"use client"

import { useState, useMemo } from "react"
import { Flag, Target, CircleDot, Trophy, PlayCircle, Check, Pencil, Shield, ListVideo, Loader2 } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useFirestore } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { TournamentService } from "@/lib/tournament-service"
import { VideoMatchService } from "@/lib/video-match-service"
import type { MatchData, MatchEvent } from "@/lib/types"
import { openInNewTab, buildVideoDeepLink } from "@/lib/utils"
import { isPcAttempt } from "./shot-zone-map"

interface MatchEventTimelineProps {
  data: MatchData
  onEventsUpdate?: (events: MatchEvent[]) => void
  /** true면 영상 딥링크가 비디오 도구를 이 경기 화면에만 고정(Explorer 숨김) — 선수단 배포용. */
  lockedVideo?: boolean
  /** true면 "관련 선수" 인라인 편집(Firestore 쓰기)을 숨기고 텍스트만 표시 — 선수단 배포용. */
  readOnly?: boolean
}

type TimelineKind = 'pc' | 'shot' | 'stroke' | 'goal'
// 득점일 때 어떤 시도에서 나온 골인지 — 필드샷/페널티코너/페널티스트로크 구분용.
type GoalSource = 'field' | 'pc' | 'stroke'

const KIND_META: Record<TimelineKind, { label: string; icon: typeof Flag; highlight?: boolean }> = {
  pc: { label: "페널티 코너", icon: Flag },
  shot: { label: "슈팅", icon: Target },
  stroke: { label: "스트로크", icon: CircleDot },
  goal: { label: "득점", icon: Trophy, highlight: true },
}

// 득점 라벨을 더 구체적으로 — "득점"만 보여주는 대신 필드/PC/스트로크 중 어디서 나온
// 골인지까지 표시합니다.
const GOAL_SOURCE_LABEL: Record<GoalSource, string> = {
  field: "필드 득점",
  pc: "페널티코너 득점",
  stroke: "페널티스트로크 득점",
}

// 필터 UI/재생목록 만들기 — 6가지 종류(득점 3종 + 비득점 3종)로 골라 보고, 그 중 원하는
// 것만 골라서 비디오 도구 재생목록으로 바로 뽑아볼 수 있게 합니다.
type FilterKey = 'goal-field' | 'goal-pc' | 'goal-stroke' | 'pc' | 'shot' | 'stroke'
const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'goal-field', label: '필드 득점' },
  { key: 'goal-pc', label: '페널티코너 득점' },
  { key: 'goal-stroke', label: '페널티스트로크 득점' },
  { key: 'pc', label: '페널티 코너' },
  { key: 'shot', label: '슈팅' },
  { key: 'stroke', label: '스트로크' },
]
function getFilterKey(kind: TimelineKind, goalSource?: GoalSource): FilterKey {
  if (kind === 'goal') return `goal-${goalSource || 'field'}` as FilterKey
  return kind as FilterKey
}

// 예전엔 득점/페널티코너/슈팅을 각각 따로 태깅된 코드로 구분했는데, 실제 데이터를 보면
// 슈팅 한 번이 "슈팅"/"득점"/"페널티코너" 최대 3개 코드로 몇 초 간격을 두고 따로 태깅되는
// 경우가 흔함(같은 장면이 여러 줄로 중복 표시됨) — 게다가 GOAL 표시가 "슈팅" 쪽이 아니라
// "페널티코너"/"득점" 쪽에만 붙는 경우도 있어서 슈팅 하나만 봐서는 놓칠 수 있음. 그래서
// "슈팅"으로 태깅된 이벤트만 한 줄씩 모으고, 같은 팀·비슷한 시각(±8초)에 같이 태깅된
// 득점/페널티코너 마커까지 함께 봐서 득점 여부·PC 여부를 판별함(shot-zone-map.tsx의
// isPcAttempt와 같은 판별 기준 재사용). 득점이 PC에서 나온 경우엔 득점 표시를 우선함.
// 페널티 스트로크(코드가 "PS"로 끝남)도 같은 방식으로 득점 여부를 봐서, 스트로크가 골로
// 들어간 경우엔 "스트로크" 대신 "득점"으로 표시합니다.
const NEARBY_WINDOW_SEC = 8;

// 버그 수정(실제 경기 스코어 4:2인데 타임라인엔 7:3으로 뻥튀기됐던 문제): 개별 이벤트의
// resultLabel(예: "GOAL")은 Sportscode 시퀀스 코딩 특성상 그 골로 이어진 시퀀스 안의 관련
// 없는 이벤트(A25 START/ATT/빌드업 등)에도 폭넓게 같이 붙어있어서 신뢰할 수 없고, 리바운드
// 상황처럼 "슈팅" 코드가 연달아 여러 번 태깅된 경우 그 중 여러 개가 각자 GOAL스러운 라벨을
// 갖고 있으면 hasNearbyGoalMarker를 이벤트별로 독립 판정할 때 전부 득점으로 잡혀버려서 실제
// 골 1개가 로그엔 2~3개로 뻥튀기됨. 반면 "...득점" 코드(예: "중국 득점")는 실측 확인 결과
// 실제 골 1개당 정확히 1개씩만 존재함 — 이게 진짜 득점 개수의 기준. 그래서 이벤트별 독립
// 판정 대신, 마커 1개당 가장 가까운 슈팅/스트로크 이벤트 딱 하나만 전역적으로 짝지어서
// "그 골"로 표시하고, 같은 시퀀스의 나머지 슈팅 이벤트는 resultLabel이 뭐든 득점으로 세지
// 않습니다.
function buildGoalAssignments(events: MatchEvent[]): Set<MatchEvent> {
  const markers = [...events.filter(e => /득점$/.test(e.code.trim()))].sort((a, b) => a.time - b.time);
  const candidates = events.filter(e => /슈팅$/.test(e.code.trim()) || /스트로크|STROKE|PS$/i.test(e.code.trim()));
  const claimed = new Set<MatchEvent>();
  markers.forEach(marker => {
    let best: MatchEvent | null = null;
    let bestDiff = Infinity;
    candidates.forEach(c => {
      if (claimed.has(c) || c.team !== marker.team) return;
      const diff = Math.abs(c.time - marker.time);
      if (diff <= NEARBY_WINDOW_SEC && diff < bestDiff) { best = c; bestDiff = diff; }
    });
    if (best) claimed.add(best);
  });
  return claimed;
}

function classify(event: MatchEvent, allEvents: MatchEvent[], goalEvents: Set<MatchEvent>): { kind: TimelineKind; goalSource?: GoalSource } | null {
  const c = event.code.trim();
  const isGoal = goalEvents.has(event);
  if (/스트로크|STROKE|PS$/i.test(c)) {
    return isGoal ? { kind: 'goal', goalSource: 'stroke' } : { kind: 'stroke' };
  }
  if (/슈팅$/.test(c)) {
    const nearby = allEvents.filter(e => e.team === event.team && Math.abs(e.time - event.time) <= NEARBY_WINDOW_SEC);
    const isPc = isPcAttempt(c, event.shotType) || nearby.some(e => /페널티코너$/.test(e.code.trim()));
    if (isGoal) return { kind: 'goal', goalSource: isPc ? 'pc' : 'field' };
    if (isPc) return { kind: 'pc' };
    return { kind: 'shot' };
  }
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
export function MatchEventTimeline({ data, onEventsUpdate, lockedVideo, readOnly }: MatchEventTimelineProps) {
  const db = useFirestore()
  const { toast } = useToast()
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")
  const [events, setEvents] = useState<MatchEvent[]>(data.events)
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set(FILTER_OPTIONS.map(f => f.key)))
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false)
  const { homeTeam, awayTeam } = data

  const toggleFilter = (key: FilterKey) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // 시간순으로 정렬한 뒤, 득점이 나올 때마다 누적 스코어를 같이 기록합니다.
  const timeline = useMemo(() => {
    const goalEvents = buildGoalAssignments(events);
    const withKind = events
      .map((event, index) => {
        const c = classify(event, events, goalEvents);
        return c ? { event, index, kind: c.kind, goalSource: c.goalSource } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
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

  // 필터 체크한 종류만 남긴 뷰 — 스코어 계산엔 영향 없게(항상 전체 이벤트 기준) timeline은
  // 그대로 두고, 화면에 보여줄 행만 여기서 추려냄. 뒤에 남는 이벤트가 하나도 없는 구분선
  // (쿼터 헤더)은 같이 없애서 빈 헤더만 덩그러니 남지 않게 합니다.
  const visibleTimeline = useMemo(() => {
    if (activeFilters.size === FILTER_OPTIONS.length) return timeline;
    const filtered = timeline.filter(row => row.type === 'divider' || activeFilters.has(getFilterKey(row.kind, row.goalSource)));
    return filtered.filter((row, i) => row.type !== 'divider' || filtered[i + 1]?.type === 'event');
  }, [timeline, activeFilters]);

  const visibleEvents = useMemo(
    () => visibleTimeline.filter((r): r is Extract<typeof r, { type: 'event' }> => r.type === 'event').map(r => r.event),
    [visibleTimeline]
  );

  // 필터로 골라낸 이벤트만 비디오 도구 재생목록으로 바로 만들어서 새 탭(잠금 모드)으로 엽니다.
  const handleCreatePlaylist = async () => {
    if (!db || !data.videoMatchId || visibleEvents.length === 0) return;
    setIsCreatingPlaylist(true);
    try {
      const title = `${data.matchName || `${homeTeam.name} vs ${awayTeam.name}`} — 필터 결과 (${visibleEvents.length}개)`;
      const { playlistId, matchedCount } = await VideoMatchService.createPlaylistFromEvents(db, data.videoMatchId, visibleEvents, title);
      if (matchedCount === 0) {
        toast({ title: "영상 도구에서 매칭되는 클립을 찾지 못했어요", description: "영상 연결 후 이벤트가 동기화됐는지 확인해주세요.", variant: "destructive" });
        return;
      }
      const url = `${window.location.origin}/Alter_sportsplay/index.html?playlistId=${playlistId}&lock=1`;
      openInNewTab(url);
      try { await navigator.clipboard.writeText(url); } catch {}
      toast({ title: `재생목록 생성 완료 (${matchedCount}개 클립)`, description: "새 탭에서 바로 재생돼요 — 링크도 클립보드에 복사했어요." });
    } catch (e: any) {
      toast({ title: "재생목록 생성 실패", description: e.message, variant: "destructive" });
    } finally {
      setIsCreatingPlaylist(false);
    }
  }

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
    openInNewTab(buildVideoDeepLink(data.videoMatchId, time, lockedVideo));
  }

  const hasEvents = timeline.some(r => r.type === 'event');
  if (!hasEvents) return null;

  const renderSide = (row: Extract<(typeof timeline)[number], { type: 'event' }>, side: 'home' | 'away') => {
    const { event, index, kind, goalSource, scoreHome, scoreAway } = row;
    const meta = KIND_META[kind];
    const Icon = meta.icon;
    const label = kind === 'goal' && goalSource ? GOAL_SOURCE_LABEL[goalSource] : meta.label;
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
          <span className={`text-xs ${meta.highlight ? 'font-bold' : ''}`}>{label}</span>
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
        ) : readOnly ? (
          event.relatedPlayer ? (
            <span className={`text-[11px] font-bold ${rowDir}`} style={{ color: team.color }}>{event.relatedPlayer}</span>
          ) : null
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

  // 화면(필터 적용된 visibleTimeline)과 인쇄(항상 전체 timeline)가 서로 다른 행 목록을
  // 보여줘야 해서 함수로 뽑음 — 인쇄는 화면 필터 상태와 무관하게 항상 전체를 보여줍니다.
  const renderGrid = (rows: typeof timeline) => (
    <div className="grid grid-cols-[1fr_64px_1fr]">
      {rows.map((row, i) => {
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

  const filterBar = (
    <div className="print-hidden flex flex-wrap items-center gap-1.5 pb-3 mb-3 border-b">
      <span className="text-[11px] font-bold text-muted-foreground mr-1">필터:</span>
      {FILTER_OPTIONS.map(opt => (
        <button
          key={opt.key}
          onClick={() => toggleFilter(opt.key)}
          className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${activeFilters.has(opt.key) ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/60'}`}
        >{opt.label}</button>
      ))}
      {!readOnly && data.videoMatchId && (
        <Button
          size="sm" variant="outline"
          className="h-7 text-[11px] font-bold ml-auto"
          disabled={isCreatingPlaylist || visibleEvents.length === 0}
          onClick={handleCreatePlaylist}
        >
          {isCreatingPlaylist ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ListVideo className="h-3 w-3 mr-1" />}
          이 필터로 재생목록 만들기 ({visibleEvents.length}개)
        </Button>
      )}
    </div>
  );

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
              {filterBar}
              {renderGrid(visibleTimeline)}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      {/* 화면에서 접힌 상태로 인쇄하더라도, 인쇄물엔 항상 펼쳐진 전체 내용이 나오게 합니다
          (화면 필터 상태와 무관 — 인쇄에서 정보가 빠지면 안 되니 timeline 전체를 씀). */}
      <div className="hidden print:block px-6 pb-6">
        {renderGrid(timeline)}
      </div>
    </Card>
  )
}
