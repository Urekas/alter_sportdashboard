import type { MatchData } from './types';

const HOME_TEAM = { name: 'Blues', color: 'hsl(var(--chart-1))' };
const AWAY_TEAM = { name: 'Reds', color: 'hsl(var(--chart-2))' };

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

function generateTurnovers(): MatchData['turnovers'] {
  const turnovers = [];
  for (let i = 0; i < 150; i++) {
    turnovers.push({
      x: Math.random() * 100,
      y: Math.random() * 100,
      team: Math.random() > 0.55 ? HOME_TEAM.name : AWAY_TEAM.name,
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


export const mockMatchData: MatchData = {
  homeTeam: HOME_TEAM,
  awayTeam: AWAY_TEAM,
  pressureData: generatePressureData(),
  turnovers: generateTurnovers(),
  circleEntries: generateCircleEntries(),
  build25Ratio: {
    home: 0.62,
    away: 0.51,
  },
  spp: {
    home: 9.87,
    away: 11.23,
  },
};
