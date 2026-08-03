# OC Cab — Site + Forms + NocoDB Setup

Stack: **Cloudflare Pages** (static site) → **Cloudflare Worker** (form proxy) → **your NocoDB** (data) → webhooks to Slack/email.

```
site/    → deploy to Cloudflare Pages (index.html + config.js)
worker/  → deploy with wrangler (worker.js + wrangler.toml)
```

---

## 1. NocoDB — create the base and tables

Create a base called **OC.CAB Leads** with these tables (field name → type):

### investors
| field | type |
|---|---|
| type | SingleSelect (Individual, Corporate / Fund) |
| name | SingleLineText |
| email | Email |
| phone | PhoneNumber |
| entity | SingleLineText |
| social | SingleLineText |
| interest_range | SingleSelect ($25k–$100k, $100k–$250k, $250k–$500k, $500k+) |
| source | SingleLineText |
| notes | LongText |
| accredited | SingleLineText (stores "on" from the checkbox) |
| status | SingleSelect (New, Contacted, Pitched, Soft-commit, Committed, Passed) — default New |
| submitted_at | DateTime |
| ip | SingleLineText |
| user_agent | SingleLineText |

### property_partners
name, email, phone, markets (LongText), capacity, existing_charging (SingleSelect: No / Yes — Level 2 / Yes — DC fast / Yes — other), notes, status (New/Reviewing/Site-visit/Signed/Passed), submitted_at, ip, user_agent

### careers
role (SingleSelect: CEO/CFO/CTO/COO/CMO/Other), name, email, phone, linkedin, other_profile, resume_url, notes, status (New/Screening/Interview/Offer/Passed), submitted_at, ip, user_agent

### Also recommended (settings & ops, not form-fed)
- **markets**: name, state, status (Planned/Active/Live-elsewhere), priority, notes
- **coverage_areas**: market (Link to markets), geojson (LongText), notes — later the site can fetch these and render map layers dynamically instead of hardcoding
- **settings**: key, value — e.g. `price_per_mile=1.00`, `fleet_size=12`, `funding_close=late 2026`

### Get table IDs
Open each table → click the table menu → **API Snippet / Details**, or check the URL: the `m…` ID is the table ID for `/api/v2/tables/{tableId}/records`. Note the three IDs.

### Create an API token
NocoDB → account icon → **Tokens** → create. This is your `NOCODB_TOKEN` (xc-token). It never goes in the site — Worker only.

### Webhooks → Slack (via your SlackLeadRelay)
On each table: **Details → Webhooks → After Insert** → POST to your relay endpoint. Payload includes the row; format it into `#leads` (or a new `#occab-leads`) channel. You can also add a second webhook to an email service if you want redundancy.

---

## 2. Cloudflare Worker (form proxy)

```bash
cd worker
npm i -g wrangler          # if needed
wrangler login
# fill in the three TABLE_* IDs in wrangler.toml [vars]
wrangler secret put NOCODB_URL      # e.g. https://nocodb.yourdomain.com
wrangler secret put NOCODB_TOKEN    # the xc-token
wrangler secret put TURNSTILE_SECRET  # optional — skip to disable bot check
wrangler deploy
```

Copy the deployed URL (e.g. `https://occab-forms.yourname.workers.dev`) into `site/config.js` → `workerUrl`. Later, add a custom route like `forms.oc.cab`.

**Turnstile (optional but recommended):** create a Turnstile widget in the Cloudflare dashboard for oc.cab, add the client script + widget to the forms, and pass its token as `turnstileToken` in the fetch body. The Worker already verifies it if `TURNSTILE_SECRET` is set.

---

## 3. Cloudflare Pages (site)

1. Push `site/` to a Git repo (or drag-drop deploy in the dashboard: Pages → Create → Upload assets).
2. Set custom domain **oc.cab** (you already control the domain; Pages handles cert).
3. Edit `config.js`:
   - `mapboxToken`: create a **public token (pk.)** at account.mapbox.com, restrict allowed URLs to `https://oc.cab/*`.
   - `workerUrl`: from step 2.

No build step needed — it's plain HTML/CSS/JS. If you later want Vite + Tailwind proper, this file structure ports over cleanly.

---

## 4. Mapbox notes

- Style: `mapbox://styles/mapbox/dark-v11` (already set)
- Markers included: Newport Beach, Irvine, SNA, Anaheim (teal = current focus); Phoenix, Las Vegas (gold = expansion); Austin (cyan = live autonomous ops)
- Dashed teal line = OC → Vegas corridor concept, arced along the I-15 alignment
- To drive markers from NocoDB later: fetch `coverage_areas`/`markets` via a `GET` route on the Worker and build markers from the response

---

## 5. Legal checklist before the investor form goes live

- [ ] Counsel reviews the disclaimer + accredited self-cert flow (Reg D 506(b) vs 506(c) decision — 506(c) allows general solicitation but requires *verification* of accreditation, not just self-cert)
- [ ] Confirm the "not affiliated with Tesla" language stays prominent (it's in the footer + legal box)
- [ ] Keep pro-forma labeled "illustrative" everywhere (done in the financial section)
- [ ] NDA template ready for the detailed P&L / ROI package

## 6. Launch order

1. NocoDB tables + token + webhooks (15 min)
2. Deploy Worker with secrets (10 min)
3. Generate logo/hero images (prompts from your Grok doc), drop into the hero if you want imagery over the grid background
4. Deploy Pages + custom domain
5. Test all three forms end-to-end → confirm rows land in NocoDB + Slack ping fires
6. Counsel sign-off → share the link
