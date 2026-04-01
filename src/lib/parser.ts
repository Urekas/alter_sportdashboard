
import type { MatchEvent, MatchData, TeamMatchStats } from './types';

export const detectRealTeamNames = (text: string): { home: string, away: string } | null => {
  // 1. 점수가 포함된 패턴 우선 검색 (예: 웨일즈 0 - 스코틀랜드 0) - 가장 확실한 식별자
  const scorePattern = /([가-힣A-Za-z]+)\s*\d+\s*-\s*([가-힣A-Za-z]+)\s*\d+/;
  const scoreMatch = text.match(scorePattern);
  if (scoreMatch) return { home: scoreMatch[1].trim(), away: scoreMatch[2].trim() };

  // 2. 일반적인 하이픈 연결 패턴 검색 (예: Korea - Netherlands)
  // 단, M01 - Team A 같은 경우 M01을 팀으로 오인하지 않도록 함
  const pattern = /([가-힣A-Za-z]+)\s*(\d+)?\s*-\s*([가-힣A-Za-z]+)\s*(\d+)?/g;
  let m;
  while ((m = pattern.exec(text)) !== null) {
    const h = m[1].trim();
    const a = m[3].trim();
    // 'M'으로 시작하고 숫자로 구성된 경기 번호 패턴 제외
    if (!/^M\d+$/i.test(h)) {
      return { home: h, away: a };
    }
  }
  return null;
};

export const extractTeamName = (code: string, detectedTeams: { home: string, away: string } | null): string => {
  if (!code) return "Unknown";
  const upperCode = code.toUpperCase();
  if (detectedTeams) {
    const homeUpper = detectedTeams.home.toUpperCase().trim();
    const awayUpper = detectedTeams.away.toUpperCase().trim();
    if (upperCode.includes(homeUpper)) return detectedTeams.home.trim();
    if (upperCode.includes(awayUpper)) return detectedTeams.away.trim();
    if (upperCode.includes("HOME")) return detectedTeams.home.trim();
    if (upperCode.includes("AWAY")) return detectedTeams.away.trim();
  }
  return "Unknown";
};

export const mapZone = (locStr: string): { x: number, y: number, lane: 'Left' | 'Center' | 'Right', zoneBand: number } => {
  const text = locStr.toUpperCase().replace('유', '우');
  let lane: 'Left' | 'Center' | 'Right' = 'Center';
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

export const detectQuarter = (ungroupedText: string, startTime: number): string => {
  const text = ungroupedText.toUpperCase();
  if (text.includes('0쿼터')) return 'Q1'; // 0쿼터는 Q1으로 간주
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
      const groupText = labels[i].getElementsByTagName("group")[0]?.textContent || "";
      const text = (labels[i].getElementsByTagName("text")[0]?.textContent || "").trim();
      if (/지역|Location|Zone/i.test(groupText)) locLabel = text;
      else if (/결과|Result|Outcome/i.test(groupText)) resultLabel = text;
      else ungroupedText += text + " ";
      if (!detectedTeams) detectedTeams = detectRealTeamNames(text);
    }

    const team = extractTeamName(code, detectedTeams).trim();
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

  return { events, teams: { home: detectedTeams?.home.trim() || "Home", away: detectedTeams?.away.trim() || "Away" } };
};

export const parseCSVData = (csvText: string): { events: MatchEvent[], teams: { home: string, away: string } } => {
  const lines = csvText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length < 2) return { events: [], teams: { home: "", away: "" } };

  // 구분자(콤마 vs 탭) 자동 감지
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const splitCSVLine = (line: string) => {
    if (delimiter === '\t') return line.split('\t').map(item => item.trim());
    return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(item => item.replace(/^"|"$/g, '').trim());
  };

  const headers = splitCSVLine(lines[0]);
  const getColIdx = (colNames: string[]) => headers.findIndex(h => {
    const cleanHeader = h.toLowerCase().replace(/\s/g, '');
    return colNames.some(name => {
      const cleanName = name.toLowerCase().replace(/\s/g, '');
      return cleanHeader.includes(cleanName);
    });
  });

  const idxMap = {
    code: getColIdx(["Code", "Row"]),
    start: getColIdx(["StartTime", "Starttime"]),
    duration: getColIdx(["Duration"]),
    location: getColIdx(["지역", "Location", "Zone"]),
    result: getColIdx(["결과", "Result", "Outcome"]),
    ungrouped: getColIdx(["Ungrouped"]),
    id: getColIdx(["Instance", "ID"])
  };

  let detectedTeams = detectRealTeamNames(csvText);
  const events: MatchEvent[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = splitCSVLine(lines[i]);
    const code = idxMap.code > -1 ? row[idxMap.code] : "";
    const ungrouped = idxMap.ungrouped > -1 ? row[idxMap.ungrouped] : "";
    
    // 만약 전체 텍스트에서 팀을 못 찾았다면 각 행에서 다시 시도
    if (!detectedTeams) detectedTeams = detectRealTeamNames(ungrouped + code);
    
    const team = extractTeamName(code, detectedTeams).trim();
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

  return { events, teams: { home: detectedTeams?.home.trim() || "Home", away: detectedTeams?.away.trim() || "Away" } };
};

export const createMatchDataFromUpload = (events: MatchEvent[], homeName: string, awayName: string, homeColor: string, awayColor: string, tournamentName?: string, matchName?: string): MatchData => {
  const homeTeam = { name: homeName.trim(), color: homeColor }; 
  const awayTeam = { name: awayName.trim(), color: awayColor }; 
  const quartersList = ['Q1', 'Q2', 'Q3', 'Q4'];
  const qMap = quartersList.map((q, idx) => {
    const qEvents = events.filter(e => e.quarter === q);
    if (qEvents.length === 0) return { q, min: idx * 900, max: (idx + 1) * 900, duration: 900 };
    const min = Math.min(...qEvents.map(e => e.time));
    const max = Math.max(...qEvents.map(e => e.time + e.duration));
    return { q, min, max, duration: Math.max(1, max - min) };
  });

  const getNormalizedTime = (e: MatchEvent) => {
    const info = qMap.find(item => item.q === e.quarter) || qMap[0];
    const qOffset = quartersList.indexOf(e.quarter) * 900;
    const relativePos = info.duration > 0 ? (e.time - info.min) / info.duration : 0;
    return qOffset + (relativePos * 900);
  };

  const calculateTeamStats = (team: string, opponent: string, targetEvents: MatchEvent[]): TeamMatchStats => {
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

    const getZoneCount = (evts: MatchEvent[], types: string[], zones: number[]) => evts.filter(e => {
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
    const pcGoals = pcEvents.filter(e => e.resultLabel.toUpperCase().includes('GOAL')).length;

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
  };

  return {
    tournamentName, matchName, homeTeam, awayTeam, events,
    pressureData: Array(20).fill(0).map((_, i) => {
      const start = i * 180, end = (i + 1) * 180;
      const pEvents = events.filter(e => { const nt = getNormalizedTime(e); return nt >= start && nt < end; });
      return { interval: `${(i + 1) * 3}'`, [homeName]: calculateTeamStats(homeName, awayName, pEvents).spp, [awayName]: calculateTeamStats(awayName, homeName, pEvents).spp };
    }),
    circleEntries: events.filter(e => e.code.trim() === `${homeName} 슈팅서클 진입` || e.code.trim() === `${awayName} 슈팅서클 진입`).map(e => {
      const res = e.resultLabel.toUpperCase();
      const isS = res.includes('PC') || res.includes('SHOT') || res.includes('득점') || res.includes('슈팅') || res.includes('GOAL');
      return { team: e.team, channel: /좌|LEFT/i.test(e.locationLabel) ? 'Left' : /우|RIGHT/i.test(e.locationLabel) ? 'Right' : 'Center', outcome: isS ? 'Shot On Target' : 'No Shot' };
    }),
    attackThreatData: Array(12).fill(0).map((_, i) => {
      const s = i * 300, e_ = (i + 1) * 300;
      const filterT = (t: string) => events.filter(e => {
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
};
