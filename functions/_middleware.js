const BLOCKED_PATHS = [
  /^\/\.git(?:\/|$)/i,
  /\.map$/i,
  /^\/bell429_ipb(?:\/|$)/i,
  /\.pdf$/i,
  /^\/parts_index\.json$/i,
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

  // Block sensitive files and directories.
  if (BLOCKED_PATHS.some((re) => re.test(url.pathname))) {
    return new Response("Not found", {
      status: 404,
      headers: SECURITY_HEADERS,
    });
  }

  // Continue to the requested asset/function.
  const response = await context.next();

  const headers = new Headers(response.headers);

  // Apply security headers to every response.
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }

  const contentType = headers.get("content-type") || "";

  // Protect HTML responses and load the secure application layer.
  if (contentType.includes("text/html")) {
    const rewritten = new HTMLRewriter()
      .on("script", {
        element(el) {
          // Remove inline/existing scripts.
          // The application script is injected below.
          el.remove();
        },
      })
      .on("body", {
        element(el) {
          el.append(
            '<script src="/secure-app.js" defer></script>',
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