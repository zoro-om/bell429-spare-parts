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

  if (auth.response) return auth.response;

  if (
    auth.session.role !== "designer" &&
    !hasPermission(auth.session, "trash")
  ) {
    return json({ error: "Forbidden" }, 403);
  }

  const result = await context.env.DB.prepare(`
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
  `).all();

  return json(
    (result.results || []).map((row) => {
      let payload = {};

      try {
        payload = JSON.parse(row.payload || "{}");
      } catch {}

      return {
        ...payload,
        id: row.id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at
      };
    })
  );
}

export async function onRequestPost(context) {
  const auth = await requireSession(
    context.request,
    context.env,
    true
  );

  if (auth.response) return auth.response;

  if (
    auth.session.role !== "designer" &&
    !hasPermission(auth.session, "trash")
  ) {
    return json({ error: "Forbidden" }, 403);
  }

  let body;

  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const action = String(body?.action || "");

  if (action === "restore") {
    const id = String(body?.id || "");

    if (!id || id.length > 100) {
      return json({ error: "Missing id" }, 400);
    }

    const row = await context.env.DB.prepare(`
      SELECT id
      FROM orders
      WHERE id=? AND deleted_at IS NOT NULL
    `).bind(id).first();

    if (!row) {
      return json({ error: "Order not found" }, 404);
    }

    const now = new Date().toISOString();

    await context.env.DB.prepare(`
      UPDATE orders
      SET deleted_at=NULL, updated_at=?
      WHERE id=?
    `).bind(now, id).run();

    await context.env.DB.prepare(`
      INSERT INTO audit_log(user_id, action, target_id)
      VALUES(?,?,?)
    `).bind(
      auth.session.user_id,
      "restore_order",
      id
    ).run();

    return json({ ok: true });
  }

  if (action === "purge") {
    await context.env.DB.prepare(`
      DELETE FROM orders
      WHERE deleted_at IS NOT NULL
    `).run();

    await context.env.DB.prepare(`
      INSERT INTO audit_log(user_id, action, target_id)
      VALUES(?,?,?)
    `).bind(
      auth.session.user_id,
      "purge_trash",
      "all"
    ).run();

    return json({ ok: true });
  }

  return json(
    { error: "Invalid trash action" },
    400
  );
}
