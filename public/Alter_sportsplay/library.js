import { db, collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from './firebase-config.js';
import { allEvents, updateCurrentPlaylist, playlistCart, updateCartUI } from './player.js';

// State (모듈 레벨 - DOM 접근 없음)
let matchesData = {};
let currentEditingPlaylistId = null; // 현재 편집 중인 플레이리스트 ID

export async function initLibrary() {
    // 모든 DOM 접근을 함수 내부에서 수행 (null-safe)
    const filterCompetition    = document.getElementById('filter-competition');
    const filterTeam           = document.getElementById('filter-team');
    const filterCodeContainer  = document.getElementById('filter-code-container');
    const btnCreatePlaylist    = document.getElementById('btn-create-playlist');
    const cartCountSpan        = document.getElementById('cart-count');
    const libraryResultsUl     = document.getElementById('library-results-ul');
    const playlistsUl          = document.getElementById('playlists-ul');
    const playlistModal        = document.getElementById('playlist-modal');
    const playlistTitle        = document.getElementById('playlist-title');
    const modalBtnCancel       = document.getElementById('modal-btn-cancel');
    const modalBtnConfirm      = document.getElementById('modal-btn-confirm');
    const modalCartCount       = document.getElementById('modal-cart-count');
    const btnSelectAll         = document.getElementById('btn-select-all');
    const btnDeselectAll       = document.getElementById('btn-deselect-all');
    const btnBatchCapture      = document.getElementById('btn-batch-capture');

    if (!libraryResultsUl) {
        console.warn('initLibrary: #library-results-ul not found, skipping.');
        return;
    }

    // ── 경기 데이터 로드 ──
    await fetchMatches(filterCompetition);

    // ── 플레이리스트 모달 ──
    const playlistSelectExisting = document.getElementById('playlist-select-existing');
    const plSaveModes = document.querySelectorAll('input[name="pl-save-mode"]');
    
    const openPlaylistModal = async () => {
        playlistModal?.classList.add('active');
        if(playlistTitle) playlistTitle.value = '';
        if(playlistSelectExisting) {
            playlistSelectExisting.innerHTML = '<option value="">플레이리스트 선택...</option>';
            const querySnapshot = await getDocs(collection(db, 'Playlists'));
            querySnapshot.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.id; opt.textContent = d.data().title;
                if(currentEditingPlaylistId === d.id) opt.selected = true;
                playlistSelectExisting.appendChild(opt);
            });
        }
        // 초기 포커스 및 모드 설정
        if(currentEditingPlaylistId) {
            document.querySelector('input[name="pl-save-mode"][value="update"]').checked = true;
            if(playlistSelectExisting) playlistSelectExisting.disabled = false;
            if(playlistTitle) playlistTitle.disabled = true;
        } else {
            document.querySelector('input[name="pl-save-mode"][value="new"]').checked = true;
            if(playlistSelectExisting) playlistSelectExisting.disabled = true;
            if(playlistTitle) playlistTitle.disabled = false;
        }
    };

    plSaveModes.forEach(radio => radio.addEventListener('change', (e) => {
        if(e.target.value === 'new') {
            if(playlistSelectExisting) playlistSelectExisting.disabled = true;
            if(playlistTitle) { playlistTitle.disabled = false; playlistTitle.focus(); }
        } else {
            if(playlistSelectExisting) { playlistSelectExisting.disabled = false; playlistSelectExisting.focus(); }
            if(playlistTitle) playlistTitle.disabled = true;
        }
    }));

    btnCreatePlaylist?.addEventListener('click', openPlaylistModal);
    document.getElementById('btn-create-playlist-right')?.addEventListener('click', openPlaylistModal);
    
    modalBtnCancel?.addEventListener('click', () => {
        playlistModal?.classList.remove('active');
        currentEditingPlaylistId = null;
    });

    modalBtnConfirm?.addEventListener('click', async () => {
        const mode = document.querySelector('input[name="pl-save-mode"]:checked')?.value;
        const eventIds = Array.from(playlistCart);
        
        modalBtnConfirm.disabled = true;
        modalBtnConfirm.textContent = '저장 중...';
        
        try {
            if(mode === 'new') {
                const title = playlistTitle?.value.trim();
                if(!title) { alert('플레이리스트 제목을 입력해주세요.'); return; }
                await addDoc(collection(db, 'Playlists'), {
                    title, event_ids: eventIds, created_at: new Date().toISOString()
                });
                alert('새 플레이리스트가 생성되었습니다!');
            } else {
                const targetId = playlistSelectExisting?.value;
                if(!targetId) { alert('업데이트할 플레이리스트를 선택해주세요.'); return; }
                const targetTitle = playlistSelectExisting.options[playlistSelectExisting.selectedIndex].text;
                // 기존 데이터 가져오기 (병합 여부 확인)
                if(confirm(`'${targetTitle}' 플레이리스트를 현재 선택된 내용으로 덮어씌울까요?`)) {
                    await updateDoc(doc(db, 'Playlists', targetId), {
                        event_ids: eventIds, updated_at: new Date().toISOString()
                    });
                    alert('업데이트 완료!');
                } else {
                    return; // 취소 시 중단
                }
            }
            playlistCart.clear();
            currentEditingPlaylistId = null;
            updateCartUI();
            applyLibraryFilters(filterCompetition, filterTeam, libraryResultsUl);
            playlistModal?.classList.remove('active');
            fetchAndRenderPlaylists(playlistsUl);
        } catch(e) {
            console.error('Error saving playlist:', e);
            alert('오류가 발생했습니다.');
        } finally {
            if(modalBtnConfirm) { modalBtnConfirm.disabled=false; modalBtnConfirm.textContent='저장 및 반영'; }
        }
    });


    // ── 선택 컨트롤 ──
    const selectAllClips = () => {
        document.querySelectorAll('.clip-checkbox, .event-checkbox').forEach(cb => {
            if(!cb.checked){ cb.checked=true; playlistCart.add(cb.value); cb.closest('.clip-item')?.classList.add('selected'); }
        });
        updateCartUI();
    };
    const deselectAllClips = () => {
        document.querySelectorAll('.clip-checkbox, .event-checkbox').forEach(cb => {
            if(cb.checked){ cb.checked=false; playlistCart.delete(cb.value); cb.closest('.clip-item')?.classList.remove('selected'); }
        });
        updateCartUI();
    };
    const triggerBatchCapture = () => {
        if(playlistCart.size === 0) { alert('선택된 항목이 없습니다.'); return; }
        if(confirm(`${playlistCart.size}개의 클립을 시퀀스로 추출하시겠습니까?`)) {
            startBatchCapture();
        }
    };

    btnSelectAll?.addEventListener('click', selectAllClips);
    btnDeselectAll?.addEventListener('click', deselectAllClips);
    btnBatchCapture?.addEventListener('click', triggerBatchCapture);
    document.getElementById('btn-batch-capture-right')?.addEventListener('click', triggerBatchCapture);

    // ── 필터 변경 이벤트 ──
    filterCompetition?.addEventListener('change', () => applyLibraryFilters(filterCompetition, filterTeam, libraryResultsUl, cartCountSpan, modalCartCount, btnCreatePlaylist, btnBatchCapture));
    filterTeam?.addEventListener('change', () => applyLibraryFilters(filterCompetition, filterTeam, libraryResultsUl, cartCountSpan, modalCartCount, btnCreatePlaylist, btnBatchCapture));

    // ── allEvents 로드 대기 (폴링, 최대 5초) ──
    let waited = 0;
    const waitForEvents = setInterval(() => {
        waited += 500;
        if (allEvents && allEvents.length > 0) {
            clearInterval(waitForEvents);
            populateFilters(filterTeam, filterCodeContainer, filterCompetition, filterTeam, libraryResultsUl, cartCountSpan, modalCartCount, btnCreatePlaylist, btnBatchCapture);
            applyLibraryFilters(filterCompetition, filterTeam, libraryResultsUl, cartCountSpan, modalCartCount, btnCreatePlaylist, btnBatchCapture);
            fetchAndRenderPlaylists(playlistsUl);
        } else if (waited >= 5000) {
            clearInterval(waitForEvents);
            if(libraryResultsUl) libraryResultsUl.innerHTML = '<li style="color:var(--text-muted);font-size:0.9em;padding:10px;">등록된 이벤트가 없습니다.<br><small>Admin 탭에서 경기를 먼저 등록하세요.</small></li>';
            if(filterCodeContainer) filterCodeContainer.innerHTML = '<label style="color:#888;font-size:0.8em;">데이터 없음</label>';
            fetchAndRenderPlaylists(playlistsUl);
        }
    }, 500);
}

async function fetchMatches(filterCompetition) {
    try {
        const querySnapshot = await getDocs(collection(db, 'Matches'));
        querySnapshot.forEach((d) => {
            const data = d.data();
            data.id = d.id;
            matchesData[d.id] = data;
            const option = document.createElement('option');
            option.value = d.id;
            option.textContent = data.match_name + ` (${data.match_date ? data.match_date.split('T')[0] : ''})`;
            filterCompetition?.appendChild(option);
        });
    } catch(e) { console.error('Error fetching Matches:', e); }
}

function populateFilters(filterTeam, filterCodeContainer, filterCompetition, ft, libraryResultsUl, cartCountSpan, modalCartCount, btnCreatePlaylist, btnBatchCapture) {
    const teams = new Set();
    const codes = new Set();
    allEvents.forEach(ev => {
        if(ev.team && ev.team !== 'Unknown') teams.add(ev.team);
        if(ev.code) codes.add(ev.code);
    });

    teams.forEach(team => {
        const opt = document.createElement('option');
        opt.value = team; opt.textContent = team;
        filterTeam?.appendChild(opt);
    });

    if(filterCodeContainer) {
        filterCodeContainer.innerHTML = '';
        if(codes.size === 0) {
            filterCodeContainer.innerHTML = '<label style="color:#888;font-size:0.8em;">이벤트 없음</label>';
        }
        codes.forEach(code => {
            const label = document.createElement('label');
            label.className = 'filter-code-label';
            label.innerHTML = `<input type="checkbox" value="${code}" class="filter-code-cb"> ${code}`;
            filterCodeContainer.appendChild(label);
        });
        document.querySelectorAll('.filter-code-cb').forEach(cb =>
            cb.addEventListener('change', () => applyLibraryFilters(filterCompetition, ft, libraryResultsUl, cartCountSpan, modalCartCount, btnCreatePlaylist, btnBatchCapture))
        );
    }
}

function applyLibraryFilters(filterCompetition, filterTeam, libraryResultsUl, cartCountSpan, modalCartCount, btnCreatePlaylist, btnBatchCapture) {
    const selectedMatch = filterCompetition?.value || '';
    const selectedTeam  = filterTeam?.value || '';
    const selectedCodes = Array.from(document.querySelectorAll('.filter-code-cb:checked')).map(cb => cb.value);

    const filtered = allEvents.filter(ev => {
        if (selectedMatch && ev.match_id !== selectedMatch) return false;
        if (selectedTeam  && ev.team !== selectedTeam) return false;
        if (selectedCodes.length > 0 && !selectedCodes.includes(ev.code)) return false;
        return true;
    });

    renderLibraryResults(filtered, libraryResultsUl, cartCountSpan, modalCartCount, btnCreatePlaylist, btnBatchCapture);
}

function renderLibraryResults(filteredEvents, libraryResultsUl, cartCountSpan, modalCartCount, btnCreatePlaylist, btnBatchCapture) {
    if(!libraryResultsUl) return;
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
            if(e.target.checked){ playlistCart.add(ev.id); li.classList.add('selected'); }
            else { playlistCart.delete(ev.id); li.classList.remove('selected'); }
            updateCartUI(cartCountSpan, modalCartCount, btnCreatePlaylist, btnBatchCapture);
        });
        if(isChecked) li.classList.add('selected');
        libraryResultsUl.appendChild(li);
    });
}

function updateCartUI(cartCountSpan, modalCartCount, btnCreatePlaylist, btnBatchCapture) {
    const count = playlistCart.size;
    if(cartCountSpan) cartCountSpan.textContent = count;
    if(modalCartCount) modalCartCount.textContent = count;
    if(btnCreatePlaylist) btnCreatePlaylist.style.display = count > 0 ? 'block' : 'none';
    if(btnBatchCapture)   btnBatchCapture.style.display   = count > 0 ? 'block' : 'none';
}

async function fetchAndRenderPlaylists(playlistsUl) {
    if(!playlistsUl) return;
    const playlistSelectExisting = document.getElementById('playlist-select-existing');
    try {
        playlistsUl.innerHTML = '<li style="color:var(--text-muted);font-size:0.9em;">불러오는 중...</li>';
        if(playlistSelectExisting) {
            playlistSelectExisting.innerHTML = '<option value="">플레이리스트 선택...</option>';
            playlistSelectExisting.disabled = true;
        }
        const querySnapshot = await getDocs(collection(db, 'Playlists'));
        playlistsUl.innerHTML = '';
        if(querySnapshot.empty) {
            playlistsUl.innerHTML = '<li style="color:var(--text-muted);font-size:0.9em;">저장된 플레이리스트가 없습니다.</li>';
            return;
        }
        querySnapshot.forEach((d) => {
            const data = d.data();
            if(playlistSelectExisting) {
                const opt = document.createElement('option');
                opt.value = d.id; opt.textContent = data.title;
                playlistSelectExisting.appendChild(opt);
                playlistSelectExisting.disabled = false;
            }
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
            
            // 전체 바디 클릭 시 플레이어에 로드
            li.addEventListener('click', (e) => {
                if(e.target.closest('button')) return;
                loadSelectedPlaylist(data.event_ids, data.title);
            });

            // 편집 버튼: 카트에 담기
            li.querySelector('.edit-pl-btn').addEventListener('click', () => {
                if(confirm(`'${data.title}' 플레이리스트의 내용을 편집하시겠습니까?\n현재 카트의 내용은 비워지고 플레이리스트 항목들이 채워집니다.`)) {
                    playlistCart.clear();
                    data.event_ids.forEach(id => playlistCart.add(id));
                    currentEditingPlaylistId = d.id;
                    const playlistTitle = document.getElementById('playlist-title');
                    if(playlistTitle) playlistTitle.value = data.title;
                    updateCartUI();
                    alert(`'${data.title}' 편집 모드가 활성화되었습니다.`);
                }
            });

            // 삭제 버튼
            li.querySelector('.delete-pl-btn').addEventListener('click', async () => {
                if(confirm(`'${data.title}' 플레이리스트를 삭제하시겠습니까?`)) {
                    try {
                        await deleteDoc(doc(db, 'Playlists', d.id));
                        li.remove();
                    } catch(err) { console.error('Delete PL error:', err); }
                }
            });

            li.addEventListener('mouseover', () => li.style.background = '#252538');
            li.addEventListener('mouseout',  () => li.style.background = '');
            playlistsUl.appendChild(li);
        });
    } catch(e) { console.error('Error fetching playlists:', e); }
}

function loadSelectedPlaylist(eventIds, title) {
    if (!allEvents || allEvents.length === 0) return;
    const selectedEvents = allEvents.filter(ev => eventIds.includes(ev.id));
    if (selectedEvents.length === 0) { alert('플레이리스트 내에 유효한 클립이 없습니다.'); return; }
    const searchInput = document.getElementById('event-search');
    if(searchInput) searchInput.value = '';
    alert(`'${title}' 플레이리스트를 불러왔습니다.`);
    updateCurrentPlaylist(selectedEvents);
}

async function startBatchCapture() {
    const selectedEvents = allEvents.filter(ev => playlistCart.has(ev.id)).sort((a,b) => a.start_time - b.start_time);
    if (selectedEvents.length === 0) return;
    const preRoll = parseFloat(prompt('분석 지점 [몇 초 전]부터 영상을 재생할까요?', '2.0')) || 2.0;
    const postRoll = parseFloat(prompt('클립 종료 후 [보너스 재생]을 몇 초 할까요?', '1.0')) || 1.0;
    const ytPlayer = window._activeSportsplayPlayer;
    if(!ytPlayer || typeof ytPlayer.seekTo !== 'function') {
        return alert('재생 중인 유튜브 영상이 없습니다.');
    }
    alert('시퀀스 추출을 시작합니다.\n다음 팝업에서 [이 탭]을 선택하고 공유를 허용해주세요.');
    let screenStream=null, screenVideo=null;
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({preferCurrentTab:true, video:{displaySurface:'browser'}});
        screenVideo = document.createElement('video');
        screenVideo.srcObject = screenStream; screenVideo.muted=true; screenVideo.play();
        await new Promise(r => screenVideo.onloadedmetadata=r);
    } catch(e) { return alert('화면 공유 권한이 거부되었습니다.'); }

    const canvas = window._fabricCanvas;
    const recCanvas = document.createElement('canvas');
    recCanvas.width = canvas ? canvas.width : 1280;
    recCanvas.height = canvas ? canvas.height : 720;
    const ctx = recCanvas.getContext('2d');
    const stream = recCanvas.captureStream(60);
    const opts = MediaRecorder.isTypeSupported('video/mp4')
        ? {mimeType:'video/mp4', videoBitsPerSecond:12000000}
        : {mimeType:'video/webm;codecs=vp9', videoBitsPerSecond:12000000};
    const recorder = new MediaRecorder(stream, opts);
    const chunks = [];
    recorder.ondataavailable = e => { if(e.data.size>0) chunks.push(e.data); };
    recorder.onstop = () => {
        const blob = new Blob(chunks, {type:opts.mimeType});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `SportsPlay_Batch_${Date.now()}.${opts.mimeType.includes('mp4')?'mp4':'webm'}`;
        a.click();
        screenStream?.getTracks().forEach(t=>t.stop());
        alert('영상 추출이 완료되었습니다.');
    };
    const videoContainer = document.getElementById('video-container');
    let looping = true;
    function renderComposite() {
        if(!looping) return;
        if(videoContainer) {
            const rect = videoContainer.getBoundingClientRect();
            const sx = screenVideo.videoWidth/window.innerWidth;
            const sy = screenVideo.videoHeight/window.innerHeight;
            ctx.drawImage(screenVideo, rect.left*sx, rect.top*sy, rect.width*sx, rect.height*sy, 0, 0, recCanvas.width, recCanvas.height);
        }
        if(canvas) ctx.drawImage(canvas.getElement(), 0, 0, recCanvas.width, recCanvas.height);
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
