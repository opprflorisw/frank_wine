import { useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Icon } from "../lib/ui";

function visitTag(v: string): [string, string] {
  const s = (v || "").toLowerCase();
  if (s.includes("appointment")) return ["v-appt", "By appt"];
  if (s.includes("walk-in") || s.includes("no booking") || s.includes("daily") || s.includes("open")) return ["v-walk", "Walk-in"];
  return ["v-book", "Booking"];
}

export default function TripsPage() {
  const [params] = useSearchParams();
  const regions = useQuery(api.wine.listRegions);
  const trips = useQuery(api.wine.listTrips, {});
  const [region, setRegion] = useState(params.get("region") || "all");
  const [sel, setSel] = useState(0);

  const colorBy = (slug: string) => regions?.find((r) => r.slug === slug)?.color || "#8a3324";
  const geoBy = (slug: string) => regions?.find((r) => r.slug === slug)?.geoPath || "";
  const list = useMemo(
    () => (trips ?? []).filter((t) => region === "all" || t.regionSlug === region),
    [trips, region],
  );
  const t = list[sel];

  return (
    <div className="page">
      <div className="page-head">
        <div className="kicker">The Almanac</div>
        <h1>Wine Trips</h1>
        <p className="lede">Curated tasting road-trips built only from estates and cellars that genuinely welcome visitors. Pick one and follow the route.</p>
      </div>
      <div className="caveat ui"><Icon name="star" size={15} /><div>Every stop receives visitors (walk-in, tours, or by appointment) — opening times change seasonally, so always confirm and book ahead.</div></div>
      <div className="toolbar ui">
        <label>Region</label>
        <select className="sel" value={region} onChange={(e) => { setRegion(e.target.value); setSel(0); }}>
          <option value="all">All regions</option>
          {(regions ?? []).filter((r) => r.tripCount > 0).map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
        </select>
        <span className="muted ui" style={{ fontSize: 12 }}>{list.length} trips</span>
      </div>

      <div className="tlayout">
        <div className="tlist">
          {list.map((tr, i) => (
            <div key={tr._id} className={`tcard ${i === sel ? "active" : ""}`} style={{ borderLeftColor: colorBy(tr.regionSlug) }} onClick={() => setSel(i)}>
              <div className="rg">{tr.regionName}</div>
              <h3>{tr.name}</h3>
              <div className="meta"><span><Icon name="cal" size={13} /> {tr.days} day{tr.days > 1 ? "s" : ""}</span><span><Icon name="pin" size={13} /> {tr.stops.length} stops</span><span>{tr.driving}</span></div>
            </div>
          ))}
        </div>
        {t && <TripDetail trip={t} color={colorBy(t.regionSlug)} geoPath={geoBy(t.regionSlug)} />}
      </div>
    </div>
  );
}

function TripDetail({ trip, color, geoPath }: { trip: any; color: string; geoPath: string }) {
  const bb = trip.bbox as number[];
  const S = Math.max(bb[2], bb[3]) || 60;
  const pad = S * 0.25;
  const vb = `${bb[0] - pad} ${bb[1] - pad} ${bb[2] + 2 * pad} ${bb[3] + 2 * pad}`;
  const days = [...new Set(trip.stops.map((s: any) => s.day))].sort() as number[];
  const seen: Record<string, number> = {};
  return (
    <div className="tdetail">
      <div className="tdhead">
        <div className="rg">{trip.regionName} · Wine trip</div>
        <h2 style={{ color }}>{trip.name}</h2>
        <div className="meta">
          <span><Icon name="cal" size={13} /> <b>{trip.days}</b> days</span>
          <span><Icon name="pin" size={13} /> based in <b>{trip.basedIn}</b></span>
          <span><Icon name="star" size={13} /> best <b>{trip.bestSeason}</b></span>
          <span><Icon name="route" size={13} /> {trip.driving}</span>
        </div>
        <p>{trip.summary}</p>
      </div>
      <div className="tmap">
        <svg viewBox={vb} preserveAspectRatio="xMidYMid meet">
          <path d={geoPath} fill={color} fillOpacity={0.13} stroke={color} strokeOpacity={0.45} strokeWidth={S / 240} />
          {trip.route?.length > 1 && (
            <path d={`M${trip.route.map((p: number[]) => p.join(",")).join("L")}`} fill="none" stroke={color} strokeWidth={S / 120} strokeLinecap="round" strokeDasharray={`${S / 55} ${S / 85}`} />
          )}
          {trip.stops.map((s: any, i: number) => {
            if (s.x == null) return null;
            const k = s.x + "," + s.y;
            const o = (seen[k] = (seen[k] || 0) + 1) - 1;
            const ox = o * S / 30;
            return (
              <g key={i}>
                <circle cx={s.x + ox} cy={s.y} r={S / 40} fill={color} stroke="#fff" strokeWidth={S / 220} />
                <text x={s.x + ox} y={s.y + S / 85} fontSize={S / 50} fill="#fff" textAnchor="middle" fontFamily="sans-serif" fontWeight="700">{i + 1}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="titin">
        {days.map((d) => (
          <div key={d}>
            <div className="dayh"><Icon name="cal" size={13} /> Day {d}</div>
            {trip.stops.map((s: any, i: number) => ({ s, i })).filter((o: any) => o.s.day === d).map(({ s, i }: any) => {
              const vt = visitTag(s.visit);
              return (
                <div key={i} className="stop">
                  <div className="stopn" style={{ background: color }}>{i + 1}</div>
                  <div>
                    <div className="snm">{s.name}<span className={`visittag ${vt[0]}`}>{vt[1]}</span></div>
                    <div className="svisit">{s.town} — {s.visit}</div>
                    {s.note && <div className="snote">{s.note}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="tdactions">
        <Link className="btn" to={`/?region=${trip.regionSlug}`}><Icon name="map" size={14} /> See region map</Link>
        <Link className="btn" to={`/houses?region=${trip.regionSlug}`}><Icon name="bottle" size={14} /> Region's houses</Link>
      </div>
    </div>
  );
}
