import type { ScheduleEntry, MatchData, FinalStandingRule } from './types';

// 일정표에 남아있는 참조 문자열("Winner 47", "3rd Pool B")을 실제 팀명으로 자동 치환하고,
// Pool별 순위표 / 최종 순위를 계산하는 순수 함수 모음입니다.
// 참조 해석 우선순위: 그 경기가 실제 업로드돼 matchNumber로 연결돼 있으면 그 실제 결과가 최우선,
// 아니면 일정표에 이미 적힌 스코어(TMS에서 재붙여넣기한 경우)를 사용합니다.

export interface StandingRow {
  team: string;
  p: number; w: number; d: number; l: number; gf: number; ga: number;
  pts: number; gd: number;
}

export interface ResolvedScheduleEntry extends ScheduleEntry {
  homeResolved: string; // 해석된 실제 팀명(해석 안 되면 원문 참조 문자열 그대로)
  awayResolved: string;
  homeIsRef: boolean;   // 아직 해석되지 않은 참조 문자열인지
  awayIsRef: boolean;
}

export interface FinalStandingsRow {
  rank: number;
  team: string;
  stage: string; // 어느 스테이지 라벨에서 결정됐는지 (표시용)
}

interface MatchResult {
  homeName: string;
  awayName: string;
  winnerName: string | null; // 승부 미확정(진행 전/무승부 등)이면 null
  loserName: string | null;
  drawn: boolean;   // 승부치기 없이 무승부로 끝난 경기(풀 스테이지 등)
  resolved: boolean; // 양팀 이름 + 결과를 모두 확정할 수 있었는지
}

function parseWinnerLoserRef(ref: string): { type: 'winner' | 'loser'; matchNumber: number } | null {
  // "Winner 34"뿐 아니라 "Winner M34"처럼 경기번호 앞에 M 접두사가 붙는 일정표도 있어서(예:
  // 아시안게임 일정표) m? 로 선택적으로 허용 — parseScheduleText의 Match # 파싱과 동일한 이유.
  const m = ref.trim().match(/^(winner|loser)\s+m?(\d+)$/i);
  if (!m) return null;
  return { type: m[1].toLowerCase() as 'winner' | 'loser', matchNumber: parseInt(m[2], 10) };
}

function parsePoolRef(ref: string): { rank: number; pool: string } | null {
  const m = ref.trim().match(/^(\d+)(?:st|nd|rd|th)\s+Pool\s+([A-Za-z])$/i);
  if (!m) return null;
  return { rank: parseInt(m[1], 10), pool: m[2].toUpperCase() };
}

function isRefLike(ref: string): boolean {
  return !!parseWinnerLoserRef(ref) || !!parsePoolRef(ref);
}

// "3 - 2" 또는 승부치기 표기 "1 - 1 (3 - 2 SO)"를 파싱. 빈 값/"-"는 아직 미정으로 보고 null.
export function parseScore(score?: string): { a: number; b: number; soA?: number; soB?: number } | null {
  if (!score) return null;
  const s = score.trim();
  if (!s || s === '-') return null;
  const m = s.match(/^(\d+)\s*-\s*(\d+)(?:\s*\(\s*(\d+)\s*-\s*(\d+)\s*SO\s*\))?$/i);
  if (!m) return null;
  const result: { a: number; b: number; soA?: number; soB?: number } = { a: parseInt(m[1], 10), b: parseInt(m[2], 10) };
  if (m[3] !== undefined && m[4] !== undefined) { result.soA = parseInt(m[3], 10); result.soB = parseInt(m[4], 10); }
  return result;
}

// Pool 순위표: 스테이지 라벨이 알파벳 한 글자(A/B/C...)인 경기만 대상으로, 승3/무1/패0 -> 득실차 -> 다득점 순.
// 확정된 팀 코드끼리 붙는 경기만 집계(참조가 안 풀린 경기는 아직 제외).
export function computePoolStandings(schedule: ScheduleEntry[], matches: MatchData[]): Record<string, StandingRow[]> {
  const matchByNumber = new Map<number, MatchData>();
  matches.forEach(m => { if (typeof m.matchNumber === 'number') matchByNumber.set(m.matchNumber, m); });

  const poolMaps = new Map<string, Map<string, StandingRow>>();

  schedule.forEach(entry => {
    if (!/^[A-Za-z]$/.test(entry.stage.trim())) return;
    if (isRefLike(entry.homeRef) || isRefLike(entry.awayRef)) return;

    const linked = matchByNumber.get(entry.matchNumber);
    let homeGoals: number | null = null;
    let awayGoals: number | null = null;
    let homeName = entry.homeRef;
    let awayName = entry.awayRef;
    if (linked) {
      homeName = linked.homeTeam.name;
      awayName = linked.awayTeam.name;
      homeGoals = linked.matchStats.home.goals.field + linked.matchStats.home.goals.pc;
      awayGoals = linked.matchStats.away.goals.field + linked.matchStats.away.goals.pc;
    } else {
      const parsed = parseScore(entry.score);
      if (parsed) { homeGoals = parsed.a; awayGoals = parsed.b; }
    }
    if (homeGoals === null || awayGoals === null) return;

    const pool = entry.stage.trim().toUpperCase();
    if (!poolMaps.has(pool)) poolMaps.set(pool, new Map());
    const map = poolMaps.get(pool)!;
    const ensure = (team: string) => {
      if (!map.has(team)) map.set(team, { team, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, gd: 0 });
      return map.get(team)!;
    };
    const h = ensure(homeName), a = ensure(awayName);
    h.p++; a.p++;
    h.gf += homeGoals; h.ga += awayGoals;
    a.gf += awayGoals; a.ga += homeGoals;
    if (homeGoals > awayGoals) { h.w++; a.l++; }
    else if (homeGoals < awayGoals) { a.w++; h.l++; }
    else { h.d++; a.d++; }
  });

  const result: Record<string, StandingRow[]> = {};
  poolMaps.forEach((map, pool) => {
    result[pool] = Array.from(map.values())
      .map(t => ({ ...t, pts: t.w * 3 + t.d, gd: t.gf - t.ga }))
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  });
  return result;
}

// Winner/Loser N, N번째 Pool X 참조를 재귀적으로 해석하는 공용 엔진.
// (SF가 "1st Pool A v 2nd Pool B"를 참조하고, Final이 "Winner SF1"을 참조하는 식의 다단계 연쇄도 지원)
function createResolver(schedule: ScheduleEntry[], matches: MatchData[]) {
  const scheduleByNumber = new Map<number, ScheduleEntry>();
  schedule.forEach(s => scheduleByNumber.set(s.matchNumber, s));
  const matchByNumber = new Map<number, MatchData>();
  matches.forEach(m => { if (typeof m.matchNumber === 'number') matchByNumber.set(m.matchNumber, m); });
  const poolStandings = computePoolStandings(schedule, matches);
  const resultCache = new Map<number, MatchResult | null>();

  function resolveRefName(ref: string, visiting: Set<number>): { name: string; isRef: boolean } {
    const wl = parseWinnerLoserRef(ref);
    if (wl) {
      const result = getMatchResult(wl.matchNumber, visiting);
      const name = result ? (wl.type === 'winner' ? result.winnerName : result.loserName) : null;
      return name ? { name, isRef: false } : { name: ref, isRef: true };
    }
    const pr = parsePoolRef(ref);
    if (pr) {
      const row = poolStandings[pr.pool]?.[pr.rank - 1];
      return row ? { name: row.team, isRef: false } : { name: ref, isRef: true };
    }
    return { name: ref, isRef: false }; // 이미 확정된 팀 코드
  }

  function getMatchResult(num: number, visiting: Set<number>): MatchResult | null {
    if (resultCache.has(num)) return resultCache.get(num)!;
    if (visiting.has(num)) return null; // 순환 참조 방지
    const entry = scheduleByNumber.get(num);
    if (!entry) return null;

    visiting.add(num);
    const home = resolveRefName(entry.homeRef, visiting);
    const away = resolveRefName(entry.awayRef, visiting);
    visiting.delete(num);

    const linked = matchByNumber.get(num);
    let homeGoals: number | null = null;
    let awayGoals: number | null = null;
    let soHome: number | undefined;
    let soAway: number | undefined;
    if (linked) {
      homeGoals = linked.matchStats.home.goals.field + linked.matchStats.home.goals.pc;
      awayGoals = linked.matchStats.away.goals.field + linked.matchStats.away.goals.pc;
    }
    const parsed = parseScore(entry.score);
    if (parsed) {
      if (homeGoals === null) { homeGoals = parsed.a; awayGoals = parsed.b; }
      soHome = parsed.soA; soAway = parsed.soB;
    }

    // 실제 업로드된 매치가 연결돼 있으면 그 실제 팀명이 참조 해석보다 우선(더 신뢰할 수 있는 원본).
    const homeName = linked ? linked.homeTeam.name : home.name;
    const awayName = linked ? linked.awayTeam.name : away.name;
    const homeConfirmed = linked ? true : !home.isRef;
    const awayConfirmed = linked ? true : !away.isRef;

    let result: MatchResult;
    if (!homeConfirmed || !awayConfirmed || homeGoals === null || awayGoals === null) {
      result = { homeName, awayName, winnerName: null, loserName: null, drawn: false, resolved: false };
    } else if (homeGoals === awayGoals) {
      if (soHome !== undefined && soAway !== undefined && soHome !== soAway) {
        const winnerName = soHome > soAway ? homeName : awayName;
        const loserName = soHome > soAway ? awayName : homeName;
        result = { homeName, awayName, winnerName, loserName, drawn: false, resolved: true };
      } else {
        result = { homeName, awayName, winnerName: null, loserName: null, drawn: true, resolved: true };
      }
    } else {
      const winnerName = homeGoals > awayGoals ? homeName : awayName;
      const loserName = homeGoals > awayGoals ? awayName : homeName;
      result = { homeName, awayName, winnerName, loserName, drawn: false, resolved: true };
    }
    resultCache.set(num, result);
    return result;
  }

  return { resolveRefName, getMatchResult, matchByNumber };
}

// 일정표 렌더링용: 참조 문자열을 실제 팀명으로 치환한 버전 반환(해석 안 되면 원문 유지).
export function resolveScheduleRefs(schedule: ScheduleEntry[], matches: MatchData[]): ResolvedScheduleEntry[] {
  const { resolveRefName, matchByNumber } = createResolver(schedule, matches);
  return schedule.map(entry => {
    const home = resolveRefName(entry.homeRef, new Set());
    const away = resolveRefName(entry.awayRef, new Set());
    const linked = matchByNumber.get(entry.matchNumber);
    return {
      ...entry,
      homeResolved: linked ? linked.homeTeam.name : home.name,
      awayResolved: linked ? linked.awayTeam.name : away.name,
      homeIsRef: linked ? false : home.isRef,
      awayIsRef: linked ? false : away.isRef,
    };
  });
}

// 스테이지 라벨(예: "Final"=1/2위, "3/4"=3/4위) 매핑 규칙에 따라 최종 순위를 계산.
export function computeFinalStandings(
  schedule: ScheduleEntry[],
  matches: MatchData[],
  rules: Record<string, FinalStandingRule> | undefined
): FinalStandingsRow[] {
  if (!rules || Object.keys(rules).length === 0) return [];
  const { getMatchResult } = createResolver(schedule, matches);
  const rows: FinalStandingsRow[] = [];
  schedule.forEach(entry => {
    const rule = rules[entry.stage.trim()];
    if (!rule) return;
    const result = getMatchResult(entry.matchNumber, new Set());
    if (!result || !result.resolved) return;
    if (result.winnerName) rows.push({ rank: rule.winnerRank, team: result.winnerName, stage: entry.stage });
    if (rule.loserRank && result.loserName) rows.push({ rank: rule.loserRank, team: result.loserName, stage: entry.stage });
  });
  return rows.sort((a, b) => a.rank - b.rank);
}
