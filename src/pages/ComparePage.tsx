import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { BackBar, TypeBadge, GrapeDot } from "../lib/ui";

const MAX = 3;

export default function ComparePage() {
  const regions = useQuery(api.wine.listRegions);
  const [params, setParams] = useSearchParams();
  const initial = (params.get("regions") || "").split(",").filter(Boolean);
  const [picked, setPicked] = useState<string[]>(initial);

  if (!regions) return <div className="page"><div className="empty">Loading…</div></div>;

  function toggle(slug: string) {
    setPicked((p) => {
      const next = p.includes(slug) ? p.filter((s) => s !== slug) : p.length < MAX ? [...p, slug] : p;
      setParams(next.length ? { regions: next.join(",") } : {}, { replace: true });
      return next;
    });
  }
  const cols = picked.map((s) => regions.find((r) => r.slug === s)!).filter(Boolean);
  const score = (v?: number) => (v != null ? v.toFixed(1) : "—");
  const topGrapes = (r: any) => (r.grapeCounts || []).slice().sort((a: any, b: any) => b.count - a.count).slice(0, 5).map((g: any) => g.name);
  const best = (key: "overallScore" | "terroirScore" | "visitScore") => Math.max(...cols.map((c) => c[key] ?? 0));

  const ROWS: { label: string; key?: "overallScore" | "terroirScore" | "visitScore"; render: (r: any) => ReactNode }[] = [
    { label: "Overall", key: "overallScore", render: (r) => <b className="cmp-score">{score(r.overallScore)}</b> },
    { label: "Terroir & climate", key: "terroirScore", render: (r) => <b className="cmp-score">{score(r.terroirScore)}</b> },
    { label: "Visit experience", key: "visitScore", render: (r) => <b className="cmp-score">{score(r.visitScore)}</b> },
    { label: "Wine houses", render: (r) => <Link to={`/houses?region=${r.slug}`}>{r.houseCount}</Link> },
    { label: "Villages", render: (r) => r.villageCount },
    { label: "Wine trips", render: (r) => (r.tripCount ? <Link to={`/trips?region=${r.slug}`}>{r.tripCount}</Link> : "—") },
    { label: "Wine types", render: (r) => <div className="cmp-chips">{(r.types || []).map((t: string) => <TypeBadge key={t} t={t} />)}</div> },
    { label: "Signature grapes", render: (r) => <div className="cmp-chips">{topGrapes(r).map((g: string) => <span key={g} className="tag"><GrapeDot name={g} />{g}</span>)}</div> },
    { label: "Classification", render: (r) => <span className="cmp-cls">{r.classification}</span> },
    { label: "In a nutshell", render: (r) => <span className="cmp-sum">{r.summary}</span> },
  ];

  return (
    <div className="page">
      <BackBar crumbs={[{ label: "Map", to: "/" }, { label: "Compare" }]} />
      <div className="page-head">
        <div className="kicker">The Almanac</div>
        <h1>Compare Regions</h1>
        <p className="lede">Put up to three regions side by side — scores, grapes, classification and character. Pick regions below.</p>
      </div>

      <div className="cmp-pick">
        {regions.map((r) => (
          <button key={r.slug} className={`chip ${picked.includes(r.slug) ? "on" : ""}`}
            disabled={!picked.includes(r.slug) && picked.length >= MAX}
            onClick={() => toggle(r.slug)} style={picked.includes(r.slug) ? { borderColor: r.color } : undefined}>
            <span className="dot" style={{ background: r.color }} />{r.name}
          </button>
        ))}
      </div>

      {cols.length === 0 ? (
        <div className="empty"><p>Select up to three regions to compare.</p></div>
      ) : (
        <div className="tablewrap cmp-wrap">
          <table className="data cmp">
            <thead>
              <tr>
                <th />
                {cols.map((r) => (
                  <th key={r.slug} style={{ borderTop: `3px solid ${r.color}` }}>
                    <Link to={`/?region=${r.slug}`} style={{ color: r.color }}>{r.name}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <td className="cmp-rowh">{row.label}</td>
                  {cols.map((r) => {
                    const isBest = row.key && cols.length > 1 && (r[row.key] ?? 0) === best(row.key) && (r[row.key] ?? 0) > 0;
                    return <td key={r.slug} className={isBest ? "cmp-best" : ""}>{row.render(r)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
