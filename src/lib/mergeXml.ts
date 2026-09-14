'use client';

// 원본 경기 XML(rawSourceText)에 개인 코딩 XML(예: alter_coda/CodaBuilder로 태깅한 개인
// 볼터치 기록)을 시간 보정(오프셋)해서 합칩니다. 둘 다 같은 Sportscode 포맷
// (<file><ALL_INSTANCES><instance>...</instance></ALL_INSTANCES><ROWS>...</ROWS></file>)을
// 쓴다는 전제 — alter_coda의 exportXML.ts, 이 앱의 parser.ts가 읽는 스키마와 동일.
//
// 이 파일은 순수 클라이언트 문자열/DOM 가공만 하고 Firestore는 건드리지 않습니다 —
// 병합 결과는 다운로드 전용이고, 저장은 호출 측(tournament-manager.tsx)에서 필요하면
// personalCodingOffsetSeconds만 별도로 저장합니다(events/matchStats 재계산 없음).

interface RawInstance {
  start: number;
  end: number;
  code: string;
  labelsXml: string; // 원본 <label>...</label> 블록들을 이스케이프까지 마쳐서 재직렬화한 상태
}

interface RawRow {
  code: string;
  r: string;
  g: string;
  b: string;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parseInstances(xmlText: string): RawInstance[] {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  return Array.from(doc.getElementsByTagName('instance')).map((node) => {
    const start = parseFloat(node.getElementsByTagName('start')[0]?.textContent || '0');
    const end = parseFloat(node.getElementsByTagName('end')[0]?.textContent || '0');
    const code = node.getElementsByTagName('code')[0]?.textContent || '';
    const labelsXml = Array.from(node.getElementsByTagName('label')).map((labelNode) => {
      const group = labelNode.getElementsByTagName('group')[0]?.textContent;
      const text = labelNode.getElementsByTagName('text')[0]?.textContent || '';
      const groupLine = group ? `\n        <group>${escapeXml(group)}</group>` : '';
      return `      <label>${groupLine}\n        <text>${escapeXml(text)}</text>\n      </label>`;
    }).join('\n');
    return { start, end, code, labelsXml };
  });
}

function parseRows(xmlText: string): RawRow[] {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  return Array.from(doc.getElementsByTagName('row')).map((node) => ({
    code: node.getElementsByTagName('code')[0]?.textContent || '',
    r: node.getElementsByTagName('R')[0]?.textContent || '0',
    g: node.getElementsByTagName('G')[0]?.textContent || '0',
    b: node.getElementsByTagName('B')[0]?.textContent || '0',
  }));
}

function buildInstanceXml(inst: RawInstance, id: number): string {
  return `    <instance>\n      <ID>${id}</ID>\n      <start>${inst.start}</start>\n      <end>${inst.end}</end>\n      <code>${escapeXml(inst.code)}</code>\n${inst.labelsXml}\n    </instance>`;
}

function buildRowXml(row: RawRow): string {
  return `    <row>\n      <code>${escapeXml(row.code)}</code>\n      <R>${row.r}</R>\n      <G>${row.g}</G>\n      <B>${row.b}</B>\n    </row>`;
}

export interface MergeResult {
  xml: string;
  baseInstanceCount: number;
  overlayInstanceCount: number;
  overlayFirstStart?: number;        // 보정 적용 전, 개인코딩 XML 자체 기준
  overlayFirstStartShifted?: number; // 보정 적용 후, 원본 XML 타임라인 기준
}

/**
 * baseXml(원본 경기 XML)에 overlayXml(개인 코딩 XML)을 offsetSeconds만큼 밀어서 합칩니다.
 * - overlay의 start/end에 offsetSeconds를 더하고 0 미만이면 0으로 clamp.
 * - 전체 instance를 start 기준으로 재정렬한 뒤 ID를 1부터 새로 매김
 *   (원본 ID를 그대로 이어붙이면 두 파일이 각자 1,2,3...으로 시작해 충돌하기 쉬움).
 * - ROWS는 code가 겹치면 원본 쪽을 우선하고, 개인코딩에만 있는 code만 추가.
 * - baseXml이 없으면(원본 파일 없이 등록된 경기) 개인코딩만으로 결과를 만듭니다.
 */
export function mergeSportscodeXml(
  baseXml: string | undefined | null,
  overlayXml: string,
  offsetSeconds: number
): MergeResult {
  const baseInstances = baseXml ? parseInstances(baseXml) : [];
  const baseRows = baseXml ? parseRows(baseXml) : [];
  const overlayInstancesRaw = parseInstances(overlayXml);
  const overlayRows = parseRows(overlayXml);

  const overlayFirstStart = overlayInstancesRaw.length > 0
    ? Math.min(...overlayInstancesRaw.map(i => i.start))
    : undefined;

  const shiftedOverlay = overlayInstancesRaw.map((inst) => ({
    ...inst,
    start: Math.max(0, inst.start + offsetSeconds),
    end: Math.max(0, inst.end + offsetSeconds),
  }));

  const allInstances = [...baseInstances, ...shiftedOverlay].sort((a, b) => a.start - b.start);

  const baseCodes = new Set(baseRows.map(r => r.code));
  const mergedRows = [...baseRows, ...overlayRows.filter(r => !baseCodes.has(r.code))];

  const instancesXml = allInstances.map((inst, i) => buildInstanceXml(inst, i + 1)).join('\n');
  const rowsXml = mergedRows.map(buildRowXml).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<file>\n  <ALL_INSTANCES>\n${instancesXml}\n  </ALL_INSTANCES>\n  <ROWS>\n${rowsXml}\n  </ROWS>\n</file>`;

  return {
    xml,
    baseInstanceCount: baseInstances.length,
    overlayInstanceCount: overlayInstancesRaw.length,
    overlayFirstStart,
    overlayFirstStartShifted: overlayFirstStart !== undefined ? Math.max(0, overlayFirstStart + offsetSeconds) : undefined,
  };
}
