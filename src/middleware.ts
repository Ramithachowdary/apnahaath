import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

const CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; font-src 'self' data:;";
const HSTS = "max-age=31536000; includeSubDomains";

/** Security headers on every page and API response. */
function withSecurityHeaders(request: NextRequest, response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Content-Security-Policy", CSP);
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", HSTS);
  }
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // The landing page is static; signed-in visitors skip it and go straight to their dashboard.
  if (pathname === "/" && request.cookies.get(SESSION_COOKIE)?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return withSecurityHeaders(request, NextResponse.redirect(url));
  }
  const response = withSecurityHeaders(request, NextResponse.next());
  // Avoid caching authenticated HTML / API responses
  if (pathname.startsWith("/app") || pathname.startsWith("/api")) {
    response.headers.set("Cache-Control", "no-store");
  }
  return response;
}

export const config = {
  // Skip build assets and static icons: they need no per-request work.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|icon.svg|apple-icon.png).*)"],
};
