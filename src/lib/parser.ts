
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

  return { 
    events, 
    teams: { 
      home: detectedTeams?.home.trim() || "Home", 
      away: detectedTeams?.away.trim() || "Away" 
    } 
  };
};

export const parseCSVData = (csvText: string): { events: MatchEvent[], teams: { home: string, away: string } } => {
  console.log("--- CSV Parsing Debug Start ---");
  // Robust line splitting for both Unix and Windows
  const lines = csvText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  console.log(`Total non-empty lines: ${lines.length}`);

  if (lines.length < 2) {
    console.warn("CSV Error: Less than 2 lines found.");
    return { events: [], teams: { home: "", away: "" } };
  }

  const splitCSVLine = (line: string) => {
    return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(item => item.replace(/^"|"$/g, '').trim());
  };

  const headers = splitCSVLine(lines[0]);
  console.log("Detected Headers:", headers);

  const getColIdx = (colNames: string[]) => {
    const idx = headers.findIndex(h => 
      colNames.some(name => h.toLowerCase().replace(/\s/g, '').includes(name.toLowerCase().replace(/\s/g, '')))
    );
    if (idx === -1) console.warn(`CSV Warning: Column not found for ${colNames.join("/")}`);
    return idx;
  };

  const idxMap = {
    code: getColIdx(["Code", "Row"]),
    start: getColIdx(["StartTime"]),
    duration: getColIdx(["Duration"]),
    location: getColIdx(["지역", "Location", "Zone"]),
    result: getColIdx(["결과", "Result", "Outcome"]),
    ungrouped: getColIdx(["Ungrouped"]),
    id: getColIdx(["Instance", "ID"])
  };

  console.log("Index Mapping:", idxMap);

  let detectedTeams = detectRealTeamNames(csvText);
  const events: MatchEvent[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = splitCSVLine(lines[i]);
    const code = idxMap.code > -1 ? row[idxMap.code] : "";
    const ungrouped = idxMap.ungrouped > -1 ? row[idxMap.ungrouped] : "";
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
  console.log("--- CSV Parsing Debug End ---");

  return { 
    events, 
    teams: { 
      home: detectedTeams?.home.trim() || "Home", 
      away: detectedTeams?.away.trim() || "Away" 
    } 
  };
};

export const createMatchDataFromUpload = (
  events: MatchEvent[], 
  homeName: string, 
  awayName: string, 
  homeColor: string, 
  awayColor: string,
  tournamentName?: string,
  matchName?: string
): MatchData => {
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
    const pcCount = myEvents.filter(e => e.code.trim() === `${team} 페널티코너`).length;
    const a25Count = myEvents.filter(e => e.code.trim() === `${team} A25 START`).length;

    const getZoneCount = (evts: MatchEvent[], types: string[], zones: number[]) => {
      return evts.filter(e => {
        const zone = mapZone(e.locationLabel || e.code).zoneBand;
        const isTargetType = types.some(t => e.type === t || e.code.toUpperCase().includes(t.toUpperCase()));
        return isTargetType && zones.includes(zone);
      }).length;
    };

    const press_attempts = getZoneCount(oppEvents, ["turnover", "foul"], [75, 100]) + 
                          getZoneCount(myEvents, ["foul"], [25, 50]);

    const press_success = getZoneCount(oppEvents, ["turnover", "foul"], [75, 100]);

    const spp = press_attempts > 0 ? oppBuildUpTime / press_attempts : 0;
    const timePerCE = ceCount > 0 ? teamTime / ceCount : 0;
    const totalPossession = teamTime + oppTeamTime;
    const totalATT = attTime + oppAttTime;

    const buildAttempts = myEvents.filter(e => e.code.trim() === `${team} TEAM` && mapZone(e.locationLabel || e.code).zoneBand <= 50).length;
    const build25Ratio = buildAttempts > 0 ? (a25Count / buildAttempts) * 100 : 0;

    const totalGoals = myEvents.filter(e => e.code.includes(`${team} 득점`)).length;
    const pcGoals = myEvents.filter(e => 
      e.code.includes(`${team} 페널티코너`) && 
      (e.resultLabel.toUpperCase().includes('GOAL') || e.resultLabel.includes('득점'))
    ).length;
    const fieldGoals = Math.max(0, totalGoals - pcGoals);

    return {
      goals: { field: fieldGoals, pc: pcGoals },
      shots: shotCount,
      pcs: pcCount,
      circleEntries: ceCount,
      twentyFiveEntries: a25Count,
      possession: totalPossession > 0 ? (teamTime / totalPossession) * 100 : 0,
      attackPossession: totalATT > 0 ? (attTime / totalATT) * 100 : 0,
      spp: parseFloat(spp.toFixed(1)),
      allowedSpp: 0, 
      build25Ratio: Math.min(100, build25Ratio),
      avgAttackDuration: 0,
      timePerCE: parseFloat(timePerCE.toFixed(1)),
      pressAttempts: press_attempts,
      pressSuccess: press_success
    };
  };

  const homeStats = calculateTeamStats(homeName, awayName, events);
  const awayStats = calculateTeamStats(awayName, homeName, events);

  return {
    tournamentName,
    matchName,
    homeTeam,
    awayTeam,
    events,
    pressureData: Array(20).fill(0).map((_, i) => {
      const normStart = (i * 180);
      const normEnd = ((i + 1) * 180);
      const periodEvents = events.filter(e => {
        const nTime = getNormalizedTime(e);
        return nTime >= normStart && nTime < normEnd;
      });
      const hS = calculateTeamStats(homeName, awayName, periodEvents);
      const aS = calculateTeamStats(awayName, homeName, periodEvents);
      return {
        interval: `${(i + 1) * 3}'`,
        [homeName]: hS.spp,
        [awayName]: aS.spp,
      };
    }),
    circleEntries: events.filter(e => e.code.trim() === `${e.team} 슈팅서클 진입`).map(e => {
      const res = e.resultLabel.toUpperCase();
      const isSuccess = res.includes('PC') || res.includes('SHOT') || res.includes('득점') || res.includes('슈팅') || res.includes('GOAL');
      return {
        team: e.team,
        channel: /좌|LEFT/i.test(e.locationLabel) ? 'Left' : /우|RIGHT/i.test(e.locationLabel) ? 'Right' : 'Center',
        outcome: isSuccess ? 'Shot On Target' : 'No Shot'
      };
    }),
    attackThreatData: Array(12).fill(0).map((_, i) => {
      const normStart = i * 300;
      const normEnd = (i + 1) * 300;
      return {
        interval: `${(i + 1) * 5}'`,
        [homeName]: events.filter(e => {
          const nTime = getNormalizedTime(e);
          return e.team === homeName && nTime >= normStart && nTime < normEnd &&
          (e.code.trim() === `${homeName} 슈팅` || e.code.trim() === `${homeName} 페널티코너`);
        }).length,
        [awayName]: events.filter(e => {
          const nTime = getNormalizedTime(e);
          return e.team === awayName && nTime >= normStart && nTime < normEnd &&
          (e.code.trim() === `${awayName} 슈팅` || e.code.trim() === `${awayName} 페널티코너`);
        }).length,
      };
    }),
    build25Ratio: { home: homeStats.build25Ratio, away: awayStats.build25Ratio },
    spp: { home: homeStats.spp, away: awayStats.spp },
    matchStats: { home: homeStats, away: awayStats },
    quarterlyStats: quartersList.map(q => ({
      quarter: q,
      home: calculateTeamStats(homeName, awayName, events.filter(e => e.quarter === q)),
      away: calculateTeamStats(awayName, homeName, events.filter(e => e.quarter === q))
    }))
  };
};
