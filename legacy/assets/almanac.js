/* ============================================================
   Frank's Wine Almanac — shared helpers (window.AL)
   Depends on window.ALMANAC (assets/almanac-data.js)
   ============================================================ */
(function(){
const A = window.ALMANAC;
const AL = window.AL = {};
AL.data = A;

AL.COLORS = {
  bordeaux:"#7b2d3b", sudouest:"#9c5a3c", bourgogne:"#8a3324", beaujolais:"#b4532f",
  champagne:"#c6a15b", rhone:"#6d4076", loire:"#4f7a6a", alsace:"#3f7d8c",
  languedoc:"#a8443f", provence:"#c06b8a", jura:"#7d8a4a", savoie:"#4a6a9c", corse:"#5c8a4a"
};
AL.TYPE_ORDER = ["Red","White","Rosé","Sparkling","Sweet","Fortified"];
AL.TYPE_COLORS = {Red:"#7b2d3b", White:"#cda84e", "Rosé":"#e09bb0", Sparkling:"#c9a24b", Sweet:"#c4822f", Fortified:"#5a2d4a"};

AL.esc = s => String(s==null?"":s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
AL.norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');

/* ---- inline SVG icon set (24x24, stroke = currentColor) ---- */
const ICON = {
  map:'<path d="M9 4 3 6v15l6-2 6 2 6-2V3l-6 2-6-2z"/><path d="M9 4v15M15 5v15"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  house:'<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  bottle:'<path d="M10 2h4"/><path d="M10.5 2v3.5L9 9v11a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V9l-1.5-3.5V2"/><path d="M9 12h6"/>',
  pin:'<path d="M12 21s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12z"/><circle cx="12" cy="9" r="2.4"/>',
  city:'<path d="M3 21V8l6-3v4l6-3v15"/><path d="M15 9l6 3v9"/><path d="M3 21h18"/>',
  grape:'<circle cx="9" cy="13" r="2.1"/><circle cx="13" cy="13" r="2.1"/><circle cx="11" cy="16.5" r="2.1"/><circle cx="11" cy="9.4" r="2.1"/><path d="M11 7V3M11 3c2 0 3-1 4-2"/>',
  star:'<path d="m12 3 2.6 5.6 6 .7-4.4 4.1 1.2 6L12 16.9 6.6 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  route:'<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 18h6a3 3 0 0 0 0-6H10a3 3 0 0 1 0-6h4"/>',
  cal:'<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>',
  chartL:'<path d="M3 3v18h18"/><rect x="6" y="11" width="3" height="7"/><rect x="11" y="7" width="3" height="11"/><rect x="16" y="13" width="3" height="5"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
  chevL:'<path d="m15 6-6 6 6 6"/>', chevR:'<path d="m9 6 6 6-6 6"/>',
  share:'<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="m8.3 10.7 7.4-4.4M8.3 13.3l7.4 4.4"/>',
  download:'<path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 21h14"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  drop:'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  soil:'<path d="M3 8h18M3 8l2-3h14l2 3M4 8v11h16V8"/><path d="M8 12h.01M13 12h.01M10 16h.01M16 16h.01"/>',
  thermo:'<path d="M12 14V4a2 2 0 0 1 4 0v10a4 4 0 1 1-4 0z"/>',
  train:'<rect x="5" y="3" width="14" height="13" rx="2.5"/><path d="M5 11h14M9 3v8M15 3v8M8 20l-2 2M16 20l2 2"/><circle cx="8.5" cy="13.5" r="1"/><circle cx="15.5" cy="13.5" r="1"/>',
  view:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  area:'<path d="M4 7l8-3 8 3-8 3-8-3z"/><path d="M4 7v8l8 3 8-3V7"/>'
};
AL.icon = (name, size=16, sw=1.7) =>
  `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICON[name]||''}</svg>`;

/* ---- classification badge ---- */
AL.classBadge = cls => {
  if(!cls) return null; const c=cls.toLowerCase();
  if(c.includes('first growth')||c.includes('premier cru supérieur')||c.includes('classé a')) return ['b-first','1er / Growth'];
  if(c.includes('grand cru')) return ['b-grand','Grand Cru'];
  if(c.includes('premier cru')) return ['b-premier','Premier Cru'];
  if(c.includes('growth')) return ['b-growth', cls.replace('1855 ','')];
  if(c.includes('grande marque')) return ['b-marque','Grande Marque'];
  if(c.includes('grower')) return ['b-grower','Grower'];
  if(c.includes('cru')) return ['b-cru', c.includes('beaujolais')?'Cru':cls];
  return null;
};
AL.prodTier = p => { const c=(p.classification||'').toLowerCase();
  if(c.includes('grand cru')||c.includes('classé a')) return 'grand';
  if(c.includes('growth')||c.includes('premier cru supérieur')) return 'growth';
  if(c.includes('premier cru')) return 'premier';
  if(c.includes('cru')) return 'cru'; return 'other'; };

/* grape colour classification */
AL.GRAPE_RED = new Set(["Cabernet Sauvignon","Merlot","Cabernet Franc","Petit Verdot","Malbec","Tannat","Négrette","Fer Servadou","Pinot Noir","Gamay","Syrah","Grenache","Mourvèdre","Cinsault","Carignan","Nielluccio","Sciaccarello","Carcaghjolu Neru","Barbarossa","Braucol","Duras","Prunelart","Poulsard","Trousseau","Mondeuse","Folle Noire","Braquet","Aleatico","Pinot Meunier"]);
AL.grapeColor = g => AL.GRAPE_RED.has(g) ? "Red grape" : "White grape";
AL.grapeDot = g => `<span class="dot" style="background:${AL.GRAPE_RED.has(g)?'#7b2d3b':'#cda84e'}"></span>`;

AL.typeBadge = t => `<span class="tbadge" style="background:${AL.TYPE_COLORS[t]||'#888'}">${AL.esc(t)}</span>`;
AL.typeDot = t => `<span class="dot" style="background:${AL.TYPE_COLORS[t]||'#888'}"></span>`;

/* ---- flat houses list ---- */
AL.houses = () => {
  const out=[];
  for(const id in A.regions){ const r=A.regions[id];
    r.producers.forEach(p=>out.push({...p, region:r.name, regionId:id}));
  }
  return out;
};
AL.villages = () => {
  const out=[];
  for(const id in A.regions){ const r=A.regions[id];
    r.towns.forEach(t=>out.push({name:t.name, commune:t.commune, region:r.name, regionId:id, x:t.x, y:t.y}));
  }
  return out;
};
AL.regionsArr = () => Object.keys(A.regions).map(id=>({id, ...A.regions[id]}));

/* ---- top nav ---- */
AL.renderNav = (active) => {
  const links=[
    ['index.html','map','Map'],
    ['regions.html','grid','Regions'],
    ['houses.html','bottle','Houses'],
    ['grapes.html','grape','Grapes'],
    ['villages.html','pin','Villages'],
    ['best-regions.html','chartL','Best Regions'],
    ['trips.html','route','Wine Trips'],
  ];
  const nh=AL.houses().length, nv=AL.villages().length, nr=Object.keys(A.regions).length;
  const html=`<nav class="nav">
    <a class="logo" href="index.html" style="color:inherit">
      <span class="glass">${AL.icon('bottle',20,1.6)}</span>
      <b>Frank's</b> Wine <span style="color:var(--gold-soft)">Almanac</span>
    </a>
    <div class="links">${links.map(l=>{
      const soon=l[3]?' soon':''; const act=(active===l[0])?' active':'';
      return `<a class="${act}${soon}" href="${l[3]?'#':l[0]}"${l[3]?' onclick="return false"':''}>${AL.icon(l[1],15)}${l[2]}</a>`;
    }).join('')}</div>
    <span class="spacer"></span>
    <span class="count ui">${nr} regions · ${nh} houses · ${nv} villages</span>
  </nav>`;
  document.getElementById('nav').outerHTML = html;
};

/* ---- tooltip helper ---- */
let tipEl=null;
AL.tip = (e,txt)=>{ if(!tipEl){tipEl=document.createElement('div');tipEl.className='tip ui';document.body.appendChild(tipEl);}
  if(txt===false){tipEl.style.opacity=0;return;} tipEl.textContent=txt; tipEl.style.left=e.clientX+'px'; tipEl.style.top=e.clientY+'px'; tipEl.style.opacity=1; };

/* ---- snapshot export: build a self-contained mobile HTML for one region ---- */
AL.snapshotRegion = (id) => {
  const r=A.regions[id]; const col=AL.COLORS[id];
  // mini map svg (region path + towns) using region bbox
  const bb=r.geo.bbox, pad=Math.max(bb[2],bb[3])*0.12;
  const vb=`${bb[0]-pad} ${bb[1]-pad} ${bb[2]+2*pad} ${bb[3]+2*pad}`;
  const S=Math.max(bb[2],bb[3]), fs=S/55, rr=S/150, gap=S/200;
  // greedy label declutter: dots always; labels only if non-colliding
  const placed=[];
  const towns=r.towns.map(t=>{
    const dot=`<circle cx="${t.x}" cy="${t.y}" r="${rr}" fill="#fff" stroke="${col}" stroke-width="${S/360}"/>`;
    const w=t.name.length*fs*0.5, h=fs;
    const b={x1:t.x,y1:t.y-h,x2:t.x+w+gap,y2:t.y+fs*0.3};
    const hit=placed.some(p=>!(b.x2<p.x1||b.x1>p.x2||b.y2<p.y1||b.y1>p.y2));
    let lab='';
    if(!hit){ placed.push(b); lab=`<text x="${t.x+gap}" y="${t.y+fs*0.32}" font-size="${fs}" fill="#3a2417">${AL.esc(t.name)}</text>`; }
    return dot+lab;
  }).join('');
  const prods=r.producers.map(p=>{const b=AL.classBadge(p.classification);
    return `<div class="p"><div class="pn">${AL.esc(p.name)} ${b?`<span class="bd">${AL.esc(b[1])}</span>`:''}</div>
      <div class="pa">${AL.esc(p.appellation||'')} · ${(p.types||[]).join(', ')}</div>
      <div class="pg">${(p.grapes||[]).join(' · ')}</div>
      ${p.note?`<div class="pnote">${AL.esc(p.note)}</div>`:''}</div>`;}).join('');
  const html=`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${AL.esc(r.name)} — Frank's Wine Almanac</title>
<style>
:root{--c:${col}}
*{box-sizing:border-box} body{margin:0;font-family:Georgia,'Times New Roman',serif;color:#241a17;background:#f6f1e7;line-height:1.5}
header{background:linear-gradient(100deg,#5a1622,${col});color:#f7ecd9;padding:18px 18px 16px;border-bottom:3px solid #b8893b}
header .k{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#e7c98e;font-family:system-ui,sans-serif}
header h1{margin:3px 0 0;font-size:26px}
.wrap{padding:16px 18px 40px;max-width:760px;margin:0 auto}
.map{background:#efe7d8;border:1px solid #d9cdb8;border-radius:12px;margin:14px 0;overflow:hidden}
.map svg{width:100%;height:auto;display:block}
.sum{font-size:14.5px;color:#5b4f48}
h2{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#b8893b;border-bottom:1px solid #d9cdb8;padding-bottom:5px;margin:22px 0 10px;font-family:system-ui,sans-serif}
.apps span{display:inline-block;font-family:system-ui,sans-serif;font-size:11.5px;background:#efe6d3;border:1px solid #d9cdb8;border-radius:12px;padding:3px 9px;margin:2px}
.p{padding:10px 0;border-bottom:1px solid #ece2cf}
.pn{font-weight:bold;font-size:15px} .bd{font-family:system-ui,sans-serif;font-size:9px;background:var(--c);color:#fff;padding:2px 7px;border-radius:10px;vertical-align:middle;text-transform:uppercase;letter-spacing:.4px}
.pa{font-family:system-ui,sans-serif;font-size:11.5px;color:${col};font-style:italic}
.pg{font-family:system-ui,sans-serif;font-size:11.5px;color:#8a7d72} .pnote{font-size:13px;color:#5b4f48;margin-top:3px}
.foot{margin-top:26px;font-family:system-ui,sans-serif;font-size:11px;color:#8a7d72;text-align:center}
.types span{font-family:system-ui,sans-serif;font-size:11px;color:#fff;border-radius:10px;padding:2px 8px;margin:2px;display:inline-block}
</style></head><body>
<header><div class="k">Wine region · France</div><h1>${AL.esc(r.name)}</h1></header>
<div class="wrap">
  <div class="types">${r.types.map(t=>`<span style="background:${AL.TYPE_COLORS[t]}">${t}</span>`).join('')}</div>
  <div class="map"><svg viewBox="${vb}"><path d="${r.geo.path}" fill="${col}" fill-opacity="0.5" stroke="${col}" stroke-width="${Math.max(bb[2],bb[3])/260}"/>${towns}</svg></div>
  <p class="sum">${AL.esc(r.summary)}</p>
  <h2>Classification</h2><p class="sum" style="font-size:13px">${AL.esc(r.classification)}</p>
  <h2>Key appellations</h2><div class="apps">${r.subAppellations.map(a=>`<span>${AL.esc(a)}</span>`).join('')}</div>
  <h2>Villages · ${r.towns.length}</h2><div class="apps">${r.towns.map(t=>`<span>${AL.esc(t.name)}</span>`).join('')}</div>
  <h2>Wine houses · ${r.producers.length}</h2>${prods}
  <div class="foot">Frank's Wine Almanac · shareable snapshot · ${r.towns.length} villages · ${r.producers.length} houses</div>
</div></body></html>`;
  download(html, `${r.name.replace(/[^a-zA-Z]+/g,'-')}-snapshot.html`);
};

function download(html, name){
  const blob=new Blob([html],{type:'text/html'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}

/* ---- snapshot export: a single wine trip ---- */
AL.snapshotTrip = (regionId, idx) => {
  const r=A.regions[regionId], t=r.trips[idx], col=AL.COLORS[regionId];
  const bb=t.bbox, pad=Math.max(bb[2],bb[3])*0.22||30, S=Math.max(bb[2],bb[3])||60;
  const vb=`${bb[0]-pad} ${bb[1]-pad} ${bb[2]+2*pad} ${bb[3]+2*pad}`;
  const route=t.route&&t.route.length>1?`<path d="M${t.route.map(p=>p.join(',')).join('L')}" fill="none" stroke="${col}" stroke-width="${S/120}" stroke-linecap="round" stroke-dasharray="${S/60} ${S/90}"/>`:'';
  const seen={};
  const marks=t.stops.map((s,i)=>{ if(s.x==null)return''; const k=s.x+','+s.y; const o=(seen[k]=(seen[k]||0)+1)-1; const ox=o*S/35;
    return `<g><circle cx="${s.x+ox}" cy="${s.y}" r="${S/45}" fill="${col}" stroke="#fff" stroke-width="${S/220}"/><text x="${s.x+ox}" y="${s.y+S/95}" font-size="${S/55}" fill="#fff" text-anchor="middle" font-family="sans-serif">${i+1}</text></g>`;}).join('');
  const days=[...new Set(t.stops.map(s=>s.day))].sort();
  const itin=days.map(d=>`<h3>Day ${d}</h3>`+t.stops.map((s,i)=>({s,i})).filter(o=>o.s.day===d).map(o=>
    `<div class="s"><div class="sn">${o.i+1}</div><div><div class="snm">${AL.esc(o.s.name)}</div><div class="st">${AL.esc(o.s.town)} · <em>${AL.esc(o.s.visit)}</em></div>${o.s.note?`<div class="sno">${AL.esc(o.s.note)}</div>`:''}</div></div>`).join('')).join('');
  const html=`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${AL.esc(t.name)} — Frank's Wine Almanac</title><style>
:root{--c:${col}} *{box-sizing:border-box} body{margin:0;font-family:Georgia,serif;color:#241a17;background:#f6f1e7;line-height:1.5}
header{background:linear-gradient(100deg,#5a1622,${col});color:#f7ecd9;padding:18px;border-bottom:3px solid #b8893b}
header .k{font-family:system-ui,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#e7c98e}
header h1{margin:3px 0 6px;font-size:24px} header .m{font-family:system-ui,sans-serif;font-size:12px;color:#f0d9b0}
.wrap{padding:16px 18px 40px;max-width:760px;margin:0 auto}
.map{background:#efe7d8;border:1px solid #d9cdb8;border-radius:12px;margin:14px 0;overflow:hidden}.map svg{width:100%;height:auto;display:block}
.sum{font-size:14px;color:#5b4f48}
h3{font-family:system-ui,sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${col};margin:20px 0 8px}
.s{display:flex;gap:11px;padding:9px 0;border-bottom:1px solid #ece2cf}
.sn{flex:none;width:24px;height:24px;border-radius:50%;background:${col};color:#fff;font-family:system-ui,sans-serif;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center}
.snm{font-weight:bold;font-size:15px}.st{font-family:system-ui,sans-serif;font-size:12px;color:#5b4f48}.sno{font-size:13px;color:#5b4f48;margin-top:2px}
.foot{margin-top:24px;font-family:system-ui,sans-serif;font-size:11px;color:#8a7d72;text-align:center}
</style></head><body>
<header><div class="k">Wine trip · ${AL.esc(r.name)}</div><h1>${AL.esc(t.name)}</h1>
<div class="m">${t.days} day${t.days>1?'s':''} · based in ${AL.esc(t.basedIn)} · best ${AL.esc(t.bestSeason)} · ${AL.esc(t.driving)}</div></header>
<div class="wrap">
<div class="map"><svg viewBox="${vb}"><path d="${r.geo.path}" fill="${col}" fill-opacity="0.12" stroke="${col}" stroke-opacity="0.4" stroke-width="${S/240}"/>${route}${marks}</svg></div>
<p class="sum">${AL.esc(t.summary)}</p>
${itin}
<div class="foot">Frank's Wine Almanac · ${t.stops.length} stops · only estates that receive visitors · always confirm opening hours before travelling</div>
</div></body></html>`;
  download(html, `${t.name.replace(/[^a-zA-Z0-9]+/g,'-')}-trip.html`);
};
})();
