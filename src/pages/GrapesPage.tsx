import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { norm, GrapeDot } from "../lib/ui";

export default function GrapesPage() {
  const grapes = useQuery(api.wine.listGrapes);
  const [q, setQ] = useState("");
  const [colour, setColour] = useState("all");
  const nav = useNavigate();
  if (!grapes) return <div className="page"><div className="empty">Loading…</div></div>;
  const list = grapes.filter((g) =>
    (colour === "all" || g.color === colour) &&
    (!q || norm(g.name + " " + g.regions.join(" ")).includes(norm(q))));
  return (
    <div className="page">
      <div className="page-head">
        <div className="kicker">The Almanac</div>
        <h1>Grape Varieties</h1>
        <p className="lede">Every grape worked by the houses in this atlas — where it grows and who champions it. Click a grape to see its producers.</p>
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
            {list.map((g) => (
              <tr key={g.name} className="row-click" onClick={() => nav(`/houses?grape=${encodeURIComponent(g.name)}`)}>
                <td><GrapeDot name={g.name} /><span className="cellname">{g.name}</span></td>
                <td className="muted">{g.color === "red" ? "Red grape" : "White grape"}</td>
                <td>{g.regions.slice(0, 4).map((x) => <span key={x} className="tag">{x}</span>)}{g.regions.length > 4 && <span className="muted"> +{g.regions.length - 4}</span>}</td>
                <td><span className="count-pill">{g.houses}</span></td>
                <td className="cellsub">{g.examples.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
