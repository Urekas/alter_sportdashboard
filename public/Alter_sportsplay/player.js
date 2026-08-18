import { db, collection, getDocs, query, orderBy, limit } from './firebase-config.js';

export let player;       // cam1 (전술캠1)
export let player2;      // cam2 (전술캠2)
export let player3;      // cam3 (중계캠)
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
let activeCam = 1; // 카메라 전환(switchCam)이 참조하는 현재 활성 카메라 번호 — 선언이 빠져 있어서
                    // strict mode(ES 모듈은 항상 strict) 아래서 switchCam 호출 시 ReferenceError로
                    // 매번 조용히 실패하고 있었음(전술캠/중계캠 전환이 전혀 안 되던 원인).

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
    events: { 'onReady': ()=>{ isPlayer2Ready=true; } }
  });

  player3 = new YT.Player('youtube-player-3', {
    height:'100%', width:'100%', videoId: '',
    playerVars: pv,
    events: { 'onReady': ()=>{ isPlayer3Ready=true; } }
  });

  // 카메라 전환 버튼
  document.getElementById('cam1-btn')?.addEventListener('click',()=>switchCam(1));
  document.getElementById('cam2-btn')?.addEventListener('click',()=>switchCam(2));
  document.getElementById('cam3-btn')?.addEventListener('click',()=>switchCam(3));
}

function switchCam(n) {
  activeCam = n;
  const wrappers = [null,
    document.getElementById('player-wrapper-1'),
    document.getElementById('player-wrapper-2'),
    document.getElementById('player-wrapper-3')
  ];
  const btns = [null,
    document.getElementById('cam1-btn'),
    document.getElementById('cam2-btn'),
    document.getElementById('cam3-btn')
  ];
  [1,2,3].forEach(i=>{
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
  const activePlayer = n===1?player : n===2?player2 : player3;
  window._activeSportsplayPlayer = activePlayer;
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
  // YT.PlayerState.PLAYING = 1, PAUSED = 2
  if (event.data === YT.PlayerState.PLAYING) {
    playPauseBtn.textContent = '⏸ 일시 정지';
    startTrackingTime();
  } else {
    playPauseBtn.textContent = '▶️ 재생';
    stopTrackingTime();
  }
}

export function pausePlayer() {
  const activePlayer = window._activeSportsplayPlayer;
  if (activePlayer && typeof activePlayer.pauseVideo === 'function') {
    activePlayer.pauseVideo();
  }
}

// 카메라별 영상 로드 (app.js에서 사용 - ES Module 내부 참조)
export function loadVideoInCam(cam, videoId) {
  if (!videoId) return;
  const pl = cam === 1 ? player : cam === 2 ? player2 : player3;
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
      
      // 마우스 Hover 시 즉각 썸네일 탐색 UX (영상 정지 중에만 작동)
      li.addEventListener('mouseenter', () => {
         if (isPlayerReady && player.getPlayerState() !== YT.PlayerState.PLAYING) {
             player.seekTo(ev.start_time, true);
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
    player.seekTo(ev.start_time, true);
    player.playVideo();
    currentClipEnd = ev.end_time;
  }
}

function playOrganizerPlaylist(eventsArray) {
  if (eventsArray.length === 0) return;
  
  playingSingleClip = false; // 연속 큐 모드
  currentPlaylistIndex = 0;
  playCurrentIndexInQueue();
}

function playCurrentIndexInQueue() {
  const ev = currentPlaylist[currentPlaylistIndex];
  if (!ev) {
    if(isPlayerReady) player.pauseVideo();
    return;
  }
  
  highlightActiveItem(currentPlaylistIndex);
  
  if(isPlayerReady) {
    player.seekTo(ev.start_time, true);
    player.playVideo();
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

// 시간 추적 (종료 시간 도달 시 자동 넘김 로직)
function startTrackingTime() {
  if (checkTimeInterval) clearInterval(checkTimeInterval);
  checkTimeInterval = setInterval(() => {
    if (!isPlayerReady || !player.getDuration) return;
    
    const currentTime = player.getCurrentTime();
    
    // 타임라인 스크러버 업데이트
    const duration = player.getDuration();
    if(duration > 0) {
      document.getElementById('timeline').value = (currentTime / duration) * 100;
    }
    
    // 지정된 클립 종료 시간 도달 로직
    if (currentTime >= currentClipEnd && currentClipEnd > 0) {
      if (playingSingleClip) {
        // 단일 클립 재생 시 정지
        player.pauseVideo();
        stopTrackingTime();
      } else {
        // 오거나이저 연속 재생 시 다음 클립 로드
        currentPlaylistIndex++;
        if (currentPlaylistIndex < currentPlaylist.length) {
          playCurrentIndexInQueue();
        } else {
          player.pauseVideo();
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

const timelineInput = document.getElementById('timeline');
timelineInput?.addEventListener('input', (e) => {
  const pl = getActivePlayer();
  if (!isPlayerReady || !pl || typeof pl.getDuration !== 'function') return;
  const duration = pl.getDuration();
  if (duration > 0) pl.seekTo((e.target.value / 100) * duration, true);
});

// ── 키보드 컨트롤: Space=재생/정지, ←/→=5초 탐색, ↑/↓=배속 조절 ──
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

