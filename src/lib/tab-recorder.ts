'use client';
// 이 탭 화면 공유 하나로 두 가지를 함 (공유 허락은 페이지 열 때마다 한 번)
//  1) 정지 화면 찍기: 유튜브는 멈추면 제목·가운데 재생 버튼·로고를 영상 위에 띄우고, 영상 픽셀은 직접 못 읽음
//     → 재생 중(유튜브 UI 없음)인 순간을 탭 화면에서 잘라 캔버스에 붙여 두고 그 위에 그림 (grabFrame)
//  2) 녹화: 영상 상자만 잘라서 파일로 (그림 포함). 예전 비디오 도구의 "영상 추출"과 같은 방식
//  - 크롬: Region Capture로 잘라 녹화. 안 되는 브라우저는 캔버스로 잘라 냄
//  - 소리: 공유 창에서 "탭 오디오 공유"가 켜져 있으면 같이 들어감

export interface TabRecording {
  stop: () => Promise<{ blob: Blob; ext: string } | null>;
  /** 사용자가 브라우저의 "공유 중지"를 눌러 끝났을 때 */
  onEnded: (cb: () => void) => void;
}

function pickMime(): { mimeType: string; ext: string } {
  const cands: [string, string][] = [
    ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'mp4'],
    ['video/mp4;codecs=avc1,mp4a.40.2', 'mp4'],
    ['video/mp4', 'mp4'],
    ['video/webm;codecs=vp9,opus', 'webm'],
    ['video/webm;codecs=vp8,opus', 'webm'],
    ['video/webm', 'webm'],
  ];
  for (const [m, ext] of cands) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return { mimeType: m, ext };
  return { mimeType: '', ext: 'webm' };
}

export function canRecordTab(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia && typeof MediaRecorder !== 'undefined';
}
/** 정지 화면 찍기를 쓸 수 있나 (휴대폰 브라우저는 화면 공유가 없음 — 대신 휴대폰 유튜브는 멈춤 UI도 거의 없음) */
export function canGrabTab(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;
}

// ── 공유 세션 (한 번 허락받으면 페이지 닫을 때까지 재사용) ──
interface Session {
  stream: MediaStream;
  video: HTMLVideoElement; // 탭 전체 화면이 흐르는 숨은 비디오 (정지 화면·캔버스 녹화용)
}
let session: Session | null = null;
let pending: Promise<Session> | null = null;

export function hasTabSession() {
  return !!session;
}

export function tabSession(): Promise<Session> {
  if (session) return Promise.resolve(session);
  if (pending) return pending;
  pending = (async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      // 크기를 크게 요청하면 크롬이 탭을 고해상도로 찍음(기본은 화면 픽셀 그대로라 작은 영상 상자는 흐릿함)
      video: { displaySurface: 'browser', frameRate: 30, width: { ideal: 3840 }, height: { ideal: 2160 } },
      audio: true,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      surfaceSwitching: 'exclude',
    } as DisplayMediaStreamOptions);
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    await new Promise((r) => (video.videoWidth ? r(null) : (video.onloadedmetadata = () => r(null))));
    const s: Session = { stream, video };
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      if (session === s) session = null;
    });
    session = s;
    return s;
  })().finally(() => (pending = null));
  return pending;
}

/** 탭 화면에서 el 자리를 잘라 out 캔버스에 그림 (공유 세션이 있어야 함) */
export function grabFrame(el: HTMLElement, out: HTMLCanvasElement): boolean {
  const s = session;
  if (!s || !s.video.videoWidth) return false;
  const r = el.getBoundingClientRect();
  const sx = s.video.videoWidth / window.innerWidth;
  const sy = s.video.videoHeight / window.innerHeight;
  out.width = Math.round(Math.min(s.video.videoWidth, r.width * sx));
  out.height = Math.round(Math.min(s.video.videoHeight, r.height * sy));
  const ctx = out.getContext('2d');
  if (!ctx) return false;
  ctx.drawImage(s.video, r.left * sx, r.top * sy, r.width * sx, r.height * sy, 0, 0, out.width, out.height);
  return true;
}

/** 화면이 실제로 바뀐 뒤(공유 화면에 반영될 때까지) 기다림 */
//  (rAF는 탭이 가려지면 멈추므로 시간으로도 끝나게)
export const nextFrames = (n = 3) =>
  new Promise<void>((res) => {
    const t = setTimeout(res, 60 + n * 40);
    const step = (k: number) => (k <= 0 ? (clearTimeout(t), res()) : requestAnimationFrame(() => step(k - 1)));
    step(n);
  });

export async function startTabRecording(el: HTMLElement): Promise<TabRecording> {
  const s = await tabSession();
  const base = s.stream.getVideoTracks()[0];
  // 세션 트랙은 정지 화면 찍기에도 쓰니 그대로 두고, 녹화용으로 복제해서 자름
  const track = base.clone();
  const audio = s.stream.getAudioTracks().map((t) => t.clone());
  let recStream = new MediaStream([track, ...audio]);
  let stopLoop = () => {};

  const W = window as unknown as { CropTarget?: { fromElement: (e: Element) => Promise<unknown> } };
  const cropTo = (track as unknown as { cropTo?: (t: unknown) => Promise<void> }).cropTo;
  let cropped = false;
  if (W.CropTarget && cropTo) {
    try {
      await cropTo.call(track, await W.CropTarget.fromElement(el));
      cropped = true;
    } catch {
      /* 다른 탭을 고른 경우 등 — 아래 캔버스 방식 */
    }
  }
  if (!cropped) {
    // 탭 전체 화면에서 영상 상자 자리만 캔버스로 잘라 냄
    track.stop();
    const canvas = document.createElement('canvas');
    const r0 = el.getBoundingClientRect();
    canvas.width = Math.round(Math.min(1920, r0.width * devicePixelRatio));
    canvas.height = Math.round((canvas.width * r0.height) / r0.width);
    const ctx = canvas.getContext('2d')!;
    const v = s.video;
    let on = true;
    const draw = () => {
      if (!on) return;
      const r = el.getBoundingClientRect();
      const sx = v.videoWidth / window.innerWidth;
      const sy = v.videoHeight / window.innerHeight;
      ctx.drawImage(v, r.left * sx, r.top * sy, r.width * sx, r.height * sy, 0, 0, canvas.width, canvas.height);
      requestAnimationFrame(draw);
    };
    draw();
    stopLoop = () => (on = false);
    recStream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...audio]);
  }

  const { mimeType, ext } = pickMime();
  const rec = new MediaRecorder(recStream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 16_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start(1000);
  let ended: (() => void) | null = null;
  base.addEventListener('ended', () => ended?.());

  let done: Promise<{ blob: Blob; ext: string } | null> | null = null;
  return {
    onEnded: (cb) => (ended = cb),
    stop: () =>
      (done ??= new Promise((resolve) => {
        const finish = () => {
          stopLoop();
          recStream.getTracks().forEach((t) => t.stop()); // 복제본만 멈춤 — 공유 세션은 유지
          resolve(chunks.length ? { blob: new Blob(chunks, { type: mimeType || 'video/webm' }), ext } : null);
        };
        if (rec.state === 'inactive') return finish();
        rec.onstop = finish;
        rec.stop();
      })),
  };
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}
