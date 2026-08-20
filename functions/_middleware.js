const BLOCKED_PATHS = [
  /^\/\.git(?:\/|$)/i,
  /\.map$/i,
  /^\/parts_index\.json$/i,
  /^\/bell429_ipb(?:\/|$)/i,
  /\.pdf$/i,
];

function makeNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

const BASE_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (BLOCKED_PATHS.some((re) => re.test(url.pathname))) {
    return new Response("Not found", {
      status: 404,
      headers: BASE_SECURITY_HEADERS,
    });
  }

  const response = await context.next();
  const headers = new Headers(response.headers);

  for (const [k, v] of Object.entries(BASE_SECURITY_HEADERS)) {
    headers.set(k, v);
  }

  const contentType = headers.get("content-type") || "";

  if (contentType.includes("text/html")) {
    const nonce = makeNonce();

    headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "img-src 'self' data:",
        "style-src 'self' 'unsafe-inline'",
        `script-src 'self' 'nonce-${nonce}'`,
        "script-src-attr 'none'",
        "connect-src 'self'",
        "font-src 'self' data:"
      ].join("; ")
    );

    const rewritten = new HTMLRewriter()
      .on("script", {
        element(el) {
          // لا نحذف السكربتات الأصلية.
          // نعطي السكربتات inline nonce حتى يسمح بها CSP.
          el.setAttribute("nonce", nonce);
        },
      })
      .on("body", {
        element(el) {
          el.append(
            `<script src="/secure-app.js" defer nonce="${nonce}"></script>`,
            { html: true }
          );
        },
      })
      .transform(
        new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        })
      );

    return rewritten;
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
