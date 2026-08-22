let bootstrapPromise = null;

async function run(env, sql) {
  await env.DB.prepare(sql).run();
}

async function bootstrap(env) {
  if (!env?.DB) throw new Error("D1 binding DB is missing");

  await run(env, `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('designer','supervisor')),
      permissions TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(env, `
    CREATE TABLE IF NOT EXISTS sessions (
      id_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      csrf_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(env, `
    CREATE INDEX IF NOT EXISTS idx_sessions_expires
    ON sessions(expires_at)
  `);

  await run(env, `
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      tracking_token_hash TEXT
    )
  `);

  const columns = await env.DB.prepare("PRAGMA table_info(orders)").all();
  const hasTrackingColumn = (columns.results || [])
    .some((row) => row.name === "tracking_token_hash");

  if (!hasTrackingColumn) {
    try {
      await run(env, `
        ALTER TABLE orders
        ADD COLUMN tracking_token_hash TEXT
      `);
    } catch (error) {
      const message = String(error?.message || "").toLowerCase();
      if (!message.includes("duplicate column")) throw error;
    }
  }

  await run(env, `
    CREATE INDEX IF NOT EXISTS idx_orders_created
    ON orders(created_at DESC)
  `);

  await run(env, `
    CREATE INDEX IF NOT EXISTS idx_orders_deleted
    ON orders(deleted_at)
  `);

  await run(env, `
    CREATE INDEX IF NOT EXISTS idx_orders_tracking
    ON orders(tracking_token_hash)
  `);

  await run(env, `
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      action TEXT NOT NULL,
      target_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(env, `
    CREATE INDEX IF NOT EXISTS idx_audit_log_target
    ON audit_log(target_id)
  `);

  await run(env, `
    CREATE INDEX IF NOT EXISTS idx_audit_log_created
    ON audit_log(created_at DESC)
  `);
}

export async function ensureSecuritySchema(env) {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrap(env).catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  return bootstrapPromise;
}
