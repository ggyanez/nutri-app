import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSessionToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const authed = await isValidSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const onLogin = request.nextUrl.pathname === "/login";

  if (!authed && !onLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (authed && onLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except static assets and the PWA files, which the browser
  // fetches without cookies when installing the app.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon-.*\\.png|apple-icon.png|icon.png).*)",
  ],
};
