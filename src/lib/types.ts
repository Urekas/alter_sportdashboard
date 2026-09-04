
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
  // 슈팅 태깅 도구(public/ShotTagging)의 좌표/분류 라벨. 필드 좌표는 550x230(cm) 기준,
  // 골대 좌표는 366x214(cm) 기준 — 태깅 도구 자체의 캔버스 좌표계와 동일(1:1로 그대로 그릴 수 있음).
  xLoc?: number;
  yLoc?: number;
  xGoal?: number;
  yGoal?: number;
  outDir?: string;     // "OUT Dir" 라벨 — LEFT/RIGHT/UP (골대를 벗어난 방향)
  shotType?: string;   // "Type" 라벨 — hit/push/flick/reverse/tip_in/sweep 등 타격 방식(기술)
  shotOutput?: string; // "Output" 라벨 원본값 — goal/save/block/out/fail (resultLabel과 별개로 보존)
  // 슈팅 상황(필드슛/PC/PS 구분) — 태깅 도구의 커스텀 필드(사용자가 만든 필드라 그룹 이름은
  // 태거마다 다를 수 있음, 예: "슈팅 상황")에서 값 자체가 field_shot/PC_direct/PC_var/PS 중
  // 하나면 그룹 이름과 무관하게 이 필드에 담김(parser.ts 참고). shot-zone-map.tsx의
  // getShotKind()가 이 값을 최우선으로 봄 — shotType(타격 방식)과는 별개의 정보라 필드를 분리함.
  shotSituation?: string;
  // 슈팅 태깅 도구(public/ShotTagging)의 기본 커스텀 필드 2종 — 그룹 이름이 각각
  // "어시스트 유형"/"수비 압박"으로 고정된 기본 템플릿값이라(도구 설정에서 이름을 바꾸지
  // 않는 한) parser.ts가 이 그룹 이름 그대로 매칭해서 담는다. shotSituation과 달리 값이
  // 정해진 패턴이 아니라 자유 텍스트/옵션이라 그룹 이름 매칭 외엔 방법이 없음.
  assistType?: string;      // "어시스트 유형" — 컷백/크로스/스루패스/리바운드/단독돌파/PC인젝션 등
  defensePressure?: string; // "수비 압박" — Low(오픈)/Medium/High(완전압박) 등
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
  channel: 'Left' | 'Center' | 'Right'; // 3방향(단순) — zone5에서 파생됨
  zone5: 'FarLeft' | 'MidLeft' | 'Center' | 'MidRight' | 'FarRight'; // 5방향(세부): 좌_25/CE_L 45/중_25/CE_R 45/우_25
  outcome: 'Goal' | 'Shot On Target' | 'Shot Missed' | 'No Shot';
}

export interface AttackThreatDataPoint {
  interval: string;
  [teamName: string]: string | number;
}

// TMS 라인업 붙여넣기 파서(src/lib/lineup-parser.ts)의 결과물.
export interface LineupPlayer {
  number: string;
  name: string;
  isCaptain?: boolean;
  isGoalkeeper?: boolean;
  minutes?: string; // "Min" 칸 원본값 (숫자 또는 "X")
  quarters?: string[]; // "1st/2nd/3rd/4th" 칸 중 값이 있는 것만 — 정확한 의미는 확정 못 해서 원문 그대로 보존
}
export interface TeamLineup {
  teamName: string; // TMS에 적힌 팀명 원문 (예: "Italy") — matchData.homeTeam/awayTeam.name과 다를 수 있어 배정이 필요
  players: LineupPlayer[];
  coach?: string;
  coachStats?: string[];
  manager?: string;
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
  lineups?: { home?: TeamLineup; away?: TeamLineup }; // TMS 라인업 붙여넣기 결과 (선택적)
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
