import { db, collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from './firebase-config.js';
import { allEvents, updateCurrentPlaylist, playlistCart, updateCartUI } from './player.js';

// State
let matchesData = {};
let currentEditingPlaylistId = null;

// ──────────────────────────────────────────────
// 내부 헬퍼: DOM 없이 호출 가능한 순수 필터/렌더 함수
// ──────────────────────────────────────────────
function _applyFilters() {
    const filterCompetitionContainer = document.getElementById('filter-competition-container');
    const filterTeamContainer        = document.getElementById('filter-team-container');
    const filterDateStart            = document.getElementById('filter-date-start');
    const filterDateEnd              = document.getElementById('filter-date-end');
    const libraryResultsUl           = document.getElementById('library-results-ul');
    if (!libraryResultsUl) return;

    const selectedMatches = Array.from(filterCompetitionContainer?.querySelectorAll('.filter-match-cb:checked') || []).map(cb => cb.value);
    const selectedTeams   = Array.from(filterTeamContainer?.querySelectorAll('.filter-team-cb:checked') || []).map(cb => cb.value);
    const selectedCodes   = Array.from(document.querySelectorAll('.filter-code-cb:checked')).map(cb => cb.value);

    const startDateStr = filterDateStart?.value || '';
    const endDateStr   = filterDateEnd?.value || '';

    // Update counts
    const countMatchSpan = document.getElementById('filter-competition-count');
    const countTeamSpan  = document.getElementById('filter-team-count');
    const countCodeSpan  = document.getElementById('filter-code-count');
    if (countMatchSpan) countMatchSpan.textContent = selectedMatches.length;
    if (countTeamSpan) countTeamSpan.textContent = selectedTeams.length;
    if (countCodeSpan) countCodeSpan.textContent = selectedCodes.length;

    const filtered = allEvents.filter(ev => {
        const matchInfo = matchesData[ev.match_id];
        if (startDateStr || endDateStr) {
            if (!matchInfo || !matchInfo.match_date) return false;
            const mDate = matchInfo.match_date.split('T')[0];
            if (startDateStr && mDate < startDateStr) return false;
            if (endDateStr && mDate > endDateStr) return false;
        }
        if (selectedMatches.length > 0 && !selectedMatches.includes(ev.match_id)) return false;
        if (selectedTeams.length > 0 && !selectedTeams.includes(ev.team)) return false;
        if (selectedCodes.length > 0 && !selectedCodes.includes(ev.code)) return false;
        return true;
    });

    // 가나다 순으로 정렬 표시 (코드명 기준 정렬 후 시간 순)
    filtered.sort((a, b) => {
        const codeCmp = a.code.localeCompare(b.code, 'ko');
        if (codeCmp !== 0) return codeCmp;
        return a.start_time - b.start_time;
    });

    _renderResults(filtered, libraryResultsUl);
}

function _renderResults(filteredEvents, libraryResultsUl) {
    if (!libraryResultsUl) return;
    libraryResultsUl.innerHTML = '';
    if (filteredEvents.length === 0) {
        libraryResultsUl.innerHTML = '<li style="color:var(--text-muted);font-size:0.9em;">조건에 맞는 클립이 없습니다.</li>';
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
                <div class="clip-time">${ev.start_time.toFixed(1)}s ~ ${ev.end_time.toFixed(1)}s (${ev.duration}s)</div>
            </div>
        `;
        const cb = li.querySelector('.clip-checkbox');
        cb?.addEventListener('change', (e) => {
            if (e.target.checked) { playlistCart.add(ev.id); li.classList.add('selected'); }
            else { playlistCart.delete(ev.id); li.classList.remove('selected'); }
            updateCartUI(); // player.js의 공유 함수 사용
        });
        if (isChecked) li.classList.add('selected');
        libraryResultsUl.appendChild(li);
    });
}

function _populateFilters() {
    const filterTeamContainer          = document.getElementById('filter-team-container');
    const filterCodeContainer          = document.getElementById('filter-code-container');
    const filterCompetitionContainer   = document.getElementById('filter-competition-container');
    if (!filterCodeContainer) return;

    const teams = new Set();
    const codes = new Set();
    allEvents.forEach(ev => {
        if (ev.team && ev.team !== 'Unknown') teams.add(ev.team);
        if (ev.code) codes.add(ev.code);
    });

    // Match 체크박스
    if (filterCompetitionContainer) {
        filterCompetitionContainer.innerHTML = '';
        Object.keys(matchesData).forEach(matchId => {
            const data = matchesData[matchId];
            const label = document.createElement('label');
            label.className = 'filter-code-label';
            label.style.display = 'flex'; label.style.gap = '5px';
            label.innerHTML = `<input type="checkbox" value="${matchId}" class="filter-match-cb"> <span>${data.match_name} <small style="color:#aaa">(${data.match_date ? data.match_date.split('T')[0] : '날짜 모름'})</small></span>`;
            filterCompetitionContainer.appendChild(label);
        });
    }

    // Team 체크박스
    if (filterTeamContainer) {
        filterTeamContainer.innerHTML = '';
        if (teams.size === 0) filterTeamContainer.innerHTML = '<label style="color:#888;font-size:0.8em;">팀 없음</label>';
        teams.forEach(team => {
            const label = document.createElement('label');
            label.className = 'filter-code-label';
            label.style.display = 'flex'; label.style.gap = '5px';
            label.innerHTML = `<input type="checkbox" value="${team}" class="filter-team-cb"> ${team}`;
            filterTeamContainer.appendChild(label);
        });
    }

    // Code 체크박스 (가나다 정렬)
    filterCodeContainer.innerHTML = '';
    if (codes.size === 0) {
        filterCodeContainer.innerHTML = '<label style="color:#888;font-size:0.8em;">이벤트 없음</label>';
    }
    const sortedCodes = Array.from(codes).sort((a, b) => a.localeCompare(b, 'ko'));
    sortedCodes.forEach(code => {
        const label = document.createElement('label');
        label.className = 'filter-code-label';
        label.style.display = 'flex'; label.style.gap = '5px';
        label.innerHTML = `<input type="checkbox" value="${code}" class="filter-code-cb"> ${code}`;
        filterCodeContainer.appendChild(label);
    });

    document.querySelectorAll('.filter-match-cb, .filter-team-cb, .filter-code-cb').forEach(cb =>
        cb.addEventListener('change', _applyFilters)
    );
    const dateStart = document.getElementById('filter-date-start');
    const dateEnd   = document.getElementById('filter-date-end');
    if (dateStart) dateStart.addEventListener('change', _applyFilters);
    if (dateEnd)   dateEnd.addEventListener('change', _applyFilters);
}

// ──────────────────────────────────────────────
// 메인 초기화 함수
// ──────────────────────────────────────────────
export async function initLibrary() {
    const libraryResultsUl  = document.getElementById('library-results-ul');
    if (!libraryResultsUl) {
        console.warn('initLibrary: #library-results-ul not found, skipping.');
        return;
    }

    const filterCompetitionContainer   = document.getElementById('filter-competition-container');
    const filterTeamContainer          = document.getElementById('filter-team-container');
    const filterCodeContainer = document.getElementById('filter-code-container');
    const btnCreatePlaylist   = document.getElementById('btn-create-playlist');
    const playlistsUl         = document.getElementById('playlists-ul');
    const playlistModal       = document.getElementById('playlist-modal');
    const playlistTitle       = document.getElementById('playlist-title');
    const modalBtnCancel      = document.getElementById('modal-btn-cancel');
    const modalBtnConfirm     = document.getElementById('modal-btn-confirm');
    const btnSelectAll        = document.getElementById('btn-select-all');
    const btnDeselectAll      = document.getElementById('btn-deselect-all');
    const btnBatchCapture     = document.getElementById('btn-batch-capture');

    // ── 경기 데이터 로드 ──
    await fetchMatches();

    // ── allEvents 폴링 (최대 8초 대기) ──
    let waited = 0;
    const waitForEvents = setInterval(() => {
        waited += 500;
        if (allEvents && allEvents.length > 0) {
            clearInterval(waitForEvents);
            _populateFilters();
            _applyFilters();
            fetchAndRenderPlaylists(playlistsUl);
        } else if (waited >= 8000) {
            clearInterval(waitForEvents);
            libraryResultsUl.innerHTML = '<li style="color:var(--text-muted);font-size:0.9em;padding:10px;">등록된 이벤트가 없습니다.<br><small>Admin 탭에서 경기를 먼저 등록하세요.</small></li>';
            if (filterCodeContainer) filterCodeContainer.innerHTML = '<label style="color:#888;font-size:0.8em;">데이터 없음</label>';
            fetchAndRenderPlaylists(playlistsUl);
        }
    }, 500);

    // ── 선택 컨트롤 ──
    btnSelectAll?.addEventListener('click', () => {
        document.querySelectorAll('.clip-checkbox, .event-checkbox').forEach(cb => {
            if (!cb.checked) { cb.checked = true; playlistCart.add(cb.value); cb.closest('.clip-item')?.classList.add('selected'); }
        });
        updateCartUI();
    });
    btnDeselectAll?.addEventListener('click', () => {
        document.querySelectorAll('.clip-checkbox, .event-checkbox').forEach(cb => {
            if (cb.checked) { cb.checked = false; playlistCart.delete(cb.value); cb.closest('.clip-item')?.classList.remove('selected'); }
        });
        updateCartUI();
    });

    const triggerBatchCapture = () => {
        if (playlistCart.size === 0) { alert('선택된 항목이 없습니다.'); return; }
        if (confirm(`${playlistCart.size}개의 클립을 시퀀스로 추출하시겠습니까?`)) startBatchCapture();
    };
    btnBatchCapture?.addEventListener('click', triggerBatchCapture);
    document.getElementById('btn-batch-capture-right')?.addEventListener('click', triggerBatchCapture);

    // ── 플레이리스트 모달 ──
    const playlistSelectExisting = document.getElementById('playlist-select-existing');
    const plSaveModes = document.querySelectorAll('input[name="pl-save-mode"]');

    const openPlaylistModal = async () => {
        if (playlistModal) playlistModal.classList.add('active');
        if (playlistTitle) { playlistTitle.value = ''; playlistTitle.disabled = false; }

        // 기존 플레이리스트 목록 로드
        if (playlistSelectExisting) {
            playlistSelectExisting.innerHTML = '<option value="">플레이리스트 선택...</option>';
            try {
                const qs = await getDocs(collection(db, 'Playlists'));
                qs.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.id;
                    opt.textContent = d.data().title;
                    if (currentEditingPlaylistId === d.id) opt.selected = true;
                    playlistSelectExisting.appendChild(opt);
                });
            } catch(e) { console.error('Failed to load playlists for modal:', e); }
        }

        // 편집 모드 or 신규 모드 설정
        const newRadio    = document.querySelector('input[name="pl-save-mode"][value="new"]');
        const updateRadio = document.querySelector('input[name="pl-save-mode"][value="update"]');
        if (currentEditingPlaylistId && updateRadio) {
            updateRadio.checked = true;
            if (playlistSelectExisting) playlistSelectExisting.disabled = false;
            if (playlistTitle) playlistTitle.disabled = true;
        } else if (newRadio) {
            newRadio.checked = true;
            if (playlistSelectExisting) playlistSelectExisting.disabled = true;
        }
    };

    plSaveModes.forEach(radio => radio.addEventListener('change', (e) => {
        if (e.target.value === 'new') {
            if (playlistSelectExisting) playlistSelectExisting.disabled = true;
            if (playlistTitle) { playlistTitle.disabled = false; playlistTitle.focus(); }
        } else {
            if (playlistSelectExisting) { playlistSelectExisting.disabled = false; playlistSelectExisting.focus(); }
            if (playlistTitle) playlistTitle.disabled = true;
        }
    }));

    btnCreatePlaylist?.addEventListener('click', openPlaylistModal);
    document.getElementById('btn-create-playlist-right')?.addEventListener('click', openPlaylistModal);

    modalBtnCancel?.addEventListener('click', () => {
        if (playlistModal) playlistModal.classList.remove('active');
        currentEditingPlaylistId = null;
    });

    modalBtnConfirm?.addEventListener('click', async () => {
        const mode     = document.querySelector('input[name="pl-save-mode"]:checked')?.value;
        const eventIds = Array.from(playlistCart);

        if (modalBtnConfirm) { modalBtnConfirm.disabled = true; modalBtnConfirm.textContent = '저장 중...'; }
        try {
            if (mode === 'new' || !mode) {
                const title = playlistTitle?.value.trim();
                if (!title) { alert('플레이리스트 제목을 입력해주세요.'); return; }
                await addDoc(collection(db, 'Playlists'), {
                    title, event_ids: eventIds, created_at: new Date().toISOString()
                });
                alert('새 플레이리스트가 생성되었습니다!');
            } else {
                const targetId    = playlistSelectExisting?.value;
                if (!targetId) { alert('업데이트할 플레이리스트를 선택해주세요.'); return; }
                const targetTitle = playlistSelectExisting.options[playlistSelectExisting.selectedIndex]?.text || '';
                if (!confirm(`'${targetTitle}' 플레이리스트를 현재 선택된 내용으로 덮어씌울까요?`)) return;
                await updateDoc(doc(db, 'Playlists', targetId), {
                    event_ids: eventIds, updated_at: new Date().toISOString()
                });
                alert('업데이트 완료!');
            }
            playlistCart.clear();
            currentEditingPlaylistId = null;
            updateCartUI();
            _applyFilters();
            if (playlistModal) playlistModal.classList.remove('active');
            fetchAndRenderPlaylists(playlistsUl);
        } catch (e) {
            console.error('Error saving playlist:', e);
            alert('저장 중 오류가 발생했습니다: ' + e.message);
        } finally {
            if (modalBtnConfirm) { modalBtnConfirm.disabled = false; modalBtnConfirm.textContent = '저장 및 반영'; }
        }
    });
}

// ──────────────────────────────────────────────
// 비공개 유틸 함수들
// ──────────────────────────────────────────────
async function fetchMatches() {
    try {
        const querySnapshot = await getDocs(collection(db, 'Matches'));
        matchesData = {};
        querySnapshot.forEach((d) => {
            const data = d.data();
            data.id = d.id;
            matchesData[d.id] = data;
        });
    } catch (e) {
        console.error('Error fetching Matches:', e);
    }
}

async function fetchAndRenderPlaylists(playlistsUl) {
    if (!playlistsUl) return;
    try {
        playlistsUl.innerHTML = '<li style="color:var(--text-muted);font-size:0.9em;">불러오는 중...</li>';
        const querySnapshot = await getDocs(collection(db, 'Playlists'));
        playlistsUl.innerHTML = '';
        if (querySnapshot.empty) {
            playlistsUl.innerHTML = '<li style="color:var(--text-muted);font-size:0.9em;">저장된 플레이리스트가 없습니다.</li>';
            return;
        }
        querySnapshot.forEach((d) => {
            const data = d.data();
            const li = document.createElement('li');
            li.className = 'playlist-item';
            li.style.cssText = 'padding:10px; border-bottom:1px solid var(--border-color); cursor:pointer; transition:background-color 0.2s; display:flex; align-items:center; justify-content:space-between; gap:10px;';
            li.innerHTML = `
                <div style="flex:1;">
                    <div style="font-weight:bold; color:var(--text-main); font-size:0.9rem;">
                        <i class="fa-solid fa-list-check" style="margin-right:8px; color:var(--accent);"></i>${data.title}
                    </div>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:3px;">
                        ${data.event_ids?.length || 0} Clips | ${data.created_at ? data.created_at.split('T')[0] : 'N/A'}
                    </div>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="small-btn edit-pl-btn" title="편집 (카트로 불러오기)" style="background:#3498db;"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="small-btn delete-pl-btn" title="삭제" style="background:#e74c3c;"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `;

            li.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                loadSelectedPlaylist(data.event_ids, data.title);
            });

            li.querySelector('.edit-pl-btn').addEventListener('click', () => {
                if (confirm(`'${data.title}' 플레이리스트를 편집하시겠습니까?\n현재 카트가 비워지고 플레이리스트 항목들이 채워집니다.`)) {
                    playlistCart.clear();
                    (data.event_ids || []).forEach(id => playlistCart.add(id));
                    currentEditingPlaylistId = d.id;
                    const plTitle = document.getElementById('playlist-title');
                    if (plTitle) plTitle.value = data.title;
                    updateCartUI();
                    alert(`'${data.title}' 편집 모드 활성화. 이제 클립을 추가/제거한 뒤 저장 버튼을 누르세요.`);
                }
            });

            li.querySelector('.delete-pl-btn').addEventListener('click', async () => {
                if (confirm(`'${data.title}' 플레이리스트를 삭제하시겠습니까?`)) {
                    try {
                        await deleteDoc(doc(db, 'Playlists', d.id));
                        li.remove();
                    } catch (err) {
                        console.error('Delete PL error:', err);
                        alert('삭제 중 오류가 발생했습니다.');
                    }
                }
            });

            li.addEventListener('mouseover', () => li.style.background = '#252538');
            li.addEventListener('mouseout',  () => li.style.background = '');
            playlistsUl.appendChild(li);
        });
    } catch (e) {
        console.error('Error fetching playlists:', e);
    }
}

function loadSelectedPlaylist(eventIds, title) {
    if (!allEvents || allEvents.length === 0) {
        alert('이벤트 데이터가 아직 로드되지 않았습니다.');
        return;
    }
    const selectedEvents = allEvents.filter(ev => (eventIds || []).includes(ev.id));
    if (selectedEvents.length === 0) {
        alert('플레이리스트 내에 유효한 클립이 없습니다.');
        return;
    }
    const searchInput = document.getElementById('event-search');
    if (searchInput) searchInput.value = '';
    alert(`'${title}' 플레이리스트 (${selectedEvents.length}개)를 불러왔습니다.`);
    updateCurrentPlaylist(selectedEvents);
}

async function startBatchCapture() {
    const selectedEvents = allEvents.filter(ev => playlistCart.has(ev.id)).sort((a, b) => a.start_time - b.start_time);
    if (selectedEvents.length === 0) return;
    const preRoll  = parseFloat(prompt('분석 지점 [몇 초 전]부터 영상을 재생할까요?', '2.0')) || 2.0;
    const postRoll = parseFloat(prompt('클립 종료 후 [보너스 재생]을 몇 초 할까요?', '1.0')) || 1.0;
    const ytPlayer = window._activeSportsplayPlayer;
    if (!ytPlayer || typeof ytPlayer.seekTo !== 'function') {
        return alert('재생 중인 유튜브 영상이 없습니다.');
    }
    alert('시퀀스 추출을 시작합니다.\n다음 팝업에서 [이 탭]을 선택하고 공유를 허용해주세요.');
    let screenStream = null, screenVideo = null;
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ preferCurrentTab: true, video: { displaySurface: 'browser' } });
        screenVideo  = document.createElement('video');
        screenVideo.srcObject = screenStream; screenVideo.muted = true; screenVideo.play();
        await new Promise(r => screenVideo.onloadedmetadata = r);
    } catch (e) { return alert('화면 공유 권한이 거부되었습니다.'); }

    const canvas    = window._fabricCanvas;
    const recCanvas = document.createElement('canvas');
    recCanvas.width  = canvas ? canvas.width  : 1280;
    recCanvas.height = canvas ? canvas.height : 720;
    const ctx    = recCanvas.getContext('2d');
    const stream = recCanvas.captureStream(60);
    const opts   = MediaRecorder.isTypeSupported('video/mp4')
        ? { mimeType: 'video/mp4', videoBitsPerSecond: 12000000 }
        : { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 12000000 };
    const recorder = new MediaRecorder(stream, opts);
    const chunks   = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: opts.mimeType });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `SportsPlay_Batch_${Date.now()}.${opts.mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
        a.click();
        screenStream?.getTracks().forEach(t => t.stop());
        alert('영상 추출이 완료되었습니다.');
    };
    const videoContainer = document.getElementById('video-container');
    let looping = true;
    function renderComposite() {
        if (!looping) return;
        if (videoContainer) {
            const rect = videoContainer.getBoundingClientRect();
            const sx = screenVideo.videoWidth / window.innerWidth;
            const sy = screenVideo.videoHeight / window.innerHeight;
            ctx.drawImage(screenVideo, rect.left * sx, rect.top * sy, rect.width * sx, rect.height * sy, 0, 0, recCanvas.width, recCanvas.height);
        }
        if (canvas) ctx.drawImage(canvas.getElement(), 0, 0, recCanvas.width, recCanvas.height);
        requestAnimationFrame(renderComposite);
    }
    recorder.start(); renderComposite();
    for (const ev of selectedEvents) {
        const targetTime = Math.max(0, ev.start_time - preRoll);
        ytPlayer.seekTo(targetTime, true); ytPlayer.playVideo();
        await new Promise(res => setTimeout(res, (ev.duration + preRoll + postRoll) * 1000));
        ytPlayer.pauseVideo();
    }
    looping = false; recorder.stop();
}
