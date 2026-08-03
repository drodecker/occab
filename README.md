# OCcab

Marketing site and investor prospectus for OCcab — a 10-vehicle Tesla robotaxi
fleet serving Orange County, California.

## Structure

- `public/index.html` — home page: the service and the opportunity (qualitative)
- `public/investors.html` — Fleet I financial prospectus: capital requirements,
  operating costs, payback timeline, scenario analysis, interactive ROI
  calculator, and the investor-interest form. All figures are computed
  client-side from a single assumptions object (`M` in the page script), so
  changing an assumption updates every chart, table, and stat consistently.
- `public/404.html` — not-found page
- `src/worker.js` — Cloudflare Worker: serves the static assets and handles
  `POST /api/investors`, forwarding submissions to a NocoDB table

## Investor form → NocoDB

Submissions from the form on `/investors.html#contact` post to
`/api/investors`; the Worker writes them to your NocoDB investors table (the
API token never reaches the browser).

Setup:

1. In `wrangler.jsonc`, set:
   - `NOCODB_URL` — your NocoDB base URL (e.g. `https://app.nocodb.com`)
   - `NOCODB_TABLE_ID` — the investors table ID (from the table's API docs)
2. Store the API token as a secret:
   ```sh
   npx wrangler secret put NOCODB_API_TOKEN
   ```
3. The table should have these columns (rename in `src/worker.js` if yours
   differ): `Name`, `Email`, `Company`, `Investment Range`, `Message`,
   `Source`, `Submitted At`.

Until all three values are configured the endpoint returns 503 and the form
shows a friendly error.

## Develop & deploy

No build step. Preview locally:

```sh
npx wrangler dev
```

Deploy:

```sh
npx wrangler deploy
```

## Updating the financial model

Edit the `M` object at the top of the `<script>` block in
`public/investors.html`. Vehicle price, insurance, energy rates, cleaning,
parking, staffing, and revenue assumptions are all parameters there; the
charts, tables, hero figures, and calculator all re-derive from it.
