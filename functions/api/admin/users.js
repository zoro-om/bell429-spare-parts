import {
  requireSession,
  hasPermission,
  json
} from "../../_lib/auth.js";
import { ensureSecuritySchema } from "../../_lib/schema.js";

function validUsername(value) {
  return /^[A-Za-z0-9._-]{3,40}$/.test(value);
}

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);

  return btoa(s)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function hashPassword(password) {
  const iterations = 210000;
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256"
    },
    key,
    256
  );

  return `pbkdf2$${iterations}$${b64url(salt)}$${b64url(
    new Uint8Array(bits)
  )}`;
}

async function requireDesigner(context, csrf = false) {
  await ensureSecuritySchema(context.env);

  const auth = await requireSession(
    context.request,
    context.env,
    csrf
  );

  if (auth.response) return auth;

  if (auth.session.role !== "designer") {
    return {
      response: json({ error: "Forbidden" }, 403),
      session: null
    };
  }

  return auth;
}

export async function onRequestGet(context) {
  const auth = await requireDesigner(context);

  if (auth.response) return auth.response;

  const result = await context.env.DB.prepare(`
    SELECT id, username, role, permissions, enabled, created_at
    FROM users
    ORDER BY created_at ASC
  `).all();

  return json(
    (result.results || []).map((user) => {
      let permissions = {};

      try {
        permissions = JSON.parse(user.permissions || "{}");
      } catch {}

      return {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions,
        enabled: Number(user.enabled) === 1,
        createdAt: user.created_at
      };
    })
  );
}

export async function onRequestPost(context) {
  const auth = await requireDesigner(context, true);

  if (auth.response) return auth.response;

  let body;

  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");

  if (!validUsername(username)) {
    return json({ error: "Invalid username" }, 400);
  }

  if (password.length < 12 || password.length > 256) {
    return json(
      { error: "Password must be 12-256 characters" },
      400
    );
  }

  const exists = await context.env.DB.prepare(
    "SELECT id FROM users WHERE username=?"
  ).bind(username).first();

  if (exists) {
    return json({ error: "Username already exists" }, 409);
  }

  const permissions =
    body?.permissions &&
    typeof body.permissions === "object" &&
    !Array.isArray(body.permissions)
      ? body.permissions
      : {
          delete: true,
          trash: false,
          index: false
        };

  const id = crypto.randomUUID();

  await context.env.DB.prepare(`
    INSERT INTO users(
      id,
      username,
      password_hash,
      role,
      permissions,
      enabled
    )
    VALUES(?,?,?,?,?,1)
  `).bind(
    id,
    username,
    await hashPassword(password),
    "supervisor",
    JSON.stringify(permissions)
  ).run();

  await context.env.DB.prepare(`
    INSERT INTO audit_log(user_id, action, target_id)
    VALUES(?,?,?)
  `).bind(
    auth.session.user_id,
    "create_supervisor",
    id
  ).run();

  return json(
    {
      ok: true,
      id,
      username,
      role: "supervisor",
      permissions
    },
    201
  );
}

export async function onRequestDelete(context) {
  const auth = await requireDesigner(context, true);

  if (auth.response) return auth.response;

  const id =
    new URL(context.request.url)
      .searchParams
      .get("id") || "";

  if (!id || id.length > 100) {
    return json({ error: "Missing id" }, 400);
  }

  if (id === auth.session.user_id) {
    return json(
      { error: "Cannot remove your own account" },
      400
    );
  }

  const user = await context.env.DB.prepare(`
    SELECT id, username, role
    FROM users
    WHERE id=?
  `).bind(id).first();

  if (!user) {
    return json({ error: "User not found" }, 404);
  }

  if (user.role === "designer") {
    return json(
      { error: "Cannot remove designer account" },
      403
    );
  }

  await context.env.DB.prepare(
    "DELETE FROM users WHERE id=?"
  ).bind(id).run();

  await context.env.DB.prepare(`
    INSERT INTO audit_log(user_id, action, target_id)
    VALUES(?,?,?)
  `).bind(
    auth.session.user_id,
    "delete_supervisor",
    id
  ).run();

  return json({ ok: true });
}
