
export const zoneMapping = [
    { zone: 'D', subZone: 'L' }, { zone: 'D', subZone: 'C' }, { zone: 'D', subZone: 'R' },
    { zone: 'M', subZone: 'L' }, { zone: 'M', subZone: 'C' }, { zone: 'M', subZone: 'R' },
    { zone: 'A', subZone: 'L' }, { zone: 'A', subZone: 'C' }, { zone: 'A', subZone: 'R' },
];

export const mapZone = (code: string) => {
    if (!code) return null;
    const parts = code.split('_');
    if (parts.length < 2) return null;
    const zoneMap: { [key: string]: 'D' | 'M' | 'A' } = { 'd': 'D', 'm': 'M', 'a': 'A' };
    const subZoneMap: { [key: string]: 'L' | 'C' | 'R' } = { 'l': 'L', 'c': 'C', 'r': 'R' };
    const zone = zoneMap[parts[0].toLowerCase()];
    const subZone = subZoneMap[parts[1].toLowerCase()];
    if (!zone || !subZone) return null;
    return { zone, subZone };
};

export const flipZone = (zone: 'A' | 'D' | 'M'): 'A' | 'D' | 'M' => {
    if (zone === 'A') return 'D';
    if (zone === 'D') return 'A';
    return 'M';
};

export const flipSubZone = (subZone: 'L' | 'R' | 'C'): 'L' | 'R' | 'C' => {
    if (subZone === 'L') return 'R';
    if (subZone === 'R') return 'L';
    return 'C';
};
