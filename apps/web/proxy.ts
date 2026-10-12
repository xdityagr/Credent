import { NextResponse, type NextRequest } from "next/server";

export const SESSION_COOKIE = "credent_session";

/**
 * Optimistic gate only: if there is no session cookie at all, send the visitor
 * to /login before rendering the portal. The API remains the authority; an
 * expired cookie is caught client-side by useMe() returning 401.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const url = request.nextUrl.clone();
  const next = request.nextUrl.pathname + request.nextUrl.search;
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/app", "/app/:path*", "/onboarding"],
};
