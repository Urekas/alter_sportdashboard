export interface Team {
  name: string;
  color: string;
}

export interface MatchEvent {
  id: string;
  team: string;
  type: 'turnover' | 'foul';
  quarter: string;
  time: number;
  x: number; // 0 to 91.4 (Meters)
  y: number; // 0 to 55 (Meters)
  locationLabel: string;
}

export interface PressureDataPoint {
  interval: string; // e.g., "3'", "6'"
  [teamName: string]: string | number; // SPP value for each team
}

export interface CircleEntry {
  team: string;
  channel: 'Left' | 'Center' | 'Right';
  outcome: 'Goal' | 'Shot On Target' | 'Shot Missed' | 'No Shot';
}

export interface TeamMatchStats {
    goals: {
        field: number;
        pc: number;
    };
    shots: number;
    circleEntries: number;
    twentyFiveEntries: number;
    possession: number;
    attackPossession: number;
    allowedSpp: number;
}

export interface QuarterStats {
  quarter: string;
  home: Partial<TeamMatchStats> & { spp: number };
  away: Partial<TeamMatchStats> & { spp: number };
}

export interface AttackThreatDataPoint {
  interval: string; // e.g., "5'", "10'"
  [teamName: string]: string | number; // Attack Threat value
}

export interface MatchData {
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
}
