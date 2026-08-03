// OCcab site worker: serves static assets and accepts investor-interest
// submissions at POST /api/investors, forwarding them to a NocoDB table.
//
// Configuration (see README):
//   vars    NOCODB_URL       e.g. https://app.nocodb.com or a self-hosted URL
//           NOCODB_TABLE_ID  the investors table id (starts with "m...")
//   secret  NOCODB_API_TOKEN wrangler secret put NOCODB_API_TOKEN

const MAX_LEN = { name: 200, email: 320, company: 200, range: 100, message: 4000 };

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function clean(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

async function handleInvestorSubmission(request, env) {
  if (!env.NOCODB_URL || !env.NOCODB_TABLE_ID || !env.NOCODB_API_TOKEN) {
    return json(503, { ok: false, error: 'Contact form is not configured yet.' });
  }

  let data;
  try {
    const type = request.headers.get('content-type') || '';
    if (type.includes('application/json')) {
      data = await request.json();
    } else {
      data = Object.fromEntries((await request.formData()).entries());
    }
  } catch {
    return json(400, { ok: false, error: 'Malformed request body.' });
  }

  // Honeypot: real users never fill this field.
  if (clean(data.website, 100)) return json(200, { ok: true });

  const name = clean(data.name, MAX_LEN.name);
  const email = clean(data.email, MAX_LEN.email);
  const company = clean(data.company, MAX_LEN.company);
  const range = clean(data.range, MAX_LEN.range);
  const message = clean(data.message, MAX_LEN.message);

  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { ok: false, error: 'Please provide your name and a valid email.' });
  }

  const record = {
    Name: name,
    Email: email,
    Company: company,
    'Investment Range': range,
    Message: message,
    Source: 'occab.com',
    'Submitted At': new Date().toISOString(),
  };

  const res = await fetch(
    `${env.NOCODB_URL.replace(/\/$/, '')}/api/v2/tables/${env.NOCODB_TABLE_ID}/records`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'xc-token': env.NOCODB_API_TOKEN },
      body: JSON.stringify(record),
    },
  );

  if (!res.ok) {
    console.error('NocoDB rejected submission', res.status, await res.text());
    return json(502, { ok: false, error: 'Could not save your submission — please try again.' });
  }
  return json(200, { ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/investors') {
      if (request.method !== 'POST') return json(405, { ok: false, error: 'POST only.' });
      return handleInvestorSubmission(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
