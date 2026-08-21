import {
  requireSession,
  hasPermission,
  json
} from "../_lib/auth.js";

export async function onRequestGet(context) {
  const auth = await requireSession(
    context.request,
    context.env,
    false
  );

  if (auth.response) {
    return auth.response;
  }

  if (!hasPermission(auth.session, "trash")) {
    return json(
      { error: "Forbidden" },
      403
    );
  }

  const rows = await context.env.DB
    .prepare(
      `
      SELECT
        id,
        payload,
        created_at,
        updated_at,
        deleted_at
      FROM orders
      WHERE deleted_at IS NOT NULL
      ORDER BY deleted_at DESC
      LIMIT 500
      `
    )
    .all();

  const results = [];

  for (const row of rows.results || []) {
    let payload = {};

    try {
      payload = JSON.parse(row.payload || "{}");
    } catch {
      payload = {};
    }

    results.push({
      ...payload,
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at
    });
  }

  return json(results);
}

export async function onRequestPost(context) {
  const auth = await requireSession(
    context.request,
    context.env,
    true
  );

  if (auth.response) {
    return auth.response;
  }

  let body;

  try {
    body = await context.request.json();
  } catch {
    return json(
      { error: "Invalid request" },
      400
    );
  }

  const action = String(
    body?.action || ""
  ).trim();

  const id = String(
    body?.id || ""
  ).trim();

  if (action === "restore") {
    if (
      !hasPermission(
        auth.session,
        "delete"
      )
    ) {
      return json(
        { error: "Forbidden" },
        403
      );
    }

    if (!id) {
      return json(
        { error: "Missing id" },
        400
      );
    }

    const existing = await context.env.DB
      .prepare(
        `
        SELECT id
        FROM orders
        WHERE id = ?
          AND deleted_at IS NOT NULL
        `
      )
      .bind(id)
      .first();

    if (!existing) {
      return json(
        { error: "Order not found" },
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
          deleted_at = NULL,
          updated_at = ?
        WHERE id = ?
          AND deleted_at IS NOT NULL
        `
      )
      .bind(now, id)
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
        "restore_order",
        id
      )
      .run();

    return json({
      ok: true
    });
  }

  if (action === "purge") {
    if (
      !hasPermission(
        auth.session,
        "trash"
      )
    ) {
      return json(
        { error: "Forbidden" },
        403
      );
    }

    await context.env.DB
      .prepare(
        `
        DELETE FROM orders
        WHERE deleted_at IS NOT NULL
        `
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
        "purge_trash",
        "*"
      )
      .run();

    return json({
      ok: true
    });
  }

  return json(
    { error: "Unknown action" },
    400
  );
}