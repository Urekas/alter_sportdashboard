// 통합 영상 분석(/analysis)용 경기 요약 — 여러 해·여러 대회가 쌓여도 가볍게 열리도록
//  - VideoIndex/{경기id}: 고르기 화면에 쓰는 작은 정보(팀·날짜·대회). 범위 고르기는 이것만 읽음
//  - VideoClips/{경기id}: 그 경기의 클립 전부를 문자열 하나로 압축(경기당 약 25KB). 고른 경기만 읽음
//    → 40경기를 묶어 봐도 읽기 40번 (Events 컬렉션이면 4만 번)
// Firestore를 직접 쓰지 않는 순수 함수만 여기 둠 (node 테스트용). 저장은 video-index-service.ts
import type { MatchEvent } from './types';
import { buildVideoEvents } from './video-events';

export const VIDEO_INDEX_COL = 'VideoIndex';
export const VIDEO_CLIPS_COL = 'VideoClips';
export const VIDEO_INDEX_VERSION = 1;

export interface VideoIndexDoc {
  v: number;
  matchId: string;
  videoMatchId: string;
  name: string;
  date: string; // YYYY-MM-DD (모르면 '')
  tournamentId: string;
  tournamentName: string;
  tournamentCategory: string;
  home: string;
  away: string;
  clipCount: number;
  updatedAt: string;
}

export interface VideoClipsDoc {
  v: number;
  matchId: string;
  videoMatchId: string;
  codes: string[];
  teams: string[];
  quarters: string[];
  labels: { g: string; t: string }[];
  /** "코드,팀,시작(0.1초),끝(0.1초),쿼터,라벨.라벨;..." (숫자는 위 배열의 위치, 없으면 -1·빈칸) */
  ev: string;
}

export interface Clip {
  key: string; // 경기id#순번 — 화면에서 고르기·이어보기용
  matchId: string;
  videoMatchId: string;
  code: string;
  team: string;
  start: number;
  end: number;
  quarter: string;
  labels: { g: string; t: string }[];
}

// 좌표처럼 숫자뿐인 라벨 그룹은 매트릭스에 쓸모없음
const SKIP_GROUP = /^(x|y)_?(loc|location|goal)/i;

/** "20260918 M03 ..." 같은 경기 이름 앞 날짜 → 2026-09-18 */
export function dateFromName(name: string): string {
  const m = /(20\d{2})[-.]?(\d{2})[-.]?(\d{2})/.exec(name || '');
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

export function buildVideoIndex(
  m: { id: string; videoMatchId: string; matchName?: string; homeTeam: { name: string }; awayTeam: { name: string }; events: MatchEvent[]; rawSourceText?: string; tournamentId?: string; tournamentName?: string },
  extra: { date?: string; tournamentName?: string; tournamentCategory?: string } = {},
): { index: VideoIndexDoc; clips: VideoClipsDoc } {
  const ve = buildVideoEvents(m.videoMatchId, m.events, m.rawSourceText);
  const codes: string[] = [];
  const teams: string[] = [];
  const quarters: string[] = [];
  const labels: { g: string; t: string }[] = [];
  const at = <T>(arr: T[], key: (x: T) => string, v: T) => {
    const k = key(v);
    let i = arr.findIndex((x) => key(x) === k);
    if (i < 0) i = arr.push(v) - 1;
    return i;
  };
  const sKey = (s: string) => s;
  const lKey = (l: { g: string; t: string }) => `${l.g}\u0000${l.t}`;
  const parts = ve
    .map((x) => x.data)
    .sort((a, b) => a.start_time - b.start_time)
    .map((d) => {
      const ls = d.label_list.filter((l) => !SKIP_GROUP.test(l.group)).map((l) => at(labels, lKey, { g: l.group, t: l.text }));
      return [
        at(codes, sKey, d.code),
        d.team ? at(teams, sKey, d.team) : -1,
        Math.round(d.start_time * 10),
        Math.round(d.end_time * 10),
        d.quarter ? at(quarters, sKey, d.quarter) : -1,
        ls.join('.'),
      ].join(',');
    });
  const now = new Date().toISOString();
  return {
    index: {
      v: VIDEO_INDEX_VERSION,
      matchId: m.id,
      videoMatchId: m.videoMatchId,
      name: m.matchName || '',
      date: dateFromName(m.matchName || '') || extra.date || '',
      tournamentId: m.tournamentId || '',
      tournamentName: extra.tournamentName || m.tournamentName || '',
      tournamentCategory: extra.tournamentCategory || '',
      home: m.homeTeam?.name || '',
      away: m.awayTeam?.name || '',
      clipCount: parts.length,
      updatedAt: now,
    },
    clips: { v: VIDEO_INDEX_VERSION, matchId: m.id, videoMatchId: m.videoMatchId, codes, teams, quarters, labels, ev: parts.join(';') },
  };
}

export function decodeClips(d: VideoClipsDoc): Clip[] {
  if (!d?.ev) return [];
  return d.ev.split(';').map((row, i) => {
    const [c, t, s, e, q, ls] = row.split(',');
    return {
      key: `${d.matchId}#${i}`,
      matchId: d.matchId,
      videoMatchId: d.videoMatchId,
      code: d.codes[+c] ?? '',
      team: +t >= 0 ? d.teams[+t] ?? '' : '',
      start: +s / 10,
      end: +e / 10,
      quarter: +q >= 0 ? d.quarters[+q] ?? '' : '',
      labels: ls ? ls.split('.').map((k) => d.labels[+k]).filter(Boolean) : [],
    };
  });
}

/** 코드에서 팀 이름 떼기: "한국 TEAM" → "TEAM", "한국프레스" → "프레스", "한국_GK선방" → "GK선방" */
export function actionOf(code: string, team: string, allTeams: string[] = []): string {
  const names = [team, ...allTeams].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const n of names) {
    if (code.startsWith(n)) {
      const rest = code.slice(n.length).replace(/^[\s_\-:·]+/, '');
      if (rest) return rest;
    }
  }
  return code;
}

/** 띄어쓰기만 다른 액션은 하나로 ("하프라인통과" = "하프라인 통과") */
export const actionKey = (a: string) => a.replace(/[\s_]+/g, '').toLowerCase();

/**
 * 클립마다 액션 이름(팀 이름 뗀 코드)을 정함.
 *  1) 코드가 팀 이름으로 시작하면 뗌
 *  2) 안 되면 "첫 단어 + 나머지"에서 나머지가 다른 클립의 액션과 같으면 첫 단어를 팀 표기로 봄 ("영국 TEAM" → "TEAM")
 *  3) 같은 key(띄어쓰기 무시)는 가장 많이 쓴 표기로 통일
 */
export function actionsFor(clips: Clip[], teamNames: string[]): Map<string, string> {
  const first = new Map<string, string>();
  for (const c of clips) first.set(c.key, actionOf(c.code, c.team, teamNames));
  const known = new Set<string>();
  for (const c of clips) if (first.get(c.key) !== c.code) known.add(actionKey(first.get(c.key)!));
  for (const c of clips) {
    const a = first.get(c.key)!;
    if (a !== c.code) continue;
    const m = /^(\S+)[\s_]+(.+)$/.exec(c.code);
    if (m && known.has(actionKey(m[2]))) first.set(c.key, m[2]);
  }
  const counts = new Map<string, Map<string, number>>();
  for (const a of first.values()) {
    const k = actionKey(a);
    const m = counts.get(k) ?? new Map<string, number>();
    m.set(a, (m.get(a) ?? 0) + 1);
    counts.set(k, m);
  }
  const display = new Map<string, string>();
  for (const [k, m] of counts) display.set(k, [...m].sort((x, y) => y[1] - x[1])[0][0]);
  const out = new Map<string, string>();
  for (const [key, a] of first) out.set(key, display.get(actionKey(a))!);
  return out;
}
