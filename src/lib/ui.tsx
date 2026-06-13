// Shared UI helpers ported from the standalone almanac.
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

export const COLORS: Record<string, string> = {
  bordeaux: "#7b2d3b", sudouest: "#9c5a3c", bourgogne: "#8a3324", beaujolais: "#b4532f",
  champagne: "#c6a15b", rhone: "#6d4076", loire: "#4f7a6a", alsace: "#3f7d8c",
  languedoc: "#a8443f", provence: "#c06b8a", jura: "#7d8a4a", savoie: "#4a6a9c", corse: "#5c8a4a",
};
export const regionColor = (slug: string) => COLORS[slug] || "#8a3324";

export const TYPE_ORDER = ["Red", "White", "Rosé", "Sparkling", "Sweet", "Fortified"];
export const TYPE_COLORS: Record<string, string> = {
  Red: "#7b2d3b", White: "#cda84e", "Rosé": "#e09bb0", Sparkling: "#c9a24b", Sweet: "#c4822f", Fortified: "#5a2d4a",
};

export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function classBadge(cls?: string): [string, string] | null {
  if (!cls) return null;
  const c = cls.toLowerCase();
  if (c.includes("first growth") || c.includes("premier cru supérieur") || c.includes("classé a")) return ["b-first", "1er / Growth"];
  if (c.includes("grand cru")) return ["b-grand", "Grand Cru"];
  if (c.includes("premier cru")) return ["b-premier", "Premier Cru"];
  if (c.includes("growth")) return ["b-growth", cls.replace("1855 ", "")];
  if (c.includes("grande marque")) return ["b-marque", "Grande Marque"];
  if (c.includes("grower")) return ["b-grower", "Grower"];
  if (c.includes("cru")) return ["b-cru", c.includes("beaujolais") ? "Cru" : cls];
  return null;
}

const RED = new Set(["Cabernet Sauvignon","Merlot","Cabernet Franc","Petit Verdot","Malbec","Tannat","Négrette","Fer Servadou","Pinot Noir","Gamay","Syrah","Grenache","Mourvèdre","Cinsault","Carignan","Nielluccio","Sciaccarello","Carcaghjolu Neru","Barbarossa","Braucol","Duras","Prunelart","Poulsard","Trousseau","Mondeuse","Folle Noire","Braquet","Aleatico","Pinot Meunier"]);
export const grapeIsRed = (g: string) => RED.has(g);

export function TypeBadge({ t }: { t: string }) {
  return <span className="tbadge" style={{ background: TYPE_COLORS[t] || "#888" }}>{t}</span>;
}
export function TypeDot({ t }: { t: string }) {
  return <span className="dot" style={{ background: TYPE_COLORS[t] || "#888" }} />;
}
export function Badge({ cls }: { cls?: string }) {
  const b = classBadge(cls);
  if (!b) return null;
  return <span className={`badge ${b[0]}`}>{b[1]}</span>;
}

// Red/white grape colour dot (red #7b2d3b / white #cda84e)
export function GrapeDot({ name }: { name: string }) {
  return <span className="gdot" style={{ background: grapeIsRed(name) ? "#7b2d3b" : "#cda84e" }} />;
}

// Clickable grape pill: dot + name. Keyboard-activatable, dependency-free.
export function GrapePill({ name, onClick }: { name: string; onClick?: () => void }) {
  return (
    <span
      className="app grape-pill"
      role="button"
      tabIndex={0}
      title={`See producers of ${name}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <GrapeDot name={name} />
      {name}
    </span>
  );
}

// ---- Navigation helpers (additive) ----

export type Crumb = { label: string; to?: string };

/**
 * Universal "never a dead end" affordance: a ‹ Back button (history -1) plus
 * optional breadcrumb links and trailing action children. Keyboard friendly,
 * ≥44px tap target.
 */
export function BackBar({
  crumbs,
  fallback = "/",
  children,
}: {
  crumbs?: Crumb[];
  fallback?: string;
  children?: ReactNode;
}) {
  const nav = useNavigate();
  const goBack = () => {
    if (window.history.length > 1) nav(-1);
    else nav(fallback);
  };
  return (
    <div className="backbar ui">
      <button type="button" className="backbtn" onClick={goBack} title="Go back" aria-label="Go back">
        <span aria-hidden="true">‹</span> Back
      </button>
      {crumbs && crumbs.length > 0 && (
        <nav className="crumbs" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span className="crumb" key={i}>
              {i > 0 && <span className="sep" aria-hidden="true">/</span>}
              {c.to ? <Link to={c.to}>{c.label}</Link> : <span className="cur">{c.label}</span>}
            </span>
          ))}
        </nav>
      )}
      {children && <div className="backbar-actions">{children}</div>}
    </div>
  );
}

/** A removable active-filter chip (label + ✕). ≥44px-friendly tap target. */
export function RemovableChip({
  label,
  value,
  onRemove,
  title,
}: {
  label: string;
  value?: ReactNode;
  onRemove: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      className="chip on filter-chip"
      onClick={onRemove}
      title={title || `Remove filter: ${label}`}
    >
      <span className="fc-k">{label}</span>
      {value != null && <span className="fc-v">{value}</span>}
      <span className="fc-x" aria-hidden="true">✕</span>
    </button>
  );
}

const ICON: Record<string, string> = {
  map: '<path d="M9 4 3 6v15l6-2 6 2 6-2V3l-6 2-6-2z"/><path d="M9 4v15M15 5v15"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  bottle: '<path d="M10 2h4"/><path d="M10.5 2v3.5L9 9v11a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V9l-1.5-3.5V2"/><path d="M9 12h6"/>',
  pin: '<path d="M12 21s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12z"/><circle cx="12" cy="9" r="2.4"/>',
  grape: '<circle cx="9" cy="13" r="2.1"/><circle cx="13" cy="13" r="2.1"/><circle cx="11" cy="16.5" r="2.1"/><circle cx="11" cy="9.4" r="2.1"/><path d="M11 7V3M11 3c2 0 3-1 4-2"/>',
  star: '<path d="m12 3 2.6 5.6 6 .7-4.4 4.1 1.2 6L12 16.9 6.6 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  route: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 18h6a3 3 0 0 0 0-6H10a3 3 0 0 1 0-6h4"/>',
  chartL: '<path d="M3 3v18h18"/><rect x="6" y="11" width="3" height="7"/><rect x="11" y="7" width="3" height="11"/><rect x="16" y="13" width="3" height="5"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"/>',
  cal: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
};
export function Icon({ name, size = 16, sw = 1.7 }: { name: string; size?: number; sw?: number }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICON[name] || "" }} />
  );
}
