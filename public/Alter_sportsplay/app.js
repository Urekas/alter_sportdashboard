import { db, collection, writeBatch, doc, getDocs, orderBy, query, getDoc, deleteDoc, where, updateDoc } from './firebase-config.js';

import { initPlayer, fetchAndRenderEvents, fetchEventsForMatch, updateCurrentPlaylist, allEvents, loadVideoInCam, setActiveMatch, activeMatchId, setCameraOffsets, seekActiveToMatchTime } from './player.js';
import { initDrawingBoard } from './drawing.js';
import { initLibrary } from './library.js';

// --- 유틸 ---
export function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export function loadMatchForAnalysis(matchId, matchData) {
    console.log(`Loading match: ${matchData.match_name}`);
    const urls = matchData.video_urls || {};
    setCameraOffsets(matchData.video_offsets || {}); // 카메라별 동기화 오프셋 반영(player.js)

    // loadVideoInCam: ES Module 내부 player 참조 사용 (window.player 아님)
    const id1 = extractVideoId(urls.tactical_cam1 || urls.tactical_cam || '');
    if(id1) loadVideoInCam(1, id1);

    const id2 = extractVideoId(urls.tactical_cam2 || '');
    if(id2) loadVideoInCam(2, id2);

    const id3 = extractVideoId(urls.tactical_cam3 || '');
    if(id3) loadVideoInCam(3, id3);

    const id4 = extractVideoId(urls.broadcast_cam || '');
    if(id4) loadVideoInCam(4, id4);

    const searchInput = document.getElementById('event-search');
    if(searchInput) searchInput.value = '';

    // 이 경기 이벤트를 캡 없이 확실하게 다시 채움 — fetchAndRenderEvents()의 전역 1000개 캡
    // 안에 이 경기 이벤트가 다 안 들어있을 수 있어서(경기가 여러 개 쌓이면 실제로 잘림),
    // "왼쪽 이벤트 클릭 → 영상 이동"이 이걸 근거로 하니 여기서 확실히 보정함.
    fetchEventsForMatch(matchId);

    const applyFilter = () => {
        // player.js의 setActiveMatch를 호출하여 해당 매치 데이터만 표시하도록 격리
        setActiveMatch(matchId);
    };
    if(allEvents && allEvents.length > 0) applyFilter();
    else setTimeout(applyFilter, 1500);
}

// 경기 등록·XML/CSV 업로드·이벤트 파싱은 더 이상 이 도구에서 하지 않습니다 — 전부 Field Focus
// 대시보드(대회 관리 → 영상 연결 다이얼로그)에서 처리하고, 저장 시 이벤트가 여기 Events 컬렉션으로
// 자동 동기화됩니다(src/lib/video-match-service.ts의 syncEvents). 예전에 여기 있던
// readFileWithEncoding/parseCSVEvents/parseSportsCodeXML/uploadEventsBatch/loadTournaments는
// 그 경로가 없어지면서 전부 죽은 코드가 돼서 제거했습니다.
// 영상 연결만 해제합니다 — Matches/Events(비디오 도구 쪽 데이터)만 지우고,
// 대시보드 매치(실제 통계 데이터, matches 컬렉션)는 절대 삭제하지 않고 videoMatchId만 비웁니다.
async function deleteMatchWithEvents(matchId, matchName) {
  if (!confirm(`'${matchName}'의 영상 연결을 해제하시겠습니까? 카메라 URL과 여기 태깅된 이벤트가 삭제됩니다.\n(대시보드의 경기 통계는 그대로 남습니다 — 다시 연결하려면 대시보드에서 "영상" 버튼을 다시 눌러주세요.)`)) return;

  try {
    // 1. 해당 매치의 모든 이벤트 검색 및 삭제
    const q = query(collection(db, 'Events'), where('match_id', '==', matchId));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const batch = writeBatch(db);
      snapshot.forEach(d => batch.delete(d.ref));
      await batch.commit();
      console.log(`${snapshot.size}개의 하위 이벤트가 삭제되었습니다.`);
    }

    // 2. Matches 문서 삭제 (Sportsplay 내부용 영상 메타데이터)
    await deleteDoc(doc(db, 'Matches', matchId));

    // 3. 대시보드 매치는 지우지 않고, videoMatchId만 비웁니다(연결 해제).
    const qDash = query(collection(db, 'matches'), where('videoMatchId', '==', matchId));
    const snapDash = await getDocs(qDash);
    if (!snapDash.empty) {
      const batchDash = writeBatch(db);
      snapDash.forEach(d => batchDash.update(d.ref, { videoMatchId: '' }));
      await batchDash.commit();
    }

    alert('영상 연결이 해제되었습니다.');
    if (activeMatchId === matchId) setActiveMatch(null);
    fetchAndRenderMatches();
    fetchAndRenderEvents();
  } catch(err) {
    console.error('연결 해제 오류:', err);
    alert('연결 해제 중 오류가 발생했습니다.');
  }
}

async function fetchAndRenderMatches() {
  const matchesUl = document.getElementById('matches-ul');
  if(!matchesUl) return;
  try {
    const q = query(collection(db, 'Matches'), orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    matchesUl.innerHTML = '';
    if(snapshot.empty) { matchesUl.innerHTML = '<li style="padding:10px;color:var(--text-muted);">아직 등록된 경기가 없습니다.</li>'; return; }
    
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const li = document.createElement('li');
      li.className = 'match-item';
      li.innerHTML = `
        <div class="match-info">
          <strong style="color:var(--accent); display:block;">${data.match_name}</strong>
          <span style="font-size:0.8rem; color:var(--text-muted);">${data.match_date || '날짜 미상'} (${data.home_team} vs ${data.away_team})</span>
        </div>
        <div class="match-actions" style="display:flex; gap:4px;">
          <button class="small-btn analyze-btn" title="비디오 분석 시작" style="background:#2ecc71;">🎬</button>
          <button class="small-btn delete-match-btn" title="영상 연결 해제 (대시보드 경기는 유지됨)" style="background:#e74c3c;">🔌</button>
        </div>
      `;
      
      li.querySelector('.analyze-btn').addEventListener('click', () => {
        loadMatchForAnalysis(docSnap.id, data);
        // 분석 탭으로 자동 전환 (UX 개선)
        const tabScenes = document.getElementById('tab-btn-scenes');
        if(tabScenes) tabScenes.click();
      });

      li.querySelector('.delete-match-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteMatchWithEvents(docSnap.id, data.match_name);
      });

      matchesUl.appendChild(li);
    });
  } catch(err) { console.error('Failed to load matches:', err); }
}

// 딥링크(matchId+time)로 들어왔을 때 진행 상태를 화면에 보여주는 배너.
// 기존엔 아무 표시 없이 조용히 실패해서 사용자가 뭐가 잘못됐는지 알 수 없었습니다.
function showDeepLinkStatus(message, kind) {
  let el = document.getElementById('deeplink-status-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'deeplink-status-banner';
    el.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:opacity .3s;';
    document.body.appendChild(el);
  }
  const colors = {
    loading: { bg: '#1e293b', color: '#fff', border: '1px solid #475569' },
    success: { bg: '#065f46', color: '#fff', border: '1px solid #10b981' },
    error:   { bg: '#7f1d1d', color: '#fff', border: '1px solid #ef4444' },
  };
  const c = colors[kind] || colors.loading;
  el.style.background = c.bg; el.style.color = c.color; el.style.border = c.border;
  el.style.opacity = '1';
  el.textContent = message;
  return el;
}
function hideDeepLinkStatus(delay) {
  const el = document.getElementById('deeplink-status-banner');
  if (!el) return;
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, delay || 0);
}

// 여러 경기로 나뉜 재생목록(sibling_playlist_ids)을 넘나드는 고정 네비게이션 바.
// "경기별 재생목록" 구조 자체는 그대로 두고(player.js가 한 경기 영상만 이어 재생하는 구조라
// 그대로 유지하기로 함), 목록 간 이동만 버튼 한 번으로 되게 해서 여러 경기에 걸친 클립을
// 이어서 훑어볼 수 있게 함(예: 한 선수의 PC를 경기 여러 개에 걸쳐 보기).
function renderSiblingPlaylistNav(siblingIds, currentPlaylistId, currentTitle) {
  let el = document.getElementById('sibling-playlist-nav');
  if (!siblingIds || siblingIds.length < 2) { el?.remove(); return; }

  const idx = siblingIds.indexOf(currentPlaylistId);
  if (!el) {
    el = document.createElement('div');
    el.id = 'sibling-playlist-nav';
    el.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:9998;display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:8px;background:#1e293b;border:1px solid #475569;box-shadow:0 4px 12px rgba(0,0,0,0.3);font-size:12px;color:#fff;';
    document.body.appendChild(el);
  }
  const prevDisabled = idx <= 0;
  const nextDisabled = idx === -1 || idx >= siblingIds.length - 1;
  el.innerHTML = `
    <button id="sibling-prev-btn" ${prevDisabled ? 'disabled' : ''} style="background:none;border:none;color:${prevDisabled ? '#64748b' : '#fff'};cursor:${prevDisabled ? 'default' : 'pointer'};font-weight:700;padding:2px 6px;">◀ 이전 경기</button>
    <span style="color:#94a3b8;">${idx === -1 ? '?' : idx + 1} / ${siblingIds.length}${currentTitle ? ' · ' + currentTitle : ''}</span>
    <button id="sibling-next-btn" ${nextDisabled ? 'disabled' : ''} style="background:none;border:none;color:${nextDisabled ? '#64748b' : '#fff'};cursor:${nextDisabled ? 'default' : 'pointer'};font-weight:700;padding:2px 6px;">다음 경기 ▶</button>
  `;
  if (!prevDisabled) el.querySelector('#sibling-prev-btn').addEventListener('click', () => handlePlaylistDeepLink(siblingIds[idx - 1]));
  if (!nextDisabled) el.querySelector('#sibling-next-btn').addEventListener('click', () => handlePlaylistDeepLink(siblingIds[idx + 1]));
}

// 재생목록(Playlists 컬렉션) 딥링크 — "이 경기 페널티코너 모음"처럼 미리 만들어둔 클립
// 묶음을 선수단에게 공유하는 링크(?playlistId=X&lock=1)를 처리합니다. 재생목록은 보통
// 한 경기 안에서 클립을 골라 만들기 때문에, 첫 클립의 match_id 기준으로 그 경기 영상을
// 불러온 뒤 재생목록만 필터링해서 Events 패널에 올려줍니다(맨 위 "필터링 전체 재생" 버튼으로
// 이어보기 가능 — 기존 Organizer 큐 재생 로직 재사용).
// 같은 필터로 만든 재생목록이 여러 경기로 나뉜 경우(sibling_playlist_ids) prev/next 버튼도 같이
// 그려서, URL을 새로 안 열어도 이 함수를 다시 호출하는 것만으로 경기를 넘나들 수 있게 함.
async function handlePlaylistDeepLink(playlistId) {
  showDeepLinkStatus('재생목록 불러오는 중...', 'loading');
  try {
    const plSnap = await getDoc(doc(db, 'Playlists', playlistId));
    if (!plSnap.exists()) { showDeepLinkStatus('재생목록을 찾을 수 없어요.', 'error'); hideDeepLinkStatus(4000); return; }
    const plData = plSnap.data();
    const eventIds = plData.event_ids || [];
    if (eventIds.length === 0) { showDeepLinkStatus('재생목록에 클립이 없어요.', 'error'); hideDeepLinkStatus(4000); return; }

    const eventDocs = await Promise.all(eventIds.map(id => getDoc(doc(db, 'Events', id))));
    const events = eventDocs.filter(d => d.exists()).map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.start_time - b.start_time);
    if (events.length === 0) { showDeepLinkStatus('재생목록의 클립을 찾을 수 없어요.', 'error'); hideDeepLinkStatus(4000); return; }

    const matchId = events[0].match_id;
    const matchSnap = matchId ? await getDoc(doc(db, 'Matches', matchId)) : null;
    if (matchSnap?.exists()) {
      loadMatchForAnalysis(matchId, matchSnap.data());
    }

    // 공유 가능한 링크를 유지하면서(새로고침해도 지금 보는 경기가 그대로 열리도록) 주소만 갱신.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('playlistId', playlistId);
      window.history.replaceState({}, '', url);
    } catch {}

    renderSiblingPlaylistNav(plData.sibling_playlist_ids, playlistId, matchSnap?.exists() ? matchSnap.data().match_name : '');

    // loadMatchForAnalysis의 카메라 세팅이 끝난 뒤에 재생목록을 올려야 정상 동작함.
    setTimeout(() => {
      updateCurrentPlaylist(events);
      window.showViewerSection?.();
      document.getElementById('tab-btn-events')?.click();
      showDeepLinkStatus(`"${plData.title || '재생목록'}" ${events.length}개 클립 준비됨 — 위 재생 버튼을 눌러주세요`, 'success');
      hideDeepLinkStatus(4000);
    }, 1200);
  } catch (e) {
    console.error('Playlist deep link error:', e);
    showDeepLinkStatus('재생목록을 불러오는 중 오류가 발생했어요.', 'error');
    hideDeepLinkStatus(4000);
  }
}

async function handleUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const matchId = params.get('matchId');
  const time = params.get('time');
  const playlistId = params.get('playlistId');

  // 선수단 배포 링크(대시보드 리포트 페이지에서 생성) — Explorer(다른 경기 탐색, 연결 해제 등
  // 관리 기능)를 숨기고 이 경기의 Viewer 화면에만 갇히게 함(styles.css의 .locked-viewer-mode).
  if (params.get('lock') === '1') {
    document.body.classList.add('locked-viewer-mode');
  }

  if (playlistId) {
    await handlePlaylistDeepLink(playlistId);
    return; // matchId/time 파라미터와는 배타적 — 재생목록 딥링크는 여기서 끝
  }

  if(matchId) {
    if (time) showDeepLinkStatus('경기 불러오는 중...', 'loading');
    try {
      const docSnap = await getDoc(doc(db, 'Matches', matchId));
      if(docSnap.exists()) {
        loadMatchForAnalysis(matchId, docSnap.data());
        // 딥링크로 들어왔을 때 기본 탭(Explorer/Scenes)에 가려서 그 경기 이벤트 목록이
        // 안 보이던 문제 — Viewer 섹션 + Events 탭으로 바로 전환(이미 있는 탭 전환 로직 재사용).
        window.showViewerSection?.();
        document.getElementById('tab-btn-events')?.click();
      }
      else if (time) { showDeepLinkStatus('해당 경기를 찾을 수 없어요.', 'error'); hideDeepLinkStatus(4000); return; }
    } catch(e) {
      console.error('URL param error:', e);
      if (time) { showDeepLinkStatus('경기를 불러오는 중 오류가 발생했어요.', 'error'); hideDeepLinkStatus(4000); }
      return;
    }
  }

  if(time && !isNaN(parseFloat(time))) {
    const t = parseFloat(time);
    const mins = Math.floor(t / 60), secs = Math.floor(t % 60);
    const label = `${mins}:${secs < 10 ? '0' + secs : secs}`;
    showDeepLinkStatus(`${label} 지점으로 이동 준비 중...`, 'loading');

    // 유튜브 플레이어(최대 3개) 초기화는 새 탭에서 처음 로드할 때 5초 넘게 걸리는 경우가 흔해서
    // 넉넉하게(최대 20초) 기다리고, 실패하면 화면에 알려줍니다.
    const startedAt = Date.now();
    const check = setInterval(() => {
      const pl = window._activeSportsplayPlayer;
      if(pl && typeof pl.seekTo === 'function') {
        clearInterval(check);
        // t는 "경기 클럭" 시간(대시보드에서 저장한 이벤트 시각) — 활성 카메라의 동기화 오프셋을
        // 반영해서 그 카메라 영상에서의 실제 지점으로 변환 후 이동(player.js). 기본 활성 카메라
        // (전술캠1)가 이 시점에 아직 녹화 시작 전이면(offset > t) 재생하지 않고 안내만 함.
        const hasStarted = seekActiveToMatchTime(t);
        if (hasStarted) {
          pl.playVideo();
          showDeepLinkStatus(`${label} 지점부터 재생 중`, 'success');
        } else {
          pl.pauseVideo();
          showDeepLinkStatus(`이 카메라는 ${label} 시점엔 아직 촬영 전이에요`, 'error');
        }
        hideDeepLinkStatus(3000);
        return;
      }
      if (Date.now() - startedAt > 20000) {
        clearInterval(check);
        showDeepLinkStatus('영상 로딩이 오래 걸리고 있어요. 카메라 앵글이 정상 로드됐는지 확인해주세요.', 'error');
        hideDeepLinkStatus(6000);
      }
    }, 500);
  }
}

// --- 전체화면 토글 ---
// video-container 위 오버레이 버튼(⛶) — video-container "만" 전체화면하면 그 바깥에 있는
// #bottom-panel(재생바·그리기 툴바)이 Fullscreen API 특성상 통째로 안 보이게 돼서(전체화면
// 대상의 자손만 화면에 남음), 대신 document.documentElement(페이지 전체)를 전체화면 대상으로
// 삼음 — 주소창 등 브라우저 크롬만 없어지고 기존 레이아웃(헤더/컨트롤 포함)은 그대로 유지되어
// 모바일 가로 모드에서 실질적인 화면 공간을 넓히는 효과. 아이콘은 상태에 맞춰 expand/compress로 토글.
function initFullscreenToggle() {
  const btn = document.getElementById('btn-fullscreen');
  const icon = btn?.querySelector('i');
  if (!btn) return;

  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;

  function updateIcon() {
    const active = !!fsElement();
    if (icon) icon.className = active ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
    btn.title = active ? '전체화면 종료' : '전체화면';
  }

  btn.addEventListener('click', async () => {
    try {
      if (fsElement()) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } else {
        const root = document.documentElement;
        if (root.requestFullscreen) await root.requestFullscreen();
        else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
        // 가로 폭이 충분히 넓어진 상태에서 세로로 든 폰이면 가로 회전 유도(지원 브라우저만,
        // 실패해도 조용히 무시 — iOS Safari 등 미지원 환경에서도 전체화면 자체는 정상 동작해야 함).
        try { await screen.orientation?.lock?.('landscape'); } catch {}
      }
    } catch (e) {
      console.warn('전체화면 전환 실패:', e);
    }
  });

  document.addEventListener('fullscreenchange', updateIcon);
  document.addEventListener('webkitfullscreenchange', updateIcon);
}

// --- Global YT 콜백 ---
window.onYouTubeIframeAPIReady = () => { initPlayer(); };

// --- DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', async () => {
  // YouTube API 로드
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);

  // --- 초기 데이터 로드 ---
  // 경기 등록은 Field Focus 대시보드(영상 연결 다이얼로그)에서만 합니다 — 여기 자체 Admin
  // 등록 폼은 제거했습니다. 아래는 이미 연결된 경기 목록을 읽어오는 것뿐입니다.
  await fetchAndRenderMatches();
  handleUrlParams();
  await fetchAndRenderEvents();
  initLibrary();
  initDrawingBoard();
  initFullscreenToggle();
});
