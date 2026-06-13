import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { norm, GrapeDot, BackBar } from "../lib/ui";

export default function GrapesPage() {
  const grapes = useQuery(api.wine.listGrapes);
  const regions = useQuery(api.wine.listRegions);
  const [q, setQ] = useState("");
  const [colour, setColour] = useState("all");
  const nav = useNavigate();
  const slugByName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of regions ?? []) m[r.name] = r.slug;
    return m;
  }, [regions]);
  if (!grapes) return <div className="page"><div className="empty">Loading…</div></div>;
  const list = grapes.filter((g) =>
    (colour === "all" || g.color === colour) &&
    (!q || norm(g.name + " " + g.regions.join(" ")).includes(norm(q))));
  return (
    <div className="page">
      <BackBar crumbs={[{ label: "Map", to: "/" }, { label: "Grapes" }]} />
      <div className="page-head">
        <div className="kicker">The Almanac</div>
        <h1>Grape Varieties</h1>
        <p className="lede">Every grape worked by the houses in this atlas — where it grows and who champions it. Click a grape to see its producers, or jump to a region or a single producer.</p>
      </div>
      <div className="toolbar ui">
        <div className="field grow"><span className="mag">🔍</span>
          <input className="search" placeholder="Search grapes…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <label>Colour</label>
        <div className="chips">
          {[["all", "All"], ["red", "Red"], ["white", "White"]].map(([v, l]) => (
            <button key={v} className={`chip ${colour === v ? "on" : ""}`} onClick={() => setColour(v)}>
              {v !== "all" && <span className="dot" style={{ background: v === "red" ? "#7b2d3b" : "#cda84e" }} />}{l}
            </button>
          ))}
        </div>
      </div>
      <div className="resultcount ui">{list.length} grape varieties</div>
      <div className="tablewrap">
        <table className="data">
          <thead><tr><th>Grape</th><th>Colour</th><th>Regions</th><th>Houses</th><th>Notable producers</th></tr></thead>
          <tbody>
            {list.map((g) => {
              const toGrape = `/houses?grape=${encodeURIComponent(g.name)}`;
              return (
                <tr key={g.name} className="row-click" title={`See producers of ${g.name}`}
                  role="button" tabIndex={0}
                  onClick={() => nav(toGrape)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); nav(toGrape); } }}>
                  <td className="cell-title"><GrapeDot name={g.name} /><span className="cellname">{g.name}</span></td>
                  <td className="muted" data-label="Colour">{g.color === "red" ? "Red grape" : "White grape"}</td>
                  <td data-label="Regions" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    {g.regions.slice(0, 4).map((x) => {
                      const slug = slugByName[x];
                      return slug
                        ? <Link key={x} className="tag tag-link" to={`/houses?region=${slug}`} title={`Houses in ${x}`}>{x}</Link>
                        : <span key={x} className="tag">{x}</span>;
                    })}
                    {g.regions.length > 4 && <span className="muted"> +{g.regions.length - 4}</span>}
                  </td>
                  <td data-label="Houses"><span className="count-pill">{g.houses}</span></td>
                  <td className="cellsub" data-label="Notable producers" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    {g.examples.map((name, i) => (
                      <span key={name}>
                        {i > 0 && ", "}
                        <Link className="prod-link" to={`/houses?q=${encodeURIComponent(name)}`} title={`Find ${name}`}>{name}</Link>
                      </span>
                    ))}
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
