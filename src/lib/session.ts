import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, isValidSessionToken } from "./auth";

// The proxy only redirects; this is the real check. Every data read and
// every Server Action calls it, because Server Actions are reachable by a
// direct POST regardless of what the proxy matches.
export async function requireSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await isValidSessionToken(token))) {
    redirect("/login");
  }
}
