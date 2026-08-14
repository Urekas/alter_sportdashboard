import { db, collection, writeBatch, doc, getDocs, orderBy, query, getDoc, deleteDoc, where, updateDoc } from './firebase-config.js';

import { initPlayer, fetchAndRenderEvents, updateCurrentPlaylist, allEvents, loadVideoInCam, setActiveMatch, activeMatchId } from './player.js';
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

    // loadVideoInCam: ES Module 내부 player 참조 사용 (window.player 아님)
    const id1 = extractVideoId(urls.tactical_cam1 || urls.tactical_cam || '');
    if(id1) loadVideoInCam(1, id1);

    const id2 = extractVideoId(urls.tactical_cam2 || '');
    if(id2) loadVideoInCam(2, id2);

    const id3 = extractVideoId(urls.broadcast_cam || '');
    if(id3) loadVideoInCam(3, id3);

    const searchInput = document.getElementById('event-search');
    if(searchInput) searchInput.value = '';

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
    if(snapshot.empty) { matchesUl.innerHTML = '<li style="padding:10px;color:#888;">아직 등록된 경기가 없습니다.</li>'; return; }
    
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const li = document.createElement('li');
      li.className = 'match-item';
      li.innerHTML = `
        <div class="match-info">
          <strong style="color:var(--accent); display:block;">${data.match_name}</strong>
          <span style="font-size:0.8rem; color:#aaa;">${data.match_date || '날짜 미상'} (${data.home_team} vs ${data.away_team})</span>
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

async function handleUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const matchId = params.get('matchId');
  const time = params.get('time');

  if(matchId) {
    if (time) showDeepLinkStatus('경기 불러오는 중...', 'loading');
    try {
      const docSnap = await getDoc(doc(db, 'Matches', matchId));
      if(docSnap.exists()) loadMatchForAnalysis(matchId, docSnap.data());
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
        pl.seekTo(t, true);
        pl.playVideo();
        showDeepLinkStatus(`${label} 지점부터 재생 중`, 'success');
        hideDeepLinkStatus(2500);
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
});
