import { pausePlayer } from './player.js';

// ============================================================
// 유틸리티 (from tacticalboard)
// ============================================================
function hexToMutedRgba(h, a) {
    let r=parseInt(h.slice(1,3),16), g=parseInt(h.slice(3,5),16), b=parseInt(h.slice(5,7),16);
    let gr=r*0.3+g*0.59+b*0.11;
    return `rgba(${Math.round(r*0.5+gr*0.5)},${Math.round(g*0.5+gr*0.5)},${Math.round(b*0.5+gr*0.5)},${a})`;
}

function getStrokeGradient(color) {
    return new fabric.Gradient({
        type:'linear', gradientUnits:'percentage',
        coords:{x1:0,y1:0,x2:0,y2:1},
        colorStops:[
            {offset:0, color:hexToMutedRgba(color,0)},
            {offset:0.5, color:hexToMutedRgba(color,0.5)},
            {offset:1, color:color}
        ]
    });
}

function getEllipseOffset(point, tx, ty, rx, ry) {
    const dx=tx-point.left, dy=ty-point.top;
    const angle=Math.atan2(dy,dx);
    const ra=(rx*ry)/Math.sqrt(Math.pow(ry*Math.cos(angle),2)+Math.pow(rx*Math.sin(angle),2));
    return {x:point.left+Math.cos(angle)*(ra+2), y:point.top+Math.sin(angle)*(ra+2)};
}

function formatTime(sec) {
    if(isNaN(sec)||sec<0) return '0:00';
    const m=Math.floor(sec/60), s=Math.floor(sec%60);
    return `${m}:${s<10?'0'+s:s}`;
}

// ============================================================
// CurvedArrow 커스텀 객체 (tacticalboard 완전 이식)
// ============================================================
function initCurvedArrow() {
    if(fabric.CurvedArrow) return;
    fabric.CurvedArrow = fabric.util.createClass(fabric.Object, {
        type:'curvedArrow',
        initialize:function(p0,p1,p2,options){
            this.p0=p0; this.p1=p1; this.p2=p2;
            options=options||{};
            this.callSuper('initialize',options);
            this.headSize=options.headSize||30;
            this.strokeWidth=options.strokeWidth||5;
            this.stroke=options.stroke||'#fff';
            this.strokeDashArray=options.strokeDashArray||false;
            this._updateBB();
            this.prevLeft=this.left; this.prevTop=this.top;
            this.on('moving',()=>{
                const dx=this.left-this.prevLeft,dy=this.top-this.prevTop;
                this.p0.x+=dx;this.p0.y+=dy;
                this.p1.x+=dx;this.p1.y+=dy;
                this.p2.x+=dx;this.p2.y+=dy;
                this.prevLeft=this.left;this.prevTop=this.top;
            });
            this.on('selected',()=>{this.prevLeft=this.left;this.prevTop=this.top;});
        },
        _updateBB:function(){
            const xs=[this.p0.x,this.p1.x,this.p2.x], ys=[this.p0.y,this.p1.y,this.p2.y];
            this.left=Math.min(...xs); this.top=Math.min(...ys);
            this.width=Math.max(...xs)-this.left; this.height=Math.max(...ys)-this.top;
        },
        _render:function(ctx){
            ctx.save();
            ctx.beginPath(); ctx.lineWidth=this.strokeWidth; ctx.strokeStyle=this.stroke; ctx.lineCap='round';
            if(this.strokeDashArray) ctx.setLineDash(this.strokeDashArray);
            const p0=this.toLocalPoint(new fabric.Point(this.p0.x,this.p0.y),'center','center');
            const p1=this.toLocalPoint(new fabric.Point(this.p1.x,this.p1.y),'center','center');
            const p2=this.toLocalPoint(new fabric.Point(this.p2.x,this.p2.y),'center','center');
            ctx.moveTo(p0.x,p0.y); ctx.quadraticCurveTo(p1.x,p1.y,p2.x,p2.y);
            ctx.stroke(); ctx.setLineDash([]);
            let dx=p2.x-p1.x,dy=p2.y-p1.y;
            if(dx===0&&dy===0){dx=p1.x-p0.x;dy=p1.y-p0.y;}
            ctx.translate(p2.x,p2.y); ctx.rotate(Math.atan2(dy,dx));
            ctx.beginPath(); const s=this.headSize;
            ctx.moveTo(0,0); ctx.lineTo(-s,s/2); ctx.lineTo(-s,-s/2);
            ctx.closePath(); ctx.fillStyle=this.stroke; ctx.fill(); ctx.restore();
        }
    });
    fabric.CurvedArrow.prototype.controls={};
    function mkCtrl(key,col){
        return new fabric.Control({
            position:{x:0,y:0}, actionName:key, cursorStyle:'pointer',
            actionHandler:function(e,tr,x,y){
                const t=tr.target; t[key]={x,y}; t._updateBB();
                t.prevLeft=t.left; t.prevTop=t.top; return true;
            },
            positionHandler:function(d,m,obj){
                const p=obj[key];
                return fabric.util.transformPoint(new fabric.Point(p.x,p.y), window._fabricCanvas.viewportTransform);
            },
            render:function(ctx,l,t){
                ctx.save(); ctx.translate(l,t); ctx.beginPath(); ctx.arc(0,0,6,0,2*Math.PI);
                ctx.fillStyle=col; ctx.strokeStyle='#000'; ctx.lineWidth=1;
                ctx.fill(); ctx.stroke(); ctx.restore();
            }
        });
    }
    fabric.CurvedArrow.prototype.controls.p0=mkCtrl('p0','#ffffff');
    fabric.CurvedArrow.prototype.controls.p1=mkCtrl('p1','#3498db');
    fabric.CurvedArrow.prototype.controls.p2=mkCtrl('p2','#ffffff');
}

// ============================================================
// 메인 initDrawingBoard
// ============================================================
export function initDrawingBoard() {
    initCurvedArrow();

    const canvasEl = document.getElementById('drawing-canvas');
    const container = document.getElementById('video-container');
    if(!canvasEl||!container) return;

    const canvas = new fabric.Canvas('drawing-canvas', {
        isDrawingMode:false, preserveObjectStacking:true,
        width:container.clientWidth, height:container.clientHeight
    });
    window._fabricCanvas = canvas;

    const shadow = new fabric.Shadow({color:'rgba(0,0,0,0.8)',blur:8,offsetX:2,offsetY:2});
    fabric.Object.prototype.set({
        transparentCorners:false, cornerColor:'#fff', cornerStrokeColor:'#000',
        borderColor:'#e74c3c', cornerSize:10, padding:5, cornerStyle:'circle', shadow
    });

    window.addEventListener('resize',()=>{
        canvas.setWidth(container.clientWidth);
        canvas.setHeight(container.clientHeight);
        canvas.renderAll();
    });

    // ─── State ───
    let currentMode='view', currentTool='select';
    let currentColor='#ffffff', currentSize=40, currentOpacity=0.2;
    let isDashed=false, isSpotMode=false, isPalmRejection=false;
    let isDrawing=false, startPoint=null, activeObj=null;
    let pointArray=[], activePoints=[], activeLines=[], componentArray=[];
    let savedScenes=[];

    // ─── DOM ───
    const viewModeBtn = document.getElementById('view-mode-btn');
    const drawModeBtn = document.getElementById('draw-mode-btn');
    const drawToolsEl = document.querySelector('.draw-tools');
    const finishBtn    = document.getElementById('tool-finish');
    const palmBtn      = document.getElementById('tool-palm');
    const nodeBtn      = document.getElementById('tool-nodemode');
    const dashBtn      = document.getElementById('tool-dash');
    const colorPicker  = document.getElementById('tool-color');
    const sizeSlider   = document.getElementById('tool-size');
    const opacitySlider= document.getElementById('tool-opacity');
    const btnDelete    = document.getElementById('tool-delete');
    const btnUndo      = document.getElementById('tool-undo');
    const btnClear     = document.getElementById('tool-clear');
    const btnSave      = document.getElementById('tool-save');
    const btnCapture   = document.getElementById('tool-capture');
    const btnRecord    = document.getElementById('tool-record');

    const toolBtns = {
        select:document.getElementById('tool-select'),
        freedraw:document.getElementById('tool-freedraw'),
        text:document.getElementById('tool-text'),
        playertag:document.getElementById('tool-playertag'),
        highlight:document.getElementById('tool-highlight'),
        arrow:document.getElementById('tool-arrow'),
        curve:document.getElementById('tool-curve'),
        polyline:document.getElementById('tool-polyline'),
        polygon:document.getElementById('tool-polygon'),
    };

    canvas.freeDrawingBrush.color = currentColor;
    canvas.freeDrawingBrush.width = currentSize/4;
    canvas.freeDrawingBrush.shadow = shadow;

    // ─── 모드 전환 ───
    function setTool(name) {
        currentTool = name;
        Object.values(toolBtns).forEach(b=>b?.classList.remove('highlight'));
        toolBtns[name]?.classList.add('highlight');

        canvas.isDrawingMode = false;
        canvas.selection = (name==='select');
        canvas.defaultCursor = (name==='select')?'default':'crosshair';
        canvas.forEachObject(o=>{o.selectable=(name==='select');o.evented=(name==='select');});

        if(name==='freedraw'){
            canvas.isDrawingMode=true;
            canvas.freeDrawingBrush.color=currentColor;
            canvas.freeDrawingBrush.width=currentSize/4;
        }
        if(name!=='polyline'&&name!=='polygon') resetDrawing();
        else if(finishBtn) finishBtn.style.display = pointArray.length>0?'inline-flex':'none';
        canvas.renderAll();
    }

    function resetDrawing() {
        isDrawing=false; startPoint=null; activeObj=null;
        pointArray=[]; activePoints=[]; activeLines=[]; componentArray=[];
        if(finishBtn) finishBtn.style.display='none';
    }

    viewModeBtn?.addEventListener('click',()=>{
        currentMode='view'; canvas.isDrawingMode=false;
        document.querySelector('.canvas-container')?.classList.remove('draw-mode');
        drawToolsEl?.classList.remove('active');
        viewModeBtn.classList.add('highlight');
        drawModeBtn?.classList.remove('highlight');
        canvas.selection=false;
        canvas.forEachObject(o=>{o.selectable=false;o.evented=false;});
        canvas.renderAll();
    });

    drawModeBtn?.addEventListener('click',()=>{
        pausePlayer();
        currentMode='draw';
        document.querySelector('.canvas-container')?.classList.add('draw-mode');
        drawToolsEl?.classList.add('active');
        drawModeBtn.classList.add('highlight');
        viewModeBtn?.classList.remove('highlight');
        setTool(currentTool);
    });

    Object.keys(toolBtns).forEach(k=>toolBtns[k]?.addEventListener('click',()=>setTool(k)));

    // ─── 색상 ───
    document.querySelectorAll('.color-dot[data-color]').forEach(dot=>{
        dot.addEventListener('click',()=>{
            applyColor(dot.dataset.color);
            document.querySelectorAll('.color-dot').forEach(d=>d.classList.remove('selected'));
            dot.classList.add('selected');
            if(colorPicker) colorPicker.value=dot.dataset.color;
        });
    });
    // 커스텀 색상 picker (color-dot-custom)
    document.querySelectorAll('.dot-custom-input').forEach(inp=>{
        inp.addEventListener('input',e=>{
            applyColor(e.target.value);
            document.querySelectorAll('.color-dot').forEach(d=>d.classList.remove('selected'));
            e.target.closest('.color-dot')?.classList.add('selected');
        });
    });
    colorPicker?.addEventListener('input',e=>applyColor(e.target.value));

    function applyColor(hex) {
        currentColor=hex;
        canvas.freeDrawingBrush.color=hex;
        const a=canvas.getActiveObject();
        if(a){applyColorToObj(a,hex);canvas.renderAll();}
    }

    function applyColorToObj(obj,hex) {
        const t=obj.type;
        if(t==='curvedArrow'||t==='path'||t==='line') obj.set({stroke:hex});
        else if(t==='i-text'||t==='text') obj.set({fill:hex});
        else if(t==='ellipse') obj.set({stroke:getStrokeGradient(hex), fill:hexToMutedRgba(hex,currentOpacity), shadow:new fabric.Shadow({color:hex,blur:20})});
        else if(t==='polygon') obj.set({stroke:hex, fill:hexToMutedRgba(hex,currentOpacity)});
        else if(t==='group') obj.getObjects().forEach(o=>{
            if(o.type==='line') o.set({stroke:hex});
            if(o.type==='circle') o.set({fill:hex});
            if(o.type==='ellipse') o.set({stroke:getStrokeGradient(hex),fill:hexToMutedRgba(hex,currentOpacity)});
            if(o.type==='path'||(o.type==='triangle'&&o.angle===90)) o.set({stroke:hex,fill:hex});
            if(o.type==='i-text') o.set({fill:hex});
        });
    }

    // ─── 슬라이더 ───
    sizeSlider?.addEventListener('input',e=>{
        currentSize=parseInt(e.target.value);
        if(canvas.isDrawingMode) canvas.freeDrawingBrush.width=currentSize/4;
        const a=canvas.getActiveObject();
        if(!a) return;
        if(a.type==='curvedArrow') a.set({headSize:currentSize});
        else if(a.type==='i-text') a.set({fontSize:currentSize});
        else if(a.type==='path') a.set({strokeWidth:currentSize/4});
        else if(a.type==='ellipse') a.set({rx:currentSize,ry:currentSize*0.4});
        else if(a.type==='group'){
            a.getObjects().forEach(o=>{if(o.type==='ellipse')o.set({rx:currentSize,ry:currentSize*0.4});});
            if(a.getObjects().some(o=>o.type==='triangle')) a.scale(currentSize/40);
        }
        canvas.requestRenderAll();
    });

    opacitySlider?.addEventListener('input',e=>{
        currentOpacity=parseInt(e.target.value)/100;
        const a=canvas.getActiveObject();
        if(!a) return;
        if(a.type==='ellipse'||a.type==='polygon') a.set({fill:hexToMutedRgba(currentColor,currentOpacity)});
        if(a.type==='group') a.getObjects().forEach(o=>{if(o.type==='ellipse')o.set({fill:hexToMutedRgba(currentColor,currentOpacity)});});
        canvas.requestRenderAll();
    });

    // ─── 점선 ───
    dashBtn?.addEventListener('click',()=>{
        isDashed=!isDashed; dashBtn.classList.toggle('highlight',isDashed);
        const a=canvas.getActiveObject();
        if(!a) return;
        const d=isDashed?[10,5]:false;
        if(a.type==='group') a.getObjects().forEach(o=>{if(o.type==='path'||o.type==='line')o.set({strokeDashArray:d});});
        else if(['curvedArrow','line','path','polygon'].includes(a.type)) a.set({strokeDashArray:d});
        canvas.requestRenderAll();
    });

    // ─── 노드 모드 ───
    nodeBtn?.addEventListener('click',()=>{
        isSpotMode=!isSpotMode;
        nodeBtn.classList.toggle('highlight',isSpotMode);
        nodeBtn.title=isSpotMode?'노드 모드: Spot':'노드 모드: Point';
    });

    // ─── 팜 리젝션 ───
    palmBtn?.addEventListener('click',()=>{
        isPalmRejection=!isPalmRejection;
        palmBtn.classList.toggle('highlight',isPalmRejection);
        palmBtn.title=isPalmRejection?'팜 리젝션 ON':'팜 리젝션 OFF';
    });

    // ─── Player Tag ───
    function createPlayerTag(p) {
        const fs=Math.max(16,currentSize*0.7);
        const isR=(p.x>canvas.width/2), dir=isR?-1:1;
        const text=new fabric.IText('(NR) PLAYER',{
            fontSize:fs, fill:currentColor, fontWeight:'bold',
            originX:isR?'right':'left', originY:'bottom', left:0, top:4, shadow
        });
        const uw=text.width+5;
        const pathData=[['M',-dir*18,28],['L',0,0],['L',dir*uw,0]];
        const line=new fabric.Path(pathData,{
            fill:'', stroke:currentColor, strokeWidth:3,
            strokeLineCap:'round', strokeLineJoin:'round', shadow, selectable:false
        });
        const grp=new fabric.Group([line,text],{
            left:p.x, top:p.y,
            originX:isR?'right':'left', originY:'top',
            selectable:true, shadow, isPlayerTag:true, side:isR?'R':'L'
        });
        canvas.add(grp); canvas.setActiveObject(grp);
        setTool('select');
    }

    // ─── 드로잉 완료 (polyline/polygon) ───
    function completeDrawing() {
        if(pointArray.length<2){deleteObj();return;}
        if(currentTool==='polyline'){
            const items=[...componentArray];
            const grp=new fabric.Group(items,{selectable:true,shadow});
            componentArray.forEach(o=>canvas.remove(o));
            canvas.add(grp); canvas.setActiveObject(grp);
        } else if(currentTool==='polygon'){
            const poly=new fabric.Polygon(pointArray,{
                fill:hexToMutedRgba(currentColor,currentOpacity),
                stroke:currentColor, strokeWidth:2, objectCaching:false,
                strokeDashArray:isDashed?[10,5]:false
            });
            activePoints.forEach(p=>canvas.remove(p));
            activeLines.forEach(l=>canvas.remove(l));
            canvas.add(poly); canvas.setActiveObject(poly);
        }
        resetDrawing(); setTool('select');
    }
    finishBtn?.addEventListener('click',completeDrawing);

    // ─── Canvas 이벤트 ───
    canvas.on('mouse:down',function(o){
        if(isPalmRejection&&o.e&&(o.e.pointerType==='touch'||o.e.touches)) return;
        if(currentMode!=='draw'||currentTool==='freedraw'||currentTool==='select') return;
        const p=canvas.getPointer(o.e);

        if(currentTool==='text'){
            const t=new fabric.IText('Text',{
                left:p.x,top:p.y,fill:currentColor,fontSize:currentSize,
                fontFamily:'sans-serif',originX:'center',originY:'center',shadow
            });
            canvas.add(t);canvas.setActiveObject(t);t.enterEditing();t.selectAll();
            setTool('select'); return;
        }

        if(currentTool==='playertag'){createPlayerTag(p);return;}

        // ★ Highlight: tacticalboard 방식 (ellipse + gradient stroke + glow shadow)
        if(currentTool==='highlight'){
            canvas.add(new fabric.Ellipse({
                left:p.x, top:p.y,
                rx:currentSize, ry:currentSize*0.4,
                fill:hexToMutedRgba(currentColor,currentOpacity),
                stroke:getStrokeGradient(currentColor), strokeWidth:4,
                originX:'center', originY:'center',
                shadow:new fabric.Shadow({color:currentColor,blur:20})
            }));
            setTool('select'); return;
        }

        // ★ Polyline (with SpotMode support)
        if(currentTool==='polyline'){
            if(activePoints.length>0){
                const last=activePoints[activePoints.length-1];
                if(Math.hypot(p.x-last.left,p.y-last.top)<20) return;
            }
            let n;
            if(isSpotMode){
                n=new fabric.Ellipse({
                    left:p.x,top:p.y,rx:currentSize,ry:currentSize*0.4,
                    fill:hexToMutedRgba(currentColor,currentOpacity),
                    stroke:getStrokeGradient(currentColor),strokeWidth:3,
                    originX:'center',originY:'center',selectable:false,
                    shadow:new fabric.Shadow({color:currentColor,blur:15})
                });
            } else {
                n=new fabric.Circle({radius:4,fill:currentColor,left:p.x,top:p.y,originX:'center',originY:'center',selectable:false});
            }
            activePoints.push(n); pointArray.push({x:p.x,y:p.y}); componentArray.push(n); canvas.add(n);

            if(pointArray.length>1){
                const prev=activePoints[activePoints.length-2], curr=activePoints[activePoints.length-1];
                let sx=prev.left,sy=prev.top,ex=curr.left,ey=curr.top;
                if(isSpotMode){
                    const s0=getEllipseOffset(prev,ex,ey,currentSize,currentSize*0.4);
                    const e0=getEllipseOffset(curr,sx,sy,currentSize,currentSize*0.4);
                    sx=s0.x;sy=s0.y;ex=e0.x;ey=e0.y;
                }
                const ln=new fabric.Line([sx,sy,ex,ey],{
                    stroke:currentColor,strokeWidth:3,strokeLineCap:'round',
                    shadow,selectable:false,evented:false,
                    strokeDashArray:isDashed?[10,5]:false
                });
                activeLines.push(ln); componentArray.push(ln); canvas.add(ln); canvas.sendToBack(ln);
            }
            if(finishBtn) finishBtn.style.display='inline-flex';
            isDrawing=true; return;
        }

        // ★ Polygon
        if(currentTool==='polygon'){
            const c=new fabric.Circle({radius:4,fill:currentColor,left:p.x,top:p.y,originX:'center',originY:'center',selectable:false});
            activePoints.push(c); pointArray.push({x:p.x,y:p.y}); canvas.add(c);
            if(pointArray.length>1){
                const l=new fabric.Line([
                    pointArray[pointArray.length-2].x,pointArray[pointArray.length-2].y,p.x,p.y
                ],{stroke:currentColor,strokeWidth:2,strokeDashArray:[5,5],selectable:false});
                activeLines.push(l); canvas.add(l);
            }
            if(finishBtn) finishBtn.style.display='inline-flex';
            isDrawing=true; return;
        }

        // Arrow / Curve: 미리보기 라인
        if(currentTool==='arrow'||currentTool==='curve'){
            isDrawing=true; startPoint=p;
            activeObj=new fabric.Line([p.x,p.y,p.x,p.y],{stroke:currentColor,strokeWidth:2,strokeDashArray:[5,5],opacity:0.5,selectable:false});
            canvas.add(activeObj);
        }
    });

    canvas.on('mouse:move',function(o){
        if(!isDrawing) return;
        const p=canvas.getPointer(o.e);
        if(currentTool==='arrow'||currentTool==='curve'){
            activeObj?.set({x2:p.x,y2:p.y}); canvas.renderAll();
        }
    });

    canvas.on('mouse:up',function(o){
        if((currentTool==='arrow'||currentTool==='curve')&&isDrawing){
            isDrawing=false;
            const end=canvas.getPointer(o.e);
            canvas.remove(activeObj);
            if(currentTool==='arrow'){
                createArrow(startPoint,end);
            } else {
                const mid={x:(startPoint.x+end.x)/2,y:(startPoint.y+end.y)/2};
                const cp={x:mid.x,y:mid.y-50};
                const cur=new fabric.CurvedArrow(startPoint,cp,end,{
                    stroke:currentColor,strokeWidth:4,headSize:currentSize,
                    shadow,strokeDashArray:isDashed?[10,5]:false,objectCaching:false,selectable:true
                });
                canvas.add(cur); canvas.setActiveObject(cur);
            }
            setTool('select');
        }
    });

    canvas.on('mouse:dblclick',function(e){
        // Player Tag 이름 편집
        if(e.target&&e.target.isPlayerTag){
            const tObj=e.target.getObjects().find(o=>o.type==='i-text');
            const lObj=e.target.getObjects().find(o=>o.type==='path');
            const newName=prompt('선수 이름 입력:',tObj?.text||'PLAYER');
            if(newName&&tObj){
                tObj.set('text',newName);
                if(lObj){
                    const dir=(e.target.side==='R')?-1:1;
                    lObj.set('path',[['M',-dir*18,28],['L',0,0],['L',dir*(tObj.width+5),0]]);
                }
                canvas.renderAll();
            }
            return;
        }
        // 텍스트 편집
        if(e.target&&e.target.type==='i-text'){e.target.enterEditing();e.target.selectAll();return;}
        // Polyline/Polygon 더블클릭 완료
        if(!e.target&&pointArray.length>0){
            const rc=Math.min(activePoints.length,2);
            for(let i=0;i<rc;i++){const pt=activePoints.pop();if(pt)canvas.remove(pt);componentArray.pop();pointArray.pop();}
            if(activeLines.length>0){canvas.remove(activeLines.pop());componentArray.pop();}
            if(activeLines.length>0){canvas.remove(activeLines.pop());componentArray.pop();}
            completeDrawing(); return;
        }
        if(e.target&&(currentTool==='polyline'||currentTool==='polygon')) completeDrawing();
    });

    // 팜 리젝션 터치 차단
    const ccWrapper=document.querySelector('.canvas-container');
    if(ccWrapper){
        ccWrapper.addEventListener('touchstart',function(e){
            if(isPalmRejection){e.stopPropagation();e.preventDefault();}
        },{capture:true,passive:false});
    }

    // ─── Arrow ───
    function createArrow(s,e){
        const h=currentSize;
        const ang=Math.atan2(e.y-s.y,e.x-s.x)*180/Math.PI;
        const l=Math.hypot(e.x-s.x,e.y-s.y);
        const ln=new fabric.Path(`M ${-l/2} 0 L ${l/2-h+5} 0`,{
            stroke:currentColor,strokeWidth:4,strokeDashArray:isDashed?[10,5]:false,fill:'',originX:'center',originY:'center'
        });
        const hd=new fabric.Triangle({width:h,height:h,fill:currentColor,angle:90,left:l/2,top:0,originX:'center',originY:'center'});
        const grp=new fabric.Group([ln,hd],{
            left:(s.x+e.x)/2,top:(s.y+e.y)/2,angle:ang,originX:'center',originY:'center',shadow,selectable:true
        });
        canvas.add(grp);
    }

    // ─── 버튼 액션 ───
    function deleteObj(){
        if(pointArray.length>0||isDrawing){
            activePoints.forEach(p=>canvas.remove(p));
            activeLines.forEach(l=>canvas.remove(l));
            if(activeObj)canvas.remove(activeObj);
            resetDrawing(); return;
        }
        const objs=canvas.getActiveObjects();
        if(objs.length){canvas.discardActiveObject();objs.forEach(o=>canvas.remove(o));}
    }
    btnDelete?.addEventListener('click',deleteObj);

    btnUndo?.addEventListener('click',()=>{
        const objs=canvas.getObjects();
        if(objs.length) canvas.remove(objs[objs.length-1]);
    });

    btnClear?.addEventListener('click',()=>{
        if(confirm('모든 그림을 지우시겠습니까?')){
            canvas.getObjects().forEach(o=>canvas.remove(o));
            canvas.discardActiveObject(); canvas.requestRenderAll(); resetDrawing();
        }
    });

    // ─── 스냅샷 ───
    btnCapture?.addEventListener('click',()=>{
        const a=document.createElement('a');
        a.download=`Capture_${Date.now()}.png`;
        a.href=canvas.toDataURL({format:'png',quality:1}); a.click();
    });

    // ─── 장면 저장 ───
    btnSave?.addEventListener('click',()=>{
        const art=JSON.stringify(canvas.toJSON());
        let time=0;
        const pl=window._activeSportsplayPlayer;
        if(pl&&typeof pl.getCurrentTime==='function'){try{time=pl.getCurrentTime();}catch(e){}}
        const id=Date.now();
        savedScenes.push({id,art,time,label:`Scene ${savedScenes.length+1}`,isSelected:true});
        renderSceneList();
        // 장면탭 전환
        const sceneTabBtn=document.getElementById('tab-btn-scenes');
        if(sceneTabBtn) sceneTabBtn.click();
        setTimeout(()=>{
            if(confirm('장면이 저장되었습니다!\n새로운 장면 분석을 위해 현재 그림을 지울까요?')){
                canvas.getObjects().forEach(o=>canvas.remove(o));
                canvas.discardActiveObject(); canvas.requestRenderAll(); resetDrawing();
            }
        },100);
    });

    function renderSceneList(){
        const ul=document.getElementById('scene-list-ul');
        if(!ul) return;
        ul.innerHTML='';
        if(savedScenes.length===0){
            ul.innerHTML='<li style="color:var(--text-muted);font-size:0.9em;padding:10px;">저장된 장면 없음<br><small>💾 저장 버튼으로 추가하세요</small></li>';
            return;
        }
        savedScenes.forEach(sc=>{
            const li=document.createElement('li');
            li.style.cssText='padding:8px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;gap:6px;';
            li.innerHTML=`
                <input type="checkbox" class="scene-cb" ${sc.isSelected?'checked':''} style="flex-shrink:0;transform:scale(1.2);cursor:pointer;" title="영상추출 포함">
                <div style="flex:1;cursor:pointer;min-width:0;" class="sc-info">
                    <div style="font-size:0.9em;font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${sc.label}</div>
                    <div style="color:var(--accent);font-size:0.75em;font-family:monospace;"><i class="fa-regular fa-clock"></i> ${formatTime(sc.time)}</div>
                </div>
                <button class="sc-del" style="background:none;border:none;color:#888;cursor:pointer;padding:4px;font-size:1em;" title="삭제">✕</button>
            `;
            li.querySelector('.sc-info').addEventListener('click',()=>{
                canvas.loadFromJSON(sc.art,canvas.renderAll.bind(canvas));
                const pl=window._activeSportsplayPlayer;
                if(pl&&typeof pl.seekTo==='function'&&sc.time>0){try{pl.seekTo(sc.time,true);}catch(e){}}
            });
            li.querySelector('.scene-cb').addEventListener('change',e=>{sc.isSelected=e.target.checked;});
            li.querySelector('.sc-del').addEventListener('click',()=>{
                savedScenes=savedScenes.filter(s=>s.id!==sc.id); renderSceneList();
            });
            ul.appendChild(li);
        });
    }

    // ─── 영상 추출 (tacticalboard startCleanRecording 완전 이식) ───
    btnRecord?.addEventListener('click',async()=>{
        const selected=savedScenes.filter(s=>s.isSelected!==false);
        if(selected.length===0) return alert('먼저 장면을 저장하세요.\n💾 저장 버튼으로 현재 화면을 장면 목록에 추가하세요.');

        const ytPlayer=window._activeSportsplayPlayer;
        if(!ytPlayer||typeof ytPlayer.seekTo!=='function') return alert('재생 중인 유튜브 영상이 없습니다.');

        const preRollStr=prompt('1. 분석 지점 [몇 초 전]부터 영상을 재생할까요?','1.5');
        if(preRollStr===null) return;
        const holdStr=prompt('2. 그림이 그려진 [정지 화면]을 몇 초 유지할까요?','3.0');
        if(holdStr===null) return;
        const postStr=prompt('3. 그림이 사라진 후 [몇 초 더] 재생할까요?','1.0');
        if(postStr===null) return;

        const preRoll=parseFloat(preRollStr)||1.5;
        const holdTime=(parseFloat(holdStr)||3.0)*1000;
        const postRoll=parseFloat(postStr)||0;

        alert('⚠️ 화면 캡처 안내\n\n다음 팝업에서 반드시 [이 탭(현재 탭)]을 선택하고 공유를 허용해주세요.');
        let screenStream=null, screenVideo=null;
        try{
            screenStream=await navigator.mediaDevices.getDisplayMedia({preferCurrentTab:true,video:{displaySurface:'browser'}});
            screenVideo=document.createElement('video');
            screenVideo.srcObject=screenStream; screenVideo.muted=true; screenVideo.play();
            await new Promise(r=>screenVideo.onloadedmetadata=r);
        }catch(e){return alert('화면 공유 권한이 거부되어 캡처를 취소합니다.');}

        const recCanvas=document.createElement('canvas');
        recCanvas.width=canvas.width; recCanvas.height=canvas.height;
        const ctx=recCanvas.getContext('2d');
        const stream=recCanvas.captureStream(60);

        let opts={mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:15000000}, ext='webm';
        if(MediaRecorder.isTypeSupported('video/mp4')){opts={mimeType:'video/mp4',videoBitsPerSecond:15000000};ext='mp4';}
        else if(MediaRecorder.isTypeSupported('video/webm;codecs=h264')){opts={mimeType:'video/webm;codecs=h264',videoBitsPerSecond:15000000};ext='mp4';}

        const recorder=new MediaRecorder(stream,opts);
        const chunks=[];
        recorder.ondataavailable=e=>chunks.push(e.data);
        recorder.onstop=()=>{
            const blob=new Blob(chunks,{type:opts.mimeType});
            const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
            a.download=`Tactical_Analysis_${Date.now()}.${ext}`; a.click();
            screenStream?.getTracks().forEach(t=>t.stop());
        };

        const mediaContainer=document.getElementById('video-container');
        let looping=true;
        function renderComposite(){
            if(!looping) return;
            const rect=mediaContainer.getBoundingClientRect();
            const sx=screenVideo.videoWidth/window.innerWidth;
            const sy=screenVideo.videoHeight/window.innerHeight;
            ctx.drawImage(screenVideo,rect.left*sx,rect.top*sy,rect.width*sx,rect.height*sy,0,0,recCanvas.width,recCanvas.height);
            ctx.drawImage(canvas.getElement(),0,0,recCanvas.width,recCanvas.height);
            requestAnimationFrame(renderComposite);
        }

        recorder.start(); renderComposite();

        const timeline=[...selected].sort((a,b)=>a.time-b.time);
        for(const sc of timeline){
            const targetTime=Math.max(0,sc.time-preRoll);
            ytPlayer.seekTo(targetTime,true); canvas.clear(); ytPlayer.playVideo();
            await new Promise(res=>{
                const check=()=>{
                    if(ytPlayer.getCurrentTime()>=sc.time){ytPlayer.pauseVideo();res();}
                    else requestAnimationFrame(check);
                }; check();
            });
            await new Promise(res=>{
                canvas.loadFromJSON(sc.art,()=>{canvas.renderAll(); setTimeout(res,holdTime);});
            });
            canvas.clear();
            if(postRoll>0){
                ytPlayer.playVideo();
                const endT=ytPlayer.getCurrentTime()+postRoll;
                await new Promise(res=>{
                    const ck=()=>{if(ytPlayer.getCurrentTime()>=endT||ytPlayer.getCurrentTime()>=ytPlayer.getDuration()){ytPlayer.pauseVideo();res();}else requestAnimationFrame(ck);}; ck();
                });
            }
        }
        looping=false; recorder.stop();
    });

    // 단축키
    window.addEventListener('keydown',e=>{
        if(document.activeElement.tagName==='INPUT'||document.activeElement.tagName==='TEXTAREA') return;
        if(e.key==='Delete'||e.key==='Backspace') deleteObj();
        if(e.key==='Escape'){if(isDrawing)resetDrawing(); setTool('select');}
    });

    // 우측 패널 Scenes 탭 초기 렌더
    renderSceneList();
}
