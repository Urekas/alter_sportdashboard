
'use client';

export const zoneMapping = [
  { zoneBand: 25, lane: 'Left' as const },
  { zoneBand: 25, lane: 'Center' as const },
  { zoneBand: 25, lane: 'Right' as const },
  { zoneBand: 50, lane: 'Left' as const },
  { zoneBand: 50, lane: 'Center' as const },
  { zoneBand: 50, lane: 'Right' as const },
];

export function mapZone(locStr: string) {
  if (!locStr) return null;
  const text = locStr.toUpperCase().replace('유', '우');
  let lane: 'Left' | 'Center' | 'Right' = 'Center';
  if (text.includes('좌') || text.includes('LEFT') || text.startsWith('L_') || text.startsWith('L ')) lane = 'Left';
  else if (text.includes('우') || text.includes('RIGHT') || text.startsWith('R_') || text.startsWith('R ')) lane = 'Right';

  let zoneBand = 50;
  const zoneMatch = text.match(/(\d+)/);
  if (zoneMatch) zoneBand = parseInt(zoneMatch[1]);

  return { lane, zoneBand };
}

export function flipZone(zone: number): number {
  if (zone === 100) return 25;
  if (zone === 75) return 50;
  if (zone === 50) return 75;
  if (zone === 25) return 100;
  return zone;
}

export function flipSubZone(lane: 'Left' | 'Center' | 'Right'): 'Left' | 'Center' | 'Right' {
  if (lane === 'Left') return 'Right';
  if (lane === 'Right') return 'Left';
  return 'Center';
}
