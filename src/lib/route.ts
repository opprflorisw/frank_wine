import { useEffect, useState } from "react";

// "My Route" — a personal tasting route the user builds by adding wine houses.
// Stored in localStorage and mirrored to the URL (?stops=) so it can be shared.
export type Stop = {
  id: string;            // house _id
  name: string;
  town?: string;
  region: string;        // region slug
  regionName?: string;
  appellation?: string;
  x?: number; y?: number;     // projected SVG map coords (for drawing)
  lat?: number; lon?: number; // real-world coords (for distance)
};

const KEY = "fw_route";
const EV = "fw:route";

function read(): Stop[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(s: Stop[]) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event(EV));
}

export function addStop(s: Stop) {
  const r = read();
  if (r.some((x) => x.id === s.id)) return;
  write([...r, s]);
}
export function removeStop(id: string) { write(read().filter((x) => x.id !== id)); }
export function toggleStop(s: Stop) {
  const r = read();
  if (r.some((x) => x.id === s.id)) write(r.filter((x) => x.id !== s.id));
  else write([...r, s]);
}
export function clearRoute() { write([]); }
export function setRoute(s: Stop[]) { write(s); }
export function moveStop(from: number, to: number) {
  const r = read();
  if (from < 0 || to < 0 || from >= r.length || to >= r.length) return;
  const [item] = r.splice(from, 1);
  r.splice(to, 0, item);
  write(r);
}

// ---- geo helpers ----
const R = 6371; // km
const rad = (d: number) => (d * Math.PI) / 180;
export function haversine(a: Stop, b: Stop): number | null {
  if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) return null;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export type RouteStats = { km: number | null; driveMin: number | null; stops: number; legs: (number | null)[] };
export function routeStats(stops: Stop[]): RouteStats {
  const legs: (number | null)[] = [];
  let km = 0, known = false, anyUnknown = false;
  for (let i = 1; i < stops.length; i++) {
    const d = haversine(stops[i - 1], stops[i]);
    legs.push(d);
    if (d == null) anyUnknown = true; else { km += d; known = true; }
  }
  const total = known ? km : null;
  // rural wine-country driving ~ 50 km/h average
  const driveMin = total != null ? Math.round((total / 50) * 60) : null;
  return { km: total != null ? Math.round(total) : null, driveMin, stops: stops.length, legs: anyUnknown ? legs : legs };
}

export function fmtDrive(min: number | null): string {
  if (min == null) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// Nearest-neighbour ordering from the first stop; stops without coords keep their tail order.
export function optimize(stops: Stop[]): Stop[] {
  const withGeo = stops.filter((s) => s.lat != null && s.lon != null);
  const noGeo = stops.filter((s) => s.lat == null || s.lon == null);
  if (withGeo.length < 3) return stops;
  const out: Stop[] = [withGeo[0]];
  const pool = withGeo.slice(1);
  while (pool.length) {
    const last = out[out.length - 1];
    let bi = 0, bd = Infinity;
    pool.forEach((s, i) => { const d = haversine(last, s) ?? Infinity; if (d < bd) { bd = d; bi = i; } });
    out.push(pool.splice(bi, 1)[0]);
  }
  return [...out, ...noGeo];
}

export function useRoute(): Stop[] {
  const [r, setR] = useState<Stop[]>(read);
  useEffect(() => {
    const h = () => setR(read());
    window.addEventListener(EV, h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(EV, h); window.removeEventListener("storage", h); };
  }, []);
  return r;
}
export function isInRoute(id: string, route: Stop[]) { return route.some((x) => x.id === id); }
