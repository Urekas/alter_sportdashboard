import { db, collection, getDocs, addDoc } from './firebase-config.js';
import { allEvents, updateCurrentPlaylist } from './player.js';

// DOM Elements
const tabBtnLibrary = document.getElementById('tab-btn-library');
const tabBtnAdmin = document.getElementById('tab-btn-admin');
const tabLibrary = document.getElementById('tab-library');
const tabAdmin = document.getElementById('tab-admin');

const filterCompetition = document.getElementById('filter-competition');
const filterTeam = document.getElementById('filter-team');
const filterCodeContainer = document.getElementById('filter-code-container');
const btnCreatePlaylist = document.getElementById('btn-create-playlist');
const cartCountSpan = document.getElementById('cart-count');
const libraryResultsUl = document.getElementById('library-results-ul');
const playlistsUl = document.getElementById('playlists-ul');

const playlistModal = document.getElementById('playlist-modal');
const playlistTitle = document.getElementById('playlist-title');
const modalBtnCancel = document.getElementById('modal-btn-cancel');
const modalBtnConfirm = document.getElementById('modal-btn-confirm');
const modalCartCount = document.getElementById('modal-cart-count');

const btnSelectAll = document.getElementById('btn-select-all');
const btnDeselectAll = document.getElementById('btn-deselect-all');
const btnBatchCapture = document.getElementById('btn-batch-capture');

// State
let matchesData = {}; // match_id -> match object
let playlistCart = new Set(); // store selected event docs (or IDs)

export async function initLibrary() {
    setupTabs();
    await fetchMatches();
    setupModals();
    setupSelectionControls();
    
    // allEvents 로드 대기 (최대 5초, 폴백 포함)
    let waited = 0;
    const waitForEvents = setInterval(() => {
        waited += 500;
        if (allEvents && allEvents.length > 0) {
            clearInterval(waitForEvents);
            populateFilters();
            applyLibraryFilters();
            fetchAndRenderPlaylists();
        } else if (waited >= 5000) {
            clearInterval(waitForEvents);
            // 5초 후에도 데이터 없으면 폴백
            libraryResultsUl.innerHTML = '<li style="color:var(--text-muted);font-size:0.9em;padding:10px;">등록된 이벤트가 없습니다.<br><small>Admin 탭에서 경기를 먼저 등록하세요.</small></li>';
            filterCodeContainer.innerHTML = '<label style="color:#888;font-size:0.8em;">데이터 없음</label>';
            fetchAndRenderPlaylists();
        }
    }, 500);
}

function setupTabs() {
    tabBtnLibrary.addEventListener('click', () => {
        tabBtnLibrary.classList.add('active');
        tabBtnAdmin.classList.remove('active');
        tabLibrary.style.display = 'flex';
        tabAdmin.style.display = 'none';
    });

    tabBtnAdmin.addEventListener('click', () => {
        tabBtnAdmin.classList.add('active');
        tabBtnLibrary.classList.remove('active');
        tabAdmin.style.display = 'block';
        tabLibrary.style.display = 'none';
    });
}

async function fetchMatches() {
    try {
        const querySnapshot = await getDocs(collection(db, "Matches"));
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            data.id = doc.id;
            matchesData[doc.id] = data;
            
            // Populate select
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = data.match_name + ` (${data.match_date ? data.match_date.split('T')[0] : ''})`;
            filterCompetition.appendChild(option);
        });
    } catch (e) {
        console.error("Error fetching Matches: ", e);
    }
}

function populateFilters() {
    // Extract unique teams and codes from allEvents
    const teams = new Set();
    const codes = new Set();
    
    allEvents.forEach(ev => {
        if(ev.team && ev.team !== 'Unknown') teams.add(ev.team);
        if(ev.code) codes.add(ev.code);
    });

    // Populate team filter
    teams.forEach(team => {
        const option = document.createElement('option');
        option.value = team;
        option.textContent = team;
        filterTeam.appendChild(option);
    });

    // Populate codes as checkboxes
    filterCodeContainer.innerHTML = ''; // clear loading
    if(codes.size === 0) {
         filterCodeContainer.innerHTML = '<label style="color:#888; font-size: 0.8em;">이벤트 없음</label>';
    }
    
    codes.forEach(code => {
        const label = document.createElement('label');
        label.className = 'filter-code-label';
        label.innerHTML = `<input type="checkbox" value="${code}" class="filter-code-cb"> ${code}`;
        filterCodeContainer.appendChild(label);
    });

    // Add event listeners to all filters
    filterCompetition.addEventListener('change', applyLibraryFilters);
    filterTeam.addEventListener('change', applyLibraryFilters);
    const codeCbs = document.querySelectorAll('.filter-code-cb');
    codeCbs.forEach(cb => cb.addEventListener('change', applyLibraryFilters));
}

function applyLibraryFilters() {
    const selectedMatch = filterCompetition.value;
    const selectedTeam = filterTeam.value;
    const selectedCodes = Array.from(document.querySelectorAll('.filter-code-cb:checked')).map(cb => cb.value);

    const filtered = allEvents.filter(ev => {
        if (selectedMatch && ev.match_id !== selectedMatch) return false;
        if (selectedTeam && ev.team !== selectedTeam) return false;
        if (selectedCodes.length > 0 && !selectedCodes.includes(ev.code)) return false;
        return true;
    });

    renderLibraryResults(filtered);
}

function renderLibraryResults(filteredEvents) {
    libraryResultsUl.innerHTML = '';
    
    if (filteredEvents.length === 0) {
        libraryResultsUl.innerHTML = '<li style="color: var(--text-muted); font-size: 0.9em;">조건에 맞는 클립이 없습니다.</li>';
        return;
    }

    filteredEvents.forEach(ev => {
        const li = document.createElement('li');
        li.className = 'clip-item';
        
        const matchName = matchesData[ev.match_id] ? matchesData[ev.match_id].match_name : 'Unknown Match';
        const isChecked = playlistCart.has(ev.id);
        
        li.innerHTML = `
            <label class="clip-checkbox-container">
                <input type="checkbox" class="clip-checkbox" value="${ev.id}" ${isChecked ? 'checked' : ''}>
                <span class="checkmark"></span>
            </label>
            <div class="clip-info">
                <div class="clip-header">
                    <span class="clip-code">${ev.code}</span>
                    <span class="clip-team">${ev.team}</span>
                </div>
                <div class="clip-match">${matchName}</div>
                <div class="clip-time">${ev.start_time.toFixed(1)}s ~ ${ev.end_time.toFixed(1)}s (Dur: ${ev.duration}s)</div>
            </div>
        `;
        
        const cb = li.querySelector('.clip-checkbox');
        cb.addEventListener('change', (e) => {
            if (e.target.checked) {
                playlistCart.add(ev.id);
                li.classList.add('selected');
            } else {
                playlistCart.delete(ev.id);
                li.classList.remove('selected');
            }
            updateCartUI();
        });

        if(isChecked) li.classList.add('selected');

        libraryResultsUl.appendChild(li);
    });
}

function updateCartUI() {
    const count = playlistCart.size;
    cartCountSpan.textContent = count;
    modalCartCount.textContent = count;

    if (count > 0) {
        btnCreatePlaylist.style.display = 'block';
        btnBatchCapture.style.display = 'block';
    } else {
        btnCreatePlaylist.style.display = 'none';
        btnBatchCapture.style.display = 'none';
    }
}

function setupSelectionControls() {
    btnSelectAll.addEventListener('click', () => {
        // 현재 리스트에 보이는 모든 클립들을 추가
        const cbs = document.querySelectorAll('.clip-checkbox');
        cbs.forEach(cb => {
            if (!cb.checked) {
                cb.checked = true;
                playlistCart.add(cb.value);
                cb.closest('.clip-item').classList.add('selected');
            }
        });
        updateCartUI();
    });

    btnDeselectAll.addEventListener('click', () => {
        const cbs = document.querySelectorAll('.clip-checkbox');
        cbs.forEach(cb => {
            if (cb.checked) {
                cb.checked = false;
                playlistCart.delete(cb.value);
                cb.closest('.clip-item').classList.remove('selected');
            }
        });
        updateCartUI();
    });

    btnBatchCapture.addEventListener('click', () => {
        if(confirm(`${playlistCart.size}개의 클립을 하나의 시퀀스로 추출하시겠습니까?\n(유튜브 영상의 경우 '이 탭 공유' 권한이 필요합니다.)`)) {
            startBatchCapture();
        }
    });
}

function setupModals() {
    btnCreatePlaylist.addEventListener('click', () => {
        playlistModal.classList.add('active');
        playlistTitle.focus();
    });

    modalBtnCancel.addEventListener('click', () => {
        playlistModal.classList.remove('active');
        playlistTitle.value = '';
    });

    modalBtnConfirm.addEventListener('click', async () => {
        const title = playlistTitle.value.trim();
        if(!title) {
            alert('플레이리스트 제목을 입력해주세요.');
            return;
        }

        const btn = modalBtnConfirm;
        btn.disabled = true;
        btn.textContent = '저장 중...';

        try {
            await addDoc(collection(db, "Playlists"), {
                title: title,
                event_ids: Array.from(playlistCart),
                created_at: new Date().toISOString()
            });
            
            alert('플레이리스트가 성공적으로 생성되었습니다!');
            
            // 초기화
            playlistCart.clear();
            updateCartUI();
            applyLibraryFilters(); // 체크박스 해제 반영
            
            playlistModal.classList.remove('active');
            playlistTitle.value = '';

            // 플레이리스트 목록 갱신
            fetchAndRenderPlaylists();
        } catch (e) {
            console.error('Error creating playlist: ', e);
            alert('오류가 발생했습니다.');
        } finally {
            btn.disabled = false;
            btn.textContent = '저장 및 반영';
        }
    });
}

// --- Playlist List Logic ---
async function fetchAndRenderPlaylists() {
    try {
        playlistsUl.innerHTML = '<li style="color: var(--text-muted); font-size: 0.9em;">불러오는 중...</li>';
        const querySnapshot = await getDocs(collection(db, "Playlists"));
        
        playlistsUl.innerHTML = '';
        if (querySnapshot.empty) {
            playlistsUl.innerHTML = '<li style="color: var(--text-muted); font-size: 0.9em;">저장된 플레이리스트가 없습니다.</li>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const li = document.createElement('li');
            li.className = 'playlist-item';
            li.style.cssText = `
                padding: 12px;
                border-bottom: 1px solid var(--border-color);
                cursor: pointer;
                transition: background-color 0.2s;
                display: flex;
                flex-direction: column;
                gap: 5px;
            `;
            
            li.innerHTML = `
                <div style="font-weight:bold; color:var(--text-main);"><i class="fa-solid fa-list-check" style="margin-right:8px; color:var(--accent);"></i> ${data.title}</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">${data.event_ids.length} Clips (${data.created_at ? data.created_at.split('T')[0] : 'N/A'})</div>
            `;

            li.addEventListener('click', () => {
                loadSelectedPlaylist(data.event_ids, data.title);
            });

            playlistsUl.appendChild(li);
        });
    } catch (e) {
        console.error("Error fetching playlists: ", e);
    }
}

// 플레이리스트를 선택하여 재생 모드로 로드
function loadSelectedPlaylist(eventIds, title) {
    if (!allEvents || allEvents.length === 0) return;

    // 1. 전체 이벤트 중 ID가 포함된 것만 필터링
    const selectedEvents = allEvents.filter(ev => eventIds.includes(ev.id));
    
    if (selectedEvents.length === 0) {
        alert("플레이리스트 내에 유효한 클립이 없습니다.");
        return;
    }

    // 2. 검색창 초기화 (다른 필터링과 섞이지 않게) 및 UI 알림
    const searchInput = document.getElementById('event-search');
    if(searchInput) searchInput.value = "";
    
    alert(`'${title}' 플레이리스트를 불러왔습니다. 오른쪽 Code Viewer에서 확인하세요.`);

    // 3. player.js의 updateCurrentPlaylist를 사용하여 Code Viewer 업데이트
    updateCurrentPlaylist(selectedEvents);
    
    // UI 상단에 현재 불러온 플레이리스트 제목 표시 (선택 사항: Code Viewer 헤더 수정)
    const eventsUl = document.getElementById('events-ul');
    const titleLi = document.createElement('li');
    titleLi.style.cssText = "padding:10px; background:#1e1e2f; border-bottom:2px solid var(--accent); color:var(--accent); font-weight:bold; position:sticky; top:0; z-index:10;";
    titleLi.innerHTML = `<i class="fa-solid fa-play-circle"></i> loaded Playlist: ${title}`;
    eventsUl.prepend(titleLi);
}

// --- Batch Video Capture Logic ---
// Ported/Adapted from tacticalboard startCleanRecording
async function startBatchCapture() {
    const selectedEvents = allEvents.filter(ev => playlistCart.has(ev.id))
                                   .sort((a, b) => a.start_time - b.start_time);
    
    if (selectedEvents.length === 0) return;

    const preRoll = parseFloat(prompt("분석 지점 [몇 초 전]부터 영상을 재생할까요?", "2.0")) || 2.0;
    const postRoll = parseFloat(prompt("클립 종료 후 [보너스 재생]을 몇 초 할까요?", "1.0")) || 1.0;

    const videoContainer = document.getElementById('video-container');
    const canvas = window._fabricCanvas;
    if(!canvas) return;

    // Use Screen Capture API for YouTube
    let screenStream = null;
    let screenVideo = null;

    try {
        alert("시퀀스 추출을 시작합니다.\n반드시 [이 탭(현재 탭)]을 선택하고 공유를 허용해주세요.");
        screenStream = await navigator.mediaDevices.getDisplayMedia({ 
            preferCurrentTab: true, 
            video: { displaySurface: 'browser' } 
        });
        screenVideo = document.createElement('video');
        screenVideo.srcObject = screenStream;
        screenVideo.muted = true;
        screenVideo.play();
        await new Promise(r => screenVideo.onloadedmetadata = r);
    } catch (e) {
        return alert("화면 공유 권한이 거부되어 캡처를 취소합니다.");
    }

    const recCanvas = document.createElement('canvas');
    recCanvas.width = canvas.width;
    recCanvas.height = canvas.height;
    const ctx = recCanvas.getContext('2d');

    const stream = recCanvas.captureStream(60);
    const options = { mimeType: 'video/webm; codecs=vp9', videoBitsPerSecond: 12000000 };
    const recorder = new MediaRecorder(stream, options);
    const chunks = [];

    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const a = document.createElement('a'); 
        a.href = URL.createObjectURL(blob);
        a.download = `SportsPlay_Batch_${Date.now()}.webm`; 
        a.click();
        if (screenStream) screenStream.getTracks().forEach(t => t.stop());
        alert("영상 추출이 완료되었습니다.");
    };

    let isRecordingLoop = true;
    function renderComposite() {
        if (!isRecordingLoop) return;
        
        // Match capture rect to player container
        const rect = videoContainer.getBoundingClientRect();
        const scaleX = screenVideo.videoWidth / window.innerWidth;
        const scaleY = screenVideo.videoHeight / window.innerHeight;
        
        const cropX = rect.left * scaleX;
        const cropY = rect.top * scaleY;
        const cropW = rect.width * scaleX;
        const cropH = rect.height * scaleY;

        ctx.drawImage(screenVideo, cropX, cropY, cropW, cropH, 0, 0, recCanvas.width, recCanvas.height);
        // Draw annotations (if any)
        ctx.drawImage(canvas.getElement(), 0, 0, recCanvas.width, recCanvas.height);
        
        requestAnimationFrame(renderComposite);
    }

    recorder.start();
    renderComposite();

    const { player } = await import('./player.js');

    for (let ev of selectedEvents) {
        const targetTime = Math.max(0, ev.start_time - preRoll);
        const duration = ev.duration + preRoll + postRoll;

        // Seek and Play
        if (player && typeof player.seekTo === 'function') {
            player.seekTo(targetTime, true);
            player.playVideo();
            
            // Wait for duration
            await new Promise(res => setTimeout(res, duration * 1000));
            player.pauseVideo();
        }
        
        // Optional: clear canvas between clips?
        // if(confirmClear) canvas.clear();
    }

    isRecordingLoop = false;
    recorder.stop();
}
