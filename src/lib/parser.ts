
import type { MatchEvent, MatchData, TeamMatchStats, QuarterStats } from './types';

/**
 * 레이블 텍스트에서 "팀명(HOME side) - 팀명(AWAY side)" 패턴을 찾아 홈/어웨이 실제 이름을 확정합니다.
 */
const detectRealTeamNames = (text: string): { home: string, away: string } | null => {
  const pattern = /([^(]+?)\s*\(\s*HOME\s*side\s*\)\s*\d*\s*-\s*([^(]+?)\s*\(\s*AWAY\s*side\s*\)\s*\d*/i;
  const simplePattern = /([^-]+)\s*-\s*([^-]+)/i;
  
  let match = text.match(pattern);
  if (match) return { home: match[1].trim(), away: match[2].trim() };

  match = text.match(simplePattern);
  if (match && text.includes('side')) {
    return { home: match[1].trim(), away: match[2].trim() };
  }
  
  return null;
};

/**
 * Row 필드의 첫 단어를 팀명으로 지정 (형님의 파이썬 로직)
 */
const extractTeamName = (code: string, detectedTeams: { home: string, away: string } | null): string => {
  if (!code) return "Unknown";
  const upperCode = code.toUpperCase();

  if (detectedTeams) {
    if (upperCode.includes("HOME")) return detectedTeams.home;
    if (upperCode.includes("AWAY")) return detectedTeams.away;
  }

  const first = code.trim().split(/\s+/)[0];
  const ignoreTags = ["한국빌드업", "한국프레스", "코치님"];
  if (ignoreTags.includes(first)) return "Unknown";
  
  return first;
};

/**
 * Lane: '좌'->Left, '중'->Center, '우'->Right
 * Zone_Band: 25, 50, 75, 100
 */
const mapZone = (locStr: string): { x: number, y: number, lane: 'Left' | 'Center' | 'Right', zoneBand: number } => {
  const text = locStr.toUpperCase();
  let lane: 'Left' | 'Center' | 'Right' = 'Center';
  if (text.includes('좌') || text.includes('LEFT') || text.includes('L_')) lane = 'Left';
  else if (text.includes('우') || text.includes('RIGHT') || text.includes('R_')) lane = 'Right';

  let zoneBand = 50;
  if (text.includes('100')) zoneBand = 100;
  else if (text.includes('75')) zoneBand = 75;
  else if (text.includes('50')) zoneBand = 50;
  else if (text.includes('25')) zoneBand = 25;

  // 시각화 좌표 매핑 (0~91.4, 0~55)
  // 공격 방향 기준 (좌측에서 우측으로 공격한다고 가정)
  let x = 45.7;
  if (zoneBand === 25) x = 11.5;
  else if (zoneBand === 50) x = 34.5;
  else if (zoneBand === 75) x = 57.5;
  else if (zoneBand === 100) x = 80.5;

  let y = 27.5;
  if (lane === 'Left') y = 9.1;
  else if (lane === 'Right') y = 45.9;

  return { x, y, lane, zoneBand };
};

const detectQuarter = (text: string, startTime: number): string => {
  if (text.includes('1쿼터') || text.includes('1Q')) return 'Q1';
  if (text.includes('2쿼터') || text.includes('2Q')) return 'Q2';
  if (text.includes('3쿼터') || text.includes('3Q')) return 'Q3';
  if (text.includes('4쿼터') || text.includes('4Q')) return 'Q4';
  
  if (startTime > 2700) return "Q4";
  else if (startTime > 1800) return "Q3";
  else if (startTime > 900) return "Q2";
  return "Q1";
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
    const labels = instance.getElementsByTagName("label");
    let locLabel = "";
    let resultLabel = "";
    let ungroupedText = "";

    for (let i = 0; i < labels.length; i++) {
      const group = (labels[i].getElementsByTagName("group")[0]?.textContent || "").trim();
      const text = (labels[i].getElementsByTagName("text")[0]?.textContent || "").trim();
      if (/지역|Location|Zone/i.test(group)) locLabel += text + " ";
      else if (/결과|Result|Outcome/i.test(group)) resultLabel += text + " ";
      else ungroupedText += text + " ";
      
      if (!detectedTeams) detectedTeams = detectRealTeamNames(text);
    }

    const team = extractTeamName(code, detectedTeams);
    if (team === "Unknown" || !team) return;

    teamCounts[team] = (teamCounts[team] || 0) + 1;
    const startTime = parseFloat(instance.getElementsByTagName("start")[0]?.textContent || "0");
    const endTime = parseFloat(instance.getElementsByTagName("end")[0]?.textContent || "0");
    const quarter = detectQuarter(ungroupedText + locLabel + code, startTime);
    const zoneInfo = mapZone(locLabel || code);

    events.push({
      id: instance.getElementsByTagName("ID")[0]?.textContent || `evt-${index}`,
      team,
      type: /foul|파울/i.test(code) ? 'foul' : /턴오버|turnover|TO/i.test(code) ? 'turnover' : 'sequence',
      quarter,
      time: startTime,
      duration: Math.max(0, endTime - startTime),
      x: zoneInfo.x,
      y: zoneInfo.y,
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
    away = sortedTeams[1] || "Away Team";
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
  const getCol = (row: string[], colNames: string[]) => {
    const idx = headers.findIndex(h => colNames.some(name => h.trim().includes(name)));
    return idx > -1 ? row[idx] : "";
  };

  let detectedTeams = detectRealTeamNames(csvText);
  const events: MatchEvent[] = [];
  const teamCounts: Record<string, number> = {};

  for (let i = 1; i < lines.length; i++) {
    const row = splitCSVLine(lines[i]);
    if (row.length < headers.length) continue;

    const code = getCol(row, ["Row", "Code", "Timeline"]) || "";
    const team = extractTeamName(code, detectedTeams);
    if (team === "Unknown" || !team) continue;

    teamCounts[team] = (teamCounts[team] || 0) + 1;
    const startTime = parseFloat(getCol(row, ["Start time"]) || "0");
    const duration = parseFloat(getCol(row, ["Duration"]) || "0");
    const locLabel = getCol(row, ["지역", "Location"]) || "";
    const resultLabel = getCol(row, ["결과", "Result"]) || "";
    const ungrouped = getCol(row, ["Ungrouped"]) || "";
    const instanceId = getCol(row, ["Instance"]) || `csv-${i}`;

    const quarter = detectQuarter(ungrouped + locLabel + code, startTime);
    const zoneInfo = mapZone(locLabel || code);

    events.push({
      id: instanceId,
      team,
      type: /foul|파울/i.test(code) ? 'foul' : /턴오버|turnover|TO/i.test(code) ? 'turnover' : 'sequence',
      quarter,
      time: startTime,
      duration,
      x: zoneInfo.x,
      y: zoneInfo.y,
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
    away = sortedTeams[1] || "Away Team";
  }

  return { events, teams: { home, away } };
};

export const createMatchDataFromUpload = (events: MatchEvent[], homeName: string, awayName: string): MatchData => {
  const homeTeam = { name: homeName, color: 'hsl(var(--chart-1))' }; 
  const awayTeam = { name: awayName, color: 'hsl(var(--chart-2))' }; 

  const calculateTeamStats = (team: string, opponent: string, targetEvents: MatchEvent[]): TeamMatchStats => {
    const us = targetEvents.filter(e => e.team === team);
    const opp = targetEvents.filter(e => e.team === opponent);

    const teamTotalTime = us.reduce((acc, e) => acc + e.duration, 0);
    const oppTotalTime = opp.reduce((acc, e) => acc + e.duration, 0);

    // 2. 공격 지역 점유율 (Attack Possession)
    // Row LIKE '%A25%' OR Row LIKE '%AM%'
    const attTime = us.filter(e => e.code.includes('A25') || e.code.includes('AM')).reduce((acc, e) => acc + e.duration, 0);
    const oppAttTime = opp.filter(e => e.code.includes('A25') || e.code.includes('AM')).reduce((acc, e) => acc + e.duration, 0);
    const attackPossession = (attTime + oppAttTime) > 0 ? (attTime / (attTime + oppAttTime)) * 100 : 0;

    // 4. SPP (압박 대응 효율)
    // 빌드업 지역(DM, D25) 유지 시간 / 해당 지역 내 (턴오버 + 파울)
    const buildUpTime = us.filter(e => e.code.includes('DM') || e.code.includes('D25')).reduce((acc, e) => acc + e.duration, 0);
    const buildUpLosses = us.filter(e => (e.code.includes('DM') || e.code.includes('D25')) && (e.type === 'turnover' || e.type === 'foul')).length;
    const spp = buildUpLosses > 0 ? buildUpTime / buildUpLosses : buildUpTime; // 손실이 없으면 전체 빌드업 시간이 곧 효율

    // 3. 압박 강도 분석 (Press Attempt)
    // 75, 100 구역에서의 우리 팀 턴오버/파울 + 25, 50 구역에서의 상대 팀 파울
    const getZoneBand = (loc: string, code: string) => {
      if (loc.includes('100') || code.includes('100')) return 100;
      if (loc.includes('75') || code.includes('75')) return 75;
      if (loc.includes('50') || code.includes('50')) return 50;
      if (loc.includes('25') || code.includes('25')) return 25;
      return 0;
    };

    const pressAttempts = us.filter(e => {
      const zb = getZoneBand(e.locationLabel, e.code);
      return (zb >= 75 && (e.type === 'turnover' || e.type === 'foul'));
    }).length + opp.filter(e => {
      const zb = getZoneBand(e.locationLabel, e.code);
      return (zb <= 50 && e.type === 'foul');
    }).length;

    // 빌드업 성공률 (DM/D25 -> 25Y entry)
    const buildRows = us.filter(e => e.code.includes('DM START') || e.code.includes('D25 START'));
    const buildSuccess = buildRows.filter(e => e.resultLabel.includes('25Y entry')).length;

    // 서클 진입 및 슈팅
    const ceCount = us.filter(e => e.code.toLowerCase().includes('circle entry') || e.code.includes('서클 진입')).length;
    const shotCount = us.filter(e => e.code.toLowerCase().includes('shot') || e.code.includes('슈팅')).length;
    
    // 득점 (필드/PC)
    const pcRows = us.filter(e => e.code.includes('PC') || e.code.includes('페널티 코너'));
    const pcGoals = pcRows.filter(e => e.resultLabel.toLowerCase().includes('goal') || e.resultLabel.includes('득점')).length;
    const totalGoals = us.filter(e => e.code.toLowerCase().includes('goal') || e.code.includes('득점')).length;

    return {
      goals: { field: Math.max(0, totalGoals - pcGoals), pc: pcGoals },
      shots: shotCount,
      circleEntries: ceCount,
      twentyFiveEntries: us.filter(e => e.code.includes('A25 START')).length,
      possession: (teamTotalTime + oppTotalTime) > 0 ? (teamTotalTime / (teamTotalTime + oppTotalTime)) * 100 : 0,
      attackPossession,
      spp,
      allowedSpp: 0, // 상대 데이터 기반 계산 필요 시 추가
      build25Ratio: buildRows.length > 0 ? (buildSuccess / buildRows.length) * 100 : 0,
      avgAttackDuration: us.filter(e => e.code.includes('ATT')).length > 0 ? attTime / us.filter(e => e.code.includes('ATT')).length : 0,
      timePerCE: ceCount > 0 ? attTime / ceCount : 0,
      pressAttempts,
      pressSuccess: us.filter(e => e.type === 'turnover' && getZoneBand(e.locationLabel, e.code) >= 75).length // 예시 성공 지표
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
    circleEntries: events.filter(e => e.code.toLowerCase().includes('circle entry') || e.code.includes('서클 진입')).map(e => ({
      team: e.team,
      channel: e.locationLabel.includes('좌') ? 'Left' : e.locationLabel.includes('우') ? 'Right' : 'Center',
      outcome: e.resultLabel.includes('득점') || e.resultLabel.toLowerCase().includes('goal') ? 'Goal' : 'No Shot'
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
