import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Badge, TypeBadge, TypeDot, Icon } from "../lib/ui";

type View = { x: number; y: number; w: number; h: number };
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export default function MapPage() {
  const data = useQuery(api.wine.mapData);
  const [params] = useSearchParams();
  const [selected, setSelected] = useState<string | null>(null);
  const [vis, setVis] = useState({ wineRoutes: true, autoroutes: true, cities: true, villages: true, neighbours: true });
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const anim = useRef<number | null>(null);

  const FULL: View = useMemo(() => {
    const vb = data?.context?.viewBox ?? [0, 0, 1040, 1005];
    return { x: 0, y: 0, w: vb[2], h: vb[3] };
  }, [data]);
  const [view, setView] = useState<View>(FULL);
  useEffect(() => { setView(FULL); }, [FULL]);

  const sel = data?.regions.find((r) => r.slug === selected) || null;
  const detail = useQuery(api.wine.getRegion, selected ? { slug: selected } : "skip");

  // deep link ?region=
  useEffect(() => {
    const rp = params.get("region");
    if (rp && data?.regions.some((r) => r.slug === rp)) selectRegion(rp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function animateTo(target: View, ms = 560) {
    if (anim.current) cancelAnimationFrame(anim.current);
    const s = { ...view }, t0 = performance.now(), ease = (x: number) => 1 - Math.pow(1 - x, 3);
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
  function selectRegion(slug: string) {
    const r = data?.regions.find((x) => x.slug === slug);
    if (!r) return;
    setSelected(slug);
    animateTo(bboxToView(r.bbox));
  }
  function reset() { setSelected(null); animateTo(FULL); }

  // pan & zoom
  function clientToSvg(cx: number, cy: number) {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: view.x + ((cx - rect.left) / rect.width) * view.w, y: view.y + ((cy - rect.top) / rect.height) * view.h };
  }
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    if (anim.current) cancelAnimationFrame(anim.current);
    const f = e.deltaY < 0 ? 0.85 : 1 / 0.85;
    const p = clientToSvg(e.clientX, e.clientY);
    let nw = clamp(view.w * f, FULL.w * 0.03, FULL.w * 1.12);
    const nh = nw * (FULL.h / FULL.w);
    setView({ x: p.x - (p.x - view.x) * (nw / view.w), y: p.y - (p.y - view.y) * (nh / view.h), w: nw, h: nh });
  }
  function onDown(e: React.PointerEvent) { drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }; }
  function onMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const rect = svgRef.current!.getBoundingClientRect();
    if (Math.hypot(e.clientX - drag.current.x, e.clientY - drag.current.y) > 4) drag.current.moved = true;
    setView((v) => ({ ...v, x: drag.current!.vx - ((e.clientX - drag.current!.x) / rect.width) * v.w, y: drag.current!.vy - ((e.clientY - drag.current!.y) / rect.height) * v.h }));
  }
  function onUp() { drag.current = null; }

  function zoomBtn(f: number) {
    const cx = view.x + view.w / 2, cy = view.y + view.h / 2;
    let nw = clamp(view.w * f, FULL.w * 0.03, FULL.w * 1.12);
    const nh = nw * (FULL.h / FULL.w);
    animateTo({ x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh }, 280);
  }

  if (!data || !data.context) return <div className="maplayout"><div className="stage"><div className="empty">Loading the atlas…</div></div></div>;

  const ctx = data.context;
  const k = view.w / FULL.w;
  const f = clamp(k, 0.32, 1);
  const cities = (ctx.cities as any[]).slice().sort((a, b) => b.pop - a.pop);
  const cityN = Math.round(clamp(7 / k, 7, 46));
  const pill = (x: number, y: number, text: string, fs: number, anchor: "start" | "middle") => {
    const w = text.length * fs * 0.55, px = fs * 0.45, py = fs * 0.3;
    const bx = anchor === "middle" ? x - w / 2 : x;
    return <rect className="pill" x={bx - px} y={y - fs * 0.85 - py} width={w + 2 * px} height={fs + 2 * py} rx={(fs + 2 * py) / 2} />;
  };

  return (
    <div className={`maplayout ${selected ? "" : "nodetail"}`}>
      <main className="stage">
        <div className="breadcrumb">
          <div className="crumb btn" onClick={reset}>🏠 France</div>
          {sel && <div className="crumb" style={{ borderColor: sel.color }}><Icon name="pin" size={14} /> {sel.name}</div>}
        </div>
        <div className="layers ui">
          <div className="lh"><Icon name="map" size={13} />Map layers</div>
          {([["wineRoutes", "Wine routes"], ["autoroutes", "Autoroutes"], ["cities", "Cities"], ["villages", "Villages"], ["neighbours", "Neighbours"]] as const).map(([key, label]) => (
            <label key={key}><input type="checkbox" checked={(vis as any)[key]} onChange={(e) => setVis({ ...vis, [key]: e.target.checked })} /> {label}</label>
          ))}
        </div>

        <svg ref={svgRef} id="map" className={drag.current ? "grabbing" : ""}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid meet"
          onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
          onClick={() => { if (!drag.current?.moved && selected) reset(); }}>
          <rect className="sea" x={-2000} y={-2000} width={6000} height={6000} />
          {vis.neighbours && (ctx.neighbours as any[]).map((nb, i) => <path key={i} className="nb" d={nb.path} />)}
          <path className="base" d={ctx.france} />
          {data.regions.map((r) => (
            <path key={r.slug} className={`reg ${selected && selected !== r.slug ? "dim" : ""} ${selected === r.slug ? "sel" : ""}`}
              d={r.geoPath} fill={r.color}
              onClick={(e) => { e.stopPropagation(); if (!drag.current?.moved) selectRegion(r.slug); }} />
          ))}
          {vis.autoroutes && (ctx.autoroutes as any[]).map((a, i) => (
            <path key={i} className="aroute" d={`M${a.pts.map((p: number[]) => p.join(",")).join("L")}`} strokeWidth={1.1 * f} />
          ))}
          {/* selected region's wine route + villages */}
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
          {/* region labels */}
          {data.regions.map((r) => {
            if (selected === r.slug) return null;
            const fs = 13 * f;
            return (
              <g key={r.slug + "l"}>
                {pill(r.centroid[0], r.centroid[1], r.name, fs, "middle")}
                <text className="rlabel" x={r.centroid[0]} y={r.centroid[1]} fontSize={fs}>{r.name}</text>
              </g>
            );
          })}
          {/* cities */}
          {vis.cities && cities.slice(0, cityN).map((c, i) => {
            const fs = (c.name === "Paris" ? 10 : 8.6) * f;
            return (
              <g key={i}>
                <circle className={`city ${c.name === "Paris" ? "cap" : ""}`} cx={c.x} cy={c.y} r={(c.name === "Paris" ? 3 : 2.2) * f} />
                {pill(c.x + 3.2, c.y + 0.8, c.name, fs, "start")}
                <text className="clabel" x={c.x + 3.2} y={c.y + 0.8} fontSize={fs}>{c.name}</text>
              </g>
            );
          })}
        </svg>

        <div className="legend ui">{selected ? "Scroll to zoom · drag to pan · click empty space to go back." : "Click a region to zoom in and reveal its villages, wine route & houses."}</div>
        <div className="zoomctl ui">
          <button onClick={() => zoomBtn(0.7)}>+</button>
          <button onClick={() => zoomBtn(1 / 0.7)}>−</button>
          <button onClick={reset} title="Reset">⌂</button>
        </div>
      </main>

      {sel && (
        <section className="detail">
          <div className="dinner">
            <div className="dhead">
              <div className="bar" style={{ background: sel.color }} />
              <div className="k">Wine region · France</div>
              <h2 style={{ color: sel.color }}>{sel.name}</h2>
              <p>{sel.summary}</p>
              <div className="types">{sel.types.map((t) => <TypeBadge key={t} t={t} />)}</div>
            </div>
            <div className="dbody">
              {sel.terroirScore != null && (
                <div className="dscore">
                  <div className="sb"><div className="l">Terroir &amp; climate</div><div className="v">{sel.terroirScore.toFixed(1)}<small>/10</small></div></div>
                  <div className="sb"><div className="l">Visit experience</div><div className="v">{(sel.visitScore ?? 0).toFixed(1)}<small>/10</small></div></div>
                </div>
              )}
              <div className="block"><h3><Icon name="star" size={14} />Classification</h3><div className="classbox">{sel.classification}</div></div>
              <div className="block"><h3><Icon name="grape" size={14} />Principal grapes</h3><div className="apps">{sel.grapes.slice(0, 12).map((g) => <span key={g} className="app">{g}</span>)}</div></div>
              <div className="block"><h3><Icon name="pin" size={14} />Key appellations &amp; crus</h3><div className="apps">{sel.subAppellations.map((a) => <span key={a} className="app">{a}</span>)}</div></div>
              <div className="block">
                <h3><Icon name="bottle" size={14} />Major wine houses · {detail?.houses.length ?? "…"}</h3>
                {(detail?.houses ?? []).map((h) => (
                  <div key={h._id} className="prod">
                    <div className="pn">{h.name}<Badge cls={h.classification} /></div>
                    <div className="pa">{h.appellation}</div>
                    <div className="pg">{(h.types || []).map((t) => <span key={t}><TypeDot t={t} />{t} </span>)} {h.grapes?.length ? "· " + h.grapes.join(", ") : ""}</div>
                    {h.note && <div className="pnote">{h.note}</div>}
                  </div>
                ))}
              </div>
            </div>
            <div className="dactions ui">
              {sel.tripCount > 0 && <Link className="btn primary" to={`/trips?region=${sel.slug}`}><Icon name="route" size={14} /> {sel.tripCount} wine trip{sel.tripCount > 1 ? "s" : ""}</Link>}
              <Link className="btn" to={`/houses?region=${sel.slug}`}><Icon name="bottle" size={14} /> All houses</Link>
              <Link className="btn" to={`/ask`}><Icon name="chat" size={14} /> Ask about {sel.name}</Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
