import { useEffect, useState } from "react";

// "My Cellar" — localStorage-backed favourites for houses & regions.
export type Fav = { type: "house" | "region"; id: string; label: string; sub?: string; to: string };
const KEY = "fw_favs";
const EV = "fw:favs";

function read(): Fav[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(f: Fav[]) {
  localStorage.setItem(KEY, JSON.stringify(f));
  window.dispatchEvent(new Event(EV));
}
export function toggleFav(item: Fav) {
  const f = read();
  const i = f.findIndex((x) => x.type === item.type && x.id === item.id);
  if (i >= 0) f.splice(i, 1); else f.unshift(item);
  write(f);
}
export function removeFav(type: Fav["type"], id: string) {
  write(read().filter((x) => !(x.type === type && x.id === id)));
}
export function clearFavs() { write([]); }

export function useFavorites(): Fav[] {
  const [favs, setFavs] = useState<Fav[]>(read);
  useEffect(() => {
    const h = () => setFavs(read());
    window.addEventListener(EV, h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(EV, h); window.removeEventListener("storage", h); };
  }, []);
  return favs;
}

export function FavButton({ item, className }: { item: Fav; className?: string }) {
  const favs = useFavorites();
  const on = favs.some((x) => x.type === item.type && x.id === item.id);
  return (
    <button
      type="button"
      className={`favbtn ${on ? "on" : ""} ${className || ""}`}
      title={on ? "Saved in My Cellar — tap to remove" : "Save to My Cellar"}
      aria-pressed={on}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleFav(item); }}
    >
      <span aria-hidden="true">{on ? "★" : "☆"}</span>
    </button>
  );
}
