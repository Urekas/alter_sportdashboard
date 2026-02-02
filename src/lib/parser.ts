import type { MatchEvent, MatchData, TeamMatchStats, AttackThreatDataPoint, PressureDataPoint, CircleEntry, QuarterStats } from './types';

// FIH 경기장 규격 기준
const PITCH_LENGTH = 91.4;
const PITCH_WIDTH = 55;
const LANE_WIDTH = PITCH_WIDTH / 3;

const extractTeamsFromXML = (xmlDoc: Document): { home: string, away: string } => {
  const instances = xmlDoc.getElementsByTagName("instance");
  const teamCounts: Record<string, number> = {};

  Array.from(instances).forEach(instance => {
    const labels = instance.getElementsByTagName("label");
    for (let i = 0; i < labels.length; i++) {
      const group = labels[i].getElementsByTagName("group")[0]?.textContent?.trim() || "";
      const text = labels[i].getElementsByTagName("text")[0]?.textContent?.trim() || "";
      const lowerGroup = group.toLowerCase();
      
      // 실제 국가명/팀명이 들어있을 가능성이 높은 그룹들 확인 (레이블 그룹 우선)
      if (
        lowerGroup.includes("team") || 
        lowerGroup.includes("팀") || 
        lowerGroup.includes("국가") || 
        lowerGroup.includes("country") ||
        lowerGroup.includes("nation") ||
        lowerGroup.includes("name")
      ) {
        const lowerText = text.toLowerCase();
        // "home team", "away team", "opponent" 등 제너릭한 이름은 제외하고 수집
        if (text && 
            !lowerText.includes("home") && 
            !lowerText.includes("away") && 
            !lowerText.includes("opponent") && 
            !lowerText.includes("팀") &&
            !lowerText.includes("team")) {
          teamCounts[text] = (teamCounts[text] || 0) + 1;
        }
      }
    }

    // Code 태그에서도 추출 시도 (레이블에서 못 찾았을 경우 대비)
    const code = instance.getElementsByTagName("code")[0]?.textContent || "";
    const cleanedCode = code
      .replace(/turnover/gi, "")
      .replace(/foul/gi, "")
      .replace(/턴오버/g, "")
      .replace(/파울/g, "")
      .replace(/[-]/g, "")
      .trim();
    
    const lowerCode = cleanedCode.toLowerCase();
    if (cleanedCode && 
        cleanedCode.length > 1 && 
        !lowerCode.includes("home") && 
        !lowerCode.includes("away") && 
        !lowerCode.includes("opponent") &&
        !lowerCode.includes("team")) {
      teamCounts[cleanedCode] = (teamCounts[cleanedCode] || 0) + 1;
    }
  });

  const sortedTeams = Object.entries(teamCounts)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);

  // 실제 이름이 감지되지 않으면 기본값 사용
  return {
    home: sortedTeams[0] || "홈 팀",
    away: sortedTeams[1] || (sortedTeams[0] ? "상대 팀" : "어웨이 팀")
  };
};

export const parseXMLData = (xmlText: string): { events: MatchEvent[], teams: { home: string, away: string } } => {
  if (typeof window === 'undefined') {
    return { events: [], teams: { home: "홈 팀", away: "어웨이 팀" } };
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

    // 팀 판별: 코드나 레이블 텍스트에 감지된 팀명이 있는지 확인
    const instanceText = instance.textContent || "";
    const team = instanceText.includes(detectedTeams.away) ? detectedTeams.away : detectedTeams.home;

    const labels = instance.getElementsByTagName("label");
    let locLabel = "";
    for (let i = 0; i < labels.length; i++) {
      const group = labels[i].getElementsByTagName("group")[0]?.textContent || "";
      const text = labels[i].getElementsByTagName("text")[0]?.textContent || "";
      
      if (group === "지역" || group === "Location" || group === "Zone" || group === "구역") {
        locLabel = text;
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

    const lowerLoc = locLabel.toLowerCase();
    if (lowerLoc.includes("def 25") || lowerLoc.includes("수비 25")) x = PITCH_LENGTH * 0.125;
    else if (lowerLoc.includes("mid") || lowerLoc.includes("하프")) x = PITCH_LENGTH * 0.5;
    else if (lowerLoc.includes("att 25") || lowerLoc.includes("공격 25")) x = PITCH_LENGTH * 0.875;
    else if (lowerLoc.includes("circle") || lowerLoc.includes("서클")) x = PITCH_LENGTH * 0.95;

    if (lowerLoc.includes("left") || lowerLoc.includes("좌")) y = LANE_WIDTH / 2;
    else if (lowerLoc.includes("right") || lowerLoc.includes("우")) y = PITCH_WIDTH - (LANE_WIDTH / 2);
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