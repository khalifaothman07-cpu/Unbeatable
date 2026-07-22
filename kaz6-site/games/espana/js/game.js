/*
 * 38-0 La Liga — game logic (generator, draft, formations, simulation, stats)
 * Requires data.js to be loaded first (defines CLUBS and OPPONENTS).
 */

const POOL=[];
CLUBS.forEach(c=>c.seasons.forEach(s=>POOL.push({clubName:c.club,abbr:c.abbr,color:c.color,color2:c.color2,season:s.season,players:s.players})));

// Strong, realistic field: two all-time giants + Atléti make six brutal fixtures.

let nPlayers=0;POOL.forEach(s=>nPlayers+=s.players.length);
document.getElementById('sClubs').textContent=CLUBS.length;
document.getElementById('sSquads').textContent=POOL.length;
document.getElementById('sPlayers').textContent=nPlayers;
document.getElementById('poolHint').textContent=POOL.length+' squads · 1981–2024';

/* ===== STATE ===== */
let hardMode=false,peakMode=false,xi=[],currentSquad=null,spinning=false,lastFilledLine=null;
const FORMATIONS={
  '4-3-3':{GK:1,DEF:4,MID:3,ATT:3},
  '4-4-2':{GK:1,DEF:4,MID:4,ATT:2},
  '3-5-2':{GK:1,DEF:3,MID:5,ATT:2},
  '4-2-3-1':{GK:1,DEF:4,MID:5,ATT:1},
  '3-4-3':{GK:1,DEF:3,MID:4,ATT:3}
};
let selectedFormation='4-3-3';
let CAP=FORMATIONS[selectedFormation];
function pickFormation(el){selectedFormation=el.dataset.f;document.querySelectorAll('#formOpts .fopt').forEach(b=>b.classList.toggle('active',b===el));}
// All-time peak = each player's best rating found anywhere in the database
const PEAK={};POOL.forEach(s=>s.players.forEach(p=>{PEAK[p[0]]=Math.max(PEAK[p[0]]||0,p[2]);}));
function pr(p){return peakMode?p.peakRating:p.seasonRating;}        // effective rating for a drafted player
function ratingOf(name,seasonR){return peakMode?PEAK[name]:seasonR;} // effective rating in the picker
let bag=[],rerollsLeft=8;

/* ===== SHIELD ===== */
let _sid=0;
function shield(c1,c2,abbr,w){
  const id='cs'+(_sid++),h=Math.round(w*1.16);
  return `<svg width="${w}" height="${h}" viewBox="0 0 40 46" style="display:block;flex:none">
   <defs><clipPath id="${id}"><path d="M3 2 H37 V25 Q37 40 20 44 Q3 40 3 25 Z"/></clipPath></defs>
   <g clip-path="url(#${id})"><rect width="40" height="46" fill="${c1}"/><rect x="16" width="8" height="46" fill="${c2}"/></g>
   <path d="M3 2 H37 V25 Q37 40 20 44 Q3 40 3 25 Z" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="2"/>
   <text x="20" y="24" text-anchor="middle" font-family="Anton" font-size="12.5" fill="#fff" stroke="rgba(0,0,0,.55)" stroke-width="0.7" paint-order="stroke">${abbr}</text></svg>`;
}
function clubMeta(name){return CLUBS.find(c=>c.club===name);}

/* ===== NAV ===== */
function go(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active');window.scrollTo({top:0,behavior:'smooth'});}
function toggleHard(){hardMode=!hardMode;document.getElementById('hardToggle').classList.toggle('on',hardMode);updatePill();}
function togglePeak(){peakMode=!peakMode;document.getElementById('peakToggle').classList.toggle('on',peakMode);updatePill();if(document.getElementById('draft').classList.contains('active')){updatePitch(false);if(currentSquad)renderPlayers();}}
function updatePill(){let t=peakMode?'Peak Ratings':'Season Ratings';if(hardMode)t+=' · Hard';document.getElementById('modePill').textContent=t;}

/* ===== GENERATOR ===== */
function refillBag(){bag=POOL.map((_,i)=>i);for(let i=bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}}
function nextFromBag(){if(bag.length===0)refillBag();return bag.pop();}

function genCard(sq,label,labelColor){
  const m=clubMeta(sq.clubName);
  return `${shield(m.color,m.color2,m.abbr,54)}<div class="gtxt"><div class="glabel" ${labelColor?`style="color:${labelColor}"`:''}>${label}</div><div class="gclub">${sq.clubName}</div><div class="gseason">${sq.season}</div></div>`;
}

function doSpin(){
  if(spinning||xi.length>=11) return;
  spinning=true;
  document.getElementById('spinBtn').setAttribute('disabled','');
  document.getElementById('pickWrap').style.display='none';
  const idx=nextFromBag();
  const rv=document.getElementById('reveal');
  rv.classList.remove('empty','landed');rv.classList.add('rolling');
  rv.style.borderColor='var(--line)';rv.style.background='var(--bg2)';
  let ticks=0;const total=15;
  (function tick(){
    if(ticks>=total){currentSquad=POOL[idx];spinning=false;rv.classList.remove('rolling');afterLand();return;}
    const r=POOL[Math.floor(Math.random()*POOL.length)];
    rv.innerHTML=genCard(r,'Generating…');
    ticks++;setTimeout(tick,38+ticks*ticks*1.1);
  })();
}

function afterLand(){
  const sq=currentSquad,rv=document.getElementById('reveal');
  rv.style.borderColor=sq.color;
  rv.style.background=`linear-gradient(180deg, ${hexA(sq.color,.16)}, var(--bg2))`;
  rv.innerHTML=genCard(sq,'You drew',sq.color);
  rv.classList.remove('landed');void rv.offsetWidth;rv.classList.add('landed');
  document.getElementById('spinBtn').style.display='none';
  renderPlayers();
}

/* ===== DRAFT ===== */
function filledByLine(){const f={GK:0,DEF:0,MID:0,ATT:0};xi.forEach(p=>f[p.line]++);return f;}
function lineOpen(line){return filledByLine()[line]<CAP[line];}

function renderPlayers(){
  const sq=currentSquad;
  document.getElementById('pickWrap').style.display='block';
  document.getElementById('pickTitle').textContent=`${sq.clubName} ${sq.season}`;
  const cont=document.getElementById('players'),noStock=document.getElementById('noStock'),rb=document.getElementById('rerollBtn');
  let anyValid=false,html="";
  const taken=new Set(xi.map(p=>p.name));
  sq.players.forEach((p,i)=>{
    const [name,line,rating]=p,dup=taken.has(name),valid=lineOpen(line)&&!dup;if(valid)anyValid=true;
    const shownR=ratingOf(name,rating),boost=peakMode&&PEAK[name]>rating?`<span style="font-size:11px;color:var(--good);vertical-align:2px"> ▲</span>`:'';
    const tag=dup?' · in XI':(lineOpen(line)?'':' · full');
    const r=hardMode?`<div class="pr hidden">▒▒</div>`:`<div class="pr">${shownR}${boost}</div>`;
    html+=`<button class="pcard" ${valid?'':'disabled'} onclick="draftPlayer(${i})"><div class="barL" style="background:${sq.color}"></div><div class="pos">${line}${tag}</div><div class="pn">${name}</div>${r}</button>`;
  });
  cont.innerHTML=html;cont.style.display=anyValid?'grid':'none';
  if(anyValid){
    noStock.style.display='none';
    if(rerollsLeft>0){rb.removeAttribute('disabled');rb.textContent=`⟳ Re-roll (${rerollsLeft})`;}
    else{rb.setAttribute('disabled','');rb.textContent='⟳ No re-rolls';}
  }else{
    noStock.style.display='block';noStock.textContent='None of this squad fits your open positions — generate again (free).';
    rb.removeAttribute('disabled');rb.textContent='⟳ Generate again (free)';
  }
}

function reroll(){
  const taken=new Set(xi.map(p=>p.name));
  const anyValid=currentSquad?currentSquad.players.some(p=>lineOpen(p[1])&&!taken.has(p[0])):true;
  if(anyValid){ if(rerollsLeft<=0)return; rerollsLeft--; }
  document.getElementById('pickWrap').style.display='none';
  doSpin();
}

function draftPlayer(i){
  const [name,line,rating]=currentSquad.players[i];if(!lineOpen(line)||xi.some(p=>p.name===name))return;
  const m=clubMeta(currentSquad.clubName);
  xi.push({name,line,seasonRating:rating,peakRating:PEAK[name],club:currentSquad.clubName,season:currentSquad.season,color:currentSquad.color,color2:currentSquad.color2,abbr:m.abbr});
  lastFilledLine=line;updatePitch(true);updateHeader();
  currentSquad=null;document.getElementById('pickWrap').style.display='none';
  const rv=document.getElementById('reveal');
  rv.classList.add('empty');rv.classList.remove('landed');rv.style.borderColor='var(--line)';rv.style.background='var(--bg2)';
  if(xi.length>=11){
    rv.innerHTML=`<div class="glabel" style="color:var(--good)">Squad complete</div><div class="gclub" style="color:var(--gold)">XI ready</div><div class="gseason">simulate below</div>`;
    document.getElementById('spinBtn').style.display='none';
    document.getElementById('simCta').style.display='block';
  }else{
    rv.innerHTML=`<div class="glabel">Keep building</div><div class="gclub">${11-xi.length} to go</div><div class="gseason">generate the next squad</div>`;
    const sb=document.getElementById('spinBtn');sb.removeAttribute('disabled');sb.style.display='inline-flex';sb.textContent='Generate squad';
  }
}

function updateHeader(){
  document.getElementById('draftTitle').textContent=`Draft your XI · ${xi.length}/11 · ${selectedFormation}`;
  document.getElementById('progBar').style.width=(xi.length/11*100)+'%';
  const f=filledByLine();let html="";
  ["GK","DEF","MID","ATT"].forEach(l=>{const full=f[l]>=CAP[l];html+=`<span class="lcount ${full?'full':''}">${l} <b>${f[l]}</b>/${CAP[l]}</span>`;});
  document.getElementById('lineCounts').innerHTML=html;
}

function updatePitch(animate){
  const order=[["ATT",CAP.ATT],["MID",CAP.MID],["DEF",CAP.DEF],["GK",CAP.GK]],byLine={GK:[],DEF:[],MID:[],ATT:[]};
  xi.forEach(p=>byLine[p.line].push(p));let html="";
  order.forEach(([line,cap])=>{
    html+=`<div class="row-line">`;
    for(let i=0;i<cap;i++){
      const p=byLine[line][i];
      if(p){
        const popping=animate&&line===lastFilledLine&&i===byLine[line].length-1;
        html+=`<div class="slot filled ${popping?'pop':''}"><div class="disc" style="background:linear-gradient(180deg,${p.color},${shade(p.color,-0.45)})">${initials(p.name)}<span class="bdg">${shield(p.color,p.color2,'',16)}</span></div><div class="nm">${shortName(p.name)}</div>${hardMode?'':`<div class="rt">${pr(p)}</div>`}</div>`;
      }else html+=`<div class="slot"><div class="disc">${line}</div><div class="nm"></div></div>`;
    }
    html+=`</div>`;
  });
  document.getElementById('pitch').innerHTML=html;
}

/* ===== HELPERS ===== */
function initials(n){const p=n.split(' ');return (p[0][0]+(p[p.length-1][0]||'')).toUpperCase();}
function shortName(n){const p=n.split(' ');return p.length>1?(p[0][0]+'. '+p.slice(1).join(' ')):n;}
function hexA(hex,a){const h=hex.replace('#','');return `rgba(${parseInt(h.substr(0,2),16)},${parseInt(h.substr(2,2),16)},${parseInt(h.substr(4,2),16)},${a})`;}
function shade(hex,amt){const h=hex.replace('#','');let r=parseInt(h.substr(0,2),16),g=parseInt(h.substr(2,2),16),b=parseInt(h.substr(4,2),16);const f=amt<0?0:255,p=Math.abs(amt);r=Math.round(r+(f-r)*p);g=Math.round(g+(f-g)*p);b=Math.round(b+(f-b)*p);return `rgb(${r},${g},${b})`;}
function poisson(l){let L=Math.exp(-l),k=0,p=1;do{k++;p*=Math.random();}while(p>L);return k-1;}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function ordinal(n){const s=["th","st","nd","rd"],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);}

/* ===== START / RESET ===== */
function startRun(){
  xi=[];currentSquad=null;rerollsLeft=8;refillBag();
  CAP=FORMATIONS[selectedFormation];
  const sb=document.getElementById('spinBtn');sb.style.display='inline-flex';sb.removeAttribute('disabled');sb.textContent='Generate squad';
  document.getElementById('pickWrap').style.display='none';document.getElementById('simCta').style.display='none';
  const rv=document.getElementById('reveal');rv.classList.add('empty');rv.classList.remove('landed','rolling');rv.style.borderColor='var(--line)';rv.style.background='var(--bg2)';
  rv.innerHTML=`<div class="glabel">Squad generator</div><div class="gclub">— — —</div><div class="gseason">${POOL.length} squads · 1981–2024</div>`;
  updatePitch(false);updateHeader();go('draft');
}

/* ===== SIMULATION ===== */
function teamRating(){
  const avg=xi.reduce((a,p)=>a+pr(p),0)/xi.length,counts={};
  xi.forEach(p=>counts[p.club]=(counts[p.club]||0)+1);
  let chem=0;Object.values(counts).forEach(c=>{if(c>=2)chem+=(c-1)*0.45;});chem=Math.min(chem,4);
  return {rating:avg+chem};
}
function runSeason(){
  const tr=teamRating(),fixtures=[];
  OPPONENTS.forEach(o=>{fixtures.push({opp:o[0],r:o[1],home:true});fixtures.push({opp:o[0],r:o[1],home:false});});
  for(let i=fixtures.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[fixtures[i],fixtures[j]]=[fixtures[j],fixtures[i]];}
  const matches=[];let W=0,D=0,L=0,GF=0,GA=0,PTS=0;
  fixtures.forEach(f=>{
    const homeAdj=f.home?4:-4,diff=tr.rating-f.r+homeAdj;
    const egFor=clamp(1.40+diff*0.082,0.18,4.2),egAg=clamp(1.32-diff*0.072,0.25,4.2);
    let gf=Math.min(poisson(egFor),9),ga=Math.min(poisson(egAg),9),res;
    if(gf>ga){res='W';W++;PTS+=3;}else if(gf<ga){res='L';L++;}else{res='D';D++;PTS++;}
    GF+=gf;GA+=ga;matches.push({...f,gf,ga,res});
  });
  const rows=OPPONENTS.map(o=>({name:o[0],pts:clamp(Math.round((o[1]-58)*2.7+(Math.random()*14-7)),12,100),you:false}));
  rows.push({name:'YOUR XI',pts:PTS,you:true});
  rows.sort((a,b)=>b.pts-a.pts||(b.you?-1:1));
  const pos=rows.findIndex(r=>r.you)+1;
  animateSim(matches,{W,D,L,GF,GA,PTS,pos,rows});
}
function animateSim(matches,final){
  document.getElementById('simOver').classList.add('on');
  let i=0,w=0,d=0,l=0;const tick=document.getElementById('simTick'),mini=document.getElementById('simMini');
  const iv=setInterval(()=>{
    if(i>=matches.length){clearInterval(iv);setTimeout(()=>{document.getElementById('simOver').classList.remove('on');renderResults(matches,final);go('results');},380);return;}
    const m=matches[i];if(m.res==='W')w++;else if(m.res==='D')d++;else l++;
    tick.textContent=(i+1);mini.innerHTML=`<span class="w">${w}W</span> · <span class="d">${d}D</span> · <span class="l">${l}L</span>`;i++;
  },40);
}

/* ===== PLAYER STATS ===== */
function distribute(stats,total,wfn,key){
  const w=stats.map(wfn),sum=w.reduce((a,b)=>a+b,0)||1;let assigned=0;
  stats.forEach((p,i)=>{const v=Math.round(total*w[i]/sum);p[key]=v;assigned+=v;});
  let diff=total-assigned;
  if(diff!==0){let mi=0;for(let i=1;i<w.length;i++)if(w[i]>w[mi])mi=i;stats[mi][key]=Math.max(0,stats[mi][key]+diff);}
}
function genPlayerStats(matches,GF){
  const cleanSheets=matches.filter(m=>m.ga===0).length;
  const stats=xi.map(p=>({...p}));
  const gw=p=>p.line==='ATT'?pr(p)*3.0:p.line==='MID'?pr(p)*1.05:p.line==='DEF'?pr(p)*0.2:0.02;
  const aw=p=>p.line==='ATT'?pr(p)*1.2:p.line==='MID'?pr(p)*1.75:p.line==='DEF'?pr(p)*0.6:0.08;
  distribute(stats,GF,gw,'goals');
  distribute(stats,Math.round(GF*0.72),aw,'assists');
  stats.forEach(p=>{
    p.apps=p.line==='GK'?38:38-Math.floor(Math.random()*5);
    p.cs=(p.line==='GK'||p.line==='DEF')?cleanSheets:null;
    p.srt=clamp(6.3+(pr(p)-75)*0.06+(p.goals+p.assists)*0.03,6.0,9.4);
  });
  return stats;
}

let lastResultSummary='';
function renderResults(matches,f){
  const v=document.getElementById('verdict');let cls='',tag='',title='',sub='';
  if(f.W===38){cls='perfect';tag='The Impossible';title='38 – 0';sub='A perfect, flawless, unbeaten season. You are immortal.';}
  else if(f.L===0){cls='invincible';tag='Unbeaten';title='Invincibles';sub=`${f.W} wins, ${f.D} draws, zero defeats.`;}
  else if(f.pos===1){cls='champ';tag='Campeones de Liga';title='Champions';sub='Top of the table — you’ve won La Liga.';}
  else if(f.pos<=4){cls='champ';tag=`Finished ${ordinal(f.pos)}`;title='Top Four';sub='Champions League football secured.';}
  else if(f.pos<=10){tag=`Finished ${ordinal(f.pos)}`;title='Mid-table';sub='A solid, unspectacular campaign.';}
  else{tag=`Finished ${ordinal(f.pos)}`;title='Survival';sub='That all-time XI deserved better. Generate smarter.';}
  v.className='verdict '+cls;
  v.innerHTML=`<div class="tag">${tag}</div><h2>${title}</h2><div class="rec"><span class="w">${f.W}</span> <span style="color:var(--muted)">·</span> <span class="d">${f.D}</span> <span style="color:var(--muted)">·</span> <span class="l">${f.L}</span></div><div class="sub">${sub}</div>`;
  document.getElementById('resStats').innerHTML=`<div class="rstat"><b>${f.PTS}</b><small>Points</small></div><div class="rstat"><b>${ordinal(f.pos)}</b><small>Position</small></div><div class="rstat"><b>${f.GF}</b><small>Goals For</small></div><div class="rstat"><b>${f.GF-f.GA>=0?'+':''}${f.GF-f.GA}</b><small>Goal Diff</small></div>`;

  const RECPTS=100,RECWINS=32;let cmp;
  if(f.W===38) cmp="You won all 38 — no side has ever done it in La Liga history. This is fiction made flesh.";
  else if(f.L===0) cmp="An unbeaten 38-game season — no La Liga side has ever managed it; the closest ever lost just once.";
  else if(f.W>RECWINS) cmp=`Your ${f.W} wins would beat the all-time La Liga record of ${RECWINS} (Madrid 2011-12, Barça 2012-13).`;
  else if(f.W===RECWINS) cmp=`Your ${f.W} wins match the all-time La Liga record of ${RECWINS}.`;
  else if(f.PTS>=RECPTS) cmp=`Your ${f.PTS} points would equal or beat the league record of ${RECPTS}.`;
  else if(f.pos===1) cmp=`Champions — but the record is ${RECPTS} pts / ${RECWINS} wins, and no team has ever won all 38.`;
  else cmp=`For reference: the record is ${RECPTS} points and ${RECWINS} wins. No team has ever won all 38, and a fully unbeaten season has never happened.`;
  document.getElementById('benchmark').innerHTML=`<b>Measured against 45 years of La Liga:</b> ${cmp}`;

  // player stats
  const stats=genPlayerStats(matches,f.GF);
  const sorted=[...stats].sort((a,b)=>(b.goals+b.assists)-(a.goals+a.assists)||b.srt-a.srt);
  const pot=[...stats].sort((a,b)=>b.srt-a.srt||(b.goals+b.assists)-(a.goals+a.assists))[0];
  let html=`<div class="pot">${shield(pot.color,pot.color2,pot.abbr,32)}<div><div class="potlbl">Player of the Season</div><div class="potname">${pot.name}</div><div class="potmeta">${pot.goals} goals · ${pot.assists} assists</div></div><div class="potrt"><b>${pot.srt.toFixed(1)}</b><small>avg</small></div></div>`;
  html+=`<table class="stat-table"><tr><th>Player</th><th class="num">Ap</th><th class="num">G</th><th class="num">A</th><th class="num">CS</th><th class="num">Avg</th></tr>`;
  sorted.forEach(p=>{
    html+=`<tr><td><div class="pcell">${shield(p.color,p.color2,p.abbr,20)}<span>${p.name}<b class="pmeta">${p.line}</b></span></div></td><td class="num">${p.apps}</td><td class="num ${p.goals?'':'dim'}">${p.goals||'–'}</td><td class="num ${p.assists?'':'dim'}">${p.assists||'–'}</td><td class="num ${p.cs!=null?'':'dim'}">${p.cs!=null?p.cs:'–'}</td><td class="num">${p.srt.toFixed(1)}</td></tr>`;
  });
  html+=`</table>`;
  document.getElementById('squadList').innerHTML=html;

  document.getElementById('tableEl').innerHTML=`<tr><th>#</th><th>Club</th><th class="num">Pts</th></tr>`+f.rows.map((r,idx)=>`<tr class="${r.you?'you':''}"><td><span class="posn">${idx+1}</span></td><td>${r.you?'★ '+r.name:r.name}</td><td class="num">${r.pts}</td></tr>`).join('');
  document.getElementById('matchLog').innerHTML=matches.map(m=>`<div class="mrow"><span class="ha">${m.home?'HOME':'AWAY'}</span><span class="opp">${m.opp}</span><span class="sc">${m.gf}–${m.ga}</span><span class="res ${m.res}">${m.res}</span></div>`).join('');

  const topScorer=[...stats].sort((a,b)=>b.goals-a.goals)[0];
  lastResultSummary=`38–0 La Liga · my all-time XI finished ${ordinal(f.pos)} — ${f.W}W ${f.D}D ${f.L}L, ${f.PTS} pts. Top scorer ${topScorer.name} (${topScorer.goals}). ${f.W===38?'A PERFECT 38–0!':f.L===0?'Unbeaten Invincibles!':f.pos===1?'CHAMPIONS!':''}`.trim();
}
function shareRun(){const t=lastResultSummary||'38–0 La Liga';if(navigator.clipboard)navigator.clipboard.writeText(t).then(()=>showToast('Result copied'),()=>showToast('Copy failed'));else showToast(t);}
function showToast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('on');clearTimeout(window._tt);window._tt=setTimeout(()=>t.classList.remove('on'),2200);}
