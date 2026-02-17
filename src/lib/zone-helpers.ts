
'use client';

/**
 * @fileOverview 하키 피치 구역 매핑 및 좌표 변환을 위한 도우미 함수들입니다.
 */

export const zoneMapping = [
  { zone: 'D', subZone: 'L' }, { zone: 'D', subZone: 'C' }, { zone: 'D', subZone: 'R' },
  { zone: 'M', subZone: 'L' }, { zone: 'M', subZone: 'C' }, { zone: 'M', subZone: 'R' },
  { zone: 'A', subZone: 'L' }, { zone: 'A', subZone: 'C' }, { zone: 'A', subZone: 'R' },
];

export function mapZone(locStr: string) {
  if (!locStr) return null;
  const text = locStr.toUpperCase().replace('유', '우');
  
  let subZone: 'L' | 'C' | 'R' = 'C';
  if (text.includes('좌') || text.includes('LEFT') || text.startsWith('L_') || text.startsWith('L ')) subZone = 'L';
  else if (text.includes('우') || text.includes('RIGHT') || text.startsWith('R_') || text.startsWith('R ')) subZone = 'R';

  let zone: 'D' | 'M' | 'A' = 'M';
  const zoneMatch = text.match(/(\d+)/);
  const band = zoneMatch ? parseInt(zoneMatch[1]) : 50;

  // 0-25: D, 25-75: M, 75-100: A
  if (band <= 25) zone = 'D';
  else if (band >= 75) zone = 'A';
  else zone = 'M';

  return { zone, subZone };
}

export function flipZone(zone: string): 'D' | 'M' | 'A' {
  if (zone === 'D') return 'A';
  if (zone === 'A') return 'D';
  return 'M';
}

export function flipSubZone(subZone: string): 'L' | 'C' | 'R' {
  if (subZone === 'L') return 'R';
  if (subZone === 'R') return 'L';
  return 'C';
}
