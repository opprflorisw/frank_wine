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
type Tab = "overview" | "houses" | "terroir";
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const isMobile = () => typeof window !== "undefined" && window.matchMedia("(max-width:860px)").matches;
const TYPE_ORDER = ["Red", "White", "Rosé", "Sparkling", "Sweet", "Fortified"];

export default function MapPage() {
  const data = useQuery(api.wine.mapData);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [vis, setVis] = useState({ wineRoutes: true, autoroutes: true, cities: true, villages: true, houses: true, neighbours: true });
  const [layersOpen, setLayersOpen] = useState(false);
  const [house, setHouse] = useState<House | null>(null);   // selected wine house (pin / row)
  const [tab, setTab] = useState<Tab>("overview");           // detail tab
  const [typeFilter, setTypeFilter] = useState<string | null>(null); // filter houses/pins by wine family
  const [sheetMin, setSheetMin] = useState(false);           // minimise sheet to see the map (mobile)
  const [sheetFull, setSheetFull] = useState(false);         // expand sheet to full height (mobile)
  const svgRef = useRef<SVGSVGElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => { setHouse(null); setSheetMin(false); setSheetFull(false); setTab("overview"); setTypeFilter(null); }, [selected]);

  function setRegionParam(slug: string | null) {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (slug) p.set("region", slug); else p.delete("region");
      return p;
    });
  }

  // ---------- camera framing (focuses the selected area in the *visible* band) ----------
  function bboxToView(bb: number[], pad = 0.16): View {
    let [x, y, w, h] = bb;
    const ar = FULL.w / FULL.h, px = w * pad, py = h * pad;
    x -= px; y -= py; w += 2 * px; h += 2 * py;
    if (w / h < ar) { const nw = h * ar; x -= (nw - w) / 2; w = nw; } else { const nh = w / ar; y -= (nh - h) / 2; h = nh; }
    return { x, y, w, h };
  }
  // On phones the bottom-sheet hides the lower part of the map, so frame the region
  // into the visible top band instead of the geometric centre.
  function focusView(bb: number[], visibleFrac: number): View {
    const ar = FULL.w / FULL.h, pad = 0.18;
    let [x, y, w, h] = bb;
    const px = w * pad, py = h * pad;
    x -= px; y -= py; w += 2 * px; h += 2 * py;
    let viewH = Math.max(h / visibleFrac, w / ar);
    let viewW = viewH * ar;
    if (viewW < w) { viewW = w; viewH = viewW / ar; }
    const cx = x + w / 2, cy = y + h / 2;
    return { x: cx - viewW / 2, y: cy - (visibleFrac * 0.5) * viewH, w: viewW, h: viewH };
  }
  function frameRegion(bb: number[]) {
    if (isMobile() && !sheetMin) return focusView(bb, sheetFull ? 0.16 : 0.34);
    return bboxToView(bb);
  }

  const prevSel = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!data) return;
    if (prevSel.current === selected) return;
    prevSel.current = selected;
    if (selected) { const r = data.regions.find((x) => x.slug === selected); if (r) animateTo(frameRegion(r.bbox)); }
    else animateTo(FULL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, data]);

  // re-frame when the sheet is minimised / restored / expanded so the region stays visible
  useEffect(() => {
    if (!selected || !sel || house) return;
    animateTo(frameRegion(sel.bbox), 360);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetMin, sheetFull]);

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
  function selectRegion(slug: string) { setRegionParam(slug); }
  function reset() { setRegionParam(null); }
  function selectHouse(h: House) {
    setHouse(h); setSheetMin(false);
    if (h.x != null && h.y != null) {
      // on phones bias the framing upward so the pin sits above the sheet
      const yBias = isMobile() ? 0.022 : 0.07;
      animateTo({ x: h.x - FULL.w * 0.07, y: h.y - FULL.h * yBias, w: FULL.w * 0.14, h: FULL.h * 0.14 }, 420);
    }
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

  // ---------- draggable bottom sheet (mobile) ----------
  const dragRef = useRef<{ y0: number; h: number } | null>(null);
  const [dragY, setDragY] = useState(0);
  function sheetDown(e: React.PointerEvent) {
    if (!isMobile()) return;
    dragRef.current = { y0: e.clientY, h: sheetRef.current?.offsetHeight || window.innerHeight * 0.7 };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function sheetMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    let d = e.clientY - dragRef.current.y0;
    if (d < -140) d = -140;
    setDragY(d);
  }
  function sheetUp() {
    const g = dragRef.current; const d = dragY;
    dragRef.current = null; setDragY(0);
    if (!g) return;
    if (d > g.h * 0.32) { reset(); }                                   // dragged well down → close
    else if (d > 64) { setSheetMin(true); setSheetFull(false); }       // a nudge down → minimise to map
    else if (d < -56) { setSheetFull(true); }                          // dragged up → full height
    // else snap back
  }

  if (!data || !data.context) return <div className="maplayout nodetail"><div className="stage"><div className="empty">Loading the atlas…</div></div></div>;

  const ctx = data.context;
  const k = view.w / FULL.w;
  const f = clamp(k, 0.32, 1);
  const cities = (ctx.cities as any[]).slice().sort((a, b) => b.pop - a.pop);
  const cityN = Math.round(clamp(7 / k, 7, 46));
  const allHouses: House[] = (detail?.houses ?? []) as any;
  const htSet = new Set<string>();
  for (const h of allHouses) for (const t of h.types || []) htSet.add(t);
  const houseTypes = TYPE_ORDER.filter((t) => htSet.has(t));
  const houses = typeFilter ? allHouses.filter((h) => (h.types || []).includes(typeFilter)) : allHouses;

  // ---------- label-collision engine: keep the map readable, never an overlapping mush ----------
  const labelBox = (x: number, y: number, text: string, fs: number, anchor: "start" | "middle") => {
    const w = text.length * fs * 0.55, px = fs * 0.45, py = fs * 0.3;
    const bx = (anchor === "middle" ? x - w / 2 : x) - px;
    return { bx, by: y - fs * 0.85 - py, bw: w + 2 * px, bh: fs + 2 * py };
  };
  const placed: { bx: number; by: number; bw: number; bh: number }[] = [];
  const fit = (b: { bx: number; by: number; bw: number; bh: number }) => {
    for (const p of placed) if (b.bx < p.bx + p.bw && b.bx + b.bw > p.bx && b.by < p.by + p.bh && b.by + b.bh > p.by) return false;
    placed.push(b); return true;
  };
  const showHouseLbl = new Set<string>();
  const showVillage = new Set<string>();
  const showCity = new Set<number>();
  const showRegion = new Set<string>();
  // 1. selected house label is forced (highest priority)
  if (house && house.x != null && house.y != null) { placed.push(labelBox(house.x + 4, house.y - 5, house.name, 9 * f, "start")); showHouseLbl.add(house._id); }
  // 2. region names (when zoomed out these orient the user)
  for (const r of data.regions) { if (selected === r.slug) continue; if (fit(labelBox(r.centroid[0], r.centroid[1], r.name, 13 * f, "middle"))) showRegion.add(r.slug); }
  // 3. cities
  const cityList = cities.slice(0, cityN);
  if (vis.cities) cityList.forEach((c, i) => { const fs = (c.name === "Paris" ? 10 : 8.6) * f; if (fit(labelBox(c.x + 3.2, c.y + 0.8, c.name, fs, "start"))) showCity.add(i); });
  // 4. villages / crus of the selected region
  if (selected && vis.villages) for (const t of (detail?.villages ?? [])) { if (fit(labelBox(t.x + 3, t.y + 1, t.name, 8.2 * f, "start"))) showVillage.add(t._id); }
  // 5. wine houses (lowest priority — only labelled when there's genuinely room)
  if (selected && vis.houses) for (const h of houses) { if (h.x == null || h.y == null || showHouseLbl.has(h._id)) continue; if (fit(labelBox(h.x + 4, h.y - 5, h.name, 9 * f, "start"))) showHouseLbl.add(h._id); }

  const pill = (b: { bx: number; by: number; bw: number; bh: number }, cls = "pill") =>
    <rect className={cls} x={b.bx} y={b.by} width={b.bw} height={b.bh} rx={b.bh / 2} />;
  // house marker: a little teardrop pin so houses read differently from villages/cities
  const pinPath = (x: number, y: number, s: number) => `M${x} ${y}L${x - s} ${y - 2.4 * s}A${s} ${s} 0 1 1 ${x + s} ${y - 2.4 * s}Z`;

  const tabsFor = (n: number): [Tab, string][] => [["overview", "Overview"], ["houses", `Houses · ${n}`], ["terroir", "Terroir"]];

  return (
    <div className={`maplayout ${selected ? "" : "nodetail"} ${sheetMin ? "sheetmin" : ""} ${sheetFull ? "sheetfull" : ""}`}>
      <main className="stage">
        <div className="breadcrumb">
          <div className="crumb btn" onClick={reset}><Icon name="map" size={13} /> France</div>
          {sel && <div className="crumb btn" style={{ borderColor: sel.color }} onClick={() => setHouse(null)}><Icon name="pin" size={13} /> {sel.name}</div>}
          {house && <div className="crumb"><Icon name="bottle" size={13} /> {house.name}</div>}
        </div>

        <div className={`layers ui ${layersOpen ? "open" : ""}`}>
          <button className="layers-toggle" onClick={() => setLayersOpen((o) => !o)} aria-expanded={layersOpen} aria-label="Map layers">
            <Icon name="layers" size={15} /><span className="lt-label">Layers</span>
          </button>
          <div className="layers-body">
            <div className="lh"><Icon name="layers" size={13} />Map layers</div>
            {([["wineRoutes", "Wine routes"], ["autoroutes", "Main roads"], ["cities", "Cities"], ["villages", "Villages & crus"], ["houses", "Wine houses"], ["neighbours", "Neighbours"]] as const).map(([key, label]) => (
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
          {/* villages / crus — open rings in the region colour */}
          {selected && vis.villages && (detail?.villages ?? []).map((t) => (
            <g key={t._id} className="village">
              <circle className="town" cx={t.x} cy={t.y} r={1.9 * f} stroke={sel!.color} strokeWidth={1.4 * f} />
              {showVillage.has(t._id) && (<>{pill(labelBox(t.x + 3, t.y + 1, t.name, 8.2 * f, "start"), "pill vpill")}<text className="tlabel" x={t.x + 3} y={t.y + 1} fontSize={8.2 * f}>{t.name}</text></>)}
            </g>
          ))}
          {/* wine-house pins — teardrop markers, click for that exact house */}
          {selected && vis.houses && houses.filter((h) => h.x != null && h.y != null).map((h) => (
            <g key={h._id} className={`house-pin ${house?._id === h._id ? "on" : ""}`}
              onClick={(e) => { e.stopPropagation(); if (!movedRef.current) selectHouse(h); }}>
              <circle className="hhit" cx={h.x} cy={h.y} r={4.4 * f} />
              <path className="hpin" d={pinPath(h.x!, h.y!, (house?._id === h._id ? 2.5 : 1.9) * f)} fill={house?._id === h._id ? undefined : sel!.color} strokeWidth={1 * f} />
              <circle className="hpin-dot" cx={h.x} cy={h.y! - 4.3 * (house?._id === h._id ? 2.5 : 1.9) * f / 2.4} r={(house?._id === h._id ? 0.9 : 0.7) * f} />
              {showHouseLbl.has(h._id) && (<>{pill(labelBox(h.x! + 4, h.y! - 5, h.name, 9 * f, "start"), "pill hpill")}<text className="hlabel" x={h.x! + 4} y={h.y! - 5} fontSize={9 * f}>{h.name}</text></>)}
            </g>
          ))}
          {/* region name labels */}
          {data.regions.map((r) => {
            if (selected === r.slug || !showRegion.has(r.slug)) return null;
            const fs = 13 * f;
            return (<g key={r.slug + "l"}>{pill(labelBox(r.centroid[0], r.centroid[1], r.name, fs, "middle"), "pill rpill")}<text className="rlabel" x={r.centroid[0]} y={r.centroid[1]} fontSize={fs}>{r.name}</text></g>);
          })}
          {/* cities */}
          {vis.cities && cityList.map((c, i) => {
            const fs = (c.name === "Paris" ? 10 : 8.6) * f, cap = c.name === "Paris";
            return (<g key={i}>
              <circle className={`city ${cap ? "cap" : ""}`} cx={c.x} cy={c.y} r={(cap ? 3 : 2.2) * f} />
              {showCity.has(i) && (<>{pill(labelBox(c.x + 3.2, c.y + 0.8, c.name, fs, "start"), "pill cpill")}<text className="clabel" x={c.x + 3.2} y={c.y + 0.8} fontSize={fs}>{c.name}</text></>)}
            </g>);
          })}
        </svg>

        <div className="maptypes">
          <span className="mt-item"><i className="mt-city" /> City</span>
          <span className="mt-item"><i className="mt-vill" style={{ borderColor: sel?.color || "#9c7" }} /> Village / cru</span>
          <span className="mt-item"><i className="mt-house" style={{ background: sel?.color || "var(--wine)" }} /> Wine house</span>
        </div>
        <div className="zoomctl ui">
          <button onClick={() => zoomBtn(0.7)} aria-label="Zoom in">+</button>
          <button onClick={() => zoomBtn(1 / 0.7)} aria-label="Zoom out">−</button>
          <button onClick={reset} title="Reset view" aria-label="Reset view"><Icon name="map" size={15} /></button>
        </div>
      </main>

      {sel && (
        <section ref={sheetRef} className={`detail ${house ? "ishouse" : ""}`}
          style={dragY ? { transform: `translateY(${Math.max(0, dragY)}px)`, transition: "none" } : undefined}>
          <div className="dinner">
            {/* drag handle — drag down to minimise/close, up to expand (mobile) */}
            <div className="sheet-grip" onPointerDown={sheetDown} onPointerMove={sheetMove} onPointerUp={sheetUp} onPointerCancel={sheetUp}>
              <div className="sheet-handle" />
            </div>
            {/* peek bar shown only when the sheet is minimised (mobile) */}
            <button className="sheet-peek" onClick={() => setSheetMin(false)}>
              <Icon name={house ? "bottle" : "pin"} size={15} /> <b>{house ? house.name : sel.name}</b>
              <span className="peek-hint">Tap for details</span><span className="peek-caret">▴</span>
            </button>

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
                  <div className="dtabs" role="tablist">
                    {tabsFor(allHouses.length).map(([id, label]) => (
                      <button key={id} role="tab" aria-selected={tab === id} className={`dtab ${tab === id ? "on" : ""}`}
                        onClick={() => setTab(id)} style={tab === id ? { borderColor: sel.color, color: sel.color } : undefined}>{label}</button>
                    ))}
                  </div>
                </div>

                {/* ===== OVERVIEW ===== */}
                {tab === "overview" && (
                  <div className="dbody">
                    <p className="dlede">{sel.summary}</p>
                    <div className="types">{sel.types.map((t) => <TypeBadge key={t} t={t} />)}</div>
                    {sel.terroirScore != null && (
                      <div className="dscore">
                        <div className="sb"><div className="l">Terroir &amp; climate</div><div className="v">{sel.terroirScore.toFixed(1)}<small>/10</small></div></div>
                        <div className="sb"><div className="l">Visit experience</div><div className="v">{(sel.visitScore ?? 0).toFixed(1)}<small>/10</small></div></div>
                      </div>
                    )}
                    <div className="block"><h3><Icon name="star" size={14} />Classification</h3><div className="classbox">{sel.classification}</div></div>
                    <div className="block"><h3><Icon name="info" size={14} />At a glance</h3>
                      <div className="glance">
                        <div className="gl"><b>{allHouses.length}</b><span>Wine houses</span></div>
                        <div className="gl"><b>{(detail?.villages ?? []).length || sel.villageCount}</b><span>Villages</span></div>
                        <div className="gl"><b>{sel.subAppellations.length}</b><span>Appellations</span></div>
                        <div className="gl"><b>{sel.tripCount}</b><span>Wine trips</span></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== HOUSES (with family filter) ===== */}
                {tab === "houses" && (
                  <div className="dbody">
                    {houseTypes.length > 1 && (
                      <div className="hfilter">
                        <span className="hf-label"><Icon name="filter" size={12} /> Family</span>
                        <button className={`fchip ${!typeFilter ? "on" : ""}`} onClick={() => setTypeFilter(null)}>All</button>
                        {houseTypes.map((t) => (
                          <button key={t} className={`fchip ${typeFilter === t ? "on" : ""}`} onClick={() => setTypeFilter((p) => p === t ? null : t)}>
                            <TypeDot t={t} />{t}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="hcount">{houses.length} house{houses.length !== 1 ? "s" : ""}{typeFilter ? ` · ${typeFilter}` : ""}</div>
                    {houses.map((h) => (
                      <div key={h._id} className={`prod prod-click ${house && (house as House)._id === h._id ? "on" : ""}`} role="button" tabIndex={0} title={`Open ${h.name}`}
                        onClick={() => selectHouse(h)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectHouse(h); } }}>
                        <div className="pn">{h.name}<Badge cls={h.classification} /></div>
                        <div className="pa">{h.appellation}{h.town ? ` · ${h.town}` : ""}</div>
                        <div className="pg">{(h.types || []).map((t) => <span key={t}><TypeDot t={t} />{t} </span>)}{h.grapes?.length ? "· " + h.grapes.slice(0, 4).join(", ") : ""}</div>
                      </div>
                    ))}
                    {!houses.length && <div className="empty mini">No {typeFilter} houses listed here.</div>}
                  </div>
                )}

                {/* ===== TERROIR (grapes + appellations) ===== */}
                {tab === "terroir" && (
                  <div className="dbody">
                    <div className="block"><h3><Icon name="grape" size={14} />Principal grapes</h3><div className="apps">{sel.grapes.slice(0, 14).map((g) => (
                      <GrapePill key={g} name={g} onClick={() => navigate(`/houses?region=${sel.slug}&grape=${encodeURIComponent(g)}`)} />
                    ))}</div></div>
                    <div className="block"><h3><Icon name="pin" size={14} />Key appellations &amp; crus</h3><div className="apps">{sel.subAppellations.map((a) => (
                      <span key={a} className="app app-click" role="button" tabIndex={0} title={`See houses in ${a}`}
                        onClick={() => navigate(`/houses?region=${sel.slug}&appellation=${encodeURIComponent(a)}`)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/houses?region=${sel.slug}&appellation=${encodeURIComponent(a)}`); } }}>{a}</span>
                    ))}</div></div>
                  </div>
                )}

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
