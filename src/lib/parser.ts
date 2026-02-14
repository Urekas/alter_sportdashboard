import type { MatchEvent, MatchData, TeamMatchStats, QuarterStats, CircleEntry } from './types';

const detectRealTeamNames = (text: string): { home: string, away: string } | null => {
  const pattern = /([가-힣A-Za-z]+)\s*(\d+)?\s*-\s*([가-힣A-Za-z]+)\s*(\d+)?/;
  const match = text.match(pattern);
  if (match) {
    return { home: match[1].trim(), away: match[3].trim() };
  }
  return null;
};

const extractTeamName = (code: string, detectedTeams: { home: string, away: string } | null): string => {
  if (!code) return "Unknown";
  const upperCode = code.toUpperCase();
  
  if (detectedTeams) {
    const homeUpper = detectedTeams.home.toUpperCase();
    const awayUpper = detectedTeams.away.toUpperCase();
    
    if (upperCode.includes(homeUpper)) return detectedTeams.home;
    if (upperCode.includes(awayUpper)) return detectedTeams.away;
    
    if (upperCode.includes("HOME")) return detectedTeams.home;
    if (upperCode.includes("AWAY")) return detectedTeams.away;
  }
  
  const first = code.trim().split(/\s+/)[0];
  const technicalTags = ["한국빌드업", "한국프레스", "코치님", "START", "Unknown", "YOO", "DM", "D25", "AM", "A25", "L_", "R_", "중_"];
  if (!technicalTags.includes(first) && first.length > 1) return first;

  return "Unknown";
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

const detectQuarter = (ungroupedText: string, startTime: number): string => {
  const text = ungroupedText.toUpperCase();
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

    const startTime = parseFloat(instance.getElementsByTagName("start")[0]?.textContent || "0");
    const endTime = parseFloat(instance.getElementsByTagName("end")[0]?.textContent || "0");
    const quarter = detectQuarter(ungroupedText, startTime);
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

  return { events, teams: { home: detectedTeams?.home || "Home", away: detectedTeams?.away || "Away" } };
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

  for (let i = 1; i < lines.length; i++) {
    const row = splitCSVLine(lines[i]);
    const code = idxMap.code > -1 ? row[idxMap.code] : "";
    const ungrouped = idxMap.ungrouped > -1 ? row[idxMap.ungrouped] : "";
    if (!detectedTeams) detectedTeams = detectRealTeamNames(ungrouped + code);
    
    const team = extractTeamName(code, detectedTeams);
    if (team === "Unknown") continue;

    const startTime = parseFloat(idxMap.start > -1 ? row[idxMap.start] : "0");
    const duration = parseFloat(idxMap.duration > -1 ? row[idxMap.duration] : "0");
    const locLabel = idxMap.location > -1 ? row[idxMap.location] : "";
    const resultLabel = idxMap.result > -1 ? row[idxMap.result] : "";
    const quarter = detectQuarter(ungrouped, startTime);
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

  return { events, teams: { home: detectedTeams?.home || "Home", away: detectedTeams?.away || "Away" } };
};

export const createMatchDataFromUpload = (events: MatchEvent[], homeName: string, awayName: string, homeColor: string, awayColor: string): MatchData => {
  const homeTeam = { name: homeName, color: homeColor }; 
  const awayTeam = { name: awayName, color: awayColor }; 

  const calculateTeamStats = (team: string, opponent: string, targetEvents: MatchEvent[]): TeamMatchStats => {
    const teamEvents = targetEvents.filter(e => e.team === team);
    const oppEvents = targetEvents.filter(e => e.team === opponent);

    const teamTime = teamEvents.filter(e => e.code.toUpperCase().includes('TEAM')).reduce((acc, e) => acc + e.duration, 0);
    const oppTeamTime = oppEvents.filter(e => e.code.toUpperCase().includes('TEAM')).reduce((acc, e) => acc + e.duration, 0);
    const totalPossessionTime = teamTime + oppTeamTime;

    const attackTime = teamEvents.filter(e => e.code.toUpperCase().includes('AM START') || e.code.toUpperCase().includes('A25 START')).reduce((acc, e) => acc + e.duration, 0);
    const oppAttackTime = oppEvents.filter(e => e.code.toUpperCase().includes('AM START') || e.code.toUpperCase().includes('A25 START')).reduce((acc, e) => acc + e.duration, 0);
    const totalAttackTime = attackTime + oppAttackTime;
    
    const buildUpTime = teamEvents.filter(e => e.code.toUpperCase().includes('DM START') || e.code.toUpperCase().includes('D25 START')).reduce((acc, e) => acc + e.duration, 0);
    const buildUpFailures = teamEvents.filter(e => 
      (e.type === 'turnover' || e.type === 'foul') && 
      (e.locationLabel.includes('25') || e.locationLabel.includes('50') || e.code.toUpperCase().includes('DM') || e.code.toUpperCase().includes('D25'))
    ).length;
    const spp = buildUpFailures > 0 ? buildUpTime / buildUpFailures : 0;

    const twentyFiveCount = teamEvents.filter(e => e.code.toUpperCase().includes('A25 START')).length;
    const ceCount = teamEvents.filter(e => e.code.includes('슈팅서클 진입')).length;
    const shotCount = teamEvents.filter(e => e.code.endsWith('슈팅')).length;
    const pcCount = teamEvents.filter(e => e.code.endsWith('페널티코너')).length;

    const buildRows = teamEvents.filter(e => e.code.toUpperCase().includes('DM START') || e.code.toUpperCase().includes('D25 START'));
    const buildSuccess = buildRows.filter(e => e.resultLabel.toUpperCase().includes('25Y ENTRY')).length;

    const goals = teamEvents.filter(e => e.code.includes('득점'));
    const pcGoals = goals.filter(e => e.resultLabel.toUpperCase().includes('PC') || e.resultLabel.includes('페널티코너')).length;

    return {
      goals: { field: Math.max(0, goals.length - pcGoals), pc: pcGoals },
      shots: shotCount,
      pcs: pcCount,
      circleEntries: ceCount,
      twentyFiveEntries: twentyFiveCount,
      possession: totalPossessionTime > 0 ? (teamTime / totalPossessionTime) * 100 : 0,
      attackPossession: totalAttackTime > 0 ? (attackTime / totalAttackTime) * 100 : 0,
      spp: parseFloat(spp.toFixed(1)),
      allowedSpp: 0, 
      build25Ratio: buildRows.length > 0 ? (buildSuccess / buildRows.length) * 100 : 0,
      avgAttackDuration: 0, 
      timePerCE: ceCount > 0 ? parseFloat((attackTime / ceCount).toFixed(1)) : 0,
      pressAttempts: 0, 
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
      const timeThreshold = minute * 60;
      const periodEvents = events.filter(e => e.time <= timeThreshold && e.time > (timeThreshold - 180));
      const hS = calculateTeamStats(homeName, awayName, periodEvents);
      const aS = calculateTeamStats(awayName, homeName, periodEvents);
      return {
        interval: `${minute}'`,
        [homeName]: hS.spp,
        [awayName]: aS.spp,
      };
    }),
    circleEntries: events.filter(e => e.code.includes('슈팅서클 진입')).map(e => {
      const res = e.resultLabel.toUpperCase();
      const isSuccess = res.includes('PC') || res.includes('SHOT');
      return {
        team: e.team,
        channel: /좌|LEFT/i.test(e.locationLabel) ? 'Left' : /우|RIGHT/i.test(e.locationLabel) ? 'Right' : 'Center',
        outcome: isSuccess ? 'Shot On Target' : 'No Shot'
      };
    }),
    attackThreatData: Array(12).fill(0).map((_, i) => ({
      interval: `${(i+1)*5}'`,
      [homeName]: events.filter(e => e.team === homeName && e.time <= (i+1)*300 && e.time > i*300 && (e.code.endsWith('슈팅') || e.code.endsWith('페널티코너'))).length,
      [awayName]: events.filter(e => e.team === awayName && e.time <= (i+1)*300 && e.time > i*300 && (e.code.endsWith('슈팅') || e.code.endsWith('페널티코너'))).length,
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