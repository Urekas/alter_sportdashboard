// 대시보드 이벤트 → 비디오 도구(Alter_sportsplay) 'Events' 문서 만들기 (Firestore 안 씀 — node 테스트 가능)
//  - 문서 ID: 경기 + 코드 + 팀 + 시작시간으로 고정 (다시 저장해도 같은 ID → 재생목록 안 깨짐)
//  - label_list: 원본 XML에 있는 그 태그의 라벨 전부 (같은 그룹에 여러 개도 그대로)
import type { MatchEvent } from './types';
import { isAutoLabel, parseScXml, type ScLabel } from './sc-xml';

export interface VideoEventLabel {
  group: string;
  text: string;
}

export interface VideoEventDoc {
  match_id: string;
  code: string;
  team: string;
  start_time: number;
  end_time: number;
  duration: number;
  quarter?: string;
  labels: Record<string, string>;
  label_list: VideoEventLabel[];
  created_at: string;
}

// 좌표 라벨은 숫자라 필터에 쓸모없어서 뺌
const SKIP_GROUPS = /^(X_Loc|Y_Loc|X_Goal|Y_Goal)$/i;

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function videoEventId(videoMatchId: string, code: string, team: string, start: number): string {
  return `${videoMatchId}_${fnv1a(`${code}\u0000${team}\u0000${start.toFixed(2)}`)}`;
}

/** 원본 XML에서 시작시간별 태그 목록 (코드·라벨 찾기용) */
function xmlIndex(rawXml?: string): Map<string, { code: string; labels: ScLabel[] }[]> {
  const idx = new Map<string, { code: string; labels: ScLabel[] }[]>();
  if (!rawXml || !/<instance>/.test(rawXml)) return idx;
  for (const i of parseScXml(rawXml).instances) {
    const k = i.start.toFixed(3);
    idx.set(k, [...(idx.get(k) ?? []), { code: i.code.trim(), labels: i.labels }]);
  }
  return idx;
}

export function buildVideoEvents(videoMatchId: string, events: MatchEvent[], rawXml?: string): { id: string; data: VideoEventDoc }[] {
  const idx = xmlIndex(rawXml);
  const used = new Set<string>();
  const now = new Date().toISOString();
  return events.map((ev) => {
    const labels: Record<string, string> = {};
    if (ev.locationLabel) labels['지역'] = ev.locationLabel;
    if (ev.resultLabel) labels['결과'] = ev.resultLabel;
    if (ev.shooter) labels['Player'] = ev.shooter;
    if (ev.defender) labels['GK_Player'] = ev.defender;
    if (ev.relatedPlayer) labels['관련 선수'] = ev.relatedPlayer;

    // 같은 시작시간의 XML 태그 중 코드가 같은 것 (팀 이름을 바꿔 저장한 경우 코드가 다를 수 있어서, 하나뿐이면 그걸 씀)
    const cands = idx.get(ev.time.toFixed(3)) ?? [];
    const hit = cands.find((c) => c.code === ev.code) ?? (cands.length === 1 ? cands[0] : undefined);
    if (hit) cands.splice(cands.indexOf(hit), 1);
    const label_list: VideoEventLabel[] = [];
    for (const l of hit?.labels ?? []) {
      const text = l.text.trim();
      const group = (l.group ?? '').trim();
      if (!text || isAutoLabel(l) || SKIP_GROUPS.test(group)) continue;
      if (!label_list.some((x) => x.group === group && x.text === text)) label_list.push({ group, text });
    }
    // 화면 표시용 labels(그룹 → 값)에도 원본 라벨을 합침 (같은 그룹 여러 개는 " / "로)
    const byGroup = new Map<string, string[]>();
    for (const l of label_list) byGroup.set(l.group || '라벨', [...(byGroup.get(l.group || '라벨') ?? []), l.text]);
    for (const [g, ts] of byGroup) labels[g] = ts.join(' / ');

    let id = videoEventId(videoMatchId, ev.code, ev.team, ev.time);
    for (let n = 2; used.has(id); n++) id = `${videoEventId(videoMatchId, ev.code, ev.team, ev.time)}_${n}`;
    used.add(id);
    return {
      id,
      data: {
        match_id: videoMatchId,
        code: ev.code,
        team: ev.team,
        start_time: ev.time,
        end_time: ev.time + ev.duration,
        duration: ev.duration,
        ...(ev.quarter ? { quarter: ev.quarter } : {}),
        labels,
        label_list,
        created_at: now,
      },
    };
  });
}
