
const $ = id => document.getElementById(id);
const beep = $('beep');
const SKEY = 'HeatProAutoEndV1';
let locked=false;

let st = {
  heat:0, dead:0, bb:0, ds:0, sn:0,
  cfg:{twarm:4, thot:7, tcold:12, tbb:2, twin:1, tbig:5, idle:1200, autodead:false, haptic:true, miniAlpha:92, miniSide:'right'},
  spin:{t:0, s:0, started:false, lastInput: performance.now()},
  log:[]
};

function load(){
  try{ const s=JSON.parse(localStorage.getItem(SKEY)||'{}'); st={...st, ...s, cfg:{...st.cfg, ...(s.cfg||{})}} }catch{}
  applyCfgToUI(); applyMiniSide(); applyMiniAlpha();
  refresh();
}
function save(){ localStorage.setItem(SKEY, JSON.stringify(st)); }
function applyCfgToUI(){
  $('twarm').value=st.cfg.twarm; $('thot').value=st.cfg.thot; $('tcold').value=st.cfg.tcold;
  $('tbb').value=st.cfg.tbb; $('twin').value=st.cfg.twin; $('ttbig').value=st.cfg.tbig;
  $('tidle').value=st.cfg.idle; $('autoDead').checked=st.cfg.autodead; $('haptic').checked=st.cfg.haptic;
  $('miniAlpha').value=st.cfg.miniAlpha; $('miniSide').value=st.cfg.miniSide;
}

function tone(){ if(!st.cfg.haptic) return; try{ navigator.vibrate?.(40); beep.currentTime=0; beep.play().catch(()=>{});}catch{} }
function setStatus(cls,txt){ const s=$('status'); s.className='pill '+cls; s.textContent=txt; const mini=$('mini'); mini.classList.remove('s-ok','s-warm','s-hot','s-cold'); mini.classList.add(cls); }

function computeLamp(){
  if(st.ds>=st.cfg.tcold || st.dead>=st.cfg.tcold) return {cls:'s-cold', txt:'COLD'};
  let score = st.heat; // simple proxy
  if(score>=st.cfg.thot) return {cls:'s-hot', txt:'HOT'};
  if(score>=st.cfg.twarm) return {cls:'s-warm', txt:'WARM'};
  return {cls:'s-ok', txt:'OK'};
}

function refresh(){
  $('heat').textContent=st.heat; $('dead').textContent=st.dead; $('bb').textContent=st.bb; $('ds').textContent=st.ds; $('sn').textContent=st.sn;
  const L = computeLamp(); setStatus(L.cls,L.txt);
  renderQuick();
  renderLog();
  save();
}

function renderQuick(){
  const last10 = st.log.slice(-10);
  const wins = last10.filter(x=>x.win).length;
  const avgT = last10.length? (last10.reduce((a,b)=>a+b.t,0)/last10.length).toFixed(1) : '0.0';
  const freqS = last10.length? Math.round(100*last10.filter(x=>x.s>0).length/last10.length) : 0;
  $('qWin').textContent = (last10.length? Math.round(100*wins/last10.length):0)+'%';
  $('qT').textContent = avgT;
  $('qS').textContent = freqS+'%';
}

function logPush(rec){
  st.log.push(rec); if(st.log.length>400) st.log.shift();
}
function renderLog(){
  const el=$('log'); el.innerHTML='';
  st.log.slice().reverse().forEach(v=>{
    const row = document.createElement('div');
    const cls = v.win?'good':'bad';
    row.innerHTML = `<div class="${cls}">[${new Date(v.ts).toLocaleTimeString()}] ${v.win?'WIN':'LOSE'} — T:${v.t} S:${v.s} BB:${v.bb} DS:${v.ds}${v.t>=st.cfg.tbig?' • TBig':''}</div>`;
    el.appendChild(row);
  });
}

function addT(){ st.spin.t++; st.spin.started=true; st.spin.lastInput=performance.now(); tone(); }
function addS(){ st.spin.s++; st.spin.started=true; st.spin.lastInput=performance.now(); tone(); }
function undo(){
  if(st.spin.started && (st.spin.t>0 || st.spin.s>0)){
    if(st.spin.t>0){ st.spin.t--; } else if(st.spin.s>0){ st.spin.s--; }
  } else if(st.log.length){
    const last = st.log.pop();
    st.sn = Math.max(0, st.sn-1);
    if(last.win){ st.heat=Math.max(0,st.heat-1); st.bb = Math.max(0, st.bb-1); }
    else { st.dead=Math.max(0,st.dead-1); st.ds=Math.max(0,st.ds-1); }
  }
  refresh();
}

function endSpin(auto=false){
  const win = st.spin.t >= st.cfg.twin;
  st.sn++;
  if(win){
    st.heat++; st.bb++; st.ds=0; if(st.cfg.haptic) navigator.vibrate?.([80,40,80]);
  }else{
    st.dead++; st.bb=0; st.ds++; if(st.cfg.haptic) navigator.vibrate?.([200,60,60]);
  }
  logPush({ts:Date.now(), win, t:st.spin.t, s:st.spin.s, bb:st.bb, ds:st.ds, auto, tBig: st.spin.t>=st.cfg.tbig});
  st.spin = {t:0,s:0, started:false, lastInput: performance.now()};
  refresh();
}

function autoLoop(){
  const now = performance.now();
  if(st.spin.started && (now - st.spin.lastInput) > st.cfg.idle){
    endSpin(true);
  }
  if(!st.spin.started && st.cfg.autodead){
    if((now - st.spin.lastInput) > st.cfg.idle*2){
      st.sn++; st.dead++; st.bb=0; st.ds++; logPush({ts:Date.now(), win:false, t:0, s:0, bb:st.bb, ds:st.ds, auto:true});
      st.spin.lastInput = performance.now();
      refresh();
    }
  }
  requestAnimationFrame(autoLoop);
}

function applyMiniAlpha(){ $('mini').style.background = `rgba(15,23,42, ${st.cfg.miniAlpha/100})`; }
function applyMiniSide(){
  const m = $('mini');
  m.classList.remove('left'); m.classList.remove('right');
  if(st.cfg.miniSide==='left'){ m.classList.add('left'); } else { /* default right */ }
}

function openSettings(){ $('settings').classList.add('show'); }
function closeSettings(){ $('settings').classList.remove('show'); }

(function(){
  const mini = $('mini'), drag=$('miniDrag');
  let sx=0, sy=0, px=0, py=0, dragging=false;
  function down(e){
    if(locked) return;
    dragging=true; const ev=e.touches?e.touches[0]:e; sx=ev.clientX; sy=ev.clientY;
    const r=mini.getBoundingClientRect(); px=r.left; py=r.top; document.body.style.userSelect='none';
  }
  function move(e){
    if(!dragging) return;
    const ev=e.touches?e.touches[0]:e; const nx=px+(ev.clientX-sx); const ny=py+(ev.clientY-sy);
    mini.style.left = nx+'px'; mini.style.top = ny+'px'; mini.style.right='auto';
  }
  function up(){ if(!dragging) return; dragging=false; document.body.style.userSelect=''; }
  drag.addEventListener('mousedown',down); drag.addEventListener('touchstart',down,{passive:true});
  window.addEventListener('mousemove',move); window.addEventListener('touchmove',move,{passive:false});
  window.addEventListener('mouseup',up); window.addEventListener('touchend',up);
})();

addEventListener('keydown', e=>{
  if(e.repeat) return;
  if(e.code==='Digit1') addT();
  else if(e.code==='Digit2') addS();
  else if(e.code==='KeyU') undo();
  else if(e.code==='Space') endSpin(false);
});

let gpTimer=null;
function pollGamepad(){
  const gps=navigator.getGamepads?.()||[]; const gp=gps[0]; if(!gp) return;
  if(gp.buttons[0].pressed) addT();
  if(gp.buttons[2].pressed) addS();
  if(gp.buttons[3].pressed) undo();
  if(gp.buttons[1].pressed) endSpin(false);
}
function startGP(){ if(gpTimer) return; gpTimer=setInterval(pollGamepad,120); }
window.addEventListener('gamepadconnected', startGP);

const defaultProfiles = {
  Generic:{twarm:4,thot:7,tcold:12,tbb:2,twin:1,tbig:5,idle:1200,autodead:false},
  Zeus:{twarm:4,thot:8,tcold:12,tbb:2,twin:1,tbig:5,idle:1200,autodead:false},
  LuckyNeko:{twarm:4,thot:7,tcold:12,tbb:2,twin:2,tbig:4,idle:1200,autodead:false}
};
function loadProfile(name){
  const db = JSON.parse(localStorage.getItem(SKEY+'_profiles')||'{}');
  const p = db[name] || defaultProfiles[name] || defaultProfiles.Generic;
  st.cfg = {...st.cfg, ...p};
  applyCfgToUI(); refresh();
}
function saveProfile(name){
  const db = JSON.parse(localStorage.getItem(SKEY+'_profiles')||'{}');
  db[name] = {...st.cfg};
  localStorage.setItem(SKEY+'_profiles', JSON.stringify(db));
  navigator.vibrate?.(40);
}

document.addEventListener('DOMContentLoaded',()=>{
  load(); autoLoop();

  $('mbT').onclick=addT; $('mbS').onclick=addS; $('mbUndo').onclick=undo;
  $('btnUndo').onclick=undo; $('btnReset').onclick=()=>{ st={heat:0,dead:0,bb:0,ds:0,sn:0,cfg:st.cfg,spin:{t:0,s:0,started:false,lastInput:performance.now()},log:[]}; refresh(); };
  $('btnExportCSV').onclick=()=>{
    const rows=['ts,win,tumble,scatter,bb,deadstreak,auto'];
    st.log.forEach(v=>rows.push([v.ts, v.win?1:0, v.t, v.s, v.bb, v.ds, v.auto?1:0].join(',')));
    download('heatpro_autoend.csv', rows.join('\n'), 'text/csv');
  };
  $('btnExportJSON').onclick=()=> download('heatpro_autoend.json', JSON.stringify(st,null,2), 'application/json');

  $('btnSettings').onclick=openSettings; $('closeSettings').onclick=closeSettings;
  $('btnLock').onclick=()=>{ locked=!locked; document.getElementById('mini').classList.toggle('locked',locked); $('btnLock').textContent=locked?'🔒':'🔓'; };

  $('twarm').onchange=()=>{ st.cfg.twarm=+$('twarm').value||4; refresh(); };
  $('thot').onchange=()=>{ st.cfg.thot=+$('thot').value||7; refresh(); };
  $('tcold').onchange=()=>{ st.cfg.tcold=+$('tcold').value||12; refresh(); };
  $('tbb').onchange=()=>{ st.cfg.tbb=+$('tbb').value||2; refresh(); };
  $('twin').onchange=()=>{ st.cfg.twin=+$('twin').value||1; refresh(); };
  $('ttbig').onchange=()=>{ st.cfg.tbig=+$('ttbig').value||5; refresh(); };
  $('tidle').onchange=()=>{ st.cfg.idle=+$('tidle').value||1200; refresh(); };
  $('autoDead').onchange=()=>{ st.cfg.autodead=$('autoDead').checked; refresh(); };
  $('haptic').onchange=()=>{ st.cfg.haptic=$('haptic').checked; refresh(); };
  $('miniAlpha').oninput=()=>{ st.cfg.miniAlpha=+$('miniAlpha').value; applyMiniAlpha(); save(); };
  $('miniSide').onchange=()=>{ st.cfg.miniSide=$('miniSide').value; applyMiniSide(); save(); };

  $('loadProfile').onclick=()=> loadProfile($('profileSel').value);
  $('saveProfile').onclick=()=> saveProfile($('profileSel').value);
});

function download(name,content,type='text/plain'){
  const url=URL.createObjectURL(new Blob([content],{type})); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url);
}
