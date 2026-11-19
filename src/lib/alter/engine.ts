// Alter Live(src/shared/engine.ts)에서 그대로 복사 — 고칠 때는 Alter Live 쪽과 같이
// 코드윈도우 동작 엔진 (UI와 무관한 순수 로직).
// Sportscode 동작 기준:
//  - 코드 버튼, lagTime === null  → 토글: 누르면 (now - lead)부터 시작, 다시 누르면 now에 종료
//  - 코드 버튼, lagTime 숫자      → 한 번 누르면 (now - lead) ~ (now + lag) 인스턴스 즉시 생성
//  - 라벨 버튼                    → 현재 열려 있는 인스턴스 전부에 라벨 추가. 열린 게 없으면 마지막으로 만든 인스턴스에
//  - 링크 A→B activation   : A가 켜지면(라벨이면 눌리면) B도 누름
//  - 링크 A→B exclusive    : A가 켜지면 B를 끔 (보통 양방향 한 쌍으로 걸어서 둘 중 하나만 켜지게 씀)
//  - 링크 A→B deactivation : A가 꺼질 때 B도 끔 (한 번 누름 버튼은 켜지자마자 꺼지는 것으로 봄)

import type { CodeWindow, CWButton, CWLink, Instance, Label, Row, Timeline } from './types';

export interface ActiveInstance {
  buttonId: string;
  rowName: string;
  startTime: number;
  labels: Label[];
}

export interface EngineState {
  timeline: Timeline;
  active: ActiveInstance[];
  lastInstance: { rowName: string; uniqueId: string } | null;
  /** 코드윈도우 스크립트(add label … with id)가 정한 라벨 — 이번에 새로 만드는 태그에 처음부터 붙음 (예: "2쿼터", "한국 1 - 호주 0") */
  autoLabels?: Label[];
  /** 한 번 누름(래그) 태그 중 아직 래그 시간이 안 끝난 것 — 그동안 누른 라벨은 이 태그에도 붙음 (Sportscode와 같음) */
  open?: { buttonId: string; rowName: string; uniqueId: string; end: number }[];
}

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().toUpperCase()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const emptyTimeline = (): Timeline => ({ uniqueId: newId(), startTime: null, rows: [] });

export const initialEngineState = (timeline: Timeline = emptyTimeline()): EngineState => ({
  timeline,
  active: [],
  lastInstance: null,
});

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** "타임라인에 미리 행 만들기"(m_populateTimeline)가 켜진 코드 버튼의 행을 버튼 순서대로 미리 만듦 — 새 경기 시작 때 */
export function populateRows(tl: Timeline, cw: CodeWindow): Timeline {
  let rows = tl.rows;
  for (const b of cw.buttons) if (b.kind === 'code' && b.extra?.m_populateTimeline === true) rows = ensureRow(rows, b.name, b.color);
  return rows === tl.rows ? tl : { ...tl, rows };
}

function ensureRow(rows: Row[], name: string, color: string): Row[] {
  if (rows.some((r) => r.name === name)) return rows;
  return [...rows, { uniqueId: newId(), rowNum: rows.length + 1, name, color, instances: [] }];
}

function addInstance(
  tl: Timeline,
  btn: CWButton,
  start: number,
  end: number,
  labels: Label[],
): { timeline: Timeline; uniqueId: string } {
  const rows = ensureRow(tl.rows, btn.name, btn.color);
  const uniqueId = newId();
  const next = rows.map((r) => {
    if (r.name !== btn.name) return r;
    const inst: Instance = {
      uniqueId,
      instanceNum: r.instances.length + 1,
      startTime: round3(Math.max(0, start)),
      endTime: round3(Math.max(start, end)),
      labels,
      notes: '',
    };
    return { ...r, instances: [...r.instances, inst] };
  });
  return { timeline: { ...tl, rows: next }, uniqueId };
}

function addLabelToInstance(tl: Timeline, rowName: string, uniqueId: string, label: Label): Timeline {
  return {
    ...tl,
    rows: tl.rows.map((r) =>
      r.name !== rowName
        ? r
        : {
            ...r,
            instances: r.instances.map((i) =>
              i.uniqueId !== uniqueId || hasLabel(i.labels, label) ? i : { ...i, labels: [...i.labels, label] },
            ),
          },
    ),
  };
}

const hasLabel = (labels: Label[], l: Label) => labels.some((x) => x.group === l.group && x.name === l.name);

export const isActive = (s: EngineState, buttonId: string) => s.active.some((a) => a.buttonId === buttonId);

/**
 * 라벨을 "지금 켜져 있는 태그"에 붙임: 켜진 토글 + 래그 시간이 남은 한 번 누름 태그. exclude 버튼의 태그는 뺌.
 * 붙인 태그 수를 같이 돌려줌.
 */
function applyLabel(s: EngineState, label: Label, now: number, exclude: Set<string>): { next: EngineState; count: number } {
  let count = 0;
  const active = s.active.map((a) => {
    if (exclude.has(a.buttonId)) return a;
    count++;
    return hasLabel(a.labels, label) ? a : { ...a, labels: [...a.labels, label] };
  });
  const open = (s.open ?? []).filter((o) => o.end > now);
  let timeline = s.timeline;
  for (const o of open) {
    if (exclude.has(o.buttonId)) continue;
    count++;
    timeline = addLabelToInstance(timeline, o.rowName, o.uniqueId, label);
  }
  return { next: { ...s, active, open, timeline }, count };
}

function deactivate(
  s: EngineState,
  cw: CodeWindow,
  buttonId: string,
  now: number,
  visited: Set<string> = new Set(),
): EngineState {
  const a = s.active.find((x) => x.buttonId === buttonId);
  if (!a || visited.has(buttonId)) return s;
  visited.add(buttonId);
  const btn = cw.buttons.find((b) => b.id === buttonId);
  const active = s.active.filter((x) => x.buttonId !== buttonId);
  if (!btn) return { ...s, active };
  const { timeline, uniqueId } = addInstance(s.timeline, btn, a.startTime, now, a.labels);
  return followDeactivationLinks({ ...s, timeline, active, lastInstance: { rowName: btn.name, uniqueId } }, cw, buttonId, now, visited);
}

function followDeactivationLinks(
  s: EngineState,
  cw: CodeWindow,
  fromId: string,
  now: number,
  visited: Set<string>,
): EngineState {
  let next = s;
  for (const l of cw.links) {
    if (l.from === fromId && l.type === 'deactivation') next = deactivate(next, cw, l.to, now, visited);
  }
  return next;
}

/** 버튼 한 번 누름. visited는 링크 순환 방지용. */
export function press(
  s: EngineState,
  cw: CodeWindow,
  buttonId: string,
  now: number,
  visited: Set<string> = new Set(),
  fromCode?: string, // 코드 버튼 링크로 눌린 라벨이면 그 코드 버튼 id — 그 버튼 자기 태그에는 안 붙음
): EngineState {
  if (visited.has(buttonId)) return s;
  visited.add(buttonId);
  const btn = cw.buttons.find((b) => b.id === buttonId);
  if (!btn) return s;

  if (btn.kind === 'label') {
    const label: Label = { group: btn.group, name: btn.name };
    // 실제 Sportscode 경기 2개(WHK 코드윈도우) 확인: 코드 버튼 링크로 눌린 라벨은 그 순간 이미 켜져 있던 태그에 붙고(84~91%),
    // 링크를 건 버튼 자기 태그에는 안 붙음(2~4%). 예: HOME 슈팅 → SHOT 이면 SHOT은 HOME TEAM·HOME ATT 등에 붙음
    const { next, count } = applyLabel(s, label, now, fromCode ? new Set([fromCode]) : new Set());
    let out = next;
    // 직접 누른 라벨인데 켜진 태그가 없으면 방금 만든 태그에 (경기 후 라벨 붙이기 등)
    if (!fromCode && count === 0 && s.lastInstance) out = { ...next, timeline: addLabelToInstance(next.timeline, s.lastInstance.rowName, s.lastInstance.uniqueId, label) };
    return followLinks(out, cw, btn.id, now, visited, true);
  }

  if (btn.kind !== 'code') return s;

  // 이미 켜진 토글 버튼 → 끔 (끌 때는 링크를 따라가지 않음 — Sportscode도 활성화 시점에만 링크 동작)
  if (isActive(s, btn.id)) return deactivate(s, cw, btn.id, now);

  let next = s;
  if (btn.lagTime !== null) {
    const { timeline, uniqueId } = addInstance(s.timeline, btn, now - btn.leadTime, now + btn.lagTime, [...(s.autoLabels ?? [])]);
    const open = [...(s.open ?? []).filter((o) => o.end > now), { buttonId: btn.id, rowName: btn.name, uniqueId, end: now + btn.lagTime }];
    next = { ...s, timeline, open, lastInstance: { rowName: btn.name, uniqueId } };
    next = followLinks(next, cw, btn.id, now, visited, true);
    return followDeactivationLinks(next, cw, btn.id, now, new Set([btn.id]));
  } else {
    next = {
      ...s,
      timeline: { ...s.timeline, rows: ensureRow(s.timeline.rows, btn.name, btn.color) },
      active: [...s.active, { buttonId: btn.id, rowName: btn.name, startTime: round3(Math.max(0, now - btn.leadTime)), labels: [...(s.autoLabels ?? [])] }],
    };
  }
  return followLinks(next, cw, btn.id, now, visited, true);
}

function followLinks(
  s: EngineState,
  cw: CodeWindow,
  fromId: string,
  now: number,
  visited: Set<string>,
  activated: boolean,
): EngineState {
  if (!activated) return s;
  let next = s;
  const src = cw.buttons.find((b) => b.id === fromId);
  const fromCode = src?.kind === 'code' ? fromId : undefined;
  const targets = (type: CWLink['type'], kind?: 'label') =>
    cw.links
      .filter((l) => l.from === fromId && l.type === type && l.to !== fromId)
      .map((l) => cw.buttons.find((b) => b.id === l.to))
      .filter((b): b is CWButton => !!b && (kind ? b.kind === kind : b.kind !== 'label'));
  // ① 라벨 먼저: exclusive로 닫힐 태그도 라벨을 받아야 함 (예: HOME 득점 → GOAL + HOME TEAM exclusive → GOAL이 HOME TEAM에 붙음, 실제 경기 100%)
  for (const t of targets('activation', 'label')) next = press(next, cw, t.id, now, visited, fromCode);
  // ② exclusive: 켜는 링크보다 먼저 처리해야 새로 켠 버튼이 바로 다시 꺼지지 않음
  for (const t of targets('exclusive')) next = deactivate(next, cw, t.id, now, new Set([fromId]));
  // ③ 코드 버튼 켜기 (이미 켜진 토글은 다시 누르면 꺼지므로 건너뜀)
  for (const t of targets('activation')) {
    if (t.kind === 'code' && isActive(next, t.id)) continue;
    next = press(next, cw, t.id, now, visited);
  }
  return next;
}

/**
 * 위치 태깅: 좌표 라벨(groups 그룹)을 바꿔 끼움 — 켜진 태그 + 래그 남은 한 번 누름 태그, 없으면 방금 만든 태그.
 * onlyButton이면 그 코드 버튼의 태그에만.
 */
export function placeLabels(s: EngineState, cw: CodeWindow, groups: string[], labels: Label[], now: number, onlyButton?: string): { next: EngineState; count: number } {
  const swap = (ls: Label[]) => [...ls.filter((l) => !groups.includes(l.group)), ...labels];
  const ok = (id: string) => !onlyButton || id === onlyButton;
  let count = 0;
  const active = s.active.map((a) => (ok(a.buttonId) ? (count++, { ...a, labels: swap(a.labels) }) : a));
  const open = (s.open ?? []).filter((o) => o.end > now && ok(o.buttonId));
  const hit = new Set(open.map((o) => o.uniqueId));
  if (!count && !open.length && s.lastInstance) {
    const linked = onlyButton ? cw.buttons.find((b) => b.id === onlyButton)?.name : undefined;
    if (!onlyButton || linked === s.lastInstance.rowName) hit.add(s.lastInstance.uniqueId);
  }
  count += hit.size;
  const timeline = !hit.size
    ? s.timeline
    : { ...s.timeline, rows: s.timeline.rows.map((r) => (r.instances.some((i) => hit.has(i.uniqueId)) ? { ...r, instances: r.instances.map((i) => (hit.has(i.uniqueId) ? { ...i, labels: swap(i.labels) } : i)) } : r)) };
  return { next: { ...s, active, timeline }, count };
}

/** 녹화 종료 등으로 열린 인스턴스를 전부 닫음 */
export function closeAll(s: EngineState, cw: CodeWindow, now: number): EngineState {
  let next = s;
  for (const a of s.active) next = deactivate(next, cw, a.buttonId, now);
  return next;
}

export function deleteInstance(tl: Timeline, rowName: string, uniqueId: string): Timeline {
  return {
    ...tl,
    rows: tl.rows.map((r) =>
      r.name !== rowName ? r : { ...r, instances: r.instances.filter((i) => i.uniqueId !== uniqueId) },
    ),
  };
}

export function updateInstance(
  tl: Timeline,
  rowName: string,
  uniqueId: string,
  patch: Partial<Pick<Instance, 'startTime' | 'endTime' | 'labels' | 'notes'>>,
): Timeline {
  return {
    ...tl,
    rows: tl.rows.map((r) =>
      r.name !== rowName
        ? r
        : { ...r, instances: r.instances.map((i) => (i.uniqueId === uniqueId ? { ...i, ...patch } : i)) },
    ),
  };
}

/** Tab (Sportscode "모두 끄기"): 켜진 토글을 전부 닫음. 원본에서 "모두 끄기 제외"(m_blockDeactivateAll)인 버튼은 그대로 둠 */
export function deactivateAll(s: EngineState, cw: CodeWindow, now: number): EngineState {
  let next = s;
  for (const a of s.active) {
    const btn = cw.buttons.find((b) => b.id === a.buttonId);
    if (btn?.extra?.m_blockDeactivateAll === true) continue;
    next = deactivate(next, cw, a.buttonId, now);
  }
  return next;
}

const labelKey = (l: Label) => `${l.group}\u0000${l.name}`;
const minus = (a: Label[], b: Label[]) => a.filter((x) => !b.some((y) => labelKey(y) === labelKey(x)));

/**
 * 직전 버튼 누름 취소: before → after 로 바뀐 것만 현재 상태에서 되돌림 (그 사이 다른 기기의 태그 등은 그대로).
 *  - 그 누름으로 생긴 태그 삭제 (토글을 꺼서 생긴 태그 포함)
 *  - 그 누름으로 붙은 라벨 떼기 (링크 라벨, 직접 누른 라벨)
 *  - 그 누름으로 켜진 버튼 끄기 (태그 안 남김) / 그 누름으로 꺼진 버튼 다시 켜기
 */
export function revertPress(cur: EngineState, before: EngineState, after: EngineState): EngineState {
  const ids = (tl: Timeline) => new Map(tl.rows.flatMap((r) => r.instances.map((i) => [i.uniqueId, i] as const)));
  const b = ids(before.timeline);
  const a = ids(after.timeline);
  const created = new Set([...a.keys()].filter((k) => !b.has(k)));
  const timeline: Timeline = {
    ...cur.timeline,
    rows: cur.timeline.rows.map((r) => ({
      ...r,
      instances: r.instances
        .filter((i) => !created.has(i.uniqueId))
        .map((i) => {
          const was = b.get(i.uniqueId);
          const now = a.get(i.uniqueId);
          if (!was || !now) return i;
          const added = minus(now.labels, was.labels);
          return added.length ? { ...i, labels: minus(i.labels, added) } : i;
        }),
    })),
  };
  const key = (x: ActiveInstance) => `${x.buttonId}@${x.startTime}`;
  const beforeActive = new Map(before.active.map((x) => [key(x), x]));
  const afterActive = new Map(after.active.map((x) => [key(x), x]));
  let active = cur.active
    .filter((x) => !(afterActive.has(key(x)) && !beforeActive.has(key(x)))) // 이 누름으로 켜진 것 끄기
    .map((x) => {
      const was = beforeActive.get(key(x));
      const then = afterActive.get(key(x));
      if (!was || !then) return x;
      const added = minus(then.labels, was.labels);
      return added.length ? { ...x, labels: minus(x.labels, added) } : x;
    });
  // 이 누름으로 꺼진 것 다시 켜기
  for (const [k, x] of beforeActive) if (!afterActive.has(k) && !active.some((y) => key(y) === k)) active = [...active, x];
  return { ...cur, timeline, active, open: (cur.open ?? []).filter((o) => !created.has(o.uniqueId)), lastInstance: before.lastInstance };
}
