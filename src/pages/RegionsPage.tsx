import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { TypeBadge, norm } from "../lib/ui";

export default function RegionsPage() {
  const regions = useQuery(api.wine.listRegions);
  const [q, setQ] = useState("");
  const nav = useNavigate();
  if (!regions) return <div className="page"><div className="empty">Loading…</div></div>;
  const list = regions.filter((r) => !q || norm(r.name + " " + r.grapes.join(" ")).includes(norm(q)));
  return (
    <div className="page">
      <div className="page-head">
        <div className="kicker">The Almanac</div>
        <h1>Wine Regions of France</h1>
        <p className="lede">All thirteen major wine regions — wine styles, houses, villages and signature grapes. Click a region to open it on the map.</p>
      </div>
      <div className="toolbar ui">
        <div className="field grow"><span className="mag">🔍</span>
          <input className="search" placeholder="Search regions, grapes…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <div className="resultcount ui">{list.length} regions</div>
      <div className="grid">
        {list.map((r) => (
          <div key={r.slug} className="rcardL" onClick={() => nav(`/?region=${r.slug}`)}>
            <div className="top" style={{ background: r.color }} />
            <div className="body">
              <h3 style={{ color: r.color }}>{r.name}</h3>
              <div className="sm">{r.houseCount} houses · {r.villageCount} villages · {r.subAppellations.length} appellations</div>
              <p>{r.summary.slice(0, 150)}…</p>
              <div className="foot">{r.types.map((t) => <TypeBadge key={t} t={t} />)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
