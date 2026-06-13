import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Badge, TypeBadge, TypeDot, GrapeDot, GrapePill, Icon, BackBar, RemovableChip, TYPE_ORDER, classBadge } from "../lib/ui";
import { openChat } from "../lib/chat";

export default function HousesPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const regions = useQuery(api.wine.listRegions);
  const [region, setRegion] = useState(params.get("region") || "all");
  const [grape, setGrape] = useState(params.get("grape") || "all");
  const [type, setType] = useState(params.get("type") || "all");
  const [q, setQ] = useState(params.get("q") || "");
  const [appellation, setAppellation] = useState(params.get("appellation") || "");
  const [open, setOpen] = useState<string | null>(null);

  const rawHouses = useQuery(api.wine.listHouses, {
    region: region === "all" ? undefined : region,
    grape: grape === "all" ? undefined : grape,
    type: type === "all" ? undefined : type,
    search: q.trim() || undefined,
  });
  const houses = rawHouses?.filter(
    (h) => !appellation || (h.appellation || "") === appellation || (h.appellation || "").includes(appellation),
  );
  const grapeOpts = useMemo(
    () => [...new Set((regions ?? []).flatMap((r) => r.grapes))].sort(),
    [regions],
  );
  const colorBy = (slug: string) => regions?.find((r) => r.slug === slug)?.color || "#8a3324";
  const nameBy = (slug: string) => regions?.find((r) => r.slug === slug)?.name || slug;

  const hasFilters = region !== "all" || grape !== "all" || type !== "all" || !!appellation || !!q.trim();
  const clearAll = () => {
    setRegion("all"); setGrape("all"); setType("all"); setAppellation(""); setQ(""); setOpen(null);
    nav("/houses");
  };

  return (
    <div className="page">
      <BackBar crumbs={[{ label: "Map", to: "/" }, { label: "Houses" }]} />
      <div className="page-head">
        <div className="kicker">The Almanac</div>
        <h1>Wine Houses &amp; Estates</h1>
        <p className="lede">Every curated producer across France — filter by region, wine type or grape, all live from the database. Click a row to expand full detail.</p>
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

      {hasFilters && (
        <div className="activefilters ui">
          <span className="af-label">Active filters:</span>
          {region !== "all" && <RemovableChip label="Region" value={nameBy(region)} onRemove={() => setRegion("all")} />}
          {grape !== "all" && <RemovableChip label="Grape" value={grape} onRemove={() => setGrape("all")} />}
          {type !== "all" && <RemovableChip label="Type" value={type} onRemove={() => setType("all")} />}
          {appellation && <RemovableChip label="Appellation" value={appellation} onRemove={() => setAppellation("")} />}
          {q.trim() && <RemovableChip label="Search" value={q.trim()} onRemove={() => setQ("")} />}
          <button type="button" className="btn sm clearall" onClick={clearAll} title="Clear all filters">Clear all</button>
        </div>
      )}

      <div className="resultcount ui">{houses ? `${houses.length} houses` : "Loading…"}</div>
      <div className="tablewrap">
        <table className="data">
          <thead><tr><th style={{ width: 26 }} aria-label="Expand" /><th>House</th><th>Region</th><th>Appellation</th><th>Class</th><th>Wines</th><th>Grapes</th></tr></thead>
          <tbody>
            {(houses ?? []).map((h) => {
              const isOpen = open === h._id;
              const toggle = () => setOpen(isOpen ? null : h._id);
              return (
                <Row
                  key={h._id}
                  h={h}
                  isOpen={isOpen}
                  toggle={toggle}
                  color={colorBy(h.regionSlug)}
                  setGrape={(g) => { setGrape(g); setOpen(null); }}
                  setAppellation={(a) => { setAppellation(a); setOpen(null); }}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  h, isOpen, toggle, color, setGrape, setAppellation,
}: {
  h: any;
  isOpen: boolean;
  toggle: () => void;
  color: string;
  setGrape: (g: string) => void;
  setAppellation: (a: string) => void;
}) {
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return (
    <>
      <tr className={`row-click ${isOpen ? "exp" : ""}`} title={isOpen ? "Collapse" : `Expand ${h.name}`}
        role="button" tabIndex={0} aria-expanded={isOpen}
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}>
        <td className="cell-exp"><span className={`twist ${isOpen ? "down" : ""}`} aria-hidden="true">›</span></td>
        <td className="cell-title" data-label="House"><div className="cellname">{h.name}</div>{h.flagship && <div className="cellsub muted">{h.flagship}</div>}</td>
        <td data-label="Region" onClick={stop} onKeyDown={stop}>
          <Link className="region-link" to={`/?region=${h.regionSlug}`} title={`See ${h.regionName} on the map`}>
            <span className="swatch" style={{ background: color }} />{h.regionName}
          </Link>
        </td>
        <td data-label="Appellation" onClick={stop} onKeyDown={stop}>
          {h.appellation
            ? <span className="app app-click" role="button" tabIndex={0} title={`Filter by ${h.appellation}`}
                onClick={() => setAppellation(h.appellation)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAppellation(h.appellation); } }}>{h.appellation}</span>
            : <span className="muted">—</span>}
        </td>
        <td data-label="Class">{classBadge(h.classification) ? <Badge cls={h.classification} /> : <span className="muted">—</span>}</td>
        <td data-label="Wines">{(h.types || []).map((t: string) => <TypeBadge key={t} t={t} />)}</td>
        <td data-label="Grapes" onClick={stop} onKeyDown={stop}>{(h.grapes || []).map((g: string) => (
          <span key={g} className="tag tag-click" role="button" tabIndex={0} title={`Filter by ${g}`}
            onClick={() => setGrape(g)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setGrape(g); } }}>
            <GrapeDot name={g} />{g}
          </span>
        ))}</td>
      </tr>
      {isOpen && (
        <tr className="detail-row">
          <td colSpan={7}>
            <div className="house-detail" style={{ borderLeftColor: color }}>
              <div className="hd-main">
                {h.flagship && <p className="hd-flagship"><b>Flagship</b> — {h.flagship}</p>}
                {h.note && <p className="hd-note">{h.note}</p>}
                <dl className="facts">
                  <dt>Region</dt>
                  <dd><Link className="region-link" to={`/?region=${h.regionSlug}`}><span className="swatch" style={{ background: color }} />{h.regionName}</Link></dd>
                  <dt>Appellation</dt>
                  <dd>{h.appellation
                    ? <span className="app app-click" role="button" tabIndex={0} title={`Filter by ${h.appellation}`}
                        onClick={() => setAppellation(h.appellation)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAppellation(h.appellation); } }}>{h.appellation}</span>
                    : <span className="muted">—</span>}</dd>
                  <dt>Classification</dt>
                  <dd>{classBadge(h.classification) ? <Badge cls={h.classification} /> : <span className="muted">{h.classification || "—"}</span>}</dd>
                  <dt>Wine types</dt>
                  <dd className="hd-types">{(h.types || []).map((t: string) => <TypeBadge key={t} t={t} />)}</dd>
                </dl>
              </div>
              <div className="hd-side">
                <h4>Grapes</h4>
                <div className="apps">
                  {(h.grapes || []).map((g: string) => (
                    <GrapePill key={g} name={g} onClick={() => setGrape(g)} />
                  ))}
                </div>
                <div className="hd-actions">
                  <button type="button" className="btn primary" title={`Ask Franky about ${h.name}`}
                    onClick={() => openChat(`Tell me about ${h.name}${h.appellation ? ` in ${h.appellation}` : ""} (${h.regionName}) — its wines, style and whether I can visit.`)}>
                    <Icon name="chat" size={14} /> Ask Franky
                  </button>
                  <Link className="btn" to={`/?region=${h.regionSlug}`}><Icon name="map" size={14} /> On the map</Link>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
