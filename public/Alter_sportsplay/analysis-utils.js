/**
 * analysis-utils.js
 * 
 * Ported from src/lib/parser.ts to provide consistent statistics calculation
 * between the Next.js Dashboard and the Vanilla JS Video Analysis tool.
 */

export const mapZone = (locStr) => {
  const text = locStr.toUpperCase().replace('유', '우');
  let lane = 'Center';
  if (text.includes('좌') || text.includes('LEFT') || text.startsWith('L_') || text.startsWith('L ')) lane = 'Left';
  else if (text.includes('우') || text.includes('RIGHT') || text.startsWith('R_') || text.startsWith('R ')) lane = 'Right';

  let zoneBand = 50;
  const zoneMatch = text.match(/(\d+)/);
  if (zoneMatch) zoneBand = parseInt(zoneMatch[1]);

  let x = 45.7;
  if (zoneBand === 25) x = 11.5;
  else if (zoneBand === 50) x = 34.5;
  else if (zoneBand === 75) x = 56.9;
  else if (zoneBand === 100) x = 79.9;

  let y = 27.5;
  if (lane === 'Left') y = 9.2;
  else if (lane === 'Right') y = 45.8;

  return { x, y, lane, zoneBand };
};

export const detectQuarter = (ungroupedText, startTime) => {
  const text = (ungroupedText || "").toUpperCase();
  if (text.includes('0쿼터')) return 'Q1';
  if (text.includes('1쿼터') || text.includes('1Q')) return 'Q1';
  if (text.includes('2쿼터') || text.includes('2Q')) return 'Q2';
  if (text.includes('3쿼터') || text.includes('3Q')) return 'Q3';
  if (text.includes('4쿼터') || text.includes('4Q')) return 'Q4';
  if (startTime >= 2700) return "Q4";
  if (startTime >= 1800) return "Q3";
  if (startTime >= 900) return "Q2";
  return "Q1";
};

export function calculateTeamStats(team, opponent, targetEvents) {
    const myEvents = targetEvents.filter(e => e.team === team);
    const oppEvents = targetEvents.filter(e => e.team === opponent);
    
    const teamTime = myEvents.filter(e => e.code.trim() === `${team} TEAM`).reduce((acc, e) => acc + e.duration, 0);
    const attTime = myEvents.filter(e => e.code.trim() === `${team} ATT`).reduce((acc, e) => acc + e.duration, 0);
    const oppTeamTime = oppEvents.filter(e => e.code.trim() === `${opponent} TEAM`).reduce((acc, e) => acc + e.duration, 0);
    const oppAttTime = oppEvents.filter(e => e.code.trim() === `${opponent} ATT`).reduce((acc, e) => acc + e.duration, 0);
    const oppBuildUpTime = Math.max(0, oppTeamTime - oppAttTime);
    
    const shotCount = myEvents.filter(e => e.code.trim() === `${team} 슈팅`).length;
    const ceCount = myEvents.filter(e => e.code.trim() === `${team} 슈팅서클 진입`).length;
    const pcEvents = myEvents.filter(e => e.code.trim() === `${team} 페널티코너`);
    const a25Count = myEvents.filter(e => e.code.trim() === `${team} A25 START`).length;
    const goalEvents = myEvents.filter(e => e.code.trim() === `${team} 득점`);

    const buildUpStagnation = teamTime > 0 ? ((teamTime - attTime) / teamTime) * 100 : 0;

    const getZoneCount = (evts, types, zones) => evts.filter(e => {
      const zone = mapZone(e.locationLabel || e.code).zoneBand;
      const isTargetType = types.some(t => e.type === t || e.code.includes(t));
      return isTargetType && zones.includes(zone);
    }).length;

    const press_attempts = getZoneCount(oppEvents, ["turnover", "foul"], [75, 100]) + getZoneCount(myEvents, ["foul"], [25, 50]);
    const press_success = getZoneCount(oppEvents, ["turnover", "foul"], [75, 100]);
    
    const spp = press_attempts > 0 ? oppBuildUpTime / press_attempts : 0;
    const timePerCE = ceCount > 0 ? teamTime / ceCount : 0;
    const buildAttempts = myEvents.filter(e => e.code.trim() === `${team} TEAM` && mapZone(e.locationLabel || e.code).zoneBand <= 50).length;
    const build25Ratio = buildAttempts > 0 ? (a25Count / buildAttempts) * 100 : 0;
    const pcGoals = pcEvents.filter(e => {
        const res = (e.resultLabel || "").toUpperCase();
        return res.includes('GOAL') || res.includes('득점');
    }).length;

    return {
      goals: { field: Math.max(0, goalEvents.length - pcGoals), pc: pcGoals },
      shots: shotCount, pcs: pcEvents.length, circleEntries: ceCount, twentyFiveEntries: a25Count,
      possession: (teamTime + oppTeamTime) > 0 ? (teamTime / (teamTime + oppTeamTime)) * 100 : 0,
      attackPossession: (attTime + oppAttTime) > 0 ? (attTime / (attTime + oppAttTime)) * 100 : 0,
      buildUpStagnation: buildUpStagnation,
      pcSuccessRate: pcEvents.length > 0 ? (pcGoals / pcEvents.length) * 100 : 0,
      spp: parseFloat(spp.toFixed(1)), allowedSpp: 0, build25Ratio: Math.min(100, build25Ratio), avgAttackDuration: 0,
      timePerCE: parseFloat(timePerCE.toFixed(1)), pressAttempts: press_attempts, pressSuccess: press_success
    };
}

export function createMatchDataForDashboard(events, homeName, awayName, tournamentId, matchName) {
  const homeColor = "#0066ff";
  const awayColor = "#ef4444";
  const quartersList = ['Q1', 'Q2', 'Q3', 'Q4'];
  
  // Calculate normalized times and quarterly boundaries
  const qMap = quartersList.map((q, idx) => {
    const qEvents = events.filter(e => e.quarter === q);
    if (qEvents.length === 0) return { q, min: idx * 900, max: (idx + 1) * 900, duration: 900 };
    const min = Math.min(...qEvents.map(e => e.time));
    const max = Math.max(...qEvents.map(e => e.time + e.duration));
    return { q, min, max, duration: Math.max(1, max - min) };
  });

  const getNormalizedTime = (e) => {
    const info = qMap.find(item => item.q === e.quarter) || qMap[0];
    const qOffset = quartersList.indexOf(e.quarter) * 900;
    const relativePos = info.duration > 0 ? (e.time - info.min) / info.duration : 0;
    return qOffset + (relativePos * 900);
  };

  return {
    tournamentId,
    tournamentName: "", // Will be filled or linked
    matchName,
    homeTeam: { name: homeName, color: homeColor },
    awayTeam: { name: awayName, color: awayColor },
    events: events.map(e => ({ ...e, type: e.type || 'sequence' })),
    pressureData: Array(20).fill(0).map((_, i) => {
      const start = i * 180, end = (i + 1) * 180;
      const pEvents = events.filter(e => { const nt = getNormalizedTime(e); return nt >= start && nt < end; });
      return { interval: `${(i + 1) * 3}'`, [homeName]: calculateTeamStats(homeName, awayName, pEvents).spp, [awayName]: calculateTeamStats(awayName, homeName, pEvents).spp };
    }),
    circleEntries: events.filter(e => e.code.trim() === `${homeName} 슈팅서클 진입` || e.code.trim() === `${awayName} 슈팅서클 진입`).map(e => {
      const res = (e.resultLabel || "").toUpperCase();
      const isS = res.includes('PC') || res.includes('SHOT') || res.includes('득점') || res.includes('슈팅') || res.includes('GOAL');
      return { team: e.team, channel: /좌|LEFT/i.test(e.locationLabel) ? 'Left' : /우|RIGHT/i.test(e.locationLabel) ? 'Right' : 'Center', outcome: isS ? 'Shot On Target' : 'No Shot' };
    }),
    attackThreatData: Array(12).fill(0).map((_, i) => {
      const s = i * 300, e_ = (i + 1) * 300;
      const filterT = (t) => events.filter(e => {
        const nt = getNormalizedTime(e); 
        return e.team === t && nt >= s && nt < e_ && (e.code.trim() === `${t} 슈팅` || e.code.trim() === `${t} 페널티코너`);
      }).length;
      return { interval: `${(i + 1) * 5}'`, [homeName]: filterT(homeName), [awayName]: filterT(awayName) };
    }),
    build25Ratio: { home: calculateTeamStats(homeName, awayName, events).build25Ratio, away: calculateTeamStats(awayName, homeName, events).build25Ratio },
    spp: { home: calculateTeamStats(homeName, awayName, events).spp, away: calculateTeamStats(awayName, homeName, events).spp },
    matchStats: { home: calculateTeamStats(homeName, awayName, events), away: calculateTeamStats(awayName, homeName, events) },
    quarterlyStats: quartersList.map(q => ({ quarter: q, home: calculateTeamStats(homeName, awayName, events.filter(e => e.quarter === q)), away: calculateTeamStats(awayName, homeName, events.filter(e => e.quarter === q)) }))
  };
}
