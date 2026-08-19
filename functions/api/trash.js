import { requireSession, hasPermission, json } from "../_lib/auth.js";

export async function onRequestGet(context) {
  const auth = await requireSession(context.request, context.env, false);
  if (auth.response) return auth.response;
  const rows = await context.env.DB.prepare("SELECT id,payload,created_at,updated_at,deleted_at FROM orders WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 500").all();
  return json((rows.results || []).map(r => ({ ...JSON.parse(r.payload || "{}"), id:r.id, createdAt:r.created_at, updatedAt:r.updated_at, deletedAt:r.deleted_at })));
}

export async function onRequestPost(context) {
  const auth = await requireSession(context.request, context.env, true);
  if (auth.response) return auth.response;
  const body = await context.request.json().catch(() => ({}));
  const action = String(body.action || "");
  const id = String(body.id || "");
  if (action === "restore") {
    if (!hasPermission(auth.session, "delete")) return json({ error: "Forbidden" }, 403);
    if (!id) return json({ error: "Missing id" }, 400);
    await context.env.DB.prepare("UPDATE orders SET deleted_at=NULL,updated_at=? WHERE id=? AND deleted_at IS NOT NULL").bind(new Date().toISOString(), id).run();
    await context.env.DB.prepare("INSERT INTO audit_log(user_id,action,target_id) VALUES(?,?,?)").bind(auth.session.user_id, "restore_order", id).run();
    return json({ ok:true });
  }
  if (action === "purge") {
    if (!hasPermission(auth.session, "trash")) return json({ error: "Forbidden" }, 403);
    await context.env.DB.prepare("DELETE FROM orders WHERE deleted_at IS NOT NULL").run();
    await context.env.DB.prepare("INSERT INTO audit_log(user_id,action,target_id) VALUES(?,?,?)").bind(auth.session.user_id, "purge_trash", "*").run();
    return json({ ok:true });
  }
  return json({ error:"Unknown action" },400);
}
