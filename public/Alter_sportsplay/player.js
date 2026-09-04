import { db, collection, getDocs, query, orderBy, limit, where } from './firebase-config.js';

export let player;       // cam1 (전술캠1)
export let player2;      // cam2 (전술캠2)
export let player3;      // cam3 (전술캠3)
export let player4;      // cam4 (중계캠)
export let isPlayerReady = false;
export let allEvents = [];
export let currentPlaylist = [];
let currentPlaylistIndex = -1;
let playingSingleClip = false;
let checkTimeInterval = null;
let currentClipEnd = 0;
export let activeMatchId = null; // 현재 분석 중인 경기 ID
export const playlistCart = new Set(); // 공유 선택 카트 (이벤트 ID 저장)
let isPlayer2Ready = false;
let isPlayer3Ready = false;
let isPlayer4Ready = false;
let activeCam = 1; // 카메라 전환(switchCam)이 참조하는 현재 활성 카메라 번호 — 선언이 빠져 있어서
                    // strict mode(ES 모듈은 항상 strict) 아래서 switchCam 호출 시 ReferenceError로
                    // 매번 조용히 실패하고 있었음(전술캠/중계캠 전환이 전혀 안 되던 원인).

// 카메라별 동기화 오프셋(초) — matches.video_offsets에서 옴(대시보드 영상 연결 다이얼로그에서
// 수동 입력하거나 stream.json 업로드로 자동 채움). 공식은 슈팅태깅 도구(ShotTagging/index.html)
// 실제 동기화 로직과 동일: "경기 클럭 시간 = 그 카메라 영상 자체 시간 + 오프셋". 예전엔 이 오프셋이
// 저장만 되고 재생/탐색 어디서도 실제로 안 쓰여서, 오프셋이 0이 아닌 카메라는 항상 몇 초씩
// 어긋난 지점을 보여주고 있었음(카메라 전환 시 재동기화도 아예 안 됐음) — 전부 이걸로 고침.
let cameraOffsets = { 1: 0, 2: 0, 3: 0, 4: 0 };
export function setCameraOffsets(offsets) {
  cameraOffsets = {
    1: Number(offsets?.tactical_cam1) || 0,
    2: Number(offsets?.tactical_cam2) || 0,
    3: Number(offsets?.tactical_cam3) || 0,
    4: Number(offsets?.broadcast_cam) || 0,
  };
}
function camOffset(n) { return cameraOffsets[n] || 0; }
// 현재 활성 카메라의 재생 위치를 "경기 클럭"(모든 카메라 공통 기준) 시간으로 환산
function getMatchClockTime() {
  const pl = getActivePlayer();
  if (!pl || typeof pl.getCurrentTime !== 'function') return 0;
  return pl.getCurrentTime() + camOffset(activeCam);
}
// 경기 클럭 시간을 지금 활성 카메라의 영상 자체 시간으로 환산해서 그 지점으로 이동.
// 카메라 offset은 "그 시간까지는(경기 클럭이 offset에 도달하기 전까지는) 이 카메라 영상이
// 재생되면 안 되고, 그 시간 이후부터 재생이 시작된다"는 뜻(Sportscode 다중캠 싱크와 동일) —
// 그래서 targetRaw가 음수로 나오면(아직 이 카메라가 녹화 시작 전인 시점) 단순히 0으로 clamp만
// 해서 "일단 맨 앞으로 옮겨두는" 게 다가 아니라, **재생을 시작하면 안 됨**을 호출한 쪽에 알려줘야
// 함 — 그래서 실제로 재생 가능한 상태인지(hasStarted)를 반환값으로 알려줌.
export function seekActiveToMatchTime(matchTime) {
  const pl = getActivePlayer();
  if (!isPlayerReady || !pl || typeof pl.seekTo !== 'function') return false;
  const targetRaw = matchTime - camOffset(activeCam);
  const hasStarted = targetRaw >= 0;
  pl.seekTo(Math.max(0, targetRaw), true);
  return hasStarted;
}

const playPauseBtn = document.getElementById('play-pause-btn');
const speedBtn     = document.getElementById('speed-btn');
const eventsUl     = document.getElementById('events-ul') || document.createElement('ul');

// 1. YouTube IFrame API Initialization (3 players)
export function initPlayer() {
  const pv = { playsinline:1, controls:0, rel:0, disablekb:1, modestbranding:1, showinfo:0 };
  const initialVideoId = window.targetVideoId || '';

  player = new YT.Player('youtube-player-1', {
    height:'100%', width:'100%', videoId: initialVideoId,
    playerVars: pv,
    events: { 'onReady': onPlayerReady, 'onStateChange': onPlayerStateChange }
  });

  player2 = new YT.Player('youtube-player-2', {
    height:'100%', width:'100%', videoId: '',
    playerVars: pv,
    // onStateChange도 cam1과 동일 핸들러로 연결 — 지금 활성 카메라가 이 카메라일 때만 재생/정지
    // 버튼 라벨을 갱신하도록 onPlayerStateChange 안에서 걸러줌(안 그러면 백그라운드에서 자동재생
    // 중인 안 보이는 카메라의 상태변화가 화면에 보이는 다른 카메라의 버튼을 잘못 바꿔버림).
    events: { 'onReady': ()=>{ isPlayer2Ready=true; }, 'onStateChange': onPlayerStateChange }
  });

  player3 = new YT.Player('youtube-player-3', {
    height:'100%', width:'100%', videoId: '',
    playerVars: pv,
    events: { 'onReady': ()=>{ isPlayer3Ready=true; }, 'onStateChange': onPlayerStateChange }
  });

  player4 = new YT.Player('youtube-player-4', {
    height:'100%', width:'100%', videoId: '',
    playerVars: pv,
    events: { 'onReady': ()=>{ isPlayer4Ready=true; }, 'onStateChange': onPlayerStateChange }
  });

  // 카메라 전환 버튼
  document.getElementById('cam1-btn')?.addEventListener('click',()=>switchCam(1));
  document.getElementById('cam2-btn')?.addEventListener('click',()=>switchCam(2));
  document.getElementById('cam3-btn')?.addEventListener('click',()=>switchCam(3));
  document.getElementById('cam4-btn')?.addEventListener('click',()=>switchCam(4));
}

function switchCam(n) {
  if (n === activeCam) return;

  // 전환 전 활성 카메라 기준으로 "지금 경기 클럭으로 몇 초 지점"인지, 재생 중이었는지 기록
  const matchTime = getMatchClockTime();
  const prevPlayer = getActivePlayer();
  const wasPlaying = isPlayerReady && prevPlayer && typeof prevPlayer.getPlayerState === 'function'
    && prevPlayer.getPlayerState() === YT.PlayerState.PLAYING;

  activeCam = n;
  const wrappers = [null,
    document.getElementById('player-wrapper-1'),
    document.getElementById('player-wrapper-2'),
    document.getElementById('player-wrapper-3'),
    document.getElementById('player-wrapper-4')
  ];
  const btns = [null,
    document.getElementById('cam1-btn'),
    document.getElementById('cam2-btn'),
    document.getElementById('cam3-btn'),
    document.getElementById('cam4-btn')
  ];
  [1,2,3,4].forEach(i=>{
    if(wrappers[i]){
      wrappers[i].style.opacity = (i===n)?'1':'0';
      wrappers[i].style.pointerEvents = (i===n)?'auto':'none';
    }
    btns[i]?.classList.toggle('active', i===n);
    if(btns[i]) {
      btns[i].style.backgroundColor = (i===n)?'' : 'var(--surface-strong)';
      btns[i].style.color = (i===n)?'' : 'var(--text-main)';
    }
  });
  // 활성 플레이어를 전역에 노출 (drawing.js에서 사용)
  const activePlayer = n===1?player : n===2?player2 : n===3?player3 : player4;
  window._activeSportsplayPlayer = activePlayer;

  // 새로 활성화된 카메라를 오프셋 반영해서 같은 경기 클럭 지점으로 재동기화 — 예전엔 전환만 하고
  // 재생 위치는 그대로 안 맞춰줘서 카메라를 바꾸면 다른 순간이 보이는 문제가 있었음.
  if (activePlayer && typeof activePlayer.seekTo === 'function') {
    const targetRaw = matchTime - camOffset(n);
    const hasStarted = targetRaw >= 0; // 이 카메라가 지금 경기 클럭 시점에 이미 녹화를 시작했는지
    activePlayer.seekTo(Math.max(0, targetRaw), true);
    // offset 의미: "그 시간까지는 이 카메라 영상이 재생되면 안 되고, 그 시간 이후부터 재생 시작"
    // — 아직 시작 전(hasStarted=false)이면 재생 중이었어도 강제로 정지, 시작 안내만 띄움.
    if (!hasStarted) {
      if (typeof activePlayer.pauseVideo === 'function') activePlayer.pauseVideo();
      showCameraNotStartedFlash();
    } else if (wasPlaying && typeof activePlayer.playVideo === 'function') {
      activePlayer.playVideo();
    } else if (typeof activePlayer.pauseVideo === 'function') {
      activePlayer.pauseVideo();
    }
  }
}

// 카메라가 아직 녹화 시작 전인 시점으로 이동하게 됐을 때 안내 플래시 — #tap-seek-flash(더블탭/
// 더블클릭 5초탐색용으로 만든 요소)를 재사용, 가운데에 좀 더 오래 표시.
let notStartedFlashTimeout = null;
function showCameraNotStartedFlash() {
  const flash = document.getElementById('tap-seek-flash');
  if (!flash) return;
  flash.textContent = '이 카메라는 아직 촬영 시작 전이에요';
  flash.className = 'center show';
  clearTimeout(notStartedFlashTimeout);
  notStartedFlashTimeout = setTimeout(() => { flash.className = ''; }, 1800);
}

function onPlayerReady(event) {
  isPlayerReady = true;
  window._p1Ready = true;
  window._activeSportsplayPlayer = player; // 기본 활성 플레이어 = cam1
  console.log("YouTube Player 1 is ready.");
  
  if (window.targetVideoId) {
    player.loadVideoById(window.targetVideoId);
    window.targetVideoId = null; // consume it
  }
}


function onPlayerStateChange(event) {
  // cam1/cam2/cam3 전부 같은 핸들러를 씀 — 지금 화면에 안 보이는(비활성) 카메라가 백그라운드에서
  // 자동재생되며 상태변화를 일으켜도 재생/정지 버튼이 잘못 바뀌지 않도록, 실제로 이 이벤트를
  // 일으킨 플레이어가 지금 활성 카메라일 때만 UI를 갱신함.
  if (event.target !== getActivePlayer()) return;
  // YT.PlayerState.PLAYING = 1, PAUSED = 2
  if (event.data === YT.PlayerState.PLAYING) {
    playPauseBtn.textContent = '⏸ 일시 정지';
    startTrackingTime();
  } else {
    playPauseBtn.textContent = '▶️ 재생';
    stopTrackingTime();
  }
  updateDrawModeMask();
}

// 그리기 모드는 항상 영상을 정지시키고 시작함(drawModeBtn 클릭 → pausePlayer()) — 정지 상태가
// 되면 유튜브 iframe이 (controls:0이어도) 자체 UI(제목바/추천영상 등)를 그 위에 띄우는데, 이게
// 지금은 투명한 그리기 캔버스 아래로 그대로 비쳐서 방해가 됨. 재생 중일 땐 원본 밝기를 그대로
// 보고 싶다는 요청이 있어서(어둡게 깔면 안 됨) — "그리기 모드 + 정지 상태"일 때만 어둡게 가려서
// 유튜브 UI를 감추고, 재생을 다시 누르면(호버 시 하단 컨트롤로 가능) 바로 밝아지게 함.
export function updateDrawModeMask() {
  const cc = document.querySelector('.canvas-container');
  if (!cc) return;
  const pl = getActivePlayer();
  const isPlaying = isPlayerReady && pl && typeof pl.getPlayerState === 'function' && pl.getPlayerState() === YT.PlayerState.PLAYING;
  cc.classList.toggle('yt-ui-masked', !isPlaying);
}

export function pausePlayer() {
  const activePlayer = window._activeSportsplayPlayer;
  if (activePlayer && typeof activePlayer.pauseVideo === 'function') {
    activePlayer.pauseVideo();
  }
  updateDrawModeMask(); // 실제 YT onStateChange 이벤트보다 먼저 즉시 반영(체감 지연 최소화)
}

// 카메라별 영상 로드 (app.js에서 사용 - ES Module 내부 참조)
export function loadVideoInCam(cam, videoId) {
  if (!videoId) return;
  const pl = cam === 1 ? player : cam === 2 ? player2 : cam === 3 ? player3 : player4;
  if (pl && typeof pl.loadVideoById === 'function') {
    pl.loadVideoById(videoId);
  } else if (cam === 1) {
    // 플레이어 아직 준비 안 된 경우 → 초기화 시 로드
    window.targetVideoId = videoId;
  }
}

// 2. Data Fetching & Code Viewer Rendering (Right Panel)
export async function fetchAndRenderEvents() {
  try {
    eventsUl.innerHTML = '<li style="color: var(--text-muted); font-size: 0.9em; padding: 10px;">데이터를 불러오는 중...</li>';
    
    // 최대 1000개까지 한 번에 로드 (필요시 페이지네이션)
    const q = query(collection(db, "Events"), orderBy("start_time", "asc"), limit(1000));
    const querySnapshot = await getDocs(q);
    
    allEvents = [];
    currentPlaylist = [];
    eventsUl.innerHTML = '';
    
    if (querySnapshot.empty) {
      eventsUl.innerHTML = '<li style="color: var(--text-muted); font-size: 0.9em; padding: 10px;">저장된 이벤트 데이터가 없습니다. 먼저 Admin에서 등록해주세요.</li>';
      return;
    }

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      data.id = doc.id;
      allEvents.push(data);
    });

    applyFiltersAndRender();
    
    // 검색창 동적 필터링 바인딩
    const searchInput = document.getElementById('event-search');
    if (searchInput) {
      searchInput.removeEventListener('input', applyFiltersAndRender);
      searchInput.addEventListener('input', applyFiltersAndRender);
    }
    
  } catch(error) {
    console.error("Error fetching events:", error);
    eventsUl.innerHTML = '<li style="color: red; font-size: 0.9em; padding: 10px;">데이터를 불러오지 못했습니다. Firestore 규칙을 확인해주세요.</li>';
  }
}

// 특정 경기 하나의 이벤트를 제한 없이(match_id로 스코프) 전부 불러와서 allEvents에 병합합니다.
// fetchAndRenderEvents()는 Explorer의 여러 경기 가로질러 찾아보기용으로 전체 Events 컬렉션에서
// start_time 오름차순 1000개만 가져오는데(성능상 필요한 상한), 경기가 여러 개 쌓이면 이 전역
// 1000개 캡 안에 지금 보고 있는 경기의 이벤트가 다 안 들어가는 경우가 실제로 생김(한 경기당
// 1000~1300개씩이라 6경기만 돼도 전체가 5900개를 넘음) — 특정 경기를 열어서 볼 때(Viewer)
// "왼쪽 이벤트를 눌러도 그 장면으로 안 간다"는 문제가 바로 이거였음: 리스트에 실제로는 안 뜨거나
// 잘못 잘린 채 표시되고 있었던 것. 경기를 열 때마다 이 함수로 그 경기 이벤트만 확실하게(캡 없이)
// 다시 채워서 해결.
export async function fetchEventsForMatch(matchId) {
  if (!matchId) return;
  try {
    const q = query(collection(db, "Events"), where("match_id", "==", matchId));
    const snap = await getDocs(q);
    const fresh = [];
    snap.forEach((d) => { const data = d.data(); data.id = d.id; fresh.push(data); });
    // 기존에 (전역 1000개 캡으로) 섞여 들어와 있던 이 경기의 불완전한 항목들을 지우고 온전한
    // 세트로 교체 — 다른 경기 항목(Explorer 브라우징용)은 그대로 둠.
    allEvents = allEvents.filter((e) => e.match_id !== matchId).concat(fresh);
    applyFiltersAndRender();
  } catch (error) {
    console.error(`Error fetching events for match ${matchId}:`, error);
  }
}

export function applyFiltersAndRender() {
  const searchInput = document.getElementById('event-search');
  const searchText = searchInput ? searchInput.value.toLowerCase() : '';
  
  currentPlaylist = allEvents.filter(ev => {
    // 1. 현재 선택된 경기(activeMatchId) 데이터만 표시 (격리)
    if (activeMatchId && ev.match_id !== activeMatchId) return false;
    
    // 2. 검색어 필터링
    const rawSearchTarget = `${ev.code || ''} ${JSON.stringify(ev.labels || {})} ${ev.team || ''}`.toLowerCase();
    if (searchText && !rawSearchTarget.includes(searchText)) return false;
    
    return true;
  });
  
  renderCodeViewer(currentPlaylist);
}

export function setActiveMatch(matchId) {
  activeMatchId = matchId;
  applyFiltersAndRender();
}

export function updateCurrentPlaylist(newList) {
  currentPlaylist = newList;
  renderCodeViewer(currentPlaylist);
}

export function updateCartUI() {
  const count = playlistCart.size;
  const cartCountValFields = document.querySelectorAll('.cart-count-val');
  const cartCountSpan = document.getElementById('cart-count'); // Legacy ID for compat
  const btnCreatePlaylist = document.getElementById('btn-create-playlist');
  const btnBatchCapture = document.getElementById('btn-batch-capture');
  const btnCreatePlaylistRight = document.getElementById('btn-create-playlist-right');
  const btnBatchCaptureRight = document.getElementById('btn-batch-capture-right');
  const modalCartCount = document.getElementById('modal-cart-count');

  if (cartCountValFields) cartCountValFields.forEach(el => el.textContent = count);
  if (cartCountSpan) cartCountSpan.textContent = count;
  if (modalCartCount) modalCartCount.textContent = count;
  
  const display = count > 0 ? 'block' : 'none';
  if (btnCreatePlaylist) btnCreatePlaylist.style.display = display;
  if (btnBatchCapture)   btnBatchCapture.style.display   = display;
  if (btnCreatePlaylistRight) btnCreatePlaylistRight.style.display = display;
  if (btnBatchCaptureRight)   btnBatchCaptureRight.style.display   = display;
}

export function renderCodeViewer(events) {
  eventsUl.innerHTML = '';
  
  const organizerHeader = document.createElement('li');
  organizerHeader.style.padding = '10px';
  organizerHeader.style.borderBottom = '1px solid var(--border-color)';
  organizerHeader.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:8px;">
      <button id="btn-play-all" class="primary-btn" style="width:100%; margin-top:0; background:#34495e;">📝 필터링 전체 재생 (Organizer)</button>
      <div style="display:flex; gap:5px;">
        <button id="btn-right-select-all" class="secondary-btn" style="flex:1; font-size:0.75rem;">전체 선택</button>
        <button id="btn-right-deselect-all" class="secondary-btn" style="flex:1; font-size:0.75rem;">전체 해제</button>
      </div>
    </div>
  `;
  eventsUl.appendChild(organizerHeader);
  
  document.getElementById('btn-play-all').addEventListener('click', () => {
    playOrganizerPlaylist(events);
  });

  document.getElementById('btn-right-select-all').addEventListener('click', () => {
    events.forEach(ev => {
        playlistCart.add(ev.id);
    });
    renderCodeViewer(events); // Re-render to show checks
    updateCartUI();
  });

  document.getElementById('btn-right-deselect-all').addEventListener('click', () => {
    events.forEach(ev => {
        playlistCart.delete(ev.id);
    });
    renderCodeViewer(events);
    updateCartUI();
  });

  // --- Grouping by Code (Sorted Alphabetically) ---
  const grouped = {};
  events.forEach((ev, idx) => {
    const code = ev.code || "Uncategorized";
    if (!grouped[code]) grouped[code] = [];
    grouped[code].push({ event: ev, playlistIndex: idx });
  });

  // 가나다/알파벳 순으로 코드명 정렬
  const sortedCodes = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'ko'));

  for (const code of sortedCodes) {
    const items = grouped[code];
    const groupLi = document.createElement('li');
    groupLi.className = 'event-group';
    groupLi.innerHTML = `
      <div class="group-header">
        <span><i class="fa-solid fa-folder-open" style="margin-right:5px; color:var(--text-muted);"></i> ${code}</span>
        <span class="group-badge">${items.length}</span>
      </div>
      <div class="group-content"></div>
    `;
    
    const groupHeader = groupLi.querySelector('.group-header');
    const groupContent = groupLi.querySelector('.group-content');
    
    groupHeader.addEventListener('click', () => {
      groupContent.classList.toggle('open');
    });
    
    items.forEach(obj => {
      const ev = obj.event;
      const index = obj.playlistIndex;
      
      const li = document.createElement('div');
      li.className = 'event-item';
      li.dataset.index = index;

      const labelText = ev.labels && Object.keys(ev.labels).length > 0 
          ? Object.values(ev.labels).join(' / ') 
          : ev.code;

      const isChecked = playlistCart.has(ev.id);
      li.innerHTML = `
        <label class="clip-checkbox-container" style="margin-right:10px;">
          <input type="checkbox" class="event-checkbox" value="${ev.id}" ${isChecked ? 'checked' : ''}>
          <span class="checkmark"></span>
        </label>
        <div class="event-details" style="flex:1; cursor:pointer;">
          <div class="event-label">${labelText}</div>
          <div class="event-team">${ev.team}</div>
          <div class="event-time">${ev.start_time.toFixed(1)}s ~ ${ev.end_time.toFixed(1)}s</div>
        </div>
      `;
      
      const cb = li.querySelector('.event-checkbox');
      cb.addEventListener('change', (e) => {
          if(e.target.checked) playlistCart.add(ev.id);
          else playlistCart.delete(ev.id);
          updateCartUI();
      });

      // 클릭 시 단일 재생 (체크박스 영역 제외)
      li.querySelector('.event-details').addEventListener('click', (e) => {
        playSingleClip(index);
      });
      
      // 마우스 Hover 시 즉각 썸네일 탐색 UX (영상 정지 중에만 작동) — 활성 카메라 기준 +
      // 오프셋 반영(이전엔 cam1 고정이라 다른 카메라 보는 중엔 이 미리보기가 안 먹었음)
      li.addEventListener('mouseenter', () => {
         const pl = getActivePlayer();
         if (isPlayerReady && pl && pl.getPlayerState() !== YT.PlayerState.PLAYING) {
             seekActiveToMatchTime(ev.start_time);
         }
      });
      
      groupContent.appendChild(li);
    });
    
    eventsUl.appendChild(groupLi);
  }
}

// 3. Organizer Queue & Continuous Play Logic
export function playSingleClip(index) {
  playingSingleClip = true;
  currentPlaylistIndex = index;
  const ev = currentPlaylist[index];

  highlightActiveItem(index);

  if(isPlayerReady) {
    const hasStarted = seekActiveToMatchTime(ev.start_time);
    const pl = getActivePlayer();
    // 이 순간엔 활성 카메라가 아직 녹화 시작 전이라 보여줄 화면이 없음 — 재생하지 않고 안내만
    if (hasStarted) pl.playVideo();
    else { pl.pauseVideo(); showCameraNotStartedFlash(); }
    currentClipEnd = ev.end_time;
  }
}

export function playOrganizerPlaylist(eventsArray) {
  if (eventsArray.length === 0) return;
  
  playingSingleClip = false; // 연속 큐 모드
  currentPlaylistIndex = 0;
  playCurrentIndexInQueue();
}

function playCurrentIndexInQueue() {
  const ev = currentPlaylist[currentPlaylistIndex];
  if (!ev) {
    if(isPlayerReady) getActivePlayer().pauseVideo();
    return;
  }

  highlightActiveItem(currentPlaylistIndex);

  if(isPlayerReady) {
    const hasStarted = seekActiveToMatchTime(ev.start_time);
    const pl = getActivePlayer();
    if (hasStarted) pl.playVideo();
    else { pl.pauseVideo(); showCameraNotStartedFlash(); }
    currentClipEnd = ev.end_time;
  }
}

export function getActiveEventId() {
  if (currentPlaylistIndex >= 0 && currentPlaylistIndex < currentPlaylist.length) {
    return currentPlaylist[currentPlaylistIndex].id;
  }
  return null;
}

export function updateEventDrawingLocal(eventId, drawingJson) {
  const ev = allEvents.find(e => e.id === eventId);
  if (ev) ev.tactical_drawing = drawingJson;
  const pEv = currentPlaylist.find(e => e.id === eventId);
  if (pEv) pEv.tactical_drawing = drawingJson;
}

// 시간 추적 (종료 시간 도달 시 자동 넘김 로직) — 항상 "지금 활성 카메라"를 기준으로 함
// (예전엔 cam1(player) 고정이라 다른 카메라 보는 중엔 타임라인/구간 자동넘김이 다 안 먹었음).
function startTrackingTime() {
  if (checkTimeInterval) clearInterval(checkTimeInterval);
  checkTimeInterval = setInterval(() => {
    const pl = getActivePlayer();
    if (!isPlayerReady || !pl || typeof pl.getDuration !== 'function') return;

    const rawTime = pl.getCurrentTime();
    const duration = pl.getDuration();

    // 타임라인 스크러버 + 시간 표시 업데이트 (활성 카메라 자체 영상 기준 — 슬라이더 0~100%와 항상 일치)
    if(duration > 0) {
      document.getElementById('timeline').value = (rawTime / duration) * 100;
      updateTimeDisplay(rawTime, duration);
    }

    // 지정된 클립 종료 시간 도달 로직 — 클립 시작/종료 시간은 "경기 클럭" 기준으로 저장돼있으므로
    // 비교도 경기 클럭 기준으로 함(카메라 오프셋 반영)
    const matchClockTime = rawTime + camOffset(activeCam);
    if (matchClockTime >= currentClipEnd && currentClipEnd > 0) {
      if (playingSingleClip) {
        // 단일 클립 재생 시 정지
        pl.pauseVideo();
        stopTrackingTime();
      } else {
        // 오거나이저 연속 재생 시 다음 클립 로드
        currentPlaylistIndex++;
        if (currentPlaylistIndex < currentPlaylist.length) {
          playCurrentIndexInQueue();
        } else {
          pl.pauseVideo();
          stopTrackingTime();
          alert("오거나이저 재생이 완료되었습니다.");
        }
      }
    }
  }, 100); // 0.1초마다 체크하여 정밀도 확보
}

function stopTrackingTime() {
  if (checkTimeInterval) {
    clearInterval(checkTimeInterval);
    checkTimeInterval = null;
  }
}

// 4. UI Controls (Bottom Panel & Highlights)
function highlightActiveItem(index) {
  const items = eventsUl.querySelectorAll('.event-item');
  items.forEach(item => item.classList.remove('active'));
  
  if (index >= 0 && index < currentPlaylist.length) {
    const activeItem = eventsUl.querySelector(`.event-item[data-index="${index}"]`);
    if(activeItem) {
      activeItem.classList.add('active');
      activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

// ── 재생/탐색/배속 공용 헬퍼 ──
// 예전엔 하단 버튼들이 항상 cam1(player)만 조종해서, cam2/전술캠2나 cam3/중계캠을 보는 중엔
// 버튼을 눌러도 (안 보이는 cam1만 바뀌어서) 아무 반응이 없는 것처럼 보이는 문제가 있었음.
// switchCam()이 갱신해두는 window._activeSportsplayPlayer(현재 화면에 보이는 카메라)를 통해
// 조종하도록 통일함 — 버튼/키보드/모바일 더블탭 전부 이 헬퍼를 씀.
function getActivePlayer() {
  return window._activeSportsplayPlayer || player;
}
function togglePlayPause() {
  const pl = getActivePlayer();
  if (!isPlayerReady || !pl || typeof pl.getPlayerState !== 'function') return;
  const state = pl.getPlayerState();
  if (state === YT.PlayerState.PLAYING) pl.pauseVideo(); else pl.playVideo();
}
function seekBy(deltaSeconds) {
  const pl = getActivePlayer();
  if (!isPlayerReady || !pl || typeof pl.getCurrentTime !== 'function') return;
  pl.seekTo(Math.max(0, pl.getCurrentTime() + deltaSeconds), true);
}
let currentSpeed = 1;
function setSpeed(newSpeed) {
  const pl = getActivePlayer();
  if (!isPlayerReady || !pl || typeof pl.setPlaybackRate !== 'function') return;
  currentSpeed = newSpeed;
  pl.setPlaybackRate(currentSpeed);
  if (speedBtn) speedBtn.textContent = `${currentSpeed}x 배속`;
}
// 키보드 ↑/↓용 — 배속 버튼 클릭보다 촘촘한 7단계로 세밀하게 조절.
const SPEED_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
function cycleSpeed(direction) {
  const i = SPEED_STEPS.indexOf(currentSpeed);
  const base = i === -1 ? SPEED_STEPS.indexOf(1) : i;
  const next = direction > 0 ? Math.min(SPEED_STEPS.length - 1, base + 1) : Math.max(0, base - 1);
  setSpeed(SPEED_STEPS[next]);
}

playPauseBtn?.addEventListener('click', togglePlayPause);

speedBtn?.addEventListener('click', () => {
  // 버튼 클릭은 기존 4단(1→1.5→2→0.5) 사이클 그대로 유지
  setSpeed(currentSpeed === 1 ? 1.5 : (currentSpeed === 1.5 ? 2 : (currentSpeed === 2 ? 0.5 : 1)));
});

// ── 타임라인 스크러버 아래 "현재시간 / 전체길이" 표시 ──
// 활성 카메라 자체 영상 기준(경기 클럭 아님)으로 표시 — 슬라이더가 매핑하는 기준(0~100% =
// 그 영상의 raw duration)과 항상 일치시켜서 숫자가 슬라이더 위치랑 안 맞는 혼란을 없앰.
const timeDisplayEl = document.getElementById('time-display');
function formatClockTime(seconds) {
  const s = Math.max(0, Math.floor(isFinite(seconds) ? seconds : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
function updateTimeDisplay(current, duration) {
  if (!timeDisplayEl) return;
  timeDisplayEl.textContent = `${formatClockTime(current)} / ${formatClockTime(duration)}`;
}

const timelineInput = document.getElementById('timeline');
timelineInput?.addEventListener('input', (e) => {
  const pl = getActivePlayer();
  if (!isPlayerReady || !pl || typeof pl.getDuration !== 'function') return;
  const duration = pl.getDuration();
  if (duration > 0) {
    const target = (e.target.value / 100) * duration;
    pl.seekTo(target, true);
    updateTimeDisplay(target, duration); // 드래그 중에도(재생 안 하고 있어도) 바로 갱신
  }
});

// ── 키보드 컨트롤: Space=재생/정지, ←/→=5초 탐색, ↑/↓=배속 조절, 1/2/3=카메라 전환 ──
// 검색창/텍스트 입력 등에 포커스가 있을 때는 무시(타이핑 방해 방지). 재생바(#timeline)는
// input이지만 "타이핑"하는 곳이 아니라서 예외 처리(포커스가 거기 가있어도 5초 탐색이 이김).
function isTypingTarget(el) {
  if (!el || el.id === 'timeline') return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
document.addEventListener('keydown', (e) => {
  if (isTypingTarget(document.activeElement)) return;
  if (!isPlayerReady) return;
  switch (e.code) {
    case 'Space':      e.preventDefault(); togglePlayPause(); break;
    case 'ArrowLeft':  e.preventDefault(); seekBy(-5); break;
    case 'ArrowRight': e.preventDefault(); seekBy(5); break;
    case 'ArrowUp':    e.preventDefault(); cycleSpeed(1); break;
    case 'ArrowDown':  e.preventDefault(); cycleSpeed(-1); break;
    case 'Digit1':     e.preventDefault(); switchCam(1); break;
    case 'Digit2':     e.preventDefault(); switchCam(2); break;
    case 'Digit3':     e.preventDefault(); switchCam(3); break;
    case 'Digit4':     e.preventDefault(); switchCam(4); break;
  }
});

// ── 영상 화면 클릭/탭 컨트롤: 한 번=재생/정지, 더블(클릭/탭)=좌우 5초 탐색 ──
// 유튜브 iframe은 크로스오리진이라 그 안에서 일어나는 클릭/터치는 부모 DOM으로 안 올라오므로,
// video-container 위에 투명 오버레이를 깔아서 항상 먼저 잡음(pointer-events:auto, styles.css).
// 이렇게 하면 iframe이 사용자의 클릭을 직접 받는 일이 아예 없어지는데, 유튜브가 화면 중앙에
// 띄우는 자체 재생/정지 아이콘은 iframe이 클릭을 직접 받았을 때만 뜨는 UI라서(그림 그릴 때
// 시야를 가려서 불편하다는 피드백) — 클릭을 여기서 가로채면 그 아이콘 자체가 안 뜸(영상 밝기는
// 그대로 유지, 화면을 어둡게 가리는 식으로 눈속임하지 않아도 됨). Pointer Events로 마우스/터치/
// 펜을 하나의 로직으로 통일. 그리기 모드일 땐 canvas-container가 더 높은 z-index로 덮어서
// 이 오버레이까지 클릭이 안 내려와 자연히 안 겹침.
(function setupVideoTapControls() {
  const videoContainer = document.getElementById('video-container');
  if (!videoContainer) return;

  const overlay = document.createElement('div');
  overlay.id = 'tap-seek-overlay';
  videoContainer.appendChild(overlay);

  const flash = document.createElement('div');
  flash.id = 'tap-seek-flash';
  videoContainer.appendChild(flash);

  let lastTapTime = 0;
  let lastTapX = 0;
  let singleClickTimer = null;
  let flashTimeout = null;

  overlay.addEventListener('pointerup', (e) => {
    const rect = videoContainer.getBoundingClientRect();
    const now = Date.now();
    const isDoubleTap = (now - lastTapTime) < 350 && Math.abs(e.clientX - lastTapX) < 80;

    if (isDoubleTap) {
      clearTimeout(singleClickTimer); // 예약해둔 단일클릭(재생/정지) 취소 — 더블클릭으로 확정
      const isRightSide = (e.clientX - rect.left) > rect.width / 2;
      seekBy(isRightSide ? 5 : -5);

      flash.textContent = isRightSide ? '5초 ▶▶' : '◀◀ 5초';
      flash.className = isRightSide ? 'right show' : 'left show';
      clearTimeout(flashTimeout);
      flashTimeout = setTimeout(() => { flash.className = ''; }, 500);

      lastTapTime = 0; // 트리플탭이 다시 더블탭으로 잡히지 않게 리셋
    } else {
      lastTapTime = now;
      lastTapX = e.clientX;
      // 더블클릭/탭인지 잠깐 기다렸다가 아니면 재생/정지 토글
      clearTimeout(singleClickTimer);
      singleClickTimer = setTimeout(togglePlayPause, 350);
    }
  });
})();

