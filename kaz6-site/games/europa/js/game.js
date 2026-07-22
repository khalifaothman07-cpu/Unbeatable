/*
 * 13-0 Europa — game logic (generator, draft, formations, simulation, stats)
 * Requires data.js to be loaded first (defines CLUBS and OPPONENTS).
 */

const POOL=[];
CLUBS.forEach(c=>c.seasons.forEach(s=>POOL.push({clubName:c.club,abbr:c.abbr,color:c.color,color2:c.color2,season:s.season,players:s.players})));

// Strong, realistic field: two all-time giants + Atléti make six brutal fixtures.

let nPlayers=0;POOL.forEach(s=>nPlayers+=s.players.length);
document.getElementById('sClubs').textContent=CLUBS.length;
document.getElementById('sSquads').textContent=POOL.length;
document.getElementById('sPlayers').textContent=nPlayers;
document.getElementById('poolHint').textContent=POOL.length+' squads · 1961–2024';

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
  document.getElementById('pickTitle').innerHTML=`${sq.clubName} ${sq.season} <span class="chemhint">links ${chemDots(projectedTier(sq.clubName,sq.season))}</span>`;
  const cont=document.getElementById('players'),noStock=document.getElementById('noStock'),rb=document.getElementById('rerollBtn');
  let anyValid=false,html="";
  const taken=new Set(xi.map(p=>p.name));
  sq.players.forEach((p,i)=>{
    const [name,line,rating,nat]=p,dup=taken.has(name),valid=lineOpen(line)&&!dup;if(valid)anyValid=true;
    const shownR=ratingOf(name,rating),boost=peakMode&&PEAK[name]>rating?`<span style="font-size:11px;color:var(--good);vertical-align:2px"> ▲</span>`:'';
    const tag=dup?' · in XI':(lineOpen(line)?'':' · full');
    const r=hardMode?`<div class="pr hidden">▒▒</div>`:`<div class="pr">${shownR}${boost}</div>`;
    const pchem=xi.length?`<div class="pchem">+chem ${chemDots(projectedTier(sq.clubName,sq.season,nat))}</div>`:'';
    html+=`<button class="pcard" ${valid?'':'disabled'} onclick="draftPlayer(${i})"><div class="barL" style="background:${sq.color}"></div><div class="pos">${line}${tag} · ${nat}</div><div class="pn">${name}</div>${r}${pchem}</button>`;
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
  const [name,line,rating,nat]=currentSquad.players[i];if(!lineOpen(line)||xi.some(p=>p.name===name))return;
  const m=clubMeta(currentSquad.clubName);
  xi.push({name,line,nat,seasonRating:rating,peakRating:PEAK[name],club:currentSquad.clubName,season:currentSquad.season,color:currentSquad.color,color2:currentSquad.color2,abbr:m.abbr});
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
  const ch=squadChem();
  html+=`<span class="lcount chem">CHEM <b>${ch.total}</b>/33</span>`;
  document.getElementById('lineCounts').innerHTML=html;
  const cf=document.getElementById('chemFill'),ct=document.getElementById('chemTxt');
  if(cf){cf.style.width=(ch.total/ch.max*100)+'%';ct.textContent=`Chemistry ${ch.total}/33`;}
}

function updatePitch(animate){
  const order=[["ATT",CAP.ATT],["MID",CAP.MID],["DEF",CAP.DEF],["GK",CAP.GK]],byLine={GK:[],DEF:[],MID:[],ATT:[]};
  xi.forEach(p=>byLine[p.line].push(p));let html="";
  const ch=squadChem(),tierMap=new Map(xi.map((p,i)=>[p,ch.tiers[i]]));
  order.forEach(([line,cap])=>{
    html+=`<div class="row-line">`;
    for(let i=0;i<cap;i++){
      const p=byLine[line][i];
      if(p){
        const popping=animate&&line===lastFilledLine&&i===byLine[line].length-1;
        html+=`<div class="slot filled ${popping?'pop':''}"><div class="disc" style="background:linear-gradient(180deg,${p.color},${shade(p.color,-0.45)})">${initials(p.name)}<span class="bdg">${shield(p.color,p.color2,'',16)}</span></div><div class="nm">${shortName(p.name)}</div>${hardMode?'':`<div class="rt">${pr(p)}</div>`}${chemDots(tierMap.get(p))}</div>`;
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
  rv.innerHTML=`<div class="glabel">Squad generator</div><div class="gclub">— — —</div><div class="gseason">${POOL.length} squads · 1961–2024</div>`;
  updatePitch(false);updateHeader();go('draft');
}

/* ===== CHEMISTRY ===== */
// players link by club (strongest when same club AND season = real teammates)
function linkPts(a,b){ let p=0; if(a.club===b.club&&a.season===b.season) p+=2; else if(a.club===b.club) p+=1; if(a.nat&&b.nat&&a.nat===b.nat) p+=1; return p; }
function chemTierOf(p,squad){ let pts=0; squad.forEach(o=>{ if(o!==p) pts+=linkPts(p,o); }); return pts>=3?3:pts; }
function squadChem(){ const tiers=xi.map(p=>chemTierOf(p,xi)); return {tiers,total:tiers.reduce((a,b)=>a+b,0),max:33}; }
function chemAdj(t){ return t===3?2:t===2?1:t===1?0:-2; }   // effective-rating swing per player
function projectedTier(club,season,nat){ let pts=0; xi.forEach(o=>pts+=linkPts({club,season,nat},o)); return pts>=3?3:pts; }
function chemDots(t){ let s=''; for(let i=0;i<3;i++) s+=`<span class="cd ${i<t?'on':''}"></span>`; return `<span class="chemdots">${s}</span>`; }

/* ===== SIMULATION ===== */
function teamRating(){
  const {tiers}=squadChem();
  const eff=xi.map((p,i)=>pr(p)+chemAdj(tiers[i]));   // chemistry shifts each player's effective rating
  return {rating:eff.reduce((a,b)=>a+b,0)/eff.length};
}
function matchSim(tr,oppR,venue){ // venue: H home, A away, N neutral
  const homeAdj=venue==='H'?4:venue==='A'?-4:0,diff=tr-oppR+homeAdj;
  const egFor=clamp(1.40+diff*0.082,0.18,4.2),egAg=clamp(1.32-diff*0.072,0.25,4.2);
  return {gf:Math.min(poisson(egFor),9),ga:Math.min(poisson(egAg),9)};
}
function runCampaign(){
  const tr=teamRating().rating,matches=[];
  let W=0,D=0,L=0,GF=0,GA=0;
  const rec=m=>{m.res=m.gf>m.ga?'W':m.gf<m.ga?'L':'D';matches.push(m);GF+=m.gf;GA+=m.ga;if(m.res==='W')W++;else if(m.res==='L')L++;else D++;return m;};
  const field=OPPONENTS.map(o=>({name:o[0],r:o[1]}));
  for(let i=field.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[field[i],field[j]]=[field[j],field[i]];}
  const group=field.slice(0,3),pool=field.slice(3).sort((a,b)=>b.r-a.r);  // pool ordered so later rounds face bigger clubs

  // ---- GROUP STAGE (4 teams, home & away) ----
  const gt=[{name:'YOUR XI',you:true,pts:0,gd:0,gf:0}];
  group.forEach(g=>gt.push({name:g.name,pts:0,gd:0,gf:0}));
  const addG=(name,gf,ga)=>{const t=gt.find(x=>x.name===name);t.gf+=gf;t.gd+=gf-ga;if(gf>ga)t.pts+=3;else if(gf===ga)t.pts+=1;};
  group.forEach(g=>['H','A'].forEach(v=>{const m=rec({stage:'Group',opp:g.name,venue:v,...matchSim(tr,g.r,v)});addG('YOUR XI',m.gf,m.ga);addG(g.name,m.ga,m.gf);}));
  for(let a=0;a<group.length;a++)for(let b=0;b<group.length;b++){if(a===b)continue;const r=matchSim(group[a].r,group[b].r,'H');addG(group[a].name,r.gf,r.ga);addG(group[b].name,r.ga,r.gf);}
  gt.sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf);
  const groupPos=gt.findIndex(t=>t.you)+1,advanced=groupPos<=2;

  // ---- KNOCKOUTS ----
  const bracket=[];let champion=false,runnerUp=false,roundReached='Group Stage';
  if(advanced){
    const rounds=[{key:'Round of 16',opp:pool[3]},{key:'Quarter-final',opp:pool[2]},{key:'Semi-final',opp:pool[1]}];
    let alive=true;
    for(const rd of rounds){
      roundReached=rd.key;
      const l1=rec({stage:rd.key,leg:1,opp:rd.opp.name,venue:'A',...matchSim(tr,rd.opp.r,'A')});
      const l2=rec({stage:rd.key,leg:2,opp:rd.opp.name,venue:'H',...matchSim(tr,rd.opp.r,'H')});
      const af=l1.gf+l2.gf,aa=l1.ga+l2.ga;let adv,dec=false;
      if(af>aa)adv=true;else if(af<aa)adv=false;else{adv=Math.random()<clamp(0.5+(tr-rd.opp.r)*0.012,0.2,0.8);dec=true;}
      bracket.push({round:rd.key,opp:rd.opp.name,score:`${af}–${aa}${dec?' pens':' agg'}`,adv});
      if(!adv){alive=false;break;}
    }
    if(alive){
      roundReached='Final';const fo=pool[0];
      const fm=rec({stage:'Final',opp:fo.name,venue:'N',...matchSim(tr,fo.r,'N')});
      let won,dec=false;
      if(fm.gf>fm.ga)won=true;else if(fm.gf<fm.ga)won=false;else{won=Math.random()<clamp(0.5+(tr-fo.r)*0.012,0.2,0.8);dec=true;}
      bracket.push({round:'Final',opp:fo.name,score:`${fm.gf}–${fm.ga}${dec?' pens':''}`,adv:won,final:true});
      if(won){champion=true;roundReached='Winners';}else runnerUp=true;
    }
  }
  animateSim(matches,{champion,runnerUp,roundReached,W,D,L,GF,GA,games:matches.length,groupTable:gt,groupPos,bracket});
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
function genPlayerStats(matches,GF,games){
  const cleanSheets=matches.filter(m=>m.ga===0).length;
  const stats=xi.map(p=>({...p}));
  const gw=p=>p.line==='ATT'?pr(p)*3.0:p.line==='MID'?pr(p)*1.05:p.line==='DEF'?pr(p)*0.2:0.02;
  const aw=p=>p.line==='ATT'?pr(p)*1.2:p.line==='MID'?pr(p)*1.75:p.line==='DEF'?pr(p)*0.6:0.08;
  distribute(stats,GF,gw,'goals');
  distribute(stats,Math.round(GF*0.72),aw,'assists');
  stats.forEach(p=>{
    p.apps=p.line==='GK'?games:Math.max(1,games-Math.floor(Math.random()*Math.min(3,games)));
    p.cs=(p.line==='GK'||p.line==='DEF')?cleanSheets:null;
    p.srt=clamp(6.3+(pr(p)-75)*0.06+(p.goals+p.assists)*0.05,6.0,9.4);
  });
  return stats;
}

let lastResultSummary='';
function renderResults(matches,f){
  const v=document.getElementById('verdict');let cls='',tag='',title='',sub='';
  if(f.champion&&f.W===f.games){cls='perfect';tag='The Impossible';title=`${f.W} – 0`;sub='Every game from group to final, won. You are immortal.';}
  else if(f.champion&&f.L===0){cls='invincible';tag='Invincible';title='Kings of Europe';sub=`Champions without a single defeat — ${f.W}W ${f.D}D.`;}
  else if(f.champion){cls='champ';tag='Champions of Europe';title='Winners';sub='You went the distance and lifted the continental crown.';}
  else if(f.runnerUp){cls='champ';tag='Runners-up';title='Finalists';sub='One match from glory — beaten in the final.';}
  else if(f.roundReached==='Group Stage'){tag='Eliminated';title='Group Stage';sub='Couldn’t escape the group. Generate a stronger XI.';}
  else{tag='Eliminated';title=f.roundReached;sub=`Knocked out in the ${f.roundReached.toLowerCase()}.`;}
  v.className='verdict '+cls;
  v.innerHTML=`<div class="tag">${tag}</div><h2>${title}</h2><div class="rec"><span class="w">${f.W}</span> <span style="color:var(--muted)">·</span> <span class="d">${f.D}</span> <span style="color:var(--muted)">·</span> <span class="l">${f.L}</span></div><div class="sub">${sub}</div>`;
  document.getElementById('resStats').innerHTML=`<div class="rstat"><b>${f.champion?'🏆':f.roundReached}</b><small>${f.champion?'Champions':'Reached'}</small></div><div class="rstat"><b>${f.games}</b><small>Played</small></div><div class="rstat"><b>${f.GF}</b><small>Goals For</small></div><div class="rstat"><b>${f.GF-f.GA>=0?'+':''}${f.GF-f.GA}</b><small>Goal Diff</small></div>`;

  let cmp;
  if(f.champion&&f.W===f.games) cmp="Thirteen games against the giants of Europe, thirteen wins. No side in history has ever been this perfect.";
  else if(f.champion&&f.L===0) cmp="You lifted the continental crown without losing once — the mark of a truly invincible side.";
  else if(f.champion) cmp="Champions of Europe. You beat the best the continent could throw at you when it mattered most.";
  else if(f.runnerUp) cmp="A run to the final against Europe's elite — agonisingly short of the trophy itself.";
  else if(f.roundReached==='Group Stage') cmp="The group bit back. Even all-time XIs can trip at the first hurdle.";
  else cmp=`A knockout run that ended in the ${f.roundReached.toLowerCase()}, against the greatest clubs in European history.`;
  document.getElementById('benchmark').innerHTML=`<b>The road to the final:</b> ${cmp}`;

  // player stats
  const stats=genPlayerStats(matches,f.GF,f.games);
  const sorted=[...stats].sort((a,b)=>(b.goals+b.assists)-(a.goals+a.assists)||b.srt-a.srt);
  const pot=[...stats].sort((a,b)=>b.srt-a.srt||(b.goals+b.assists)-(a.goals+a.assists))[0];
  let html=`<div class="pot">${shield(pot.color,pot.color2,pot.abbr,32)}<div><div class="potlbl">Player of the Campaign</div><div class="potname">${pot.name}</div><div class="potmeta">${pot.goals} goals · ${pot.assists} assists</div></div><div class="potrt"><b>${pot.srt.toFixed(1)}</b><small>avg</small></div></div>`;
  const ch=squadChem(),net=(ch.tiers.reduce((a,t)=>a+chemAdj(t),0)/11);
  html+=`<div class="chemsum"><span>Squad chemistry <b>${ch.total}/33</b></span><span class="${net>=0?'pos':'neg'}">${net>=0?'+':''}${net.toFixed(1)} avg rating in the sim</span></div>`;
  html+=`<table class="stat-table"><tr><th>Player</th><th class="num">Ap</th><th class="num">G</th><th class="num">A</th><th class="num">CS</th><th class="num">Avg</th></tr>`;
  sorted.forEach(p=>{
    html+=`<tr><td><div class="pcell">${shield(p.color,p.color2,p.abbr,20)}<span>${p.name}<b class="pmeta">${p.line} · ${p.nat}</b></span></div></td><td class="num">${p.apps}</td><td class="num ${p.goals?'':'dim'}">${p.goals||'–'}</td><td class="num ${p.assists?'':'dim'}">${p.assists||'–'}</td><td class="num ${p.cs!=null?'':'dim'}">${p.cs!=null?p.cs:'–'}</td><td class="num">${p.srt.toFixed(1)}</td></tr>`;
  });
  html+=`</table>`;
  document.getElementById('squadList').innerHTML=html;

  // group table
  document.getElementById('tableEl').innerHTML=`<tr><th>#</th><th>Club</th><th class="num">Pts</th><th class="num">GD</th></tr>`+f.groupTable.map((r,idx)=>`<tr class="${r.you?'you':''} ${idx<2?'qual':''}"><td><span class="posn">${idx+1}</span></td><td>${r.you?'★ '+r.name:r.name}</td><td class="num">${r.pts}</td><td class="num">${r.gd>=0?'+':''}${r.gd}</td></tr>`).join('');

  // knockout bracket + match log
  let bh='';
  if(f.bracket.length){bh='<div class="bracket">'+f.bracket.map(b=>`<div class="brow ${b.adv?'win':'lose'}${b.final?' final':''}"><span class="brd">${b.round}</span><span class="bopp">${b.opp}</span><span class="bsc">${b.score}</span><span class="bico">${b.adv?'✓':'✗'}</span></div>`).join('')+'</div>';}
  const log=matches.map(m=>{const venue=m.venue==='N'?'FINAL':m.venue==='H'?'HOME':'AWAY';const lg=m.leg?` L${m.leg}`:'';return `<div class="mrow"><span class="ha">${venue}${lg}</span><span class="opp">${m.opp}</span><span class="sc">${m.gf}–${m.ga}</span><span class="res ${m.res}">${m.res}</span></div>`;}).join('');
  document.getElementById('matchLog').innerHTML=bh+log;

  const topScorer=[...stats].sort((a,b)=>b.goals-a.goals)[0];
  lastResultSummary=`13–0 Europa · my all-time XI ${f.champion?'WON EUROPA':'reached the '+f.roundReached.toLowerCase()} — ${f.W}W ${f.D}D ${f.L}L. Top scorer ${topScorer.name} (${topScorer.goals}). ${f.champion&&f.W===f.games?'A PERFECT '+f.W+'–0!':f.champion&&f.L===0?'UNBEATEN CHAMPIONS!':''}`.trim();
}
function shareRun(){const t=lastResultSummary||'13–0 Europa';if(navigator.clipboard)navigator.clipboard.writeText(t).then(()=>showToast('Result copied'),()=>showToast('Copy failed'));else showToast(t);}
function showToast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('on');clearTimeout(window._tt);window._tt=setTimeout(()=>t.classList.remove('on'),2200);}
