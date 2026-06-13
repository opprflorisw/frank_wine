import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Badge, TypeBadge, TypeDot, TYPE_ORDER, classBadge } from "../lib/ui";

export default function HousesPage() {
  const [params] = useSearchParams();
  const regions = useQuery(api.wine.listRegions);
  const [region, setRegion] = useState(params.get("region") || "all");
  const [grape, setGrape] = useState(params.get("grape") || "all");
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");

  const houses = useQuery(api.wine.listHouses, {
    region: region === "all" ? undefined : region,
    grape: grape === "all" ? undefined : grape,
    type: type === "all" ? undefined : type,
    search: q.trim() || undefined,
  });
  const grapeOpts = useMemo(
    () => [...new Set((regions ?? []).flatMap((r) => r.grapes))].sort(),
    [regions],
  );
  const colorBy = (slug: string) => regions?.find((r) => r.slug === slug)?.color || "#8a3324";

  return (
    <div className="page">
      <div className="page-head">
        <div className="kicker">The Almanac</div>
        <h1>Wine Houses &amp; Estates</h1>
        <p className="lede">Every curated producer across France — filter by region, wine type or grape, all live from the database.</p>
      </div>
      <div className="toolbar ui">
        <div className="field grow"><span className="mag">🔍</span>
          <input className="search" placeholder="Search houses, appellations…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <label>Region</label>
        <select className="sel" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="all">All regions</option>
          {(regions ?? []).map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
        </select>
        <label>Grape</label>
        <select className="sel" value={grape} onChange={(e) => setGrape(e.target.value)}>
          <option value="all">All grapes</option>
          {grapeOpts.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div className="toolbar ui" style={{ top: 112 }}>
        <label>Wine type</label>
        <div className="chips">
          {["all", ...TYPE_ORDER].map((t) => (
            <button key={t} className={`chip ${type === t ? "on" : ""}`} onClick={() => setType(t)}>
              {t === "all" ? "All" : <><TypeDot t={t} />{t}</>}
            </button>
          ))}
        </div>
      </div>
      <div className="resultcount ui">{houses ? `${houses.length} houses` : "Loading…"}</div>
      <div className="tablewrap">
        <table className="data">
          <thead><tr><th>House</th><th>Region</th><th>Appellation</th><th>Class</th><th>Wines</th><th>Grapes</th></tr></thead>
          <tbody>
            {(houses ?? []).map((h) => (
              <tr key={h._id}>
                <td><div className="cellname">{h.name}</div>{h.flagship && <div className="cellsub muted">{h.flagship}</div>}</td>
                <td><span className="swatch" style={{ background: colorBy(h.regionSlug) }} />{h.regionName}</td>
                <td>{h.appellation}</td>
                <td>{classBadge(h.classification) ? <Badge cls={h.classification} /> : <span className="muted">—</span>}</td>
                <td>{(h.types || []).map((t) => <TypeBadge key={t} t={t} />)}</td>
                <td>{(h.grapes || []).map((g) => <span key={g} className="tag">{g}</span>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
