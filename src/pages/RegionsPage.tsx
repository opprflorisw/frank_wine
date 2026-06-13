import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { TypeBadge, GrapePill, Icon, norm } from "../lib/ui";
import { openChat } from "../lib/chat";

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
        <p className="lede">All thirteen major wine regions — wine styles, houses, villages and signature grapes. Click a region to open it on the map, or jump straight to its houses, trips or grapes.</p>
      </div>
      <div className="toolbar ui">
        <div className="field grow"><span className="mag">🔍</span>
          <input className="search" placeholder="Search regions, grapes…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <div className="resultcount ui">{list.length} regions</div>
      <div className="grid">
        {list.map((r) => {
          const open = () => nav(`/?region=${r.slug}`);
          return (
            <div
              key={r.slug}
              className="rcardL"
              role="button"
              tabIndex={0}
              title={`Open ${r.name} on the map`}
              onClick={open}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
            >
              <div className="top" style={{ background: r.color }} />
              <div className="body">
                <h3 style={{ color: r.color }}>{r.name}</h3>
                <div className="sm">{r.houseCount} houses · {r.villageCount} villages · {r.subAppellations.length} appellations</div>
                <p>{r.summary.slice(0, 150)}…</p>
                <div className="foot">{r.types.map((t) => <TypeBadge key={t} t={t} />)}</div>
                {r.grapes.length > 0 && (
                  <div
                    className="grapes-row"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {r.grapes.slice(0, 6).map((g) => (
                      <GrapePill key={g} name={g} onClick={() => nav(`/houses?region=${r.slug}&grape=${encodeURIComponent(g)}`)} />
                    ))}
                  </div>
                )}
                <div
                  className="cardactions ui"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <Link className="btn sm" to={`/houses?region=${r.slug}`} title={`All houses in ${r.name}`}><Icon name="bottle" size={13} /> Houses</Link>
                  <Link className="btn sm" to={`/trips?region=${r.slug}`} title={`Wine trips in ${r.name}`}><Icon name="route" size={13} /> Trips</Link>
                  <button type="button" className="btn sm" title={`Ask the sommelier about ${r.name}`}
                    onClick={() => openChat(`Tell me about ${r.name} — its terroir, signature grapes, top houses to visit and a good wine trip.`)}>
                    <Icon name="chat" size={13} /> Ask
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
