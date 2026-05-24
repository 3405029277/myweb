export default {
  async fetch(request) {
    const url = new URL(request.url);
    const originUrl = new URL(url.pathname + url.search, "http://93.115.101.176:12811");

    const headers = new Headers();
    headers.set("Host", "93.115.101.176:12811");
    headers.set("X-Real-IP", request.headers.get("CF-Connecting-IP") || "");
    headers.set("X-Forwarded-For", request.headers.get("CF-Connecting-IP") || "");
    headers.set("X-Forwarded-Proto", "https");
    headers.set("X-Forwarded-Host", request.headers.get("Host") || "");
    for (const [key, value] of request.headers.entries()) {
      if (key.startsWith("cf-") || key === "host" || key === "x-forwarded-proto") continue;
      if (!headers.has(key)) headers.set(key, value);
    }

    const originRequest = new Request(originUrl, {
      method: request.method,
      headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
      redirect: "manual",
    });

    try {
      const response = await fetch(originRequest.toString(), {
        method: originRequest.method,
        headers: originRequest.headers,
        body: originRequest.body,
        redirect: "manual",
        cf: { resolveOverride: "93.115.101.176" },
      });
      // Fallback: if still 1003, try with plain fetch bypass
      if (response.status === 403) {
        const bodyText = await response.text();
        if (bodyText.includes("1003")) {
          return new Response("Origin returned 1003 via proxy. Trying direct...", { status: 502 });
        }
      }
      const responseHeaders = new Headers(response.headers);
      if (responseHeaders.get("Location")?.startsWith("http://93.115.101.176:12811")) {
        responseHeaders.set("Location",
          responseHeaders.get("Location").replace("http://93.115.101.176:12811", "https://www.cjx88.eu.cc")
        );
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response("Origin unreachable: " + err.message, { status: 502 });
    }
  }
};
