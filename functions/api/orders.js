import { requireSession, hasPermission, json } from "../_lib/auth.js";

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
    out.requester ?? existing.requester ?? ""
  ).slice(0, 120);

  out.orderNo = String(
    out.orderNo ?? existing.orderNo ?? ""
  ).slice(0, 80);

  out.uin = String(
    out.uin ?? existing.uin ?? ""
  ).slice(0, 80);

  out.vote = String(
    out.vote ?? existing.vote ?? ""
  ).slice(0, 80);

  out.departmentPhone = String(
    out.departmentPhone ?? existing.departmentPhone ?? ""
  ).slice(0, 40);

  out.classification = String(
    out.classification ?? existing.classification ?? ""
  ).slice(0, 40);

  out.pn = String(
    out.pn ?? existing.pn ?? ""
  ).slice(0, 120);

  out.partSN = String(
    out.partSN ?? existing.partSN ?? ""
  ).slice(0, 120);

  out.partName = String(
    out.partName ?? existing.partName ?? ""
  ).slice(0, 180);

  out.requestDate = String(
    out.requestDate ?? existing.requestDate ?? ""
  ).slice(0, 20);

  out.qty = Math.max(
    1,
    Math.min(
      100000,
      Number(out.qty ?? existing.qty ?? 1) || 1
    )
  );

  out.type = String(
    out.type ?? existing.type ?? ""
  ).slice(0, 30);

  out.requestNotes = String(
    out.requestNotes ?? existing.requestNotes ?? ""
  ).slice(0, 2000);

  out.urgent = !!(
    out.urgent ?? existing.urgent
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
        ).slice(0, 2000),
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

  const payload = JSON.parse(
    row.payload || "{}"
  );

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
 * عرض جميع الطلبات.
 * يبقى محميًا ويتطلب تسجيل الدخول.
 */
export async function onRequestGet(context) {
  const auth = await requireSession(
    context.request,
    context.env,
    false
  );

  if (auth.response) {
    return auth.response;
  }

  const rows = await context.env.DB
    .prepare(
      "SELECT id,payload,created_at,updated_at FROM orders WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 500"
    )
    .all();

  return json(
    (rows.results || []).map((r) => ({
      ...JSON.parse(r.payload || "{}"),
      id: r.id,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }))
  );
}


/*
 * POST
 *
 * إنشاء طلب جديد.
 *
 * مهم:
 * لا يوجد requireSession هنا.
 * المستخدم يستطيع إنشاء الطلب بدون تسجيل دخول.
 */
export async function onRequestPost(context) {
  try {
    const body = await readBody(
      context.request
    );

    const o = cleanOrder(body);

    if (!validNewOrder(o)) {
      return json(
        {
          error:
            "Missing required order fields"
        },
        400
      );
    }

    const id = crypto.randomUUID();

    const now =
      new Date().toISOString();

    /*
     * إنشاء المراحل الست تلقائيًا.
     */
    o.stages = Array.from(
      { length: STAGES },
      () => ({
        done: false,
        rejected: false,
        rejectionReason: "",
        person: "",
        date: "",
        notes: ""
      })
    );

    /*
     * حفظ الطلب في قاعدة البيانات.
     */
    await context.env.DB
      .prepare(
        "INSERT INTO orders(id,payload,created_at,updated_at) VALUES(?,?,?,?)"
      )
      .bind(
        id,
        JSON.stringify(o),
        now,
        now
      )
      .run();

    /*
     * تسجيل العملية في audit_log.
     *
     * user_id = null لأن المستخدم
     * لم يسجل الدخول.
     *
     * قاعدة البيانات الحالية تسمح بذلك.
     */
    await context.env.DB
      .prepare(
        "INSERT INTO audit_log(user_id,action,target_id) VALUES(?,?,?)"
      )
      .bind(
        null,
        "create_order",
        id
      )
      .run();

    /*
     * إرجاع الطلب إلى الواجهة.
     */
    return json(
      {
        ...o,
        id,
        created
