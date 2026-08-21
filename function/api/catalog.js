import { json, sha256 } from "../_lib/auth.js";
import { ensureSecuritySchema } from "../_lib/schema.js";

const MAX_RESULTS = 25;
const MAX_QUERY_LENGTH = 80;
const SEARCH_WINDOW = 10 * 60;
const SEARCH_MAX = 120;

function clean(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
}

async function rateKey(request) {
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Real-IP") ||
    "unknown";
  return sha256(`catalog-search|${ip}`);
}

async function tooManySearches(env, key, now) {
  const since = now - SEARCH_WINDOW;
  const row = await env.DB.prepare(`
    SELECT COUNT(*) AS count
    FROM audit_log
    WHERE action = ?
      AND target_id = ?
      AND created_at >= datetime(?, 'unixepoch')
  `).bind("catalog_search", key, since).first();
  return Number(row?.count || 0) >= SEARCH_MAX;
}

export async function onRequestGet(context) {
  try {
    await ensureSecuritySchema(context.env);
  } catch {
    return json({ error: "Catalog service unavailable" }, 503);
  }

  const url = new URL(context.request.url);
  const q = clean(url.searchParams.get("q") || "").slice(0, MAX_QUERY_LENGTH);

  if (q.length < 2) {
    return json({ parts: [] }, 200, {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    });
  }

  const key = await rateKey(context.request);
  const now = Math.floor(Date.now() / 1000);

  if (await tooManySearches(context.env, key, now)) {
    return json(
      { error: "Too many catalog searches. Try again later." },
      429,
      {
        "Retry-After": String(SEARCH_WINDOW),
        "Cache-Control": "no-store"
      }
    );
  }

  await context.env.DB.prepare(`
    INSERT INTO audit_log(user_id, action, target_id)
    VALUES(?,?,?)
  `).bind(null, "catalog_search", key).run();

  const assetUrl = new URL("/parts_index.json", context.request.url);
  const asset = await context.env.ASSETS.fetch(assetUrl);

  if (!asset.ok) {
    return json({ error: "Catalog unavailable" }, 503, {
      "Cache-Control": "no-store"
    });
  }

  const data = await asset.json().catch(() => null);

  if (!data || !Array.isArray(data.parts)) {
    return json({ error: "Catalog unavailable" }, 503, {
      "Cache-Control": "no-store"
    });
  }

  const needle = q.toLowerCase();

  const parts = data.parts
    .map((item) => ({
      pn: clean(item.part_number ?? item.pn),
      nomenclature: clean(item.nomenclature ?? item.title)
    }))
    .filter((item) =>
      `${item.pn} ${item.nomenclature}`.toLowerCase().includes(needle)
    )
    .filter((item) => item.pn || item.nomenclature)
    .slice(0, MAX_RESULTS);

  return json({ parts }, 200, {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  });
}
