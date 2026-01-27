import type { TurnoverEvent, MatchData, TeamMatchStats, AttackThreatDataPoint, PressureDataPoint } from './types';

// Based on FIH Field Specifications
const PITCH_LENGTH = 91.4;
const PITCH_WIDTH = 55;
const LANE_WIDTH = PITCH_WIDTH / 3;

/**
 * Parses SportsCode XML data to extract turnover events.
 * @param xmlText The XML content as a string.
 * @param homeTeamName The name of the home team.
 * @param awayTeamName The name of the away team.
 * @returns An array of TurnoverEvent objects.
 */
export const parseXMLData = (xmlText: string, homeTeamName: string, awayTeamName: string): TurnoverEvent[] => {
  if (typeof window === 'undefined') {
    // This function should only run in the browser
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
  const events: TurnoverEvent[] = [];

  Array.from(instances).forEach((instance, index) => {
    const code = instance.getElementsByTagName("code")[0]?.textContent || "";
    
    // 1. Filter for turnover events only
    if (!code.toLowerCase().includes("turnover") && !code.includes("턴오버")) return;

    // 2. Identify the team
    // This is a simplified logic. A real implementation might need to check group labels.
    const team = code.toLowerCase().includes(homeTeamName.toLowerCase()) ? homeTeamName : awayTeamName;

    // 3. Parse location labels
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
    
    // If no specific location label, skip
    if (!locLabel) return;

    // 4. Map Zone Label to X, Y Coordinates
    // Attacking direction is assumed to be Left (0) -> Right (91.4)
    let x = PITCH_LENGTH / 2;
    let y = PITCH_WIDTH / 2;

    // X-axis (Length) mapping
    if (locLabel.includes("Def 25") || locLabel.includes("수비 25")) x = PITCH_LENGTH * 0.125;
    else if (locLabel.includes("Mid") || locLabel.includes("하프")) x = PITCH_LENGTH * 0.5;
    else if (locLabel.includes("Att 25") || locLabel.includes("공격 25")) x = PITCH_LENGTH * 0.875;
    else if (locLabel.includes("Circle") || locLabel.includes("서클")) x = PITCH_LENGTH * 0.95;

    // Y-axis (Width) mapping (Top-down view: Left is top, Right is bottom)
    if (locLabel.includes("Left") || locLabel.includes("좌")) y = LANE_WIDTH / 2;
    else if (locLabel.includes("Right") || locLabel.includes("우")) y = PITCH_WIDTH - (LANE_WIDTH / 2);
    else y = PITCH_WIDTH / 2; // Center

    // Add random jitter to avoid points overlapping perfectly
    x += (Math.random() - 0.5) * 8;
    y += (Math.random() - 0.5) * 8;

    // Ensure coordinates are within pitch boundaries
    x = Math.max(0, Math.min(PITCH_LENGTH, x));
    y = Math.max(0, Math.min(PITCH_WIDTH, y));
    
    events.push({
      id: `evt-${instance.getElementsByTagName("ID")[0]?.textContent || index}`,
      team,
      quarter: "Q1", // This would need to be calculated from XML start time
      time: parseFloat(instance.getElementsByTagName("start")[0]?.textContent || "0"),
      x,
      y,
      locationLabel: locLabel
    });
  });

  return events;
};


/**
 * Parses CSV data to extract turnover events.
 * Assumes CSV format: id,team,quarter,time,x,y,locationLabel
 * @param csvText The CSV content as a string.
 * @returns An array of TurnoverEvent objects.
 */
export const parseCSVData = (csvText: string): TurnoverEvent[] => {
  const events: TurnoverEvent[] = [];
  const lines = csvText.trim().split('\n');
  
  // Return empty if file is empty or only has a header
  if (lines.length < 2) {
    return [];
  }
  
  const headers = lines.shift()!.trim().split(',');

  const idx = {
    id: headers.indexOf('id'),
    team: headers.indexOf('team'),
    quarter: headers.indexOf('quarter'),
    time: headers.indexOf('time'),
    x: headers.indexOf('x'),
    y: headers.indexOf('y'),
    locationLabel: headers.indexOf('locationLabel'),
  };

  if (Object.values(idx).some(i => i === -1)) {
    throw new Error(`CSV must contain headers: id, team, quarter, time, x, y, locationLabel`);
  }

  lines.forEach((line) => {
    if (!line.trim()) return;
    const values = line.trim().split(',');

    const x = parseFloat(values[idx.x]);
    const y = parseFloat(values[idx.y]);
    const time = parseFloat(values[idx.time]);

    if (isNaN(x) || isNaN(y) || isNaN(time)) {
      console.warn("Skipping invalid CSV row:", line);
      return;
    }

    events.push({
      id: values[idx.id],
      team: values[idx.team],
      quarter: values[idx.quarter],
      time,
      x,
      y,
      locationLabel: values[idx.locationLabel],
    });
  });

  return events;
};

// --- Functions to generate other data parts, inspired by lib/data.ts ---

function generatePressureData(homeTeamName: string, awayTeamName: string): PressureDataPoint[] {
  const data = [];
  let homeSpp = 8 + Math.random() * 4;
  let awaySpp = 8 + Math.random() * 4;

  for (let i = 1; i <= 60; i++) {
    homeSpp += (Math.random() - 0.5) * 2;
    awaySpp += (Math.random() - 0.5) * 2;
    homeSpp = Math.max(4, Math.min(20, homeSpp));
    awaySpp = Math.max(4, Math.min(20, awaySpp));

    data.push({
      minute: i,
      [homeTeamName]: parseFloat(homeSpp.toFixed(2)),
      [awayTeamName]: parseFloat(awaySpp.toFixed(2)),
    });
  }
  return data;
}

function generateCircleEntries(): MatchData['circleEntries'] {
    const entries = [];
    const channels: ('Left' | 'Center' | 'Right')[] = ['Left', 'Center', 'Right'];
    const outcomes: ('Goal' | 'Shot On Target' | 'Shot Missed' | 'No Shot')[] = ['Goal', 'Shot On Target', 'Shot Missed', 'No Shot'];
    
    for (let i = 0; i < 40; i++) {
        entries.push({
            channel: channels[Math.floor(Math.random() * channels.length)],
            outcome: outcomes[Math.floor(Math.random() * outcomes.length)],
        });
    }
    return entries;
}

function generateTeamMatchStats(): TeamMatchStats {
    return {
        goals: {
            field: Math.floor(Math.random() * 3),
            pc: Math.floor(Math.random() * 2),
        },
        shots: 8 + Math.floor(Math.random() * 10),
        circleEntries: 15 + Math.floor(Math.random() * 10),
        twentyFiveEntries: 25 + Math.floor(Math.random() * 15),
        possession: 40 + Math.floor(Math.random() * 20),
        allowedSpp: 10 + Math.random() * 5,
    }
}

function generateAttackThreatData(homeTeamName: string, awayTeamName: string): AttackThreatDataPoint[] {
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    return quarters.map(q => ({
        quarter: q,
        [homeTeamName]: Math.floor(Math.random() * 8) + 2,
        [awayTeamName]: Math.floor(Math.random() * 8) + 2,
    }));
}

/**
 * Creates a full MatchData object from parsed turnover events and procedurally generated stats.
 */
export const createMatchDataFromUpload = (
    turnovers: TurnoverEvent[], 
    homeTeamName: string, 
    awayTeamName: string
): MatchData => {
  
  const HOME_TEAM = { name: homeTeamName, color: 'hsl(var(--chart-1))' };
  const AWAY_TEAM = { name: awayTeamName, color: 'hsl(var(--chart-2))' };

  const homeStats = generateTeamMatchStats();
  const awayStats = generateTeamMatchStats();

  // Make possession stat slightly dependent on turnover count
  const homeTurnovers = turnovers.filter(t => t.team === homeTeamName).length;
  const awayTurnovers = turnovers.filter(t => t.team === awayTeamName).length;
  const totalTurnovers = homeTurnovers + awayTurnovers;
  
  if (totalTurnovers > 0) {
    homeStats.possession = Math.round(50 + ((awayTurnovers - homeTurnovers) / totalTurnovers) * 20);
    awayStats.possession = 100 - homeStats.possession;
  }

  return {
    homeTeam: HOME_TEAM,
    awayTeam: AWAY_TEAM,
    turnovers: turnovers,
    pressureData: generatePressureData(homeTeamName, awayTeamName),
    circleEntries: generateCircleEntries(),
    attackThreatData: generateAttackThreatData(homeTeamName, awayTeamName),
    build25Ratio: {
      home: 0.4 + Math.random() * 0.3,
      away: 0.4 + Math.random() * 0.3,
    },
    spp: {
      home: 8 + Math.random() * 6,
      away: 8 + Math.random() * 6,
    },
    matchStats: {
      home: homeStats,
      away: awayStats,
    }
  };
}
