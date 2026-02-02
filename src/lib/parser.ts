import type { MatchEvent, MatchData, TeamMatchStats, AttackThreatDataPoint, PressureDataPoint, CircleEntry, QuarterStats } from './types';

// Based on FIH Field Specifications
const PITCH_LENGTH = 91.4;
const PITCH_WIDTH = 55;
const LANE_WIDTH = PITCH_WIDTH / 3;

const extractTeamsFromXML = (xmlDoc: Document): { home: string, away: string } => {
  const instances = xmlDoc.getElementsByTagName("instance");
  const teamCounts: Record<string, number> = {};

  Array.from(instances).forEach(instance => {
    const code = instance.getElementsByTagName("code")[0]?.textContent || "";
    let teamName = code
      .replace(/turnover/gi, "")
      .replace(/foul/gi, "")
      .replace(/턴오버/g, "")
      .replace(/파울/g, "")
      .replace(/[-]/g, "")
      .trim();
    
    if (teamName) {
      teamCounts[teamName] = (teamCounts[teamName] || 0) + 1;
    }
  });

  const sortedTeams = Object.entries(teamCounts)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);

  return {
    home: sortedTeams[0] || "Home Team",
    away: sortedTeams[1] || "Away Team"
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
    console.error("XML Parsing Error:", parseError);
    throw new Error("Failed to parse XML. Please check the file format.");
  }
  
  const detectedTeams = extractTeamsFromXML(xmlDoc);
  const instances = xmlDoc.getElementsByTagName("instance");
  const events: MatchEvent[] = [];

  Array.from(instances).forEach((instance, index) => {
    const code = instance.getElementsByTagName("code")[0]?.textContent || "";
    
    let type: 'turnover' | 'foul' = 'turnover';
    if (code.toLowerCase().includes("foul") || code.includes("파울")) {
      type = 'foul';
    } else if (!code.toLowerCase().includes("turnover") && !code.includes("턴오버")) {
      return; 
    }

    const team = code.includes(detectedTeams.home) ? detectedTeams.home : detectedTeams.away;

    const labels = instance.getElementsByTagName("label");
    let locLabel = "";
    for (let i = 0; i < labels.length; i++) {
      const group = labels[i].getElementsByTagName("group")[0]?.textContent;
      const text = labels[i].getElementsByTagName("text")[0]?.textContent;
      if (group === "지역" || group === "Location") {
        locLabel = text || "";
        break;
      }
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

    x += (Math.random() - 0.5) * 8;
    y += (Math.random() - 0.5) * 8;
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

function generateQuarterlyStats(): QuarterStats[] {
  return ['Q1', 'Q2', 'Q3', 'Q4'].map(q => ({
    quarter: q,
    home: {
      goals: { field: Math.floor(Math.random() * 2), pc: Math.floor(Math.random() * 1) },
      shots: 2 + Math.floor(Math.random() * 4),
      circleEntries: 4 + Math.floor(Math.random() * 5),
      twentyFiveEntries: 6 + Math.floor(Math.random() * 6),
      possession: 45 + Math.floor(Math.random() * 10),
      attackPossession: 20 + Math.floor(Math.random() * 10),
      spp: 8 + Math.random() * 5,
      avgAttackDuration: 25 + Math.random() * 15,
      timePerCE: 40 + Math.random() * 20,
    },
    away: {
      goals: { field: Math.floor(Math.random() * 2), pc: Math.floor(Math.random() * 1) },
      shots: 2 + Math.floor(Math.random() * 4),
      circleEntries: 4 + Math.floor(Math.random() * 5),
      twentyFiveEntries: 6 + Math.floor(Math.random() * 6),
      possession: 45 + Math.floor(Math.random() * 10),
      attackPossession: 20 + Math.floor(Math.random() * 10),
      spp: 8 + Math.random() * 5,
      avgAttackDuration: 25 + Math.random() * 15,
      timePerCE: 40 + Math.random() * 20,
    }
  }));
}

export const createMatchDataFromUpload = (
    events: MatchEvent[], 
    homeTeamName: string, 
    awayTeamName: string
): MatchData => {
  const HOME_TEAM = { name: homeTeamName, color: 'hsl(var(--chart-1))' };
  const AWAY_TEAM = { name: awayTeamName, color: 'hsl(var(--chart-2))' };
  
  const generatePressureData = () => {
    const data: PressureDataPoint[] = [];
    let homeSppBase = 8 + Math.random() * 4;
    let awaySppBase = 8 + Math.random() * 4;
    for (let i = 1; i <= 20; i++) {
      const minute = i * 3;
      data.push({
        interval: `${minute}'`,
        [homeTeamName]: parseFloat(Math.max(4, Math.min(20, homeSppBase + (Math.random() - 0.5) * 3)).toFixed(2)),
        [awayTeamName]: parseFloat(Math.max(4, Math.min(20, awaySppBase + (Math.random() - 0.5) * 3)).toFixed(2)),
      });
    }
    return data;
  };

  const generateCircleEntries = () => {
    const entries: CircleEntry[] = [];
    const channels: ('Left' | 'Center' | 'Right')[] = ['Left', 'Center', 'Right'];
    const outcomes: ('Goal' | 'Shot On Target' | 'Shot Missed' | 'No Shot')[] = ['Goal', 'Shot On Target', 'Shot Missed', 'No Shot'];
    for (let i = 0; i < 40; i++) {
        entries.push({
            team: Math.random() > 0.5 ? homeTeamName : awayTeamName,
            channel: channels[Math.floor(Math.random() * channels.length)],
            outcome: outcomes[Math.floor(Math.random() * outcomes.length)],
        });
    }
    return entries;
  };

  const homeStats: TeamMatchStats = {
    goals: { field: Math.floor(Math.random() * 3), pc: Math.floor(Math.random() * 2) },
    shots: 8 + Math.floor(Math.random() * 10),
    circleEntries: 15 + Math.floor(Math.random() * 10),
    twentyFiveEntries: 25 + Math.floor(Math.random() * 15),
    possession: 40 + Math.floor(Math.random() * 20),
    attackPossession: 20 + Math.floor(Math.random() * 20),
    allowedSpp: 10 + Math.random() * 5,
    avgAttackDuration: 28.5,
    timePerCE: 45.2,
  };
  const awayStats: TeamMatchStats = {
    goals: { field: Math.floor(Math.random() * 3), pc: Math.floor(Math.random() * 2) },
    shots: 8 + Math.floor(Math.random() * 10),
    circleEntries: 15 + Math.floor(Math.random() * 10),
    twentyFiveEntries: 25 + Math.floor(Math.random() * 15),
    possession: 40 + Math.floor(Math.random() * 20),
    attackPossession: 20 + Math.floor(Math.random() * 20),
    allowedSpp: 10 + Math.random() * 5,
    avgAttackDuration: 31.2,
    timePerCE: 48.7,
  };

  return {
    homeTeam: HOME_TEAM,
    awayTeam: AWAY_TEAM,
    events: events,
    pressureData: generatePressureData(),
    circleEntries: generateCircleEntries(),
    attackThreatData: Array(12).fill(0).map((_, i) => ({
      interval: `${(i+1)*5}'`,
      [homeTeamName]: Math.floor(Math.random() * 8) + 2,
      [awayTeamName]: Math.floor(Math.random() * 8) + 2,
    })),
    build25Ratio: { home: 0.4 + Math.random() * 0.3, away: 0.4 + Math.random() * 0.3 },
    spp: { home: 8 + Math.random() * 6, away: 8 + Math.random() * 6 },
    matchStats: { home: homeStats, away: awayStats },
    quarterlyStats: generateQuarterlyStats()
  };
}
