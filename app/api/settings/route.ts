import { z } from "zod";
import { applySettings, getConfig, publicSettings } from "@/lib/config";
import { getDb } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { viewContext } from "@/lib/status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  try {
    const db = getDb();
    const view = viewContext(db);
    return json({ ...publicSettings(getConfig(db)), mode: view.mode });
  } catch (error) {
    return fail(error);
  }
}

const patchSchema = z.object({
  plantName: z.string().max(80).optional(),
  plantLocation: z.string().max(120).optional(),
  lat: z.number().finite().gte(-90).lte(90).optional(),
  lon: z.number().finite().gte(-180).lte(180).optional(),
  timeZone: z.string().max(80).optional(),
  inverterSn: z.string().max(64).optional(),
  inverterModel: z.string().max(80).optional(),
  ratedW: z.number().finite().positive().max(1_000_000).optional(),
  batteryKwh: z.number().finite().positive().max(10_000).optional(),
  operatingMode: z.string().max(80).optional(),
  deyeRegion: z.enum(["eu", "us", "india", "custom"]).optional(),
  deyeBaseUrl: z.string().max(200).optional(),
  deyeAppId: z.string().max(120).optional(),
  deyeAppSecret: z.string().max(200).optional(),
  deyeEmail: z.string().max(200).optional(),
  deyePassword: z.string().max(200).optional(),
  deyeCompanyId: z.string().max(40).optional(),
  deyeStationId: z.string().max(40).optional(),
  pollIntervalSec: z.number().finite().optional(),
  preferredSource: z.enum(["auto", "demo", "deye", "bridge"]).optional(),
  alertLowSocEnabled: z.boolean().optional(),
  alertLowSocThreshold: z.number().finite().optional(),
  alertGridEnabled: z.boolean().optional(),
  alertOfflineEnabled: z.boolean().optional(),
  alertOfflineMinutes: z.number().finite().optional(),
  rotateIngestKey: z.boolean().optional(),
  tariffPhp: z.number().finite().min(0).max(1000).optional(),
  billingCycleStartDay: z.number().int().min(1).max(31).optional(),
  dailyTargetKwh: z.number().finite().positive().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const patch = patchSchema.parse(await request.json());
    const db = getDb();
    applySettings(db, patch);
    const view = viewContext(db);
    return json({ ...publicSettings(getConfig(db)), mode: view.mode });
  } catch (error) {
    return fail(error, error instanceof z.ZodError ? 400 : 500);
  }
}
