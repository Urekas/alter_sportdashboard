
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
}

export interface Tournament {
  id: string;
  name: string;
  startDate: string;
  createdAt: any;
}
