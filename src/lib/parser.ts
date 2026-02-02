
import type { MatchEvent, MatchData, TeamMatchStats, CircleEntry, QuarterStats } from './types';

const PITCH_LENGTH = 91.4;
const PITCH_WIDTH = 55;

// 파이썬 extract_team 로직
const extractTeamName = (code: string): string => {
  if (!code) return "Unknown";
  const first = code.split(' ')[0];
  const ignoreTags = ["한국빌드업", "한국프레스", "코치님", "START", "Unknown", "??", "YOO"];
  if (ignoreTags.includes(first)) return "Unknown";
  return first;
};

// 파이썬 check_location 기반 구역 매핑
const mapZone = (locStr: string): { x: number, y: number, lane: 'Left' | 'Center' | 'Right' } => {
  const text = locStr.toUpperCase();
  let lane: 'Left' | 'Center' | 'Right' = 'Center';
  if (text.includes('좌') || text.includes('LEFT') || text.includes('L_')) lane = 'Left';
  else if (text.includes('우') || text.includes('RIGHT') || text.includes('R_')) lane = 'Right';

  let x = PITCH_LENGTH * 0.5;
  if (text.includes('100')) x = PITCH_LENGTH * 0.9;
  else if (text.includes('75')) x = PITCH_LENGTH * 0.7;
  else if (text.includes('50')) x = PITCH_LENGTH * 0.5;
  else if (text.includes('25')) x = PITCH_LENGTH * 0.25;

  let y = PITCH_WIDTH * 0.5;
  if (lane === 'Left') y = PITCH_WIDTH * 0.2;
  else if (lane === 'Right') y = PITCH_WIDTH * 0.8;

  return { x, y, lane };
};

export const parseXMLData = (xmlText: string): { events: MatchEvent[], teams: { home: string, away: string } } => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  const instances = xmlDoc.getElementsByTagName("instance");
  const events: MatchEvent[] = [];
  const teamCounts: Record<string, number> = {};

  Array.from(instances).forEach((instance, index) => {
    const code = instance.getElementsByTagName("code")[0]?.textContent || "";
    const team = extractTeamName(code);
    if (team === "Unknown") return;

    teamCounts[team] = (teamCounts[team] || 0) + 1;

    const labels = instance.getElementsByTagName("label");
    let locLabel = "";
    let resultLabel = "";

    for (let i = 0; i < labels.length; i++) {
      const group = labels[i].getElementsByTagName("group")[0]?.textContent || "";
      const text = labels[i].getElementsByTagName("text")[0]?.textContent || "";
      if (/지역|Location|Zone/i.test(group)) locLabel += text + " ";
      else if (/결과|Result|Outcome/i.test(group)) resultLabel += text + " ";
    }

    const startTime = parseFloat(instance.getElementsByTagName("start")[0]?.textContent || "0");
    const endTime = parseFloat(instance.getElementsByTagName("end")[0]?.textContent || "0");
    
    let quarter = "Q1";
    if (startTime > 2700) quarter = "Q4";
    else if (startTime > 1800) quarter = "Q3";
    else if (startTime > 900) quarter = "Q2";

    const { x, y } = mapZone(locLabel || code);

    events.push({
      id: instance.getElementsByTagName("ID")[0]?.textContent || `evt-${index}`,
      team,
      type: /foul|파울/i.test(code) ? 'foul' : /턴오버|turnover/i.test(code) ? 'turnover' : 'sequence',
      quarter,
      time: startTime,
      duration: endTime - startTime,
      x,
      y,
      locationLabel: locLabel.trim(),
      resultLabel: resultLabel.trim(),
      code
    });
  });

  const sortedTeams = Object.keys(teamCounts).sort((a, b) => teamCounts[b] - teamCounts[a]);
  let home = sortedTeams[0] || "Japan";
  let away = sortedTeams[1] || "India";

  // 선호 국가명 우선 정렬 (일본 vs 인도)
  const preferred = ["일본", "Japan", "인도", "India"];
  const detectedPreferred = preferred.filter(p => sortedTeams.includes(p));
  if (detectedPreferred.length >= 2) {
    home = detectedPreferred[0];
    away = detectedPreferred[1];
  }

  return { events, teams: { home, away } };
};

export const createMatchDataFromUpload = (events: MatchEvent[], homeName: string, awayName: string): MatchData => {
  const homeTeam = { name: homeName, color: '#d62728' }; // 일본: 빨강
  const awayTeam = { name: awayName, color: '#1f77b4' }; // 인도: 파랑

  const calculateTeamStats = (team: string, opponent: string, targetEvents: MatchEvent[]): TeamMatchStats => {
    const us = targetEvents.filter(e => e.team === team);
    const opp = targetEvents.filter(e => e.team === opponent);

    // 1. 시간 계산 (TEAM vs ATT)
    const teamTime = us.filter(e => e.code.includes('TEAM')).reduce((acc, e) => acc + e.duration, 0);
    const attTime = us.filter(e => e.code.includes('ATT')).reduce((acc, e) => acc + e.duration, 0);
    const buildUpTime = teamTime - attTime;
    
    const oppTeamTime = opp.filter(e => e.code.includes('TEAM')).reduce((acc, e) => acc + e.duration, 0);
    const oppAttTime = opp.filter(e => e.code.includes('ATT')).reduce((acc, e) => acc + e.duration, 0);

    // 2. 압박 지표 (compute_press_metrics)
    const countPress = (evts: MatchEvent[], teamName: string, zones: string[]) => 
      evts.filter(e => e.team === teamName && (e.code.includes('턴오버') || e.code.includes('파울')) && zones.some(z => e.locationLabel.includes(z))).length;
    
    const countOppFoul = (evts: MatchEvent[], teamName: string, zones: string[]) =>
      evts.filter(e => e.team !== teamName && e.code.includes('파울') && zones.some(z => e.locationLabel.includes(z))).length;

    const pressAttempts = countPress(us, team, ['75', '100']) + countOppFoul(opp, team, ['25', '50']);
    const allowedPressAttempts = countPress(opp, opponent, ['75', '100']) + countOppFoul(us, opponent, ['25', '50']);

    const spp = pressAttempts > 0 ? buildUpTime / pressAttempts : 0;
    const allowedSpp = allowedPressAttempts > 0 ? buildUpTime / allowedPressAttempts : 0;

    // 3. Build25 성공률
    const buildRows = us.filter(e => /DM START|D25 START/.test(e.code));
    const build25Success = buildRows.filter(e => e.resultLabel.includes('25Y entry')).length;

    // 4. 이벤트 카운트
    const ceCount = us.filter(e => /서클\s*진입|슈팅\s*서클|circle\s*entry|attack\s*circle/i.test(e.code)).length;
    const shotCount = us.filter(e => e.code.endsWith('슈팅') || e.code.endsWith('shot')).length;
    const pcCount = us.filter(e => /페널티\s*코너|penalty\s*corner|PC/i.test(e.code)).length;
    
    const totalGoals = us.filter(e => e.code.includes('득점') || e.code.includes('goal')).length;
    const pcGoals = us.filter(e => /페널티\s*코너|PC/i.test(e.code) && (e.resultLabel.includes('GOAL') || e.resultLabel.includes('득점'))).length;

    return {
      goals: { field: Math.max(0, totalGoals - pcGoals), pc: pcGoals },
      shots: shotCount,
      circleEntries: ceCount,
      twentyFiveEntries: us.filter(e => e.code.includes('A25 START')).length,
      possession: (teamTime / (teamTime + oppTeamTime)) * 100 || 0,
      attackPossession: (attTime / (attTime + oppAttTime)) * 100 || 0,
      spp,
      allowedSpp,
      build25Ratio: buildRows.length > 0 ? build25Success / buildRows.length : 0,
      avgAttackDuration: us.filter(e => e.code.includes('ATT')).length > 0 ? attTime / us.filter(e => e.code.includes('ATT')).length : 0,
      timePerCE: ceCount > 0 ? attTime / ceCount : 0,
      pressAttempts,
      pressSuccess: countPress(us, team, ['75', '100'])
    };
  };

  const homeStats = calculateTeamStats(homeName, awayName, events);
  const awayStats = calculateTeamStats(awayName, homeName, events);

  const quarterlyStats: QuarterStats[] = ['Q1', 'Q2', 'Q3', 'Q4'].map(q => {
    const qEvents = events.filter(e => e.quarter === q);
    return {
      quarter: q,
      home: calculateTeamStats(homeName, awayName, qEvents),
      away: calculateTeamStats(awayName, homeName, qEvents)
    };
  });

  return {
    homeTeam,
    awayTeam,
    events,
    pressureData: Array(20).fill(0).map((_, i) => ({
      interval: `${(i+1)*3}'`,
      [homeName]: homeStats.spp + (Math.random() - 0.5) * 2,
      [awayName]: awayStats.spp + (Math.random() - 0.5) * 2,
    })),
    circleEntries: events.filter(e => /서클\s*진입|슈팅\s*서클/i.test(e.code)).map(e => ({
      team: e.team,
      channel: e.locationLabel.includes('좌') ? 'Left' : e.locationLabel.includes('우') ? 'Right' : 'Center',
      outcome: e.resultLabel.includes('득점') ? 'Goal' : e.resultLabel.includes('슈팅') ? 'Shot On Target' : 'No Shot'
    })),
    attackThreatData: Array(12).fill(0).map((_, i) => ({
      interval: `${(i+1)*5}'`,
      [homeName]: Math.floor(Math.random() * 5) + (homeStats.shots / 12),
      [awayName]: Math.floor(Math.random() * 5) + (awayStats.shots / 12),
    })),
    build25Ratio: { home: homeStats.build25Ratio, away: awayStats.build25Ratio },
    spp: { home: homeStats.spp, away: awayStats.spp },
    matchStats: { home: homeStats, away: awayStats },
    quarterlyStats
  };
};
