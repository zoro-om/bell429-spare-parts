import { json, sha256 } from "../../_lib/auth.js";
import { ensureSecuritySchema } from "../../_lib/schema.js";

function validUsername(value) {
  return /^[A-Za-z0-9._-]{3,40}$/.test(value);
}

async function tokenMatches(supplied, expected) {
  if (!supplied || !expected) return false;

  const a = await sha256(supplied);
  const b = await sha256(expected);

  return a === b;
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

function b64url(bytes) {
  let s = "";

  for (const b of bytes) {
    s += String.fromCharCode(b);
  }

  return btoa(s)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function onRequestPost(context) {
  const env = context.env;

  try {
    await ensureSecuritySchema(env);

    const suppliedToken =
      context.request.headers.get("X-Setup-Token") || "";

    if (!(await tokenMatches(suppliedToken, env.SETUP_TOKEN))) {
      return json({ error: "Not found" }, 404);
    }

    const body = await context.request.json().catch(() => null);

    const configuredUsername =
      String(env.ADMIN_USER || "").trim();

    const requestedUsername =
      String(body?.username || "").trim();

    const username =
      configuredUsername || requestedUsername;

    if (
      configuredUsername &&
      requestedUsername &&
      configuredUsername !== requestedUsername
    ) {
      return json(
        { error: "Username does not match ADMIN_USER" },
        400
      );
    }

    const password = String(
      body?.password || env.ADMIN_PASSWORD || ""
    );

    if (
      !validUsername(username) ||
      password.length < 12 ||
      password.length > 256
    ) {
      return json(
        { error: "Invalid username or password" },
        400
      );
    }

    const count = await env.DB
      .prepare("SELECT COUNT(*) AS n FROM users")
      .first();

    if (Number(count?.n || 0) !== 0) {
      return json(
        { error: "Setup already completed" },
        409
      );
    }

    const id = crypto.randomUUID();

    await env.DB.prepare(`
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
      "designer",
      "{}"
    ).run();

    await env.DB.prepare(`
      INSERT INTO audit_log(
        user_id,
        action,
        target_id
      )
      VALUES(?,?,?)
    `).bind(
      id,
      "initial_setup",
      id
    ).run();

    return json(
      { ok: true, username },
      201
    );

  } catch (error) {
    console.error("SETUP_ERROR", error);

    return json(
      {
        error: "Setup service unavailable",
        detail: String(error?.message || error)
      },
      503
    );
  }
}