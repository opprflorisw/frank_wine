import { internalMutation } from "./_generated/server";
import almanac from "./almanacSeed.json";
import houseGeo from "./houseGeo.json";
import wineRoutes from "./wineRoutes.json";

const COLORS: Record<string, string> = {
  bordeaux: "#7b2d3b", sudouest: "#9c5a3c", bourgogne: "#8a3324", beaujolais: "#b4532f",
  champagne: "#c6a15b", rhone: "#6d4076", loire: "#4f7a6a", alsace: "#3f7d8c",
  languedoc: "#a8443f", provence: "#c06b8a", jura: "#7d8a4a", savoie: "#4a6a9c", corse: "#5c8a4a",
};
function tier(classification?: string): string {
  const c = (classification || "").toLowerCase();
  if (c.includes("grand cru") || c.includes("classé a")) return "grand";
  if (c.includes("growth") || c.includes("premier cru supérieur")) return "growth";
  if (c.includes("premier cru")) return "premier";
  if (c.includes("cru")) return "cru";
  return "other";
}

// Wipe + load all data from the bundled almanac.json. Run with:  npx convex run seed:run
export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const table of ["regions", "houses", "villages", "trips", "routes", "appData"] as const) {
      const rows = await ctx.db.query(table).collect();
      for (const r of rows) await ctx.db.delete(r._id);
    }
    const data = almanac as any;
    const routesData = wineRoutes as Record<string, any[]>;
    const norm = (s?: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
    let nh = 0, nv = 0, nt = 0, nr = 0;
    for (const slug of Object.keys(data.regions)) {
      const r = data.regions[slug];
      await ctx.db.insert("regions", {
        slug,
        name: r.name,
        summary: r.summary,
        classification: r.classification,
        profile: r.profile,
        subAppellations: r.subAppellations || [],
        types: r.types || [],
        grapes: r.grapes || [],
        // stored as arrays — Convex object field names must be plain ASCII (grape names have accents)
        typeCounts: Object.entries(r.typeCounts || {}).map(([name, count]) => ({ name, count })),
        grapeCounts: Object.entries(r.grapeCounts || {}).map(([name, count]) => ({ name, count })),
        terroirScore: r.terroirScore,
        visitScore: r.visitScore,
        overallScore: r.overallScore,
        climate: r.climate,
        visit: r.visit,
        color: COLORS[slug] || "#8a3324",
        geoPath: r.geo.path,
        bbox: r.geo.bbox,
        centroid: r.geo.centroid,
        houseCount: (r.producers || []).length,
        villageCount: (r.towns || []).length,
        tripCount: (r.trips || []).length,
      });
      const geo = houseGeo as Record<string, { x?: number; y?: number; lat?: number; lon?: number; address?: string; town?: string; src?: string }>;
      const houseIdByName: Record<string, string> = {};
      for (const p of r.producers || []) {
        const g = geo[`${slug}||${p.name}`] || {};
        const hid = await ctx.db.insert("houses", {
          regionSlug: slug, regionName: r.name, name: p.name,
          appellation: p.appellation, classification: p.classification, note: p.note,
          types: p.types || [], grapes: p.grapes || [], flagship: p.flagship,
          tier: tier(p.classification),
          x: g.x, y: g.y, lat: g.lat, lon: g.lon, address: g.address, town: g.town, geoSrc: g.src,
        });
        houseIdByName[p.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()] = hid;
        nh++;
      }
      for (const t of r.towns || []) {
        await ctx.db.insert("villages", {
          regionSlug: slug, regionName: r.name, name: t.name, commune: t.commune, x: t.x, y: t.y,
        });
        nv++;
      }
      for (const trip of r.trips || []) {
        await ctx.db.insert("trips", {
          regionSlug: slug, regionName: r.name, name: trip.name, days: trip.days,
          basedIn: trip.basedIn, bestSeason: trip.bestSeason, summary: trip.summary,
          driving: trip.driving, stops: trip.stops || [], route: trip.route || [], bbox: trip.bbox || [],
        });
        nt++;
      }

      // ---- named wine routes: resolve each stop's coordinates from our own data ----
      const geo2 = houseGeo as Record<string, { x?: number; y?: number; lat?: number; lon?: number; town?: string }>;
      const houseByName: Record<string, any> = {};
      for (const p of r.producers || []) houseByName[norm(p.name)] = { ...(geo2[`${slug}||${p.name}`] || {}), id: null as any };
      const villageByName: Record<string, any> = {};
      const townXY: Record<string, any> = {};
      for (const t of r.towns || []) { villageByName[norm(t.name)] = { x: t.x, y: t.y }; if (t.commune) townXY[norm(t.commune)] = { x: t.x, y: t.y }; }
      for (const p of r.producers || []) { const g = geo2[`${slug}||${p.name}`]; if (g?.town && g.x != null) townXY[norm(g.town)] ??= { x: g.x, y: g.y, lat: g.lat, lon: g.lon }; }
      const resolveStop = (s: any) => {
        let hit: any = null;
        if (s.kind === "house") hit = houseByName[norm(s.name)];
        if (!hit) hit = villageByName[norm(s.name)] || townXY[norm(s.town)] || villageByName[norm(s.town)] || townXY[norm(s.name)];
        const houseId = s.kind === "house" ? (houseIdByName[norm(s.name)] ?? null) : null;
        return { ...s, houseId, x: hit?.x ?? null, y: hit?.y ?? null, lat: hit?.lat ?? null, lon: hit?.lon ?? null };
      };
      for (const route of routesData[slug] || []) {
        const stops = (route.stops || []).map(resolveStop);
        const pts = stops.filter((s: any) => s.x != null && s.y != null).map((s: any) => [s.x, s.y]);
        const xs = pts.map((p: number[]) => p[0]), ys = pts.map((p: number[]) => p[1]);
        const bbox = pts.length
          ? [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]
          : r.geo.bbox;
        await ctx.db.insert("routes", {
          regionSlug: slug, regionName: r.name, name: route.name, subtitle: route.subtitle,
          lengthKm: route.lengthKm, driveTime: route.driveTime, bestSeason: route.bestSeason,
          summary: route.summary, highlights: route.highlights || [],
          stops, path: pts, bbox,
        });
        nr++;
      }
    }
    await ctx.db.insert("appData", {
      key: "context",
      viewBox: data.viewBox,
      proj: data.proj,
      france: data.france,
      neighbours: data.context.neighbours,
      // object→array (city names have accents, can't be Convex field names)
      cities: Object.entries(data.context.cities).map(([name, c]: [string, any]) => ({ name, ...c })),
      autoroutes: data.context.autoroutes,
      wineRoutes: data.context.wineRoutes,
      meta: data.meta,
    });
    return { regions: Object.keys(data.regions).length, houses: nh, villages: nv, trips: nt, routes: nr };
  },
});
