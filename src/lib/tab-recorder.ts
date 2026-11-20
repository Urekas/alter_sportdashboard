'use client';
// 영상 분석 화면 녹화 → 파일 (예전 비디오 도구의 "영상 추출"과 같은 방식)
//  - 유튜브는 영상 파일을 직접 받을 수 없어서, 이 탭 화면을 녹화함 → 영상 위 그림도 그대로 들어감
//  - 크롬: 영상 상자만 잘라서 녹화 (Region Capture). 안 되는 브라우저는 캔버스로 잘라 냄
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

export async function startTabRecording(el: HTMLElement): Promise<TabRecording> {
  const display = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: 'browser', frameRate: 30 },
    audio: true,
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
    surfaceSwitching: 'exclude',
  } as DisplayMediaStreamOptions);
  const [track] = display.getVideoTracks();
  let recStream: MediaStream = display;
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
    const v = document.createElement('video');
    v.srcObject = display;
    v.muted = true;
    await v.play();
    await new Promise((r) => (v.readyState >= 1 ? r(null) : (v.onloadedmetadata = () => r(null))));
    const canvas = document.createElement('canvas');
    const r0 = el.getBoundingClientRect();
    canvas.width = Math.round(Math.min(1920, r0.width * devicePixelRatio));
    canvas.height = Math.round((canvas.width * r0.height) / r0.width);
    const ctx = canvas.getContext('2d')!;
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
    stopLoop = () => {
      on = false;
      v.srcObject = null;
    };
    recStream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...display.getAudioTracks()]);
  }

  const { mimeType, ext } = pickMime();
  const rec = new MediaRecorder(recStream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start(1000);
  let ended: (() => void) | null = null;
  track.addEventListener('ended', () => ended?.());

  let done: Promise<{ blob: Blob; ext: string } | null> | null = null;
  return {
    onEnded: (cb) => (ended = cb),
    stop: () =>
      (done ??= new Promise((resolve) => {
        const finish = () => {
          stopLoop();
          display.getTracks().forEach((t) => t.stop());
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
