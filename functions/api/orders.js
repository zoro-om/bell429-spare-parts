import {
  requireSession,
  hasPermission,
  json
} from "../_lib/auth.js";

const MAX_BODY = 64 * 1024;
const STAGES = 6;

function cleanOrder(
  input,
  existing = {}
) {
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
      Object.prototype.hasOwnProperty.call(
        input,
        k
      )
    ) {
      out[k] = input[k];
    }
  }

  out.requester =
    String(
      out.requester ??
        existing.requester ??
        ""
    ).slice(0, 120);

  out.orderNo =
    String(
      out.orderNo ??
        existing.orderNo ??
        ""
    ).slice(0, 80);

  out.uin =
    String(
      out.uin ??
        existing.uin ??
        ""
    ).slice(0, 80);

  out.vote =
    String(
      out.vote ??
        existing.vote ??
        ""
    ).slice(0, 80);

  out.departmentPhone =
    String(
      out.departmentPhone ??
        existing.departmentPhone ??
        ""
    ).slice(0, 40);

  out.classification =
    String(
      out.classification ??
        existing.classification ??
        ""
    ).slice(0, 40);

  out.pn =
    String(
      out.pn ??
        existing.pn ??
        ""
    ).slice(0, 120);

  out.partSN =
    String(
      out.partSN ??
        existing.partSN ??
        ""
    ).slice(0, 120);

  out.partName =
    String(
      out.partName ??
        existing.partName ??
        ""
    ).slice(0, 180);

  out.requestDate =
    String(
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

  out.type =
    String(
      out.type ??
        existing.type ??
        ""
    ).slice(0, 30);

  out.requestNotes =
    String(
      out.requestNotes ??
        existing.requestNotes ??
        ""
    ).slice(0, 2000);

  out.urgent = !!(
    out.urgent ??
    existing.urgent
  );

  if (
    Array.isArray(
      out.stages
    )
  ) {
    out.stages =
      out.stages
        .slice(0, STAGES)
        .map((s) => ({
          done: !!s.done,

          rejected:
            !!s.rejected,

          rejectionReason:
            String(
              s.rejectionReason ||
                ""
            ).slice(
              0,
              1000
            ),

          person:
            String(
              s.person || ""
            ).slice(
              0,
              120
            ),

          date:
            String(
              s.date || ""
            ).slice(
              0,
              20
            ),

          notes:
            String(
              s.notes || ""
            ).slice(
              0,
              2000
            )
        }));
  } else if (
    Array.isArray(
      existing.stages
    )
  ) {
    out.stages =
      existing.stages;
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
  ].every(
    (k) =>
      String(
        o[k] || ""
      ).trim()
  );
}

async function readBody(
  request
) {
  const len =
    Number(
      request.headers.get(
        "content-length"
      ) || 0
    );

  if (
    len > MAX_BODY
  ) {
    throw new Error(
      "body_too_large"
    );
  }

  const text =
    await request.text();

  if (
    new TextEncoder()
      .encode(text)
      .byteLength >
    MAX_BODY
  ) {
    throw new Error(
      "body_too_large"
    );
  }

  return JSON.parse(text);
}

async function getOrder(
  env,
  id,
  includeTrash = false
) {
  const row =
    await env.DB
      .prepare(
        "SELECT id,payload,created_at,updated_at,deleted_at FROM orders WHERE id=?"
      )
      .bind(id)
      .first();

  if (
    !row ||
    (!includeTrash &&
      row.deleted_at)
  ) {
    return null;
  }

  const payload =
    JSON.parse(
      row.payload || "{}"
    );

  return {
    ...payload,
    id: row.id,
    createdAt:
      row.created_at,
    updatedAt:
      row.updated_at,
    deletedAt:
      row.deleted_at ||
      undefined
  };
}

export async function onRequestGet(
  context
) {
  const url = new URL(context.request.url);
  const id = url.searchParams.get("id");

  /*
   * Public tracking:
   * GET /api/orders?id=<order-id>
   *
   * No admin session is required.
   * Only tracking-safe fields are returned.
   */
  if (id) {
    const order = await getOrder(
      context.env,
      id,
      false
    );

    if (!order) {
      return json(
        { error: "Order not found" },
        404,
        {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer"
        }
      );
    }

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
        ? order.stages
            .slice(0, STAGES)
            .map((s) => ({
              done: !!s.done,
              rejected: !!s.rejected,

              rejectionReason: String(
                s.rejectionReason || ""
              ).slice(0, 1000),

              date: String(
                s.date || ""
              ).slice(0, 20)
            }))
        : [],

      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };

    return json(
      publicOrder,
      200,
      {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer"
      }
    );
  }

  /*
   * Full list remains ADMIN ONLY.
   */
  const auth =
    await requireSession(
      context.request,
      context.env,
      false
    );

  if (auth.response)
    return auth.response;

  const rows =
    await context.env.DB
      .prepare(
        "SELECT id,payload,created_at,updated_at FROM orders WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 500"
      )
      .all();

  return json(
    (rows.results || [])
      .map((r) => ({
        ...JSON.parse(
          r.payload || "{}"
        ),
        id: r.id,
        createdAt:
          r.created_at,
        updatedAt:
          r.updated_at
      }))
  );
}

/*
 * إنشاء طلب جديد:
 * PUBLIC
 *
 * لا يحتاج تسجيل دخول.
 *
 * الحماية:
 * - Origin check
 * - body size limit
 * - allowed fields
 * - field length limits
 * - validation
 * - generated UUID
 * - stages generated server-side
 */
export async function onRequestPost(
  context
) {
  try {
    const origin =
      context.request.headers.get(
        "Origin"
      );

    if (origin) {
      const requestOrigin =
        new URL(
          context.request.url
        ).origin;

      if (
        origin !==
        requestOrigin
      ) {
        return json(
          {
            error:
              "Invalid origin"
          },
          403
        );
      }
    }

    const body =
      await readBody(
        context.request
      );

    const o =
      cleanOrder(body);

    if (
      !validNewOrder(o)
    ) {
      return json(
        {
          error:
            "Missing required order fields"
        },
        400
      );
    }

    const id =
      crypto.randomUUID();

    const now =
      new Date().toISOString();

    /*
     * المراحل يتم إنشاؤها
     * من الخادم وليس من العميل.
     */
    o.stages =
      Array.from(
        {
          length: STAGES
        },
        () => ({
          done: false,
          rejected: false,
          rejectionReason: "",
          person: "",
          date: "",
          notes: ""
        })
      );

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
     * user_id = null لأن
     * إنشاء الطلب العام
     * لا يملك جلسة مشرف.
     *
     * audit_log يسمح بذلك
     * في قاعدة البيانات الحالية.
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

    return json(
      {
        ...o,
        id,
        createdAt: now,
        updatedAt: now
      },
      201
    );

  } catch (e) {
    return json(
      {
        error:
          e?.message ===
          "body_too_large"
            ? "Request too large"
            : "Bad request"
      },
      400
    );
  }
}

/*
 * تعديل طلب موجود:
 * يحتاج تسجيل دخول.
 */
export async function onRequestPut(
  context
) {
  const auth =
    await requireSession(
      context.request,
      context.env,
      true
    );

  if (auth.response)
    return auth.response;

  const id =
    new URL(
      context.request.url
    ).searchParams.get(
      "id"
    );

  if (!id)
    return json(
      {
        error:
          "Missing id"
      },
      400
    );

  const existing =
    await getOrder(
      context.env,
      id
    );

  if (!existing)
    return json(
      {
        error:
          "Order not found"
      },
      404
    );

  try {
    const body =
      await readBody(
        context.request
      );

    const o =
      cleanOrder(
        body,
        existing
      );

    if (
      !validNewOrder(o)
    ) {
      return json(
        {
          error:
            "Missing required order fields"
        },
        400
      );
    }

    const now =
      new Date().toISOString();

    await context.env.DB
      .prepare(
        "UPDATE orders SET payload=?,updated_at=? WHERE id=? AND deleted_at IS NULL"
      )
      .bind(
        JSON.stringify(o),
        now,
        id
      )
      .run();

    await context.env.DB
      .prepare(
        "INSERT INTO audit_log(user_id,action,target_id) VALUES(?,?,?)"
      )
      .bind(
        auth.session.user_id,
        "update_order",
        id
      )
      .run();

    return json({
      ...o,
      id,
      createdAt:
        existing.createdAt,
      updatedAt: now
    });

  } catch (e) {
    return json(
      {
        error:
          e?.message ===
          "body_too_large"
            ? "Request too large"
            : "Bad request"
      },
      400
    );
  }
}

/*
 * حذف الطلب:
 * يحتاج جلسة + صلاحية delete.
 */
export async function onRequestDelete(
  context
) {
  const auth =
    await requireSession(
      context.request,
      context.env,
      true
    );

  if (auth.response)
    return auth.response;

  if (
    !hasPermission(
      auth.session,
      "delete"
    )
  ) {
    return json(
      {
        error:
          "Forbidden"
      },
      403
    );
  }

  const id =
    new URL(
      context.request.url
    ).searchParams.get(
      "id"
    );

  if (!id)
    return json(
      {
        error:
          "Missing id"
      },
      400
    );

  const existing =
    await getOrder(
      context.env,
      id
    );

  if (!existing)
    return json(
      {
        error:
          "Order not found"
      },
      404
    );

  const now =
    new Date().toISOString();

  await context.env.DB
    .prepare(
      "UPDATE orders SET deleted_at=?,updated_at=? WHERE id=? AND deleted_at IS NULL"
    )
    .bind(
      now,
      now,
      id
    )
    .run();

  await context.env.DB
    .prepare(
      "INSERT INTO audit_log(user_id,action,target_id) VALUES(?,?,?)"
    )
    .bind(
      auth.session.user_id,
      "delete_order",
      id
    )
    .run();

  return json({
    ok: true
  });
}