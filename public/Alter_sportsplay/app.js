import { db, collection, addDoc, writeBatch, doc, getDocs, orderBy, query, getDoc, deleteDoc, where } from './firebase-config.js';
import { detectQuarter, createMatchDataForDashboard } from './analysis-utils.js';

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

// CSV 파싱 (Sportscode CSV 형식 지원)
function parseCSVEvents(csvText, matchId, homeTeam, awayTeam) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== "");
  if (lines.length < 2) return [];

  // 헤더 분석 (코드, 시작, 종료, 라벨 등)
  const header = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1);
  const events = [];

  rows.forEach((row, i) => {
    // 따옴표 내 쉼표가 있을 수 있으므로 복잡한 split 처리 필요할 수 있음
    const cols = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || row.split(',');
    const item = {};
    header.forEach((h, idx) => {
      let val = cols[idx] ? cols[idx].replace(/^"|"$/g, '').trim() : "";
      item[h] = val;
    });

    const start = parseFloat(item['Start'] || item['start_time'] || item['start'] || 0);
    const end   = parseFloat(item['End'] || item['end_time'] || item['end'] || 0);
    let codeText = (item['Code'] || item['code'] || `Event_${i+1}`)
                    .replace(/HOME/g, homeTeam).replace(/AWAY/g, awayTeam);
    
    // 나머지 컬럼들을 라벨로 처리
    const labels = {};
    Object.keys(item).forEach(key => {
        if (!['Start', 'End', 'Code', 'start_time', 'end_time', 'code'].includes(key)) {
            labels[key] = item[key].replace(/HOME/g, homeTeam).replace(/AWAY/g, awayTeam);
        }
    });

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
  });

  console.log(`CSV 파싱 완료: ${events.length}개 이벤트 추출`);
  return events;
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
    // 태그 값뿐만 아니라 속성(Attributes)으로 되어있는 경우도 대응
    const startNode = inst.querySelector('start');
    const endNode   = inst.querySelector('end');
    
    const start = startNode ? parseFloat(startNode.textContent) : (parseFloat(inst.getAttribute('start')) || 0);
    const end   = endNode ? parseFloat(endNode.textContent) : (parseFloat(inst.getAttribute('end')) || 0);
    
    // 코드 노드 (code 또는 id 또는 Label 내의 Code)
    const codeNode = inst.querySelector('code') || inst.querySelector('id') || inst.querySelector('label[group="Code"] text') || inst.querySelector('label[group="code"] text');
    let codeText = (codeNode ? codeNode.textContent : (inst.getAttribute('code') || `Event_${i+1}`))
                    .replace(/HOME/g, homeTeam).replace(/AWAY/g, awayTeam);
    
    const labelNodes = inst.querySelectorAll('label');
    const labels = {};
    for (let j = 0; j < labelNodes.length; j++) {
      const groupNode = labelNodes[j].querySelector('group');
      const textNode  = labelNodes[j].querySelector('text');
      
      const group = groupNode ? groupNode.textContent : (labelNodes[j].getAttribute('group') || `Group_${j}`);
      let text = textNode ? textNode.textContent : (labelNodes[j].getAttribute('text') || "");
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

async function deleteMatchWithEvents(matchId, matchName) {
  if (!confirm(`'${matchName}' 경기를 삭제하시겠습니까? 관련한 모든 분석 이벤트 데이터가 함께 영구 삭제됩니다.`)) return;
  
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

    // 2. Matches 문서 삭제 (Sportsplay 내부용)
    await deleteDoc(doc(db, 'Matches', matchId));
    
    // 3. 대시보드 연동용 'matches' 문서 삭제 시도 (videoMatchId 기반)
    const qDash = query(collection(db, 'matches'), where('videoMatchId', '==', matchId));
    const snapDash = await getDocs(qDash);
    if (!snapDash.empty) {
      const batchDash = writeBatch(db);
      snapDash.forEach(d => batchDash.delete(d.ref));
      await batchDash.commit();
    }
    
    alert('경기가 성공적으로 삭제되었습니다.');
    if (activeMatchId === matchId) setActiveMatch(null);
    fetchAndRenderMatches();
    fetchAndRenderEvents();
  } catch(err) {
    console.error('삭제 오류:', err);
    alert('삭제 중 오류가 발생했습니다.');
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
          <button class="small-btn delete-match-btn" title="매치 삭제" style="background:#e74c3c;">🗑️</button>
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
      const isCSV = file.name.toLowerCase().endsWith('.csv');
      
      // UTF-16 LE/BE BOM 감지 인코딩 처리
      const textData = await readFileWithEncoding(file);
      
      const parsedEvents = isCSV 
        ? parseCSVEvents(textData, videoMatchId, matchMetadata.home_team, matchMetadata.away_team)
        : parseSportsCodeXML(textData, videoMatchId, matchMetadata.home_team, matchMetadata.away_team);

      if(parsedEvents.length === 0) {
        alert('파싱된 이벤트가 없습니다. XML 포맷을 확인해주세요.');
      } else {
        await uploadEventsBatch(parsedEvents);
        const dashboardEvents = parsedEvents.map((ev,i) => {
          let eventType = 'sequence';
          const codeUpper = ev.code.toUpperCase();
          const labelsValsStr = Object.values(ev.labels).join(' ').toUpperCase();
          
          if (codeUpper.includes('턴오버') || codeUpper.includes('TURNOVER') || labelsValsStr.includes('TURNOVER') || labelsValsStr.includes('턴오버') || codeUpper.includes('프레스') || codeUpper.includes('압박')) {
             eventType = 'turnover';
          }
          else if (codeUpper.includes('파울') || codeUpper.includes('FOUL') || labelsValsStr.includes('FOUL') || labelsValsStr.includes('파울')) {
             eventType = 'foul';
          }

          const locLabel = ev.labels['Location'] || ev.labels['Zone'] || ev.labels['지역'] || ev.labels['구역'] || '';
          const resLabel = ev.labels['Result'] || ev.labels['Outcome'] || ev.labels['결과'] || '';

          return {
            id: `ev-${i}-${Date.now()}`, team: ev.team, time: ev.start_time,
            duration: ev.duration, code: ev.code,
            type: eventType,
            quarter: detectQuarter(Object.values(ev.labels).join(' '), ev.start_time),
            locationLabel: locLabel,
            resultLabel: resLabel,
          };
        });
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
