import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Icon, BackBar } from "../lib/ui";
import { openChat } from "../lib/chat";
import { RouteButton } from "../components/RouteControls";
import { addStop } from "../lib/route";

const roleColor: Record<string, string> = {
  start: "#3f6b46", finish: "#7b2d3b", tasting: "#b8893b", "cellar visit": "#b8893b",
  lunch: "#c4822f", viewpoint: "#4a6a9c", village: "#7d7461",
};

export default function RoutesPage() {
  const [params] = useSearchParams();
  const routes = useQuery(api.wine.listRoutes, {});
  const map = useQuery(api.wine.mapData);
  const regionsBySlug = useMemo(() => {
    const m: Record<string, any> = {};
    for (const r of map?.regions ?? []) m[r.slug] = r;
    return m;
  }, [map]);

  if (!routes) return <div className="page"><div className="empty">Loading routes…</div></div>;

  const id = params.get("id");
  const selected = id ? routes.find((r) => r._id === id) : null;

  if (selected) {
    return (
      <div className="page route-page">
        <BackBar crumbs={[{ label: "Map", to: "/" }, { label: "Wine Routes", to: "/routes" }, { label: selected.name }]} />
        <RouteDetail route={selected} region={regionsBySlug[selected.regionSlug]} />
      </div>
    );
  }

  // group by region
  const byRegion: Record<string, any[]> = {};
  for (const r of routes) (byRegion[r.regionName] ??= []).push(r);

  return (
    <div className="page route-page">
      <BackBar crumbs={[{ label: "Map", to: "/" }, { label: "Wine Routes" }]} />
      <div className="page-head">
        <div className="kicker">The Almanac</div>
        <h1>Scenic Wine Routes</h1>
        <p className="lede">France's great named driving routes — the Route des Grands Crus, the Route des Vins d'Alsace, the Médoc châteaux and more — each with its real villages, estates and stops. Tap one to follow it, or send its stops to your own route.</p>
      </div>

      {Object.keys(byRegion).map((region) => (
        <div key={region} className="rtgroup">
          <h2 className="rtgroup-h">{region}</h2>
          <div className="rtcards">
            {byRegion[region].map((r) => {
              const c = regionsBySlug[r.regionSlug]?.color || "#8a3324";
              return (
                <Link key={r._id} className="rtcard" to={`/routes?id=${r._id}`} style={{ borderLeftColor: c }}>
                  <div className="rtc-name">{r.name}</div>
                  {r.subtitle && <div className="rtc-sub">{r.subtitle}</div>}
                  <div className="rtc-meta">
                    {r.lengthKm ? <span><Icon name="route" size={12} /> {r.lengthKm} km</span> : null}
                    {r.driveTime ? <span><Icon name="cal" size={12} /> {r.driveTime}</span> : null}
                    <span><Icon name="pin" size={12} /> {r.stops.length} stops</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function RouteDetail({ route, region }: { route: any; region: any }) {
  const color = region?.color || "#8a3324";
  function addAllHouses() {
    for (const s of route.stops) {
      if (s.kind === "house" && s.houseId && s.x != null) {
        addStop({ id: s.houseId, name: s.name, town: s.town, region: route.regionSlug, regionName: route.regionName, x: s.x, y: s.y, lat: s.lat, lon: s.lon });
      }
    }
  }
  const houseCount = route.stops.filter((s: any) => s.kind === "house" && s.houseId).length;
  return (
    <div className="rtdetail">
      <div className="rtd-head" style={{ borderTopColor: color }}>
        <div className="rtd-region"><Link to={`/?region=${route.regionSlug}`} style={{ color }}>{route.regionName}</Link> · Scenic wine route</div>
        <h1 style={{ color }}>{route.name}</h1>
        {route.subtitle && <p className="rtd-sub">{route.subtitle}</p>}
        <div className="rtd-meta">
          {route.lengthKm ? <span><Icon name="route" size={14} /> <b>{route.lengthKm}</b> km</span> : null}
          {route.driveTime ? <span><Icon name="cal" size={14} /> {route.driveTime}</span> : null}
          {route.bestSeason ? <span><Icon name="star" size={14} /> best {route.bestSeason}</span> : null}
          <span><Icon name="pin" size={14} /> {route.stops.length} stops</span>
        </div>
        <p className="rtd-summary">{route.summary}</p>
        {route.highlights?.length ? <div className="rtd-highlights">{route.highlights.map((h: string) => <span key={h} className="hl-chip">{h}</span>)}</div> : null}
      </div>

      <RouteSvg route={route} color={color} geoPath={region?.geoPath} />

      <ol className="rtd-stops">
        {route.stops.map((s: any, i: number) => {
          const rc = roleColor[(s.role || "").toLowerCase()] || color;
          const isHouse = s.kind === "house" && s.houseId;
          return (
            <li key={i} className="rtd-stop">
              <div className="rsn" style={{ background: color }}>{i + 1}</div>
              <div className="rtd-sbody">
                <div className="rtd-sname">
                  {isHouse
                    ? <Link to={`/?region=${route.regionSlug}`} title={`See ${s.name}`}>{s.name}</Link>
                    : <span>{s.name}</span>}
                  {s.role && <span className="role-tag" style={{ background: rc }}>{s.role}</span>}
                  {s.kind === "house" && <span className="kind-tag">Estate</span>}
                </div>
                {s.town && <div className="rtd-stown">{s.town}</div>}
                {s.note && <div className="rtd-snote">{s.note}</div>}
              </div>
              {isHouse && s.x != null && (
                <RouteButton compact stop={{ id: s.houseId, name: s.name, town: s.town, region: route.regionSlug, regionName: route.regionName, x: s.x, y: s.y, lat: s.lat, lon: s.lon }} />
              )}
            </li>
          );
        })}
      </ol>

      <div className="route-actions ui">
        {houseCount > 0 && <button className="btn primary" onClick={addAllHouses}><Icon name="route" size={14} /> Add {houseCount} estates to my route</button>}
        <button className="btn" onClick={() => openChat(`Tell me about driving the "${route.name}" in ${route.regionName} — what to see, where to taste and eat, and tips for the route.`)}><Icon name="chat" size={14} /> Ask Franky</button>
        <Link className="btn" to={`/?region=${route.regionSlug}`}><Icon name="map" size={14} /> See region map</Link>
      </div>
    </div>
  );
}

function RouteSvg({ route, color, geoPath }: { route: any; color: string; geoPath?: string }) {
  const pts = (route.path as number[][]) || [];
  if (pts.length < 2 && !geoPath) return null;
  const bb = route.bbox as number[];
  const S = Math.max(bb[2], bb[3]) || 60;
  const pad = S * 0.3 + 10;
  const vb = `${bb[0] - pad} ${bb[1] - pad} ${bb[2] + 2 * pad} ${bb[3] + 2 * pad}`;
  let n = 0;
  return (
    <div className="rtd-map">
      <svg viewBox={vb} preserveAspectRatio="xMidYMid meet">
        {geoPath && <path d={geoPath} fill={color} fillOpacity={0.1} stroke={color} strokeOpacity={0.4} strokeWidth={S / 260} />}
        {pts.length > 1 && <path d={`M${pts.map((p) => p.join(",")).join("L")}`} fill="none" stroke={color} strokeWidth={S / 130} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${S / 50} ${S / 75}`} />}
        {route.stops.map((s: any, i: number) => {
          if (s.x == null) return null;
          n++;
          return (
            <g key={i}>
              <circle cx={s.x} cy={s.y} r={S / 38} fill={color} stroke="#fff" strokeWidth={S / 240} />
              <text x={s.x} y={s.y + S / 88} fontSize={S / 48} fill="#fff" textAnchor="middle" fontFamily="sans-serif" fontWeight="700">{i + 1}</text>
            </g>
          );
        })}
        {n === 0 ? null : null}
      </svg>
    </div>
  );
}
