const SESSION_COOKIE = "b429_session";
const SESSION_TTL = 60 * 60 * 8;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function parseCookies(request) {
  const out = {};
  const raw = request.headers.get("Cookie") || "";
  for (const p of raw.split(";")) {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  }
  return out;
}

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromB64url(s) {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
async function sha256(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return b64url(new Uint8Array(d));
}
async function pbkdf2(password, salt, iterations, length = 32) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, length * 8);
  return new Uint8Array(bits);
}
async function verifyPassword(password, record) {
  const parts = String(record || "").split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 210000 || iterations > 1000000) return false;
  try {
    const expected = fromB64url(parts[3]);
    const actual = await pbkdf2(password, fromB64url(parts[2]), iterations, expected.length);
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
    return diff === 0;
  } catch { return false; }
}

export async function getSession(request, env) {
  const sid = parseCookies(request)[SESSION_COOKIE];
  if (!sid) return null;
  const row = await env.DB.prepare(`SELECT s.id_hash,s.user_id,s.csrf_hash,s.expires_at,u.username,u.role,u.permissions,u.enabled FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id_hash=? AND s.expires_at>? AND u.enabled=1`).bind(await sha256(sid), Math.floor(Date.now()/1000)).first();
  if (!row) return null;
  let permissions = {};
  try { permissions = JSON.parse(row.permissions || "{}"); } catch {}
  return { ...row, permissions };
}

export async function requireSession(request, env, csrf = false) {
  const session = await getSession(request, env);
  if (!session) return { response: json({ error: "Authentication required" }, 401), session: null };
  if (csrf) {
    const token = request.headers.get("X-CSRF-Token") || "";
    if (!token || (await sha256(token)) !== session.csrf_hash) return { response: json({ error: "CSRF validation failed" }, 403), session: null };
  }
  return { response: null, session };
}

export function hasPermission(session, permission) {
  return session?.role === "designer" || session?.permissions?.[permission] === true;
}

export async function login(request, env) {
  const body = await request.json().catch(() => null);
  const username = String(body?.username || "").trim().slice(0, 80);
  const password = String(body?.password || "");
  if (!username || !password || password.length > 256) return json({ error: "Invalid credentials" }, 401);

  const user = await env.DB.prepare("SELECT id,username,password_hash,role,permissions,enabled FROM users WHERE username=?").bind(username).first();
  if (!user || !user.enabled || !(await verifyPassword(password, user.password_hash))) return json({ error: "Invalid credentials" }, 401);

  const sid = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const csrf = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const expires = Math.floor(Date.now()/1000) + SESSION_TTL;
  await env.DB.prepare("INSERT INTO sessions(id_hash,user_id,csrf_hash,expires_at) VALUES(?,?,?,?)").bind(await sha256(sid), user.id, await sha256(csrf), expires).run();
  await env.DB.prepare("INSERT INTO audit_log(user_id,action,target_id) VALUES(?,?,?)").bind(user.id, "login", user.id).run();
  return json({ ok: true, user: { username: user.username, role: user.role, permissions: JSON.parse(user.permissions || "{}") }, csrfToken: csrf }, 200, {
    "Set-Cookie": `${SESSION_COOKIE}=${sid}; Max-Age=${SESSION_TTL}; Path=/; Secure; HttpOnly; SameSite=Strict`,
  });
}

export async function logout(request, env) {
  const sid = parseCookies(request)[SESSION_COOKIE];
  if (sid) {
    const hash = await sha256(sid);
    const session = await env.DB.prepare("SELECT user_id FROM sessions WHERE id_hash=?").bind(hash).first();
    if (session) await env.DB.prepare("INSERT INTO audit_log(user_id,action,target_id) VALUES(?,?,?)").bind(session.user_id, "logout", session.user_id).run();
    await env.DB.prepare("DELETE FROM sessions WHERE id_hash=?").bind(hash).run();
  }
  return json({ ok: true }, 200, { "Set-Cookie": `${SESSION_COOKIE}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Strict` });
}

export async function me(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ authenticated: false }, 401);
  const csrf = b64url(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.prepare("UPDATE sessions SET csrf_hash=? WHERE id_hash=?").bind(await sha256(csrf), session.id_hash).run();
  return json({ authenticated: true, user: { username: session.username, role: session.role, permissions: session.permissions }, csrfToken: csrf });
}

export { json, sha256 };
