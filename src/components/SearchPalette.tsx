import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Icon } from "../lib/ui";
import { OPEN_SEARCH_EVENT } from "../lib/search";

type Item = { id: string; label: string; sub: string; to: string };
const GROUPS: [keyof Results, string][] = [
  ["regions", "Regions"], ["routes", "Wine routes"], ["appellations", "Appellations"], ["houses", "Wine houses"],
  ["grapes", "Grapes"], ["villages", "Villages"], ["trips", "Trips"],
];
type Results = { regions: Item[]; houses: Item[]; appellations: Item[]; grapes: Item[]; villages: Item[]; trips: Item[]; routes: Item[] };

export default function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(0);
  const nav = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // open via event + Cmd/Ctrl+K
  useEffect(() => {
    const onEvt = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener(OPEN_SEARCH_EVENT, onEvt);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener(OPEN_SEARCH_EVENT, onEvt); window.removeEventListener("keydown", onKey); };
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30); else { setQ(""); setActive(0); } }, [open]);
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 150); return () => clearTimeout(t); }, [q]);

  const res = useQuery(api.wine.globalSearch, debounced ? { q: debounced } : "skip") as Results | undefined;

  const flat = useMemo(() => {
    if (!res) return [] as Item[];
    return GROUPS.flatMap(([k]) => res[k]);
  }, [res]);
  useEffect(() => { setActive(0); }, [debounced, res]);

  function go(it?: Item) {
    const target = it || flat[active];
    if (!target) return;
    setOpen(false);
    nav(target.to);
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); go(); }
  }

  if (!open) return null;
  const total = flat.length;
  let idx = -1;

  return (
    <div className="sp-overlay" onMouseDown={() => setOpen(false)}>
      <div className="sp-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sp-input">
          <Icon name="search" size={18} />
          <input ref={inputRef} value={q} placeholder="Search regions, houses, grapes, appellations, villages, trips…"
            onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown} />
          <kbd className="sp-esc">esc</kbd>
        </div>
        <div className="sp-results">
          {!debounced && <div className="sp-hint">Type to search the whole almanac — 13 regions · 246 houses · 188 appellations · 61 grapes · 182 villages.</div>}
          {debounced && total === 0 && res && <div className="sp-hint">No matches for “{debounced}”.</div>}
          {GROUPS.map(([key, title]) => {
            const items = res?.[key] || [];
            if (!items.length) return null;
            return (
              <div className="sp-group" key={key}>
                <div className="sp-group-h">{title}</div>
                {items.map((it) => {
                  idx++;
                  const here = idx;
                  return (
                    <button key={it.id} className={`sp-item ${here === active ? "on" : ""}`}
                      onMouseEnter={() => setActive(here)} onClick={() => go(it)}>
                      <span className="sp-dot" data-kind={key} />
                      <span className="sp-label">{it.label}</span>
                      <span className="sp-sub">{it.sub}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="sp-foot"><kbd>↑</kbd><kbd>↓</kbd> navigate · <kbd>↵</kbd> open · <kbd>esc</kbd> close</div>
      </div>
    </div>
  );
}
