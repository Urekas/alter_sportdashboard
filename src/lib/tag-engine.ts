// 웹 태깅 ↔ Alter Live 태깅 엔진(src/lib/alter/engine.ts) 연결
//  - 화면은 Sportscode XML 모델(ScTimeline: 태그가 한 줄로 쭉), 엔진은 행(코드)별 타임라인 → 누를 때마다 바꿔서 넘김
//  - 코드윈도우를 안 골랐으면 XML에 있는 코드·라벨로 간단한 코드윈도우를 만들어 같은 엔진으로 돌림
import type { CodeWindow, CWButton, Hotkey, Label, Timeline } from './alter/types'
import type { EngineState } from './alter/engine'
import { codeList, labelGroups, rowColor, type ScInstance, type ScLabel, type ScTimeline } from './sc-xml'

export type EngineExtras = Pick<EngineState, 'active' | 'lastInstance' | 'open'>
export const emptyExtras = (): EngineExtras => ({ active: [], lastInstance: null, open: [] })

const toLabel = (l: ScLabel): Label => ({ group: l.group ?? '', name: l.text })
const fromLabel = (l: Label): ScLabel => (l.group ? { group: l.group, text: l.name } : { text: l.name })

const hex = (rgb: string) => {
  const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(rgb)
  return m ? '#' + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('') : '#9b9797'
}

export function toEngine(tl: ScTimeline): Timeline {
  const byCode = new Map<string, ScInstance[]>()
  for (const i of tl.instances) byCode.set(i.code, [...(byCode.get(i.code) ?? []), i])
  const codes = [...new Set([...codeList(tl), ...byCode.keys()])]
  return {
    uniqueId: 'web',
    startTime: null,
    rows: codes.map((code, n) => ({
      uniqueId: `row${n}`,
      rowNum: n + 1,
      name: code,
      color: hex(rowColor(tl.rows, code)),
      instances: (byCode.get(code) ?? []).map((i, k) => ({ uniqueId: i.key, instanceNum: k + 1, startTime: i.start, endTime: i.end, labels: i.labels.map(toLabel), notes: '' })),
    })),
  }
}

/** 엔진 결과를 XML 모델로 — 원래 태그의 모르는 하위 태그(extra)는 key로 찾아 유지, 새 코드는 버튼 색으로 행 추가 */
export function fromEngine(t: Timeline, prev: ScTimeline): ScTimeline {
  const old = new Map(prev.instances.map((i) => [i.key, i]))
  const instances: ScInstance[] = t.rows.flatMap((r) =>
    r.instances.map((i) => ({ key: i.uniqueId, start: i.startTime, end: i.endTime, code: r.name, labels: i.labels.map(fromLabel), extra: old.get(i.uniqueId)?.extra ?? '' })),
  )
  const rows = [...prev.rows]
  for (const r of t.rows) {
    if (rows.some((x) => x.code === r.name) || !r.instances.length) continue
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(r.color)
    const c = (h?: string) => (h ? parseInt(h, 16) * 257 : 40000)
    rows.push({ code: r.name, r: c(m?.[1]), g: c(m?.[2]), b: c(m?.[3]), extra: '' })
  }
  return { instances, rows }
}

/** 코드윈도우가 없을 때: XML 코드·라벨로 만든 간단한 코드윈도우 (한 번 = 시작, 다시 = 끝, 링크 없음) */
export function syntheticCW(tl: ScTimeline): CodeWindow {
  const buttons: CWButton[] = []
  const base = { frame: { x: 0, y: 0, w: 0, h: 0 }, textColor: '#000000', fontSize: 12, hotkey: null, leadTime: 0 }
  for (const code of codeList(tl)) buttons.push({ ...base, id: `c:${code}`, kind: 'code', name: code, group: '', color: hex(rowColor(tl.rows, code)), lagTime: null })
  for (const g of labelGroups(tl)) for (const t of g.texts) buttons.push({ ...base, id: `l:${g.group}\u0000${t}`, kind: 'label', name: t, group: g.group, color: '#ffffff', lagTime: null })
  return { name: '', width: 0, height: 0, background: '#ffffff', buttons, links: [] }
}

const KEEP_EXTRA = ['m_blockDeactivateAll', 'm_buttonOpacity', 'm_borderWidth', 'm_wrapText']

/** Firestore 문서(1MB 한도)에 맞게 줄임: 배경 이미지 원본·스크립트·차트 설정 등 태깅에 안 쓰는 것 뺌 */
export function slimCW(cw: CodeWindow): CodeWindow {
  const buttons = cw.buttons.map(({ bgImage, chartModel, script, extra, ...b }) => {
    // 태깅·모양에 쓰는 설정만 남김 (모두 끄기 제외, 버튼 투명도, 테두리, 줄바꿈)
    const ex = Object.fromEntries(Object.entries(extra ?? {}).filter(([k]) => KEEP_EXTRA.includes(k)))
    const keep = Object.keys(ex).length ? { extra: ex } : {}
    return { ...b, ...keep, ...(bgImage?.png ? { bgPng: bgImage.png } : {}) } as CWButton & { bgPng?: string }
  })
  let out: CodeWindow = { name: cw.name, width: cw.width, height: cw.height, background: cw.background, buttons, links: cw.links }
  // 배경 그림까지 넣으면 너무 크면 그림은 뺌
  if (JSON.stringify(out).length > 800_000) out = { ...out, buttons: buttons.map(({ bgPng, ...b }) => b) }
  return out
}

/** 키 입력이 버튼 단축키와 맞는지 (물리 키 기준 — 한/영 상태와 무관) */
export function hotkeyMatches(h: Hotkey | null, e: { code: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): boolean {
  if (!h) return false
  return h.code === e.code && !!h.shift === e.shiftKey && !!h.mod === (e.ctrlKey || e.metaKey) && !!h.alt === e.altKey
}

export function hotkeyText(h: Hotkey | null): string {
  if (!h) return ''
  return (h.mod ? 'Ctrl+' : '') + (h.alt ? 'Alt+' : '') + (h.shift ? 'Shift+' : '') + h.key.toUpperCase()
}

/** Alter Live 코드윈도우 JSON(codewindow.json, last-codewindow.json)인지 */
export function isCodeWindowJson(v: unknown): v is CodeWindow {
  const o = v as CodeWindow
  return !!o && Array.isArray(o.buttons) && Array.isArray(o.links) && typeof o.width === 'number'
}

/**
 * 대시보드는 "한국 슈팅"처럼 실제 팀 이름이 붙은 코드로 통계를 냄. 코드윈도우가 HOME/AWAY로 돼 있고
 * 이 경기 XML은 팀 이름 코드("한국 TEAM")를 쓰면, 버튼 이름의 HOME/AWAY를 팀 이름으로 바꿔서 같은 행에 들어가게 함
 */
export function teamNamedCW(cw: CodeWindow, tl: ScTimeline, home: string, away: string): CodeWindow {
  const codes = new Set(tl.instances.map((i) => i.code.trim()))
  const usesTeam = (t: string) => !!t && [...codes].some((c) => c.startsWith(t + ' ') || c.startsWith(t + '_'))
  const usesHomeAway = [...codes].some((c) => /^(HOME|AWAY)[\s_]/.test(c))
  if (usesHomeAway || !usesTeam(home) || !usesTeam(away)) return cw
  const map = (n: string) => n.replace(/^HOME(?=[\s_])/, home).replace(/^AWAY(?=[\s_])/, away)
  return { ...cw, buttons: cw.buttons.map((b) => (b.kind === 'code' ? { ...b, name: map(b.name) } : b)) }
}
