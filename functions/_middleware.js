const BLOCKED_PATHS = [
  /^\/\.git(?:\/|$)/i,
  /\.map$/i,
  /^\/parts_index\.json$/i,
  /^\/bell429_ipb(?:\/|$)/i,
  /\.pdf$/i,
];

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=()",
  "Strict-Transport-Security":
    "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy":
    "default-src 'self'; " +
    "base-uri 'self'; " +
    "object-src 'none'; " +
    "frame-ancestors 'none'; " +
    "form-action 'self'; " +
    "img-src 'self' data:; " +
    "style-src 'self' 'unsafe-inline'; " +
    "script-src 'self'; " +
    "script-src-attr 'none'; " +
    "connect-src 'self'; " +
    "font-src 'self' data:;",
};

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (BLOCKED_PATHS.some((re) => re.test(url.pathname))) {
    return new Response("Not found", {
      status: 404,
      headers: SECURITY_HEADERS,
    });
  }

  const response = await context.next();
  const headers = new Headers(response.headers);

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }

  const contentType = headers.get("content-type") || "";

  if (!contentType.includes("text/html")) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const html = await response.text();

  const scriptTag =
    '<script src="/secure-app.js" defer></script>';

  const finalHtml = html.includes("</body>")
    ? html.replace("</body>", `${scriptTag}</body>`)
    : `${html}${scriptTag}`;

  headers.set("content-type", "text/html; charset=UTF-8");

  return new Response(finalHtml, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}