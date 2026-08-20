import {
  requireSession,
  hasPermission,
  json
} from "../_lib/auth.js";

const MAX_BODY = 64 * 1024;
const STAGES = 6;

function cleanOrder(input, existing = {}) {
  const allowed = [
    "requester",
    "orderNo",
    "uin",
    "vote",
    "departmentPhone",
    "classification",
    "pn",
    "partSN",
    "partName",
    "requestDate",
    "qty",
    "type",
    "requestNotes",
    "urgent",
    "stages"
  ];

  const out = {};

  for (const k of allowed) {
    if (
      input &&
      Object.prototype.hasOwnProperty.call(input, k)
    ) {
      out[k] = input[k];
    }
  }

  out.requester = String(
    out.requester ??
      existing.requester ??
      ""
  ).slice(0, 120);

  out.orderNo = String(
    out.orderNo ??
      existing.orderNo ??
      ""
  ).slice(0, 80);

  out.uin = String(
    out.uin ??
      existing.uin ??
      ""
  ).slice(0, 80);

  out.vote = String(
    out.vote ??
      existing.vote ??
      ""
  ).slice(0, 80);

  out.departmentPhone = String(
    out.departmentPhone ??
      existing.departmentPhone ??
      ""
  ).slice(0, 40);

  out.classification = String(
    out.classification ??
      existing.classification ??
      ""
  ).slice(0, 40);

  out.pn = String(
    out.pn ??
      existing.pn ??
      ""
  ).slice(0, 120);

  out.partSN = String(
    out.partSN ??
      existing.partSN ??
      ""
  ).slice(0, 120);

  out.partName = String(
    out.partName ??
      existing.partName ??
      ""
  ).slice(0, 180);

  out.requestDate = String(
    out.requestDate ??
      existing.requestDate ??
      ""
  ).slice(0, 20);

  out.qty = Math.max(
    1,
    Math.min(
      100000,
      Number(
        out.qty ??
          existing.qty ??
          1
      ) || 1
    )
  );

  out.type = String(
    out.type ??
      existing.type ??
      ""
  ).slice(0, 30);

  out.requestNotes = String(
    out.requestNotes ??
      existing.requestNotes ??
      ""
  ).slice(0, 2000);

  out.urgent = !!(
    out.urgent ??
    existing.urgent
  );

  if (Array.isArray(out.stages)) {
    out.stages = out.stages
      .slice(0, STAGES)
      .map((s) => ({
        done: !!s.done,

        rejected: !!s.rejected,

        rejectionReason: String(
          s.rejectionReason || ""
        ).slice(0, 1000),

        person: String(
          s.person || ""
        ).slice(0, 120),

        date: String(
          s.date || ""
        ).slice(0, 20),

        notes: String(
          s.notes || ""
        ).slice(0, 2000)
      }));
  } else if (Array.isArray(existing.stages)) {
    out.stages = existing.stages;
  }

  return out;
}

function validNewOrder(o) {
  return [
    "requester",
    "orderNo",
    "uin",
    "vote",
    "departmentPhone",
    "classification",
    "pn",
    "partName",
    "requestDate",
    "type"
  ].every((k) =>
    String(o[k] || "").trim()
  );
}

async function readBody(request) {
  const len = Number(
    request.headers.get("content-length") || 0
  );

  if (len > MAX_BODY) {
    throw new Error("body_too_large");
  }

  const text = await request.text();

  if (
    new TextEncoder()
      .encode(text)
      .byteLength > MAX_BODY
  ) {
    throw new Error("body_too_large");
  }

  if (!text.trim()) {
    throw new Error("empty_body");
  }

  return JSON.parse(text);
}

async function getOrder(
  env,
  id,
  includeTrash = false
) {
  const row = await env.DB
    .prepare(
      "SELECT id,payload,created_at,updated_at,deleted_at FROM orders WHERE id=?"
    )
    .bind(id)
    .first();

  if (
    !row ||
    (!includeTrash && row.deleted_at)
  ) {
    return null;
  }

  let payload = {};

  try {
    payload = JSON.parse(
      row.payload || "{}"
    );
  } catch {
    payload = {};
  }

  return {
    ...payload,
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt:
      row.deleted_at || undefined
  };
}

/*
 * GET
 *
 * إذا كان هناك ?id=
 * يسمح بالتتبع العام لطلب واحد فقط.
 *
 * بدون id:
 * قائمة الطلبات للمشرفين فقط.
 */
export async function onRequestGet(context) {
  const url = new URL(
    context.request.url
  );

  const id = url.searchParams.get("id");

  /*
   * PUBLIC ORDER TRACKING
   */
  if (id) {
    const order = await getOrder(
      context.env,
      id,
      false
    );

    if (!order) {
      return json(
        {
          error: "Order not found"
        },
        404,
        {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer"
        }
      );
    }

    /*
     * لا نكشف البيانات الداخلية
     * في التتبع العام.
     */
    const publicOrder = {
      id: order.id,
      orderNo: order.orderNo,
      pn: order.pn,
      partName: order.partName,
      requestDate: order.requestDate,
      qty: order.qty,
      type: order.type,
      urgent: !!order.urgent,

      stages: Array.isArray(order.stages)
        ? order.stages.map((s) => ({
            done: !!s.done,
            rejected: !!s.rejected,
            rejectionReason: