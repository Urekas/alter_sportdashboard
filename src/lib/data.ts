import type { MatchData, TeamMatchStats, AttackThreatDataPoint, TurnoverEvent } from './types';

const HOME_TEAM = { name: 'Blues', color: 'hsl(var(--chart-1))' };
const AWAY_TEAM = { name: 'Reds', color: 'hsl(var(--chart-2))' };

const PITCH_LENGTH = 91.4;
const PITCH_WIDTH = 55;

function generatePressureData(): MatchData['pressureData'] {
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
      [HOME_TEAM.name]: parseFloat(homeSpp.toFixed(2)),
      [AWAY_TEAM.name]: parseFloat(awaySpp.toFixed(2)),
    });
  }
  return data;
}

function generateTurnovers(): TurnoverEvent[] {
  const turnovers: TurnoverEvent[] = [];
  for (let i = 0; i < 150; i++) {
    const team = Math.random() > 0.55 ? HOME_TEAM.name : AWAY_TEAM.name;
    turnovers.push({
      id: `evt-${i}`,
      team,
      quarter: `Q${Math.floor(i / 38) + 1}`,
      time: (i % 38) * 40,
      x: Math.random() * PITCH_LENGTH,
      y: Math.random() * PITCH_WIDTH,
      locationLabel: 'Mock Location',
    });
  }
  return turnovers;
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

function generateAttackThreatData(): AttackThreatDataPoint[] {
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    return quarters.map(q => ({
        quarter: q,
        [HOME_TEAM.name]: Math.floor(Math.random() * 8) + 2, // Random threat between 2 and 9
        [AWAY_TEAM.name]: Math.floor(Math.random() * 8) + 2,
    }));
}

export const mockMatchData: MatchData = {
  homeTeam: HOME_TEAM,
  awayTeam: AWAY_TEAM,
  pressureData: generatePressureData(),
  turnovers: generateTurnovers(),
  circleEntries: generateCircleEntries(),
  attackThreatData: generateAttackThreatData(),
  build25Ratio: {
    home: 0.62,
    away: 0.51,
  },
  spp: {
    home: 9.87,
    away: 11.23,
  },
  matchStats: {
    home: generateTeamMatchStats(),
    away: generateTeamMatchStats(),
  }
};
