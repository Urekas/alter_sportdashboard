
'use client';

import { collection, addDoc, doc, getDoc, updateDoc, deleteDoc, getDocs, query, where, writeBatch, Firestore } from 'firebase/firestore';
import type { MatchEvent } from './types';
import { buildVideoEvents } from './video-events';

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

// 동기화가 쓰는 필드만 비교 (created_at 제외, 키 순서 무관)
const SYNC_FIELDS = ['match_id', 'code', 'team', 'start_time', 'end_time', 'duration', 'quarter', 'labels', 'label_list'] as const;
const canon = (v: unknown): string =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? '{' + Object.keys(v as object).sort().map((k) => JSON.stringify(k) + ':' + canon((v as Record<string, unknown>)[k])).join(',') + '}'
    : Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : JSON.stringify(v ?? null);
function sameEventDoc(old: Record<string, unknown> | undefined, next: object): boolean {
  if (!old) return false;
  const n = next as Record<string, unknown>;
  return SYNC_FIELDS.every((k) => canon(old[k]) === canon(n[k]));
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
  //
  // 재생목록(Playlists.event_ids)이 Events 문서 ID를 가리키기 때문에:
  //  - 문서 ID를 경기+코드+팀+시간으로 고정 → 다시 저장해도 같은 이벤트는 같은 ID (재생목록 유지)
  //  - 시간이 바뀌는 등으로 ID가 달라진 이벤트는, 옛 문서를 지우기 전에 재생목록의 ID를 새 것으로 바꿈
  //    (예전엔 전부 지우고 새 랜덤 ID로 다시 만들어서, 저장할 때마다 그 경기 재생목록이 빈 목록이 됐음)
  // rawXml(원본 XML)을 주면 그 태그의 라벨 전부를 label_list로 같이 넣음 — 비디오 도구의 라벨 필터·매트릭스용
  async syncEvents(db: Firestore, videoMatchId: string, events: MatchEvent[], rawXml?: string): Promise<{ written: number; deleted: number; remappedPlaylists: number }> {
    if (!videoMatchId) return { written: 0, deleted: 0, remappedPlaylists: 0 };

    const existingQ = query(collection(db, VIDEO_EVENTS_COL), where('match_id', '==', videoMatchId));
    const existingSnap = await getDocs(existingQ);
    const existing = existingSnap.docs.map((d) => ({ id: d.id, ref: d.ref, raw: d.data() as Record<string, unknown>, ...(d.data() as { code?: string; team?: string; start_time?: number }) }));
    const existingById = new Map(existing.map((o) => [o.id, o.raw]));

    const newDocs = buildVideoEvents(videoMatchId, events, rawXml);
    const newIds = new Set(newDocs.map((d) => d.id));

    // 없어지는 옛 문서 → 가장 비슷한 새 이벤트(같은 코드·팀, 시간 같음 > 3초 이내 가장 가까움)
    const remap = new Map<string, string>();
    for (const o of existing) {
      if (newIds.has(o.id)) continue;
      const same = newDocs.filter((n) => n.data.code === o.code && n.data.team === o.team);
      let best: { id: string; dt: number } | null = null;
      for (const n of same) {
        const dt = Math.abs(n.data.start_time - (o.start_time ?? -1e9));
        if (dt <= 3 && (!best || dt < best.dt)) best = { id: n.id, dt };
      }
      if (best) remap.set(o.id, best.id);
    }

    // 1) 새 이벤트 쓰기 — 이미 같은 내용이면 건너뜀 (Firestore 무료 한도가 하루 쓰기 2만 개라,
    //    태그 몇 개 고치고 저장할 때마다 경기 전체 1000여 개를 다시 쓰면 금방 막힘)
    const toWrite = newDocs.filter((n) => !sameEventDoc(existingById.get(n.id), n.data));
    for (let i = 0; i < toWrite.length; i += EVENTS_BATCH_SIZE) {
      const batch = writeBatch(db);
      // merge: 이 동기화가 모르는 필드(다른 도구가 붙인 것)는 지우지 않음
      toWrite.slice(i, i + EVENTS_BATCH_SIZE).forEach((n) => batch.set(doc(db, VIDEO_EVENTS_COL, n.id), n.data, { merge: true }));
      await batch.commit();
    }

    // 2) 지워질 옛 ID를 가리키는 재생목록 고치기
    const stale = new Set(existing.filter((o) => !newIds.has(o.id)).map((o) => o.id));
    let remappedPlaylists = 0;
    if (stale.size) {
      const pls = await getDocs(collection(db, 'Playlists'));
      for (const p of pls.docs) {
        const ids: string[] = Array.isArray(p.data().event_ids) ? p.data().event_ids : [];
        if (!ids.some((id) => stale.has(id))) continue;
        const next: string[] = [];
        for (const id of ids) {
          const to = stale.has(id) ? remap.get(id) : id;
          if (to && !next.includes(to)) next.push(to);
        }
        await updateDoc(p.ref, { event_ids: next, updated_at: new Date().toISOString() });
        remappedPlaylists++;
      }
    }

    // 3) 이제 안 쓰는 옛 문서 지우기
    const toDelete = existing.filter((o) => stale.has(o.id));
    for (let i = 0; i < toDelete.length; i += EVENTS_BATCH_SIZE) {
      const batch = writeBatch(db);
      toDelete.slice(i, i + EVENTS_BATCH_SIZE).forEach((o) => batch.delete(o.ref));
      await batch.commit();
    }
    return { written: toWrite.length, deleted: toDelete.length, remappedPlaylists };
  },

  // 여러 경기에 걸쳐 필터링된 슈팅 로그로 "재생목록 만들기"를 누르면 경기별로 재생목록이
  // 여러 개 생기는데(플레이어가 한 경기 영상만 이어 재생하는 구조라 하나로 합칠 수 없음 —
  // createPlaylistFromEvents 주석 참고), 그 여러 개를 순서대로 넘나들 수 있게 서로 연결한다.
  // 각 Playlists 문서에 전체 목록(sibling_playlist_ids)을 그대로 저장 — Alter_sportsplay가
  // 재생목록을 열 때 이 필드를 보고 "다음/이전 경기" 버튼을 그려서, 클릭 한 번으로 다음
  // 경기의 영상+클립으로 바로 전환할 수 있게 한다(경기별 분리 구조 자체는 유지).
  async linkPlaylistSiblings(db: Firestore, playlistIds: string[]): Promise<void> {
    if (playlistIds.length < 2) return
    const batch = writeBatch(db)
    playlistIds.forEach(id => batch.update(doc(db, 'Playlists', id), { sibling_playlist_ids: playlistIds }))
    await batch.commit()
  },

  // 대시보드 리포트(이벤트 타임라인)에서 필터링한 이벤트들만 골라 비디오 도구의 재생목록
  // (Playlists 컬렉션 — Alter_sportsplay의 Library 탭에서 클립 체크해 만드는 것과 동일한
  // 스키마)으로 바로 만듭니다. Playlists.event_ids는 'Events' 컬렉션 문서 ID를 가리키는데,
  // 대시보드의 matchData.events는 배열 안 값이라 자체 문서 ID가 없어서 — syncEvents가 이미
  // match_id+code+start_time을 그대로 복사해서 저장해뒀다는 점을 이용해 그 조합으로 맞는
  // Events 문서를 찾아 ID만 모읍니다.
  // events는 매칭에 code+team+time 세 필드만 쓰므로 MatchEvent 전체가 아니라 이 세 필드만
  // 있으면 됨(Pick) — 슈팅 분석처럼 ShotDatum에서 이 세 값만 뽑아 넘기는 호출부도 지원하기 위함.
  async createPlaylistFromEvents(db: Firestore, videoMatchId: string, events: Pick<MatchEvent, 'code' | 'team' | 'time'>[], title: string): Promise<{ playlistId: string; matchedCount: number }> {
    const q = query(collection(db, VIDEO_EVENTS_COL), where('match_id', '==', videoMatchId));
    const snap = await getDocs(q);
    const eventDocs = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

    const eventIds: string[] = [];
    events.forEach(ev => {
      const found = eventDocs.find(ed => ed.code === ev.code && ed.team === ev.team && Math.abs((ed.start_time ?? -Infinity) - ev.time) < 0.05);
      if (found) eventIds.push(found.id);
    });

    const ref = await addDoc(collection(db, 'Playlists'), {
      title,
      event_ids: eventIds,
      created_at: new Date().toISOString(),
    });
    return { playlistId: ref.id, matchedCount: eventIds.length };
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
