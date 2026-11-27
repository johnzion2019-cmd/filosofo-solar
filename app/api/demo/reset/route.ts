import { resetDemoData, getDb } from "@/lib/db";
import { fail, json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST() {
  try {
    const db = getDb();
    resetDemoData(db);
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
