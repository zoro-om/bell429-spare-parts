import { json } from "../_lib/auth.js";

const MAX_RESULTS = 25;
const MAX_QUERY_LENGTH = 80;

function clean(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);

  // الفهرس العام: لا يحتاج تسجيل دخول.
  // لكن لا نعيد البيانات الحساسة أو مراجع ملفات PDF.

  const q = clean(
    url.searchParams.get("q") || ""
  ).slice(0, MAX_QUERY_LENGTH);

  if (q.length < 2) {
    return json(
      { parts: [] },
      200,
      {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      }
    );
  }

  // الوصول إلى ملف الفهرس داخليًا فقط عبر ASSETS.
  // لن يكون الملف نفسه متاحًا مباشرة للزائر.
  const assetUrl = new URL(
    "/parts_index.json",
    context.request.url
  );

  const asset = await context.env.ASSETS.fetch(assetUrl);

  if (!asset.ok) {
    return json(
      { error: "Catalog unavailable" },
      503,
      {
        "Cache-Control": "no-store",
      }
    );
  }

  const data = await asset.json().catch(() => null);

  if (!data || !Array.isArray(data.parts)) {
    return json(
      { error: "Catalog unavailable" },
      503,
      {
        "Cache-Control": "no-store",
      }
    );
  }

  const needle = q.toLowerCase();

  const parts = data.parts
    .map((item) => {
      const pn = clean(
        item.part_number ?? item.pn
      );

      const nomenclature = clean(
        item.nomenclature ?? item.title
      );

      return {
        pn,
        nomenclature,
      };
    })
    .filter((item) => {
      const searchable =
        `${item.pn} ${item.nomenclature}`.toLowerCase();

      return searchable.includes(needle);
    })
    .filter((item) => item.pn || item.nomenclature)
    .slice(0, MAX_RESULTS);

  return json(
    { parts },
    200,
    {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    }
  );
}