/* ============================================================
   Frank's Wine Almanac — interactive map engine
   ============================================================ */
(function(){
const A = window.ALMANAC, C = A.context;
const SVGNS="http://www.w3.org/2000/svg";
const el=(n,a={})=>{const e=document.createElementNS(SVGNS,n);for(const k in a)e.setAttribute(k,a[k]);return e;};
const $=id=>document.getElementById(id);

const VB=A.viewBox, FULL={x:0,y:0,w:VB[2],h:VB[3]};
const svg=$('map');
const layerEls={nb:$('gNb'),nbl:$('gNbLab'),base:$('gBase'),reg:$('gReg'),appArea:$('gAppArea'),aroute:$('gAroute'),alabel:$('gAlabel'),wroute:$('gWroute'),rlab:$('gRlab'),city:$('gCity'),town:$('gTown')};
let view={...FULL}, selected=null, prodFilter='all', selApp=null;
const COL=AL.COLORS;

/* layer visibility state */
const vis={wineRoutes:true, autoroutes:true, cities:true, villages:true, neighbours:true, geology:false};

/* geology (terroir) colour ramp — light gold → deep wine */
const TS=Object.values(A.regions).map(r=>r.terroirScore||7);
const TMIN=Math.min(...TS), TMAX=Math.max(...TS);
function hx(h){return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
function lerpC(a,b,t){const x=hx(a),y=hx(b);return `rgb(${x.map((v,i)=>Math.round(v+(y[i]-v)*t)).join(',')})`;}
const GEO_LO='#efdcb0', GEO_HI='#6b1f2e';
function terroirColor(s){const t=Math.max(0,Math.min(1,((s||TMIN)-TMIN)/((TMAX-TMIN)||1)));return lerpC(GEO_LO,GEO_HI,t);}

/* ---------- build static layers ---------- */
// neighbours
function pathCentroid(d){ let sx=0,sy=0,n=0; d.replace(/[-0-9.]+,[-0-9.]+/g,m=>{const[a,b]=m.split(',').map(Number);sx+=a;sy+=b;n++;return m;}); return n?[sx/n,sy/n]:[0,0]; }
C.neighbours.forEach(nb=>{ layerEls.nb.appendChild(el('path',{d:nb.path,class:'nb'})); });
const NBLAB={Spain:1,Italy:1,Germany:1,Switzerland:1,Belgium:1,"United Kingdom":1};
C.neighbours.forEach(nb=>{ if(NBLAB[nb.name]){ const c=pathCentroid(nb.path); const t=el('text',{x:c[0],y:c[1],class:'nblabel'}); t.textContent=nb.name==="United Kingdom"?"U.K.":nb.name; layerEls.nbl.appendChild(t);} });
// france base
layerEls.base.appendChild(el('path',{d:A.france,class:'base'}));
// regions
const regionEls={}, rlblEls={};
for(const id in A.regions){ const r=A.regions[id];
  const p=el('path',{d:r.geo.path,class:'reg',fill:COL[id],'data-id':id});
  p.addEventListener('click',e=>{e.stopPropagation(); if(moved)return; selectRegion(id);});
  p.addEventListener('mousemove',e=>AL.tip(e,'Region · '+r.name));
  p.addEventListener('mouseleave',()=>AL.tip(null,false));
  layerEls.reg.appendChild(p); regionEls[id]=p;
  const c=r.geo.centroid;
  const pill=el('rect',{class:'pill region'});
  const t=el('text',{x:c[0],y:c[1],class:'rlabel'}); t.textContent=r.name; t.dataset.base=13;
  layerEls.rlab.appendChild(pill); layerEls.rlab.appendChild(t);   // pill first → behind text
  rlblEls[id]={t,pill};
}
svg.addEventListener('click',()=>{ if(moved)return; if(selected) resetView(); });
// autoroutes
C.autoroutes.forEach(a=>{
  const d="M"+a.pts.map(p=>p.join(',')).join("L");
  layerEls.aroute.appendChild(el('path',{d, class:'aroute'}));
  const mid=a.pts[Math.floor(a.pts.length/2)];
  const pill=el('rect',{class:'pill aroute'});
  const t=el('text',{x:mid[0],y:mid[1]-2,class:'alabel','text-anchor':'middle'}); t.textContent=a.code; t.dataset.base=7;
  layerEls.alabel.appendChild(pill); layerEls.alabel.appendChild(t);
});
// cities (dots + labels)
const cityList=Object.entries(C.cities).map(([nm,c])=>({nm,...c})).sort((a,b)=>b.pop-a.pop);
const cityEls=[];
cityList.forEach(c=>{
  const cap=c.nm==="Paris";
  const g=el('g',{});
  const dot=el('circle',{cx:c.x,cy:c.y,r:2.4,class:'city'+(cap?' cap':'')});
  const pill=el('rect',{class:'pill city'});
  const lab=el('text',{x:c.x+3.2,y:c.y+0.8,class:'clabel'}); lab.textContent=c.nm; lab.dataset.base=cap?10:8.6;
  g.appendChild(dot); g.appendChild(pill); g.appendChild(lab); layerEls.city.appendChild(g);
  cityEls.push({c,g,dot,lab,pill,cap});
});

/* ---------- viewBox + scaling ---------- */
function setVB(v){view=v; svg.setAttribute('viewBox',`${v.x} ${v.y} ${v.w} ${v.h}`); rescale();}
function clampF(x,lo,hi){return Math.max(lo,Math.min(hi,x));}
let lastK=-1;
function rescale(force){
  const k=view.w/FULL.w;
  if(!force && k===lastK) return;   // pure pan: sizes/labels unchanged, skip the heavy work
  lastK=k;
  const f=clampF(k,0.32,1);
  // region labels
  layerEls.rlab.querySelectorAll('text').forEach(t=>{ t.setAttribute('font-size',(+t.dataset.base)*f); });
  // neighbour labels
  layerEls.nbl.querySelectorAll('text').forEach(t=>t.setAttribute('font-size',13*f));
  // autoroute labels + stroke
  layerEls.alabel.querySelectorAll('text').forEach(t=>t.setAttribute('font-size',(+t.dataset.base)*f));
  layerEls.aroute.querySelectorAll('path').forEach(p=>p.setAttribute('stroke-width',1.1*f));
  // cities: show top-N by zoom
  const N=Math.round(clampF(7/k,7,46));
  cityEls.forEach((ce,i)=>{ const on=vis.cities && i<N; ce.g.style.display=on?'':'none';
    ce.dot.setAttribute('r',(ce.cap?3:2.2)*f); ce.lab.setAttribute('font-size',(+ce.lab.dataset.base)*f); });
  // towns
  layerEls.town.querySelectorAll('circle.town').forEach(c=>{const b=c.dataset.big==='1'?2.6:1.9; c.setAttribute('r',b*f); c.setAttribute('stroke-width',1.4*f);});
  layerEls.town.querySelectorAll('text').forEach(t=>t.setAttribute('font-size',(+t.dataset.base)*f));
  declutter();
  fitPills();
}
/* size a rounded background pill behind every visible label (via getBBox) */
function fitPills(){
  const groups=[layerEls.rlab,layerEls.city,layerEls.town,layerEls.alabel];
  groups.forEach(layer=>{
    layer.querySelectorAll('text').forEach(t=>{
      const pill=t.previousElementSibling;
      if(!pill||pill.tagName.toLowerCase()!=='rect') return;
      const par=t.parentNode;
      if(t.style.display==='none' || (par&&par.style&&par.style.display==='none')){ pill.style.display='none'; return; }
      let bb; try{ bb=t.getBBox(); }catch(e){ pill.style.display='none'; return; }
      if(!bb.width){ pill.style.display='none'; return; }
      pill.style.display='';
      const fs=+t.getAttribute('font-size')||(+t.dataset.base||9);
      const px=fs*0.45, py=fs*0.30, h=bb.height+2*py;
      pill.setAttribute('x',(bb.x-px).toFixed(1));
      pill.setAttribute('y',(bb.y-py).toFixed(1));
      pill.setAttribute('width',(bb.width+2*px).toFixed(1));
      pill.setAttribute('height',h.toFixed(1));
      pill.setAttribute('rx',(h/2).toFixed(1));
    });
  });
}
function box(t,f){ const fs=(+ (t.dataset.fs||t.getAttribute('font-size'))); const x=+t.getAttribute('x'),y=+t.getAttribute('y'); const w=t.textContent.length*fs*0.5,h=fs; return {x1:x-fs*0.3,y1:y-h,x2:x+w,y2:y+fs*0.25}; }
function declutter(){
  // per-layer greedy, priority by font-size desc within layer
  [layerEls.city,layerEls.town,layerEls.alabel].forEach(layer=>{
    const labels=[...layer.querySelectorAll('text')].filter(t=>t.parentNode.style.display!=='none');
    labels.forEach(t=>t.style.display='');
    const placed=[];
    labels.forEach(t=>{
      const fs=+t.getAttribute('font-size'); const x=+t.getAttribute('x'),y=+t.getAttribute('y');
      const w=t.textContent.length*fs*0.5,h=fs; const b={x1:x-fs*0.3,y1:y-h,x2:x+w,y2:y+fs*0.25};
      const hit=placed.some(p=>!(b.x2<p.x1||b.x1>p.x2||b.y2<p.y1||b.y1>p.y2));
      if(hit) t.style.display='none'; else placed.push(b);
    });
  });
}

/* ---------- animation ---------- */
let anim=null;
function animateTo(target,ms=620){
  cancelAnimationFrame(anim); const s={...view}, t0=performance.now(), ease=x=>1-Math.pow(1-x,3);
  function step(now){const k=Math.min(1,(now-t0)/ms),e=ease(k);
    setVB({x:s.x+(target.x-s.x)*e,y:s.y+(target.y-s.y)*e,w:s.w+(target.w-s.w)*e,h:s.h+(target.h-s.h)*e});
    if(k<1) anim=requestAnimationFrame(step);}
  anim=requestAnimationFrame(step);
}
function bboxToView(bb,pad=0.16){let[x,y,w,h]=bb;const ar=FULL.w/FULL.h,px=w*pad,py=h*pad;x-=px;y-=py;w+=2*px;h+=2*py;
  if(w/h<ar){const nw=h*ar;x-=(nw-w)/2;w=nw;}else{const nh=w/ar;y-=(nh-h)/2;h=nh;}return{x,y,w,h};}

/* ---------- selection ---------- */
function selectRegion(id){
  selected=id; prodFilter='all'; const r=A.regions[id];
  for(const k in regionEls){regionEls[k].classList.toggle('dim',k!==id);regionEls[k].classList.toggle('sel',k===id);}
  for(const k in rlblEls){const h=(k===id); rlblEls[k].t.style.visibility=h?'hidden':''; rlblEls[k].pill.style.visibility=h?'hidden':'';}
  drawWineRoute(id); drawTowns(r);
  animateTo(bboxToView(r.geo.bbox));
  renderDetail(r);
  document.querySelectorAll('.rrow').forEach(x=>x.classList.toggle('active',x.dataset.id===id));
  const cr=$('crumbRegion'); cr.style.display=''; cr.className='crumb btn'; cr.innerHTML=AL.icon('pin',14)+' '+AL.esc(r.name); cr.style.borderColor=COL[id];
  cr.onclick=()=>{ if(selected) selectRegion(selected); };
  $('legend').style.display='none';
  const ac=document.querySelector('.rrow.active'); if(ac) ac.scrollIntoView({block:'nearest'});
}
function resetView(){
  selected=null; animateTo(FULL); clearAppellation();
  for(const k in regionEls){regionEls[k].classList.remove('dim','sel');}
  for(const k in rlblEls){rlblEls[k].t.style.visibility=''; rlblEls[k].pill.style.visibility='';}
  layerEls.town.innerHTML=''; layerEls.wroute.innerHTML='';
  $('crumbRegion').style.display='none';
  $('dContent').style.display='none'; $('dEmpty').style.display='';
  document.querySelectorAll('.rrow').forEach(x=>x.classList.remove('active'));
  $('legend').style.display='';
}
const CITY_TOWNS=new Set(['Bordeaux','Reims','Épernay','Colmar','Nantes','Angers','Tours','Montpellier','Perpignan','Narbonne','Avignon','Orange','Aix-en-Provence','Nice','Chambéry','Bastia','Ajaccio','Lons-le-Saunier','Mâcon','Beaune','Villefranche-sur-Saône','Cahors','Bergerac','Limoges']);
function drawTowns(r){
  layerEls.town.innerHTML=''; if(!vis.villages) return;
  r.towns.forEach(t=>{const big=CITY_TOWNS.has(t.name);
    const g=el('g',{class:'towng'});
    g.appendChild(el('circle',{cx:t.x,cy:t.y,r:big?2.6:1.9,class:'town'+(big?' big':''),stroke:COL[r.id],'data-big':big?'1':'0'}));
    g.appendChild(el('circle',{cx:t.x,cy:t.y,r:7,class:'thit'}));   // generous click target (skipped by rescale)
    const pill=el('rect',{class:'pill town'});
    const lab=el('text',{x:t.x+3,y:t.y+1,class:'tlabel'}); lab.textContent=t.name; lab.dataset.base=big?9.4:8.2;
    g.appendChild(pill); g.appendChild(lab); layerEls.town.appendChild(g);
    g.addEventListener('click',e=>{e.stopPropagation(); if(moved)return; selectVillage(r.id,t);});
    g.addEventListener('mousemove',e=>AL.tip(e,'Village · '+t.name));
    g.addEventListener('mouseleave',()=>AL.tip(null,false));
  });
  rescale(true);
}
function drawWineRoute(id){
  layerEls.wroute.innerHTML=''; if(!vis.wineRoutes) return;
  const rt=C.wineRoutes[id]; if(!rt||rt.length<2) return;
  layerEls.wroute.appendChild(el('path',{d:"M"+rt.map(p=>p.join(',')).join("L"),class:'wroute',stroke:COL[id]}));
}

/* ---------- detail panel ---------- */
$('dEmptyIc').innerHTML=AL.icon('map',46,1.3);
function inforow(icon,label,val){ if(!val) return '';
  return `<div class="inforow"><div class="ico">${AL.icon(icon,15)}</div><div><div class="lab">${label}</div><div class="val">${AL.esc(val)}</div></div></div>`; }
function renderClimate(r){
  const b=$('bClimate'); let cm=r.climate;
  if(!cm && !r.profile){ b.style.display='none'; return; } b.style.display='';
  $('hClimate').innerHTML=AL.icon('sun',14)+'Climate &amp; terroir';
  $('dProfile').textContent=r.profile||''; $('dProfile').style.display=r.profile?'':'none';
  cm=cm||{};
  const clim=[cm.climateType,cm.latitude?'· '+cm.latitude:''].filter(Boolean).join(' ');
  $('dClimate').innerHTML=
    inforow('sun','Climate',clim)+
    inforow('soil','Soils',cm.soils)+
    inforow('thermo','Growing season',cm.growingSeason)+
    inforow('drop','Rainfall',cm.rainfall)+
    inforow('star','Vintage consistency',cm.vintageConsistency);
}
function renderVisit(r){
  const b=$('bVisit'), v=r.visit;
  if(!v){ b.style.display='none'; return; } b.style.display='';
  $('hVisit').innerHTML=AL.icon('view',14)+'Visiting';
  $('dVisit').innerHTML=
    inforow('cal','Best months',v.bestMonths)+
    inforow('view','Scenery',v.scenery)+
    inforow('train','Getting there',v.accessibility)+
    inforow('pin','Base town',v.baseTown)+
    inforow('house','Visitable density',v.visitableDensity);
}
function renderAppChips(r){
  const geo={}; (r.appellations||[]).forEach(a=>geo[a.name]=a);
  const wrap=$('dApps'); wrap.innerHTML='';
  $('dAppsHint').innerHTML=AL.icon('area',12)+'Click an appellation to outline its area on the map';
  r.subAppellations.forEach(name=>{
    const a=geo[name];
    const c=document.createElement('button'); c.className='app btn'; c.dataset.app=name;
    c.innerHTML=AL.icon('pin',12)+AL.esc(name);
    if(a&&a.poly) c.onclick=()=>showAppellation(r.id,a,c);
    else c.disabled=false, c.onclick=()=>showAppellation(r.id,{name,poly:null},c);
    wrap.appendChild(c);
  });
}
function renderDetail(r){
  $('dEmpty').style.display='none'; const dc=$('dContent'); dc.style.display='flex';
  clearAppellation();
  // region mode: region body visible, sub-view body hidden, kicker plain, region actions on
  $('dbodyRegion').style.display=''; $('dbodyAlt').style.display='none';
  const k=$('dKick'); k.className='k'; k.textContent='Wine region · France'; k.onclick=null;
  $('dBack').style.display='none'; $('snap').style.display=''; $('openHouses').style.display='';
  $('dBar').style.background=COL[r.id];
  $('dName').textContent=r.name; $('dName').style.color=COL[r.id];
  $('dSummary').textContent=r.summary; $('dClass').textContent=r.classification;
  $('dTypes').innerHTML=r.types.map(t=>AL.typeBadge(t)).join('');
  const sc=$('dScore');
  if(sc){ if(r.terroirScore!=null){ sc.style.display='flex';
      sc.innerHTML=`<div class="sb"><div class="l">Terroir &amp; climate</div><div class="v">${r.terroirScore.toFixed(1)}<small>/10</small></div></div>`+
        `<div class="sb"><div class="l">Visit experience</div><div class="v">${(r.visitScore!=null?r.visitScore:0).toFixed(1)}<small>/10</small></div></div>`+
        (r.overallScore!=null?`<div class="sb ov"><div class="l">Overall</div><div class="v">${r.overallScore.toFixed(1)}<small>/10</small></div></div>`:'');
    } else sc.style.display='none'; }
  $('hClass').innerHTML=AL.icon('star',14)+'Classification';
  $('hGrapes').innerHTML=AL.icon('grape',14)+'Principal grapes';
  $('hApps').innerHTML=AL.icon('area',14)+'Key appellations &amp; crus';
  $('dGrapes').innerHTML=r.grapes.slice(0,12).map(g=>`<span class="app">${AL.grapeDot(g)} ${AL.esc(g)}${r.grapeCounts[g]>1?` <span class="muted">·${r.grapeCounts[g]}</span>`:''}</span>`).join('');
  renderClimate(r); renderVisit(r);
  renderAppChips(r);
  // producer filter chips
  const counts={}; r.producers.forEach(p=>{const k=AL.prodTier(p);counts[k]=(counts[k]||0)+1;});
  const labels={all:'All',grand:'Grand Cru',growth:'Classed Growth',premier:'Premier Cru',cru:'Cru',other:'Other'};
  const avail=['all',...['grand','growth','premier','cru','other'].filter(k=>counts[k])];
  const pf=$('dPfilter'); pf.innerHTML='';
  avail.forEach(k=>{const b=document.createElement('button'); b.className='chip'+(prodFilter===k?' on':'');
    b.textContent=labels[k]+(k==='all'?` (${r.producers.length})`:` (${counts[k]})`);
    b.onclick=()=>{prodFilter=k; renderProds(r); pf.querySelectorAll('.chip').forEach(x=>x.classList.toggle('on',x===b));};
    pf.appendChild(b);});
  renderProds(r);
  $('hProds').innerHTML=AL.icon('bottle',14)+`Major wine houses`;
  $('dbodyRegion').scrollTop=0;
  $('snap').onclick=()=>AL.snapshotRegion(r.id);
  $('openHouses').onclick=()=>location.href='houses.html?region='+r.id;
  const ot=$('openTrips'); const nt=(r.trips||[]).length;
  ot.style.display=nt?'':'none';
  if(nt){ ot.innerHTML=AL.icon('route',14)+` ${nt} wine trip${nt>1?'s':''}`; ot.onclick=()=>location.href='trips.html?region='+r.id; }
}
function emphasizeVillage(name){
  const r=A.regions[selected]; if(!r) return;
  const t=r.towns.find(x=>x.name===name||x.commune===name); if(!t) return;
  animateTo(bboxToView([t.x-30,t.y-22,60,44]));
  const ring=el('circle',{cx:t.x,cy:t.y,r:2,fill:'none',stroke:COL[selected],'stroke-width':2});
  layerEls.town.appendChild(ring);
  let s=2; const grow=()=>{ s+=0.7; ring.setAttribute('r',s); ring.setAttribute('opacity',Math.max(0,1-(s-2)/14)); if(s<16) requestAnimationFrame(grow); else ring.remove(); };
  requestAnimationFrame(grow);
}

/* ---------- appellation areas (click a chip → outline its area on the map) ---------- */
function darken(hex,f=0.6){ const [r,g,b]=hx(hex); return `rgb(${Math.round(r*f)},${Math.round(g*f)},${Math.round(b*f)})`; }
function clearAppellation(){ layerEls.appArea.innerHTML=''; selApp=null;
  document.querySelectorAll('#dApps .app.btn.on').forEach(c=>{c.classList.remove('on');c.style.background='';}); }
function showAppellation(rid, app, chip){
  // toggle off if the same chip is clicked again
  if(selApp===app.name){ clearAppellation(); animateTo(bboxToView(A.regions[rid].geo.bbox)); return; }
  clearAppellation(); selApp=app.name;
  if(chip){ chip.classList.add('on'); chip.style.background=COL[rid]; }
  if(!app.poly||!app.bbox){ return; }   // no geometry → just mark the chip
  const col=COL[rid];
  const poly=el('polygon',{ points:app.poly.map(p=>p.join(',')).join(' '), class:'appArea',
    fill:col, 'fill-opacity':0.32, stroke:darken(col,0.55), 'stroke-opacity':0.95 });
  layerEls.appArea.appendChild(poly);
  requestAnimationFrame(()=>poly.style.opacity=1);   // CSS fade-in
  const d=Math.max(app.bbox[2],app.bbox[3]), fs=Math.max(2.6,Math.min(4.6,d/6));
  const lab=el('text',{x:app.c[0],y:app.c[1]+fs*0.34,class:'appLabel',stroke:darken(col,0.5),'font-size':fs});
  lab.textContent=app.name; layerEls.appArea.appendChild(lab);
  animateTo(bboxToView(app.bbox,0.55));
}

/* one clickable house row (opens the house detail view) */
function prodEl(p, regionId){
  const b=AL.classBadge(p.classification); const d=document.createElement('div'); d.className='prod';
  d.innerHTML=`<div class="pn">${AL.esc(p.name)}${b?`<span class="badge ${b[0]}">${AL.esc(b[1])}</span>`:''}<span class="go">${AL.icon('chevR',15)}</span></div>`+
    `<div class="pa">${AL.esc(p.appellation||'')}</div>`+
    `<div class="pg">${(p.types||[]).map(t=>AL.typeDot(t)+t).join('  ')} ${p.grapes&&p.grapes.length?'· '+AL.esc(p.grapes.join(', ')):''}</div>`+
    (p.note?`<div class="pnote">${AL.esc(p.note)}</div>`:'');
  d.onclick=()=>renderHouseDetail(regionId,p);
  return d;
}
function renderProds(r,highlight){
  const box=$('dProds'); box.innerHTML='';
  const list=r.producers.filter(p=>prodFilter==='all'||AL.prodTier(p)===prodFilter);
  $('hProds').innerHTML=AL.icon('bottle',14)+`Major wine houses · ${list.length}`;
  list.forEach(p=>{const d=prodEl(p,r.id);
    if(highlight&&p.name===highlight){d.style.background='#fff6e0';}
    box.appendChild(d);});
  if(highlight){const h=[...box.children].find(c=>c.textContent.includes(highlight)); if(h)h.scrollIntoView({block:'center'});}
}

/* ---------- village & house detail views (right panel) ---------- */
function regionTag(regionId,label){ return `<span class="dtag" style="background:${COL[regionId]}">${AL.esc(label)}</span>`; }
function setKickBack(regionId){ const k=$('dKick'); k.className='k back';
  k.innerHTML=AL.icon('chevL',12)+'Back to '+AL.esc(A.regions[regionId].name); k.onclick=()=>selectRegion(regionId); }
function housesInVillage(r,t){
  const full=AL.norm(t.name), key=full.split(/[\s-]/)[0], cm=AL.norm(t.commune||'');
  return r.producers.filter(p=>{const ap=AL.norm(p.appellation||''),nm=AL.norm(p.name||'');
    return (full&&(ap.includes(full)||nm.includes(full)))||(key.length>3&&ap.includes(key))||(cm&&cm.length>3&&ap.includes(cm));});
}
function selectVillage(regionId,t){
  if(selected!==regionId) selectRegion(regionId);
  animateTo(bboxToView([t.x-26,t.y-20,52,40]));
  const ring=el('circle',{cx:t.x,cy:t.y,r:2,fill:'none',stroke:COL[regionId],'stroke-width':2}); layerEls.town.appendChild(ring);
  let s=2; const grow=()=>{s+=0.7;ring.setAttribute('r',s);ring.setAttribute('opacity',Math.max(0,1-(s-2)/14));if(s<16)requestAnimationFrame(grow);else ring.remove();}; requestAnimationFrame(grow);
  renderVillageDetail(regionId,t);
}
function subView(regionId){
  clearAppellation();
  $('dEmpty').style.display='none'; $('dContent').style.display='flex';
  $('dBar').style.background=COL[regionId]; setKickBack(regionId);
  $('dName').style.color=COL[regionId]; $('dScore').style.display='none';
  $('dbodyRegion').style.display='none'; const alt=$('dbodyAlt'); alt.style.display=''; alt.scrollTop=0;
  $('dBack').style.display=''; $('dBack').innerHTML='&#x2039; '+AL.esc(A.regions[regionId].name); $('dBack').onclick=()=>selectRegion(regionId);
  $('snap').style.display='none'; $('openTrips').style.display='none'; $('openHouses').style.display='';
  return alt;
}
function renderVillageDetail(regionId,t){
  const r=A.regions[regionId]; const alt=subView(regionId);
  $('dName').textContent=t.name;
  const hasCom=t.commune&&AL.norm(t.commune)!==AL.norm(t.name);
  $('dSummary').innerHTML=regionTag(regionId,'Village')+(hasCom?'Commune of '+AL.esc(t.commune)+' · ':'')+AL.esc(r.name)+', France';
  $('dTypes').innerHTML='';
  const houses=housesInVillage(r,t);
  alt.innerHTML='';
  const b1=document.createElement('div'); b1.className='block';
  b1.innerHTML=`<h3>${AL.icon('pin',14)}Location</h3><div class="classbox">A wine village in ${AL.esc(r.name)}.${hasCom?' Commune: '+AL.esc(t.commune)+'.':''}</div>`;
  alt.appendChild(b1);
  const b2=document.createElement('div'); b2.className='block';
  b2.innerHTML=`<h3>${AL.icon('bottle',14)}Houses here · ${houses.length}</h3>`;
  alt.appendChild(b2);
  if(houses.length) houses.forEach(p=>b2.appendChild(prodEl(p,regionId)));
  else{ const e=document.createElement('div'); e.className='classbox';
    e.innerHTML=`No houses are individually indexed to this village. See all ${r.producers.length} houses in ${AL.esc(r.name)} via “All houses”.`; b2.appendChild(e); }
}
function renderHouseDetail(regionId,p){
  const r=A.regions[regionId]; const alt=subView(regionId);
  $('dName').textContent=p.name;
  $('dSummary').innerHTML=regionTag(regionId,'Wine house')+(p.appellation?AL.esc(p.appellation)+' · ':'')+AL.esc(r.name);
  $('dTypes').innerHTML=(p.types||[]).map(t=>AL.typeBadge(t)).join('');
  const parts=
    (p.classification?`<div class="block"><h3>${AL.icon('star',14)}Classification</h3><div class="classbox">${AL.esc(p.classification)}</div></div>`:'')+
    (p.grapes&&p.grapes.length?`<div class="block"><h3>${AL.icon('grape',14)}Grapes</h3><div class="apps">${p.grapes.map(g=>`<span class="app">${AL.grapeDot(g)} ${AL.esc(g)}</span>`).join('')}</div></div>`:'')+
    (p.flagship?`<div class="block"><h3>${AL.icon('bottle',14)}Flagship cuvée</h3><div class="classbox">${AL.esc(p.flagship)}</div></div>`:'')+
    (p.note?`<div class="block"><h3>${AL.icon('map',14)}Notes</h3><div class="classbox">${AL.esc(p.note)}</div></div>`:'');
  alt.innerHTML=parts||`<div class="block"><div class="classbox">${AL.esc(p.name)} — a wine house in ${AL.esc(r.name)}.</div></div>`;
}

/* ---------- sidebar list + filters ---------- */
let grapeF='all', typeF='all';
// type chips
const tcEl=$('typeF');
tcEl.innerHTML=['all',...AL.TYPE_ORDER].map(t=>`<button class="chip ${t==='all'?'on':''}" data-t="${t}">${t==='all'?'All wines':AL.typeDot(t)+t}</button>`).join('');
tcEl.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{typeF=c.dataset.t;tcEl.querySelectorAll('.chip').forEach(x=>x.classList.toggle('on',x===c));buildList();});
// grape select
const grapes=[...new Set(AL.houses().flatMap(h=>h.grapes||[]))].sort();
$('grapeF').innerHTML='<option value="all">All grapes</option>'+grapes.map(g=>`<option>${AL.esc(g)}</option>`).join('');
$('grapeF').onchange=e=>{grapeF=e.target.value;buildList();};
$('sort').onchange=buildList;

function regionMatches(r){
  if(typeF!=='all'&&!r.types.includes(typeF)) return false;
  if(grapeF!=='all'&&!r.grapes.includes(grapeF)) return false;
  return true;
}
function buildList(){
  const sort=$('sort').value;
  let ids=Object.keys(A.regions).filter(id=>regionMatches(A.regions[id]));
  if(sort==='north') ids.sort((a,b)=>A.regions[a].geo.centroid[1]-A.regions[b].geo.centroid[1]);
  if(sort==='az') ids.sort((a,b)=>A.regions[a].name.localeCompare(A.regions[b].name));
  if(sort==='houses') ids.sort((a,b)=>A.regions[b].producers.length-A.regions[a].producers.length);
  if(sort==='terroir') ids.sort((a,b)=>(A.regions[b].terroirScore||0)-(A.regions[a].terroirScore||0));
  // dim non-matching regions on map
  const matchSet=new Set(ids);
  for(const k in regionEls){ if(!selected) regionEls[k].classList.toggle('dim', !(typeF==='all'&&grapeF==='all') && !matchSet.has(k)); }
  const list=$('list'); list.innerHTML='';
  ids.forEach(id=>{const r=A.regions[id];
    const d=document.createElement('div'); d.className='rrow'+(selected===id?' active':''); d.dataset.id=id;
    d.innerHTML=`<span class="sw" style="background:${COL[id]}"></span>`+
      `<div style="min-width:0"><div class="nm">${AL.esc(r.name)}</div><div class="mt">${r.types.map(t=>AL.typeDot(t)).join('')} ${r.towns.length} villages</div></div>`+
      `<span class="ct">${r.producers.length}</span>`;
    d.onclick=()=>selectRegion(id);
    d.onmouseenter=()=>{ if(!selected) regionEls[id].style.filter='brightness(1.12)'; AL.tip(event,r.name); };
    d.onmouseleave=()=>{ regionEls[id].style.filter=''; AL.tip(null,false); };
    list.appendChild(d);});
  if(!ids.length) list.innerHTML='<div class="empty ui" style="padding:30px;font-size:13px">No regions match those filters.</div>';
}

/* ---------- search ---------- */
const INDEX=[];
for(const id in A.regions){const r=A.regions[id];
  INDEX.push({type:'Region',label:r.name,region:id,icon:'grid'});
  r.subAppellations.forEach(a=>INDEX.push({type:'Appellation',label:a,region:id,sub:r.name,icon:'pin'}));
  r.grapes.forEach(g=>INDEX.push({type:'Grape',label:g,region:id,sub:r.name,icon:'grape'}));
  r.towns.forEach(t=>INDEX.push({type:'Village',label:t.name,region:id,sub:r.name,icon:'pin'}));
  r.producers.forEach(p=>INDEX.push({type:'House',label:p.name,region:id,sub:p.appellation||r.name,prod:p.name,icon:'bottle'}));
}
Object.entries(C.cities).forEach(([nm,c])=>INDEX.push({type:'City',label:nm,city:c,icon:'city'}));
const searchBox=$('search');
searchBox.addEventListener('input',()=>{
  const q=searchBox.value.trim(); const list=$('list');
  if(!q){buildList();return;}
  const nq=AL.norm(q);
  const hits=INDEX.filter(i=>AL.norm(i.label).includes(nq));
  // dedupe grapes/appellations by label+region
  const seen=new Set(), uniq=[];
  for(const h of hits){const key=h.type+h.label+(h.region||'');if(seen.has(key))continue;seen.add(key);uniq.push(h);}
  const groups={Region:[],Grape:[],Appellation:[],House:[],Village:[],City:[]};
  uniq.slice(0,80).forEach(h=>groups[h.type].push(h));
  list.innerHTML=''; const wrap=document.createElement('div'); wrap.className='results'; let any=false;
  ['Region','Grape','Appellation','House','Village','City'].forEach(t=>{
    if(!groups[t].length)return; any=true;
    const gh=document.createElement('div'); gh.className='rgroup'; gh.innerHTML=AL.icon(groups[t][0].icon,13)+(t==='City'?'Cities (map)':t+'s'); wrap.appendChild(gh);
    groups[t].forEach(h=>{const it=document.createElement('div'); it.className='ritem';
      const hl=AL.esc(h.label).replace(new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig'),'<mark>$1</mark>');
      it.innerHTML=`<div>${hl}</div>`+(h.sub?`<div class="sm">${AL.esc(h.sub)}</div>`:'');
      it.onclick=()=>{ searchBox.value='';
        if(h.city){ animateTo(bboxToView([h.city.x-40,h.city.y-30,80,60])); return; }
        buildList(); selectRegion(h.region); if(h.prod) setTimeout(()=>renderProds(A.regions[h.region],h.prod),660); };
      wrap.appendChild(it);});
  });
  if(!any) wrap.innerHTML='<div class="rgroup">No matches</div>';
  list.appendChild(wrap);
});

/* ---------- layers control ---------- */
const layerDefs=[['wineRoutes','Wine routes','wroute'],['autoroutes','Autoroutes','aroute'],['cities','Cities','city'],['villages','Villages','town'],['neighbours','Neighbours','nb']];
$('layersBox').innerHTML=`<div class="lh">${AL.icon('layers',13)}Map layers</div>`+
  layerDefs.map(l=>`<label><input type="checkbox" data-l="${l[0]}" ${vis[l[0]]?'checked':''}> ${l[1]}</label>`).join('')+
  `<div class="lh div">${AL.icon('grape',13)}Colour by</div>`+
  `<label><input type="checkbox" data-l="geology" ${vis.geology?'checked':''}> Geology · terroir</label>`;
$('layersBox').querySelectorAll('input').forEach(c=>c.onchange=()=>{
  vis[c.dataset.l]=c.checked; applyLayers();
});
// build the terroir colour legend once
$('geoLegend').innerHTML=`<b>Terroir &amp; climate</b><div class="bar" style="background:linear-gradient(90deg,${terroirColor(TMIN)},${terroirColor(TMAX)})"></div>`+
  `<div class="ends"><span>${TMIN.toFixed(1)}</span><span>${TMAX.toFixed(1)}</span></div>`;
function applyGeology(){
  for(const id in regionEls) regionEls[id].setAttribute('fill', vis.geology?terroirColor(A.regions[id].terroirScore):COL[id]);
  $('geoLegend').style.display=vis.geology?'block':'none';
}
function applyLayers(){
  layerEls.wroute.style.display=vis.wineRoutes?'':'none';
  layerEls.aroute.style.display=vis.autoroutes?'':'none'; layerEls.alabel.style.display=vis.autoroutes?'':'none';
  layerEls.city.style.display=vis.cities?'':'none';
  layerEls.town.style.display=vis.villages?'':'none';
  layerEls.nb.style.display=vis.neighbours?'':'none'; layerEls.nbl.style.display=vis.neighbours?'':'none';
  if(selected){ drawWineRoute(selected); drawTowns(A.regions[selected]); }
  applyGeology();
  rescale(true);
}

/* ---------- pan & zoom ---------- */
function clientToSvg(cx,cy){const r=svg.getBoundingClientRect();return{x:view.x+(cx-r.left)/r.width*view.w,y:view.y+(cy-r.top)/r.height*view.h};}
svg.addEventListener('wheel',e=>{e.preventDefault();cancelAnimationFrame(anim);
  const f=e.deltaY<0?0.85:1/0.85, p=clientToSvg(e.clientX,e.clientY);
  let nw=clampF(view.w*f,FULL.w*0.03,FULL.w*1.12), nh=nw*(FULL.h/FULL.w);
  setVB({x:p.x-(p.x-view.x)*(nw/view.w),y:p.y-(p.y-view.y)*(nh/view.h),w:nw,h:nh});
},{passive:false});
/* drag-to-pan. NB: no setPointerCapture — it would steal the click event from the
   region <path>, which was the "clicking a region does nothing" bug. Instead we
   track movement and suppress the click that follows a real drag. */
let drag=null, moved=false;
svg.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,vx:view.x,vy:view.y};moved=false;svg.classList.add('grabbing');});
svg.addEventListener('pointermove',e=>{if(!drag)return;const r=svg.getBoundingClientRect();
  if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4) moved=true;
  setVB({...view,x:drag.vx-(e.clientX-drag.x)/r.width*view.w,y:drag.vy-(e.clientY-drag.y)/r.height*view.h});});
svg.addEventListener('pointerup',()=>{drag=null;svg.classList.remove('grabbing');});
svg.addEventListener('pointerleave',()=>{drag=null;svg.classList.remove('grabbing');});
function zoomBtn(f){const cx=view.x+view.w/2,cy=view.y+view.h/2;let nw=clampF(view.w*f,FULL.w*0.03,FULL.w*1.12),nh=nw*(FULL.h/FULL.w);animateTo({x:cx-nw/2,y:cy-nh/2,w:nw,h:nh},300);}
$('zin').onclick=()=>zoomBtn(0.7); $('zout').onclick=()=>zoomBtn(1/0.7); $('zreset').onclick=resetView;
$('crumbHome').onclick=resetView;
window.addEventListener('keydown',e=>{if(e.key==='Escape')resetView();});

/* ---------- collapsible sidebars ---------- */
const layout=$('layout');
$('hideL').onclick=()=>layout.classList.add('lcol'); $('showL').onclick=()=>layout.classList.remove('lcol');
$('hideR').onclick=()=>layout.classList.add('rcol'); $('showR').onclick=()=>layout.classList.remove('rcol');

/* ---------- init + deep link ---------- */
AL.renderNav('index.html');
applyLayers(); buildList(); setVB(FULL);
const params=new URLSearchParams(location.search);
const rp=params.get('region');
if(rp&&A.regions[rp]){
  selectRegion(rp);
  const hp=params.get('house'); if(hp) setTimeout(()=>renderProds(A.regions[rp],hp),700);
  const vp=params.get('village'); if(vp) setTimeout(()=>emphasizeVillage(vp),760);
}
})();
