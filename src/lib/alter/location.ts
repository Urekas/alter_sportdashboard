// Alter Live(src/shared/location.ts)에서 그대로 복사 — 고칠 때는 Alter Live 쪽과 같이
// 위치 태깅 패널: 코드윈도우 안에 놓는 경기장·골대 그림. 누른 자리를 좌표 라벨(X_Loc/Y_Loc 등)로 태그에 붙임
//  - 종목별 미리 정한 판(프리셋) + 내 그림 파일(사용자 지정)
//  - 필드하키 "공격 23m(슈팅 존)"과 "골대"는 슈팅 태깅 도구·Field Focus와 같은 좌표 (550×230 dm, 366×214 cm, Y는 아래→위)
//    골대 판은 골대 틀 바깥(좌·우·위)을 누르면 OUT Dir(LEFT/RIGHT/UP) — 슈팅 태깅 도구와 같음
import type { Label } from './types';

export type LocPresetId =
  | 'hockeyFull'
  | 'hockey23'
  | 'hockeyGoal'
  | 'soccerFull'
  | 'soccerGoal'
  | 'handballFull'
  | 'handballGoal'
  | 'basketballFull'
  | 'basketballHalf'
  | 'custom';

export type LocRotate = 0 | 90 | 180 | 270; // 시계 방향

export interface LocConfig {
  preset: LocPresetId;
  xMax: number; // 가로 좌표 범위 (0 ~ xMax)
  yMax: number; // 세로 좌표 범위 (0 ~ yMax)
  xGroup: string; // 가로 좌표 라벨 그룹 (예: X_Loc)
  yGroup: string;
  decimals: number; // 소수 자리 (0 = 정수)
  yUp: boolean; // true = 아래가 0 (위로 갈수록 커짐), false = 위가 0
  view?: 'last' | 'dots' | 'heat'; // 보기: 마지막 찍은 자리 / 찍힌 태그 전부 점 / 칸 히트맵 (리포트 창은 기본 점)
  grid?: { cols: number; rows: number }; // 히트맵 칸 수 (Sportscode 기본 10×10)
  onlyRow?: string; // 모아 볼 행 (없으면 붙일 태그의 행, 그것도 없으면 전부)
  rotate?: LocRotate; // 판을 돌려서 보기 (세로로 세운 경기장 등). 좌표는 판 자체 기준 그대로 — 돌려도 X_Loc/Y_Loc 값은 같은 자리면 같음
  linkButton?: string; // 이 코드 버튼의 태그에만 붙임 (없으면 켜진 태그 → 방금 만든 태그)
  image?: { width: number; height: number }; // 내 그림 파일 크기 (그림 자체는 버튼 bgImage — Sportscode로 저장해도 보임)
}

export interface LocPreset {
  id: LocPresetId;
  sport: string;
  name: string;
  w: number; // 그림 비율 (m)
  h: number;
  goal?: boolean; // 골대 판: 틀 안쪽(가운데 70%)이 좌표, 바깥은 OUT Dir
  defaults: Omit<LocConfig, 'preset' | 'linkButton' | 'image'>;
  svg: () => string; // viewBox 0 0 w h 안의 선 그림
}

// 선 굵기는 판 크기와 무관하게 화면 px로 (non-scaling-stroke)
const LINE = 'fill="none" stroke="#ffffff" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"';
const thin = (w = 1) => `fill="none" stroke="#ffffffaa" stroke-width="${w}" vector-effect="non-scaling-stroke"`;
const f = (n: number) => +n.toFixed(3);
const goalFrame = (w: number, h: number, color: string) => {
  // 골대 판: 틀은 가로·세로 가운데 70% (슈팅 태깅 도구와 같은 여백 15%)
  const mx = w * 0.15;
  const top = h * 0.15;
  const bot = h * 0.85;
  const grid: string[] = [];
  const step = (w * 0.7) / 12;
  for (let x = mx; x <= w - mx + 1e-6; x += step) grid.push(`<line x1="${f(x)}" y1="${f(top)}" x2="${f(x)}" y2="${f(bot)}" ${thin(0.8)}/>`);
  for (let y = top; y <= bot + 1e-6; y += step) grid.push(`<line x1="${f(mx)}" y1="${f(y)}" x2="${f(w - mx)}" y2="${f(y)}" ${thin(0.8)}/>`);
  return (
    `<rect width="${w}" height="${h}" fill="#2d2b2b"/>` +
    `<line x1="0" y1="${f(bot)}" x2="${w}" y2="${f(bot)}" stroke="#ffffff55" stroke-width="${w / 200}"/>` +
    grid.join('') +
    `<path d="M${f(mx)} ${f(bot)} L${f(mx)} ${f(top)} L${f(w - mx)} ${f(top)} L${f(w - mx)} ${f(bot)}" fill="none" stroke="#ffffff" stroke-width="${w / 45}" stroke-linejoin="round"/>` +
    `<path d="M${f(mx)} ${f(bot)} L${f(mx)} ${f(top)} L${f(w - mx)} ${f(top)} L${f(w - mx)} ${f(bot)}" fill="none" stroke="${color}" stroke-width="${w / 140}"/>` +
    `<text x="${f(w / 2)}" y="${f(top * 0.62)}" font-size="${f(h * 0.07)}" fill="#ffffff66" text-anchor="middle">위로 벗어남</text>` +
    `<text x="${f(mx / 2)}" y="${f(h / 2)}" font-size="${f(h * 0.06)}" fill="#ffffff66" text-anchor="middle">왼쪽</text>` +
    `<text x="${f(w - mx / 2)}" y="${f(h / 2)}" font-size="${f(h * 0.06)}" fill="#ffffff66" text-anchor="middle">오른쪽</text>`
  );
};
/** D자 서클 (필드하키): 골대 양 기둥(cx±gh, y)을 중심으로 반지름 r 호 + 직선. dir: 위(-1) 또는 오른쪽/왼쪽 */
const hockeyD = (gx: number, gy: number, gh: number, r: number, dir: 'up' | 'right' | 'left', attrs: string) => {
  if (dir === 'up') return `<path d="M${f(gx - gh - r)} ${f(gy)} A${r} ${r} 0 0 1 ${f(gx - gh)} ${f(gy - r)} L${f(gx + gh)} ${f(gy - r)} A${r} ${r} 0 0 1 ${f(gx + gh + r)} ${f(gy)}" ${attrs}/>`;
  const s = dir === 'right' ? 1 : -1;
  return `<path d="M${f(gx)} ${f(gy - gh - r)} A${r} ${r} 0 0 ${dir === 'right' ? 1 : 0} ${f(gx + s * r)} ${f(gy - gh)} L${f(gx + s * r)} ${f(gy + gh)} A${r} ${r} 0 0 ${dir === 'right' ? 1 : 0} ${f(gx)} ${f(gy + gh + r)}" ${attrs}/>`;
};

export const LOC_PRESETS: LocPreset[] = [
  {
    id: 'hockey23',
    sport: '필드하키',
    name: '필드하키 공격 23m (슈팅 존 · Field Focus 호환)',
    w: 55,
    h: 23,
    defaults: { xMax: 550, yMax: 230, xGroup: 'X_Loc', yGroup: 'Y_Loc', decimals: 0, yUp: true },
    svg: () =>
      `<rect width="55" height="23" fill="#2563b8"/>` +
      `<line x1="0" y1="0.1" x2="55" y2="0.1" ${thin()}/>` +
      `<line x1="0" y1="23" x2="55" y2="23" ${LINE}/>` +
      hockeyD(27.5, 23, 1.83, 14.63, 'up', LINE) +
      hockeyD(27.5, 23, 1.83, 19.63, 'up', `${thin()} stroke-dasharray="5 4"`) +
      `<circle cx="27.5" cy="${23 - 6.4}" r="0.25" fill="#ffffff"/>` +
      `<line x1="25.67" y1="22.9" x2="29.33" y2="22.9" stroke="#ec3013" stroke-width="0.5"/>`,
  },
  {
    id: 'hockeyGoal',
    sport: '필드하키',
    name: '필드하키 골대 (Field Focus 호환)',
    w: 3.66 / 0.7,
    h: 2.14 / 0.7,
    goal: true,
    defaults: { xMax: 366, yMax: 214, xGroup: 'X_Goal', yGroup: 'Y_Goal', decimals: 0, yUp: true },
    svg: () => goalFrame(3.66 / 0.7, 2.14 / 0.7, '#ec3013'),
  },
  {
    id: 'hockeyFull',
    sport: '필드하키',
    name: '필드하키 경기장 전체 (91.4×55m)',
    w: 91.4,
    h: 55,
    defaults: { xMax: 914, yMax: 550, xGroup: 'X_Loc', yGroup: 'Y_Loc', decimals: 0, yUp: true },
    svg: () =>
      `<rect width="91.4" height="55" fill="#2563b8"/><rect x="0.15" y="0.15" width="91.1" height="54.7" ${LINE}/>` +
      `<line x1="45.7" y1="0" x2="45.7" y2="55" ${LINE}/>` +
      `<line x1="22.9" y1="0" x2="22.9" y2="55" ${LINE}/><line x1="68.5" y1="0" x2="68.5" y2="55" ${LINE}/>` +
      hockeyD(0, 27.5, 1.83, 14.63, 'right', LINE) +
      hockeyD(91.4, 27.5, 1.83, 14.63, 'left', LINE) +
      hockeyD(0, 27.5, 1.83, 19.63, 'right', `${thin()} stroke-dasharray="5 4"`) +
      hockeyD(91.4, 27.5, 1.83, 19.63, 'left', `${thin()} stroke-dasharray="5 4"`) +
      `<circle cx="6.4" cy="27.5" r="0.3" fill="#fff"/><circle cx="85" cy="27.5" r="0.3" fill="#fff"/>` +
      `<line x1="0" y1="25.67" x2="0" y2="29.33" stroke="#ec3013" stroke-width="0.8"/><line x1="91.4" y1="25.67" x2="91.4" y2="29.33" stroke="#ec3013" stroke-width="0.8"/>`,
  },
  {
    id: 'soccerFull',
    sport: '축구',
    name: '축구장 전체 (105×68m)',
    w: 105,
    h: 68,
    defaults: { xMax: 1050, yMax: 680, xGroup: 'X_Loc', yGroup: 'Y_Loc', decimals: 0, yUp: true },
    svg: () => {
      const dy = Math.sqrt(9.15 ** 2 - 5.5 ** 2);
      return (
        `<rect width="105" height="68" fill="#2f8a3d"/><rect x="0.15" y="0.15" width="104.7" height="67.7" ${LINE}/>` +
        `<line x1="52.5" y1="0" x2="52.5" y2="68" ${LINE}/><circle cx="52.5" cy="34" r="9.15" ${LINE}/><circle cx="52.5" cy="34" r="0.3" fill="#fff"/>` +
        `<rect x="0" y="${f(34 - 20.16)}" width="16.5" height="40.32" ${LINE}/><rect x="${f(105 - 16.5)}" y="${f(34 - 20.16)}" width="16.5" height="40.32" ${LINE}/>` +
        `<rect x="0" y="${f(34 - 9.16)}" width="5.5" height="18.32" ${LINE}/><rect x="99.5" y="${f(34 - 9.16)}" width="5.5" height="18.32" ${LINE}/>` +
        `<circle cx="11" cy="34" r="0.3" fill="#fff"/><circle cx="94" cy="34" r="0.3" fill="#fff"/>` +
        `<path d="M16.5 ${f(34 - dy)} A9.15 9.15 0 0 1 16.5 ${f(34 + dy)}" ${LINE}/><path d="M88.5 ${f(34 - dy)} A9.15 9.15 0 0 0 88.5 ${f(34 + dy)}" ${LINE}/>` +
        `<line x1="0" y1="30.34" x2="0" y2="37.66" stroke="#ec3013" stroke-width="0.8"/><line x1="105" y1="30.34" x2="105" y2="37.66" stroke="#ec3013" stroke-width="0.8"/>`
      );
    },
  },
  {
    id: 'soccerGoal',
    sport: '축구',
    name: '축구 골대 (7.32×2.44m)',
    w: 7.32 / 0.7,
    h: 2.44 / 0.7,
    goal: true,
    defaults: { xMax: 732, yMax: 244, xGroup: 'X_Goal', yGroup: 'Y_Goal', decimals: 0, yUp: true },
    svg: () => goalFrame(7.32 / 0.7, 2.44 / 0.7, '#ffffff'),
  },
  {
    id: 'handballFull',
    sport: '핸드볼',
    name: '핸드볼 코트 (40×20m)',
    w: 40,
    h: 20,
    defaults: { xMax: 400, yMax: 200, xGroup: 'X_Loc', yGroup: 'Y_Loc', decimals: 0, yUp: true },
    svg: () =>
      `<rect width="40" height="20" fill="#2a6fb8"/><rect x="0.1" y="0.1" width="39.8" height="19.8" ${LINE}/>` +
      `<line x1="20" y1="0" x2="20" y2="20" ${LINE}/>` +
      hockeyD(0, 10, 1.5, 6, 'right', LINE) +
      hockeyD(40, 10, 1.5, 6, 'left', LINE) +
      hockeyD(0, 10, 1.5, 9, 'right', `${LINE} stroke-dasharray="5 4"`) +
      hockeyD(40, 10, 1.5, 9, 'left', `${LINE} stroke-dasharray="5 4"`) +
      `<line x1="7" y1="9.5" x2="7" y2="10.5" ${LINE}/><line x1="33" y1="9.5" x2="33" y2="10.5" ${LINE}/>` +
      `<line x1="0" y1="8.5" x2="0" y2="11.5" stroke="#ec3013" stroke-width="0.5"/><line x1="40" y1="8.5" x2="40" y2="11.5" stroke="#ec3013" stroke-width="0.5"/>`,
  },
  {
    id: 'handballGoal',
    sport: '핸드볼',
    name: '핸드볼 골대 (3×2m)',
    w: 3 / 0.7,
    h: 2 / 0.7,
    goal: true,
    defaults: { xMax: 300, yMax: 200, xGroup: 'X_Goal', yGroup: 'Y_Goal', decimals: 0, yUp: true },
    svg: () => goalFrame(3 / 0.7, 2 / 0.7, '#ec3013'),
  },
  {
    id: 'basketballFull',
    sport: '농구',
    name: '농구 코트 전체 (28×15m)',
    w: 28,
    h: 15,
    defaults: { xMax: 280, yMax: 150, xGroup: 'X_Loc', yGroup: 'Y_Loc', decimals: 0, yUp: true },
    svg: () => {
      const end = (x0: number, s: 1 | -1) => {
        const bx = x0 + s * 1.575;
        const xLine = bx + s * Math.sqrt(6.75 ** 2 - 6.6 ** 2);
        return (
          `<rect x="${f(s === 1 ? 0 : 28 - 5.8)}" y="${f(7.5 - 2.45)}" width="5.8" height="4.9" ${LINE}/>` +
          `<circle cx="${f(x0 + s * 5.8)}" cy="7.5" r="1.8" ${LINE}/>` +
          `<line x1="${x0}" y1="0.9" x2="${f(xLine)}" y2="0.9" ${LINE}/><line x1="${x0}" y1="14.1" x2="${f(xLine)}" y2="14.1" ${LINE}/>` +
          `<path d="M${f(xLine)} 0.9 A6.75 6.75 0 0 ${s === 1 ? 1 : 0} ${f(xLine)} 14.1" ${LINE}/>` +
          `<circle cx="${f(bx)}" cy="7.5" r="0.23" stroke="#ff7a00" stroke-width="1.6" vector-effect="non-scaling-stroke" fill="none"/>` +
          `<line x1="${f(x0 + s * 1.2)}" y1="6.6" x2="${f(x0 + s * 1.2)}" y2="8.4" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke"/>`
        );
      };
      return `<rect width="28" height="15" fill="#c98a4b"/><rect x="0.05" y="0.05" width="27.9" height="14.9" ${LINE}/><line x1="14" y1="0" x2="14" y2="15" ${LINE}/><circle cx="14" cy="7.5" r="1.8" ${LINE}/>` + end(0, 1) + end(28, -1);
    },
  },
  {
    id: 'basketballHalf',
    sport: '농구',
    name: '농구 하프 코트 (15×14m)',
    w: 15,
    h: 14,
    defaults: { xMax: 150, yMax: 140, xGroup: 'X_Loc', yGroup: 'Y_Loc', decimals: 0, yUp: true },
    svg: () => {
      // 위쪽이 엔드라인(골대), 아래쪽이 중앙선
      const by = 1.575;
      const yLine = by + Math.sqrt(6.75 ** 2 - 6.6 ** 2);
      return (
        `<rect width="15" height="14" fill="#c98a4b"/><rect x="0.05" y="0.05" width="14.9" height="13.9" ${LINE}/>` +
        `<rect x="${f(7.5 - 2.45)}" y="0" width="4.9" height="5.8" ${LINE}/><circle cx="7.5" cy="5.8" r="1.8" ${LINE}/>` +
        `<line x1="0.9" y1="0" x2="0.9" y2="${f(yLine)}" ${LINE}/><line x1="14.1" y1="0" x2="14.1" y2="${f(yLine)}" ${LINE}/>` +
        `<path d="M0.9 ${f(yLine)} A6.75 6.75 0 0 0 14.1 ${f(yLine)}" ${LINE}/>` +
        `<path d="M5.7 14 A1.8 1.8 0 0 1 9.3 14" ${LINE}/>` +
        `<circle cx="7.5" cy="${by}" r="0.23" stroke="#ff7a00" stroke-width="1.6" vector-effect="non-scaling-stroke" fill="none"/><line x1="6.6" y1="1.2" x2="8.4" y2="1.2" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke"/>`
      );
    },
  },
  {
    id: 'custom',
    sport: '내 그림',
    name: '내 그림 파일 (가로·세로 직접)',
    w: 100,
    h: 60,
    defaults: { xMax: 100, yMax: 60, xGroup: 'X_Loc', yGroup: 'Y_Loc', decimals: 0, yUp: true },
    svg: () => `<rect width="100" height="60" fill="#3a404c"/><rect x="0.5" y="0.5" width="99" height="59" fill="none" stroke="#ffffff55" stroke-width="0.5" stroke-dasharray="2 2"/><text x="50" y="32" font-size="5" fill="#ffffff88" text-anchor="middle">그림 파일을 넣으세요</text>`,
  },
];

export const presetOf = (id: LocPresetId) => LOC_PRESETS.find((p) => p.id === id) ?? LOC_PRESETS[0];
export const defaultLoc = (id: LocPresetId = 'hockey23'): LocConfig => ({ preset: id, ...presetOf(id).defaults });

/** 판 그림 자체의 비율 (돌리기 전, 가로/세로) — 내 그림이면 그림 비율 */
export const artAspect = (c: LocConfig) => (c.image ? c.image.width / c.image.height : presetOf(c.preset).w / presetOf(c.preset).h);
const sideways = (c: LocConfig) => c.rotate === 90 || c.rotate === 270;
/** 화면에 보이는 판의 비율 (돌린 것 반영) */
export const locAspect = (c: LocConfig) => (sideways(c) ? 1 / artAspect(c) : artAspect(c));

/** 화면 위 자리(0~1) ↔ 판 그림 위 자리(0~1): 시계 방향으로 rotate만큼 돌려 보여줌 */
export function screenToArt(c: LocConfig, su: number, sv: number): { u: number; v: number } {
  switch (c.rotate) {
    case 90: return { u: sv, v: 1 - su };
    case 180: return { u: 1 - su, v: 1 - sv };
    case 270: return { u: 1 - sv, v: su };
    default: return { u: su, v: sv };
  }
}
export function artToScreen(c: LocConfig, u: number, v: number): { u: number; v: number } {
  switch (c.rotate) {
    case 90: return { u: 1 - v, v: u };
    case 180: return { u: 1 - u, v: 1 - v };
    case 270: return { u: v, v: 1 - u };
    default: return { u, v };
  }
}

export type LocPick = { x: number; y: number } | { out: 'LEFT' | 'RIGHT' | 'UP' };

/** 화면에서 누른 자리(가로·세로 0~1, 왼쪽 위가 0) → 좌표 (골대 판은 틀 바깥이면 OUT Dir) */
export function pickToCoord(c: LocConfig, su: number, sv: number): LocPick {
  const { u, v } = screenToArt(c, su, sv);
  const goal = !c.image && presetOf(c.preset).goal;
  let fu = u;
  let fv = v;
  if (goal) {
    fu = (u - 0.15) / 0.7;
    fv = (v - 0.15) / 0.7;
    if (fu < 0) return { out: 'LEFT' };
    if (fu > 1) return { out: 'RIGHT' };
    if (fv < 0) return { out: 'UP' };
  }
  fu = Math.max(0, Math.min(1, fu));
  fv = Math.max(0, Math.min(1, fv));
  const k = 10 ** c.decimals;
  const r = (n: number) => Math.round(n * k) / k;
  return { x: r(fu * c.xMax), y: r((c.yUp ? 1 - fv : fv) * c.yMax) };
}

/** 좌표 → 화면 위 자리 (가로·세로 0~1) — 이미 찍은 위치 표시용 */
export function coordToPick(c: LocConfig, x: number, y: number): { u: number; v: number } {
  const fu = x / c.xMax;
  const fv = c.yUp ? 1 - y / c.yMax : y / c.yMax;
  const goal = !c.image && presetOf(c.preset).goal;
  return goal ? artToScreen(c, 0.15 + fu * 0.7, 0.15 + fv * 0.7) : artToScreen(c, fu, fv);
}

export const OUT_GROUP = 'OUT Dir';
/** 이 판이 붙이는 라벨 그룹들 (다시 찍으면 이 그룹은 바꿔 끼움) */
export const locGroups = (c: LocConfig) => [c.xGroup, c.yGroup, ...(!c.image && presetOf(c.preset).goal ? [OUT_GROUP] : [])];

/** 누른 결과 → 붙일 라벨 */
export function pickLabels(c: LocConfig, p: LocPick): Label[] {
  if ('out' in p) return [{ group: OUT_GROUP, name: p.out }];
  return [
    { group: c.xGroup, name: String(p.x) },
    { group: c.yGroup, name: String(p.y) },
  ];
}

/** 태그 라벨에서 이 판의 위치 읽기 (표시용) */
export function readLoc(c: LocConfig, labels: Label[]): { u: number; v: number } | { out: string } | null {
  const out = labels.find((l) => l.group === OUT_GROUP);
  const x = labels.find((l) => l.group === c.xGroup);
  const y = labels.find((l) => l.group === c.yGroup);
  if (x && y && !isNaN(Number(x.name)) && !isNaN(Number(y.name))) return coordToPick(c, Number(x.name), Number(y.name));
  if (out && !c.image && presetOf(c.preset).goal) return { out: out.name };
  return null;
}

/** 라벨 목록에서 groups 그룹 라벨을 새 라벨로 바꿔 끼움 */
export const replaceGroups = (labels: Label[], groups: string[], add: Label[]) => [...labels.filter((l) => !groups.includes(l.group)), ...add];

// ---- 찍힌 태그 모아 보기 (슈팅맵·히트맵) ----

export interface LocHit {
  fu: number; // 좌표 범위 안 자리 0~1 (왼쪽 위가 0 — 판 그림 기준, 돌리기 전)
  fv: number;
  row: string;
  id: string;
  start: number;
  end: number;
  labels: Label[];
}

/** 타임라인에서 이 판의 좌표 라벨이 붙은 태그 전부 (onlyRow면 그 행만) */
export function locHits(c: LocConfig, rows: { name: string; instances: { uniqueId: string; startTime: number; endTime: number; labels: Label[] }[] }[], onlyRow?: string): LocHit[] {
  const out: LocHit[] = [];
  for (const r of rows) {
    if (onlyRow && r.name !== onlyRow) continue;
    for (const i of r.instances) {
      const x = Number(i.labels.find((l) => l.group === c.xGroup)?.name);
      const y = Number(i.labels.find((l) => l.group === c.yGroup)?.name);
      if (!i.labels.some((l) => l.group === c.xGroup) || isNaN(x) || isNaN(y)) continue;
      const fu = Math.max(0, Math.min(1, x / c.xMax));
      const fv = Math.max(0, Math.min(1, c.yUp ? 1 - y / c.yMax : y / c.yMax));
      out.push({ fu, fv, row: r.name, id: i.uniqueId, start: i.startTime, end: i.endTime, labels: i.labels });
    }
  }
  return out;
}

const isGoal = (c: LocConfig) => !c.image && !!presetOf(c.preset).goal;
/** 좌표 범위 자리 → 판 그림 자리 (골대는 틀 안쪽) */
export const unitToArt = (c: LocConfig, fu: number, fv: number) => (isGoal(c) ? { u: 0.15 + fu * 0.7, v: 0.15 + fv * 0.7 } : { u: fu, v: fv });
/** 화면 자리 → 좌표 범위 자리 (범위 밖이면 null) */
export function screenToUnit(c: LocConfig, su: number, sv: number): { fu: number; fv: number } | null {
  const a = screenToArt(c, su, sv);
  const fu = isGoal(c) ? (a.u - 0.15) / 0.7 : a.u;
  const fv = isGoal(c) ? (a.v - 0.15) / 0.7 : a.v;
  return fu < 0 || fu > 1 || fv < 0 || fv > 1 ? null : { fu, fv };
}
export const gridOf = (c: LocConfig) => ({ cols: Math.max(1, c.grid?.cols ?? 10), rows: Math.max(1, c.grid?.rows ?? 10) });
/** 칸 번호 (col, row) */
export function cellOf(c: LocConfig, fu: number, fv: number) {
  const g = gridOf(c);
  return { col: Math.min(g.cols - 1, Math.floor(fu * g.cols)), row: Math.min(g.rows - 1, Math.floor(fv * g.rows)) };
}

/** 모아 볼 행: 직접 고른 행 > 붙일 태그(코드 버튼)의 행 > 전부 */
export const locRowFilter = (c: LocConfig, cw: { buttons: { id: string; name: string }[] }) => c.onlyRow || (c.linkButton ? cw.buttons.find((b) => b.id === c.linkButton)?.name : undefined);

export interface LocCell {
  x: number; // 화면 자리 0~1 (돌린 판도 칸은 네모 그대로)
  y: number;
  w: number;
  h: number;
  fill: string;
  opacity: number;
  hits: number[]; // 이 칸에 든 태그 (hits 배열 번호)
}

/** 히트맵 칸: 태그 수 적음(파랑) ~ 많음(빨강) */
export function heatCells(c: LocConfig, hits: LocHit[]): LocCell[] {
  const g = gridOf(c);
  const byCell = new Map<string, number[]>();
  hits.forEach((h, i) => {
    const k = cellOf(c, h.fu, h.fv);
    const key = k.col + ',' + k.row;
    byCell.set(key, [...(byCell.get(key) ?? []), i]);
  });
  const max = Math.max(1, ...[...byCell.values()].map((v) => v.length));
  return [...byCell].map(([key, list]) => {
    const [col, row] = key.split(',').map(Number);
    const a0 = unitToArt(c, col / g.cols, row / g.rows);
    const a1 = unitToArt(c, (col + 1) / g.cols, (row + 1) / g.rows);
    const p = artToScreen(c, a0.u, a0.v);
    const q = artToScreen(c, a1.u, a1.v);
    const t = list.length / max;
    return { x: Math.min(p.u, q.u), y: Math.min(p.v, q.v), w: Math.abs(q.u - p.u), h: Math.abs(q.v - p.v), fill: `hsl(${Math.round(220 - 220 * t)} 90% 50%)`, opacity: 0.35 + 0.45 * t, hits: list };
  });
}

/** 태그 자리 → 화면 자리 */
export const hitScreen = (c: LocConfig, h: Pick<LocHit, 'fu' | 'fv'>) => {
  const a = unitToArt(c, h.fu, h.fv);
  return artToScreen(c, a.u, a.v);
};
