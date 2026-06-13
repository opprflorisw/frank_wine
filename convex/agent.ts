"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { GoogleGenAI, Type } from "@google/genai";

const SYSTEM = `You are the resident sommelier and guide for "Frank's Wine Almanac", an interactive atlas of French wine covering all 13 major regions, 246 celebrated wine houses, their grapes and classifications, 182 wine villages, and curated wine-tasting road trips.

Answer questions about French wine — regions, producers/houses, grapes, classifications, villages, terroir & climate, and trip planning — by USING THE TOOLS to look up accurate data from the almanac rather than relying on memory. Prefer specific, named facts from the data (real producers, appellations, scores).

Style: warm, knowledgeable, concise. Use short paragraphs or tight bullet lists. When recommending, name actual houses/regions/trips from the almanac. If a question is outside French wine, answer briefly and steer back to the almanac. Never invent producers that the tools don't return.`;

const TOOLS: any = [
  {
    functionDeclarations: [
      { name: "list_regions", description: "List all 13 French wine regions with wine types, signature grapes, house & village counts, and terroir/visit scores.", parameters: { type: Type.OBJECT, properties: {} } },
      { name: "get_region", description: "Full detail for one region by slug. Valid slugs: bordeaux, sudouest, bourgogne, beaujolais, champagne, rhone, loire, alsace, languedoc, provence, jura, savoie, corse. Returns summary, classification, climate, appellations, wine houses, villages and trips.", parameters: { type: Type.OBJECT, properties: { slug: { type: Type.STRING } }, required: ["slug"] } },
      { name: "search_houses", description: "Search/filter wine houses (producers). All optional: query (name text), region (slug), grape (e.g. 'Pinot Noir'), type ('Red','White','Rosé','Sparkling','Sweet','Fortified').", parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING }, region: { type: Type.STRING }, grape: { type: Type.STRING }, type: { type: Type.STRING } } } },
      { name: "list_trips", description: "List curated wine-tasting trips, optionally filtered by region slug. Each has days, base town, best season and stops with visit info.", parameters: { type: Type.OBJECT, properties: { region: { type: Type.STRING } } } },
      { name: "list_grapes", description: "List grape varieties with colour, which regions grow them, and example producers.", parameters: { type: Type.OBJECT, properties: {} } },
    ],
  },
];

export const chat = action({
  args: { threadId: v.string(), message: v.string() },
  handler: async (ctx, { threadId, message }) => {
    await ctx.runMutation(internal.messages.add, { threadId, role: "user", content: message });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const msg =
        "The AI guide isn't switched on yet — a Gemini API key needs to be set on the backend. Run `npx convex env set GEMINI_API_KEY …` to enable me. Meanwhile, explore the map, regions, houses and trips from the menu!";
      await ctx.runMutation(internal.messages.add, { threadId, role: "assistant", content: msg });
      return msg;
    }

    const history = await ctx.runQuery(api.messages.listByThread, { threadId });
    const contents: any[] = history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.CHAT_MODEL || "gemini-3.1-flash-lite";

    async function runTool(name: string, input: any): Promise<any> {
      try {
        if (name === "list_regions") {
          const rs = await ctx.runQuery(api.wine.listRegions, {});
          return rs.map((r) => ({ slug: r.slug, name: r.name, types: r.types, grapes: (r.grapes || []).slice(0, 8), houses: r.houseCount, villages: r.villageCount, terroir: r.terroirScore, visit: r.visitScore, summary: r.summary }));
        }
        if (name === "get_region") {
          const d = await ctx.runQuery(api.wine.getRegion, { slug: input.slug });
          if (!d) return { error: "unknown region slug: " + input.slug };
          return {
            region: { name: d.region.name, summary: d.region.summary, classification: d.region.classification, appellations: d.region.subAppellations, grapes: d.region.grapes, climate: d.region.climate, terroir: d.region.terroirScore, visit: d.region.visitScore },
            houses: d.houses.map((h) => ({ name: h.name, appellation: h.appellation, classification: h.classification, grapes: h.grapes, types: h.types, flagship: h.flagship, note: h.note })),
            villages: d.villages.map((vi) => vi.name),
            trips: d.trips.map((t) => ({ name: t.name, days: t.days, basedIn: t.basedIn })),
          };
        }
        if (name === "search_houses") {
          const hs = await ctx.runQuery(api.wine.listHouses, { region: input.region, grape: input.grape, type: input.type, search: input.query });
          return hs.slice(0, 40).map((h) => ({ name: h.name, region: h.regionName, appellation: h.appellation, classification: h.classification, grapes: h.grapes, types: h.types, flagship: h.flagship }));
        }
        if (name === "list_trips") {
          const ts = await ctx.runQuery(api.wine.listTrips, { region: input.region });
          return ts.map((t) => ({ name: t.name, region: t.regionName, days: t.days, basedIn: t.basedIn, bestSeason: t.bestSeason, summary: t.summary, stops: (t.stops || []).map((s: any) => ({ name: s.name, town: s.town, visit: s.visit })) }));
        }
        if (name === "list_grapes") return await ctx.runQuery(api.wine.listGrapes, {});
        return { error: "unknown tool " + name };
      } catch (e: any) {
        return { error: String(e?.message || e) };
      }
    }

    let answer = "";
    for (let turn = 0; turn < 6; turn++) {
      const resp: any = await ai.models.generateContent({ model, contents, config: { systemInstruction: SYSTEM, tools: TOOLS } });
      const fcs = resp.functionCalls;
      if (fcs && fcs.length) {
        const modelParts = resp.candidates?.[0]?.content?.parts ?? fcs.map((fc: any) => ({ functionCall: fc }));
        contents.push({ role: "model", parts: modelParts });
        const parts: any[] = [];
        for (const fc of fcs) {
          const out = await runTool(fc.name, fc.args || {});
          parts.push({ functionResponse: { name: fc.name, response: { result: out } } });
        }
        contents.push({ role: "user", parts });
        continue;
      }
      answer = resp.text || "";
      break;
    }
    if (!answer) answer = "Sorry — I couldn't put together an answer just then. Try rephrasing?";
    await ctx.runMutation(internal.messages.add, { threadId, role: "assistant", content: answer });
    return answer;
  },
});
