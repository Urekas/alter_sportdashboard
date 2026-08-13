
'use client';

import { collection, addDoc, doc, getDoc, updateDoc, Firestore } from 'firebase/firestore';

// Alter_sportsplay(비디오 분석 도구)가 쓰는 'Matches' 컬렉션과 동일한 스키마입니다.
// 필드명(match_name, video_urls 등 snake_case)은 그쪽 코드(public/Alter_sportsplay/app.js)와
// 반드시 맞춰야 두 도구가 같은 문서를 공유해서 쓸 수 있습니다.
const VIDEO_MATCHES_COL = 'Matches';

export interface VideoUrls {
  tactical_cam1: string;
  tactical_cam2: string;
  broadcast_cam: string;
}

export interface VideoOffsets {
  tactical_cam1: number;
  tactical_cam2: number;
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
};
