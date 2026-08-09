const FORM_WORKER_URL = "https://occab-forms.dave-73f.workers.dev/submit";

export async function onRequestPost({ request }) {
  const response = await fetch(FORM_WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("Content-Type") || "application/json",
      Origin: "https://oc.cab",
    },
    body: await request.text(),
  });

  return new Response(await response.text(), {
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
