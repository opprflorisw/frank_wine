import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Icon } from "../lib/ui";

const LINKS: [string, string, string][] = [
  ["/", "map", "Map"],
  ["/regions", "grid", "Regions"],
  ["/houses", "bottle", "Houses"],
  ["/grapes", "grape", "Grapes"],
  ["/villages", "pin", "Villages"],
  ["/best", "chartL", "Best Regions"],
  ["/trips", "route", "Wine Trips"],
  ["/ask", "chat", "Ask Franky"],
];

export default function Nav() {
  const regions = useQuery(api.wine.listRegions);
  const [open, setOpen] = useState(false);
  const stats = regions
    ? `${regions.length} regions · ${regions.reduce((s, r) => s + r.houseCount, 0)} houses · ${regions.reduce((s, r) => s + r.villageCount, 0)} villages`
    : "";
  return (
    <nav className="nav">
      <NavLink to="/" className="logo" style={{ color: "inherit" }} end onClick={() => setOpen(false)}>
        <span className="glass"><Icon name="bottle" size={20} sw={1.6} /></span>
        <b>Frank's</b> Wine <span style={{ color: "var(--gold-soft)" }}>Almanac</span>
      </NavLink>
      <div className={`links ${open ? "open" : ""}`}>
        {LINKS.map(([to, ic, label]) => (
          <NavLink key={to} to={to} end={to === "/"} onClick={() => setOpen(false)}
            className={({ isActive }) => (isActive ? "active" : "")}>
            <Icon name={ic} size={15} />{label}
          </NavLink>
        ))}
      </div>
      <span className="spacer" />
      <span className="count ui">{stats}</span>
      <button type="button" className="nav-burger ui"
        aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}
        onClick={() => setOpen((v) => !v)}>
        {open ? "✕" : "☰"}
      </button>
    </nav>
  );
}
