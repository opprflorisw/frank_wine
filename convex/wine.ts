import { query } from "./_generated/server";
import { v as vv } from "convex/values";

// ---- regions ----
export const listRegions = query({
  args: {},
  handler: async (ctx) => {
    const regions = await ctx.db.query("regions").collect();
    return regions.sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));
  },
});

export const getRegion = query({
  args: { slug: vv.string() },
  handler: async (ctx, { slug }) => {
    const region = await ctx.db
      .query("regions")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!region) return null;
    const houses = await ctx.db
      .query("houses")
      .withIndex("by_region", (q) => q.eq("regionSlug", slug))
      .collect();
    const villages = await ctx.db
      .query("villages")
      .withIndex("by_region", (q) => q.eq("regionSlug", slug))
      .collect();
    const trips = await ctx.db
      .query("trips")
      .withIndex("by_region", (q) => q.eq("regionSlug", slug))
      .collect();
    return { region, houses, villages, trips };
  },
});

// everything the interactive map needs (context + region geometry)
export const mapData = query({
  args: {},
  handler: async (ctx) => {
    const context = await ctx.db
      .query("appData")
      .withIndex("by_key", (q) => q.eq("key", "context"))
      .unique();
    const regions = await ctx.db.query("regions").collect();
    return { context, regions };
  },
});

// villages of a region (for map town markers)
export const villagesByRegion = query({
  args: { slug: vv.string() },
  handler: async (ctx, { slug }) =>
    ctx.db.query("villages").withIndex("by_region", (q) => q.eq("regionSlug", slug)).collect(),
});

// ---- houses (filterable) ----
export const listHouses = query({
  args: {
    region: vv.optional(vv.string()),
    grape: vv.optional(vv.string()),
    type: vv.optional(vv.string()),
    search: vv.optional(vv.string()),
  },
  handler: async (ctx, args) => {
    let houses;
    if (args.search && args.search.trim()) {
      houses = await ctx.db
        .query("houses")
        .withSearchIndex("search_name", (q) => {
          let s = q.search("name", args.search!);
          if (args.region) s = s.eq("regionSlug", args.region);
          return s;
        })
        .take(200);
    } else if (args.region) {
      houses = await ctx.db
        .query("houses")
        .withIndex("by_region", (q) => q.eq("regionSlug", args.region!))
        .collect();
    } else {
      houses = await ctx.db.query("houses").collect();
    }
    if (args.grape) houses = houses.filter((h) => (h.grapes || []).includes(args.grape!));
    if (args.type) houses = houses.filter((h) => (h.types || []).includes(args.type!));
    return houses.sort((a, b) => a.name.localeCompare(b.name));
  },
});

// ---- villages ----
export const listVillages = query({
  args: { region: vv.optional(vv.string()) },
  handler: async (ctx, { region }) => {
    const villages = region
      ? await ctx.db.query("villages").withIndex("by_region", (q) => q.eq("regionSlug", region)).collect()
      : await ctx.db.query("villages").collect();
    return villages.sort((a, b) => a.name.localeCompare(b.name));
  },
});

// ---- trips ----
export const listTrips = query({
  args: { region: vv.optional(vv.string()) },
  handler: async (ctx, { region }) => {
    return region
      ? await ctx.db.query("trips").withIndex("by_region", (q) => q.eq("regionSlug", region)).collect()
      : await ctx.db.query("trips").collect();
  },
});

// ---- grapes (aggregated from houses) ----
const RED = new Set(["Cabernet Sauvignon","Merlot","Cabernet Franc","Petit Verdot","Malbec","Tannat","Négrette","Fer Servadou","Pinot Noir","Gamay","Syrah","Grenache","Mourvèdre","Cinsault","Carignan","Nielluccio","Sciaccarello","Carcaghjolu Neru","Barbarossa","Braucol","Duras","Prunelart","Poulsard","Trousseau","Mondeuse","Folle Noire","Braquet","Aleatico","Pinot Meunier"]);

export const listGrapes = query({
  args: {},
  handler: async (ctx) => {
    const houses = await ctx.db.query("houses").collect();
    const map: Record<string, { name: string; regions: Set<string>; houses: number; examples: string[] }> = {};
    for (const h of houses) {
      for (const g of h.grapes || []) {
        if (!map[g]) map[g] = { name: g, regions: new Set(), houses: 0, examples: [] };
        map[g].regions.add(h.regionName);
        map[g].houses++;
        if (map[g].examples.length < 3 && !map[g].examples.includes(h.name)) map[g].examples.push(h.name);
      }
    }
    return Object.values(map)
      .map((g) => ({
        name: g.name,
        color: RED.has(g.name) ? "red" : "white",
        regions: [...g.regions],
        houses: g.houses,
        examples: g.examples,
      }))
      .sort((a, b) => b.houses - a.houses);
  },
});
