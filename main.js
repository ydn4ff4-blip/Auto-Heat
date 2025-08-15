
const els = {
  heat: q('#heat'), dead: q('#dead'), bb: q('#bb'), ds: q('#deadStreak'),
  winRate: q('#winRate'), avgT: q('#avgT'), sFreq: q('#sFreq'), spinNum: q('#spinNum'),
  hist: q('#history'),
  plusT: q('#plusT'), plusS: q('#plusS'), endSpin: q('#endSpin'),
  undo: q('#undoBtn'), reset: q('#resetBtn'),
  expCSV: q('#exportCsvBtn'), expJSON: q('#exportJsonBtn'),
  badge: q('#stateBadge'),
};
function q(s){return document.querySelector(s)}

let state = {
  spins: [],     // each: {id, t, s, dead}
  cur: {t:0,s:0},
  heat:0, dead:0, deadStreak:0, bb:0, spinNum:0,
  lastWasWin:false,
};

function save(){ localStorage.setItem('heatpro_v1', JSON.stringify(state)); }
function load(){
  const raw = localStorage.getItem('heatpro_v1');
  if(!raw) return;
  try{ state = JSON.parse(raw); render(); }catch(e){ console.warn(e) }
}

function pushHistory(sp){
  const line = `[${sp.id}] ${sp.dead?'DEAD':'WIN'}  T:${sp.t}  S:${sp.s}`;
  const div = document.createElement('div');
  div.textContent = line;
  els.hist.prepend(div);
}

function render(){
  els.heat.textContent = state.heat;
  els.dead.textContent = state.dead;
  els.ds.textContent = state.deadStreak;
  els.bb.textContent = state.bb;
  els.spinNum.textContent = state.spinNum;

  if(state.spins.length===0){
    els.hist.textContent = 'Belum ada data.';
  } else {
    // keep as is (history already built as we go)
  }

  // Summary last 10
  const last = state.spins.slice(-10);
  const wins = last.filter(s=>!s.dead).length;
  const sCount = last.reduce((a,b)=>a+b.s,0);
  const tSum = last.reduce((a,b)=>a+b.t,0);
  const winRate = last.length? Math.round(100*wins/last.length):0;
  const sFreq = last.length? Math.round(100*(sCount>0? sCount/last.length:0)) : 0;
  const avgT = last.length? (tSum/last.length).toFixed(1):'0.0';

  els.winRate.textContent = `${winRate}%`;
  els.sFreq.textContent = `${sFreq}%`;
  els.avgT.textContent = `${avgT}`;
}

function endSpin(){
  const t = state.cur.t;
  const s = state.cur.s;
  const dead = (t===0 && s===0);

  if(dead){
    state.dead += 1;
    state.deadStreak += 1;
    state.lastWasWin = false;
  } else {
    state.heat += 1;
    // back-to-back win streak count
    if(state.lastWasWin) state.bb += 1;
    state.lastWasWin = true;
    state.deadStreak = 0;
  }

  const sp = { id: ++state.spinNum, t, s, dead, ts: Date.now() };
  state.spins.push(sp);
  if(state.spins.length>500) state.spins.shift();

  // history line
  if(state.spinNum===1 && els.hist.textContent==='Belum ada data.') els.hist.textContent='';
  pushHistory(sp);

  // reset current
  state.cur = {t:0,s:0};
  save();
  render();
}

els.plusT.addEventListener('click', ()=>{ state.cur.t++; els.badge.textContent = `T:${state.cur.t} S:${state.cur.s}`; });
els.plusS.addEventListener('click', ()=>{ state.cur.s++; els.badge.textContent = `T:${state.cur.t} S:${state.cur.s}`; });
els.endSpin.addEventListener('click', endSpin);

els.undo.addEventListener('click', ()=>{
  const sp = state.spins.pop();
  if(!sp) return;
  state.spinNum--;
  if(sp.dead){
    state.dead = Math.max(0, state.dead-1);
    state.deadStreak = 0; // can't restore exact previous safely
  } else {
    state.heat = Math.max(0, state.heat-1);
  }
  state.lastWasWin = false;
  // rebuild history quickly
  els.hist.textContent = '';
  state.spins.forEach(pushHistory);
  save(); render();
});

els.reset.addEventListener('click', ()=>{
  if(!confirm('Reset semua statistik?')) return;
  state = { spins:[], cur:{t:0,s:0}, heat:0, dead:0, deadStreak:0, bb:0, spinNum:0, lastWasWin:false };
  save(); render();
  els.hist.textContent = 'Belum ada data.';
});

els.expJSON.addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(state.spins,null,2)], {type:'application/json'});
  downloadBlob(blob, `heatpro_spins_${Date.now()}.json`);
});
els.expCSV.addEventListener('click', ()=>{
  const header = 'id,tumble,scatter,dead,timestamp\n';
  const rows = state.spins.map(s=>`${s.id},${s.t},${s.s},${s.dead?1:0},${s.ts}`).join('\n');
  const blob = new Blob([header+rows], {type:'text/csv'});
  downloadBlob(blob, `heatpro_spins_${Date.now()}.csv`);
});

function downloadBlob(blob, name){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}

load();
render();
