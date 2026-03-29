import { db, collection, getDocs, query, orderBy, limit } from './firebase-config.js';

export let player;
export let isPlayerReady = false;
export let allEvents = [];
export let currentPlaylist = [];
let currentPlaylistIndex = -1;
let playingSingleClip = false; // Flag to indicate if we are playing one clip or the playlist queue
let checkTimeInterval = null;
let currentClipEnd = 0;

const playPauseBtn = document.getElementById('play-pause-btn');
const speedBtn = document.getElementById('speed-btn');
const eventsUl = document.getElementById('events-ul');

// 1. YouTube IFrame API Initialization (Workspace)
export function initPlayer() {
  // 기본 유튜브 비디오 ID를 로드하여 플레이어를 초기화합니다.
  // 실제 프로젝트에서는 Matches 컬렉션의 video_urls 값을 가져와야 합니다.
  player = new YT.Player('youtube-player', {
    height: '100%',
    width: '100%',
    videoId: '6KHm8HpKHzw', // 사용자가 요청한 필드하키 영상 ID
    playerVars: {
      'playsinline': 1,
      'controls': 1,
      'rel': 0,
      'disablekb': 1
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
}

function onPlayerReady(event) {
  isPlayerReady = true;
  console.log("YouTube Player is ready.");
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
  if (isPlayerReady && player && typeof player.pauseVideo === 'function') {
    player.pauseVideo();
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
    // 코드, 라벨, 팀 텍스트 기반 통합 검색
    const rawSearchTarget = `${ev.code || ''} ${JSON.stringify(ev.labels || {})} ${ev.team || ''}`.toLowerCase();
    if (searchText && !rawSearchTarget.includes(searchText)) return false;
    return true; /* Checkboxes can be added here later */
  });
  
  renderCodeViewer(currentPlaylist);
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

  // --- Grouping by Code ---
  const grouped = {};
  events.forEach((ev, idx) => {
    const code = ev.code || "Uncategorized";
    if (!grouped[code]) grouped[code] = [];
    grouped[code].push({ event: ev, playlistIndex: idx });
  });

  for (const [code, items] of Object.entries(grouped)) {
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

playPauseBtn.addEventListener('click', () => {
  if (!isPlayerReady) return;
  const state = player.getPlayerState();
  if (state === YT.PlayerState.PLAYING) {
    player.pauseVideo();
  } else {
    player.playVideo();
  }
});

let currentSpeed = 1;
speedBtn.addEventListener('click', () => {
  if (!isPlayerReady) return;
  // 1x -> 1.5x -> 2x -> 0.5x 로테이션
  currentSpeed = currentSpeed === 1 ? 1.5 : (currentSpeed === 1.5 ? 2 : (currentSpeed === 2 ? 0.5 : 1));
  player.setPlaybackRate(currentSpeed);
  speedBtn.textContent = `${currentSpeed}x 배속`;
});

// 타임라인 수동 스크러빙 (유저가 직접 막대를 조정할 때 반영)
const timelineInput = document.getElementById('timeline');
timelineInput.addEventListener('input', (e) => {
  if (!isPlayerReady || !player.getDuration) return;
  const duration = player.getDuration();
  if (duration > 0) {
    const seekTime = (e.target.value / 100) * duration;
    player.seekTo(seekTime, true);
  }
});
