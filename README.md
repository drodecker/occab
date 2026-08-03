# OCcab

Marketing site and investor prospectus for OCcab — a 10-vehicle Tesla robotaxi
fleet serving Orange County, California.

## Pages

- `public/index.html` — landing page
- `public/investors.html` — Fleet I financial prospectus: capital requirements,
  operating costs, payback timeline, scenario analysis, and an interactive
  ROI calculator. All figures are computed client-side from a single
  assumptions object (`M` in the page script), so changing an assumption
  updates every chart, table, and stat on the page consistently.

## Develop & deploy

Static site, no build step. Preview locally:

```sh
npx wrangler dev
```

Deploy to Cloudflare Workers (static assets):

```sh
npx wrangler deploy
```

## Updating the financial model

Edit the `M` object at the top of the `<script>` block in
`public/investors.html`. Vehicle price, insurance, energy rates, cleaning,
parking, staffing, and revenue assumptions are all parameters there; the
charts, tables, hero figures, and calculator all re-derive from it.
