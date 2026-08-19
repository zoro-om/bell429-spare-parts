import { requireSession, json } from "../_lib/auth.js";

const MAX_RESULTS = 25;

export async function onRequestGet(context) {
  const auth = await requireSession(context.request, context.env, false);
  if (auth.response) return auth.response;
  const q = String(new URL(context.request.url).searchParams.get("q") || "").trim().slice(0, 80);
  if (q.length < 2) return json({ parts: [] });

  // The catalog remains an internal static asset but is never directly exposed.
  // This endpoint returns only a small, query-scoped result set.
  const assetUrl = new URL("/parts_index.json", context.request.url);
  const asset = await context.env.ASSETS.fetch(assetUrl);
  if (!asset.ok) return json({ error: "Catalog unavailable" }, 503);
  const data = await asset.json().catch(() => null);
  const parts = Array.isArray(data?.parts) ? data.parts : [];
  const needle = q.toLowerCase();
  const rows = parts.map(x => ({
    pn: String(x.part_number ?? x.pn ?? "").trim(),
    nomenclature: String(x.nomenclature ?? x.title ?? "").trim(),
    title: String(x.title ?? x.nomenclature ?? "").trim(),
  })).filter(x => `${x.pn} ${x.nomenclature} ${x.title}`.toLowerCase().includes(needle)).slice(0, MAX_RESULTS);
  return json({ parts: rows });
}
