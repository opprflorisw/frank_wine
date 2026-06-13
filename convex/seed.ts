import { internalMutation } from "./_generated/server";
import almanac from "./almanacSeed.json";

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
    for (const table of ["regions", "houses", "villages", "trips", "appData"] as const) {
      const rows = await ctx.db.query(table).collect();
      for (const r of rows) await ctx.db.delete(r._id);
    }
    const data = almanac as any;
    let nh = 0, nv = 0, nt = 0;
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
      for (const p of r.producers || []) {
        await ctx.db.insert("houses", {
          regionSlug: slug, regionName: r.name, name: p.name,
          appellation: p.appellation, classification: p.classification, note: p.note,
          types: p.types || [], grapes: p.grapes || [], flagship: p.flagship,
          tier: tier(p.classification),
        });
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
    return { regions: Object.keys(data.regions).length, houses: nh, villages: nv, trips: nt };
  },
});
