const FORM_WORKER_URL = "https://occab-forms.dave-73f.workers.dev/submit";
const FALLBACK_TO = "investors@oc.cab";
const FALLBACK_FROM = "clawdyda@agentmail.to";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatLeadEmail(body) {
  const table = body.table || "unknown";
  const data = body.data || {};
  const submittedAt = new Date().toISOString();
  const lines = [
    "OC Cab lead capture fallback",
    "",
    `Table: ${table}`,
    `Submitted: ${submittedAt}`,
    "",
    ...Object.entries(data).map(([key, value]) => `${key}: ${value}`),
  ];

  return {
    subject: `OC Cab lead capture: ${data.name || table}`,
    text: lines.join("\n"),
    html: `<h2>OC Cab lead capture fallback</h2><p><b>Table:</b> ${escapeHtml(table)}</p><p><b>Submitted:</b> ${submittedAt}</p><pre>${Object.entries(data)
      .map(([key, value]) => `${escapeHtml(key)}: ${escapeHtml(value)}`)
      .join("\n")}</pre>`,
  };
}

async function sendFallbackEmail(env, body) {
  if (!env.AGENTMAIL_API_KEY) {
    return new Response("Storage error", { status: 502 });
  }

  const email = formatLeadEmail(body);
  const response = await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(FALLBACK_FROM)}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.AGENTMAIL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: FALLBACK_TO,
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });

  if (!response.ok) {
    console.error("AgentMail fallback failed", response.status, await response.text());
    return new Response("Storage error", { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true, fallback: "email" }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function onRequestPost({ request, env }) {
  const requestText = await request.text();
  const response = await fetch(FORM_WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("Content-Type") || "application/json",
      Origin: "https://oc.cab",
    },
    body: requestText,
  });

  const responseText = await response.text();
  if (response.status === 502 && /Storage error/i.test(responseText)) {
    try {
      return await sendFallbackEmail(env, JSON.parse(requestText));
    } catch (error) {
      console.error("Lead fallback failed", error);
      return new Response("Storage error", { status: 502 });
    }
  }

  return new Response(responseText, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "text/plain; charset=UTF-8",
      "Cache-Control": "no-store",
    },
  });
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "POST, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}
