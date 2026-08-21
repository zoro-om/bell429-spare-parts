import {
  requireSession,
  hasPermission,
  json
} from "../_lib/auth.js";

const MAX_BODY = 64 * 1024;
const STAGES = 6;
const MAX_REQUEST_NOTES = 2000;

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function boundedString(value, fallback, max) {
  if (value === undefined || value === null) {
    return String(fallback ?? "").slice(0, max);
  }

  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return String(fallback ?? "").slice(0, max);
  }

  return String(value).slice(0, max);
}

function booleanValue(value, fallback = false) {
  if (value === undefined || value === null) {
    return !!fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value === 1 || value === "1" || value === "true") {
    return true;
  }

  if (value === 0 || value === "0" || value === "false") {
    return false;
  }

  return !!fallback;
}

function validISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

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

  out.requester = boundedString(
    out.requester,
    existing.requester,
    120
  );

  out.orderNo = boundedString(
    out.orderNo,
    existing.orderNo,
    80
  );

  out.uin = boundedString(
    out.uin,
    existing.uin,
    80
  );

  out.vote = boundedString(
    out.vote,
    existing.vote,
    80
  );

  out.departmentPhone = boundedString(
    out.departmentPhone,
    existing.departmentPhone,
    40
  );

  out.classification = boundedString(
    out.classification,
    existing.classification,
    40
  );

  out.pn = boundedString(
    out.pn,
    existing.pn,
    120
  );

  out.partSN = boundedString(
    out.partSN,
    existing.partSN,
    120
  );

  out.partName = boundedString(
    out.partName,
    existing.partName,
    180
  );

  out.requestDate = boundedString(
    out.requestDate,
    existing.requestDate,
    20
  );

  const rawQty =
    out.qty ??
    existing.qty ??
    1;

  const parsedQty =
    typeof rawQty === "number"
      ? rawQty
      : Number(rawQty);

  out.qty =
    Number.isFinite(parsedQty) &&
    Number.isInteger(parsedQty)
      ? Math.max(
          1,
          Math.min(100000, parsedQty)
        )
      : 1;

  out.type = boundedString(
    out.type,
    existing.type,
    30
  );

  out.requestNotes = boundedString(
    out.requestNotes,
    existing.requestNotes,
    MAX_REQUEST_NOTES
  );

  out.urgent = booleanValue(
    out.urgent,
    existing.urgent
  );

  if (Array.isArray(out.stages)) {
    out.stages = out.stages
      .slice(0, STAGES)
      .map((s) => {
        const stage = isPlainObject(s)
          ? s
          : {};

        return {
          done: booleanValue(stage.done),

          rejected: booleanValue(
            stage.rejected
          ),

          rejectionReason: boundedString(
            stage.rejectionReason,
            "",
            1000
          ),

          person: boundedString(
            stage.person,
            "",
            120
          ),

          date: boundedString(
            stage.date,
            "",
            20
          ),

          notes: boundedString(
            stage.notes,
            "",
            MAX_REQUEST_NOTES
          )
        };
      });
  } else if (Array.isArray(existing.stages)) {
    out.stages = existing.stages;
  }

  return out;
}

function validNewOrder(o) {
  const required = [
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
  ];

  if (
    !required.every(
      (k) =>
        typeof o[k] === "string" &&
        o[k].trim().length > 0
    )
  ) {
    return false;
  }

  if (
    !Number.isInteger(o.qty) ||
    o.qty < 1 ||
    o.qty > 100000
  ) {
    return false;
  }

  return true;
}

async function readBody(request) {
  const contentType =
    request.headers.get(
      "content-type"
    ) || "";

  if (
    !contentType
      .toLowerCase()
      .startsWith("application/json")
  ) {
    throw new Error(
      "unsupported_content_type"
    );
  }

  const len = Number(
    request.headers.get(
      "content-length"
    ) || 0
  );

  if (
    Number.isFinite(len) &&
    len > MAX_BODY
  ) {
    throw new Error(
      "body_too_large"
    );
  }

  const text = await request.text();

  if (
    new TextEncoder()
      .encode(text)
      .byteLength > MAX_BODY
  ) {
    throw new Error(
      "body_too_large"
    );
  }

  let body;

  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(
      "invalid_json"
    );
  }

  if (!isPlainObject(body)) {
    throw new Error(
      "invalid_body"
    );
  }

  return body;
}

async function getOrder(
  env,
  id,
  includeTrash = false
) {
  const row =
    await env.DB
      .prepare(
        `
        SELECT
          id,
          payload,
          created_at,
          updated_at,
          deleted_at
        FROM orders
        WHERE id=?
        `
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

export async function onRequestGet(context) {
  const url = new URL(
    context.request.url
  );

  const id =
    url.searchParams.get("id");

  /*
   * Public tracking:
   * GET /api/orders?id=<order-id>
   */
  if (id) {
    const order =
      await getOrder(
        context.env,
        id,
        false
      );

    if (!order) {
      return json(
        {
          error:
            "Order not found"
        },
        404,
        {
          "Cache-Control":
            "no-store",
          "X-Content-Type-Options":
            "nosniff",
          "Referrer-Policy":
            "no-referrer"
        }
      );
    }

    const publicOrder = {
      id: order.id,

      orderNo:
        order.orderNo,

      pn:
        order.pn,

      partName:
        order.partName,

      requestDate:
        order.requestDate,

      qty:
        order.qty,

      type:
        order.type,

      urgent:
        !!order.urgent,

      stages:
        Array.isArray(
          order.stages
        )
          ? order.stages
              .slice(
                0,
                STAGES
              )
              .map((s) => ({
                done:
                  !!s.done,

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

                date:
                  String(
                    s.date || ""
                  ).slice(
                    0,
                    20
                  )
              }))
          : [],

      createdAt:
        order.createdAt,

      updatedAt:
        order.updatedAt
    };

    return json(
      publicOrder,
      200,
      {
        "Cache-Control":
          "no-store",

        "X-Content-Type-Options":
          "nosniff",

        "Referrer-Policy":
          "no-referrer"
      }
    );
  }

  /*
   * Full order list:
   * requires authentication + index permission.
   */
  const auth =
    await requireSession(
      context.request,
      context.env,
      false
    );

  if (auth.response) {
    return auth.response;
  }

  if (
    !hasPermission(
      auth.session,
      "index"
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

  const rows =
    await context.env.DB
      .prepare(
        `
        SELECT
          id,
          payload,
          created_at,
          updated_at
        FROM orders
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 500
        `
      )
      .all();

  return json(
    (rows.results || [])
      .map((r) => {
        let payload = {};

        try {
          payload = JSON.parse(
            r.payload || "{}"
          );
        } catch {
          payload = {};
        }

        return {
          ...payload,
          id: r.id,
          createdAt:
            r.created_at,
          updatedAt:
            r.updated_at
        };
      })
  );
}

/*
 * إنشاء طلب جديد:
 * PUBLIC
 *
 * الحماية:
 * - Origin check
 * - body size limit
 * - JSON content type
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

    const requestOrigin =
      new URL(
        context.request.url
      ).origin;

    if (
      !origin ||
      origin !== requestOrigin
    ) {
      return json(
        {
          error:
            "Invalid origin"
        },
        403,
        {
          "Cache-Control":
            "no-store",

          "X-Content-Type-Options":
            "nosniff"
        }
      );
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

    /*
     * Validate requestDate when supplied.
     */
    if (
      !validISODate(
        o.requestDate
      )
    ) {
      return json(
        {
          error:
            "Invalid request date"
        },
        400
      );
    }

    const id =
      crypto.randomUUID();

    const now =
      new Date().toISOString();

    /*
     * Stages are always generated
     * server-side.
     *
     * Client cannot create arbitrary
     * stage state when creating an order.
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
        `
        INSERT INTO orders(
          id,
          payload,
          created_at,
          updated_at
        )
        VALUES(?,?,?,?)
        `
      )
      .bind(
        id,
        JSON.stringify(o),
        now,
        now
      )
      .run();

    await context.env.DB
      .prepare(
        `
        INSERT INTO audit_log(
          user_id,
          action,
          target_id
        )
        VALUES(?,?,?)
        `
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
    const message =
      e?.message || "";

    return json(
      {
        error:
          message ===
          "body_too_large"
            ? "Request too large"

            : message ===
              "unsupported_content_type"
              ? "Content-Type must be application/json"

            : message ===
              "invalid_json"
              ? "Invalid JSON"

            : message ===
              "invalid_body"
              ? "Invalid request body"

            : "Bad request"
      },
      400
    );
  }
}

/*
 * تعديل طلب موجود:
 * يحتاج تسجيل دخول
 * + صلاحية index
 * + CSRF.
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

  if (auth.response) {
    return auth.response;
  }

  if (
    !hasPermission(
      auth.session,
      "index"
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

  if (!id) {
    return json(
      {
        error:
          "Missing id"
      },
      400
    );
  }

  const existing =
    await getOrder(
      context.env,
      id
    );

  if (!existing) {
    return json(
      {
        error:
          "Order not found"
      },
      404
    );
  }

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

    if (
      !validISODate(
        o.requestDate
      )
    ) {
      return json(
        {
          error:
            "Invalid request date"
        },
        400
      );
    }

    const now =
      new Date().toISOString();

    await context.env.DB
      .prepare(
        `
        UPDATE orders
        SET
          payload=?,
          updated_at=?
        WHERE id=?
          AND deleted_at IS NULL
        `
      )
      .bind(
        JSON.stringify(o),
        now,
        id
      )
      .run();

    await context.env.DB
      .prepare(
        `
        INSERT INTO audit_log(
          user_id,
          action,
          target_id
        )
        VALUES(?,?,?)
        `
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
    const message =
      e?.message || "";

    return json(
      {
        error:
          message ===
          "body_too_large"
            ? "Request too large"

            : message ===
              "unsupported_content_type"
              ? "Content-Type must be application/json"

            : message ===
              "invalid_json"
              ? "Invalid JSON"

            : message ===
              "invalid_body"
              ? "Invalid request body"

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

  if (auth.response) {
    return auth.response;
  }

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

  if (!id) {
    return json(
      {
        error:
          "Missing id"
      },
      400
    );
  }

  const existing =
    await getOrder(
      context.env,
      id
    );

  if (!existing) {
    return json(
      {
        error:
          "Order not found"
      },
      404
    );
  }

  const now =
    new Date().toISOString();

  await context.env.DB
    .prepare(
      `
      UPDATE orders
      SET
        deleted_at=?,
        updated_at=?
      WHERE id=?
        AND deleted_at IS NULL
      `
    )
    .bind(
      now,
      now,
      id
    )
    .run();

  await context.env.DB
    .prepare(
      `
      INSERT INTO audit_log(
        user_id,
        action,
        target_id
      )
      VALUES(?,?,?)
      `
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
