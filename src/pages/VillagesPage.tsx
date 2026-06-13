import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { norm, BackBar, RemovableChip, Icon } from "../lib/ui";

export default function VillagesPage() {
  const [params] = useSearchParams();
  const regions = useQuery(api.wine.listRegions);
  const [region, setRegion] = useState(params.get("region") || "all");
  const [q, setQ] = useState("");
  const villages = useQuery(api.wine.listVillages, { region: region === "all" ? undefined : region });
  const nav = useNavigate();
  const colorBy = (slug: string) => regions?.find((r) => r.slug === slug)?.color || "#8a3324";
  const nameBy = (slug: string) => regions?.find((r) => r.slug === slug)?.name || slug;
  const list = (villages ?? []).filter((v) => !q || norm(v.name + " " + v.regionName + " " + (v.commune || "")).includes(norm(q)));
  return (
    <div className="page">
      <BackBar crumbs={[{ label: "Map", to: "/" }, { label: "Villages" }]} />
      <div className="page-head">
        <div className="kicker">The Almanac</div>
        <h1>Wine Villages &amp; Towns</h1>
        <p className="lede">The key communes of each region — the places the wine roads run through, geolocated to their official commune centres. Click a village for the map, or jump to its region's houses.</p>
      </div>
      <div className="toolbar ui">
        <div className="field grow"><span className="mag">🔍</span>
          <input className="search" placeholder="Search villages…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <label>Region</label>
        <select className="sel" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="all">All regions</option>
          {(regions ?? []).map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
        </select>
      </div>
      {region !== "all" && (
        <div className="activefilters ui">
          <span className="af-label">Filtered:</span>
          <RemovableChip label="Region" value={nameBy(region)} onRemove={() => setRegion("all")} />
        </div>
      )}
      <div className="resultcount ui">{villages ? `${list.length} villages` : "Loading…"}</div>
      <div className="tablewrap">
        <table className="data">
          <thead><tr><th>Village</th><th>Region</th><th>Official commune</th><th aria-label="Actions" /></tr></thead>
          <tbody>
            {list.map((v) => {
              const toMap = `/?region=${v.regionSlug}&village=${encodeURIComponent(v.name)}`;
              return (
                <tr key={v._id} className="row-click" title={`Show ${v.name} on the map`}
                  onClick={() => nav(toMap)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); nav(toMap); } }}
                  tabIndex={0} role="button">
                  <td className="cell-title"><span className="cellname">{v.name}</span></td>
                  <td data-label="Region" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <Link className="region-link" to={`/houses?region=${v.regionSlug}`} title={`Houses in ${v.regionName}`}>
                      <span className="swatch" style={{ background: colorBy(v.regionSlug) }} />{v.regionName}
                    </Link>
                  </td>
                  <td className="muted" data-label="Commune">{v.commune || v.name}</td>
                  <td className="actcell" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <Link className="btn sm" to={`/houses?region=${v.regionSlug}`} title={`Houses in ${v.regionName}`}><Icon name="bottle" size={13} /> Houses</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
