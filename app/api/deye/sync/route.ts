import { getDb } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { syncDeyeHistory } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    return json(await syncDeyeHistory(getDb()));
  } catch (error) {
    return fail(error, 400);
  }
}
