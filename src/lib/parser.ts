import type { MatchEvent, MatchData, TeamMatchStats, AttackThreatDataPoint, PressureDataPoint, CircleEntry } from './types';

// Based on FIH Field Specifications
const PITCH_LENGTH = 91.4;
const PITCH_WIDTH = 55;
const LANE_WIDTH = PITCH_WIDTH / 3;

/**
 * Parses SportsCode XML data to extract match events.
 */
export const parseXMLData = (xmlText: string, homeTeamName: string, awayTeamName: string): MatchEvent[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  
  const parseError = xmlDoc.querySelector("parsererror");
  if (parseError) {
    console.error("XML Parsing Error:", parseError);
    throw new Error("Failed to parse XML. Please check the file format.");
  }
  
  const instances = xmlDoc.getElementsByTagName("instance");
  const events: MatchEvent[] = [];

  Array.from(instances).forEach((instance, index) => {
    const code = instance.getElementsByTagName("code")[0]?.textContent || "";
    
    // Identify event type
    let type: 'turnover' | 'foul' = 'turnover';
    if (code.toLowerCase().includes("foul") || code.includes("파울")) {
      type = 'foul';
    } else if (!code.toLowerCase().includes("turnover") && !code.includes("턴오버")) {
      return; // Skip other codes
    }

    const team = code.toLowerCase().includes(homeTeamName.toLowerCase()) ? homeTeamName : awayTeamName;

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
    
    events.push({
      id: `evt-${instance.getElementsByTagName("ID")[0]?.textContent || index}`,
      team,
      type,
      quarter: "Q1",
      time: parseFloat(instance.getElementsByTagName("start")[0]?.textContent || "0"),
      x,
      y,
      locationLabel: locLabel
    });
  });

  return events;
};


/**
 * Parses CSV data to extract match events.
 */
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
    const x = parseFloat(values[idx.x]);
    const y = parseFloat(values[idx.y]);
    const time = parseFloat(values[idx.time]);

    events.push({
      id: values[idx.id],
      team: values[idx.team],
      type: (values[idx.type] as 'turnover' | 'foul') || 'turnover',
      quarter: values[idx.quarter],
      time,
      x,
      y,
      locationLabel: values[idx.locationLabel],
    });
  });

  return events;
};

function generatePressureData(homeTeamName: string, awayTeamName: string): PressureDataPoint[] {
  const data: PressureDataPoint[] = [];
  let homeSppBase = 8 + Math.random() * 4;
  let awaySppBase = 8 + Math.random() * 4;
  for (let i = 1; i <= 20; i++) {
    const minute = i * 3;
    const hSpp = homeSppBase + (Math.random() - 0.5) * 3;
    const aSpp = awaySppBase + (Math.random() - 0.5) * 3;
    data.push({
      interval: `${minute}'`,
      [homeTeamName]: parseFloat(Math.max(4, Math.min(20, hSpp)).toFixed(2)),
      [awayTeamName]: parseFloat(Math.max(4, Math.min(20, aSpp)).toFixed(2)),
    });
  }
  return data;
}

function generateCircleEntries(homeTeamName: string, awayTeamName: string): MatchData['circleEntries'] {
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
}

function generateTeamMatchStats(): TeamMatchStats {
    return {
        goals: { field: Math.floor(Math.random() * 3), pc: Math.floor(Math.random() * 2) },
        shots: 8 + Math.floor(Math.random() * 10),
        circleEntries: 15 + Math.floor(Math.random() * 10),
        twentyFiveEntries: 25 + Math.floor(Math.random() * 15),
        possession: 40 + Math.floor(Math.random() * 20),
        allowedSpp: 10 + Math.random() * 5,
    }
}

function generateAttackThreatData(homeTeamName: string, awayTeamName: string): AttackThreatDataPoint[] {
    const data: AttackThreatDataPoint[] = [];
    for (let i = 1; i <= 12; i++) {
        const minute = i * 5;
        data.push({
            interval: `${minute}'`,
            [homeTeamName]: Math.floor(Math.random() * 8) + 2,
            [awayTeamName]: Math.floor(Math.random() * 8) + 2,
        });
    }
    return data;
}

export const createMatchDataFromUpload = (
    events: MatchEvent[], 
    homeTeamName: string, 
    awayTeamName: string
): MatchData => {
  const HOME_TEAM = { name: homeTeamName, color: 'hsl(var(--chart-1))' };
  const AWAY_TEAM = { name: awayTeamName, color: 'hsl(var(--chart-2))' };
  const homeStats = generateTeamMatchStats();
  const awayStats = generateTeamMatchStats();

  return {
    homeTeam: HOME_TEAM,
    awayTeam: AWAY_TEAM,
    events: events,
    pressureData: generatePressureData(homeTeamName, awayTeamName),
    circleEntries: generateCircleEntries(homeTeamName, awayTeamName),
    attackThreatData: generateAttackThreatData(homeTeamName, awayTeamName),
    build25Ratio: { home: 0.4 + Math.random() * 0.3, away: 0.4 + Math.random() * 0.3 },
    spp: { home: 8 + Math.random() * 6, away: 8 + Math.random() * 6 },
    matchStats: { home: homeStats, away: awayStats }
  };
}
