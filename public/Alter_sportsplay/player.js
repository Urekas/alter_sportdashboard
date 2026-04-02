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
let isPlayer2Ready = false;
let isPlayer3Ready = false;

const playPauseBtn = document.getElementById('play-pause-btn');
const speedBtn     = document.getElementById('speed-btn');
const eventsUl     = document.getElementById('events-ul') || document.createElement('ul');

// 1. YouTube IFrame API Initialization (3 players)
export function initPlayer() {
  const pv = { playsinline:1, controls:1, rel:0, disablekb:1 };
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
    const style = (i===n)?'' : 'background:#444';
    if(btns[i]) btns[i].style.backgroundColor = (i===n)?'' : '#444';
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

export function renderCodeViewer(events) {
  eventsUl.innerHTML = '';
  
  // 오거나이저 전체 연속 재생 버튼
  const organizerHeader = document.createElement('li');
  organizerHeader.style.padding = '10px';
  organizerHeader.style.borderBottom = '1px solid var(--border-color)';
  organizerHeader.innerHTML = `<button id="btn-play-all" class="primary-btn" style="width:100%; margin-top:0;">📝 필터링된 이벤트 전체 재생 (Organizer)</button>`;
  eventsUl.appendChild(organizerHeader);
  
  document.getElementById('btn-play-all').addEventListener('click', () => {
    playOrganizerPlaylist(events);
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
        <span><i class="fa-solid fa-folder-open" style="margin-right:5px; color:#a0a0b0;"></i> ${code}</span>
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
      
      li.innerHTML = `
        <div class="event-label">${labelText}</div>
        <div class="event-team">${ev.team}</div>
        <div class="event-time">${ev.start_time.toFixed(1)}s ~ ${ev.end_time.toFixed(1)}s</div>
      `;
      
      // 클릭 시 단일 재생
      li.addEventListener('click', () => {
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

playPauseBtn?.addEventListener('click', () => {
  if (!isPlayerReady) return;
  const state = player.getPlayerState();
  if (state === YT.PlayerState.PLAYING) player.pauseVideo(); else player.playVideo();
});

let currentSpeed = 1;
speedBtn?.addEventListener('click', () => {
  if (!isPlayerReady) return;
  currentSpeed = currentSpeed === 1 ? 1.5 : (currentSpeed === 1.5 ? 2 : (currentSpeed === 2 ? 0.5 : 1));
  player.setPlaybackRate(currentSpeed);
  if(speedBtn) speedBtn.textContent = `${currentSpeed}x 배속`;
});

const timelineInput = document.getElementById('timeline');
timelineInput?.addEventListener('input', (e) => {
  if (!isPlayerReady || !player.getDuration) return;
  const duration = player.getDuration();
  if (duration > 0) player.seekTo((e.target.value / 100) * duration, true);
});

