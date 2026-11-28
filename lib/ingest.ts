import { stringPowerWatts } from "@/lib/pv-strings";
import type { GridStatus, Sample } from "@/lib/types";
import { z } from "zod";

const finite = z.number().finite();

const schema = z
  .object({
    deviceSn: z.string().trim().min(1).max(64).optional(),
    device_sn: z.string().trim().min(1).max(64).optional(),
    timestamp: z.union([z.string(), z.number()]).optional(),
    ts: z.number().optional(),
    pvW: finite.optional(),
    pv_w: finite.optional(),
    pv_power: finite.optional(),
    loadW: finite.optional(),
    load_w: finite.optional(),
    load_power: finite.optional(),
    upsW: finite.optional(),
    ups_w: finite.optional(),
    ups_power: finite.optional(),
    gridW: finite.optional(),
    grid_w: finite.optional(),
    grid_power: finite.optional(),
    gridStatus: z.enum(["on-grid", "off-grid", "on", "off", "ongrid", "offgrid"]).optional(),
    grid_status: z.enum(["on-grid", "off-grid", "on", "off", "ongrid", "offgrid"]).optional(),
    batteryW: finite.optional(),
    battery_w: finite.optional(),
    battery_power: finite.optional(),
    batterySoc: finite.optional(),
    battery_soc: finite.optional(),
    soc: finite.optional(),
    batteryV: finite.optional(),
    battery_v: finite.optional(),
    batteryA: finite.optional(),
    battery_a: finite.optional(),
    batteryTemp: finite.optional(),
    battery_temp: finite.optional(),
    pv1V: finite.optional(),
    pv1_v: finite.optional(),
    pv1A: finite.optional(),
    pv1_a: finite.optional(),
    pv1W: finite.optional(),
    pv1_w: finite.optional(),
    pv2V: finite.optional(),
    pv2_v: finite.optional(),
    pv2A: finite.optional(),
    pv2_a: finite.optional(),
    pv2W: finite.optional(),
    pv2_w: finite.optional(),
    pv3V: finite.optional(),
    pv3_v: finite.optional(),
    pv3A: finite.optional(),
    pv3_a: finite.optional(),
    pv3W: finite.optional(),
    pv3_w: finite.optional(),
    acV: finite.optional(),
    ac_v: finite.optional(),
    acHz: finite.optional(),
    ac_hz: finite.optional(),
    inverterTemp: finite.optional(),
    inverter_temp: finite.optional(),
    operatingMode: z.string().trim().max(80).optional(),
    operating_mode: z.string().trim().max(80).optional(),
    online: z.boolean().optional(),
    pv1: z.object({ v: finite.optional(), a: finite.optional(), w: finite.optional() }).optional(),
    pv2: z.object({ v: finite.optional(), a: finite.optional(), w: finite.optional() }).optional(),
    pv3: z.object({ v: finite.optional(), a: finite.optional(), w: finite.optional() }).optional(),
  })
  .passthrough();

function pick<T>(...values: (T | undefined)[]): T | undefined {
  return values.find((value) => value !== undefined);
}

function gridStatus(value: string | undefined): GridStatus {
  if (!value) return "on-grid";
  return value.includes("off") ? "off-grid" : "on-grid";
}

function timestampOf(value: string | number | undefined, now: number): number {
  if (value == null || value === "") return now;
  if (typeof value === "number") {
    if (value > 1e12) return value;
    if (value > 1e9) return value * 1000;
    throw new Error("timestamp is not a valid unix time");
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("timestamp is not a valid date");
  return parsed;
}

function checkRange(name: string, value: number | null, min: number, max: number) {
  if (value == null) return;
  if (value < min || value > max) throw new Error(`${name} is outside the accepted range`);
}

export function parseIngestBody(input: unknown, now = Date.now()): { deviceSn: string | null; sample: Sample } {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Invalid telemetry payload");
  }
  const body = parsed.data;
  const pvW = pick(body.pvW, body.pv_w, body.pv_power) ?? 0;
  const loadW = pick(body.loadW, body.load_w, body.load_power) ?? 0;
  const upsW = pick(body.upsW, body.ups_w, body.ups_power) ?? 0;
  const gridW = pick(body.gridW, body.grid_w, body.grid_power) ?? 0;
  const batteryW = pick(body.batteryW, body.battery_w, body.battery_power) ?? 0;
  const batterySoc = pick(body.batterySoc, body.battery_soc, body.soc);
  if (
    body.pvW == null &&
    body.pv_w == null &&
    body.pv_power == null &&
    body.loadW == null &&
    body.load_w == null &&
    body.load_power == null &&
    body.gridW == null &&
    body.grid_w == null &&
    body.grid_power == null &&
    body.batteryW == null &&
    body.battery_w == null &&
    body.battery_power == null &&
    batterySoc == null
  ) {
    throw new Error("Payload needs at least one of pv, load, grid, battery power, or SOC");
  }
  checkRange("pvW", pvW, 0, 500_000);
  checkRange("loadW", loadW, 0, 500_000);
  checkRange("upsW", upsW, 0, 500_000);
  checkRange("gridW", gridW, -500_000, 500_000);
  checkRange("batteryW", batteryW, -500_000, 500_000);
  if (batterySoc != null) checkRange("batterySoc", batterySoc, 0, 100);

  const pv1V = pick(body.pv1V, body.pv1_v, body.pv1?.v) ?? null;
  const pv1A = pick(body.pv1A, body.pv1_a, body.pv1?.a) ?? null;
  const pv1W = stringPowerWatts(pick(body.pv1W, body.pv1_w, body.pv1?.w) ?? null, pv1V, pv1A);
  const pv2V = pick(body.pv2V, body.pv2_v, body.pv2?.v) ?? null;
  const pv2A = pick(body.pv2A, body.pv2_a, body.pv2?.a) ?? null;
  const pv2W = stringPowerWatts(pick(body.pv2W, body.pv2_w, body.pv2?.w) ?? null, pv2V, pv2A);
  const pv3V = pick(body.pv3V, body.pv3_v, body.pv3?.v) ?? null;
  const pv3A = pick(body.pv3A, body.pv3_a, body.pv3?.a) ?? null;
  const pv3W = stringPowerWatts(pick(body.pv3W, body.pv3_w, body.pv3?.w) ?? null, pv3V, pv3A);
  const batteryV = pick(body.batteryV, body.battery_v) ?? null;
  const batteryA = pick(body.batteryA, body.battery_a) ?? null;
  const batteryTemp = pick(body.batteryTemp, body.battery_temp) ?? null;
  const acV = pick(body.acV, body.ac_v) ?? null;
  const acHz = pick(body.acHz, body.ac_hz) ?? null;
  const inverterTemp = pick(body.inverterTemp, body.inverter_temp) ?? null;
  checkRange("batteryTemp", batteryTemp, -40, 150);
  checkRange("inverterTemp", inverterTemp, -40, 150);
  checkRange("acV", acV, 0, 1000);
  checkRange("acHz", acHz, 0, 100);

  const ts = timestampOf(body.timestamp ?? body.ts, now);
  if (ts > now + 5 * 60_000) throw new Error("timestamp is too far in the future");
  if (ts < now - 365 * 86_400_000) throw new Error("timestamp is too far in the past");

  return {
    deviceSn: body.deviceSn ?? body.device_sn ?? null,
    sample: {
      ts,
      source: "bridge",
      pvW,
      pv1V,
      pv1A,
      pv1W,
      pv2V,
      pv2A,
      pv2W,
      pv3V,
      pv3A,
      pv3W,
      loadW,
      upsW,
      gridW,
      gridStatus: gridStatus(pick(body.gridStatus, body.grid_status)),
      batteryW,
      batterySoc: batterySoc ?? 0,
      batteryV,
      batteryA,
      batteryTemp,
      acV,
      acHz,
      inverterTemp,
      operatingMode: pick(body.operatingMode, body.operating_mode) || "Manual Mode",
      online: body.online ?? true,
    },
  };
}

const hits = new Map<string, number[]>();

export function allowIngest(key: string, limit = 120, windowMs = 60_000, now = Date.now()): boolean {
  const recent = (hits.get(key) || []).filter((ts) => now - ts < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
