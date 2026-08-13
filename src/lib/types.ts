
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

export interface Tournament {
  id: string;
  name: string;
  startDate: string;
  createdAt: any;
  category?: string; // 예: "여자대표팀", "남자대표팀" — 대회를 상위 그룹으로 묶는 용도
}
