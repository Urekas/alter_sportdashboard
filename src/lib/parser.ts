
import type { MatchEvent, MatchData, TeamMatchStats, QuarterStats } from './types';

/**
 * 레이블에서 "국가명(HOME side) 0 - 국가명(AWAY side) 0" 패턴을 찾아 홈/어웨이 이름을 확정합니다.
 * 앞에 있는 국가가 홈, 뒤에 있는 국가가 어웨이입니다.
 */
const detectRealTeamNames = (text: string): { home: string, away: string } | null => {
  const pattern = /([^(]+?)\s*\(\s*HOME\s*side\s*\)\s*\d*\s*-\s*([^(]+?)\s*\(\s*AWAY\s*side\s*\)\s*\d*/i;
  const match = text.match(pattern);
  if (match) {
    return { 
      home: match[1].trim(), 
      away: match[2].trim() 
    };
  }
  return null;
};

/**
 * Row 필드의 첫 단어를 팀명으로 지정.
 * 단, "HOME" 또는 "AWAY" 키워드가 포함된 경우 감지된 실제 팀명으로 매핑.
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
 * 지역 컬럼(예: '좌_75', '중_25') 분리
 * Lane: '좌'->Left, '중'->Center, '우'->Right
 * Zone_Band: 25, 50, 75, 100
 */
const mapZone = (locStr: string): { x: number, y: number, lane: 'Left' | 'Center' | 'Right', zoneBand: number } => {
  const text = locStr.toUpperCase();
  let lane: 'Left' | 'Center' | 'Right' = 'Center';
  if (text.includes('좌') || text.includes('LEFT') || text.startsWith('L_')) lane = 'Left';
  else if (text.includes('우') || text.includes('RIGHT') || text.startsWith('R_')) lane = 'Right';

  let zoneBand = 50;
  const zoneMatch = text.match(/(\d+)/);
  if (zoneMatch) {
    zoneBand = parseInt(zoneMatch[1]);
  }

  // 필드 크기 91.4 x 55 기준 좌표 매핑 (공격 방향: 좌->우)
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

const detectQuarter = (text: string, startTime: number): string => {
  if (text.includes('1쿼터') || text.includes('1Q')) return 'Q1';
  if (text.includes('2쿼터') || text.includes('2Q')) return 'Q2';
  if (text.includes('3쿼터') || text.includes('3Q')) return 'Q3';
  if (text.includes('4쿼터') || text.includes('4Q')) return 'Q4';
  
  // 시간 기반 백업 (15분씩)
  if (startTime >= 2700) return "Q4";
  if (startTime >= 1800) return "Q3";
  if (startTime >= 900) return "Q2";
  return "Q1";
};

export const parseXMLData = (xmlText: string): { events: MatchEvent[], teams: { home: string, away: string } } => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  
  // 전체 XML에서 팀명 패턴 선탐색
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
      if (/지역|Location|Zone/i.test(group)) locLabel = text;
      else if (/결과|Result|Outcome/i.test(group)) resultLabel = text;
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
      locationLabel: locLabel,
      resultLabel: resultLabel,
      code
    });
  });

  const sortedTeams = Object.keys(teamCounts).sort((a, b) => teamCounts[b] - teamCounts[a]);
  const home = detectedTeams?.home || sortedTeams[0] || "Home";
  const away = detectedTeams?.away || sortedTeams[1] || "Away";

  return { events, teams: { home, away } };
};

export const parseCSVData = (csvText: string): { events: MatchEvent[], teams: { home: string, away: string } } => {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return { events: [], teams: { home: "", away: "" } };

  const splitCSVLine = (line: string) => {
    return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(item => item.replace(/^"|"$/g, '').trim());
  };

  const headers = splitCSVLine(lines[0]);
  const getColIdx = (colNames: string[]) => headers.findIndex(h => colNames.some(name => h.trim().includes(name)));
  
  const idxMap = {
    code: getColIdx(["Row", "Code"]),
    start: getColIdx(["Start time"]),
    duration: getColIdx(["Duration"]),
    location: getColIdx(["지역", "Location"]),
    result: getColIdx(["결과", "Result"]),
    ungrouped: getColIdx(["Ungrouped"]),
    id: getColIdx(["Instance", "ID"])
  };

  let detectedTeams = detectRealTeamNames(csvText);
  const events: MatchEvent[] = [];
  const teamCounts: Record<string, number> = {};

  for (let i = 1; i < lines.length; i++) {
    const row = splitCSVLine(lines[i]);
    const code = idxMap.code > -1 ? row[idxMap.code] : "";
    const ungrouped = idxMap.ungrouped > -1 ? row[idxMap.ungrouped] : "";
    
    if (!detectedTeams) detectedTeams = detectRealTeamNames(ungrouped + code);
    
    const team = extractTeamName(code, detectedTeams);
    if (team === "Unknown" || !team) continue;

    teamCounts[team] = (teamCounts[team] || 0) + 1;
    const startTime = parseFloat(idxMap.start > -1 ? row[idxMap.start] : "0");
    const duration = parseFloat(idxMap.duration > -1 ? row[idxMap.duration] : "0");
    const locLabel = idxMap.location > -1 ? row[idxMap.location] : "";
    const resultLabel = idxMap.result > -1 ? row[idxMap.result] : "";
    const instanceId = idxMap.id > -1 ? row[idxMap.id] : `csv-${i}`;

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

  const sortedTeams = Object.keys(teamCounts).sort((a, b) => teamCounts[b] - teamCounts[a]);
  const home = detectedTeams?.home || sortedTeams[0] || "Home";
  const away = detectedTeams?.away || sortedTeams[1] || "Away";

  return { events, teams: { home, away } };
};

export const createMatchDataFromUpload = (events: MatchEvent[], homeName: string, awayName: string): MatchData => {
  const homeTeam = { name: homeName, color: 'hsl(var(--chart-1))' }; 
  const awayTeam = { name: awayName, color: 'hsl(var(--chart-2))' }; 

  const calculateTeamStats = (team: string, opponent: string, targetEvents: MatchEvent[]): TeamMatchStats => {
    const teamEvents = targetEvents.filter(e => e.team === team);
    const opponentEvents = targetEvents.filter(e => e.team === opponent);

    const teamTotalTime = teamEvents.reduce((acc, e) => acc + e.duration, 0);
    const opponentTotalTime = opponentEvents.reduce((acc, e) => acc + e.duration, 0);

    // 2. 공격 지역 점유율 (Attack Possession)
    // Row LIKE '%A25%' OR Row LIKE '%AM%'
    const teamAttackEvents = teamEvents.filter(e => e.code.includes('A25') || e.code.includes('AM'));
    const oppAttackEvents = opponentEvents.filter(e => e.code.includes('A25') || e.code.includes('AM'));
    const teamAttackTime = teamAttackEvents.reduce((acc, e) => acc + e.duration, 0);
    const oppAttackTime = oppAttackEvents.reduce((acc, e) => acc + e.duration, 0);
    const attackPossession = (teamAttackTime + oppAttackTime) > 0 ? (teamAttackTime / (teamAttackTime + oppAttackTime)) * 100 : 0;

    // 4. SPP (압박 대응 효율)
    // (D25_Time + DM_Time) / (해당 지역 내 턴오버 + 파울 횟수)
    const buildUpEvents = teamEvents.filter(e => e.code.includes('D25') || e.code.includes('DM'));
    const buildUpTime = buildUpEvents.reduce((acc, e) => acc + e.duration, 0);
    const buildUpLosses = buildUpEvents.filter(e => e.type === 'turnover' || e.type === 'foul').length;
    const spp = buildUpLosses > 0 ? buildUpTime / buildUpLosses : buildUpTime;

    // 빌드업 성공률 (25Y entry)
    const buildStarts = teamEvents.filter(e => e.code.includes('START') && (e.code.includes('DM') || e.code.includes('D25')));
    const buildSuccess = buildStarts.filter(e => e.resultLabel.includes('25Y entry')).length;

    // 서클 진입 및 슈팅
    const ceCount = teamEvents.filter(e => e.code.toLowerCase().includes('circle entry') || e.code.includes('서클 진입')).length;
    const shotCount = teamEvents.filter(e => e.code.toLowerCase().includes('shot') || e.code.includes('슈팅')).length;
    
    // 득점 (필드/PC)
    const goals = teamEvents.filter(e => e.code.toLowerCase().includes('goal') || e.code.includes('득점'));
    const pcGoals = goals.filter(e => e.code.includes('PC') || e.code.includes('페널티 코너')).length;
    const fieldGoals = goals.length - pcGoals;

    return {
      goals: { field: fieldGoals, pc: pcGoals },
      shots: shotCount,
      circleEntries: ceCount,
      twentyFiveEntries: teamEvents.filter(e => e.code.includes('25Y entry') || e.resultLabel.includes('25Y entry')).length,
      possession: (teamTotalTime + opponentTotalTime) > 0 ? (teamTotalTime / (teamTotalTime + opponentTotalTime)) * 100 : 0,
      attackPossession,
      spp,
      allowedSpp: 0,
      build25Ratio: buildStarts.length > 0 ? (buildSuccess / buildStarts.length) * 100 : 0,
      avgAttackDuration: teamAttackEvents.length > 0 ? teamAttackTime / teamAttackEvents.length : 0,
      timePerCE: ceCount > 0 ? teamAttackTime / ceCount : 0,
      pressAttempts: 0, // Heatmap 로직에서 계산
      pressSuccess: 0
    };
  };

  const homeStats = calculateTeamStats(homeName, awayName, events);
  const awayStats = calculateTeamStats(awayName, homeName, events);

  return {
    homeTeam,
    awayTeam,
    events,
    pressureData: Array(20).fill(0).map((_, i) => {
      const minute = (i + 1) * 3;
      const q = minute <= 15 ? 'Q1' : minute <= 30 ? 'Q2' : minute <= 45 ? 'Q3' : 'Q4';
      const qEvents = events.filter(e => e.quarter === q);
      const hS = calculateTeamStats(homeName, awayName, qEvents);
      const aS = calculateTeamStats(awayName, homeName, qEvents);
      return {
        interval: `${minute}'`,
        [homeName]: parseFloat(hS.spp.toFixed(1)),
        [awayName]: parseFloat(aS.spp.toFixed(1)),
      };
    }),
    circleEntries: events.filter(e => e.code.toLowerCase().includes('circle entry') || e.code.includes('서클 진입')).map(e => ({
      team: e.team,
      channel: e.locationLabel.includes('좌') ? 'Left' : e.locationLabel.includes('우') ? 'Right' : 'Center',
      outcome: e.resultLabel.includes('득점') || e.resultLabel.toLowerCase().includes('goal') ? 'Goal' : 'No Shot'
    })),
    attackThreatData: Array(12).fill(0).map((_, i) => ({
      interval: `${(i+1)*5}'`,
      [homeName]: events.filter(e => e.team === homeName && e.time <= (i+1)*300 && e.time > i*300 && (e.code.includes('Shot') || e.code.includes('슈팅'))).length,
      [awayName]: events.filter(e => e.team === awayName && e.time <= (i+1)*300 && e.time > i*300 && (e.code.includes('Shot') || e.code.includes('슈팅'))).length,
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
