function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) {
    return cookies;
  }
  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) {
      continue;
    }
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    cookies[key] = value;
  }
  return cookies;
}

function buildDebugCookie(name, value, maxAge) {
  return [
    `${name}=${value}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "Secure",
    "SameSite=None",
  ].join("; ");
}

function buildRedirectResponse(url, cookieName, cookieValue, maxAge) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      "Set-Cookie": buildDebugCookie(cookieName, cookieValue, maxAge),
      "Cache-Control": "private, no-store",
    },
  });
}

function isAssetPath(pathname) {
  return /\.(png|jpe?g|gif|svg|webp|ico|bmp|tiff|avif)$/i.test(pathname);
}

function isLocalDevRequest(url) {
  const host = url.hostname.toLowerCase();
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

function buildLocalDevBypassResponse(reason, details = {}) {
  return new Response(
    JSON.stringify(
      {
        ok: false,
        reason,
        ...details,
      },
      null,
      2,
    ),
    {
      status: 502,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

function getConfig(env) {
  const debugOrigin = env.DEBUG_ORIGIN;
  const debugIp = env.DEBUG_IP;

  // If the required secrets are not configured, return null so the worker
  // passes all traffic through without interfering.
  if (
    typeof debugOrigin !== "string" ||
    debugOrigin.trim() === "" ||
    typeof debugIp !== "string" ||
    debugIp.trim() === ""
  ) {
    return null;
  }

  const debugCookie =
    typeof env.DEBUG_COOKIE === "string" && env.DEBUG_COOKIE.trim() !== ""
      ? env.DEBUG_COOKIE.trim()
      : "cf_local_debug";

  const debugMaxAge =
    typeof env.DEBUG_MAX_AGE === "string" && env.DEBUG_MAX_AGE.trim() !== ""
      ? Number(env.DEBUG_MAX_AGE.trim())
      : 3600;

  if (!Number.isFinite(debugMaxAge) || debugMaxAge < 0) {
    return null;
  }

  const debugOriginTrimmed = debugOrigin.trim();
  let parsedDebugOrigin;
  try {
    parsedDebugOrigin = new URL(debugOriginTrimmed);
  } catch {
    console.debug(`DEBUG_ORIGIN is not a valid URL: "${debugOriginTrimmed}"`);
    return null;
  }

  const debugIpTrimmed = debugIp.trim();
  if (debugIpTrimmed === "0.0.0.0") {
    console.warn(
      "DEBUG_IP is set to 0.0.0.0 — all IPs will be allowed to proxy to your tunnel.",
    );
  }

  return {
    debugOrigin: debugOriginTrimmed,
    parsedDebugOrigin,
    debugIp: debugIpTrimmed,
    debugCookie,
    debugMaxAge,
  };
}

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);
    const localDev = isLocalDevRequest(requestUrl);

    const config = getConfig(env);

    const clientIp =
      request.headers.get("CF-Connecting-IP") ||
      request.headers.get("CF-Connecting-IPv6") ||
      "";

    const cookies = parseCookies(request.headers.get("Cookie"));

    console.debug("decision", {
      url: request.url,
      method: request.method,
      localDev,
      clientIp,
      hasCookieHeader: request.headers.has("Cookie"),
    });

    // Browsers will request /favicon.ico and similar assets automatically.
    // Under wrangler dev, fetch(request) to localhost would recurse back into
    // the same worker, so short-circuit assets locally.
    if (isAssetPath(requestUrl.pathname)) {
      if (localDev) {
        console.debug(`Local dev asset bypass for "${requestUrl.pathname}"`);
        return new Response(null, {
          status: 204,
          headers: {
            "Cache-Control": "no-store",
          },
        });
      }
      return fetch(request);
    }

    // If required secrets are not configured, pass all traffic through.
    // In local dev, don't self-fetch localhost or you'll recurse forever.
    if (!config) {
      if (localDev) {
        return buildLocalDevBypassResponse("missing-config-in-local-dev", {
          hint: "Set DEBUG_ORIGIN and DEBUG_IP (DEBUG_IP=0.0.0.0 is handy for local testing).",
        });
      }
      return fetch(request);
    }

    const hasDebugCookie = cookies[config.debugCookie] === "1";
    const enableRequested = requestUrl.searchParams.get("cf_local_debug") === "1";
    const disableRequested = requestUrl.searchParams.get("cf_local_debug") === "0";
    const ipMatches = config.debugIp === "0.0.0.0" || clientIp === config.debugIp;

    console.debug("routing-state", {
      pathname: requestUrl.pathname,
      enableRequested,
      disableRequested,
      hasDebugCookie,
      ipMatches,
      configuredDebugIp: config.debugIp,
      configuredDebugOrigin: config.parsedDebugOrigin.origin,
    });

    if (enableRequested && !ipMatches) {
      console.debug(
        `IP mismatch on enable: configured="${config.debugIp}" request="${clientIp}"`,
      );
    }

    if (enableRequested && ipMatches) {
      const cleanUrl = new URL(requestUrl);
      cleanUrl.searchParams.delete("cf_local_debug");
      return buildRedirectResponse(
        cleanUrl,
        config.debugCookie,
        "1",
        config.debugMaxAge,
      );
    }

    if (disableRequested) {
      const cleanUrl = new URL(requestUrl);
      cleanUrl.searchParams.delete("cf_local_debug");
      return buildRedirectResponse(cleanUrl, config.debugCookie, "0", 0);
    }

    if (hasDebugCookie && !ipMatches) {
      console.debug(
        `IP mismatch on tunnel: configured="${config.debugIp}" request="${clientIp}"`,
      );
    }

    // Normal pass-through when debug mode is not active.
    // Safe in production, but block it explicitly in local wrangler dev.
    if (!(hasDebugCookie && ipMatches)) {
      if (localDev) {
        return buildLocalDevBypassResponse("local-pass-through-blocked", {
          hint: "Enable debug mode with ?cf_local_debug=1 and use DEBUG_IP=0.0.0.0 for local testing.",
          pathname: requestUrl.pathname,
          hasDebugCookie,
          ipMatches,
          clientIp,
        });
      }
      return fetch(request);
    }

    const debugOrigin = config.parsedDebugOrigin;
    console.debug(
      `Proxying to debug origin: "${debugOrigin.origin}" for "${requestUrl.pathname}"`,
    );

    const targetUrl = new URL(requestUrl);
    targetUrl.protocol = debugOrigin.protocol;
    targetUrl.hostname = debugOrigin.hostname;
    targetUrl.port = debugOrigin.port;
    targetUrl.searchParams.delete("cf_local_debug");

    const headers = new Headers(request.headers);
    headers.delete("Host");
    headers.set("Host", debugOrigin.hostname);
    headers.set("x-debug-via", "cloudflare-worker");
    headers.set("x-original-host", requestUrl.hostname);
    headers.set("x-forwarded-proto", "https");
    if (clientIp) {
      headers.set("x-forwarded-for", clientIp);
    } else {
      headers.delete("x-forwarded-for");
    }

    console.debug("proxy-target", {
      from: request.url,
      to: targetUrl.toString(),
      hostHeader: debugOrigin.hostname,
    });

    const proxiedRequest = new Request(targetUrl.toString(), {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual",
    });

    const upstream = await fetch(proxiedRequest);
    const response = new Response(upstream.body, upstream);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  },
};
