import { getDb } from "@/lib/db";
import { buildHistory, type HistoryRange } from "@/lib/history";
import { fail, json } from "@/lib/http";
import { viewContext } from "@/lib/status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RANGES = new Set<HistoryRange>(["today", "7d", "30d", "year"]);

export function GET(request: Request) {
  try {
    const range = new URL(request.url).searchParams.get("range") ?? "today";
    if (!RANGES.has(range as HistoryRange)) return json({ error: "Unknown range" }, 400);
    const db = getDb();
    const view = viewContext(db);
    return json(buildHistory(db, view.mode, range as HistoryRange, view.clock.now));
  } catch (error) {
    return fail(error);
  }
}
