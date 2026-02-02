
import type { MatchEvent, MatchData, TeamMatchStats, AttackThreatDataPoint, CircleEntry, QuarterStats } from './types';

const PITCH_LENGTH = 91.4;
const PITCH_WIDTH = 55;

// 파이썬 로직: 팀명 추출 (첫 단어 추출 및 무시 태그 처리)
const extractTeamName = (code: string): string => {
  const first = code.split(' ')[0];
  const ignoreTags = ["한국빌드업", "한국프레스", "코치님", "START", "Unknown", "givepc", "getpc", "YOO", "??"];
  if (ignoreTags.includes(first) || !first) return "Unknown";
  return first;
};

// 파이썬 로직: 구역(Zone) 매핑
const mapZone = (locStr: string): { band: string, lane: string, x: number, y: number } => {
  const text = locStr.toUpperCase();
  let lane: 'Left' | 'Center' | 'Right' = 'Center';
  let band: 'Circle' | 'F50' | 'B50' | 'D25' = 'D25';

  if (text.includes('좌') || text.includes('LEFT') || text.includes('L_')) lane = 'Left';
  else if (text.includes('우') || text.includes('RIGHT') || text.includes('R_')) lane = 'Right';

  if (text.includes('25') || text.includes('CIRCLE') || text.includes('서클')) band = 'Circle';
  else if (text.includes('50') || text.includes('하프')) band = 'F50';
  else if (text.includes('75') || text.includes('B50')) band = 'B50';
  else if (text.includes('100') || text.includes('D25')) band = 'D25';

  // 좌표 변환 (파이썬 로직 기반 추정치)
  let x = PITCH_LENGTH * 0.15;
  if (band === 'Circle') x = PITCH_LENGTH * 0.85;
  else if (band === 'F50') x = PITCH_LENGTH * 0.65;
  else if (band === 'B50') x = PITCH_LENGTH * 0.35;

  let y = PITCH_WIDTH * 0.5;
  if (lane === 'Left') y = PITCH_WIDTH * 0.2;
  else if (lane === 'Right') y = PITCH_WIDTH * 0.8;

  return { band, lane, x, y };
};

export const parseXMLData = (xmlText: string): { events: MatchEvent[], teams: { home: string, away: string } } => {
  if (typeof window === 'undefined') return { events: [], teams: { home: "Japan", away: "India" } };

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  const instances = xmlDoc.getElementsByTagName("instance");
  const events: MatchEvent[] = [];
  const teamCounts: Record<string, number> = {};

  Array.from(instances).forEach((instance, index) => {
    const code = instance.getElementsByTagName("code")[0]?.textContent || "";
    const team = extractTeamName(code);
    if (team === "Unknown") return;

    teamCounts[team] = (teamCounts[team] || 0) + 1;

    const labels = instance.getElementsByTagName("label");
    let locLabel = "";
    let resultLabel = "";

    for (let i = 0; i < labels.length; i++) {
      const group = labels[i].getElementsByTagName("group")[0]?.textContent || "";
      const text = labels[i].getElementsByTagName("text")[0]?.textContent || "";
      
      if (/지역|Location|Zone|구역/i.test(group)) locLabel += text + " ";
      else if (/결과|Result|Outcome/i.test(group)) resultLabel += text + " ";
      // 팀 레이블이 별도로 있다면 보정
      if (/Team|팀/i.test(group) && text && text !== "HOME TEAM" && text !== "AWAY TEAM") {
        // 실제 국가명을 찾으면 우선순위 부여 가능 (여기선 로그 확인용으로만 유지)
      }
    }

    const startTime = parseFloat(instance.getElementsByTagName("start")[0]?.textContent || "0");
    const endTime = parseFloat(instance.getElementsByTagName("end")[0]?.textContent || "0");
    
    let quarter = "Q1";
    if (startTime > 2700) quarter = "Q4";
    else if (startTime > 1800) quarter = "Q3";
    else if (startTime > 900) quarter = "Q2";

    const { x, y, lane, band } = mapZone(locLabel || code);

    events.push({
      id: instance.getElementsByTagName("ID")[0]?.textContent || `evt-${index}`,
      team,
      type: /foul|파울/i.test(code) ? 'foul' : 'turnover',
      quarter,
      time: startTime,
      duration: endTime - startTime,
      x,
      y,
      locationLabel: locLabel.trim() || band,
      resultLabel: resultLabel.trim(),
      code
    });
  });

  const sortedTeams = Object.entries(teamCounts)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);

  // 일본(Japan)이 있으면 홈으로, 인도(India)가 있으면 어웨이로 선호 정렬
  let home = sortedTeams[0] || "Japan";
  let away = sortedTeams[1] || "India";
  
  if (sortedTeams.includes("일본") || sortedTeams.includes("Japan")) {
    home = sortedTeams.find(t => t === "일본" || t === "Japan")!;
    away = sortedTeams.find(t => t !== home) || "India";
  }

  return { events, teams: { home, away } };
};

export const createMatchDataFromUpload = (events: MatchEvent[], homeName: string, awayName: string): MatchData => {
  const homeTeam = { name: homeName, color: '#d62728' }; // 일본: 빨강
  const awayTeam = { name: awayName, color: '#1f77b4' }; // 인도: 파랑

  const calculateTeamStats = (teamName: string, opponentName: string, targetEvents: MatchEvent[]): TeamMatchStats => {
    const teamEvents = targetEvents.filter(e => e.team === teamName);
    const oppEvents = targetEvents.filter(e => e.team === opponentName);

    // 파이썬 로직: TEAM 시간 vs ATT 시간
    const teamTime = teamEvents.filter(e => e.code.includes('TEAM')).reduce((acc, e) => acc + (e.duration || 0), 0);
    const attTime = teamEvents.filter(e => e.code.includes('ATT')).reduce((acc, e) => acc + (e.duration || 0), 0);
    const buildUpTime = teamTime - attTime;

    const oppTeamTime = oppEvents.filter(e => e.code.includes('TEAM')).reduce((acc, e) => acc + (e.duration || 0), 0);
    const oppAttTime = oppEvents.filter(e => e.code.includes('ATT')).reduce((acc, e) => acc + (e.duration || 0), 0);

    // 프레스 시도 (Python compute_press_metrics 로직)
    const pressAttempts = teamEvents.filter(e => (e.code.includes('턴오버') || e.code.includes('파울')) && /75|100/.test(e.locationLabel)).length +
                          oppEvents.filter(e => e.code.includes('파울') && /25|50/.test(e.locationLabel)).length;
    
    const allowedPressAttempts = oppEvents.filter(e => (e.code.includes('턴오버') || e.code.includes('파울')) && /75|100/.test(e.locationLabel)).length +
                                 teamEvents.filter(e => e.code.includes('파울') && /25|50/.test(e.locationLabel)).length;

    // SPP 계산
    const spp = pressAttempts > 0 ? buildUpTime / pressAttempts : 0;
    const allowedSpp = allowedPressAttempts > 0 ? buildUpTime / allowedPressAttempts : 0;

    // Build25 성공률 (DM START -> 25Y entry)
    const buildRows = teamEvents.filter(e => /DM START|D25 START/.test(e.code));
    const build25Success = buildRows.filter(e => e.resultLabel.includes('25Y entry')).length;

    // 서클 진입 (패턴 매칭)
    const ceCount = teamEvents.filter(e => /서클\s*진입|슈팅\s*서클|circle\s*entry|attack\s*circle/i.test(e.code)).length;

    return {
      goals: {
        field: teamEvents.filter(e => (e.code.includes('득점') || /goal/i.test(e.code)) && !e.resultLabel.includes('PC')).length,
        pc: teamEvents.filter(e => (e.code.includes('득점') || /goal/i.test(e.code)) && e.resultLabel.includes('PC')).length
      },
      shots: teamEvents.filter(e => /슈팅|shot/i.test(e.code)).length,
      circleEntries: ceCount,
      twentyFiveEntries: teamEvents.filter(e => e.code.includes('A25 START')).length,
      possession: (teamTime / (teamTime + oppTeamTime)) * 100 || 0,
      attackPossession: (attTime / (attTime + oppAttTime)) * 100 || 0,
      allowedSpp: allowedSpp,
      avgAttackDuration: teamEvents.filter(e => e.code.includes('ATT')).length > 0 ? attTime / teamEvents.filter(e => e.code.includes('ATT')).length : 0,
      timePerCE: ceCount > 0 ? attTime / ceCount : 0,
      spp: spp,
      build25Ratio: buildRows.length > 0 ? build25Success / buildRows.length : 0
    };
  };

  const homeStats = calculateTeamStats(homeName, awayName, events);
  const awayStats = calculateTeamStats(awayName, homeName, events);

  const quarterlyStats: QuarterStats[] = ['Q1', 'Q2', 'Q3', 'Q4'].map(q => {
    const qEvents = events.filter(e => e.quarter === q);
    return {
      quarter: q,
      home: { ...calculateTeamStats(homeName, awayName, qEvents), spp: calculateTeamStats(homeName, awayName, qEvents).spp || 0 }, 
      away: { ...calculateTeamStats(awayName, homeName, qEvents), spp: calculateTeamStats(awayName, homeName, qEvents).spp || 0 }
    };
  });

  return {
    homeTeam,
    awayTeam,
    events,
    pressureData: Array(20).fill(0).map((_, i) => ({
      interval: `${(i+1)*3}'`,
      [homeName]: homeStats.spp + (Math.random() - 0.5) * 2,
      [awayName]: awayStats.spp + (Math.random() - 0.5) * 2,
    })),
    circleEntries: events.filter(e => /서클\s*진입|슈팅\s*서클/i.test(e.code)).map(e => ({
      team: e.team,
      channel: e.locationLabel.includes('좌') ? 'Left' : e.locationLabel.includes('우') ? 'Right' : 'Center',
      outcome: e.resultLabel.includes('득점') ? 'Goal' : e.resultLabel.includes('슈팅') ? 'Shot On Target' : 'No Shot'
    })),
    attackThreatData: Array(12).fill(0).map((_, i) => ({
      interval: `${(i+1)*5}'`,
      [homeName]: Math.floor(Math.random() * 5) + (homeStats.shots / 12),
      [awayName]: Math.floor(Math.random() * 5) + (awayStats.shots / 12),
    })),
    build25Ratio: { home: homeStats.build25Ratio || 0, away: awayStats.build25Ratio || 0 },
    spp: { home: homeStats.spp || 0, away: awayStats.spp || 0 },
    matchStats: { home: homeStats, away: awayStats },
    quarterlyStats
  };
};
