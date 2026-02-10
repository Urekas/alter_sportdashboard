
import type { MatchEvent, MatchData, TeamMatchStats, QuarterStats, CircleEntry } from './types';

const detectRealTeamNames = (text: string): { home: string, away: string } | null => {
  // "인도 0 - 일본 0" 또는 "인도(HOME side) 0 - 일본(AWAY side) 0" 패턴 대응
  const pattern = /([가-힣A-Za-z]+)(?:\s*\(HOME side\))?\s*\d+\s*-\s*([가-힣A-Za-z]+)(?:\s*\(AWAY side\))?\s*\d+/;
  const match = text.match(pattern);
  if (match) {
    return { home: match[1].trim(), away: match[2].trim() };
  }
  return null;
};

const extractTeamName = (code: string, detectedTeams: { home: string, away: string } | null): string => {
  if (!code) return "Unknown";
  const upperCode = code.toUpperCase();

  // HOME/AWAY 키워드가 코드에 있으면 감지된 팀명으로 매핑
  if (detectedTeams) {
    if (upperCode.includes("HOME")) return detectedTeams.home;
    if (upperCode.includes("AWAY")) return detectedTeams.away;
  }

  // 파이썬 로직: split(' ')[0]
  const first = code.trim().split(/\s+/)[0];
  const ignoreTags = ["한국빌드업", "한국프레스", "코치님", "START", "Unknown"];
  if (ignoreTags.includes(first)) return "Unknown";
  
  return first;
};

const mapZone = (locStr: string): { x: number, y: number, lane: 'Left' | 'Center' | 'Right', zoneBand: number } => {
  const text = locStr.toUpperCase();
  let lane: 'Left' | 'Center' | 'Right' = 'Center';
  if (text.includes('좌') || text.includes('LEFT') || text.startsWith('L_') || text.startsWith('L ')) lane = 'Left';
  else if (text.includes('우') || text.includes('RIGHT') || text.startsWith('R_') || text.startsWith('R ')) lane = 'Right';

  let zoneBand = 50;
  const zoneMatch = text.match(/(\d+)/);
  if (zoneMatch) {
    zoneBand = parseInt(zoneMatch[1]);
  }

  // 필드 시각화용 X, Y 좌표 매핑 (91.4m x 55m)
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
  if (startTime >= 2700) return "Q4";
  if (startTime >= 1800) return "Q3";
  if (startTime >= 900) return "Q2";
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
      if (/지역|Location|Zone/i.test(group)) locLabel = text;
      else if (/결과|Result|Outcome/i.test(group)) resultLabel = text;
      else ungroupedText += text + " ";
      if (!detectedTeams) detectedTeams = detectRealTeamNames(text);
    }

    const team = extractTeamName(code, detectedTeams);
    if (team === "Unknown") return;

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
    if (team === "Unknown") continue;

    teamCounts[team] = (teamCounts[team] || 0) + 1;
    const startTime = parseFloat(idxMap.start > -1 ? row[idxMap.start] : "0");
    const duration = parseFloat(idxMap.duration > -1 ? row[idxMap.duration] : "0");
    const locLabel = idxMap.location > -1 ? row[idxMap.location] : "";
    const resultLabel = idxMap.result > -1 ? row[idxMap.result] : "";
    const quarter = detectQuarter(ungrouped + locLabel + code, startTime);
    const zoneInfo = mapZone(locLabel || code);

    events.push({
      id: idxMap.id > -1 ? row[idxMap.id] : `csv-${i}`,
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
  const homeTeam = { name: homeName, color: 'hsl(var(--primary))' }; 
  const awayTeam = { name: awayName, color: 'hsl(var(--chart-2))' }; 

  const calculateTeamStats = (team: string, opponent: string, targetEvents: MatchEvent[]): TeamMatchStats => {
    const teamEvents = targetEvents.filter(e => e.team === team);
    const opponentEvents = targetEvents.filter(e => e.team === opponent);

    const teamTotalTime = teamEvents.filter(e => e.code.includes('TEAM')).reduce((acc, e) => acc + e.duration, 0);
    const opponentTotalTime = opponentEvents.filter(e => e.code.includes('TEAM')).reduce((acc, e) => acc + e.duration, 0);

    // 파이썬 로직: Row LIKE '%A25%' OR Row LIKE '%AM%'
    const teamAttackEvents = teamEvents.filter(e => e.code.includes('A25') || e.code.includes('AM'));
    const oppAttackEvents = opponentEvents.filter(e => e.code.includes('A25') || e.code.includes('AM'));
    const teamAttackTime = teamAttackEvents.reduce((acc, e) => acc + e.duration, 0);
    const oppAttackTime = oppAttackEvents.reduce((acc, e) => acc + e.duration, 0);
    const attackPossession = (teamAttackTime + oppAttackTime) > 0 ? (teamAttackTime / (teamAttackTime + oppAttackTime)) * 100 : 0;

    // SPP (Seconds Per Press) = BuildUpTime / PressAttempts
    // BuildUpTime = TeamTotalTime - AttackTime
    const buildUpTime = teamTotalTime - teamAttackTime;
    
    // Press Attempts 정의 (파이썬 로직)
    const usTurnoverHigh = teamEvents.filter(e => e.type === 'turnover' && (e.locationLabel.includes('75') || e.locationLabel.includes('100'))).length;
    const usFoulHigh = teamEvents.filter(e => e.type === 'foul' && (e.locationLabel.includes('75') || e.locationLabel.includes('100'))).length;
    const oppFoulLow = opponentEvents.filter(e => e.type === 'foul' && (e.locationLabel.includes('25') || e.locationLabel.includes('50'))).length;
    const pressAttempts = usTurnoverHigh + usFoulHigh + oppFoulLow;
    const spp = pressAttempts > 0 ? buildUpTime / pressAttempts : 0;

    // 빌드업 성공률 (Build25)
    const buildStarts = teamEvents.filter(e => (e.code.includes('DM START') || e.code.includes('D25 START')));
    const buildSuccess = buildStarts.filter(e => e.resultLabel.includes('25Y entry')).length;

    const ceCount = teamEvents.filter(e => e.code.toLowerCase().includes('circle entry') || e.code.includes('서클 진입')).length;
    const shotCount = teamEvents.filter(e => /슈팅|shot/i.test(e.code) && !e.code.includes('서클')).length;
    const goals = teamEvents.filter(e => /득점|goal/i.test(e.code));
    const pcGoals = goals.filter(e => /PC|페널티 코너/i.test(e.code)).length;

    return {
      goals: { field: goals.length - pcGoals, pc: pcGoals },
      shots: shotCount,
      circleEntries: ceCount,
      twentyFiveEntries: teamEvents.filter(e => e.code.includes('A25 START')).length,
      possession: (teamTotalTime + opponentTotalTime) > 0 ? (teamTotalTime / (teamTotalTime + opponentTotalTime)) * 100 : 0,
      attackPossession,
      spp,
      allowedSpp: 0, 
      build25Ratio: buildStarts.length > 0 ? (buildSuccess / buildStarts.length) * 100 : 0,
      avgAttackDuration: teamAttackEvents.length > 0 ? teamAttackTime / teamAttackEvents.length : 0,
      timePerCE: ceCount > 0 ? teamAttackTime / ceCount : 0,
      pressAttempts,
      pressSuccess: usTurnoverHigh + usFoulHigh // 우리 입장에서 뺏긴 경우(성공적인 압박을 당함)
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
      channel: /좌|LEFT/i.test(e.locationLabel) ? 'Left' : /우|RIGHT/i.test(e.locationLabel) ? 'Right' : 'Center',
      outcome: /득점|goal/i.test(e.resultLabel) ? 'Goal' : 'No Shot'
    })),
    attackThreatData: Array(12).fill(0).map((_, i) => ({
      interval: `${(i+1)*5}'`,
      [homeName]: events.filter(e => e.team === homeName && e.time <= (i+1)*300 && e.time > i*300 && /슈팅|shot/i.test(e.code)).length,
      [awayName]: events.filter(e => e.team === awayName && e.time <= (i+1)*300 && e.time > i*300 && /슈팅|shot/i.test(e.code)).length,
    })),
    build25Ratio: { home: homeStats.build25Ratio, away: awayStats.build25Ratio },
    spp: { home: homeStats.spp, away: awayStats.spp },
    matchStats: { home: homeStats, away: awayStats },
    quarterlyStats: ['Q1', 'Q2', 'Q3', 'Q4'].map(q => ({
      quarter: q,
      home: calculateTeamStats(homeName, awayName, events.filter(e => e.quarter === q)),
      away: calculateTeamStats(awayName, homeName, events.filter(e => e.quarter === q))
    }))
  };
};
