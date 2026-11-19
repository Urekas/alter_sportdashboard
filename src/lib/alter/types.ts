// Alter Live(src/shared/types.ts)에서 그대로 복사 — 고칠 때는 Alter Live 쪽과 같이
// 공용 데이터 모델. 타임라인은 Sportscode .SCTimeline(JSON)과 같은 모양을 유지해서
// 패키지 안의 타임라인 파일을 그대로 Sportscode 쪽 구조와 대조할 수 있게 함.

export interface Label {
  group: string;
  name: string;
}

export interface Instance {
  uniqueId: string;
  instanceNum: number;
  startTime: number; // 녹화 시작 기준 초
  endTime: number;
  labels: Label[];
  notes: string;
}

export interface Row {
  uniqueId: string;
  rowNum: number;
  name: string;
  color: string; // #RRGGBB
  instances: Instance[];
}

export interface Timeline {
  uniqueId: string;
  startTime: string | null; // 녹화 시작 시각 (ISO)
  rows: Row[];
}

// ---- 코드윈도우 ----

import type { LocConfig } from './location';

export type ButtonKind = 'code' | 'label' | 'text' | 'output' | 'chart' | 'location';
// Sportscode CWLink.m_type: 0=deactivation, 1=activation, 2=exclusive
export type LinkType = 'deactivation' | 'activation' | 'exclusive';

export interface Hotkey {
  key: string; // 표시용 (예: "g")
  code: string; // KeyboardEvent.code (예: "KeyG") — 한/영 상태와 무관하게 물리 키로 매칭
  // 같이 눌러야 하는 키 (없으면 그 키만 — 예전 단축키 그대로). mod = 윈도우 Ctrl / 맥 ⌘
  shift?: boolean;
  mod?: boolean;
  alt?: boolean;
}

export interface CWButton {
  id: string;
  kind: ButtonKind;
  name: string; // code: 행 이름 / label: 라벨 텍스트
  group: string; // label 버튼의 라벨 그룹 (Sportscode m_secondaryName)
  frame: { x: number; y: number; w: number; h: number };
  color: string; // 배경 #RRGGBB
  textColor: string;
  fontSize: number;
  fontName?: string; // 맥 글꼴 이름 (예: Helvetica-BoldOblique) — 굵게/기울임 표시와 저장에 씀
  // 스크립트 결과 글자 (Sportscode m_outputStringAttributes — 버튼 이름 글자와 따로: 실제 리포트는 검정 15/18/24px, 일부 빨강·파랑)
  outputColor?: string;
  outputFontSize?: number;
  outputFontName?: string;
  hotkey: Hotkey | null;
  leadTime: number; // 초. 시작 시점을 이만큼 앞당김
  lagTime: number | null; // null이면 토글(두 번 눌러 종료), 숫자면 한 번 누르면 lead~lag 구간 자동 생성
  extra?: Record<string, boolean | number | string>; // 불러온 Sportscode 버튼 설정 중 따로 다루지 않는 단순 값들 — 저장할 때 그대로 되돌려 씀 (호환 유지)
  chartModel?: Record<string, boolean | number | string>; // Coding.ChartModel의 단순 값들 (차트 종류 등)
  identifier?: string; // Sportscode 버튼 식별자 (m_identifier) — 스크립트의 button name "..." / color #"..."가 이걸로 찾음
  bgImage?: { width: number; height: number; rgbaZ: string; png: string }; // Sportscode 버튼 배경 이미지 (rgbaZ = 원본 zlib RGBA base64, png = 화면 표시용 data URL)
  showTitle?: boolean; // false면 이름을 표시하지 않음 (Sportscode m_showTitle — 배경 패널용 버튼)
  script?: string; // output/chart 버튼의 Sportscode 스크립트 (리포트용, 추후 실행)
  loc?: LocConfig; // location: 위치 태깅 판 (경기장·골대) 설정
}

export interface CWLink {
  from: string;
  to: string;
  type: LinkType;
}

export interface CodeWindow {
  extra?: Record<string, boolean | number | string>; // 창 설정 중 따로 다루지 않는 단순 값들 (투명도, 링크 표시 방식 등)
  name: string;
  width: number;
  height: number;
  background: string;
  buttons: CWButton[];
  links: CWLink[];
}

// ---- 녹화 ----

export interface CaptureDevice {
  name: string;
  kind: 'video' | 'audio';
  id: string; // ffmpeg 입력 지정자에 쓰는 값 (dshow 이름 / avfoundation 인덱스)
}

export interface AngleConfig {
  index: number;
  videoDevice: string;
  audioDevice: string | null;
  label: string;
  /** 영상 주소로 녹화 (IP카메라 rtsp://, 온라인 스트림 https://….m3u8, 유튜브 주소) — 있으면 장비 대신 이걸 씀 */
  url?: string;
  /** 장비 이름 (맥은 장비를 번호로 여는데 캡처보드를 꽂고 빼면 번호가 바뀜 → 이름으로 다시 찾음) */
  videoName?: string;
  audioName?: string;
}

export interface AngleStatus {
  index: number;
  label: string;
  state: 'starting' | 'recording' | 'reconnecting' | 'paused' | 'stopped' | 'error';
  startedAt: string | null; // 첫 세그먼트 기준 시각 (ISO) — 앵글 간 싱크 오프셋 계산용
  gaps?: { at: number; gap: number }[]; // 자동 재시작으로 영상이 빠진 구간 (shared/sync.ts)
  restarts?: number;
  error?: string;
  playlistUrl: string;
  previewUrl: string;
}

export interface RecordingStatus {
  active: boolean;
  packageDir: string | null;
  startedAt: string | null; // 마스터(첫 앵글) 시작 시각
  pausedAt: string | null; // 일시정지 중이면 멈춘 시각
  pausedTotal: number; // 끝난 일시정지들의 합(초) — 녹화 시계 = 경과 - 이 값
  sessionStartedAt?: string | null; // 녹화 시작 버튼을 누른 시각 (첫 세그먼트 전에도 경과 시간을 보여주는 용도)
  /** 영상 받아 따로 코딩: 이 PC는 녹화하지 않고 상대 녹화를 복사해 오는 중 (시각은 상대 녹화 기준) */
  watch?: boolean;
  angles: AngleStatus[];
}

export interface ServerInfo {
  port: number;
  addresses: string[]; // LAN에서 접속 가능한 주소들
}

// ---- 화질 ----

export type Resolution = 'source' | '1080' | '720' | '540' | '480';
export type QualityLevel = 'high' | 'medium' | 'low';

export interface RecordQuality {
  resolution: Resolution;
  quality: QualityLevel;
  fps: 'source' | '60' | '30' | '25';
  inputSize: 'auto' | '3840x2160' | '1920x1080' | '1280x720'; // 장비에 요청할 입력 형식 (자동이면 장비 기본값 — 웹캠은 640x480으로 열리기도 함)
  inputFps: 'auto' | '60' | '59.94' | '50' | '30' | '29.97' | '25';
  /** 저사양 모드 (없으면 기기에 따라 자동: 구형 맥 = 켬). 실시간 화면 15fps·640px, 맥은 nv12로 받아 색 변환 생략 + B프레임 끔. 녹화 파일 화질은 그대로 */
  lowSpec?: boolean;
}

// 기본값 = Sportscode 기본 녹화와 같은 수준: 1080p, 약 8.3Mbps, 프레임은 장비 그대로(캡처 장비 1080p60이면 60fps)
export const defaultRecordQuality: RecordQuality = { resolution: '1080', quality: 'high', fps: 'source', inputSize: '1920x1080', inputFps: 'auto' };

/** 저장 파일 형식 — 안의 영상(H.264)은 같고 담는 상자만 다름. MP4 = 어디서나 재생 / MOV = Sportscode·맥 기본 */
export type VideoContainer = 'mp4' | 'mov';

// ---- 클립 / 플레이리스트 ----

export interface Clip {
  id: string;
  row: string;
  start: number; // 타임라인 초
  end: number;
  labels: Label[];
  notes: string;
}

export interface Playlist {
  id: string;
  name: string;
  clips: Clip[];
}

export interface ExportOptions {
  kind: 'clips' | 'full'; // full = 경기 전체 영상
  container?: VideoContainer;
  mode: 'separate' | 'combined';
  resolution: Resolution;
  quality: QualityLevel | 'copy'; // copy = 재인코딩 없이 원본 그대로 (빠름, 시작점이 최대 1초 어긋날 수 있음)
  angles: number[];
  padBefore: number;
  padAfter: number;
  outDir: string;
  baseName: string;
}

export interface ExportProgress {
  done: number;
  total: number;
  current: string;
  finished?: boolean;
  error?: string;
  files?: string[];
}
