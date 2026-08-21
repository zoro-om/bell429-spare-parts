const SESSION_COOKIE = "__Host-b429_session";
const OLD_SESSION_COOKIE = "b429_session";

const SESSION_TTL = 60 * 60 * 8;
const LOGIN_WINDOW = 10 * 60;
const LOGIN_MAX_FAILURES = 8;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function parseCookies(request) {
  const out = {};
  const raw = request.headers.get("Cookie") || "";

  for (const part of raw.split(";")) {
    const i = part.indexOf("=");

    if (i <= 0) continue;

    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();

    out[key] = value;
  }

  return out;
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

function fromB64url(value) {
  const s = String(value || "");
  const pad = s.length % 4
    ? "=".repeat(4 - (s.length % 4))
    : "";

  const bin = atob(
    s.replace(/-/g, "+").replace(/_/g, "/") + pad
  );

  return Uint8Array.from(
    bin,
    (c) => c.charCodeAt(0)
  );
}

async function sha256(text) {
  const data = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(String(text))
  );

  return b64url(new Uint8Array(data));
}

async function pbkdf2(
  password,
  salt,
  iterations,
  length = 32
) {
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
      hash: "SHA-256",
    },
    key,
    length * 8
  );

  return new Uint8Array(bits);
}

async function verifyPassword(password, record) {
  const parts = String(record || "").split("$");

  if (
    parts.length !== 4 ||
    parts[0] !== "pbkdf2"
  ) {
    return false;
  }

  const iterations = Number(parts[1]);

  if (
    !Number.isInteger(iterations) ||
    iterations < 210000 ||
    iterations > 1000000
  ) {
    return false;
  }

  try {
    const expected = fromB64url(parts[3]);

    const actual = await pbkdf2(
      password,
      fromB64url(parts[2]),
      iterations,
      expected.length
    );

    if (actual.length !== expected.length) {
      return false;
    }

    let diff = 0;

    for (let i = 0; i < actual.length; i++) {
      diff |= actual[i] ^ expected[i];
    }

    return diff === 0;
  } catch {
    return false;
  }
}

/*
 * CSRF token is derived from the random session ID.
 *
 * The session cookie is HttpOnly, so JavaScript cannot
 * derive this value from the cookie.
 *
 * This also prevents /me from invalidating the token
 * every time the frontend checks the session.
 */
async function deriveCsrfToken(sessionId) {
  return sha256(`${sessionId}:csrf:v1`);
}

async function getClientAddress(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Real-IP") ||
    "unknown"
  );
}

async function loginRateKey(request, username) {
  const ip = await getClientAddress(request);

  return sha256(
    `${String(username).toLowerCase()}|${ip}`
  );
}

async function tooManyLoginFailures(
  env,
  rateKey,
  now
) {
  const since = now - LOGIN_WINDOW;

  const row = await env.DB
    .prepare(
      `
      SELECT COUNT(*) AS count
      FROM audit_log
      WHERE action = ?
        AND target_id = ?
        AND created_at >= datetime(?, 'unixepoch')
      `
    )
    .bind(
      "login_failed",
      rateKey,
      since
    )
    .first();

  return Number(row?.count || 0) >= LOGIN_MAX_FAILURES;
}

async function recordFailedLogin(
  env,
  rateKey
) {
  await env.DB
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
      "login_failed",
      rateKey
    )
    .run();
}

function sessionCookie(value, maxAge) {
  return [
    `${SESSION_COOKIE}=${value}`,
    `Max-Age=${maxAge}`,
    "Path=/",
    "Secure",
    "HttpOnly",
    "SameSite=Strict",
  ].join("; ");
}

function expiredSessionCookie(name) {
  return [
    `${name}=`,
    "Max-Age=0",
    "Path=/",
    "Secure",
    "HttpOnly",
    "SameSite=Strict",
  ].join("; ");
}

export async function getSession(request, env) {
  const cookies = parseCookies(request);

  const sid =
    cookies[SESSION_COOKIE] ||
    cookies[OLD_SESSION_COOKIE];

  if (!sid) {
    return null;
  }

  const now = Math.floor(
    Date.now() / 1000
  );

  const row = await env.DB
    .prepare(
      `
      SELECT
        s.id_hash,
        s.user_id,
        s.csrf_hash,
        s.expires_at,
        u.username,
        u.role,
        u.permissions,
        u.enabled
      FROM sessions s
      JOIN users u
        ON u.id = s.user_id
      WHERE
        s.id_hash = ?
        AND s.expires_at > ?
        AND u.enabled = 1
      `
    )
    .bind(
      await sha256(sid),
      now
    )
    .first();

  if (!row) {
    return null;
  }

  let permissions = {};

  try {
    permissions = JSON.parse(
      row.permissions || "{}"
    );
  } catch {
    permissions = {};
  }

  return {
    ...row,
    permissions,
    sessionId: sid,
  };
}

export async function requireSession(
  request,
  env,
  csrf = false
) {
  const session = await getSession(
    request,
    env
  );

  if (!session) {
    return {
      response: json(
        {
          error:
            "Authentication required",
        },
        401
      ),
      session: null,
    };
  }

  if (csrf) {
    const token =
      request.headers.get(
        "X-CSRF-Token"
      ) || "";

    if (!token) {
      return {
        response: json(
          {
            error:
              "CSRF validation failed",
          },
          403
        ),
        session: null,
      };
    }

    const suppliedHash =
      await sha256(token);

    if (
      suppliedHash !==
      session.csrf_hash
    ) {
      return {
        response: json(
          {
            error:
              "CSRF validation failed",
          },
          403
        ),
        session: null,
      };
    }
  }

  return {
    response: null,
    session,
  };
}

export function hasPermission(
  session,
  permission
) {
  if (!session) {
    return false;
  }

  /*
   * The initial "designer" account is the
   * application administrator.
   */
  if (session.role === "designer") {
    return true;
  }

  return (
    session.permissions?.[permission] === true
  );
}

export async function login(
  request,
  env
) {
  let body;

  try {
    body = await request.json();
  } catch {
    return json(
      {
        error:
          "Invalid credentials",
      },
      401
    );
  }

  const username = String(
    body?.username || ""
  )
    .trim()
    .slice(0, 80);

  const password = String(
    body?.password || ""
  );

  if (
    !username ||
    !password ||
    password.length > 256
  ) {
    return json(
      {
        error:
          "Invalid credentials",
      },
      401
    );
  }

  const now = Math.floor(
    Date.now() / 1000
  );

  const rateKey =
    await loginRateKey(
      request,
      username
    );

  if (
    await tooManyLoginFailures(
      env,
      rateKey,
      now
    )
  ) {
    return json(
      {
        error:
          "Too many login attempts. Try again later.",
      },
      429,
      {
        "Retry-After": String(
          LOGIN_WINDOW
        ),
      }
    );
  }

  const user = await env.DB
    .prepare(
      `
      SELECT
        id,
        username,
        password_hash,
        role,
        permissions,
        enabled
      FROM users
      WHERE username = ?
      `
    )
    .bind(username)
    .first();

  const valid =
    !!user &&
    Number(user.enabled) === 1 &&
    await verifyPassword(
      password,
      user.password_hash
    );

  if (!valid) {
    await recordFailedLogin(
      env,
      rateKey
    );

    return json(
      {
        error:
          "Invalid credentials",
      },
      401
    );
  }

  /*
   * Remove expired sessions.
   */
  await env.DB
    .prepare(
      "DELETE FROM sessions WHERE expires_at <= ?"
    )
    .bind(now)
    .run();

  /*
   * Fresh unpredictable session ID.
   */
  const sid = b64url(
    crypto.getRandomValues(
      new Uint8Array(32)
    )
  );

  /*
   * Stable CSRF token derived from the
   * random HttpOnly session ID.
   */
  const csrfToken =
    await deriveCsrfToken(sid);

  const expires =
    now + SESSION_TTL;

  await env.DB
    .prepare(
      `
      INSERT INTO sessions(
        id_hash,
        user_id,
        csrf_hash,
        expires_at
      )
      VALUES(?,?,?,?)
      `
    )
    .bind(
      await sha256(sid),
      user.id,
      await sha256(csrfToken),
      expires
    )
    .run();

  await env.DB
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
      user.id,
      "login",
      user.id
    )
    .run();

  let permissions = {};

  try {
    permissions = JSON.parse(
      user.permissions || "{}"
    );
  } catch {
    permissions = {};
  }

  return json(
    {
      ok: true,
      user: {
        username: user.username,
        role: user.role,
        permissions,
      },
      csrfToken,
    },
    200,
    {
      "Set-Cookie":
        sessionCookie(
          sid,
          SESSION_TTL
        ),
    }
  );
}

export async function logout(
  request,
  env
) {
  const cookies =
    parseCookies(request);

  const sid =
    cookies[SESSION_COOKIE] ||
    cookies[OLD_SESSION_COOKIE];

  if (sid) {
    const hash =
      await sha256(sid);

    const session =
      await env.DB
        .prepare(
          "SELECT user_id FROM sessions WHERE id_hash=?"
        )
        .bind(hash)
        .first();

    if (session) {
      await env.DB
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
          session.user_id,
          "logout",
          session.user_id
        )
        .run();
    }

    await env.DB
      .prepare(
        "DELETE FROM sessions WHERE id_hash=?"
      )
      .bind(hash)
      .run();
  }

  return json(
    { ok: true },
    200,
    {
      "Set-Cookie": [
        expiredSessionCookie(
          SESSION_COOKIE
        ),
        expiredSessionCookie(
          OLD_SESSION_COOKIE
        ),
      ].join(", "),
    }
  );
}

export async function me(
  request,
  env
) {
  const session =
    await getSession(
      request,
      env
    );

  if (!session) {
    return json(
      {
        authenticated: false,
      },
      401
    );
  }

  /*
   * Generate the same CSRF token every time.
   *
   * Existing sessions created by the old
   * implementation are migrated automatically
   * on their first /me request.
   */
  const csrfToken =
    await deriveCsrfToken(
      session.sessionId
    );

  const csrfHash =
    await sha256(csrfToken);

  if (
    csrfHash !==
    session.csrf_hash
  ) {
    await env.DB
      .prepare(
        `
        UPDATE sessions
        SET csrf_hash = ?
        WHERE id_hash = ?
        `
      )
      .bind(
        csrfHash,
        session.id_hash
      )
      .run();
  }

  return json({
    authenticated: true,
    user: {
      username: session.username,
      role: session.role,
      permissions:
        session.permissions,
    },
    csrfToken,
  });
}

export { json, sha256 };