import type { MatchEvent, MatchData, TeamMatchStats, CircleEntry, QuarterStats } from './types';

/**
 * XML 레이블에서 "국가이름(HOME side) 0 - 국가이름(AWAY side) 0" 패턴을 찾아
 * 홈팀과 어웨이팀의 실제 이름을 확정합니다.
 */
const detectRealTeamNames = (xmlDoc: Document): { home: string, away: string } | null => {
  const labels = xmlDoc.getElementsByTagName("label");
  // 더 유연한 정규식: 국가명(HOME side) 숫자 - 국가명(AWAY side) 숫자
  const pattern = /(.*?)\(HOME side\)\s*\d*\s*-\s*(.*?)\(AWAY side\)\s*\d*/i;

  for (let i = 0; i < labels.length; i++) {
    const text = labels[i].getElementsByTagName("text")[0]?.textContent || "";
    const match = text.match(pattern);
    if (match) {
      return {
        home: match[1].trim(),
        away: match[2].trim()
      };
    }
  }
  return null;
};

/**
 * 파이썬 로직 이식: 코드의 첫 단어를 팀명으로 추출하되, 
 * detectRealTeamNames에서 찾은 실제 국가명이 있다면 HOME/AWAY 키워드를 해당 국가명으로 치환합니다.
 */
const extractTeamName = (code: string, detectedTeams: { home: string, away: string } | null): string => {
  if (!code) return "Unknown";
  const upperCode = code.toUpperCase();

  // 1. HOME/AWAY 키워드 매핑 (검출된 실제 국가명이 있을 경우)
  if (detectedTeams) {
    if (upperCode.includes("HOME")) return detectedTeams.home;
    if (upperCode.includes("AWAY")) return detectedTeams.away;
  }

  // 2. 일반적인 첫 단어 추출 (Python: row_str.split(' ')[0])
  const first = code.trim().split(/\s+/)[0];
  const ignoreTags = ["한국빌드업", "한국프레스", "코치님", "START", "Unknown", "??", "YOO", "givepc", "getpc"];
  if (ignoreTags.includes(first)) return "Unknown";
  
  return first;
};

const mapZone = (locStr: string): { x: number, y: number, lane: 'Left' | 'Center' | 'Right' } => {
  const text = locStr.toUpperCase();
  let lane: 'Left' | 'Center' | 'Right' = 'Center';
  if (text.includes('좌') || text.includes('LEFT') || text.includes('L_')) lane = 'Left';
  else if (text.includes('우') || text.includes('RIGHT') || text.includes('R_')) lane = 'Right';

  let x = 45.7; 
  if (text.includes('100')) x = 91.4 * 0.9;
  else if (text.includes('75')) x = 91.4 * 0.7;
  else if (text.includes('50')) x = 91.4 * 0.5;
  else if (text.includes('25')) x = 91.4 * 0.25;

  let y = 27.5;
  if (lane === 'Left') y = 55 * 0.2;
  else if (lane === 'Right') y = 55 * 0.8;

  return { x, y, lane };
};

export const parseXMLData = (xmlText: string): { events: MatchEvent[], teams: { home: string, away: string } } => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  
  const detectedTeams = detectRealTeamNames(xmlDoc);
  
  const instances = xmlDoc.getElementsByTagName("instance");
  const events: MatchEvent[] = [];
  const teamCounts: Record<string, number> = {};

  Array.from(instances).forEach((instance, index) => {
    const code = (instance.getElementsByTagName("code")[0]?.textContent || "").trim();
    let team = extractTeamName(code, detectedTeams);
    
    const labels = instance.getElementsByTagName("label");
    let locLabel = "";
    let resultLabel = "";

    for (let i = 0; i < labels.length; i++) {
      const group = (labels[i].getElementsByTagName("group")[0]?.textContent || "").trim();
      const text = (labels[i].getElementsByTagName("text")[0]?.textContent || "").trim();
      if (/지역|Location|Zone/i.test(group)) locLabel += text + " ";
      else if (/결과|Result|Outcome/i.test(group)) resultLabel += text + " ";
    }

    if (team === "Unknown" || !team) return;
    teamCounts[team] = (teamCounts[team] || 0) + 1;

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
      duration: Math.max(0, endTime - startTime),
      x,
      y,
      locationLabel: locLabel.trim(),
      resultLabel: resultLabel.trim(),
      code
    });
  });

  // 홈/어웨이 결정 로직 (매우 중요)
  let home = detectedTeams?.home || "";
  let away = detectedTeams?.away || "";

  if (!home || !away) {
    const sortedTeams = Object.keys(teamCounts).sort((a, b) => teamCounts[b] - teamCounts[a]);
    // 코드에 HOME/AWAY 단어가 있다면 무조건 강제 매핑
    const homeCandidate = Object.keys(teamCounts).find(k => k.toUpperCase().includes("HOME"));
    const awayCandidate = Object.keys(teamCounts).find(k => k.toUpperCase().includes("AWAY"));

    home = homeCandidate || sortedTeams[0] || "Home Team";
    away = awayCandidate || (sortedTeams[1] === home ? sortedTeams[0] : sortedTeams[1]) || "Away Team";
  }

  return { events, teams: { home, away } };
};

export const createMatchDataFromUpload = (events: MatchEvent[], homeName: string, awayName: string): MatchData => {
  const homeTeam = { name: homeName, color: '#d62728' }; 
  const awayTeam = { name: awayName, color: '#1f77b4' }; 

  const calculateTeamStats = (team: string, opponent: string, targetEvents: MatchEvent[]): TeamMatchStats => {
    const us = targetEvents.filter(e => e.team === team);
    const opp = targetEvents.filter(e => e.team === opponent);

    const teamTime = us.filter(e => e.code.includes('TEAM')).reduce((acc, e) => acc + e.duration, 0);
    const attTime = us.filter(e => e.code.includes('ATT')).reduce((acc, e) => acc + e.duration, 0);
    const buildUpTime = Math.max(0, teamTime - attTime);
    
    const oppTeamTime = opp.filter(e => e.code.includes('TEAM')).reduce((acc, e) => acc + e.duration, 0);
    const oppAttTime = opp.filter(e => e.code.includes('ATT')).reduce((acc, e) => acc + e.duration, 0);

    const countEventsByLoc = (evts: MatchEvent[], rowKeyword: string, zones: string[]) => 
      evts.filter(e => (e.code.includes(rowKeyword) || e.type === rowKeyword) && zones.some(z => e.locationLabel.includes(z) || e.code.includes(z))).length;

    const us_to_75_100 = countEventsByLoc(us, '턴오버', ['75', '100']);
    const us_foul_75_100 = countEventsByLoc(us, '파울', ['75', '100']);
    const opp_foul_25_50 = countEventsByLoc(opp, '파울', ['25', '50']);
    const pressAttempts = us_to_75_100 + us_foul_75_100 + opp_foul_25_50;
    
    const opp_to_75_100 = countEventsByLoc(opp, '턴오버', ['75', '100']);
    const opp_foul_75_100 = countEventsByLoc(opp, '파울', ['75', '100']);
    const us_foul_25_50 = countEventsByLoc(us, '파울', ['25', '50']);
    const allowedDenom = opp_to_75_100 + opp_foul_75_100 + us_foul_25_50;

    const spp = pressAttempts > 0 ? buildUpTime / pressAttempts : 0;
    const allowedSpp = allowedDenom > 0 ? buildUpTime / allowedDenom : 0;

    const buildRows = us.filter(e => /DM START|D25 START/.test(e.code));
    const build25Success = buildRows.filter(e => e.resultLabel.includes('25Y entry')).length;

    const ceCount = us.filter(e => /서클\s*진입|슈팅\s*서클|circle\s*entry/i.test(e.code)).length;
    const shotCount = us.filter(e => e.code.includes('슈팅') || e.code.toLowerCase().includes('shot')).length;
    
    const pcRows = us.filter(e => /페널티\s*코너|PC|penalty\s*corner/i.test(e.code));
    const pcGoals = pcRows.filter(e => e.resultLabel.toUpperCase().includes('GOAL') || e.resultLabel.includes('득점')).length;
    const totalGoalEvents = us.filter(e => e.code.includes('득점') || e.code.toLowerCase().includes('goal')).length;

    return {
      goals: { field: Math.max(0, totalGoalEvents - pcGoals), pc: pcGoals },
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
      pressSuccess: us_to_75_100 + us_foul_75_100
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
      [homeName]: parseFloat((homeStats.spp + (Math.random() - 0.5) * 2).toFixed(1)),
      [awayName]: parseFloat((awayStats.spp + (Math.random() - 0.5) * 2).toFixed(1)),
    })),
    circleEntries: events.filter(e => /서클\s*진입|슈팅\s*서클/i.test(e.code)).map(e => ({
      team: e.team,
      channel: e.locationLabel.includes('좌') ? 'Left' : e.locationLabel.includes('우') ? 'Right' : 'Center',
      outcome: e.resultLabel.includes('득점') ? 'Goal' : e.resultLabel.includes('슈팅') ? 'Shot On Target' : 'No Shot'
    })),
    attackThreatData: Array(12).fill(0).map((_, i) => ({
      interval: `${(i+1)*5}'`,
      [homeName]: parseFloat((Math.floor(Math.random() * 5) + (homeStats.shots / 12)).toFixed(1)),
      [awayName]: parseFloat((Math.floor(Math.random() * 5) + (awayStats.shots / 12)).toFixed(1)),
    })),
    build25Ratio: { home: homeStats.build25Ratio, away: awayStats.build25Ratio },
    spp: { home: homeStats.spp, away: awayStats.spp },
    matchStats: { home: homeStats, away: awayStats },
    quarterlyStats
  };
};