// Alter Live src/shared/ink.ts 복사본 (영상 위 그리기 도형) — 고칠 때는 양쪽 같이
// 영상 위 그리기(텔레스트레이션) 도형: 좌표는 영상 화면 기준 비율 [0~1] → 화면 크기·회전이 바뀌어도 영상 위 같은 자리
// SVG viewBox 는 가로 INK_W, 세로 INK_W × (영상 높이/너비). 아이패드 뷰어(resources/viewer/index.html)에도 같은 계산이 들어 있음
export const INK_W = 1000;
export type InkTool = 'pen' | 'arrow' | 'dash' | 'line' | 'spot' | 'area' | 'text' | 'move' | 'erase'; // move·erase는 도구만 (도형 종류 아님)
export interface InkShape {
  t: InkTool;
  c: string; // 색
  pts: [number, number][];
  done?: boolean; // 공간 표시: 다 그렸으면 닫고 칠함
  w?: number; // 크기 배율 (작게 0.6 / 보통 1 / 크게 1.6) — 선 굵기·하이라이트 기본 크기
  at?: number; // 그린 시각 (사라짐 모드)
  text?: string; // 글자 (pts[0] = 글자 왼쪽 위)
}
// 기본 색 8개 (팔레트로 바꿀 수 있지만 앱을 다시 켜면 이 색으로 돌아감)
export const INK_COLORS = ['#ff3b30', '#ffd60a', '#30b0ff', '#ffffff', '#34c759', '#ff9500', '#bf5af2', '#1c1c1e'];
export const INK_SIZES: { w: number; label: string }[] = [
  { w: 0.6, label: '작게' },
  { w: 1, label: '보통' },
  { w: 1.6, label: '크게' },
];
// 화살표·점선·선 아이콘은 글꼴마다 모양이 달라(윈도우에서 ⇢ 가 → 와 똑같이 보임) 직접 그린 SVG
const ICO = (body: string) => `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
export const INK_TOOLS: { tool: InkTool; icon: string; title: string }[] = [
  { tool: 'pen', icon: '✎', title: '펜 — 자유롭게 그리기 (손글씨도)' },
  { tool: 'arrow', icon: ICO('<path d="M3 15 L16 4"/><path d="M9.5 4 H16 V10.5"/>'), title: '화살표 (실선)' },
  { tool: 'dash', icon: ICO('<path d="M3 15 L16 4" stroke-dasharray="3 3"/><path d="M9.5 4 H16 V10.5"/>'), title: '화살표 (점선)' },
  { tool: 'line', icon: ICO('<path d="M3 16 L17 4"/>'), title: '선' },
  { tool: 'spot', icon: '◎', title: '하이라이트 — 선수 발밑을 찍거나 끌어서 크기' },
  { tool: 'area', icon: '▱', title: '공간 표시 — 영역을 한 바퀴 둘러 그리기' },
  { tool: 'text', icon: 'T', title: '글자 — 누른 자리에 입력 (Enter 끝, Esc 취소). 쓴 글자를 다시 누르면 고치기, 끌면 옮기기, 다 지우면 삭제' },
  { tool: 'move', icon: ICO('<path d="M10 2 V18 M2 10 H18"/><path d="M7.5 4.5 L10 2 L12.5 4.5 M7.5 15.5 L10 18 L12.5 15.5 M4.5 7.5 L2 10 L4.5 12.5 M15.5 7.5 L18 10 L15.5 12.5"/>'), title: '옮기기 — 그림·글자를 끌어서 자리 조정' },
  { tool: 'erase', icon: ICO('<path d="M8 17 H17"/><path d="M8 17 L3.5 12.5 L12 4 L17 9 L9.5 16.5"/><path d="M7.5 8.5 L12.5 13.5"/>'), title: '지우개 — 누른 그림·글자 하나만 지우기' },
];
/** 글자 크기 (viewBox 단위, 크기 배율 적용) */
export const inkTextSize = (w = 1) => 34 * w;
export const INK_FONT = "'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif";
const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** 어두운 글자는 밝은 테두리, 나머지는 어두운 테두리 (어느 화면에서나 읽히게) */
function textEdge(hex: string) {
  const v = parseInt(hex.slice(1, 3), 16) * 0.3 + parseInt(hex.slice(3, 5), 16) * 0.59 + parseInt(hex.slice(5, 7), 16) * 0.11;
  return v < 70 ? '#ffffffd0' : '#000000d0';
}
export const FADE_AFTER = 3000;
export const FADE_MS = 1000;

/** 화살표·선: 휘어 그리면 곡선 (그린 경로에서 직선과 가장 먼 점을 지나는 2차 곡선) */
export function curveOf(pts: [number, number][]) {
  const a = pts[0];
  const b = pts[pts.length - 1];
  let far: [number, number] | null = null;
  let d = 0;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  for (const q of pts) {
    const dist = Math.abs((q[0] - a[0]) * dy - (q[1] - a[1]) * dx) / len;
    if (dist > d) {
      d = dist;
      far = q;
    }
  }
  if (!far || d < len * 0.06) return { a, b, c: null as [number, number] | null };
  return { a, b, c: [2 * far[0] - (a[0] + b[0]) / 2, 2 * far[1] - (a[1] + b[1]) / 2] as [number, number] };
}

/** 색을 회색 쪽으로 반쯤 섞은 반투명색 (Field Focus 영상 도구 하이라이트와 같은 계산) */
export function mutedRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const gr = r * 0.3 + g * 0.59 + b * 0.11;
  return `rgba(${Math.round(r * 0.5 + gr * 0.5)},${Math.round(g * 0.5 + gr * 0.5)},${Math.round(b * 0.5 + gr * 0.5)},${a})`;
}

/**
 * 하이라이트: 선수 발밑에 깔리는 납작한 타원 (Field Focus 영상 도구·전술판 방식)
 *  - 가로:세로 = 1 : 0.4 (바닥에 누운 원처럼)
 *  - 테두리는 위(뒤)쪽이 투명하고 아래(앞)쪽으로 갈수록 진해지는 세로 그라데이션 + 같은 색 빛 번짐
 *  - 안은 회색 섞인 반투명색 (선수를 가리지 않게)
 */
function spotRadius(sh: InkShape, H: number): number {
  const a = sh.pts[0];
  const z = sh.pts[sh.pts.length - 1];
  const dragged = Math.hypot((z[0] - a[0]) * INK_W, (z[1] - a[1]) * H);
  return dragged < 8 ? 40 * (sh.w ?? 1) : Math.max(10, dragged); // 찍기만 하면 크기 설정대로, 끌면 끈 만큼 (작게도 됨)
}
function spotSvg(sh: InkShape, X: (q: [number, number]) => string, Y: (q: [number, number]) => string, H: number): string {
  const a = sh.pts[0];
  const k = sh.w ?? 1;
  const rx = spotRadius(sh, H);
  const ry = rx * 0.4;
  const id = `hl${Math.round(a[0] * 1e5)}_${Math.round(a[1] * 1e5)}_${Math.round(rx)}_${sh.c.slice(1)}`;
  return (
    `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${mutedRgba(sh.c, 1)}" stop-opacity="0"/><stop offset=".5" stop-color="${mutedRgba(sh.c, 1)}" stop-opacity=".5"/><stop offset="1" stop-color="${sh.c}"/>` +
    `</linearGradient><filter id="${id}f" x="-60%" y="-120%" width="220%" height="340%"><feGaussianBlur stdDeviation="${(9 * Math.max(0.6, k)).toFixed(1)}"/></filter></defs>` +
    `<ellipse cx="${X(a)}" cy="${Y(a)}" rx="${rx}" ry="${ry}" fill="none" stroke="${sh.c}" stroke-width="${(7 * k).toFixed(1)}" filter="url(#${id}f)" opacity=".9"/>` +
    `<ellipse cx="${X(a)}" cy="${Y(a)}" rx="${rx}" ry="${ry}" fill="${mutedRgba(sh.c, 0.2)}" stroke="url(#${id}g)" stroke-width="${(4 * Math.max(0.75, k)).toFixed(1)}"/>`
  );
}

/** 도형 하나 → SVG 조각 (H = viewBox 세로) */
export function inkShapeSvg(sh: InkShape, H: number, op: number | string = 1): string {
  const k = sh.w ?? 1;
  const sw = (n: number) => (n * k).toFixed(1); // 크기 배율 적용한 선 굵기
  const X = (q: [number, number]) => (q[0] * INK_W).toFixed(1);
  const Y = (q: [number, number]) => (q[1] * H).toFixed(1);
  const g = (inner: string) => `<g opacity="${op}">${inner}</g>`;
  if (sh.t === 'arrow' || sh.t === 'dash' || sh.t === 'line') {
    const { a, b, c } = curveOf(sh.pts);
    if (Math.hypot((b[0] - a[0]) * INK_W, (b[1] - a[1]) * H) < 6) return '';
    const d = c ? `M${X(a)} ${Y(a)} Q${X(c)} ${Y(c)} ${X(b)} ${Y(b)}` : `M${X(a)} ${Y(a)} L${X(b)} ${Y(b)}`;
    const dash = sh.t === 'dash' ? ' stroke-dasharray="18 12"' : '';
    let head = '';
    if (sh.t !== 'line') {
      const from = c ?? a;
      const ang = Math.atan2((b[1] - from[1]) * H, (b[0] - from[0]) * INK_W);
      const L = 26 * Math.max(0.7, k);
      const bx = b[0] * INK_W;
      const by = b[1] * H;
      const p1 = [bx - L * Math.cos(ang - 0.45), by - L * Math.sin(ang - 0.45)];
      const p2 = [bx - L * Math.cos(ang + 0.45), by - L * Math.sin(ang + 0.45)];
      const hd = `M${p1[0].toFixed(1)} ${p1[1].toFixed(1)} L${bx.toFixed(1)} ${by.toFixed(1)} L${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
      head = `<path d="${hd}" fill="none" stroke="#000a" stroke-width="${sw(10)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${hd}" fill="none" stroke="${sh.c}" stroke-width="${sw(6)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    return g(`<path d="${d}" fill="none" stroke="#000a" stroke-width="${sw(10)}" stroke-linecap="round"${dash}/><path d="${d}" fill="none" stroke="${sh.c}" stroke-width="${sw(6)}" stroke-linecap="round"${dash}/>${head}`);
  }
  if (sh.t === 'pen') {
    // 자유 펜: 점들 사이를 중간점 기준 2차 곡선으로 이어 부드럽게 (손떨림 각진 선 방지)
    const p = sh.pts;
    if (p.length === 1) return g(`<circle cx="${X(p[0])}" cy="${Y(p[0])}" r="${sw(4)}" fill="${sh.c}" stroke="#000a" stroke-width="${sw(2)}"/>`);
    let d = `M${X(p[0])} ${Y(p[0])}`;
    for (let i = 1; i < p.length - 1; i++) {
      const m: [number, number] = [(p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2];
      d += ` Q${X(p[i])} ${Y(p[i])} ${X(m)} ${Y(m)}`;
    }
    d += ` L${X(p[p.length - 1])} ${Y(p[p.length - 1])}`;
    return g(`<path d="${d}" fill="none" stroke="#000a" stroke-width="${sw(9)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${sh.c}" stroke-width="${sw(5)}" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  if (sh.t === 'spot') return g(spotSvg(sh, X, Y, H));
  if (sh.t === 'text') {
    const fs = inkTextSize(sh.w);
    const y = sh.pts[0][1] * H + fs * 0.85;
    return g(`<text x="${X(sh.pts[0])}" y="${y.toFixed(1)}" font-size="${fs.toFixed(1)}" font-weight="700" font-family="${INK_FONT}" fill="${sh.c}" stroke="${textEdge(sh.c)}" stroke-width="${(fs * 0.16).toFixed(1)}" stroke-linejoin="round" paint-order="stroke" xml:space="preserve">${escXml(sh.text ?? '')}</text>`);
  }
  if (sh.t === 'area') {
    if (sh.pts.length < 3) return '';
    const d = 'M' + sh.pts.map((q) => X(q) + ' ' + Y(q)).join(' L') + (sh.done ? ' Z' : '');
    return g(`<path d="${d}" fill="${sh.done ? sh.c : 'none'}" fill-opacity=".3" stroke="${sh.c}" stroke-width="${sw(4)}" stroke-dasharray="14 9" stroke-linejoin="round"/>`);
  }
  return '';
}

/** 사라짐 모드에서 도형의 투명도 (1 → 0) */
export function inkOpacity(sh: InkShape, fade: boolean, now = Date.now()): number {
  if (!fade) return 1;
  return Math.max(0, Math.min(1, 1 - (now - (sh.at ?? now) - FADE_AFTER) / FADE_MS));
}

const segDist = (p: [number, number], a: [number, number], b: [number, number]) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const k = dx || dy ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(p[0] - a[0] - k * dx, p[1] - a[1] - k * dy);
};

/**
 * 비율 좌표 (u, v)가 이 도형 위인가. H = viewBox 세로, textWidth = 글자 폭(viewBox 단위 — 글꼴에 달려 화면에서 재서 넘김)
 * 선은 너무 가늘면 집기 어려워 여유를 둠
 */
export function inkHit(sh: InkShape, u: number, v: number, H: number, textWidth: (sh: InkShape) => number = () => 0): boolean {
  const toVb = (q: [number, number]): [number, number] => [q[0] * INK_W, q[1] * H];
  const p = toVb([u, v]);
  const near = (line: [number, number][], tol: number) => line.some((a, i) => i > 0 && segDist(p, toVb(line[i - 1]), toVb(a)) <= tol);
  const k = sh.w ?? 1;
  if (sh.t === 'text') {
    const [x, y] = toVb(sh.pts[0]);
    return p[0] >= x - 6 && p[0] <= x + textWidth(sh) + 6 && p[1] >= y - 6 && p[1] <= y + inkTextSize(sh.w) * 1.2 + 6;
  }
  if (sh.t === 'spot') {
    const [x, y] = toVb(sh.pts[0]);
    const rx = spotRadius(sh, H) + 8;
    return ((p[0] - x) / rx) ** 2 + ((p[1] - y) / (rx * 0.4 + 8)) ** 2 <= 1;
  }
  if (sh.t === 'area') {
    if (near([...sh.pts, sh.pts[0]], 12)) return true;
    let inside = false; // 안쪽을 눌러도 집힘
    const q = sh.pts.map(toVb);
    for (let i = 0, j = q.length - 1; i < q.length; j = i++) if (q[i][1] > p[1] !== q[j][1] > p[1] && p[0] < ((q[j][0] - q[i][0]) * (p[1] - q[i][1])) / (q[j][1] - q[i][1]) + q[i][0]) inside = !inside;
    return inside;
  }
  if (sh.t === 'pen') return sh.pts.length === 1 ? Math.hypot(...(toVb(sh.pts[0]).map((x, i) => x - p[i]) as [number, number])) <= 12 : near(sh.pts, 12 * Math.max(1, k));
  // 화살표·선: 곡선은 잘게 나눠 봄
  const { a, b, c } = curveOf(sh.pts);
  if (!c) return near([a, b], 14 * Math.max(1, k));
  const line = Array.from({ length: 21 }, (_, i): [number, number] => {
    const s = i / 20;
    return [(1 - s) ** 2 * a[0] + 2 * s * (1 - s) * c[0] + s * s * b[0], (1 - s) ** 2 * a[1] + 2 * s * (1 - s) * c[1] + s * s * b[1]];
  });
  return near(line, 14 * Math.max(1, k));
}

/** 도형 옮기기: 화면 밖으로 나가지 않게 막음. 원래 도형은 안 고치고 새 도형을 돌려줌 (extraW·extraH = 글자처럼 pts보다 큰 만큼, 비율) */
export function inkMove(sh: InkShape, dx: number, dy: number, extraW = 0, extraH = 0): InkShape {
  const xs = sh.pts.map((q) => q[0]);
  const ys = sh.pts.map((q) => q[1]);
  const clamp = (d: number, lo: number, hi: number) => Math.max(-lo, Math.min(1 - hi, d));
  const mx = clamp(dx, Math.min(...xs), Math.max(...xs) + extraW);
  const my = clamp(dy, Math.min(...ys), Math.max(...ys) + extraH);
  return { ...sh, pts: sh.pts.map((q): [number, number] => [q[0] + mx, q[1] + my]) };
}
