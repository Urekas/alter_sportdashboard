import { pausePlayer } from './player.js';

export function initDrawingBoard() {
  const canvasElement = document.getElementById('drawing-canvas');
  const container = document.getElementById('video-container');
  if (!canvasElement || !container) return;
  
  const canvas = new fabric.Canvas('drawing-canvas', {
    isDrawingMode: false,
    width: container.clientWidth,
    height: container.clientHeight
  });
  window._fabricCanvas = canvas;
  
  window.addEventListener('resize', () => {
    canvas.setWidth(container.clientWidth);
    canvas.setHeight(container.clientHeight);
    canvas.renderAll();
  });

  const viewModeBtn = document.getElementById('view-mode-btn');
  const drawModeBtn = document.getElementById('draw-mode-btn');
  const drawToolsContainer = document.querySelector('.draw-tools');
  
  const tools = {
    select: document.getElementById('tool-select'),
    freedraw: document.getElementById('tool-freedraw'),
    text: document.getElementById('tool-text'),
    playertag: document.getElementById('tool-playertag'),
    highlight: document.getElementById('tool-highlight'),
    arrow: document.getElementById('tool-arrow'),
    curve: document.getElementById('tool-curve'),
    polyline: document.getElementById('tool-polyline'),
    polygon: document.getElementById('tool-polygon')
  };
  
  const colorPicker = document.getElementById('tool-color');
  const btnDelete = document.getElementById('tool-delete');
  const btnUndo = document.getElementById('tool-undo');
  const btnClear = document.getElementById('tool-clear');
  const btnCapture = document.getElementById('tool-capture');
  const btnRecord = document.getElementById('tool-record');
  const btnSave = document.getElementById('tool-save');

  let currentMode = 'view';
  let currentTool = 'freedraw';
  let brushColor = colorPicker ? colorPicker.value : '#ff2a2a';
  
  canvas.freeDrawingBrush.color = brushColor;
  canvas.freeDrawingBrush.width = 4;

  viewModeBtn.addEventListener('click', () => {
    currentMode = 'view';
    canvas.isDrawingMode = false;
    document.querySelector('.canvas-container')?.classList.remove('draw-mode');
    drawToolsContainer.classList.remove('active');
    viewModeBtn.classList.add('highlight');
    drawModeBtn.classList.remove('highlight');
    setSelectable(false);
  });

  drawModeBtn.addEventListener('click', () => {
    pausePlayer();
    currentMode = 'draw';
    document.querySelector('.canvas-container')?.classList.add('draw-mode');
    drawToolsContainer.classList.add('active');
    drawModeBtn.classList.add('highlight');
    viewModeBtn.classList.remove('highlight');
    setTool(currentTool);
  });

  function setSelectable(isSel) {
    canvas.getObjects().forEach(o => o.set('selectable', isSel));
    canvas.renderAll();
  }

  function setTool(toolName) {
    currentTool = toolName;
    Object.values(tools).forEach(btn => btn?.classList.remove('highlight'));
    if (tools[toolName]) tools[toolName].classList.add('highlight');
    
    canvas.isDrawingMode = false;
    canvas.selection = false;
    canvas.defaultCursor = 'crosshair';
    
    if (toolName === 'freedraw') {
      canvas.isDrawingMode = true;
      setSelectable(false);
    } else if (toolName === 'select') {
      canvas.selection = true;
      canvas.defaultCursor = 'default';
      setSelectable(true);
    } else {
      setSelectable(false);
    }
  }

  Object.keys(tools).forEach(key => {
    if(tools[key]) tools[key].addEventListener('click', () => setTool(key));
  });

  if (colorPicker) {
    colorPicker.addEventListener('input', (e) => {
      brushColor = e.target.value;
      canvas.freeDrawingBrush.color = brushColor;
      const actObj = canvas.getActiveObject();
      if(actObj) {
          if(actObj.type === 'path' || actObj.type === 'line' || actObj.type === 'polyline') actObj.set({ stroke: brushColor });
          else if (actObj.type === 'i-text') actObj.set({ fill: brushColor });
          else actObj.set({ fill: brushColor, stroke: brushColor });
          canvas.renderAll();
      }
    });
  }

  function deleteSelected() {
    const actObj = canvas.getActiveObject();
    if (actObj && !actObj.isEditing) {
        canvas.remove(actObj);
        canvas.discardActiveObject();
    } else if (canvas.getActiveObjects().length) {
        canvas.getActiveObjects().forEach(o => canvas.remove(o));
        canvas.discardActiveObject();
    }
  }

  if (btnDelete) btnDelete.addEventListener('click', deleteSelected);
  
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        const actObj = canvas.getActiveObject();
        if (actObj && !actObj.isEditing) {
            deleteSelected();
            e.preventDefault();
        }
      }
    }
  });

  if (btnUndo) {
    btnUndo.addEventListener('click', () => {
      const objects = canvas.getObjects();
      if (objects.length > 0) canvas.remove(objects[objects.length - 1]);
    });
  }
  if (btnClear) btnClear.addEventListener('click', () => canvas.clear());

  let isDrawing = false;
  let activeShape = null;
  let activeHead = null;
  let activePoints = [];
  
  function getStrokeParams() {
      return { stroke: brushColor, strokeWidth: 4, fill: 'transparent', selectable: false, evented: false };
  }
  function getFillParams() {
      const hex = brushColor.replace('#', '');
      const r = parseInt(hex.substring(0,2), 16) || 255;
      const g = parseInt(hex.substring(2,4), 16) || 0;
      const b = parseInt(hex.substring(4,6), 16) || 0;
      return { fill: `rgba(${r},${g},${b},0.4)`, stroke: brushColor, strokeWidth: 3, selectable: false, evented: false };
  }

  canvas.on('mouse:down', function(o) {
    if (currentMode !== 'draw' || currentTool === 'freedraw' || currentTool === 'select') return;
    const pointer = canvas.getPointer(o.e);

    if (currentTool === 'text') {
      const text = new fabric.IText('텍스트 입력', {
        left: pointer.x, top: pointer.y, fill: brushColor, fontSize: 24, fontFamily: 'sans-serif',
        selectable: true
      });
      canvas.add(text);
      canvas.setActiveObject(text);
      text.enterEditing();
      text.selectAll();
      setTool('select'); 
      return;
    }

    if (currentTool === 'playertag') {
      const arrowDown = new fabric.Triangle({ width: 14, height: 10, fill: brushColor, left: 0, top: 15, originX: 'center', originY: 'center', angle: 180 });
      const rect = new fabric.Rect({ width: 80, height: 26, fill: brushColor, left: 0, top: 0, originX: 'center', originY: 'center', rx: 4, ry: 4 });
      const text = new fabric.Text('NR PLAYER', { fontSize: 12, fill: '#fff', left: 0, top: 0, originX: 'center', originY: 'center', fontWeight: 'bold' });
      const group = new fabric.Group([arrowDown, rect, text], { left: pointer.x, top: pointer.y - 15, originX: 'center', originY: 'center', selectable: true });
      canvas.add(group);
      setTool('select');
      return;
    }

    isDrawing = true;
    
    if (currentTool === 'arrow') {
      const points = [pointer.x, pointer.y, pointer.x, pointer.y];
      activeShape = new fabric.Line(points, { ...getStrokeParams(), strokeDashArray: [10, 5], originX: 'center', originY: 'center' });
      activeHead = new fabric.Triangle({ width: 15, height: 15, fill: brushColor, left: pointer.x, top: pointer.y, originX: 'center', originY: 'center', angle: 90, selectable: false, evented: false });
      canvas.add(activeShape, activeHead);
    } 
    else if (currentTool === 'curve') {
      const pathData = `M ${pointer.x} ${pointer.y} Q ${pointer.x} ${pointer.y} ${pointer.x} ${pointer.y}`;
      activeShape = new fabric.Path(pathData, { ...getStrokeParams(), fill: '' });
      activeHead = new fabric.Triangle({ width: 15, height: 15, fill: brushColor, left: pointer.x, top: pointer.y, originX: 'center', originY: 'center', angle: 90, selectable: false, evented: false });
      canvas.add(activeShape, activeHead);
    }
    else if (currentTool === 'highlight') {
      activeShape = new fabric.Circle({ ...getFillParams(), left: pointer.x, top: pointer.y, radius: 1, originX: 'center', originY: 'center' });
      canvas.add(activeShape);
    }
    else if (currentTool === 'polyline' || currentTool === 'polygon') {
      activePoints.push({ x: pointer.x, y: pointer.y });
      if (activePoints.length === 1) {
         activePoints.push({ x: pointer.x, y: pointer.y }); 
         activeShape = new fabric.Polyline(activePoints, { ...getStrokeParams() });
         if (currentTool === 'polygon') {
             activeShape = new fabric.Polygon(activePoints, { ...getFillParams() });
         }
         activeShape.set({ objectCaching: false });
         canvas.add(activeShape);
      }
    }
  });

  canvas.on('mouse:dblclick', (o) => {
     if (isDrawing && (currentTool === 'polyline' || currentTool === 'polygon')) {
        isDrawing = false;
        activePoints.pop(); 
        activeShape.set({ points: activePoints });
        
        const finalObj = currentTool === 'polygon' 
          ? new fabric.Polygon(activePoints, { ...getFillParams(), selectable: true })
          : new fabric.Polyline(activePoints, { ...getStrokeParams(), fill: 'transparent', selectable: true });
          
        canvas.remove(activeShape);
        canvas.add(finalObj);
        activePoints = [];
        activeShape = null;
        setTool('select');
     }
  });

  canvas.on('mouse:move', function(o) {
    if (!isDrawing) return;
    const pointer = canvas.getPointer(o.e);

    if (currentTool === 'arrow') {
      activeShape.set({ x2: pointer.x, y2: pointer.y });
      activeHead.set({ left: pointer.x, top: pointer.y });
      const dx = pointer.x - activeShape.x1;
      const dy = pointer.y - activeShape.y1;
      activeHead.set({ angle: Math.atan2(dy, dx) * 180 / Math.PI + 90 });
    }
    else if (currentTool === 'curve') {
      const rawPath = activeShape.path;
      const startX = rawPath[0][1];
      const startY = rawPath[0][2];
      const endX = pointer.x;
      const endY = pointer.y;
      
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;
      const dx = endX - startX;
      const dy = endY - startY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      const nx = -dy / dist;
      const ny = dx / dist;
      const curveHeight = Math.min(dist * 0.3, 100);
      const cpX = midX + nx * curveHeight;
      const cpY = midY + ny * curveHeight;
      
      const newPath = `M ${startX} ${startY} Q ${cpX} ${cpY} ${endX} ${endY}`;
      activeShape.initialize(newPath, { ...getStrokeParams(), fill: '' });
      activeHead.set({ left: endX, top: endY });
      activeHead.set({ angle: Math.atan2(endY - cpY, endX - cpX) * 180 / Math.PI + 90 });
    }
    else if (currentTool === 'highlight') {
      const dx = pointer.x - activeShape.left;
      const dy = pointer.y - activeShape.top;
      activeShape.set({ radius: Math.sqrt(dx*dx + dy*dy) });
    }
    else if (currentTool === 'polyline' || currentTool === 'polygon') {
      activePoints[activePoints.length - 1] = { x: pointer.x, y: pointer.y };
      activeShape.set({ points: activePoints });
      activeShape.setCoords();
    }
    canvas.renderAll();
  });

  canvas.on('mouse:up', function(o) {
    if (currentTool !== 'polyline' && currentTool !== 'polygon') {
        if (isDrawing) {
            if ((currentTool === 'arrow' || currentTool === 'curve') && activeShape && activeHead) {
                const grp = new fabric.Group([activeShape, activeHead], { selectable: true });
                canvas.remove(activeShape, activeHead);
                canvas.add(grp);
            } else if (activeShape) {
                activeShape.set({ selectable: true, evented: true });
            }
        }
        isDrawing = false;
        activeShape = null;
        activeHead = null;
    }
  });

  if (btnCapture) {
    btnCapture.addEventListener('click', () => {
      alert("현재 캔버스 오버레이 그림만 직접 캡처됩니다.");
      const link = document.createElement('a');
      link.download = `Tactical_Board_${new Date().getTime()}.png`;
      link.href = canvas.toDataURL({ format: 'png', quality: 1 });
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }
  
  // --- Step 8: Drawing Save to DB ---
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      // Lazy load player.js to avoid cyclic dependency
      const { getActiveEventId, updateEventDrawingLocal } = await import('./player.js');
      const eventId = getActiveEventId();
      if (!eventId) return alert("선택된 이벤트가 없습니다. 이벤트를 재생한 뒤 그려주세요.");
      
      const jsonStr = JSON.stringify(canvas.toJSON());
      const { db, doc, updateDoc } = await import('./firebase-config.js');
      
      try {
          btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 저장 중...';
          const eventRef = doc(db, "Events", eventId);
          await updateDoc(eventRef, { tactical_drawing: jsonStr });
          
          updateEventDrawingLocal(eventId, jsonStr);
          
          btnSave.innerHTML = '<i class="fa-solid fa-check"></i> 저장 완료';
          setTimeout(() => { btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> 저장'; }, 2000);
      } catch(e) {
         console.error(e);
         alert("Firestore 저장 실패!");
      }
    });
  }

  // --- Display Media Recording ---
  let mediaRecorder;
  let recordedChunks = [];
  
  if (btnRecord) {
    btnRecord.addEventListener('click', async () => {
       if (mediaRecorder && mediaRecorder.state === 'recording') {
           mediaRecorder.stop();
           btnRecord.innerHTML = '<i class="fa-solid fa-video"></i> 영상 추출';
           btnRecord.style.backgroundColor = '';
           return;
       }
       
       try {
           const stream = await navigator.mediaDevices.getDisplayMedia({
               video: { displaySurface: "browser" },
               audio: true
           });
           
           recordedChunks = [];
           // VP9 is well supported for screen capture
           mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
           
           mediaRecorder.ondataavailable = function(e) {
               if (e.data.size > 0) recordedChunks.push(e.data);
           };
           
           mediaRecorder.onstop = function() {
               const blob = new Blob(recordedChunks, { type: 'video/webm' });
               const url = URL.createObjectURL(blob);
               const a = document.createElement('a');
               a.href = url;
               a.download = `Tactical_Extraction_${new Date().getTime()}.webm`;
               document.body.appendChild(a);
               a.click();
               URL.revokeObjectURL(url);
               
               stream.getTracks().forEach(t => t.stop());
           };
           
           mediaRecorder.start();
           btnRecord.innerHTML = '<i class="fa-solid fa-stop"></i> 녹화 중지';
           btnRecord.style.backgroundColor = '#991111';
           
       } catch (err) {
           console.error("Recording failed: ", err);
           alert("녹화 시작 중 오류가 발생했습니다. (화면 공유를 취소했거나 브라우저 지원 문제)");
       }
    });
  }
}
