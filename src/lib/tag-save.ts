'use client';

// 웹 태깅 저장: 고친 XML → 대시보드 파서로 다시 계산 → 경기 덮어쓰기 (+ 직전 XML은 따로 보관)
import { doc, getDoc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import { createMatchDataFromUpload, parseXMLData } from './parser';
import { TournamentService } from './tournament-service';
import { VideoMatchService } from './video-match-service';
import type { MatchData, MatchEvent } from './types';

// 경기 문서는 이미 XML+이벤트로 1MB 한도에 가까워서, 직전 XML은 다른 컬렉션에 경기당 한 개만 보관
const BACKUP_COL = 'matchXmlBackups';

export interface TagSaveResult {
  data: MatchData;
  events: number;
  /** 저장 안 하고 계산만 했는지 (?dry=1) */
  dry: boolean;
}

/** 저장 전에 계산만: 대시보드에 들어갈 경기 데이터 */
export function buildMatchData(match: MatchData, xml: string, tournamentName?: string): MatchData {
  const parsed = parseXMLData(xml);
  // 대시보드에서 팀 이름을 고쳐 둔 경우(XML 라벨은 예전 이름) → 저장된 이름을 그대로 씀
  const rename: Record<string, string> = {};
  if (parsed.teams.home !== match.homeTeam.name) rename[parsed.teams.home] = match.homeTeam.name;
  if (parsed.teams.away !== match.awayTeam.name) rename[parsed.teams.away] = match.awayTeam.name;
  // 대시보드에서 직접 적어 둔 "관련 선수" 메모는 XML에 없음 → 같은 코드·같은 시간 이벤트에서 옮겨 옴
  const memo = new Map<string, string>();
  for (const e of match.events ?? []) if (e.relatedPlayer) memo.set(`${e.code}|${e.time.toFixed(2)}`, e.relatedPlayer);
  const events: MatchEvent[] = parsed.events.map((e) => {
    const team = rename[e.team] ?? e.team;
    const rp = memo.get(`${e.code}|${e.time.toFixed(2)}`);
    return { ...e, team, ...(rp ? { relatedPlayer: rp } : {}) };
  });
  const data = createMatchDataFromUpload(
    events,
    match.homeTeam.name,
    match.awayTeam.name,
    match.homeTeam.color,
    match.awayTeam.color,
    tournamentName ?? match.tournamentName,
    match.matchName,
  );
  data.rawSourceText = xml;
  data.rawSourceFileName = match.rawSourceFileName && /\.xml$/i.test(match.rawSourceFileName) ? match.rawSourceFileName : `${match.matchName || 'match'}.xml`;
  return data;
}

export async function saveTagging(db: Firestore, match: MatchData, xml: string, opts: { dry?: boolean; tournamentName?: string } = {}): Promise<TagSaveResult> {
  if (!match.id) throw new Error('경기 id가 없어요');
  const data = buildMatchData(match, xml, opts.tournamentName);
  if (opts.dry) return { data, events: data.events.length, dry: true };
  if (match.rawSourceText && match.rawSourceText !== xml) {
    await setDoc(doc(db, BACKUP_COL, match.id), { matchId: match.id, rawSourceText: match.rawSourceText, rawSourceFileName: match.rawSourceFileName ?? null, savedAt: serverTimestamp() });
  }
  await TournamentService.updateMatchData(db, match.id, data);
  if (match.videoMatchId) await VideoMatchService.syncEvents(db, match.videoMatchId, data.events);
  return { data, events: data.events.length, dry: false };
}

/** 직전 저장 전 XML (없으면 null) */
export async function loadBackup(db: Firestore, matchId: string): Promise<string | null> {
  const snap = await getDoc(doc(db, BACKUP_COL, matchId));
  return snap.exists() ? (snap.data().rawSourceText as string) ?? null : null;
}
