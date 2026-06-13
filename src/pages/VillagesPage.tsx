import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { norm } from "../lib/ui";

export default function VillagesPage() {
  const regions = useQuery(api.wine.listRegions);
  const [region, setRegion] = useState("all");
  const [q, setQ] = useState("");
  const villages = useQuery(api.wine.listVillages, { region: region === "all" ? undefined : region });
  const nav = useNavigate();
  const colorBy = (slug: string) => regions?.find((r) => r.slug === slug)?.color || "#8a3324";
  const list = (villages ?? []).filter((v) => !q || norm(v.name + " " + v.regionName + " " + (v.commune || "")).includes(norm(q)));
  return (
    <div className="page">
      <div className="page-head">
        <div className="kicker">The Almanac</div>
        <h1>Wine Villages &amp; Towns</h1>
        <p className="lede">The key communes of each region — the places the wine roads run through, geolocated to their official commune centres.</p>
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
      <div className="resultcount ui">{villages ? `${list.length} villages` : "Loading…"}</div>
      <div className="tablewrap">
        <table className="data">
          <thead><tr><th>Village</th><th>Region</th><th>Official commune</th></tr></thead>
          <tbody>
            {list.map((v) => (
              <tr key={v._id} onClick={() => nav(`/?region=${v.regionSlug}&village=${encodeURIComponent(v.name)}`)}>
                <td><span className="cellname">{v.name}</span></td>
                <td><span className="swatch" style={{ background: colorBy(v.regionSlug) }} />{v.regionName}</td>
                <td className="muted">{v.commune || v.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
