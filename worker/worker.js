import { handleNocodbHook } from "./slack-hook.js";

/**
 * OC Cab — form proxy Worker
 * Receives {table, data} JSON from the site, validates, and inserts into NocoDB.
 * Keeps your NocoDB xc-token server-side. Optional Cloudflare Turnstile check.
 *
 * Secrets / vars to set (wrangler secret put ... or dashboard):
 *   NOCODB_URL        e.g. https://nocodb.yourdomain.com
 *   NOCODB_TOKEN      your xc-token (API token from NocoDB)
 *   TABLE_INVESTORS   NocoDB table ID (e.g. m1a2b3c4d5)  — from table settings / API docs
 *   TABLE_PROPERTY    NocoDB table ID for property_partners
 *   TABLE_CAREERS     NocoDB table ID for careers
 *   TURNSTILE_SECRET  (optional) Turnstile secret key; omit to skip bot check
 *   ALLOWED_ORIGIN    e.g. https://oc.cab
 */

const TABLE_MAP = (env) => ({
  investors: env.TABLE_INVESTORS,
  property_partners: env.TABLE_PROPERTY,
  careers: env.TABLE_CAREERS,
});

// Whitelist of fields per table — anything else is dropped.
const FIELDS = {
  investors: ["type","name","email","phone","entity","social","interest_range","source","notes","accredited"],
  property_partners: ["name","email","phone","markets","capacity","existing_charging","notes"],
  careers: ["role","name","email","phone","linkedin","other_profile","resume_url","notes"],
};

function cors(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request, env) {
    const headers = cors(env);

    if (request.method === "OPTIONS") return new Response(null, { headers });

    if (request.method === "POST" && new URL(request.url).pathname === "/nocodb-hook")
      return handleNocodbHook(request, env);
    if (request.method !== "POST" || new URL(request.url).pathname !== "/submit")
      return new Response("Not found", { status: 404, headers });

    let body;
    try { body = await request.json(); }
    catch { return new Response("Bad JSON", { status: 400, headers }); }

    const { table, data, turnstileToken } = body || {};
    const tableId = TABLE_MAP(env)[table];
    if (!tableId || !data) return new Response("Unknown table", { status: 400, headers });

    // Basic validation
    if (!data.name || !data.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email))
      return new Response("Name and valid email required", { status: 422, headers });

    // Optional Turnstile verification
    if (env.TURNSTILE_SECRET) {
      const v = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: env.TURNSTILE_SECRET,
          response: turnstileToken || "",
          remoteip: request.headers.get("CF-Connecting-IP") || "",
        }),
      }).then(r => r.json());
      if (!v.success) return new Response("Bot check failed", { status: 403, headers });
    }

    // Sanitize to whitelist + add metadata
    const clean = {};
    for (const f of FIELDS[table]) if (data[f] !== undefined) clean[f] = String(data[f]).slice(0, 4000);
    clean.submitted_at = new Date().toISOString();
    clean.ip = request.headers.get("CF-Connecting-IP") || "";
    clean.user_agent = (request.headers.get("User-Agent") || "").slice(0, 300);

    // Insert into NocoDB (v2 API)
    const res = await fetch(`${env.NOCODB_URL}/api/v2/tables/${tableId}/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "xc-token": env.NOCODB_TOKEN },
      body: JSON.stringify(clean),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("NocoDB error", res.status, txt);
      return new Response("Storage error", { status: 502, headers });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  },
};
