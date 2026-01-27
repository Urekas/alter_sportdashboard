export interface Team {
  name: string;
  color: string;
}

export interface TurnoverEvent {
  x: number; // 0-100 on pitch width
  y: number; // 0-100 on pitch height
  team: string;
}

export interface PressureDataPoint {
  minute: number;
  [teamName: string]: number; // SPP value for each team
}

export interface CircleEntry {
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
    allowedSpp: number;
}

export interface AttackThreatDataPoint {
  quarter: string;
  [teamName: string]: number; // Attack Threat value
}

export interface MatchData {
  homeTeam: Team;
  awayTeam: Team;
  turnovers: TurnoverEvent[];
  pressureData: PressureDataPoint[];
  circleEntries: CircleEntry[];
  attackThreatData: AttackThreatDataPoint[];
  build25Ratio: { home: number; away: number };
  spp: { home: number; away: number };
  matchStats: {
    home: TeamMatchStats;
    away: TeamMatchStats;
  };
}
