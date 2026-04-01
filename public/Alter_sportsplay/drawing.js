import { pausePlayer } from './player.js';

// --- Custom Fabric Object: CurvedArrow ---
// Ported from tacticalboard/index.html
function initCurvedArrow() {
    if (fabric.CurvedArrow) return;
    
    fabric.CurvedArrow = fabric.util.createClass(fabric.Object, {
        type: 'curvedArrow',
        initialize: function (p0, p1, p2, options) {
            this.p0 = p0; this.p1 = p1; this.p2 = p2;
            options = options || {};
            this.callSuper('initialize', options);
            this.headSize = options.headSize || 30;
            this.strokeWidth = options.strokeWidth || 5;
            this.stroke = options.stroke || '#fff';
            this.strokeDashArray = options.strokeDashArray || false;
            this._updateBoundingBox();
            this.prevLeft = this.left;
            this.prevTop = this.top;
            
            this.on('moving', () => {
                const dx = this.left - this.prevLeft;
                const dy = this.top - this.prevTop;
                this.p0.x += dx; this.p0.y += dy;
                this.p1.x += dx; this.p1.y += dy;
                this.p2.x += dx; this.p2.y += dy;
                this.prevLeft = this.left;
                this.prevTop = this.top;
            });
            this.on('selected', () => {
                this.prevLeft = this.left;
                this.prevTop = this.top;
            });
        },
        _updateBoundingBox: function () {
            const minX = Math.min(this.p0.x, this.p1.x, this.p2.x);
            const maxX = Math.max(this.p0.x, this.p1.x, this.p2.x);
            const minY = Math.min(this.p0.y, this.p1.y, this.p2.y);
            const maxY = Math.max(this.p0.y, this.p1.y, this.p2.y);
            this.left = minX;
            this.top = minY;
            this.width = maxX - minX;
            this.height = maxY - minY;
        },
        _render: function (ctx) {
            ctx.save();
            ctx.beginPath();
            ctx.lineWidth = this.strokeWidth;
            ctx.strokeStyle = this.stroke;
            ctx.lineCap = 'round';
            if (this.strokeDashArray) ctx.setLineDash(this.strokeDashArray);
            
            const p0 = this.toLocalPoint(new fabric.Point(this.p0.x, this.p0.y), 'center', 'center');
            const p1 = this.toLocalPoint(new fabric.Point(this.p1.x, this.p1.y), 'center', 'center');
            const p2 = this.toLocalPoint(new fabric.Point(this.p2.x, this.p2.y), 'center', 'center');
            
            ctx.moveTo(p0.x, p0.y);
            ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
            ctx.stroke();
            ctx.setLineDash([]);
            
            let dx = p2.x - p1.x;
            let dy = p2.y - p1.y;
            if (dx === 0 && dy === 0) {
                dx = p1.x - p0.x; dy = p1.y - p0.y;
            }
            const angle = Math.atan2(dy, dx);
            ctx.translate(p2.x, p2.y);
            ctx.rotate(angle);
            ctx.beginPath();
            const s = this.headSize;
            ctx.moveTo(0, 0);
            ctx.lineTo(-s, s / 2);
            ctx.lineTo(-s, -s / 2);
            ctx.closePath();
            ctx.fillStyle = this.stroke;
            ctx.fill();
            ctx.restore();
        }
    });

    fabric.CurvedArrow.prototype.controls = {};
    const createControl = (key, color) => {
        return new fabric.Control({
            position: { x: 0, y: 0 },
            actionName: key,
            cursorStyle: 'pointer',
            actionHandler: function (eventData, transform, x, y) {
                const target = transform.target;
                target[key] = { x: x, y: y };
                target._updateBoundingBox();
                target.prevLeft = target.left;
                target.prevTop = target.top;
                return true;
            },
            positionHandler: function (dim, finalMatrix, fabricObject) {
                const point = fabricObject[key];
                return fabric.util.transformPoint(new fabric.Point(point.x, point.y), window._fabricCanvas.viewportTransform);
            },
            render: function (ctx, left, top, styleOverride, fabricObject) {
                ctx.save();
                ctx.translate(left, top);
                ctx.beginPath();
                ctx.arc(0, 0, 6, 0, 2 * Math.PI);
                ctx.fillStyle = color;
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1;
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            }
        });
    };
    fabric.CurvedArrow.prototype.controls.p0 = createControl('p0', '#ffffff');
    fabric.CurvedArrow.prototype.controls.p1 = createControl('p1', '#3498db');
    fabric.CurvedArrow.prototype.controls.p2 = createControl('p2', '#ffffff');
}

// --- Helper Functions ---
function hexToMutedRgba(h, a) {
    let r = parseInt(h.slice(1, 3), 16),
        g = parseInt(h.slice(3, 5), 16),
        b = parseInt(h.slice(5, 7), 16),
        gr = r * 0.3 + g * 0.59 + b * 0.11;
    return `rgba(${Math.round(r * 0.5 + gr * 0.5)},${Math.round(g * 0.5 + gr * 0.5)},${Math.round(b * 0.5 + gr * 0.5)},${a})`;
}

function getStrokeGradient(color) {
    return new fabric.Gradient({
        type: 'linear',
        gradientUnits: 'percentage',
        coords: { x1: 0, y1: 0, x2: 0, y2: 1 },
        colorStops: [
            { offset: 0, color: hexToMutedRgba(color, 0) },
            { offset: 0.5, color: hexToMutedRgba(color, 0.5) },
            { offset: 1, color: color }
        ]
    });
}

// --- Main Init ---
export function initDrawingBoard() {
  initCurvedArrow();
  const canvasElement = document.getElementById('drawing-canvas');
  const container = document.getElementById('video-container');
  if (!canvasElement || !container) return;
  
  const canvas = new fabric.Canvas('drawing-canvas', {
    isDrawingMode: false,
    preserveObjectStacking: true,
    width: container.clientWidth,
    height: container.clientHeight
  });
  window._fabricCanvas = canvas;
  
  const broadcastShadow = new fabric.Shadow({ color: 'rgba(0,0,0,0.8)', blur: 8, offsetX: 2, offsetY: 2 });
  fabric.Object.prototype.set({
      transparentCorners: false,
      cornerColor: '#ffffff',
      cornerStrokeColor: '#000000',
      borderColor: '#4e8cff',
      cornerSize: 10,
      padding: 5,
      cornerStyle: 'circle',
      shadow: broadcastShadow
  });

  window.addEventListener('resize', () => {
    canvas.setWidth(container.clientWidth);
    canvas.setHeight(container.clientHeight);
    canvas.renderAll();
  });

  // UI Elements
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
  const sizeSlider = document.getElementById('tool-size');
  const opacitySlider = document.getElementById('tool-opacity');
  const btnDash = document.getElementById('tool-dash');
  
  const btnDelete = document.getElementById('tool-delete');
  const btnUndo = document.getElementById('tool-undo');
  const btnClear = document.getElementById('tool-clear');
  const btnSave = document.getElementById('tool-save');
  const btnCapture = document.getElementById('tool-capture');
  const btnRecord = document.getElementById('tool-record');

  // Internal State
  let currentMode = 'view';
  let currentTool = 'freedraw';
  let currentColor = colorPicker ? colorPicker.value : '#ff2a2a';
  let currentSize = sizeSlider ? parseInt(sizeSlider.value) : 40;
  let currentOpacity = opacitySlider ? parseInt(opacitySlider.value) / 100 : 0.2;
  let isDashed = false;
  
  let isDrawing = false;
  let startPoint = null;
  let activeObj = null;
  let pointArray = [];
  let activePoints = [];
  let activeLines = [];
  let componentArray = [];

  // Initialize Brush
  canvas.freeDrawingBrush.color = currentColor;
  canvas.freeDrawingBrush.width = currentSize / 4;
  canvas.freeDrawingBrush.shadow = broadcastShadow;

  viewModeBtn.addEventListener('click', () => {
    currentMode = 'view';
    canvas.isDrawingMode = false;
    document.querySelector('.canvas-container')?.classList.remove('draw-mode');
    drawToolsContainer.classList.remove('active');
    viewModeBtn.classList.add('highlight');
    drawModeBtn.classList.remove('highlight');
    canvas.selection = false;
    canvas.forEachObject(o => { o.selectable = false; o.evented = false; });
    canvas.renderAll();
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

  function setTool(toolName) {
    currentTool = toolName;
    Object.values(tools).forEach(btn => btn?.classList.remove('highlight'));
    if (tools[toolName]) tools[toolName].classList.add('highlight');
    
    canvas.isDrawingMode = false;
    canvas.selection = (toolName === 'select');
    canvas.defaultCursor = (toolName === 'select') ? 'default' : 'crosshair';
    
    // Set objects selectable only in select mode
    const isSel = (toolName === 'select');
    canvas.forEachObject(o => { o.selectable = isSel; o.evented = isSel; });
    
    if (toolName === 'freedraw') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = currentColor;
      canvas.freeDrawingBrush.width = currentSize / 4;
    }
    resetDrawingState();
    canvas.renderAll();
  }

  function resetDrawingState() {
    isDrawing = false;
    startPoint = null;
    activeObj = null;
    pointArray = [];
    activePoints = [];
    activeLines = [];
    componentArray = [];
  }

  Object.keys(tools).forEach(key => {
    if(tools[key]) tools[key].addEventListener('click', () => setTool(key));
  });

  // --- Property Listeners ---
  if (colorPicker) {
    colorPicker.addEventListener('input', (e) => {
      currentColor = e.target.value;
      canvas.freeDrawingBrush.color = currentColor;
      const actObj = canvas.getActiveObject();
      if(actObj) {
          applyColorToObject(actObj, currentColor);
          canvas.renderAll();
      }
    });
  }

  if (sizeSlider) {
    sizeSlider.addEventListener('input', (e) => {
      currentSize = parseInt(e.target.value);
      if (canvas.isDrawingMode) canvas.freeDrawingBrush.width = currentSize / 4;
      const a = canvas.getActiveObject();
      if (a) {
          if (a.type === 'curvedArrow') a.set({ headSize: currentSize });
          else if (a.type === 'i-text') a.set({ fontSize: currentSize });
          else if (a.type === 'path') a.set({ strokeWidth: currentSize / 4 });
          else if (a.type === 'ellipse') a.set({ rx: currentSize, ry: currentSize * 0.4 });
          canvas.requestRenderAll();
      }
    });
  }

  if (opacitySlider) {
    opacitySlider.addEventListener('input', (e) => {
      currentOpacity = parseInt(e.target.value) / 100;
      const a = canvas.getActiveObject();
      if (a && (a.type === 'ellipse' || a.type === 'polygon')) {
          a.set({ fill: hexToMutedRgba(currentColor, currentOpacity) });
          canvas.requestRenderAll();
      }
    });
  }

  if (btnDash) {
      btnDash.addEventListener('click', () => {
          isDashed = !isDashed;
          btnDash.classList.toggle('highlight', isDashed);
          const a = canvas.getActiveObject();
          if (a) {
              const dash = isDashed ? [10, 5] : false;
              if (a.type === 'curvedArrow' || a.type === 'line' || a.type === 'path' || a.type === 'polygon') {
                  a.set({ strokeDashArray: dash });
              }
              canvas.requestRenderAll();
          }
      });
  }

  function applyColorToObject(obj, hex) {
      if (obj.type === 'curvedArrow' || obj.type === 'path' || obj.type === 'line') {
          obj.set({ stroke: hex });
      } else if (obj.type === 'i-text' || obj.type === 'text') {
          obj.set({ fill: hex });
      } else if (obj.type === 'ellipse' || obj.type === 'polygon') {
          obj.set({ stroke: hex, fill: hexToMutedRgba(hex, currentOpacity) });
          if(obj.type === 'ellipse') obj.set({ shadow: new fabric.Shadow({ color: hex, blur: 20 }) });
      } else if (obj.type === 'group') {
          obj.getObjects().forEach(o => applyColorToObject(o, hex));
      }
  }

  // --- Drawing Logic ---
  canvas.on('mouse:down', function(o) {
    if (currentMode !== 'draw' || currentTool === 'freedraw' || currentTool === 'select') return;
    const p = canvas.getPointer(o.e);

    if (currentTool === 'text') {
      const text = new fabric.IText('Text', {
        left: p.x, top: p.y, fill: currentColor, fontSize: currentSize, fontFamily: 'sans-serif',
        originX: 'center', originY: 'center', shadow: broadcastShadow
      });
      canvas.add(text);
      canvas.setActiveObject(text);
      text.enterEditing();
      text.selectAll();
      setTool('select'); 
      return;
    }

    if (currentTool === 'playertag') {
      const isR = (p.x > canvas.width / 2);
      const dir = isR ? -1 : 1;
      const text = new fabric.IText('PLAYER', {
          fontSize: currentSize * 0.7, fill: currentColor, fontWeight: 'bold', originX: isR ? 'right' : 'left', originY: 'bottom', left: 0, top: 4, shadow: broadcastShadow
      });
      const uw = text.width + 5;
      const pathData = [['M', -dir * 18, 28], ['L', 0, 0], ['L', dir * uw, 0]];
      const line = new fabric.Path(pathData, { fill: '', stroke: currentColor, strokeWidth: 3, shadow: broadcastShadow, selectable: false });
      const tagGroup = new fabric.Group([line, text], { left: p.x, top: p.y, originX: isR ? 'right' : 'left', originY: 'top', selectable: true, shadow: broadcastShadow });
      canvas.add(tagGroup);
      setTool('select');
      return;
    }

    if (currentTool === 'highlight') {
      const spot = new fabric.Ellipse({
          left: p.x, top: p.y, rx: currentSize, ry: currentSize * 0.4,
          fill: hexToMutedRgba(currentColor, currentOpacity),
          stroke: getStrokeGradient(currentColor), strokeWidth: 4,
          originX: 'center', originY: 'center', selectable: true,
          shadow: new fabric.Shadow({ color: currentColor, blur: 20 })
      });
      canvas.add(spot);
      setTool('select');
      return;
    }

    if (currentTool === 'polyline' || currentTool === 'polygon') {
      // Node based drawing
      const node = new fabric.Circle({ radius: 4, fill: currentColor, left: p.x, top: p.y, originX: 'center', originY: 'center', selectable: false });
      activePoints.push(node);
      pointArray.push({ x: p.x, y: p.y });
      canvas.add(node);
      
      if (pointArray.length > 1) {
          const line = new fabric.Line([pointArray[pointArray.length-2].x, pointArray[pointArray.length-2].y, p.x, p.y], {
              stroke: currentColor, strokeWidth: 2, strokeDashArray: [5, 5], selectable: false
          });
          activeLines.push(line);
          canvas.add(line);
      }
      isDrawing = true;
      return;
    }

    // Arrow / Curve
    isDrawing = true;
    startPoint = p;
    activeObj = new fabric.Line([p.x, p.y, p.x, p.y], { stroke: currentColor, strokeWidth: 2, strokeDashArray: [5, 5], opacity: 0.5, selectable: false });
    canvas.add(activeObj);
  });

  canvas.on('mouse:move', function(o) {
    if (!isDrawing) return;
    const p = canvas.getPointer(o.e);

    if (currentTool === 'arrow' || currentTool === 'curve') {
        activeObj.set({ x2: p.x, y2: p.y });
        canvas.renderAll();
    }
  });

  canvas.on('mouse:up', function(o) {
    if (!isDrawing || currentTool === 'polyline' || currentTool === 'polygon') return;
    const p = canvas.getPointer(o.e);
    canvas.remove(activeObj);
    
    if (currentTool === 'arrow') {
        createArrow(startPoint, p);
    } else if (currentTool === 'curve') {
        const mid = { x: (startPoint.x + p.x) / 2, y: (startPoint.y + p.y) / 2 };
        const cp = { x: mid.x, y: mid.y - 50 };
        const curve = new fabric.CurvedArrow(startPoint, cp, p, {
            stroke: currentColor, strokeWidth: 4, headSize: currentSize, shadow: broadcastShadow,
            strokeDashArray: isDashed ? [10, 5] : false, objectCaching: false, selectable: true
        });
        canvas.add(curve);
    }
    isDrawing = false;
    setTool('select');
  });

  canvas.on('mouse:dblclick', (e) => {
    if (isDrawing && (currentTool === 'polyline' || currentTool === 'polygon')) {
        const finalObj = (currentTool === 'polygon') 
            ? new fabric.Polygon(pointArray, { fill: hexToMutedRgba(currentColor, currentOpacity), stroke: currentColor, strokeWidth: 2, strokeDashArray: isDashed ? [10, 5] : false, selectable: true })
            : new fabric.Polyline(pointArray, { fill: 'transparent', stroke: currentColor, strokeWidth: 3, strokeDashArray: isDashed ? [10, 5] : false, selectable: true, shadow: broadcastShadow });
        
        activePoints.forEach(p => canvas.remove(p));
        activeLines.forEach(l => canvas.remove(l));
        canvas.add(finalObj);
        resetDrawingState();
        setTool('select');
    }
  });

  function createArrow(s, e) {
    const h = currentSize;
    const a = Math.atan2(e.y - s.y, e.x - s.x) * 180 / Math.PI;
    const l = Math.sqrt(Math.pow(e.x - s.x, 2) + Math.pow(e.y - s.y, 2));
    const mx = (s.x + e.x) / 2;
    const my = (s.y + e.y) / 2;
    const path = `M ${-l / 2} 0 L ${l / 2 - h + 5} 0`;
    const line = new fabric.Path(path, { stroke: currentColor, strokeWidth: 4, strokeDashArray: isDashed ? [10, 5] : false, fill: '', originX: 'center', originY: 'center' });
    const head = new fabric.Triangle({ width: h, height: h, fill: currentColor, angle: 90, left: l / 2, top: 0, originX: 'center', originY: 'center' });
    const group = new fabric.Group([line, head], { left: mx, top: my, angle: a, originX: 'center', originY: 'center', shadow: broadcastShadow, selectable: true });
    canvas.add(group);
  }

  // --- Action Buttons ---
  btnDelete.addEventListener('click', () => {
    const actObjs = canvas.getActiveObjects();
    if (actObjs.length) {
        actObjs.forEach(o => canvas.remove(o));
        canvas.discardActiveObject();
        canvas.renderAll();
    }
  });

  btnUndo.addEventListener('click', () => {
    const objs = canvas.getObjects();
    if (objs.length) canvas.remove(objs[objs.length - 1]);
  });

  btnClear.addEventListener('click', () => {
    if(confirm("모든 그림을 지우시겠습니까?")) canvas.clear();
  });

  btnCapture.addEventListener('click', () => {
      const link = document.createElement('a');
      link.download = `Capture_${Date.now()}.png`;
      link.href = canvas.toDataURL({ format: 'png', quality: 1 });
      link.click();
  });

  btnSave.addEventListener('click', async () => {
      const { getActiveEventId, updateEventDrawingLocal } = await import('./player.js');
      const eventId = getActiveEventId();
      if (!eventId) return alert("선택된 이벤트가 없습니다.");
      
      const jsonStr = JSON.stringify(canvas.toJSON());
      const { db, doc, updateDoc } = await import('./firebase-config.js');
      
      try {
          btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 저장 중...';
          await updateDoc(doc(db, "Events", eventId), { tactical_drawing: jsonStr });
          updateEventDrawingLocal(eventId, jsonStr);
          btnSave.innerHTML = '<i class="fa-solid fa-check"></i> 저장 완료';
          setTimeout(() => { btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> 저장'; }, 2000);
      } catch(e) {
          alert("저장 실패!");
      }
  });

  // Hotkeys
  window.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
       btnDelete.click();
    }
  });
}
