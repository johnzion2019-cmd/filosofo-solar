import { getConfig } from "@/lib/config";
import { getDb } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { allowIngest, parseIngestBody } from "@/lib/ingest";
import { insertSnapshot } from "@/lib/repo";
import { recomputeDay, runAlerts } from "@/lib/runtime";
import { safeEqual } from "@/lib/secrets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const db = getDb();
    const cfg = getConfig(db);
    const header = request.headers.get("authorization") ?? "";
    const token = header.toLowerCase().startsWith("bearer ")
      ? header.slice(7).trim()
      : (request.headers.get("x-api-key") ?? "").trim();
    if (!cfg.ingestApiKey || !token || !safeEqual(token, cfg.ingestApiKey)) {
      return json({ error: "Invalid API key" }, 401);
    }
    if (!allowIngest(token)) return json({ error: "Too many requests" }, 429);
    const payload = await request.json().catch(() => null);
    const parsed = parseIngestBody(payload);
    if (parsed.deviceSn && parsed.deviceSn !== cfg.inverterSn) {
      return json({ error: `This plant is configured for inverter ${cfg.inverterSn}` }, 409);
    }
    insertSnapshot(db, parsed.sample);
    recomputeDay(db, "bridge", parsed.sample.ts, Date.now());
    runAlerts(db, parsed.sample, Date.now());
    return json({ ok: true, ts: parsed.sample.ts, source: "bridge" });
  } catch (error) {
    return fail(error, 400);
  }
}
