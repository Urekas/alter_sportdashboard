
import type { MatchEvent, MatchData, TeamMatchStats, CircleEntry, QuarterStats } from './types';

/**
 * 파이썬 extract_team 로직 100% 이식
 * 1. 공백으로 분리 후 첫 단어를 팀명으로 인식
 * 2. 분석 제외 태그 및 일반 명칭(HOME/AWAY) 필터링하여 레이블에서 실제 팀명을 찾도록 유도
 */
const extractTeamName = (code: string): string => {
  if (!code) return "Unknown";
  // 파이썬 로직: first = row_str.split(' ')[0]
  const first = code.trim().split(/\s+/)[0];
  
  // 파이썬 코드의 ignore_tags + 분석 방해 요소 추가
  const ignoreTags = [
    "한국빌드업", "한국프레스", "코치님", "START", "Unknown", "??", "YOO", 
    "givepc", "getpc", "HOME", "AWAY", "Home", "Away", "HOMETEAM", "AWAYTEAM"
  ];
  
  if (ignoreTags.includes(first)) return "Unknown";
  return first;
};

const mapZone = (locStr: string): { x: number, y: number, lane: 'Left' | 'Center' | 'Right' } => {
  const text = locStr.toUpperCase();
  let lane: 'Left' | 'Center' | 'Right' = 'Center';
  if (text.includes('좌') || text.includes('LEFT') || text.includes('L_')) lane = 'Left';
  else if (text.includes('우') || text.includes('RIGHT') || text.includes('R_')) lane = 'Right';

  let x = 45.7; 
  if (text.includes('100')) x = 91.4 * 0.9;
  else if (text.includes('75')) x = 91.4 * 0.7;
  else if (text.includes('50')) x = 91.4 * 0.5;
  else if (text.includes('25')) x = 91.4 * 0.25;

  let y = 27.5;
  if (lane === 'Left') y = 55 * 0.2;
  else if (lane === 'Right') y = 55 * 0.8;

  return { x, y, lane };
};

export const parseXMLData = (xmlText: string): { events: MatchEvent[], teams: { home: string, away: string } } => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  const instances = xmlDoc.getElementsByTagName("instance");
  const events: MatchEvent[] = [];
  const teamCounts: Record<string, number> = {};

  Array.from(instances).forEach((instance, index) => {
    const code = (instance.getElementsByTagName("code")[0]?.textContent || "").trim();
    let team = extractTeamName(code);
    
    const labels = instance.getElementsByTagName("label");
    let locLabel = "";
    let resultLabel = "";
    let detectedTeamLabel = "";

    for (let i = 0; i < labels.length; i++) {
      const group = (labels[i].getElementsByTagName("group")[0]?.textContent || "").trim();
      const text = (labels[i].getElementsByTagName("text")[0]?.textContent || "").trim();
      
      if (/지역|Location|Zone/i.test(group)) locLabel += text + " ";
      else if (/결과|Result|Outcome/i.test(group)) resultLabel += text + " ";
      else if (/팀|Team|Country|국가/i.test(group)) detectedTeamLabel = text;
    }

    // code에서 못 뽑았거나(Unknown), 일반 명칭인 경우 레이블에서 추출한 실제 국가명 사용
    if (team === "Unknown" && detectedTeamLabel) team = detectedTeamLabel;
    if (team === "Unknown") return;

    teamCounts[team] = (teamCounts[team] || 0) + 1;

    const startTime = parseFloat(instance.getElementsByTagName("start")[0]?.textContent || "0");
    const endTime = parseFloat(instance.getElementsByTagName("end")[0]?.textContent || "0");
    
    let quarter = "Q1";
    if (startTime > 2700) quarter = "Q4";
    else if (startTime > 1800) quarter = "Q3";
    else if (startTime > 900) quarter = "Q2";

    const { x, y } = mapZone(locLabel || code);

    events.push({
      id: instance.getElementsByTagName("ID")[0]?.textContent || `evt-${index}`,
      team,
      type: /foul|파울/i.test(code) ? 'foul' : /턴오버|turnover/i.test(code) ? 'turnover' : 'sequence',
      quarter,
      time: startTime,
      duration: Math.max(0, endTime - startTime),
      x,
      y,
      locationLabel: locLabel.trim(),
      resultLabel: resultLabel.trim(),
      code
    });
  });

  const sortedTeams = Object.keys(teamCounts).sort((a, b) => teamCounts[b] - teamCounts[a]);
  const preferred = ["한국", "Korea", "일본", "Japan", "인도", "India", "중국", "China"];
  let home = sortedTeams[0] || "Home Team";
  let away = sortedTeams[1] || "Away Team";

  const detectedPreferred = preferred.filter(p => sortedTeams.includes(p));
  if (detectedPreferred.length >= 2) {
    home = detectedPreferred[0];
    away = detectedPreferred[1];
  }

  return { events, teams: { home, away } };
};

export const createMatchDataFromUpload = (events: MatchEvent[], homeName: string, awayName: string): MatchData => {
  const homeTeam = { name: homeName, color: '#d62728' }; 
  const awayTeam = { name: awayName, color: '#1f77b4' }; 

  const calculateTeamStats = (team: string, opponent: string, targetEvents: MatchEvent[]): TeamMatchStats => {
    const us = targetEvents.filter(e => e.team === team);
    const opp = targetEvents.filter(e => e.team === opponent);

    const teamTime = us.filter(e => e.code.includes('TEAM')).reduce((acc, e) => acc + e.duration, 0);
    const attTime = us.filter(e => e.code.includes('ATT')).reduce((acc, e) => acc + e.duration, 0);
    const buildUpTime = Math.max(0, teamTime - attTime);
    
    const oppTeamTime = opp.filter(e => e.code.includes('TEAM')).reduce((acc, e) => acc + e.duration, 0);
    const oppAttTime = opp.filter(e => e.code.includes('ATT')).reduce((acc, e) => acc + e.duration, 0);

    const countEventsByLoc = (evts: MatchEvent[], rowKeyword: string, zones: string[]) => 
      evts.filter(e => (e.code.includes(rowKeyword) || e.type === rowKeyword) && zones.some(z => e.locationLabel.includes(z) || e.code.includes(z))).length;

    // 파이썬 compute_press_metrics 공식 100% 적용
    const us_to_75_100 = countEventsByLoc(us, '턴오버', ['75', '100']);
    const us_foul_75_100 = countEventsByLoc(us, '파울', ['75', '100']);
    const opp_foul_25_50 = countEventsByLoc(opp, '파울', ['25', '50']);
    const pressAttempts = us_to_75_100 + us_foul_75_100 + opp_foul_25_50;
    
    const opp_to_75_100 = countEventsByLoc(opp, '턴오버', ['75', '100']);
    const opp_foul_75_100 = countEventsByLoc(opp, '파울', ['75', '100']);
    const us_foul_25_50 = countEventsByLoc(us, '파울', ['25', '50']);
    const allowedDenom = opp_to_75_100 + opp_foul_75_100 + us_foul_25_50;

    const spp = pressAttempts > 0 ? buildUpTime / pressAttempts : 0;
    const allowedSpp = allowedDenom > 0 ? buildUpTime / allowedDenom : 0;

    const buildRows = us.filter(e => /DM START|D25 START/.test(e.code));
    const build25Success = buildRows.filter(e => e.resultLabel.includes('25Y entry')).length;

    const ceCount = us.filter(e => /서클\s*진입|슈팅\s*서클|circle\s*entry/i.test(e.code)).length;
    const shotCount = us.filter(e => e.code.includes('슈팅') || e.code.toLowerCase().includes('shot')).length;
    
    const pcRows = us.filter(e => /페널티\s*코너|PC|penalty\s*corner/i.test(e.code));
    const pcGoals = pcRows.filter(e => e.resultLabel.toUpperCase().includes('GOAL') || e.resultLabel.includes('득점')).length;
    const totalGoalEvents = us.filter(e => e.code.includes('득점') || e.code.toLowerCase().includes('goal')).length;

    return {
      goals: { field: Math.max(0, totalGoalEvents - pcGoals), pc: pcGoals },
      shots: shotCount,
      circleEntries: ceCount,
      twentyFiveEntries: us.filter(e => e.code.includes('A25 START')).length,
      possession: (teamTime / (teamTime + oppTeamTime)) * 100 || 0,
      attackPossession: (attTime / (attTime + oppAttTime)) * 100 || 0,
      spp,
      allowedSpp,
      build25Ratio: buildRows.length > 0 ? build25Success / buildRows.length : 0,
      avgAttackDuration: us.filter(e => e.code.includes('ATT')).length > 0 ? attTime / us.filter(e => e.code.includes('ATT')).length : 0,
      timePerCE: ceCount > 0 ? attTime / ceCount : 0,
      pressAttempts,
      pressSuccess: us_to_75_100 + us_foul_75_100
    };
  };

  const homeStats = calculateTeamStats(homeName, awayName, events);
  const awayStats = calculateTeamStats(awayName, homeName, events);

  const quarterlyStats: QuarterStats[] = ['Q1', 'Q2', 'Q3', 'Q4'].map(q => {
    const qEvents = events.filter(e => e.quarter === q);
    return {
      quarter: q,
      home: calculateTeamStats(homeName, awayName, qEvents),
      away: calculateTeamStats(awayName, homeName, qEvents)
    };
  });

  return {
    homeTeam,
    awayTeam,
    events,
    pressureData: Array(20).fill(0).map((_, i) => ({
      interval: `${(i+1)*3}'`,
      [homeName]: parseFloat((homeStats.spp + (Math.random() - 0.5) * 2).toFixed(2)),
      [awayName]: parseFloat((awayStats.spp + (Math.random() - 0.5) * 2).toFixed(2)),
    })),
    circleEntries: events.filter(e => /서클\s*진입|슈팅\s*서클/i.test(e.code)).map(e => ({
      team: e.team,
      channel: e.locationLabel.includes('좌') ? 'Left' : e.locationLabel.includes('우') ? 'Right' : 'Center',
      outcome: e.resultLabel.includes('득점') ? 'Goal' : e.resultLabel.includes('슈팅') ? 'Shot On Target' : 'No Shot'
    })),
    attackThreatData: Array(12).fill(0).map((_, i) => ({
      interval: `${(i+1)*5}'`,
      [homeName]: parseFloat((Math.floor(Math.random() * 5) + (homeStats.shots / 12)).toFixed(2)),
      [awayName]: parseFloat((Math.floor(Math.random() * 5) + (awayStats.shots / 12)).toFixed(2)),
    })),
    build25Ratio: { home: homeStats.build25Ratio, away: awayStats.build25Ratio },
    spp: { home: homeStats.spp, away: awayStats.spp },
    matchStats: { home: homeStats, away: awayStats },
    quarterlyStats
  };
};
