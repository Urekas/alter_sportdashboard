import { db, collection, addDoc, writeBatch, doc, getDocs, orderBy, query, where } from './firebase-config.js';
import { mapZone, detectQuarter, createMatchDataForDashboard } from './analysis-utils.js';
import { initPlayer, fetchAndRenderEvents, player, isPlayerReady } from './player.js';
import { initDrawingBoard } from './drawing.js';
import { initLibrary } from './library.js';

// --- DOM Elements ---
const documentBody = document.body;

// Buttons and Panels
const btnToggleLeft = document.getElementById('toggle-left-btn');
const btnToggleRight = document.getElementById('toggle-right-btn');
const btnShowLeft = document.getElementById('show-left-btn');
const btnShowRight = document.getElementById('show-right-btn');
const tournamentSelect = document.getElementById('match-tournament-select');

// Forms and Inputs
const matchForm = document.getElementById('match-form');
const submitBtn = matchForm.querySelector('button[type="submit"]');

tournamentSelect.addEventListener('change', () => {
  const newNameInput = document.getElementById('new-tournament-name');
  if (tournamentSelect.value === 'new') {
    newNameInput.style.display = 'block';
    newNameInput.required = true;
  } else {
    newNameInput.style.display = 'none';
    newNameInput.required = false;
  }
});

// --- Layout Toggles ---

function toggleLeftPanel() {
  documentBody.classList.toggle('hide-left');
  if (documentBody.classList.contains('hide-left')) {
    btnShowLeft.classList.remove('hidden');
  } else {
    btnShowLeft.classList.add('hidden');
  }
}

function toggleRightPanel() {
  documentBody.classList.toggle('hide-right');
  if (documentBody.classList.contains('hide-right')) {
    btnShowRight.classList.remove('hidden');
  } else {
    btnShowRight.classList.add('hidden');
  }
}

// Register Listeners for layout
btnToggleLeft.addEventListener('click', toggleLeftPanel);
btnShowLeft.addEventListener('click', toggleLeftPanel);
btnToggleRight.addEventListener('click', toggleRightPanel);
btnShowRight.addEventListener('click', toggleRightPanel);

// --- Admin Metadata & Parsing Logic ---

matchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!eventDataFile.files.length) {
    alert("XML 또는 CSV 데이터 파일을 첨부해주세요.");
    return;
  }
  
  let tournamentId = tournamentSelect.value;
  if (tournamentId === 'new') {
    const newName = document.getElementById('new-tournament-name').value;
    if (!newName) {
      alert("새 대회 이름을 입력해주세요.");
      return;
    }
    try {
      const tRef = await addDoc(collection(db, "tournaments"), { name: newName, createdAt: new Date().toISOString() });
      tournamentId = tRef.id;
    } catch(err) {
      alert("새 대회 생성 중 오류가 발생했습니다.");
      return;
    }
  } else if (!tournamentId) {
    alert("연동할 대회를 선택해주세요.");
    return;
  }

  // 1. Gather Metadata inputs
  const matchMetadata = {
    match_name: document.getElementById('match-name').value,
    match_date: document.getElementById('match-date').value,
    home_team: document.getElementById('home-team').value,
    away_team: document.getElementById('away-team').value,
    tournament_id: tournamentId,
    video_urls: {
      tactical_cam: document.getElementById('tactical-url').value,
      broadcast_cam: document.getElementById('broadcast-url').value
    },
    video_offsets: {
      tactical_cam: parseFloat(document.getElementById('tactical-offset').value) || 0,
      broadcast_cam: parseFloat(document.getElementById('broadcast-offset').value) || 0
    },
    rosters: { home: [], away: [] },
    created_at: new Date().toISOString()
  };
  
  submitBtn.disabled = true;
  submitBtn.textContent = "데이터를 파싱하고 브릿지(Dashboard)와 동기화 중입니다...";

  try {
    // 2. Matches (Video Tool) 컬렉션에 추가
    console.log("Saving Video Match Metadata...");
    const videoMatchRef = await addDoc(collection(db, "Matches"), matchMetadata);
    const videoMatchId = videoMatchRef.id;

    // 3. XML 파싱
    const file = eventDataFile.files[0];
    const textData = await file.text();
    console.log("Parsing XML Data...");
    const parsedEvents = parseSportsCodeXML(textData, videoMatchId, matchMetadata.home_team, matchMetadata.away_team);
    
    if(parsedEvents.length === 0) {
      alert("파싱된 이벤트가 없습니다. XML 포맷을 확인해주세요.");
    } else {
      // 4. Video Events 일괄 저장
      console.log(`Uploading ${parsedEvents.length} video events...`);
      await uploadEventsBatch(parsedEvents);
      
      // 5. Dashboard (Next.js) 동기화 - MatchData 생성 및 저장
      console.log("Syncing with Statistics Dashboard...");
      // dashboardEvents 포맷으로 변환 (analysis-utils 요구사항에 맞춤)
      const dashboardEvents = parsedEvents.map((ev, i) => ({
        id: `ev-${i}-${Date.now()}`,
        team: ev.team,
        time: ev.start_time,
        duration: ev.duration,
        code: ev.code,
        quarter: detectQuarter(Object.values(ev.labels).join(" "), ev.start_time),
        locationLabel: ev.labels["Location"] || ev.labels["Zone"] || "",
        resultLabel: ev.labels["Result"] || ev.labels["Outcome"] || "",
        // x, y 는 analysis-utils 내부의 mapZone에서 code나 locationLabel 기반으로 계산됨
      }));

      const dashboardMatchData = createMatchDataForDashboard(
        dashboardEvents,
        matchMetadata.home_team,
        matchMetadata.away_team,
        tournamentId,
        matchMetadata.match_name
      );

      // 'matches' 컬렉션에 추가 (Dashboard용)
      await addDoc(collection(db, "matches"), {
        ...dashboardMatchData,
        videoMatchId: videoMatchId, // 비디오 분석 페이지 연결용 링크 ID
        uploadedAt: new Date().toISOString()
      });

      alert(`통합 업로드가 완료되었습니다!\n- 비디오 매치 ID: ${videoMatchId}\n- 대시보드 통계 동기화 완료\n- 저장된 이벤트: ${parsedEvents.length}개`);
      matchForm.reset();
      await fetchAndRenderEvents(); // 리스트 갱신
    }

  } catch(error) {
    console.error("Error during upload process: ", error);
    alert("업로드 중 오류가 발생했습니다.\n" + error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "경기 등록 및 파싱";
  }
});

// XML 추출 및 치환 로직 (DOMParser 활용)
function parseSportsCodeXML(xmlText, matchId, homeTeam, awayTeam) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  const instances = xmlDoc.getElementsByTagName("instance");
  const events = [];

  for (let i = 0; i < instances.length; i++) {
    const instance = instances[i];
    
    // 시간 정보 추출
    const startNode = instance.querySelector("start");
    const endNode = instance.querySelector("end");
    const start = startNode ? parseFloat(startNode.textContent) : 0;
    const end = endNode ? parseFloat(endNode.textContent) : 0;
    
    // 코드 텍스트 추출 및 HOME/AWAY 치환
    const codeNode = instance.querySelector("code");
    let codeText = codeNode ? codeNode.textContent : "";
    codeText = codeText.replace(/HOME/g, homeTeam).replace(/AWAY/g, awayTeam);
    
    // 라벨 텍스트 추출 및 치환
    const labelNodes = instance.querySelectorAll("label");
    const labels = {};
    for (let j = 0; j < labelNodes.length; j++) {
        const groupNode = labelNodes[j].querySelector("group");
        const textNode = labelNodes[j].querySelector("text");
        
        const group = groupNode ? groupNode.textContent : `Group_${j}`;
        let text = textNode ? textNode.textContent : "";
        
        // 라벨 내부 텍스트 치환
        text = text.replace(/HOME/g, homeTeam).replace(/AWAY/g, awayTeam);
        labels[group] = text;
    }

    // 팀 유추 (코드에 홈/어웨이 이름이 포함된 경우)
    let team = "Unknown";
    if (codeText.includes(homeTeam)) team = homeTeam;
    else if (codeText.includes(awayTeam)) team = awayTeam;

    events.push({
      match_id: matchId,
      code: codeText,
      team: team,
      start_time: start,
      end_time: end,
      duration: parseFloat((end - start).toFixed(2)),
      labels: labels,
      created_at: new Date().toISOString()
    });
  }
  
  return events;
}

// 500개 제한 준수를 위한 Batch Write 분할 함수
async function uploadEventsBatch(events) {
  const BATCH_SIZE = 400; // Firestore limit is 500, keeping it safe
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = events.slice(i, i + BATCH_SIZE);
    
    chunk.forEach(eventData => {
      // 새 문서에 대한 레퍼런스 생성 (ID 자동 생성)
      const eventRef = doc(collection(db, "Events"));
      batch.set(eventRef, eventData);
    });
    
    await batch.commit();
    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} committed. (${chunk.length} items)`);
  }
}

// --- Step 3 Initialization ---

// Global callback for YouTube API
window.onYouTubeIframeAPIReady = () => {
  initPlayer();
};

async function loadTournaments() {
  try {
    const q = query(collection(db, "tournaments"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    tournamentSelect.innerHTML = '<option value="">연동할 대회 선택</option>';
    snapshot.forEach(doc => {
      const data = doc.data();
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = data.name || "Unnamed Tournament";
      tournamentSelect.appendChild(option);
    });
    
    // Custom option for new tournament
    const newOption = document.createElement('option');
    newOption.value = "new";
    newOption.textContent = "+ 새 대회 직접 입력";
    tournamentSelect.appendChild(newOption);
  } catch (err) {
    console.error("Failed to load tournaments:", err);
    tournamentSelect.innerHTML = '<option value="">대회 로드 실패</option>';
  }
}

async function fetchAndRenderMatches() {
  const matchesUl = document.getElementById('matches-ul');
  try {
    const q = query(collection(db, "Matches"), orderBy("created_at", "desc"));
    const snapshot = await getDocs(q);
    matchesUl.innerHTML = '';
    
    if (snapshot.empty) {
      matchesUl.innerHTML = '<li>아직 등록된 경기가 없습니다.</li>';
      return;
    }

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
      
      // 비디오 분석 버튼 클릭 시 매치 로드 (기존 로직 유지)
      li.querySelector('.analyze-btn').addEventListener('click', () => {
         // 실제로는 player.js의 비디오 ID 교체 로직 등이 필요함
         alert(`'${data.match_name}' 경기를 분석 모드로 전환합니다.`);
      });
      
      matchesUl.appendChild(li);
    });
  } catch (err) {
    console.error("Failed to load matches:", err);
  }
}

async function handleUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const matchId = params.get('matchId');
  const time = params.get('time');

  if (matchId) {
    console.log(`URL Param detected: matchId=${matchId}`);
    // 실제로는 해당 matchId의 이벤트를 필터링해서 보여주거나, 비디오 URL을 로드해야 함
    // (현재는 전체 이벤트를 보여주는 방식이므로, 차후에 필터 기능을 강화할 수 있음)
  }

  if (time && !isNaN(parseFloat(time))) {
    const targetTime = parseFloat(time);
    console.log(`URL Param detected: seek to ${targetTime}s`);
    
    const checkReady = setInterval(() => {
      if (window.isPlayerReady && window.player && typeof window.player.seekTo === 'function') {
        window.player.seekTo(targetTime, true);
        window.player.playVideo();
        clearInterval(checkReady);
      }
    }, 500);
    
    // 5초 후에도 안되면 포기
    setTimeout(() => clearInterval(checkReady), 5000);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Load YouTube IFrame API Script dynamically
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName('script')[0];
  if (firstScriptTag) {
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  } else {
    document.head.appendChild(tag);
  }
  
  // Dashboard 연동을 위한 대회 목록 로드
  await loadTournaments();
  
  // 경기 목록 로드 (대시보드 링크 포함)
  await fetchAndRenderMatches();

  // URL 파라미터 처리 (대시보드에서 넘어온 경우)
  handleUrlParams();

  // Fetch initial Events for Code Viewer
  await fetchAndRenderEvents();
  
  // Step 9 Initialize Library
  initLibrary();
  
  // Step 4 Initialize Fabric Canvas Overlay
  initDrawingBoard();
});
