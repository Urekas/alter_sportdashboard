
// TMS(대회 관리 시스템)에서 복사한 라인업 표를 파싱합니다. 사용자가 준 예시 포맷:
//   Italy
//   #	Name	Min	1st	2nd	3rd	4th
//   3	DALLA VITTORIA Teresa	4
//   8	DI PAOLA Eleonora	4			45
//   21	PUGLISI Sara (C)	X
//   32	PASTOR Maria (GK)	46
//   COACH	LANZANO Massimo	0	0	8	0
//   MANAGER	TIDDI Chiara
// 팀 이름 줄은 탭이 없는 한 줄이라는 게 유일하게 확실한 구분 기준이라 그걸로 블록을 나눕니다.
// "1st/2nd/3rd/4th" 칸의 정확한 의미(교체 시각 등으로 추정되지만 TMS 문서 없이는 확정 불가)는
// 임의로 해석하지 않고 원문 그대로 보존해서 표시만 합니다.
import type { TeamLineup, LineupPlayer } from './types';

function stripMarkers(rawName: string): { name: string; isCaptain: boolean; isGoalkeeper: boolean } {
  let name = rawName.trim();
  const isCaptain = /\(C\)/i.test(name);
  const isGoalkeeper = /\(GK\)/i.test(name);
  name = name.replace(/\(C\)/gi, '').replace(/\(GK\)/gi, '').trim();
  return { name, isCaptain, isGoalkeeper };
}

export function parseTmsLineupText(text: string): TeamLineup[] {
  const lines = text.split(/\r?\n/).map(l => l.replace(/\s+$/, ''));
  const blocks: TeamLineup[] = [];
  let current: TeamLineup | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split('\t').map(c => c.trim());

    if (cols.length === 1) {
      // 탭이 없는 한 줄 = 새 팀 이름 (헤더/선수/코치/매니저 행은 전부 탭을 포함함)
      current = { teamName: cols[0], players: [] };
      blocks.push(current);
      continue;
    }

    if (!current) continue; // 팀 이름 줄을 아직 못 만났으면 버림 (형식이 안 맞는 앞머리)

    const first = cols[0];
    if (first === '#') continue; // 헤더 행

    if (/^COACH$/i.test(first)) {
      current.coach = cols[1] || '';
      current.coachStats = cols.slice(2).filter(v => v !== '');
      continue;
    }
    if (/^MANAGER$/i.test(first)) {
      current.manager = cols[1] || '';
      continue;
    }

    if (/^\d+$/.test(first)) {
      const { name, isCaptain, isGoalkeeper } = stripMarkers(cols[1] || '');
      if (!name) continue;
      const player: LineupPlayer = {
        number: first,
        name,
        ...(isCaptain ? { isCaptain: true } : {}),
        ...(isGoalkeeper ? { isGoalkeeper: true } : {}),
        ...(cols[2] ? { minutes: cols[2] } : {}),
      };
      const quarters = [cols[3], cols[4], cols[5], cols[6]].filter(v => v);
      if (quarters.length > 0) player.quarters = quarters;
      current.players.push(player);
    }
  }

  return blocks.filter(b => b.players.length > 0 || b.coach || b.manager);
}
