import { db, collection, addDoc, writeBatch, doc, getDocs, orderBy, query, getDoc } from './firebase-config.js';
import { detectQuarter, createMatchDataForDashboard } from './analysis-utils.js';

import { initPlayer, fetchAndRenderEvents, updateCurrentPlaylist, allEvents, loadVideoInCam } from './player.js';
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
        if(allEvents && allEvents.length > 0) {
            updateCurrentPlaylist(allEvents.filter(ev => ev.match_id === matchId));
        }
    };
    if(allEvents && allEvents.length > 0) applyFilter();
    else setTimeout(applyFilter, 1500);
}

// BOM 감지 + 인코딩 자동 처리 (UTF-16 LE/BE, UTF-8 BOM, UTF-8 지원)
async function readFileWithEncoding(file) {
  const buf = await file.arrayBuffer();
  const u8 = new Uint8Array(buf);
  // UTF-16 LE BOM: FF FE
  if (u8[0] === 0xFF && u8[1] === 0xFE) return new TextDecoder('utf-16le').decode(buf.slice(2));
  // UTF-16 BE BOM: FE FF
  if (u8[0] === 0xFE && u8[1] === 0xFF) return new TextDecoder('utf-16be').decode(buf.slice(2));
  // UTF-8 BOM: EF BB BF
  if (u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) return new TextDecoder('utf-8').decode(buf.slice(3));
  return new TextDecoder('utf-8').decode(buf);
}

// XML 파싱 (BOM 제거 후 DOMParser)
function parseSportsCodeXML(xmlText, matchId, homeTeam, awayTeam) {
  // UTF-16 LE BOM(﻿) 잔여 제거 및 주요 태그(start, end, code, label 등) 소문자 강제 정규화
  let cleanXml = xmlText.replace(/^\uFEFF/, '');
  cleanXml = cleanXml.replace(/<\/?(instance|clip|start|end|code|id|label|group|text)(?=>|\s)/gi, match => match.toLowerCase());
  
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(cleanXml, 'text/xml');

  // 파서 에러 확인
  const parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    console.error('XML parse error:', parseError.textContent);
    return [];
  }

  // Sportscode는 버전/설정에 따라 instance 또는 clip 태그를 사용함
  let instances = xmlDoc.getElementsByTagName('instance');
  if (instances.length === 0) {
    instances = xmlDoc.getElementsByTagName('clip');
  }
  
  console.log(`XML 파싱 시작: ${instances.length}개의 데이터 요소를 발견했습니다.`);
  const events = [];
  
  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i];
    
    // start/end 노드 탐색 (태그 소문자 정규화 덕분에 단순 검색 가능)
    const startNode = inst.querySelector('start');
    const endNode   = inst.querySelector('end');
    
    const start = startNode ? parseFloat(startNode.textContent) : 0;
    const end   = endNode ? parseFloat(endNode.textContent) : 0;
    
    // 코드 노드 (code 또는 id 또는 Label 내의 Code)
    const codeNode = inst.querySelector('code') || inst.querySelector('id') || inst.querySelector('label[group="Code"] text') || inst.querySelector('label[group="code"] text');
    let codeText = (codeNode ? codeNode.textContent : `Event_${i+1}`)
                    .replace(/HOME/g, homeTeam).replace(/AWAY/g, awayTeam);
    
    const labelNodes = inst.querySelectorAll('label');
    const labels = {};
    for (let j = 0; j < labelNodes.length; j++) {
      const groupNode = labelNodes[j].querySelector('group');
      const textNode  = labelNodes[j].querySelector('text');
      
      const group = groupNode ? groupNode.textContent : `Group_${j}`;
      let text = textNode ? textNode.textContent : "";
      text = text.replace(/HOME/g, homeTeam).replace(/AWAY/g, awayTeam);
      labels[group] = text;
    }
    
    // 팀 유추 로직 강화
    let team = 'Unknown';
    if (codeText.includes(homeTeam)) team = homeTeam;
    else if (codeText.includes(awayTeam)) team = awayTeam;
    else if (labels['Team'] === homeTeam || labels['TEAM'] === homeTeam) team = homeTeam;
    else if (labels['Team'] === awayTeam || labels['TEAM'] === awayTeam) team = awayTeam;

    events.push({
      match_id: matchId, code: codeText, team,
      start_time: start, end_time: end,
      duration: parseFloat((end - start).toFixed(2)),
      labels, created_at: new Date().toISOString()
    });
  }
  console.log(`파싱 완료: 총 ${events.length}개의 이벤트를 추출했습니다.`);
  return events;
}


async function uploadEventsBatch(events) {
  const BATCH_SIZE = 400;
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    events.slice(i, i + BATCH_SIZE).forEach(eventData => {
      batch.set(doc(collection(db, 'Events')), eventData);
    });
    await batch.commit();
    console.log(`Batch ${Math.floor(i/BATCH_SIZE)+1} committed.`);
  }
}

async function loadTournaments(tournamentSelect) {
  try {
    const q = query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    tournamentSelect.innerHTML = '<option value="">연동할 대회 선택</option>';
    snapshot.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id; opt.textContent = d.data().name || 'Unnamed';
      tournamentSelect.appendChild(opt);
    });
    const newOpt = document.createElement('option');
    newOpt.value = 'new'; newOpt.textContent = '+ 새 대회 직접 입력';
    tournamentSelect.appendChild(newOpt);
  } catch(err) {
    console.error('Failed to load tournaments:', err);
    tournamentSelect.innerHTML = '<option value="">대회 로드 실패</option>';
  }
}

async function fetchAndRenderMatches() {
  const matchesUl = document.getElementById('matches-ul');
  if(!matchesUl) return;
  try {
    const q = query(collection(db, 'Matches'), orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    matchesUl.innerHTML = '';
    if(snapshot.empty) { matchesUl.innerHTML = '<li>아직 등록된 경기가 없습니다.</li>'; return; }
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const li = document.createElement('li');
      li.className = 'match-item';
      li.innerHTML = `
        <div class="match-info">
          <strong>${data.match_name}</strong>
          <span>${data.match_date} (${data.home_team} vs ${data.away_team})</span>
        </div>
        <div class="match-actions">
          <button class="small-btn analyze-btn" title="비디오 분석">🎬</button>
          <a href="/?matchId=${docSnap.id}" target="_blank" class="small-btn stats-btn" title="통계 대시보드">📊</a>
        </div>
      `;
      li.querySelector('.analyze-btn').addEventListener('click', () => loadMatchForAnalysis(docSnap.id, data));
      matchesUl.appendChild(li);
    });
  } catch(err) { console.error('Failed to load matches:', err); }
}

async function handleUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const matchId = params.get('matchId');
  const time = params.get('time');
  if(matchId) {
    try {
      const docSnap = await getDoc(doc(db, 'Matches', matchId));
      if(docSnap.exists()) loadMatchForAnalysis(matchId, docSnap.data());
    } catch(e) { console.error('URL param error:', e); }
  }
  if(time && !isNaN(parseFloat(time))) {
    const t = parseFloat(time);
    const check = setInterval(() => {
      const pl = window._activeSportsplayPlayer;
      if(pl && typeof pl.seekTo === 'function') {
        pl.seekTo(t, true); pl.playVideo(); clearInterval(check);
      }
    }, 500);
    setTimeout(() => clearInterval(check), 5000);
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

  // --- Admin Form ---
  const matchForm       = document.getElementById('match-form');
  const submitBtn       = matchForm?.querySelector('button[type="submit"]');
  const tournamentSelect= document.getElementById('match-tournament-select');
  const eventDataFile   = document.getElementById('event-data-file');

  // 대회 select 변경 시 new 입력란 토글
  tournamentSelect?.addEventListener('change', () => {
    const inp = document.getElementById('new-tournament-name');
    if(!inp) return;
    if(tournamentSelect.value === 'new') { inp.style.display='block'; inp.required=true; }
    else { inp.style.display='none'; inp.required=false; }
  });

  // Form submit
  matchForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!eventDataFile?.files.length) { alert('XML 또는 CSV 데이터 파일을 첨부해주세요.'); return; }

    let tournamentId = tournamentSelect?.value || '';
    if(tournamentId === 'new') {
      const newName = document.getElementById('new-tournament-name')?.value;
      if(!newName) { alert('새 대회 이름을 입력해주세요.'); return; }
      try {
        const tRef = await addDoc(collection(db, 'tournaments'), { name: newName, createdAt: new Date().toISOString() });
        tournamentId = tRef.id;
      } catch(err) { alert('새 대회 생성 중 오류가 발생했습니다.'); return; }
    } else if(!tournamentId) { alert('연동할 대회를 선택해주세요.'); return; }

    const matchMetadata = {
      match_name: document.getElementById('match-name')?.value || '',
      match_date: document.getElementById('match-date')?.value || '',
      home_team:  document.getElementById('home-team')?.value || '',
      away_team:  document.getElementById('away-team')?.value || '',
      tournament_id: tournamentId,
      video_urls: {
        tactical_cam1: document.getElementById('tactical-url')?.value || '',
        tactical_cam2: document.getElementById('tactical-url-2')?.value || '',
        broadcast_cam: document.getElementById('broadcast-url')?.value || ''
      },
      video_offsets: {
        tactical_cam1: parseFloat(document.getElementById('tactical-offset')?.value) || 0,
        tactical_cam2: parseFloat(document.getElementById('tactical-offset-2')?.value) || 0,
        broadcast_cam: parseFloat(document.getElementById('broadcast-offset')?.value) || 0
      },
      rosters: { home:[], away:[] },
      created_at: new Date().toISOString()
    };

    if(submitBtn) { submitBtn.disabled=true; submitBtn.textContent='파싱 및 동기화 중...'; }
    try {
      const videoMatchRef = await addDoc(collection(db, 'Matches'), matchMetadata);
      const videoMatchId = videoMatchRef.id;

      const file = eventDataFile.files[0];
      // UTF-16 LE/BE BOM 감지 인코딩 처리
      const textData = await readFileWithEncoding(file);
      const parsedEvents = parseSportsCodeXML(textData, videoMatchId, matchMetadata.home_team, matchMetadata.away_team);

      if(parsedEvents.length === 0) {
        alert('파싱된 이벤트가 없습니다. XML 포맷을 확인해주세요.');
      } else {
        await uploadEventsBatch(parsedEvents);
        const dashboardEvents = parsedEvents.map((ev,i) => ({
          id: `ev-${i}-${Date.now()}`, team: ev.team, time: ev.start_time,
          duration: ev.duration, code: ev.code,
          quarter: detectQuarter(Object.values(ev.labels).join(' '), ev.start_time),
          locationLabel: ev.labels['Location'] || ev.labels['Zone'] || '',
          resultLabel: ev.labels['Result'] || ev.labels['Outcome'] || '',
        }));
        const dashData = createMatchDataForDashboard(dashboardEvents, matchMetadata.home_team, matchMetadata.away_team, tournamentId, matchMetadata.match_name);
        await addDoc(collection(db, 'matches'), { ...dashData, videoMatchId, uploadedAt: new Date().toISOString() });
        alert(`업로드 완료!\n- 이벤트: ${parsedEvents.length}개\n- 비디오 매치 ID: ${videoMatchId}`);
        matchForm.reset();
        await fetchAndRenderEvents();
      }
    } catch(error) {
      console.error('Upload error:', error);
      alert('업로드 중 오류: ' + error.message);
    } finally {
      if(submitBtn) { submitBtn.disabled=false; submitBtn.textContent='경기 등록 및 파싱'; }
    }
  });

  // --- 초기 데이터 로드 ---
  await loadTournaments(tournamentSelect);
  await fetchAndRenderMatches();
  handleUrlParams();
  await fetchAndRenderEvents();
  initLibrary();
  initDrawingBoard();
});
