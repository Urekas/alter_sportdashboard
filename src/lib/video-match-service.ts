
'use client';

import { collection, addDoc, doc, getDoc, updateDoc, deleteDoc, getDocs, query, where, writeBatch, Firestore } from 'firebase/firestore';
import type { MatchEvent } from './types';

// Alter_sportsplay(비디오 분석 도구)가 쓰는 'Matches'/'Events' 컬렉션과 동일한 스키마입니다.
// 필드명(match_name, video_urls, match_id, code, start_time 등 snake_case)은 그쪽 코드
// (public/Alter_sportsplay/app.js, player.js)와 반드시 맞춰야 두 도구가 같은 문서를 공유해서 쓸 수 있습니다.
const VIDEO_MATCHES_COL = 'Matches';
const VIDEO_EVENTS_COL = 'Events';
const EVENTS_BATCH_SIZE = 400; // Alter_sportsplay/app.js의 uploadEventsBatch와 동일한 청크 크기

export interface VideoUrls {
  tactical_cam1: string;
  tactical_cam2: string;
  tactical_cam3: string;
  broadcast_cam: string;
}

export interface VideoOffsets {
  tactical_cam1: number;
  tactical_cam2: number;
  tactical_cam3: number;
  broadcast_cam: number;
}

export interface VideoMatchMetadata {
  match_name: string;
  match_date: string;
  home_team: string;
  away_team: string;
  tournament_id: string;
  video_urls: VideoUrls;
  video_offsets: VideoOffsets;
}

export const VideoMatchService = {
  async get(db: Firestore, videoMatchId: string): Promise<VideoMatchMetadata | null> {
    if (!videoMatchId) return null;
    try {
      const snap = await getDoc(doc(db, VIDEO_MATCHES_COL, videoMatchId));
      if (!snap.exists()) return null;
      return snap.data() as VideoMatchMetadata;
    } catch (e) {
      console.error('VideoMatchService.get failed:', e);
      return null;
    }
  },

  // 기존 videoMatchId가 있으면 업데이트, 없으면 새로 만들고 새 id를 반환합니다.
  async upsert(db: Firestore, existingVideoMatchId: string | undefined, data: VideoMatchMetadata): Promise<string> {
    if (existingVideoMatchId) {
      await updateDoc(doc(db, VIDEO_MATCHES_COL, existingVideoMatchId), { ...data });
      return existingVideoMatchId;
    }
    const ref = await addDoc(collection(db, VIDEO_MATCHES_COL), {
      ...data,
      rosters: { home: [], away: [] },
      created_at: new Date().toISOString(),
    });
    return ref.id;
  },

  // 대시보드에 이미 파싱된 이벤트(matchData.events)를 비디오 도구의 'Events' 컬렉션으로 밀어넣습니다.
  // 비디오 도구 자체엔 더 이상 독립적인 XML/CSV 업로드 경로가 없으므로(제거됨), 영상 연결 시
  // 이게 유일한 이벤트 소스입니다 — Scenes/Events 탭의 클립 라이브러리·이벤트 목록이 여길 씁니다.
  // 재연결(재저장) 시 중복이 쌓이지 않도록 기존 이벤트를 먼저 지우고 다시 씁니다.
  async syncEvents(db: Firestore, videoMatchId: string, events: MatchEvent[]): Promise<void> {
    if (!videoMatchId) return;

    const existingQ = query(collection(db, VIDEO_EVENTS_COL), where('match_id', '==', videoMatchId));
    const existingSnap = await getDocs(existingQ);
    for (let i = 0; i < existingSnap.docs.length; i += EVENTS_BATCH_SIZE) {
      const batch = writeBatch(db);
      existingSnap.docs.slice(i, i + EVENTS_BATCH_SIZE).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    for (let i = 0; i < events.length; i += EVENTS_BATCH_SIZE) {
      const batch = writeBatch(db);
      events.slice(i, i + EVENTS_BATCH_SIZE).forEach(ev => {
        const labels: Record<string, string> = {};
        if (ev.locationLabel) labels['지역'] = ev.locationLabel;
        if (ev.resultLabel) labels['결과'] = ev.resultLabel;
        if (ev.shooter) labels['Player'] = ev.shooter;
        if (ev.defender) labels['GK_Player'] = ev.defender;
        if (ev.relatedPlayer) labels['관련 선수'] = ev.relatedPlayer;
        batch.set(doc(collection(db, VIDEO_EVENTS_COL)), {
          match_id: videoMatchId,
          code: ev.code,
          team: ev.team,
          start_time: ev.time,
          end_time: ev.time + ev.duration,
          duration: ev.duration,
          labels,
          created_at: new Date().toISOString(),
        });
      });
      await batch.commit();
    }
  },

  // 영상 연결을 끊을 때: 비디오 도구 쪽 문서(Matches/Events)만 지우고, 대시보드 매치(실제 통계
  // 데이터)는 절대 건드리지 않습니다. 호출 측에서 별도로 matches/{id}.videoMatchId를 비웁니다.
  async deleteVideoMatch(db: Firestore, videoMatchId: string): Promise<void> {
    if (!videoMatchId) return;
    const existingQ = query(collection(db, VIDEO_EVENTS_COL), where('match_id', '==', videoMatchId));
    const existingSnap = await getDocs(existingQ);
    for (let i = 0; i < existingSnap.docs.length; i += EVENTS_BATCH_SIZE) {
      const batch = writeBatch(db);
      existingSnap.docs.slice(i, i + EVENTS_BATCH_SIZE).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    await deleteDoc(doc(db, VIDEO_MATCHES_COL, videoMatchId));
  },
};
