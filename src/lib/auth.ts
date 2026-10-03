// Single-user auth: one password (APP_PASSWORD) and a long-lived cookie.
//
// The cookie holds HMAC(AUTH_SECRET, APP_PASSWORD) — nothing to store
// server-side, and changing either env var logs every device out. Uses Web
// Crypto only, so it runs the same in the proxy and in server code.

export const SESSION_COOKIE = "nutri_app_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

export async function expectedSessionToken(): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  const password = process.env.APP_PASSWORD;
  if (!secret || !password) {
    throw new Error("Missing AUTH_SECRET / APP_PASSWORD");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(password));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isValidSessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  return safeEqual(token, await expectedSessionToken());
}

export function isValidPassword(input: string): boolean {
  const password = process.env.APP_PASSWORD;
  if (!password) return false;
  return safeEqual(input, password);
}

// Constant-time comparison, so response timing doesn't leak how many
// leading characters matched.
function safeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < bBytes.length; i++) {
    diff |= (aBytes[i] ?? 0) ^ bBytes[i];
  }
  return diff === 0;
}
