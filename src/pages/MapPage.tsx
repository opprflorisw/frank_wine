import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Badge, TypeBadge, TypeDot, Icon, GrapePill } from "../lib/ui";
import { openChat } from "../lib/chat";
import { FavButton } from "../lib/favorites";

type View = { x: number; y: number; w: number; h: number };
type House = {
  _id: string; name: string; appellation?: string; classification?: string; note?: string;
  types?: string[]; grapes?: string[]; flagship?: string; x?: number; y?: number;
  address?: string; town?: string;
};
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export default function MapPage() {
  const data = useQuery(api.wine.mapData);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [vis, setVis] = useState({ wineRoutes: true, autoroutes: true, cities: true, villages: true, houses: true, neighbours: true });
  const [layersOpen, setLayersOpen] = useState(false);
  const [house, setHouse] = useState<House | null>(null);   // selected wine house (pin / row)
  const [introOpen, setIntroOpen] = useState(true);          // collapsible region intro
  const [sheetMin, setSheetMin] = useState(false);           // minimise sheet to see the map (mobile)
  const svgRef = useRef<SVGSVGElement>(null);
  const anim = useRef<number | null>(null);

  const FULL: View = useMemo(() => {
    const vb = data?.context?.viewBox ?? [0, 0, 1040, 1005];
    return { x: 0, y: 0, w: vb[2], h: vb[3] };
  }, [data]);
  const [view, setView] = useState<View>(FULL);
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => { setView(FULL); }, [FULL]);

  // selection driven by the URL → browser back/forward works
  const selected = useMemo(() => {
    const rp = params.get("region");
    return rp && data?.regions.some((r) => r.slug === rp) ? rp : null;
  }, [params, data]);
  const sel = data?.regions.find((r) => r.slug === selected) || null;
  const detail = useQuery(api.wine.getRegion, selected ? { slug: selected } : "skip");

  // reset sub-state whenever the region changes
  useEffect(() => { setHouse(null); setSheetMin(false); setIntroOpen(true); }, [selected]);

  function setRegionParam(slug: string | null) {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (slug) p.set("region", slug); else p.delete("region");
      return p;
    });
  }

  const prevSel = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!data) return;
    if (prevSel.current === selected) return;
    prevSel.current = selected;
    if (selected) { const r = data.regions.find((x) => x.slug === selected); if (r) animateTo(bboxToView(r.bbox)); }
    else animateTo(FULL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, data]);

  function animateTo(target: View, ms = 560) {
    if (anim.current) cancelAnimationFrame(anim.current);
    const s = { ...viewRef.current }, t0 = performance.now(), ease = (x: number) => 1 - Math.pow(1 - x, 3);
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms), e = ease(k);
      setView({ x: s.x + (target.x - s.x) * e, y: s.y + (target.y - s.y) * e, w: s.w + (target.w - s.w) * e, h: s.h + (target.h - s.h) * e });
      if (k < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  }
  function bboxToView(bb: number[], pad = 0.16): View {
    let [x, y, w, h] = bb;
    const ar = FULL.w / FULL.h, px = w * pad, py = h * pad;
    x -= px; y -= py; w += 2 * px; h += 2 * py;
    if (w / h < ar) { const nw = h * ar; x -= (nw - w) / 2; w = nw; } else { const nh = w / ar; y -= (nh - h) / 2; h = nh; }
    return { x, y, w, h };
  }
  function selectRegion(slug: string) { setRegionParam(slug); }
  function reset() { setRegionParam(null); }
  function selectHouse(h: House) {
    setHouse(h); setSheetMin(false);
    if (h.x != null && h.y != null) animateTo({ x: h.x - FULL.w * 0.07, y: h.y - FULL.h * 0.07, w: FULL.w * 0.14, h: FULL.h * 0.14 }, 420);
  }

  // ---------- pointer pan + pinch zoom ----------
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gesture = useRef<{ startView: View; pinch: boolean; startX: number; startY: number; startDist: number; midSvg: { x: number; y: number }; moved: boolean } | null>(null);
  const movedRef = useRef(false);
  const lastTap = useRef<{ t: number; x: number; y: number }>({ t: 0, x: 0, y: 0 });
  const suppressClick = useRef(false);
  const MINW = () => FULL.w * 0.02, MAXW = () => FULL.w * 1.2;

  function toSvg(v: View, cx: number, cy: number) {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: v.x + ((cx - rect.left) / rect.width) * v.w, y: v.y + ((cy - rect.top) / rect.height) * v.h };
  }
  function syncGesture() {
    const pts = [...pointers.current.values()];
    if (pts.length === 0) { gesture.current = null; return; }
    const startView = { ...viewRef.current };
    const moved = gesture.current?.moved ?? false;
    if (pts.length === 1) gesture.current = { startView, pinch: false, startX: pts[0].x, startY: pts[0].y, startDist: 0, midSvg: { x: 0, y: 0 }, moved };
    else {
      const a = pts[0], b = pts[1];
      const startDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      gesture.current = { startView, pinch: true, startX: mid.x, startY: mid.y, startDist, midSvg: toSvg(startView, mid.x, mid.y), moved };
    }
  }
  function onDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (anim.current) cancelAnimationFrame(anim.current);
    if (pointers.current.size === 1) movedRef.current = false;
    syncGesture();
  }
  function onMove(e: React.PointerEvent) {
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    const g = gesture.current; if (!g) return;
    const rect = svgRef.current!.getBoundingClientRect();
    const pts = [...pointers.current.values()];
    if (g.pinch && pts.length >= 2) {
      const a = pts[0], b = pts[1];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const nw = clamp(g.startView.w * (g.startDist / dist), MINW(), MAXW());
      const nh = nw * (FULL.h / FULL.w);
      g.moved = true; movedRef.current = true;
      setView({ x: g.midSvg.x - ((mid.x - rect.left) / rect.width) * nw, y: g.midSvg.y - ((mid.y - rect.top) / rect.height) * nh, w: nw, h: nh });
    } else if (!g.pinch && pts.length === 1) {
      const dx = pts[0].x - g.startX, dy = pts[0].y - g.startY;
      if (Math.hypot(dx, dy) > 4) { g.moved = true; movedRef.current = true; }
      setView({ x: g.startView.x - (dx / rect.width) * g.startView.w, y: g.startView.y - (dy / rect.height) * g.startView.h, w: g.startView.w, h: g.startView.h });
    }
  }
  function onUp(e: React.PointerEvent) {
    const wasPinch = gesture.current?.pinch;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      const onMark = (e.target as Element)?.classList?.contains?.("reg") || (e.target as Element)?.closest?.(".house-pin");
      if (!movedRef.current && !wasPinch && !onMark) {
        const now = performance.now();
        if (now - lastTap.current.t < 300 && Math.hypot(e.clientX - lastTap.current.x, e.clientY - lastTap.current.y) < 32) {
          zoomAt(e.clientX, e.clientY, 0.58); suppressClick.current = true; lastTap.current = { t: 0, x: 0, y: 0 };
        } else lastTap.current = { t: now, x: e.clientX, y: e.clientY };
      }
      gesture.current = null;
    } else syncGesture();
  }
  function onCancel(e: React.PointerEvent) { pointers.current.delete(e.pointerId); if (pointers.current.size === 0) gesture.current = null; else syncGesture(); }
  function zoomAt(cx: number, cy: number, factor: number, animate = true) {
    const v = viewRef.current, rect = svgRef.current!.getBoundingClientRect();
    const px = v.x + ((cx - rect.left) / rect.width) * v.w, py = v.y + ((cy - rect.top) / rect.height) * v.h;
    const nw = clamp(v.w * factor, MINW(), MAXW()), nh = nw * (FULL.h / FULL.w);
    const target = { x: px - (px - v.x) * (nw / v.w), y: py - (py - v.y) * (nh / v.h), w: nw, h: nh };
    if (animate) animateTo(target, 200); else setView(target);
  }
  function onWheel(e: React.WheelEvent) { e.preventDefault(); if (anim.current) cancelAnimationFrame(anim.current); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 0.85 : 1 / 0.85, false); }
  function zoomBtn(factor: number) { const r = svgRef.current?.getBoundingClientRect(); if (r) zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor, true); }
  function onMapClick() {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (movedRef.current) return;
    if (house) setHouse(null); else if (selected) reset();
  }

  if (!data || !data.context) return <div className="maplayout nodetail"><div className="stage"><div className="empty">Loading the atlas…</div></div></div>;

  const ctx = data.context;
  const k = view.w / FULL.w;
  const f = clamp(k, 0.32, 1);
  const cities = (ctx.cities as any[]).slice().sort((a, b) => b.pop - a.pop);
  const cityN = Math.round(clamp(7 / k, 7, 46));
  const houses: House[] = (detail?.houses ?? []) as any;
  const pill = (x: number, y: number, text: string, fs: number, anchor: "start" | "middle") => {
    const w = text.length * fs * 0.55, px = fs * 0.45, py = fs * 0.3;
    const bx = anchor === "middle" ? x - w / 2 : x;
    return <rect className="pill" x={bx - px} y={y - fs * 0.85 - py} width={w + 2 * px} height={fs + 2 * py} rx={(fs + 2 * py) / 2} />;
  };

  return (
    <div className={`maplayout ${selected ? "" : "nodetail"} ${sheetMin ? "sheetmin" : ""}`}>
      <main className="stage">
        <div className="breadcrumb">
          <div className="crumb btn" onClick={reset}><Icon name="map" size={13} /> France</div>
          {sel && <div className="crumb btn" style={{ borderColor: sel.color }} onClick={() => setHouse(null)}><Icon name="pin" size={13} /> {sel.name}</div>}
          {house && <div className="crumb"><Icon name="bottle" size={13} /> {house.name}</div>}
        </div>

        <div className={`layers ui ${layersOpen ? "open" : ""}`}>
          <button className="layers-toggle" onClick={() => setLayersOpen((o) => !o)} aria-expanded={layersOpen} aria-label="Map layers">
            <Icon name="map" size={15} /><span className="lt-label">Layers</span>
          </button>
          <div className="layers-body">
            <div className="lh"><Icon name="map" size={13} />Map layers</div>
            {([["wineRoutes", "Wine routes"], ["autoroutes", "Autoroutes"], ["cities", "Cities"], ["villages", "Villages"], ["houses", "Wine houses"], ["neighbours", "Neighbours"]] as const).map(([key, label]) => (
              <label key={key}><input type="checkbox" checked={(vis as any)[key]} onChange={(e) => setVis({ ...vis, [key]: e.target.checked })} /> {label}</label>
            ))}
          </div>
        </div>

        <svg ref={svgRef} id="map" className={gesture.current ? "grabbing" : ""}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid meet"
          onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel} onClick={onMapClick}>
          <rect className="sea" x={-2000} y={-2000} width={6000} height={6000} />
          {vis.neighbours && (ctx.neighbours as any[]).map((nb, i) => <path key={i} className="nb" d={nb.path} />)}
          <path className="base" d={ctx.france} />
          {data.regions.map((r) => (
            <path key={r.slug} className={`reg ${selected && selected !== r.slug ? "dim" : ""} ${selected === r.slug ? "sel" : ""}`}
              d={r.geoPath} fill={r.color}
              onClick={(e) => { e.stopPropagation(); if (!movedRef.current) selectRegion(r.slug); }} />
          ))}
          {vis.autoroutes && (ctx.autoroutes as any[]).map((a, i) => (
            <path key={i} className="aroute" d={`M${a.pts.map((p: number[]) => p.join(",")).join("L")}`} strokeWidth={1.1 * f} />
          ))}
          {selected && vis.wineRoutes && (ctx.wineRoutes as any)[selected]?.length > 1 && (
            <path className="wroute" d={`M${(ctx.wineRoutes as any)[selected].map((p: number[]) => p.join(",")).join("L")}`} stroke={sel!.color} />
          )}
          {selected && vis.villages && (detail?.villages ?? []).map((t) => (
            <g key={t._id}>
              <circle className="town" cx={t.x} cy={t.y} r={1.9 * f} stroke={sel!.color} strokeWidth={1.4 * f} />
              {pill(t.x + 3, t.y + 1, t.name, 8.2 * f, "start")}
              <text className="tlabel" x={t.x + 3} y={t.y + 1} fontSize={8.2 * f}>{t.name}</text>
            </g>
          ))}
          {/* wine-house pins — click a pin to open that exact house */}
          {selected && vis.houses && houses.filter((h) => h.x != null && h.y != null).map((h) => (
            <g key={h._id} className={`house-pin ${house?._id === h._id ? "on" : ""}`}
              onClick={(e) => { e.stopPropagation(); if (!movedRef.current) selectHouse(h); }}>
              <circle className="hhit" cx={h.x} cy={h.y} r={3.6 * f} />
              <circle className="hdot" cx={h.x} cy={h.y} r={(house?._id === h._id ? 2.4 : 1.7) * f} stroke={sel!.color} strokeWidth={1.2 * f} />
              {house?._id === h._id && (<>{pill(h.x! + 3, h.y! - 2, h.name, 9 * f, "start")}<text className="hlabel" x={h.x! + 3} y={h.y! - 2} fontSize={9 * f}>{h.name}</text></>)}
            </g>
          ))}
          {data.regions.map((r) => {
            if (selected === r.slug) return null;
            const fs = 13 * f;
            return (<g key={r.slug + "l"}>{pill(r.centroid[0], r.centroid[1], r.name, fs, "middle")}<text className="rlabel" x={r.centroid[0]} y={r.centroid[1]} fontSize={fs}>{r.name}</text></g>);
          })}
          {vis.cities && cities.slice(0, cityN).map((c, i) => {
            const fs = (c.name === "Paris" ? 10 : 8.6) * f;
            return (<g key={i}><circle className={`city ${c.name === "Paris" ? "cap" : ""}`} cx={c.x} cy={c.y} r={(c.name === "Paris" ? 3 : 2.2) * f} />{pill(c.x + 3.2, c.y + 0.8, c.name, fs, "start")}<text className="clabel" x={c.x + 3.2} y={c.y + 0.8} fontSize={fs}>{c.name}</text></g>);
          })}
        </svg>

        <div className="legend ui">{selected ? "Pinch / scroll to zoom · drag to pan · tap a 🍷 pin for a house." : "Tap a region to explore its houses. Pinch or scroll to zoom."}</div>
        <div className="zoomctl ui">
          <button onClick={() => zoomBtn(0.7)} aria-label="Zoom in">+</button>
          <button onClick={() => zoomBtn(1 / 0.7)} aria-label="Zoom out">−</button>
          <button onClick={reset} title="Reset view" aria-label="Reset view"><Icon name="map" size={15} /></button>
        </div>
      </main>

      {sel && (
        <section className={`detail ${house ? "ishouse" : ""}`}>
          <div className="dinner">
            {/* peek bar shown only when the sheet is minimised (mobile) */}
            <button className="sheet-peek" onClick={() => setSheetMin(false)}>
              <Icon name={house ? "bottle" : "pin"} size={15} /> <b>{house ? house.name : sel.name}</b>
              <span className="peek-hint">Tap for details</span><span className="peek-caret">▴</span>
            </button>

            <button className="sheet-handle" onClick={() => setSheetMin((m) => !m)} aria-label="Minimise" />

            {house ? (
              <>
                <div className="dhead">
                  <div className="dhead-top">
                    <button className="dback" onClick={() => setHouse(null)}><Icon name="map" size={13} /> {sel.name}</button>
                    <div className="dh-right">
                      <FavButton item={{ type: "house", id: house._id, label: house.name, sub: `Wine house · ${house.appellation || sel.name}`, to: `/houses?region=${sel.slug}&q=${encodeURIComponent(house.name)}` }} />
                      <button className="dmin" onClick={() => setSheetMin(true)}><Icon name="map" size={13} /> Map</button>
                    </div>
                  </div>
                  <div className="bar" style={{ background: sel.color }} />
                  <div className="k">Wine house{house.appellation ? ` · ${house.appellation}` : ""}</div>
                  <h2 style={{ color: sel.color }}>{house.name}<Badge cls={house.classification} /></h2>
                  {(house.town || house.address) && <p className="hloc"><Icon name="pin" size={13} /> {house.address || house.town}{house.address && house.town && house.address.indexOf(house.town) < 0 ? `, ${house.town}` : ""}</p>}
                  <div className="types">{(house.types || []).map((t) => <TypeBadge key={t} t={t} />)}</div>
                </div>
                <div className="dbody">
                  {house.flagship && <div className="block"><h3><Icon name="star" size={14} />Flagship</h3><div className="classbox">{house.flagship}</div></div>}
                  {house.note && <div className="block"><h3><Icon name="bottle" size={14} />About</h3><p className="hnote">{house.note}</p></div>}
                  {house.grapes?.length ? <div className="block"><h3><Icon name="grape" size={14} />Grapes</h3><div className="apps">{house.grapes.map((g) => <GrapePill key={g} name={g} onClick={() => navigate(`/houses?region=${sel.slug}&grape=${encodeURIComponent(g)}`)} />)}</div></div> : null}
                  {house.classification && <div className="block"><h3><Icon name="star" size={14} />Classification</h3><div className="classbox">{house.classification}</div></div>}
                </div>
                <div className="dactions ui">
                  <button className="btn primary" onClick={() => openChat(`Tell me about ${house.name}${house.appellation ? ` in ${house.appellation}` : ""} — its wines, style and whether I can visit.`)}><Icon name="chat" size={14} /> Ask Franky</button>
                  {house.appellation && <Link className="btn" to={`/houses?region=${sel.slug}&appellation=${encodeURIComponent(house.appellation)}`}><Icon name="bottle" size={14} /> {house.appellation}</Link>}
                  <button className="btn" onClick={() => setHouse(null)}><Icon name="map" size={14} /> Back to region</button>
                </div>
              </>
            ) : (
              <>
                <div className="dhead">
                  <div className="dhead-top">
                    <button className="dback" onClick={reset}><Icon name="map" size={13} /> France</button>
                    <div className="dh-right">
                      <FavButton item={{ type: "region", id: sel.slug, label: sel.name, sub: "Wine region", to: `/?region=${sel.slug}` }} />
                      <button className="dmin" onClick={() => setSheetMin(true)}><Icon name="map" size={13} /> Map</button>
                    </div>
                  </div>
                  <div className="bar" style={{ background: sel.color }} />
                  <div className="k">Wine region · France</div>
                  <h2 style={{ color: sel.color }}>{sel.name}</h2>
                  <button className="intro-toggle" onClick={() => setIntroOpen((o) => !o)} aria-expanded={introOpen}>
                    Overview <span className={`chev ${introOpen ? "up" : ""}`}>▾</span>
                  </button>
                  <div className={`intro ${introOpen ? "open" : ""}`}>
                    <p>{sel.summary}</p>
                    <div className="types">{sel.types.map((t) => <TypeBadge key={t} t={t} />)}</div>
                  </div>
                </div>
                <div className="dbody">
                  {sel.terroirScore != null && (
                    <div className="dscore">
                      <div className="sb"><div className="l">Terroir &amp; climate</div><div className="v">{sel.terroirScore.toFixed(1)}<small>/10</small></div></div>
                      <div className="sb"><div className="l">Visit experience</div><div className="v">{(sel.visitScore ?? 0).toFixed(1)}<small>/10</small></div></div>
                    </div>
                  )}
                  <div className="block"><h3><Icon name="star" size={14} />Classification</h3><div className="classbox">{sel.classification}</div></div>
                  <div className="block"><h3><Icon name="grape" size={14} />Principal grapes</h3><div className="apps">{sel.grapes.slice(0, 12).map((g) => (
                    <GrapePill key={g} name={g} onClick={() => navigate(`/houses?region=${sel.slug}&grape=${encodeURIComponent(g)}`)} />
                  ))}</div></div>
                  <div className="block"><h3><Icon name="pin" size={14} />Key appellations &amp; crus</h3><div className="apps">{sel.subAppellations.map((a) => (
                    <span key={a} className="app app-click" role="button" tabIndex={0} title={`See houses in ${a}`}
                      onClick={() => navigate(`/houses?region=${sel.slug}&appellation=${encodeURIComponent(a)}`)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/houses?region=${sel.slug}&appellation=${encodeURIComponent(a)}`); } }}>{a}</span>
                  ))}</div></div>
                  <div className="block">
                    <h3><Icon name="bottle" size={14} />Major wine houses · {houses.length || "…"}</h3>
                    {houses.map((h) => (
                      <div key={h._id} className={`prod prod-click ${house && (house as House)._id === h._id ? "on" : ""}`} role="button" tabIndex={0} title={`Open ${h.name}`}
                        onClick={() => selectHouse(h)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectHouse(h); } }}>
                        <div className="pn">{h.name}<Badge cls={h.classification} /></div>
                        <div className="pa">{h.appellation}{h.town ? ` · ${h.town}` : ""}</div>
                        <div className="pg">{(h.types || []).map((t) => <span key={t}><TypeDot t={t} />{t} </span>)} {h.grapes?.length ? "· " + h.grapes.join(", ") : ""}</div>
                        {h.note && <div className="pnote">{h.note}</div>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="dactions ui">
                  {sel.tripCount > 0 && <Link className="btn primary" to={`/trips?region=${sel.slug}`}><Icon name="route" size={14} /> {sel.tripCount} wine trip{sel.tripCount > 1 ? "s" : ""}</Link>}
                  <Link className="btn" to={`/houses?region=${sel.slug}`}><Icon name="bottle" size={14} /> All houses</Link>
                  <button className="btn" onClick={() => openChat(`Tell me about ${sel.name} — its terroir, top houses to visit, and a good wine trip.`)}><Icon name="chat" size={14} /> Ask Franky</button>
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
