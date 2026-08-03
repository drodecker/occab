/**
 * OC Cab — NocoDB webhook → Slack formatter
 * Add-on route for the forms Worker (or deploy standalone).
 *
 * NocoDB setup: each table → Details → Webhooks → "After Insert"
 *   URL: https://<worker>/nocodb-hook?src=investors   (or property_partners / careers)
 *   Method: POST, no auth needed beyond the shared secret below.
 *
 * Extra secrets:
 *   SLACK_WEBHOOK_URL   Slack incoming webhook (or your SlackLeadRelay ingest URL)
 *   HOOK_SECRET         random string; append &key=<secret> to the webhook URL in NocoDB
 */

const EMOJI = { investors: "💰", property_partners: "🏢", careers: "👔" };
const TITLE = { investors: "New investor lead", property_partners: "New property partner", careers: "New career application" };

function rowFields(src, row) {
  const f = (label, value) => value ? { type: "mrkdwn", text: `*${label}:*\n${value}` } : null;
  const common = [f("Name", row.name), f("Email", row.email), f("Phone", row.phone)];
  const per = {
    investors: [
      f("Type", row.type), f("Entity", row.entity),
      f("Interest range", row.interest_range), f("Accredited (self-cert)", row.accredited ? "✅ yes" : "❌ no"),
      f("Source", row.source), f("Social", row.social),
    ],
    property_partners: [
      f("Markets", row.markets), f("Capacity", row.capacity),
      f("Existing charging", row.existing_charging),
    ],
    careers: [
      f("Role", row.role), f("LinkedIn", row.linkedin),
      f("Other profile", row.other_profile), f("Resume", row.resume_url),
    ],
  };
  return [...common, ...(per[src] || [])].filter(Boolean).slice(0, 10); // Slack caps fields at 10
}

export async function handleNocodbHook(request, env) {
  const url = new URL(request.url);
  if (env.HOOK_SECRET && url.searchParams.get("key") !== env.HOOK_SECRET)
    return new Response("Forbidden", { status: 403 });

  const src = url.searchParams.get("src") || "investors";
  let payload;
  try { payload = await request.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  // NocoDB v2 webhook payload: { type, data: { table_name, rows: [ {...} ] } }
  const rows = payload?.data?.rows || [payload?.data?.row || payload?.data || payload];

  for (const row of rows) {
    const blocks = [
      { type: "header", text: { type: "plain_text", text: `${EMOJI[src] || "📥"} ${TITLE[src] || "New lead"} — OC Cab` } },
      { type: "section", fields: rowFields(src, row) },
    ];
    if (row.notes) blocks.push({ type: "section", text: { type: "mrkdwn", text: `*Notes:*\n>${String(row.notes).slice(0, 2500)}` } });
    blocks.push({ type: "context", elements: [{ type: "mrkdwn",
      text: `Submitted ${row.submitted_at || "now"} · IP ${row.ip || "n/a"} · via oc.cab` }] });

    const res = await fetch(env.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks, text: `${TITLE[src]}: ${row.name || "unknown"} <${row.email || ""}>` }),
    });
    if (!res.ok) console.error("Slack post failed", res.status, await res.text());
  }
  return new Response("ok");
}

/* ── Integration into worker.js ─────────────────────────────────
In worker/worker.js, import and add one line to the router:

  import { handleNocodbHook } from "./slack-hook.js";

  // inside fetch(), before the /submit check:
  if (request.method === "POST" && new URL(request.url).pathname === "/nocodb-hook")
    return handleNocodbHook(request, env);

Then:
  wrangler secret put SLACK_WEBHOOK_URL
  wrangler secret put HOOK_SECRET
──────────────────────────────────────────────────────────────── */
