import type { MatchEvent, MatchData, TeamMatchStats, AttackThreatDataPoint, PressureDataPoint, CircleEntry, QuarterStats } from './types';

// Based on FIH Field Specifications
const PITCH_LENGTH = 91.4;
const PITCH_WIDTH = 55;
const LANE_WIDTH = PITCH_WIDTH / 3;

const extractTeamsFromXML = (xmlDoc: Document): { home: string, away: string } => {
  const instances = xmlDoc.getElementsByTagName("instance");
  const teamCounts: Record<string, number> = {};

  Array.from(instances).forEach(instance => {
    // Strategy 1: Look for labels with group "Team" or "팀"
    const labels = instance.getElementsByTagName("label");
    for (let i = 0; i < labels.length; i++) {
      const group = labels[i].getElementsByTagName("group")[0]?.textContent?.trim();
      const text = labels[i].getElementsByTagName("text")[0]?.textContent?.trim();
      if (group?.toLowerCase() === "team" || group === "팀" || group === "Team Name" || group === "국가") {
        if (text) {
          teamCounts[text] = (teamCounts[text] || 0) + 1;
        }
      }
    }

    // Strategy 2: Extract from code if labels don't provide enough info
    const code = instance.getElementsByTagName("code")[0]?.textContent || "";
    let teamNameFromCode = code
      .replace(/turnover/gi, "")
      .replace(/foul/gi, "")
      .replace(/턴오버/g, "")
      .replace(/파울/g, "")
      .replace(/[-]/g, "")
      .trim();
    
    if (teamNameFromCode && teamNameFromCode.length > 1) {
      teamCounts[teamNameFromCode] = (teamCounts[teamNameFromCode] || 0) + 1;
    }
  });

  const sortedTeams = Object.entries(teamCounts)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);

  return {
    home: sortedTeams[0] || "Home",
    away: sortedTeams[1] || (sortedTeams[0] ? "Opponent" : "Away")
  };
};

export const parseXMLData = (xmlText: string): { events: MatchEvent[], teams: { home: string, away: string } } => {
  if (typeof window === 'undefined') {
    return { events: [], teams: { home: "Home", away: "Away" } };
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  
  const parseError = xmlDoc.querySelector("parsererror");
  if (parseError) {
    throw new Error("XML 파싱에 실패했습니다. 파일 형식을 확인해주세요.");
  }
  
  const detectedTeams = extractTeamsFromXML(xmlDoc);
  const instances = xmlDoc.getElementsByTagName("instance");
  const events: MatchEvent[] = [];

  Array.from(instances).forEach((instance, index) => {
    const code = instance.getElementsByTagName("code")[0]?.textContent || "";
    
    let type: 'turnover' | 'foul' = 'turnover';
    if (code.toLowerCase().includes("foul") || code.includes("파울")) {
      type = 'foul';
    } else if (code.toLowerCase().includes("turnover") || code.includes("턴오버")) {
      type = 'turnover';
    } else {
      return; 
    }

    const team = code.includes(detectedTeams.home) ? detectedTeams.home : detectedTeams.away;

    const labels = instance.getElementsByTagName("label");
    let locLabel = "";
    for (let i = 0; i < labels.length; i++) {
      const group = labels[i].getElementsByTagName("group")[0]?.textContent;
      const text = labels[i].getElementsByTagName("text")[0]?.textContent;
      
      if (group === "지역" || group === "Location" || group === "Zone" || group === "구역") {
        locLabel = text || "";
        break;
      }
    }
    
    if (!locLabel) {
      const match = code.match(/(좌|우|중|Left|Right|Center)/);
      if (match) locLabel = match[0];
    }

    if (!locLabel) return;

    let x = PITCH_LENGTH / 2;
    let y = PITCH_WIDTH / 2;

    if (locLabel.includes("Def 25") || locLabel.includes("수비 25")) x = PITCH_LENGTH * 0.125;
    else if (locLabel.includes("Mid") || locLabel.includes("하프")) x = PITCH_LENGTH * 0.5;
    else if (locLabel.includes("Att 25") || locLabel.includes("공격 25")) x = PITCH_LENGTH * 0.875;
    else if (locLabel.includes("Circle") || locLabel.includes("서클")) x = PITCH_LENGTH * 0.95;

    if (locLabel.includes("Left") || locLabel.includes("좌")) y = LANE_WIDTH / 2;
    else if (locLabel.includes("Right") || locLabel.includes("우")) y = PITCH_WIDTH - (LANE_WIDTH / 2);
    else y = PITCH_WIDTH / 2;

    x += (Math.random() - 0.5) * 4;
    y += (Math.random() - 0.5) * 4;
    x = Math.max(0, Math.min(PITCH_LENGTH, x));
    y = Math.max(0, Math.min(PITCH_WIDTH, y));
    
    const startTime = parseFloat(instance.getElementsByTagName("start")[0]?.textContent || "0");
    let quarter = "Q1";
    if (startTime > 2700) quarter = "Q4";
    else if (startTime > 1800) quarter = "Q3";
    else if (startTime > 900) quarter = "Q2";

    events.push({
      id: `evt-${instance.getElementsByTagName("ID")[0]?.textContent || index}`,
      team,
      type,
      quarter,
      time: startTime,
      x,
      y,
      locationLabel: locLabel
    });
  });

  return { events, teams: detectedTeams };
};

export const parseCSVData = (csvText: string): MatchEvent[] => {
  const events: MatchEvent[] = [];
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines.shift()!.trim().split(',');
  const idx = {
    id: headers.indexOf('id'),
    team: headers.indexOf('team'),
    type: headers.indexOf('type'),
    quarter: headers.indexOf('quarter'),
    time: headers.indexOf('time'),
    x: headers.indexOf('x'),
    y: headers.indexOf('y'),
    locationLabel: headers.indexOf('locationLabel'),
  };

  lines.forEach((line) => {
    if (!line.trim()) return;
    const values = line.trim().split(',');
    events.push({
      id: values[idx.id],
      team: values[idx.team],
      type: (values[idx.type] as 'turnover' | 'foul') || 'turnover',
      quarter: values[idx.quarter],
      time: parseFloat(values[idx.time]),
      x: parseFloat(values[idx.x]),
      y: parseFloat(values[idx.y]),
      locationLabel: values[idx.locationLabel],
    });
  });
  return events;
};

function generateRandomStats(): TeamMatchStats {
  return {
    goals: { field: Math.floor(Math.random() * 2), pc: Math.floor(Math.random() * 1) },
    shots: 8 + Math.floor(Math.random() * 8),
    circleEntries: 15 + Math.floor(Math.random() * 8),
    twentyFiveEntries: 25 + Math.floor(Math.random() * 10),
    possession: 45 + Math.floor(Math.random() * 10),
    attackPossession: 45 + Math.floor(Math.random() * 10),
    allowedSpp: 10 + Math.random() * 5,
    avgAttackDuration: 25 + Math.random() * 10,
    timePerCE: 40 + Math.random() * 20
  };
}

export const createMatchDataFromUpload = (
    events: MatchEvent[], 
    homeTeamName: string, 
    awayTeamName: string
): MatchData => {
  const HOME_TEAM = { name: homeTeamName, color: 'hsl(var(--chart-1))' };
  const AWAY_TEAM = { name: awayTeamName, color: 'hsl(var(--chart-2))' };
  
  const quarterlyStats: QuarterStats[] = ['Q1', 'Q2', 'Q3', 'Q4'].map(q => {
    return {
      quarter: q,
      home: { ...generateRandomStats(), spp: 8 + Math.random() * 4 },
      away: { ...generateRandomStats(), spp: 8 + Math.random() * 4 }
    };
  });

  return {
    homeTeam: HOME_TEAM,
    awayTeam: AWAY_TEAM,
    events: events,
    pressureData: Array(20).fill(0).map((_, i) => ({
      interval: `${(i+1)*3}'`,
      [homeTeamName]: parseFloat((8 + Math.random() * 4).toFixed(2)),
      [awayTeamName]: parseFloat((8 + Math.random() * 4).toFixed(2)),
    })),
    circleEntries: Array(40).fill(0).map(() => ({
      team: Math.random() > 0.5 ? homeTeamName : awayTeamName,
      channel: (['Left', 'Center', 'Right'] as const)[Math.floor(Math.random() * 3)],
      outcome: (['Goal', 'Shot On Target', 'Shot Missed', 'No Shot'] as const)[Math.floor(Math.random() * 4)],
    })),
    attackThreatData: Array(12).fill(0).map((_, i) => ({
      interval: `${(i+1)*5}'`,
      [homeTeamName]: Math.floor(Math.random() * 10) + 2,
      [awayTeamName]: Math.floor(Math.random() * 10) + 2,
    })),
    build25Ratio: { home: 0.5 + Math.random() * 0.2, away: 0.5 + Math.random() * 0.2 },
    spp: { home: 9.5, away: 10.2 },
    matchStats: { home: generateRandomStats(), away: generateRandomStats() },
    quarterlyStats: quarterlyStats
  };
}
