'use client';
// 통합 영상 분석용 요약 문서 저장·읽기 (만드는 법은 video-index.ts)
import { collection, deleteDoc, doc, getDoc, getDocs, writeBatch, type Firestore } from 'firebase/firestore';
import type { MatchData } from './types';
import { buildVideoIndex, decodeClips, VIDEO_CLIPS_COL, VIDEO_INDEX_COL, type Clip, type VideoClipsDoc, type VideoIndexDoc } from './video-index';

const clipCache = new Map<string, Promise<Clip[]>>();

export const VideoIndexService = {
  /** 영상이 연결된 경기의 요약 2개를 저장 (쓰기 2번). 영상 연결이 없으면 지움 */
  async save(db: Firestore, matchId: string, match: Pick<MatchData, 'matchName' | 'homeTeam' | 'awayTeam' | 'events' | 'rawSourceText' | 'tournamentId' | 'tournamentName'> & { videoMatchId?: string }) {
    if (!matchId) return;
    if (!match.videoMatchId) return this.remove(db, matchId);
    let date = '';
    let tournamentName = match.tournamentName || '';
    let tournamentCategory = '';
    try {
      const vm = await getDoc(doc(db, 'Matches', match.videoMatchId));
      date = String(vm.data()?.match_date || '');
    } catch {}
    try {
      if (match.tournamentId) {
        const t = await getDoc(doc(db, 'tournaments', match.tournamentId));
        tournamentName = String(t.data()?.name || tournamentName);
        tournamentCategory = String(t.data()?.category || '');
        if (!date) date = String(t.data()?.startDate || '').slice(0, 10);
      }
    } catch {}
    const { index, clips } = buildVideoIndex({ ...match, id: matchId, videoMatchId: match.videoMatchId }, { date, tournamentName, tournamentCategory });
    const b = writeBatch(db);
    b.set(doc(db, VIDEO_INDEX_COL, matchId), index);
    b.set(doc(db, VIDEO_CLIPS_COL, matchId), clips);
    await b.commit();
    clipCache.delete(matchId);
  },

  async remove(db: Firestore, matchId: string) {
    if (!matchId) return;
    await Promise.all([deleteDoc(doc(db, VIDEO_INDEX_COL, matchId)), deleteDoc(doc(db, VIDEO_CLIPS_COL, matchId))]);
    clipCache.delete(matchId);
  },

  /** 고르기 화면용: 전체 경기 요약 (작은 문서들) */
  async list(db: Firestore): Promise<VideoIndexDoc[]> {
    const snap = await getDocs(collection(db, VIDEO_INDEX_COL));
    return snap.docs.map((d) => d.data() as VideoIndexDoc);
  },

  /** 고른 경기들의 클립 (경기당 읽기 1번, 한 번 읽은 건 다시 안 읽음) */
  async clips(db: Firestore, matchIds: string[]): Promise<Clip[]> {
    const all = await Promise.all(
      matchIds.map((id) => {
        let p = clipCache.get(id);
        if (!p) {
          p = getDoc(doc(db, VIDEO_CLIPS_COL, id)).then((s) => (s.exists() ? decodeClips(s.data() as VideoClipsDoc) : []));
          p.catch(() => clipCache.delete(id));
          clipCache.set(id, p);
        }
        return p;
      }),
    );
    return all.flat();
  },
};
