/* ============================================================
   render.js  ·  RENDER LAYER (shared across every page)
   Reads global SITE, injects each block into its mount.
   Mounts are hooked by [data-render="X"] and filled via
   querySelectorAll, so a block may appear on several pages.
   Nav/footer/progress are single per document (by id).
   No event wiring here (that's main.js / the router).
   ============================================================ */
function esc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function splitScore(s){return esc(s).replace(/·/g,'<span class="sep">·</span>');}
const PLAY='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const AR='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg>';

function fill(sel,html){document.querySelectorAll('[data-render="'+sel+'"]').forEach(el=>{el.innerHTML=html;});}
function currentFile(){var p=location.pathname.split("/").pop();return p&&p.length?p:"index.html";}

/* NAV (single) */
function renderNav(){
  var nav=document.getElementById("nav"); if(!nav) return;
  var here=(window.KAZ6_ROUTE||currentFile());
  var links=SITE.pages.map(function(p){
    var cur=p.file===here?' aria-current="page"':"";
    return '<a class="nav-link" href="'+esc(p.file)+'"'+cur+'>'+esc(p.label)+'</a>';
  }).join("");
  nav.innerHTML='<a class="nav-mark wordmark wordmark--prism" href="index.html" aria-label="KAZ6 home">'+esc(SITE.name)+'</a>'
    +'<div class="nav-links">'+links+'<a class="nav-link nav-cta" href="contact.html">Contact</a></div>';
}

/* FOOTER (single) */
function renderFooter(){
  var f=document.getElementById("foot"); if(!f) return;
  var pageLinks=SITE.pages.filter(p=>!p.home).map(p=>'<a href="'+esc(p.file)+'">'+esc(p.label)+'</a>').join("");
  var social=SITE.socials.map(s=>'<a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.name)+'</a>').join("");
  f.innerHTML='<div class="wrap"><div class="foot-grid">'
    +'<div class="foot-col"><span class="foot-mark wordmark">'+esc(SITE.name)+'</span><p class="foot-tag">'+esc(SITE.tagline)+'</p></div>'
    +'<div class="foot-col"><h4>Pages</h4>'+pageLinks+'</div>'
    +'<div class="foot-col"><h4>Elsewhere</h4>'+social+'</div>'
    +'</div><div class="foot-base">'
    +'<span class="foot-note">'+esc(SITE.meta.place)+' · '+esc(SITE.meta.coords)+'</span>'
    +'<span class="foot-note">© '+esc(SITE.meta.year)+' '+esc(SITE.name)+'</span>'
    +'</div></div>';
}

/* HOME ROUTES */
function renderRoutes(){
  fill("routes", SITE.pages.filter(p=>!p.home).map(p=>
    '<a class="route reveal" href="'+esc(p.file)+'">'
    +'<span class="route-n">'+esc(p.n)+'</span>'
    +'<span class="route-name">'+esc(p.label)+'</span>'
    +'<span class="route-desc">'+esc(p.desc)+'</span>'
    +'<span class="route-arrow">'+AR+'</span></a>').join(""));
}

/* MARQUEE (v10: static strip, not a looping duplicate) */
function renderMarquee(){
  if(!SITE.marquee) return;
  fill("marquee", SITE.marquee.map(w=>'<span class="marq-item">'+esc(w)+'</span>').join(""));
}

/* GAME CARDS */
function coverHTML(g){
  var m=g.media;
  if(!m||!m.src) return '<div class="game-cover"><span class="await">Awaiting cover</span></div>';
  if(m.type==="video"){
    return '<div class="game-cover"><video src="'+esc(m.src)+'"'+(m.poster?' poster="'+esc(m.poster)+'"':"")+' muted loop playsinline autoplay'
      +' onerror="this.outerHTML=\'&lt;span class=&quot;await&quot;&gt;Awaiting cover&lt;/span&gt;\'"></video></div>';
  }
  return '<div class="game-cover"><img src="'+esc(m.src)+'" alt="'+esc(m.alt||"")+'" loading="lazy"'
    +' onerror="this.outerHTML=\'&lt;span class=&quot;await&quot;&gt;Awaiting cover&lt;/span&gt;\'"></div>';
}
function renderGames(){
  fill("games", SITE.games.map(function(g,i){
    var play=(g.live&&g.url)
      ? '<a class="play-btn" href="'+esc(g.url)+'" data-game="'+esc(g.id)+'">Play '+PLAY+'</a>'
      : '<span class="play-btn" aria-disabled="true">Soon</span>';
    var tags=g.tags.map(t=>'<span class="tag">'+esc(t)+'</span>').join("");
    return '<article class="game-card reveal d'+((i%3)+1)+'">'+coverHTML(g)
      +'<div class="game-body"><div class="game-top">'
      +'<span class="game-score">'+splitScore(g.score)+'</span>'
      +'<span class="game-status">Live</span></div>'
      +'<h3 class="game-title">'+esc(g.title)+'</h3>'
      +'<div class="game-scorelabel">'+esc(g.scoreLabel)+'</div>'
      +'<p class="game-desc">'+esc(g.desc)+'</p>'
      +'<div class="card-tags">'+tags+'</div>'
      +'<div class="game-foot">'+play+'</div></div></article>';
  }).join(""));
}

/* ARENA CARDS */
function renderArenas(){
  fill("arenas", SITE.arenas.map(function(a,i){
    var tags=a.tags.map(t=>'<span class="tag">'+esc(t)+'</span>').join("");
    return '<article class="card reveal d'+((i%3)+1)+'">'
      +'<span class="card-k">'+esc(a.role)+'</span>'
      +'<h3 class="card-title">'+esc(a.title)+'</h3>'
      +'<p class="card-desc">'+esc(a.desc)+'</p>'
      +'<div class="card-tags">'+tags+'</div></article>';
  }).join(""));
}

/* STAT LEDGER */
function renderStats(){
  fill("stats", SITE.stats.map(s=>
    '<div class="row reveal"><span class="v">'+splitScore(s.value)+'</span>'
    +'<span class="lead-dots"></span><span class="k">'+esc(s.label)+'</span></div>').join(""));
}

/* SOCIAL ROWS */
function renderSocials(){
  fill("socials", SITE.socials.map(s=>
    '<a class="link-row reveal" href="'+esc(s.url)+'" target="_blank" rel="noopener">'
    +'<span class="link-name">'+esc(s.name)+'</span>'
    +'<span class="link-dots"></span>'
    +'<span class="link-handle">'+esc(s.handle)+' '+AR+'</span></a>').join(""));
}

/* ABOUT PARAGRAPHS */
function renderAbout(){
  fill("about", SITE.about.map(p=>'<p class="reveal">'+esc(p)+'</p>').join(""));
}

/* VENTURE (IAM GOLF summary on ventures.html) */
function renderVenture(){
  if(!SITE.venture) return;
  fill("venture-desc", esc(SITE.venture.desc));
  fill("venture-disclaimer", esc(SITE.venture.disclaimer||""));
}

/* simple field fills */
function renderFields(){
  document.querySelectorAll("[data-field]").forEach(function(el){
    var k=el.getAttribute("data-field"); if(SITE[k]) el.textContent=SITE[k];
  });
}

function renderAll(){
  renderNav();renderFooter();renderRoutes();renderMarquee();
  renderGames();renderArenas();renderStats();renderSocials();renderAbout();renderVenture();renderFields();
}
document.addEventListener("DOMContentLoaded",renderAll);
