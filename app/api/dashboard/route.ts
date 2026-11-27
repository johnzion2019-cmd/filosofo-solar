import { getDb } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { buildDashboard } from "@/lib/status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return json(await buildDashboard(getDb()));
  } catch (error) {
    return fail(error);
  }
}
