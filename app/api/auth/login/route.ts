import { json } from "@/lib/http";
import { safeEqual } from "@/lib/secrets";
import { SESSION_COOKIE, sessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const pin = process.env.APP_PIN;
  if (!pin) return json({ ok: true, required: false });
  const body = (await request.json().catch(() => null)) as { pin?: string } | null;
  const attempt = String(body?.pin ?? "");
  if (!attempt || !safeEqual(attempt, pin)) return json({ error: "Wrong PIN" }, 401);
  const response = json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: await sessionToken(pin),
    httpOnly: true,
    sameSite: "lax",
    secure: request.headers.get("x-forwarded-proto") === "https",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
