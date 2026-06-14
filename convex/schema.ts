import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Frank's Wine Almanac — Convex data model.
// Regions/houses/villages/trips are normalised tables; the heavy map geometry
// (France outline, neighbours, cities, routes, projection) lives in one `appData` doc.
export default defineSchema({
  regions: defineTable({
    slug: v.string(),
    name: v.string(),
    summary: v.string(),
    classification: v.string(),
    profile: v.optional(v.string()),
    subAppellations: v.array(v.string()),
    types: v.array(v.string()),
    grapes: v.array(v.string()),
    typeCounts: v.any(),
    grapeCounts: v.any(),
    terroirScore: v.optional(v.number()),
    visitScore: v.optional(v.number()),
    overallScore: v.optional(v.number()),
    climate: v.optional(v.any()),
    visit: v.optional(v.any()),
    color: v.optional(v.string()),
    geoPath: v.string(),
    bbox: v.array(v.number()),
    centroid: v.array(v.number()),
    houseCount: v.number(),
    villageCount: v.number(),
    tripCount: v.number(),
  }).index("by_slug", ["slug"]),

  houses: defineTable({
    regionSlug: v.string(),
    regionName: v.string(),
    name: v.string(),
    appellation: v.optional(v.string()),
    classification: v.optional(v.string()),
    note: v.optional(v.string()),
    types: v.array(v.string()),
    grapes: v.array(v.string()),
    flagship: v.optional(v.string()),
    tier: v.string(), // grand | growth | premier | cru | other (for filtering/sorting)
    // location: x/y are projected SVG map coords (always present); lat/lon/address/town
    // are real-world enrichment where reliably known. geoSrc: appellation|town|region|geocoded.
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    lat: v.optional(v.number()),
    lon: v.optional(v.number()),
    address: v.optional(v.string()),
    town: v.optional(v.string()),
    geoSrc: v.optional(v.string()),
  })
    .index("by_region", ["regionSlug"])
    .searchIndex("search_name", { searchField: "name", filterFields: ["regionSlug"] }),

  villages: defineTable({
    regionSlug: v.string(),
    regionName: v.string(),
    name: v.string(),
    commune: v.optional(v.string()),
    x: v.number(),
    y: v.number(),
  }).index("by_region", ["regionSlug"]),

  trips: defineTable({
    regionSlug: v.string(),
    regionName: v.string(),
    name: v.string(),
    days: v.number(),
    basedIn: v.string(),
    bestSeason: v.string(),
    summary: v.string(),
    driving: v.string(),
    stops: v.array(v.any()),
    route: v.array(v.any()),
    bbox: v.array(v.number()),
  }).index("by_region", ["regionSlug"]),

  // named scenic wine routes (Route des Grands Crus, Route des Vins d'Alsace, …)
  routes: defineTable({
    regionSlug: v.string(),
    regionName: v.string(),
    name: v.string(),
    subtitle: v.optional(v.string()),
    lengthKm: v.optional(v.number()),
    driveTime: v.optional(v.string()),
    bestSeason: v.optional(v.string()),
    summary: v.string(),
    highlights: v.array(v.string()),
    stops: v.array(v.any()),   // { name, kind, town, role, note, x?, y?, lat?, lon?, houseId? }
    path: v.array(v.any()),    // polyline of [x,y] through stops that have coords
    bbox: v.array(v.number()),
  }).index("by_region", ["regionSlug"]),

  // single-row map context (key === "context")
  appData: defineTable({
    key: v.string(),
    viewBox: v.array(v.number()),
    proj: v.any(),
    france: v.string(),
    neighbours: v.any(),
    cities: v.any(),
    autoroutes: v.any(),
    wineRoutes: v.any(),
    meta: v.any(),
  }).index("by_key", ["key"]),

  // AI chat threads (one row per message)
  messages: defineTable({
    threadId: v.string(),
    role: v.string(), // user | assistant
    content: v.string(),
    done: v.optional(v.boolean()),
  }).index("by_thread", ["threadId"]),
});
