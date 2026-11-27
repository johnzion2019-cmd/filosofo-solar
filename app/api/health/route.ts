import { getDb } from "@/lib/db";
import { fail, json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  try {
    const db = getDb();
    db.prepare("SELECT 1 AS ok").get();
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
