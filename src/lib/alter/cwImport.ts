// Alter Live(src/main/cwImport.ts)에서 복사 — 서버(API 라우트)에서만 씀 (node:zlib)
// Sportscode 코드윈도우(.CWcode2SC) 불러오기.
// 파일 구조 (2026-10 Sportscode 12.x 파일을 직접 디코딩해서 확인):
//   바깥: NSKeyedArchiver bplist, 클래스명 "x38101746", 키 이름이 난독화돼 있음
//     "973rbp[ag"   = 실제 데이터 (그냥 bplist 이거나 zlib 압축된 bplist)
//     "=[as.]f.g"   = 16바이트 검증값 (단순 MD5 아님 — 읽기에는 필요 없음)
//   안쪽: NSKeyedArchiver bplist, $top = { m_codeButtons, m_codeButtonLinks, m_backgroundColor, ... }
//     CWButton.m_codeButtonType: 0=코드 1=라벨 2=텍스트 3=스크립트 출력 4=차트
//     CWLink.m_type: 0=deactivation 1=activation 2=exclusive
//     좌표(m_frame.cg)는 왼쪽 위 원점

import { deflateSync, inflateSync } from 'node:zlib';

// node:zlib crc32는 Node 20.15+에만 있어서 서버 버전과 상관없게 직접 계산
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf: Buffer): number { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
import { parseBuffer, setMaxObjectCount, setMaxObjectSize } from 'bplist-parser';
import type { ButtonKind, CodeWindow, CWButton, CWLink, Hotkey, LinkType } from './types';

// 리포트 코드윈도우는 객체가 1만 개를 넘고 배경 이미지도 커서 기본 한도(32768개)를 넘길 수 있음
setMaxObjectCount(10_000_000);
setMaxObjectSize(512 * 1024 * 1024);

type UIDRef = { UID: number };
const isUID = (v: unknown): v is UIDRef => typeof v === 'object' && v !== null && 'UID' in v;

class Archive {
  objects: unknown[];
  top: Record<string, unknown>;
  constructor(buf: Buffer) {
    const root = parseBuffer(buf)[0] as { $objects: unknown[]; $top: Record<string, unknown> };
    this.objects = root.$objects;
    this.top = root.$top;
  }
  deref(v: unknown): unknown {
    return isUID(v) ? this.objects[v.UID] : v;
  }
  className(v: unknown): string | null {
    const o = this.deref(v) as Record<string, unknown> | null;
    if (!o || typeof o !== 'object' || !('$class' in o)) return null;
    return (this.deref(o.$class) as { $classname: string }).$classname;
  }
  /** NSDictionary/NSArray/문자열을 일반 JS 값으로 풀어줌 (얕은 깊이 제한) */
  value(v: unknown, depth = 0): unknown {
    const o = this.deref(v);
    if (o === '$null') return null;
    if (depth > 6 || typeof o !== 'object' || o === null || Buffer.isBuffer(o)) return o;
    const rec = o as Record<string, unknown>;
    if ('NS.keys' in rec) {
      const keys = (rec['NS.keys'] as unknown[]).map((k) => this.deref(k) as string);
      const vals = rec['NS.objects'] as unknown[];
      return Object.fromEntries(keys.map((k, i) => [k, this.value(vals[i], depth + 1)]));
    }
    if ('NS.objects' in rec) return (rec['NS.objects'] as unknown[]).map((x) => this.value(x, depth + 1));
    if ('NS.string' in rec) return rec['NS.string'];
    return rec;
  }
}

export function unwrapCodeWindow(file: Buffer): Buffer {
  const outer = new Archive(file);
  const root = outer.deref(outer.top.root) as Record<string, unknown>;
  const payload = outer.deref(root['973rbp[ag']);
  if (!Buffer.isBuffer(payload)) throw new Error('코드윈도우 데이터 블록을 찾을 수 없음');
  return payload.subarray(0, 6).toString('latin1') === 'bplist' ? payload : inflateSync(payload);
}

const KIND: Record<number, ButtonKind> = { 0: 'code', 1: 'label', 2: 'text', 3: 'output', 4: 'chart' };
const LINK: Record<number, LinkType> = { 0: 'deactivation', 1: 'activation', 2: 'exclusive' };

// macOS 가상 키코드 → KeyboardEvent.code (물리 키 위치 기준이라 한/영 상태와 무관)
const MAC_KEYCODES: Record<number, string> = {
  0: 'KeyA', 1: 'KeyS', 2: 'KeyD', 3: 'KeyF', 4: 'KeyH', 5: 'KeyG', 6: 'KeyZ', 7: 'KeyX', 8: 'KeyC', 9: 'KeyV',
  11: 'KeyB', 12: 'KeyQ', 13: 'KeyW', 14: 'KeyE', 15: 'KeyR', 16: 'KeyY', 17: 'KeyT', 18: 'Digit1', 19: 'Digit2',
  20: 'Digit3', 21: 'Digit4', 22: 'Digit6', 23: 'Digit5', 24: 'Equal', 25: 'Digit9', 26: 'Digit7', 27: 'Minus',
  28: 'Digit8', 29: 'Digit0', 30: 'BracketRight', 31: 'KeyO', 32: 'KeyU', 33: 'BracketLeft', 34: 'KeyI', 35: 'KeyP',
  36: 'Enter', 37: 'KeyL', 38: 'KeyJ', 39: 'Quote', 40: 'KeyK', 41: 'Semicolon', 42: 'Backslash', 43: 'Comma',
  44: 'Slash', 45: 'KeyN', 46: 'KeyM', 47: 'Period', 48: 'Tab', 49: 'Space', 50: 'Backquote',
  65: 'NumpadDecimal', 67: 'NumpadMultiply', 69: 'NumpadAdd', 75: 'NumpadDivide', 76: 'NumpadEnter',
  78: 'NumpadSubtract', 82: 'Numpad0', 83: 'Numpad1', 84: 'Numpad2', 85: 'Numpad3', 86: 'Numpad4', 87: 'Numpad5',
  88: 'Numpad6', 89: 'Numpad7', 91: 'Numpad8', 92: 'Numpad9', 96: 'F5', 97: 'F6', 98: 'F7', 99: 'F3', 100: 'F8',
  101: 'F9', 103: 'F11', 109: 'F10', 111: 'F12', 118: 'F4', 120: 'F2', 122: 'F1',
  123: 'ArrowLeft', 124: 'ArrowRight', 125: 'ArrowDown', 126: 'ArrowUp',
};

const codeToKey = (code: string) =>
  code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code;

/** 색 → "#RRGGBB" (불투명) 또는 "#RRGGBBAA" (투명도가 있으면 — 투명 배경 버튼을 검게 그리지 않으려면 필요) */
const rgbHex = (c: unknown, fallback: string): string => {
  let o = c as { r?: number; g?: number; b?: number; a?: number; NSRGB?: Buffer } | null;
  // NSColor 아카이브는 NSRGB = "0.1 0.2 0.3 [알파]\0" 형태의 바이트 문자열
  if (o && Buffer.isBuffer(o.NSRGB)) {
    const [r, g, b, a] = o.NSRGB.toString('latin1').replace(/\0/g, '').trim().split(/\s+/).map(Number);
    o = { r, g, b, a: Number.isFinite(a) ? a : 1 };
  }
  if (!o || typeof o.r !== 'number') return fallback;
  const h = (v: number | undefined) => Math.round(Math.min(1, Math.max(0, v ?? 0)) * 255).toString(16).padStart(2, '0');
  const alpha = typeof o.a === 'number' && o.a < 0.999 ? h(o.a) : '';
  return ('#' + h(o.r) + h(o.g) + h(o.b) + alpha).toUpperCase();
};

/** 글자색: __CWForegroundColor가 없으면 NSColor / NSForegroundColor 키도 확인 */
const textColorOf = (attrs: Record<string, any> | null | undefined, archive: { value: (v: unknown) => unknown }): string => {
  for (const k of ['__CWForegroundColor', 'NSColor', 'NSForegroundColor']) {
    const v = attrs?.[k];
    if (v) return rgbHex(typeof v === 'object' && 'r' in v ? v : archive.value(v), '#000000');
  }
  return '#000000';
};

/** Sportscode 배경 이미지(zlib 압축된 premultiplied RGBA) → PNG data URL */
function rgbaToPng(width: number, height: number, rgbaZ: Buffer): string {
  const px = inflateSync(rgbaZ);
  const row = width * 4;
  const raw = Buffer.alloc((row + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (row + 1)] = 0; // 필터 없음
    for (let x = 0; x < width; x++) {
      const i = y * row + x * 4;
      const o = y * (row + 1) + 1 + x * 4;
      const a = px[i + 3];
      // premultiplied → 일반 알파
      const un = (v: number) => (a === 0 ? 0 : Math.min(255, Math.round((v * 255) / a)));
      raw[o] = un(px[i]);
      raw[o + 1] = un(px[i + 1]);
      raw[o + 2] = un(px[i + 2]);
      raw[o + 3] = a;
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8비트
  ihdr[9] = 6; // RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return 'data:image/png;base64,' + png.toString('base64');
}

// 따로 모델링해서 읽고 쓰는 키 — 나머지 단순 값은 extra로 보관했다가 그대로 되돌려 씀
export const MODELED_BUTTON_KEYS = new Set([
  'm_codeButtonType', 'm_primaryName', 'm_secondaryName', 'm_frame.cg', 'm_backgroundColor.cw', 'm_nameStringAttributes.cw',
  'm_hasCustomLeadTime', 'm_customLeadTime', 'm_hasLagTime', 'm_lagTime', 'm_showTitle', 'm_hotkey', 'm_scriptData',
  'm_identifier', 'm_backgroundCGImage', 'chart', '$class',
]);
export const MODELED_WINDOW_KEYS = new Set(['m_codeButtons', 'm_codeButtonLinks', 'm_backgroundColor', 'm_rememberedWindowFrame', 'm_defaultLeadTime']);

/** 객체의 단순 값(불리언/숫자/문자열)만 모음. UID로 가리키는 문자열도 풀어서 */
function scalars(a: Archive, obj: Record<string, unknown>, skip: Set<string>): Record<string, boolean | number | string> | undefined {
  const out: Record<string, boolean | number | string> = {};
  for (const [k, raw] of Object.entries(obj)) {
    if (skip.has(k)) continue;
    const v = a.deref(raw);
    if (typeof v === 'boolean' || typeof v === 'number' || (typeof v === 'string' && v !== '$null')) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export function parseCodeWindow(file: Buffer, name: string): CodeWindow {
  const a = new Archive(unwrapCodeWindow(file));
  const top = a.top;
  const defaultLead = Number(a.deref(top.m_defaultLeadTime)) || 0;
  const rawButtons = (a.deref(top.m_codeButtons) as { 'NS.objects': unknown[] })['NS.objects'];
  const idOf = new Map<number, string>();

  const buttons: CWButton[] = rawButtons.map((ref, idx) => {
    const b = a.deref(ref) as Record<string, unknown>;
    const id = `b${idx + 1}`;
    if (isUID(ref)) idOf.set(ref.UID, id);
    const frame = a.value(b['m_frame.cg']) as { X: number; Y: number; Width: number; Height: number };
    const nameAttrs = a.value(b['m_nameStringAttributes.cw']) as Record<string, any> | null;
    const outAttrs = a.value(b['m_outputStringAttributes.cw']) as Record<string, any> | null;

    let hotkey: Hotkey | null = null;
    if (b.m_hotkey && a.className(b.m_hotkey) === 'Hotkey_TD') {
      const ev = a.deref((a.deref(b.m_hotkey) as Record<string, unknown>).m_keyEvent) as Record<string, unknown>;
      const code = MAC_KEYCODES[Number(ev?.NSKeyCode)];
      const f = Number(ev?.NSModifierFlags) || 0;
      // Shift 1<<17, Control 1<<18, Option 1<<19, Command 1<<20 — Control·Command는 둘 다 Ctrl(맥 ⌘)로
      if (code) hotkey = { code, key: codeToKey(code), ...(f & (1 << 17) ? { shift: true } : {}), ...(f & ((1 << 18) | (1 << 20)) ? { mod: true } : {}), ...(f & (1 << 19) ? { alt: true } : {}) };
    }

    let script: string | undefined;
    const sd = a.deref(b.m_scriptData) as Record<string, unknown> | null;
    if (sd && typeof sd === 'object' && 'script_code' in sd) {
      const s = a.value(sd.script_code);
      if (typeof s === 'string' && s.trim()) script = s;
    }

    let bgImage: CWButton['bgImage'];
    const img = a.value(b.m_backgroundCGImage) as { width?: number; height?: number; data?: unknown } | null;
    if (img && img.width && img.height) {
      const d = img.data as Record<string, unknown> | Buffer | null;
      const z = Buffer.isBuffer(d) ? d : d && Buffer.isBuffer(d['NS.data']) ? (d['NS.data'] as Buffer) : null;
      if (z) {
        try {
          bgImage = { width: img.width, height: img.height, rgbaZ: z.toString('base64'), png: rgbaToPng(img.width, img.height, z) };
        } catch {
          /* 알 수 없는 이미지 형식은 건너뜀 */
        }
      }
    }

    const chartObj = b.chart ? (a.deref(b.chart) as Record<string, unknown> | null) : null;
    const chartModel = chartObj && typeof chartObj === 'object' && '$class' in chartObj ? scalars(a, chartObj, new Set(['$class'])) : undefined;

    const kind = KIND[Number(b.m_codeButtonType)] ?? 'text';
    return {
      id,
      kind,
      name: String(a.value(b.m_primaryName) ?? ''),
      group: kind === 'label' ? String(a.value(b.m_secondaryName) ?? '') : '',
      frame: { x: frame.X, y: frame.Y, w: frame.Width, h: frame.Height },
      color: rgbHex(a.value(b['m_backgroundColor.cw']), '#D9D9D9'),
      textColor: textColorOf(nameAttrs, a),
      fontSize: Number(nameAttrs?.__CWFont?.NSFontSizeAttribute) || 12,
      fontName: typeof nameAttrs?.__CWFont?.NSFontNameAttribute === 'string' ? nameAttrs.__CWFont.NSFontNameAttribute : undefined,
      ...(outAttrs
        ? {
            outputColor: textColorOf(outAttrs, a),
            outputFontSize: Number(outAttrs.__CWFont?.NSFontSizeAttribute) || undefined,
            outputFontName: typeof outAttrs.__CWFont?.NSFontNameAttribute === 'string' ? outAttrs.__CWFont.NSFontNameAttribute : undefined,
          }
        : {}),
      hotkey,
      leadTime: b.m_hasCustomLeadTime ? Number(b.m_customLeadTime) || 0 : defaultLead,
      lagTime: b.m_hasLagTime ? Number(b.m_lagTime) || 0 : null,
      showTitle: b.m_showTitle !== false,
      identifier: typeof a.value(b.m_identifier) === 'string' && a.value(b.m_identifier) ? String(a.value(b.m_identifier)) : undefined,
      bgImage,
      // 래그가 꺼진(토글) 버튼도 원본에 저장된 래그 값을 보관 — 인스펙터에서 래그를 다시 켜면 그 값, 저장할 때도 그대로
      extra: { ...scalars(a, b, MODELED_BUTTON_KEYS), ...(!b.m_hasLagTime && typeof b.m_lagTime === 'number' ? { m_lagTime: b.m_lagTime } : {}) },
      chartModel,
      script,
    };
  });

  const rawLinks = (a.deref(top.m_codeButtonLinks) as { 'NS.objects': unknown[] } | null)?.['NS.objects'] ?? [];
  const links: CWLink[] = [];
  for (const ref of rawLinks) {
    const l = a.deref(ref) as Record<string, unknown>;
    const from = isUID(l.m_fromButton) ? idOf.get(l.m_fromButton.UID) : undefined;
    const to = isUID(l.m_toButton) ? idOf.get(l.m_toButton.UID) : undefined;
    const type = LINK[Number(a.deref(l.m_type))];
    if (from && to && type) links.push({ from, to, type });
  }

  const width = Math.max(400, ...buttons.map((b) => b.frame.x + b.frame.w)) + 20;
  const height = Math.max(300, ...buttons.map((b) => b.frame.y + b.frame.h)) + 20;
  return {
    extra: scalars(a, top as Record<string, unknown>, MODELED_WINDOW_KEYS),
    name,
    width,
    height,
    background: rgbHex(a.value(top.m_backgroundColor), '#FFFFFF'),
    buttons,
    links,
  };
}
