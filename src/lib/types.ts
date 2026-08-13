
export interface Team {
  name: string;
  color: string;
}

export interface MatchEvent {
  id: string;
  team: string;
  type: 'turnover' | 'foul' | 'goal' | 'shot' | 'pc' | 'sequence';
  quarter: string;
  time: number;
  duration: number;
  x: number;
  y: number;
  locationLabel: string;
  resultLabel: string;
  code: string;
  relatedPlayer?: string; // 득점자/선방·블록 선수 등, 사후에 입력하는 관련 선수 메모
  shooter?: string;   // 슈팅 태깅 도구의 "Player" 라벨 — 슈터
  defender?: string;  // 슈팅 태깅 도구의 "GK_Player" 라벨 — 막은 선수(골키퍼/필드 블로커)
}

export interface TeamMatchStats {
  goals: {
    field: number;
    pc: number;
  };
  shots: number;
  pcs: number;
  circleEntries: number;
  twentyFiveEntries: number;
  possession: number;
  attackPossession: number;
  buildUpStagnation: number; // 빌드업 정체 비율 (상대진영 - 우리진영) / 전체
  pcSuccessRate: number;
  allowedSpp: number;
  avgAttackDuration: number;
  timePerCE: number;
  spp: number;
  build25Ratio: number;
  pressAttempts: number;
  pressSuccess: number;
}

export interface QuarterStats {
  quarter: string;
  home: TeamMatchStats;
  away: TeamMatchStats;
}

export interface PressureDataPoint {
  interval: string;
  [teamName: string]: string | number;
}

export interface CircleEntry {
  team: string;
  channel: 'Left' | 'Center' | 'Right';
  outcome: 'Goal' | 'Shot On Target' | 'Shot Missed' | 'No Shot';
}

export interface AttackThreatDataPoint {
  interval: string;
  [teamName: string]: string | number;
}

export interface MatchData {
  id?: string;
  tournamentId?: string;
  tournamentName?: string;
  matchName?: string;
  orderIndex?: number;
  matchNumber?: number; // 일정표의 "Match #"와 연결하는 키 — 참조 자동치환에 사용
  homeTeam: Team;
  awayTeam: Team;
  events: MatchEvent[];
  pressureData: PressureDataPoint[];
  circleEntries: CircleEntry[];
  attackThreatData: AttackThreatDataPoint[];
  build25Ratio: { home: number; away: number };
  spp: { home: number; away: number };
  matchStats: {
    home: TeamMatchStats;
    away: TeamMatchStats;
  };
  quarterlyStats: QuarterStats[];
  uploadedAt?: any;
  videoMatchId?: string;
  rawSourceText?: string;     // 업로드한 XML/CSV 원본 텍스트 (재다운로드용)
  rawSourceFileName?: string; // 원본 파일 이름
}

export interface ScheduleEntry {
  matchNumber: number;
  dateTime: string;   // 원문 그대로 보관 (예: "15 Aug 2026 13:00")
  homeRef: string;    // 확정팀 코드("IND") 또는 참조 문자열("3rd Pool B", "Winner 47")
  awayRef: string;
  stage: string;      // 괄호 안 스테이지 표기 (예: "D", "SF", "1/2")
  venue: string;
  score?: string;     // 원문 스코어 그대로 (예: "3 - 2", "1 - 1 (3 - 1 SO)", "-"면 미정)
  status?: string;    // Upcoming / Official 등 원문 그대로
}

// 스테이지 라벨(예: "Final", "3/4") 하나가 최종순위 몇 위/몇 위를 결정하는지 사용자가 지정한 매핑.
// 예: { "Final": { winnerRank: 1, loserRank: 2 }, "3/4": { winnerRank: 3, loserRank: 4 } }
export interface FinalStandingRule {
  winnerRank: number;
  loserRank?: number;
}

export interface Tournament {
  id: string;
  name: string;
  startDate: string;
  description?: string; // 대회 개요 — 사용자가 직접 작성(자동수집 아님)
  schedule?: ScheduleEntry[];
  finalStandingsRules?: Record<string, FinalStandingRule>;
  createdAt: any;
  category?: string; // 예: "여자대표팀", "남자대표팀" — 대회를 상위 그룹으로 묶는 용도
}
