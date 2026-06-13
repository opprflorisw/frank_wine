import { query } from "./_generated/server";
import { v as vv } from "convex/values";
import grapeInfo from "./grapeInfo.json";

const nz = (s?: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

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
    const info = grapeInfo as Record<string, { desc?: string; profile?: string }>;
    return Object.values(map)
      .map((g) => ({
        name: g.name,
        color: RED.has(g.name) ? "red" : "white",
        regions: [...g.regions],
        houses: g.houses,
        examples: g.examples,
        desc: info[g.name]?.desc,
        profile: info[g.name]?.profile,
      }))
      .sort((a, b) => b.houses - a.houses);
  },
});

// ---- global search (regions, houses, appellations, grapes, villages, trips) ----
export const globalSearch = query({
  args: { q: vv.string() },
  handler: async (ctx, { q }) => {
    const t = nz(q).trim();
    const empty = { regions: [], houses: [], appellations: [], grapes: [], villages: [], trips: [] };
    if (!t) return empty;

    const regionsAll = await ctx.db.query("regions").collect();
    const housesAll = await ctx.db.query("houses").collect();
    const villagesAll = await ctx.db.query("villages").collect();
    const tripsAll = await ctx.db.query("trips").collect();

    const regions = regionsAll
      .filter((r) => nz(r.name).includes(t) || nz(r.summary).includes(t) || (r.grapes || []).some((g) => nz(g).includes(t)))
      .slice(0, 6)
      .map((r) => ({ id: r.slug, label: r.name, sub: "Wine region", to: `/?region=${r.slug}` }));

    const houses = housesAll
      .filter((h) => nz(h.name).includes(t) || nz(h.appellation).includes(t) || nz(h.town).includes(t))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 14)
      .map((h) => ({ id: h._id, label: h.name, sub: `Wine house · ${h.appellation || h.regionName}`, to: `/houses?region=${h.regionSlug}&q=${encodeURIComponent(h.name)}` }));

    const appellations: { id: string; label: string; sub: string; to: string }[] = [];
    for (const r of regionsAll) for (const a of r.subAppellations || []) if (nz(a).includes(t)) appellations.push({ id: r.slug + "|" + a, label: a, sub: `Appellation · ${r.name}`, to: `/houses?region=${r.slug}&appellation=${encodeURIComponent(a)}` });

    const gset = new Set<string>();
    for (const h of housesAll) for (const g of h.grapes || []) gset.add(g);
    const grapes = [...gset].filter((g) => nz(g).includes(t)).sort().slice(0, 8)
      .map((g) => ({ id: g, label: g, sub: "Grape variety", to: `/houses?grape=${encodeURIComponent(g)}` }));

    const villages = villagesAll
      .filter((vlg) => nz(vlg.name).includes(t) || nz(vlg.commune).includes(t))
      .slice(0, 8)
      .map((vlg) => ({ id: vlg._id, label: vlg.name, sub: `Village · ${vlg.regionName}`, to: `/?region=${vlg.regionSlug}&village=${encodeURIComponent(vlg.name)}` }));

    const trips = tripsAll
      .filter((tr) => nz(tr.name).includes(t) || nz(tr.basedIn).includes(t))
      .slice(0, 6)
      .map((tr) => ({ id: tr._id, label: tr.name, sub: `Trip · ${tr.regionName}`, to: `/trips?region=${tr.regionSlug}` }));

    return { regions, houses, appellations: appellations.slice(0, 8), grapes, villages, trips };
  },
});
