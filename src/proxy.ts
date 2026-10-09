import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/auth/session";
import { routes } from "@/lib/contracts";

// Sends /r to the responder sign in and /hub to the hub lock when the cookie
// has no valid signature. It only guards pages. API routes check their own
// session with the require helpers in src/lib/auth/session.ts.
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/\/+$/, "") || "/";
  const isHub = path === "/hub" || path.startsWith("/hub/");
  const role = isHub ? "staff" : "responder";
  const signIn = isHub ? routes.hub.lock : routes.responder.signIn;

  if (path === signIn) return NextResponse.next();
  if (await readSession(role, request.cookies.get(SESSION_COOKIE[role])?.value)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = signIn;
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/r/:path*", "/hub/:path*"],
};
