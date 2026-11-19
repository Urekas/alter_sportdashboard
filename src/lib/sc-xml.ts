// Sportscode XML(<file><ALL_INSTANCES>…</ALL_INSTANCES><ROWS>…</ROWS></file>)을 편집 가능한 모델로 읽고,
// 다시 같은 모양의 XML로 씀 — 웹 태깅 화면(/tag/[matchId])이 사용.
//  - 인스턴스 안에서 모르는 태그(free_text, pos_x 등)는 원문 그대로 보관했다가 다시 씀(잃지 않게)
//  - ROWS(코드별 색)도 그대로 보관, 새 코드가 생기면 행을 추가
//  - DOMParser는 브라우저에만 있어서 정규식으로 읽음(테스트를 node에서도 돌릴 수 있게)

export interface ScLabel {
  group?: string;
  text: string;
}

export interface ScInstance {
  /** 화면에서 쓰는 고유 키 (XML의 ID는 다시 쓸 때 순서대로 새로 매김) */
  key: string;
  start: number;
  end: number;
  code: string;
  labels: ScLabel[];
  /** 모르는 하위 태그 원문 */
  extra: string;
}

export interface ScRow {
  code: string;
  /** 0~65535 (Sportscode 형식) */
  r: number;
  g: number;
  b: number;
  extra: string;
}

export interface ScTimeline {
  instances: ScInstance[];
  rows: ScRow[];
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');

const encode = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const tag = (body: string, name: string) => {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(body);
  return m ? decode(m[1]) : undefined;
};

let keySeq = 0;
export const newKey = () => `k${Date.now().toString(36)}${(keySeq++).toString(36)}`;

/** 인스턴스 본문에서 알려진 태그를 빼고 남은 것 */
function leftovers(body: string, known: string[]): string {
  let rest = body;
  for (const k of known) rest = rest.replace(new RegExp(`<${k}>[\\s\\S]*?</${k}>`, 'g'), '');
  return rest.trim();
}

export function parseScXml(xml: string): ScTimeline {
  const text = xml.replace(/^﻿/, '');
  const instances: ScInstance[] = [];
  for (const m of text.matchAll(/<instance>([\s\S]*?)<\/instance>/g)) {
    const body = m[1];
    const labels: ScLabel[] = [];
    for (const l of body.matchAll(/<label>([\s\S]*?)<\/label>/g)) {
      const group = tag(l[1], 'group');
      labels.push({ ...(group !== undefined ? { group } : {}), text: tag(l[1], 'text') ?? '' });
    }
    const start = Number(tag(body, 'start'));
    const end = Number(tag(body, 'end'));
    instances.push({
      key: newKey(),
      start: Number.isFinite(start) ? start : 0,
      end: Number.isFinite(end) ? end : Number.isFinite(start) ? start : 0,
      code: tag(body, 'code') ?? '',
      labels,
      extra: leftovers(body, ['ID', 'start', 'end', 'code', 'label']),
    });
  }
  const rows: ScRow[] = [];
  const rowsBlock = /<ROWS>([\s\S]*?)<\/ROWS>/.exec(text)?.[1] ?? '';
  for (const m of rowsBlock.matchAll(/<row>([\s\S]*?)<\/row>/g)) {
    const body = m[1];
    rows.push({
      code: tag(body, 'code') ?? '',
      r: Number(tag(body, 'R') ?? 0),
      g: Number(tag(body, 'G') ?? 0),
      b: Number(tag(body, 'B') ?? 0),
      extra: leftovers(body, ['code', 'R', 'G', 'B']),
    });
  }
  return { instances, rows };
}

/** 시작 시간순으로 ID를 1부터 다시 매겨서 씀 */
export function serializeScXml(tl: ScTimeline): string {
  const out: string[] = ['<file>', '<ALL_INSTANCES>'];
  const sorted = [...tl.instances].sort((a, b) => a.start - b.start || a.end - b.end);
  sorted.forEach((it, i) => {
    out.push('<instance>', `<ID>${i + 1}</ID>`, `<start>${it.start}</start>`, `<end>${it.end}</end>`, `<code>${encode(it.code)}</code>`);
    for (const l of it.labels) {
      out.push('<label>');
      if (l.group !== undefined) out.push(`<group>${encode(l.group)}</group>`);
      out.push(`<text>${encode(l.text)}</text>`, '</label>');
    }
    if (it.extra) out.push(it.extra);
    out.push('</instance>');
  });
  out.push('</ALL_INSTANCES>');
  // 쓰이는 코드인데 ROWS에 없으면 행 추가 (회색)
  const rows = [...tl.rows];
  for (const code of new Set(tl.instances.map((i) => i.code))) {
    if (!rows.some((r) => r.code === code)) rows.push({ code, r: 40000, g: 40000, b: 40000, extra: '' });
  }
  if (rows.length) {
    out.push('<ROWS>');
    for (const r of rows) {
      out.push('<row>', `<code>${encode(r.code)}</code>`, `<R>${r.r}</R>`, `<G>${r.g}</G>`, `<B>${r.b}</B>`);
      if (r.extra) out.push(r.extra);
      out.push('</row>');
    }
    out.push('</ROWS>');
  }
  out.push('</file>');
  return out.join('\n');
}

/** 행 색 → CSS (Sportscode는 16비트 색) */
export function rowColor(rows: ScRow[], code: string): string {
  const r = rows.find((x) => x.code === code);
  if (!r) return '#9b9797';
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v / 257)));
  return `rgb(${c(r.r)}, ${c(r.g)}, ${c(r.b)})`;
}

/** 배경색 위 글자색 (밝으면 검정, 어두우면 흰색) */
export function textOn(rgb: string): string {
  const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(rgb);
  if (!m) return '#201e1d';
  const l = (0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3]) / 255;
  return l > 0.6 ? '#201e1d' : '#ffffff';
}

/** 쿼터·점수처럼 Sportscode가 자동으로 붙이는 그룹 없는 라벨인지 */
export const isAutoLabel = (l: ScLabel) => l.group === undefined && (/^\d\s*쿼터$/.test(l.text.trim()) || /\d+\s*-\s*\S+\s*\d+\s*$/.test(l.text.trim()));

/**
 * 새 태그에 붙일 자동 라벨(쿼터, 점수): 그 시점 직전에 시작한 태그에서 복사.
 * 대시보드 파서가 쿼터를 "N쿼터" 라벨로 판단하고, 팀 이름을 점수 라벨에서 찾기 때문
 */
export function autoLabelsAt(tl: ScTimeline, t: number): ScLabel[] {
  const before = tl.instances.filter((i) => i.start <= t && i.labels.some(isAutoLabel)).sort((a, b) => b.start - a.start)[0];
  const src = before ?? [...tl.instances].filter((i) => i.labels.some(isAutoLabel)).sort((a, b) => a.start - b.start)[0];
  return src ? src.labels.filter(isAutoLabel).map((l) => ({ ...l })) : [];
}

/** 이 타임라인에서 쓰인 라벨: 그룹별 값 목록 (자동 라벨 제외) */
export function labelGroups(tl: ScTimeline): { group: string; texts: string[] }[] {
  const map = new Map<string, Map<string, number>>();
  for (const i of tl.instances) {
    for (const l of i.labels) {
      if (isAutoLabel(l) || !l.text.trim()) continue;
      const g = l.group ?? '';
      const m = map.get(g) ?? new Map<string, number>();
      m.set(l.text, (m.get(l.text) ?? 0) + 1);
      map.set(g, m);
    }
  }
  return [...map.entries()]
    .map(([group, m]) => ({ group, texts: [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t) }))
    .sort((a, b) => (a.group === '' ? 1 : b.group === '' ? -1 : a.group.localeCompare(b.group)));
}

/** 코드 목록: ROWS 순서 우선, 그다음 인스턴스에서 처음 나온 순서 (공백 코드 제외) */
export function codeList(tl: ScTimeline): string[] {
  const out: string[] = [];
  const add = (c: string) => {
    if (c.trim() && !out.includes(c)) out.push(c);
  };
  tl.rows.forEach((r) => add(r.code));
  tl.instances.forEach((i) => add(i.code));
  return out;
}

/** 시간 표시 mm:ss.s (1시간 넘으면 h:mm:ss) */
export function fmtTime(t: number): string {
  if (!Number.isFinite(t)) return '--:--';
  const neg = t < 0;
  const s = Math.abs(t);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = sec.toFixed(1).padStart(4, '0');
  return (neg ? '-' : '') + (h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`);
}
