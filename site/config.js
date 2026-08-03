// OC Cab site config — safe to expose (public values only).
// NEVER put your NocoDB xc-token here; that lives in the Cloudflare Worker secret.
const OCCAB_CONFIG = {
  // Mapbox public token (pk.*) — create at https://account.mapbox.com/access-tokens/
  // Restrict it to your domain (oc.cab) in the token settings.
  mapboxToken: "pk.eyJ1IjoiZHJvZGVja2VyIiwiYSI6ImNtc2IwdWhrODE2NHYyd29kOWJlOGRyNDAifQ.WbkOzCrrYYGq9afmZ9kW4Q",

  // Your deployed Cloudflare Worker base URL (no trailing slash), e.g. https://forms.oc.cab
  workerUrl: "https://occab-forms.dave-73f.workers.dev"
};
