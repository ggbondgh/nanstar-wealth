const corsHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8"
};

export async function onRequestGet(context) {
  const auth = requireAccess(context);
  if (auth) return auth;
  const database = context.env.NANSTAR_WEALTH_DB;
  if (!database) return json({ error: "D1 binding NANSTAR_WEALTH_DB is missing" }, 503);

  const userId = getUserId(context);
  const row = await database
    .prepare("SELECT data, updated_at FROM wealth_state WHERE user_id = ?")
    .bind(userId)
    .first();

  return json({
    state: row?.data ? JSON.parse(row.data) : null,
    updatedAt: row?.updated_at || null
  });
}

export async function onRequestPut(context) {
  const auth = requireAccess(context);
  if (auth) return auth;
  const database = context.env.NANSTAR_WEALTH_DB;
  if (!database) return json({ error: "D1 binding NANSTAR_WEALTH_DB is missing" }, 503);

  const body = await context.request.json().catch(() => null);
  if (!body || typeof body.state !== "object" || Array.isArray(body.state)) {
    return json({ error: "Invalid state payload" }, 400);
  }

  const userId = getUserId(context);
  const now = new Date().toISOString();
  await database
    .prepare(`
      INSERT INTO wealth_state (user_id, data, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `)
    .bind(userId, JSON.stringify(body.state), now)
    .run();

  return json({ ok: true, updatedAt: now });
}

function requireAccess(context) {
  const expectedToken = context.env.NANSTAR_SYNC_TOKEN;
  const providedToken = context.request.headers.get("x-nanstar-sync-token");
  if (expectedToken && providedToken === expectedToken) return null;

  const accessEmail = context.request.headers.get("cf-access-authenticated-user-email");
  if (accessEmail) return null;

  return json({ error: "Cloud sync requires Cloudflare Access or NANSTAR_SYNC_TOKEN" }, 401);
}

function getUserId(context) {
  return context.request.headers.get("cf-access-authenticated-user-email")
    || context.env.NANSTAR_USER_ID
    || "default";
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders
  });
}
