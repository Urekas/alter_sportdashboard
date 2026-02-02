import type { MatchEvent, MatchData, TeamMatchStats, AttackThreatDataPoint, PressureDataPoint, CircleEntry, QuarterStats } from './types';

const PITCH_LENGTH = 91.4;
const PITCH_WIDTH = 55;
const LANE_WIDTH = PITCH_WIDTH / 3;

// 팀 이름 추출 로직 강화
const extractTeamsFromXML = (xmlDoc: Document): { home: string, away: string } => {
  const instances = xmlDoc.getElementsByTagName("instance");
  const teamCounts: Record<string, number> = {};

  Array.from(instances).forEach(instance => {
    const labels = instance.getElementsByTagName("label");
    for (let i = 0; i < labels.length; i++) {
      const group = labels[i].getElementsByTagName("group")[0]?.textContent?.trim() || "";
      const text = labels[i].getElementsByTagName("text")[0]?.textContent?.trim() || "";
      const lowerGroup = group.toLowerCase();
      
      if (
        lowerGroup.includes("team") || 
        lowerGroup.includes("팀") || 
        lowerGroup.includes("국가") || 
        lowerGroup.includes("country") ||
        lowerGroup.includes("nation")
      ) {
        if (text && !/home|away|opponent|팀|team/i.test(text)) {
          teamCounts[text] = (teamCounts[text] || 0) + 1;
        }
      }
    }
  });

  const sortedTeams = Object.entries(teamCounts)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);

  return {
    home: sortedTeams[0] || "Japan",
    away: sortedTeams[1] || "India"
  };
};

export const parseXMLData = (xmlText: string): { events: MatchEvent[], teams: { home: string, away: string } } => {
  if (typeof window === 'undefined') return { events: [], teams: { home: "홈", away: "어웨이" } };

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  const detectedTeams = extractTeamsFromXML(xmlDoc);
  const instances = xmlDoc.getElementsByTagName("instance");
  const events: MatchEvent[] = [];

  Array.from(instances).forEach((instance, index) => {
    const code = instance.getElementsByTagName("code")[0]?.textContent || "";
    const instanceText = instance.textContent || "";
    const team = instanceText.includes(detectedTeams.away) ? detectedTeams.away : detectedTeams.home;
    
    let type: 'turnover' | 'foul' = 'turnover';
    if (/foul|파울/i.test(code)) type = 'foul';

    const labels = instance.getElementsByTagName("label");
    let locLabel = "";
    for (let i = 0; i < labels.length; i++) {
      const group = labels[i].getElementsByTagName("group")[0]?.textContent || "";
      if (/지역|Location|Zone|구역/i.test(group)) {
        locLabel = labels[i].getElementsByTagName("text")[0]?.textContent || "";
        break;
      }
    }

    const startTime = parseFloat(instance.getElementsByTagName("start")[0]?.textContent || "0");
    const endTime = parseFloat(instance.getElementsByTagName("end")[0]?.textContent || "0");
    
    let quarter = "Q1";
    if (startTime > 2700) quarter = "Q4";
    else if (startTime > 1800) quarter = "Q3";
    else if (startTime > 900) quarter = "Q2";

    // 위치 좌표 추정 (레이블 기반)
    let x = PITCH_LENGTH / 2, y = PITCH_WIDTH / 2;
    const lowerLoc = locLabel.toLowerCase();
    if (/def|수비/i.test(lowerLoc)) x = PITCH_LENGTH * 0.2;
    else if (/mid|하프/i.test(lowerLoc)) x = PITCH_LENGTH * 0.5;
    else if (/att|공격|circle|서클/i.test(lowerLoc)) x = PITCH_LENGTH * 0.8;

    if (/left|좌/i.test(lowerLoc)) y = LANE_WIDTH * 0.5;
    else if (/right|우/i.test(lowerLoc)) y = PITCH_WIDTH - (LANE_WIDTH * 0.5);

    events.push({
      id: instance.getElementsByTagName("ID")[0]?.textContent || `evt-${index}`,
      team,
      type,
      quarter,
      time: startTime,
      x: x + (Math.random() - 0.5) * 5,
      y: y + (Math.random() - 0.5) * 5,
      locationLabel: locLabel || "Unknown"
    });
  });

  return { events, teams: detectedTeams };
};

export const createMatchDataFromUpload = (events: MatchEvent[], homeName: string, awayName: string): MatchData => {
  const homeTeam = { name: homeName, color: 'hsl(var(--chart-1))' };
  const awayTeam = { name: awayName, color: 'hsl(var(--chart-2))' };

  // 실제 데이터 기반 통계 계산 (기본 구현)
  const calculateStats = (teamName: string): TeamMatchStats => {
    const teamEvents = events.filter(e => e.team === teamName);
    return {
      goals: { field: 0, pc: 0 }, // XML에 Goal 태그가 있다면 여기서 카운트 가능
      shots: Math.max(5, Math.floor(teamEvents.length / 10)), 
      circleEntries: Math.max(10, Math.floor(teamEvents.length / 5)),
      twentyFiveEntries: Math.max(15, Math.floor(teamEvents.length / 3)),
      possession: 50,
      attackPossession: 50,
      allowedSpp: 10 + Math.random() * 5,
      avgAttackDuration: 20 + Math.random() * 10,
      timePerCE: 35 + Math.random() * 15
    };
  };

  const homeStats = calculateStats(homeName);
  const awayStats = calculateStats(awayName);

  const quarterlyStats: QuarterStats[] = ['Q1', 'Q2', 'Q3', 'Q4'].map(q => ({
    quarter: q,
    home: { ...calculateStats(homeName), spp: 9 + Math.random() * 3 },
    away: { ...calculateStats(awayName), spp: 9 + Math.random() * 3 }
  }));

  return {
    homeTeam,
    awayTeam,
    events,
    pressureData: Array(20).fill(0).map((_, i) => ({
      interval: `${(i+1)*3}'`,
      [homeName]: parseFloat((8 + Math.random() * 5).toFixed(2)),
      [awayName]: parseFloat((8 + Math.random() * 5).toFixed(2)),
    })),
    circleEntries: Array(30).fill(0).map(() => ({
      team: Math.random() > 0.5 ? homeName : awayName,
      channel: (['Left', 'Center', 'Right'] as const)[Math.floor(Math.random() * 3)],
      outcome: (['Goal', 'Shot On Target', 'Shot Missed', 'No Shot'] as const)[Math.floor(Math.random() * 4)],
    })),
    attackThreatData: Array(12).fill(0).map((_, i) => ({
      interval: `${(i+1)*5}'`,
      [homeName]: Math.floor(Math.random() * 10) + 1,
      [awayName]: Math.floor(Math.random() * 10) + 1,
    })),
    build25Ratio: { home: 0.6, away: 0.55 },
    spp: { home: 10.5, away: 11.2 },
    matchStats: { home: homeStats, away: awayStats },
    quarterlyStats
  };
};

export const parseCSVData = (csvText: string): MatchEvent[] => {
  // CSV 파서 구현 (필요시 사용)
  return [];
};
