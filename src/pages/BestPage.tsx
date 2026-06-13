import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Icon } from "../lib/ui";

function Bar({ v, color }: { v: number; color: string }) {
  return (
    <span className="scorebar">
      <span className="track"><span className="fill" style={{ width: `${(v / 10) * 100}%`, background: color }} /></span>
      <span className="v">{v.toFixed(1)}</span>
    </span>
  );
}

export default function BestPage() {
  const regions = useQuery(api.wine.listRegions);
  const [sortK, setSortK] = useState<"overallScore" | "terroirScore" | "visitScore">("overallScore");
  const [open, setOpen] = useState<string | null>(null);
  if (!regions) return <div className="page"><div className="empty">Loading…</div></div>;
  const rows = regions.filter((r) => r.terroirScore != null).sort((a, b) => (b[sortK] || 0) - (a[sortK] || 0));
  return (
    <div className="page">
      <div className="page-head">
        <div className="kicker">The Almanac</div>
        <h1>Best Regions — a Scorecard</h1>
        <p className="lede">France's wine regions rated on two axes: <b>Terroir &amp; climate</b> and <b>Visit experience</b>. Sort by any column; expand a row for the climate profile.</p>
      </div>
      <div className="infonote ui"><Icon name="star" size={15} /><div>Scores are an informed editorial model, not absolute truth. Use them as a guide.</div></div>
      <div className="toolbar ui">
        <label>Sort by</label>
        <select className="sel" value={sortK} onChange={(e) => setSortK(e.target.value as any)}>
          <option value="overallScore">Overall</option>
          <option value="terroirScore">Terroir &amp; climate</option>
          <option value="visitScore">Visit experience</option>
        </select>
      </div>
      <div className="tablewrap">
        <table className="data">
          <thead><tr><th style={{ width: 30 }}>#</th><th>Region</th><th>Terroir &amp; climate</th><th>Visit experience</th><th>Overall</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <>
                <tr key={r.slug} className={open === r.slug ? "exp" : ""} onClick={() => setOpen(open === r.slug ? null : r.slug)}>
                  <td><span className="rank">{i + 1}</span></td>
                  <td><span className="swatch" style={{ background: r.color }} /><span className="cellname">{r.name}</span></td>
                  <td><Bar v={r.terroirScore!} color="#8a3324" /></td>
                  <td><Bar v={r.visitScore!} color="#3f7d8c" /></td>
                  <td><Bar v={r.overallScore!} color={r.color!} /></td>
                </tr>
                {open === r.slug && (
                  <tr key={r.slug + "-d"} className="detail-row">
                    <td colSpan={5}>
                      <div className="detailbox">
                        <div>
                          <p>{r.profile}</p>
                          <h4>Climate &amp; terroir</h4>
                          <dl className="facts">
                            <dt>Climate</dt><dd>{r.climate?.climateType} · {r.climate?.latitude}</dd>
                            <dt>Soils</dt><dd>{r.climate?.soils}</dd>
                            <dt>Season</dt><dd>{r.climate?.growingSeason}</dd>
                            <dt>Rainfall</dt><dd>{r.climate?.rainfall}</dd>
                            <dt>Vintages</dt><dd>{r.climate?.vintageConsistency}</dd>
                          </dl>
                        </div>
                        <div>
                          <h4>Visiting</h4>
                          <dl className="facts">
                            <dt>Best months</dt><dd>{r.visit?.bestMonths}</dd>
                            <dt>Scenery</dt><dd>{r.visit?.scenery}</dd>
                            <dt>Getting there</dt><dd>{r.visit?.accessibility}</dd>
                            <dt>Estates</dt><dd>{r.visit?.visitableDensity} density of welcoming estates</dd>
                            <dt>Base town</dt><dd>{r.visit?.baseTown}</dd>
                          </dl>
                          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                            <Link className="btn" to={`/?region=${r.slug}`}><Icon name="map" size={14} /> On the map</Link>
                            {r.tripCount > 0 && <Link className="btn primary" to={`/trips?region=${r.slug}`}><Icon name="route" size={14} /> Plan a trip</Link>}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
