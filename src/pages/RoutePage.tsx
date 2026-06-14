import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Icon, BackBar } from "../lib/ui";
import { openChat } from "../lib/chat";
import {
  useRoute, removeStop, clearRoute, setRoute, moveStop, optimize, routeStats, fmtDrive, type Stop,
} from "../lib/route";

export default function RoutePage() {
  const route = useRoute();
  const map = useQuery(api.wine.mapData);
  const [params, setParams] = useSearchParams();
  const [copied, setCopied] = useState(false);

  // shared link support: ?stops=id,id,... — load those houses if our local route is empty/different
  const sharedIds = (params.get("stops") || "").split(",").filter(Boolean);
  const needShared = sharedIds.length > 0 && sharedIds.join(",") !== route.map((s) => s.id).join(",");
  const sharedHouses = useQuery(api.wine.housesByIds, needShared ? { ids: sharedIds } : "skip");
  useEffect(() => {
    if (needShared && sharedHouses && sharedHouses.length) {
      const byId: Record<string, any> = {};
      for (const h of sharedHouses) byId[h._id] = h;
      const stops: Stop[] = sharedIds.map((id) => byId[id]).filter(Boolean).map((h) => ({
        id: h._id, name: h.name, town: h.town, region: h.regionSlug, regionName: h.regionName,
        appellation: h.appellation, x: h.x, y: h.y, lat: h.lat, lon: h.lon,
      }));
      if (stops.length) setRoute(stops);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedHouses]);

  const stats = useMemo(() => routeStats(route), [route]);
  const regionsBySlug = useMemo(() => {
    const m: Record<string, any> = {};
    for (const r of map?.regions ?? []) m[r.slug] = r;
    return m;
  }, [map]);

  function doOptimize() { setRoute(optimize(route)); }
  function reverse() { setRoute([...route].reverse()); }
  function share() {
    const url = `${location.origin}/route?stops=${route.map((s) => s.id).join(",")}`;
    setParams({ stops: route.map((s) => s.id).join(",") }, { replace: true });
    if (navigator.share) { navigator.share({ title: "My wine route — Frank's Almanac", url }).catch(() => {}); }
    else { navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); }
  }
  function askFranky() {
    const list = route.map((s, i) => `${i + 1}. ${s.name}${s.town ? ` (${s.town})` : ""}`).join("\n");
    openChat(`I'm planning a tasting road-trip with these stops:\n${list}\n\nPlease suggest the best order to drive them, roughly how long it takes, where to stop for lunch, and which appointments I should book ahead.`);
  }

  return (
    <div className="page route-page">
      <BackBar crumbs={[{ label: "Map", to: "/" }, { label: "My Route" }]} />
      <div className="page-head">
        <div className="kicker">The Almanac</div>
        <h1>My Wine Route</h1>
        <p className="lede">Build your own tasting trail — add wine houses from the map or any list, then optimise the driving order and follow it.</p>
      </div>

      {route.length === 0 ? (
        <div className="empty route-empty">
          <Icon name="route" size={30} />
          <h3>Your route is empty</h3>
          <p>Open the map, tap a wine house, and choose <b>“Add to route”</b>. Stops you add appear here in order, with distance and drive time.</p>
          <Link className="btn primary" to="/"><Icon name="map" size={14} /> Open the map</Link>
        </div>
      ) : (
        <>
          <div className="route-stats ui">
            <div className="rs"><b>{stats.stops}</b><span>stops</span></div>
            <div className="rs"><b>{stats.km != null ? stats.km : "—"}</b><span>km</span></div>
            <div className="rs"><b>{fmtDrive(stats.driveMin)}</b><span>driving</span></div>
            <div className="rs-actions">
              <button className="btn sm" onClick={doOptimize} title="Re-order by nearest-neighbour"><Icon name="route" size={13} /> Optimise</button>
              <button className="btn sm" onClick={reverse} title="Reverse the order">⇅ Reverse</button>
            </div>
          </div>

          <div className="route-grid">
            <RouteMap route={route} regionsBySlug={regionsBySlug} />

            <ol className="route-list">
              {route.map((s, i) => (
                <li key={s.id} className="route-stop">
                  <div className="rsn">{i + 1}</div>
                  <div className="rsbody">
                    <Link className="rsname" to={`/?region=${s.region}`}>{s.name}</Link>
                    <div className="rsmeta">{[s.appellation || s.town, s.regionName].filter(Boolean).join(" · ")}</div>
                    {i > 0 && stats.legs[i - 1] != null && <div className="rsleg">↑ {Math.round(stats.legs[i - 1] as number)} km from previous</div>}
                  </div>
                  <div className="rsctl">
                    <button onClick={() => moveStop(i, i - 1)} disabled={i === 0} aria-label="Move up">▲</button>
                    <button onClick={() => moveStop(i, i + 1)} disabled={i === route.length - 1} aria-label="Move down">▼</button>
                    <button onClick={() => removeStop(s.id)} aria-label="Remove" className="rsx">✕</button>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="route-actions ui">
            <button className="btn primary" onClick={askFranky}><Icon name="chat" size={14} /> Plan with Franky</button>
            <button className="btn" onClick={share}><Icon name="route" size={14} /> {copied ? "Link copied!" : "Share route"}</button>
            <button className="btn danger" onClick={() => clearRoute()}>Clear route</button>
          </div>
        </>
      )}
    </div>
  );
}

function RouteMap({ route, regionsBySlug }: { route: Stop[]; regionsBySlug: Record<string, any> }) {
  const pts = route.filter((s) => s.x != null && s.y != null);
  if (pts.length === 0) return <div className="route-map empty-map">No map coordinates for these stops yet.</div>;
  const xs = pts.map((s) => s.x as number), ys = pts.map((s) => s.y as number);
  let minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = Math.max(maxX - minX, 8), h = Math.max(maxY - minY, 8), pad = Math.max(w, h) * 0.32 + 12;
  minX -= pad; minY -= pad;
  const vw = w + 2 * pad, vh = h + 2 * pad;
  const S = Math.max(vw, vh);
  const involved = [...new Set(route.map((s) => s.region))].map((slug) => regionsBySlug[slug]).filter(Boolean);
  const line = pts.map((s) => `${s.x},${s.y}`).join("L");
  return (
    <div className="route-map">
      <svg viewBox={`${minX} ${minY} ${vw} ${vh}`} preserveAspectRatio="xMidYMid meet">
        {involved.map((r) => <path key={r.slug} d={r.geoPath} fill={r.color} fillOpacity={0.12} stroke={r.color} strokeOpacity={0.4} strokeWidth={S / 320} />)}
        {pts.length > 1 && <path d={`M${line}`} fill="none" stroke="#6b1f2e" strokeWidth={S / 150} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${S / 55} ${S / 80}`} />}
        {pts.map((s) => (
          <g key={s.id}>
            <circle cx={s.x} cy={s.y} r={S / 42} fill="#6b1f2e" stroke="#fff" strokeWidth={S / 260} />
            <text x={s.x} y={(s.y as number) + S / 95} fontSize={S / 52} fill="#fff" textAnchor="middle" fontFamily="sans-serif" fontWeight="700">{route.indexOf(s) + 1}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
