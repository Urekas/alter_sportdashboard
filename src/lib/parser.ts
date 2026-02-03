import type { MatchEvent, MatchData, TeamMatchStats, QuarterStats } from './types';

/**
 * 레이블 텍스트에서 "팀명(HOME side) - 팀명(AWAY side)" 패턴을 찾아 홈/어웨이 실제 이름을 확정합니다.
 */
const detectRealTeamNames = (text: string): { home: string, away: string } | null => {
  // "일본(HOME side) 0 - 인도(AWAY side) 0" 또는 "일본 - 인도" 패턴
  const pattern = /([^(]+?)\s*\(\s*HOME\s*side\s*\)\s*\d*\s*-\s*([^(]+?)\s*\(\s*AWAY\s*side\s*\)\s*\d*/i;
  const simplePattern = /([^-]+)\s*-\s*([^-]+)/i;
  
  let match = text.match(pattern);
  if (match) {
    return {
      home: match[1].trim(),
      away: match[2].trim()
    };
  }

  match = text.match(simplePattern);
  if (match && text.includes('side')) {
    return {
      home: match[1].trim(),
      away: match[2].trim()
    };
  }
  
  return null;
};

/**
 * 파이썬 로직: 코드 첫 단어 추출 및 제외 태그 처리.
 * 코드에 HOME/AWAY가 포함되어 있으면 감지된 실제 팀명으로 치환.
 */
const extractTeamName = (code: string, detectedTeams: { home: string, away: string } | null): string => {
  if (!code) return "Unknown";
  const upperCode = code.toUpperCase();

  // 1. HOME/AWAY 키워드 매핑 (감지된 실제 국가명이 있을 경우 최우선)
  if (detectedTeams) {
    if (upperCode.includes("HOME")) return detectedTeams.home;
    if (upperCode.includes("AWAY")) return detectedTeams.away;
  }

  // 2. 파이썬 로직: split(' ')[0]
  const first = code.trim().split(/\s+/)[0];
  const ignoreTags = ["한국빌드업", "한국프레스", "코치님"];
  if (ignoreTags.includes(first)) return "Unknown";
  
  return first;
};

const mapZone = (locStr: string): { x: number, y: number } => {
  const text = locStr.toUpperCase();
  let lane: 'Left' | 'Center' | 'Right' = 'Center';
  if (text.includes('좌') || text.includes('LEFT') || text.includes('L_')) lane = 'Left';
  else if (text.includes('우') || text.includes('RIGHT') || text.includes('R_')) lane = 'Right';

  let x = 45.7; 
  if (text.includes('100')) x = 85;
  else if (text.includes('75')) x = 65;
  else if (text.includes('50')) x = 45;
  else if (text.includes('25')) x = 20;

  let y = 27.5;
  if (lane === 'Left') y = 10;
  else if (lane === 'Right') y = 45;

  return { x, y };
};

export const parseXMLData = (xmlText: string): { events: MatchEvent[], teams: { home: string, away: string } } => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  
  let detectedTeams = detectRealTeamNames(xmlText);
  
  const instances = xmlDoc.getElementsByTagName("instance");
  const events: MatchEvent[] = [];
  const teamCounts: Record<string, number> = {};

  Array.from(instances).forEach((instance, index) => {
    const code = (instance.getElementsByTagName("code")[0]?.textContent || "").trim();
    
    if (!detectedTeams) {
      const labels = instance.getElementsByTagName("label");
      for (let i = 0; i < labels.length; i++) {
        const text = labels[i].getElementsByTagName("text")[0]?.textContent || "";
        detectedTeams = detectRealTeamNames(text);
        if (detectedTeams) break;
      }
    }

    const team = extractTeamName(code, detectedTeams);
    if (team === "Unknown" || !team) return;

    const labels = instance.getElementsByTagName("label");
    let locLabel = "";
    let resultLabel = "";

    for (let i = 0; i < labels.length; i++) {
      const group = (labels[i].getElementsByTagName("group")[0]?.textContent || "").trim();
      const text = (labels[i].getElementsByTagName("text")[0]?.textContent || "").trim();
      if (/지역|Location|Zone/i.test(group)) locLabel += text + " ";
      else if (/결과|Result|Outcome/i.test(group)) resultLabel += text + " ";
    }

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
      type: /foul|파울/i.test(code) ? 'foul' : /턴오버|turnover|TO/i.test(code) ? 'turnover' : 'sequence',
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

  let home = detectedTeams?.home || "";
  let away = detectedTeams?.away || "";

  if (!home || !away) {
    const sortedTeams = Object.keys(teamCounts).sort((a, b) => teamCounts[b] - teamCounts[a]);
    home = sortedTeams[0] || "Home Team";
    away = (sortedTeams[1] === home ? sortedTeams[2] : sortedTeams[1]) || "Away Team";
  }

  return { events, teams: { home, away } };
};

export const parseCSVData = (csvText: string): { events: MatchEvent[], teams: { home: string, away: string } } => {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return { events: [], teams: { home: "", away: "" } };

  const splitCSVLine = (line: string) => {
    return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(item => item.replace(/^"|"$/g, '').trim());
  };

  const headers = splitCSVLine(lines[0]);
  const getCol = (row: string[], colName: string) => {
    const idx = headers.findIndex(h => h.trim().includes(colName));
    return idx > -1 ? row[idx] : "";
  };

  let detectedTeams: { home: string, away: string } | null = null;
  const events: MatchEvent[] = [];
  const teamCounts: Record<string, number> = {};

  // 1단계: 전체 텍스트에서 팀명 패턴 감지
  detectedTeams = detectRealTeamNames(csvText);

  // 2단계: 이벤트 파싱
  for (let i = 1; i < lines.length; i++) {
    const row = splitCSVLine(lines[i]);
    if (row.length < headers.length) continue;

    const code = getCol(row, "Row") || getCol(row, "Code") || "";
    const team = extractTeamName(code, detectedTeams);
    if (team === "Unknown" || !team) continue;

    teamCounts[team] = (teamCounts[team] || 0) + 1;

    const startTime = parseFloat(getCol(row, "Start time") || "0");
    const duration = parseFloat(getCol(row, "Duration") || "0");
    const locLabel = getCol(row, "지역") || getCol(row, "Location") || "";
    const resultLabel = getCol(row, "결과") || getCol(row, "Result") || "";
    const instanceId = getCol(row, "Instance") || `csv-${i}`;

    let quarter = "Q1";
    if (startTime > 2700) quarter = "Q4";
    else if (startTime > 1800) quarter = "Q3";
    else if (startTime > 900) quarter = "Q2";

    const { x, y } = mapZone(locLabel || code);

    events.push({
      id: instanceId,
      team,
      type: /foul|파울/i.test(code) ? 'foul' : /턴오버|turnover|TO/i.test(code) ? 'turnover' : 'sequence',
      quarter,
      time: startTime,
      duration,
      x,
      y,
      locationLabel: locLabel,
      resultLabel: resultLabel,
      code
    });
  }

  let home = detectedTeams?.home || "";
  let away = detectedTeams?.away || "";

  if (!home || !away) {
    const sortedTeams = Object.keys(teamCounts).sort((a, b) => teamCounts[b] - teamCounts[a]);
    home = sortedTeams[0] || "Home Team";
    away = (sortedTeams[1] === home ? sortedTeams[2] : sortedTeams[1]) || "Away Team";
  }

  return { events, teams: { home, away } };
};

export const createMatchDataFromUpload = (events: MatchEvent[], homeName: string, awayName: string): MatchData => {
  const homeTeam = { name: homeName, color: 'hsl(var(--chart-1))' }; 
  const awayTeam = { name: awayName, color: 'hsl(var(--chart-2))' }; 

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
      build25Ratio: buildRows.length > 0 ? (build25Success / buildRows.length) * 100 : 0,
      avgAttackDuration: us.filter(e => e.code.includes('ATT')).length > 0 ? attTime / us.filter(e => e.code.includes('ATT')).length : 0,
      timePerCE: ceCount > 0 ? attTime / ceCount : 0,
      pressAttempts,
      pressSuccess: us_to_75_100 + us_foul_75_100
    };
  };

  const homeStats = calculateTeamStats(homeName, awayName, events);
  const awayStats = calculateTeamStats(awayName, homeName, events);

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
    quarterlyStats: ['Q1', 'Q2', 'Q3', 'Q4'].map(q => {
      const qEvents = events.filter(e => e.quarter === q);
      return {
        quarter: q,
        home: calculateTeamStats(homeName, awayName, qEvents),
        away: calculateTeamStats(awayName, homeName, qEvents)
      };
    })
  };
};