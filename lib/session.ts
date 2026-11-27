export const SESSION_COOKIE = "filosofo_session";
const PAYLOAD = "filosofo-session-v1";

export async function sessionToken(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(PAYLOAD));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sessionMatches(pin: string, cookie: string | undefined): Promise<boolean> {
  if (!cookie) return false;
  const expected = await sessionToken(pin);
  if (cookie.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= cookie.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
