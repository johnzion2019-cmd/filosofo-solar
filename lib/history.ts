import { getConfig } from "@/lib/config";
import { integrateSamples } from "@/lib/integrate";
import { energyRows, snapshotsBetween, type AppDb } from "@/lib/repo";
import { monthKey, startOfZonedDay, zonedParts } from "@/lib/time";
import type { DataSource, Sample } from "@/lib/types";

export type HistoryRange = "today" | "7d" | "30d" | "year";

export type HistoryPoint = {
  ts: number;
  label: string;
  pv: number;
  load: number;
  grid: number;
  battery: number;
  soc: number | null;
};

function labelFor(ts: number, timeZone: string, range: HistoryRange): string {
  if (range === "today") {
    return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(ts));
  }
  if (range === "7d") {
    return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "numeric", hour12: true }).format(new Date(ts));
  }
  if (range === "30d") {
    return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(new Date(ts));
  }
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "short" }).format(new Date(ts));
}

function averagePower(samples: Sample[], bucketMs: number, now: number, timeZone: string, range: HistoryRange): HistoryPoint[] {
  if (samples.length === 0) return [];
  const buckets = new Map<number, { pv: number; load: number; grid: number; battery: number; soc: number; n: number }>();
  for (const sample of samples) {
    const key = Math.floor(sample.ts / bucketMs) * bucketMs;
    const bucket = buckets.get(key) ?? { pv: 0, load: 0, grid: 0, battery: 0, soc: sample.batterySoc, n: 0 };
    bucket.pv += sample.pvW;
    bucket.load += sample.loadW;
    bucket.grid += sample.gridW;
    bucket.battery += sample.batteryW;
    bucket.soc = sample.batterySoc;
    bucket.n += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .filter(([ts]) => ts <= now)
    .sort((a, b) => a[0] - b[0])
    .map(([ts, bucket]) => ({
      ts,
      label: labelFor(ts, timeZone, range),
      pv: bucket.pv / bucket.n / 1000,
      load: bucket.load / bucket.n / 1000,
      grid: bucket.grid / bucket.n / 1000,
      battery: bucket.battery / bucket.n / 1000,
      soc: bucket.soc,
    }));
}

export function buildHistory(db: AppDb, source: DataSource, range: HistoryRange, now: number): {
  range: HistoryRange;
  unit: "kW" | "kWh";
  source: DataSource;
  points: HistoryPoint[];
} {
  const cfg = getConfig(db);
  const tz = cfg.timeZone;
  if (range === "today" || range === "7d") {
    const start = range === "today" ? startOfZonedDay(now, tz) : now - 7 * 86_400_000;
    const samples = snapshotsBetween(db, source, start, now);
    const bucket = range === "today" ? 5 * 60_000 : 30 * 60_000;
    return { range, unit: "kW", source, points: averagePower(samples, bucket, now, tz, range) };
  }
  if (range === "30d") {
    const start = zonedParts(now - 30 * 86_400_000, tz).ymd;
    const rows = energyRows(db, source, "day", start);
    return {
      range,
      unit: "kWh",
      source,
      points: rows.map((row) => {
        const ts = Date.parse(`${row.period}T00:00:00Z`);
        return {
          ts,
          label: labelFor(ts, "UTC", range),
          pv: row.productionKwh,
          load: row.loadKwh,
          grid: row.importKwh - row.exportKwh,
          battery: row.dischargeKwh - row.chargeKwh,
          soc: row.socClose,
        };
      }),
    };
  }

  const startMonth = monthKey(zonedParts(now - 370 * 86_400_000, tz).ymd);
  const days = energyRows(db, source, "day", `${startMonth}-01`);
  const months = new Map<string, HistoryPoint>();
  for (const row of days) {
    const key = monthKey(row.period);
    const ts = Date.parse(`${key}-01T00:00:00Z`);
    const point = months.get(key) ?? {
      ts,
      label: labelFor(ts, "UTC", "year"),
      pv: 0,
      load: 0,
      grid: 0,
      battery: 0,
      soc: null,
    };
    point.pv += row.productionKwh;
    point.load += row.loadKwh;
    point.grid += row.importKwh - row.exportKwh;
    point.battery += row.dischargeKwh - row.chargeKwh;
    point.soc = row.socClose;
    months.set(key, point);
  }
  for (const row of energyRows(db, source, "month", startMonth)) {
    if (months.has(row.period)) continue;
    const ts = Date.parse(`${row.period}-01T00:00:00Z`);
    months.set(row.period, {
      ts,
      label: labelFor(ts, "UTC", "year"),
      pv: row.productionKwh,
      load: row.loadKwh,
      grid: row.importKwh - row.exportKwh,
      battery: row.dischargeKwh - row.chargeKwh,
      soc: row.socClose,
    });
  }
  return { range, unit: "kWh", source, points: [...months.values()].sort((a, b) => a.ts - b.ts) };
}

export function todayTotals(db: AppDb, source: DataSource, now: number) {
  const tz = getConfig(db).timeZone;
  const start = startOfZonedDay(now, tz);
  return integrateSamples(snapshotsBetween(db, source, start, now), now);
}
