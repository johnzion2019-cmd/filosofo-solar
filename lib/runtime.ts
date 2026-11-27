import { evaluateRules } from "@/lib/alerts";
import { getConfig } from "@/lib/config";
import { demoNow, simulateStep, type SimConfig } from "@/lib/demo";
import { integrateSamples } from "@/lib/integrate";
import {
  insertAlert,
  insertSnapshots,
  latestSnapshot,
  openAlertRules,
  snapshotsBetween,
  upsertEnergy,
  type AppDb,
} from "@/lib/repo";
import { zonedParts, startOfZonedDay } from "@/lib/time";
import type { DataSource, Sample } from "@/lib/types";

export function simConfig(cfg: ReturnType<typeof getConfig>): SimConfig {
  return {
    timeZone: cfg.timeZone,
    lat: cfg.lat,
    lon: cfg.lon,
    ratedW: cfg.ratedW,
    batteryKwh: cfg.batteryKwh,
    operatingMode: cfg.operatingMode,
    nominalHz: cfg.nominalHz,
  };
}

export function clockFor(cfg: ReturnType<typeof getConfig>, source: DataSource, realNow: number): { now: number; simulated: boolean } {
  if (source !== "demo" || cfg.demoEpochReal == null || cfg.demoEpochVirtual == null) {
    return { now: realNow, simulated: false };
  }
  return {
    now: demoNow(realNow, cfg.demoEpochReal, cfg.demoEpochVirtual),
    simulated: Math.abs(cfg.demoEpochVirtual - cfg.demoEpochReal) > 120_000,
  };
}

export function resolveSource(
  cfg: ReturnType<typeof getConfig>,
  latest: Record<DataSource, Sample | null>,
  realNow: number,
): DataSource {
  if (cfg.preferredSource !== "auto") return cfg.preferredSource;
  const freshMs = Math.max(cfg.pollIntervalSec * 3, 180) * 1000;
  const bridge = latest.bridge;
  const deye = latest.deye;
  if (bridge && realNow - bridge.ts >= 0 && realNow - bridge.ts < freshMs) return "bridge";
  if (cfg.deyeConfigured && deye && realNow - deye.ts >= 0 && realNow - deye.ts < freshMs * 4) return "deye";
  if (bridge && (!deye || bridge.ts > deye.ts)) return "bridge";
  if (cfg.deyeConfigured && deye) return "deye";
  return "demo";
}

export function recomputeDay(db: AppDb, source: DataSource, ts: number, until?: number): void {
  const tz = getConfig(db).timeZone;
  const start = startOfZonedDay(ts, tz);
  const end = start + 86_400_000 - 1;
  const totals = integrateSamples(snapshotsBetween(db, source, start, end), until && until >= start && until <= end + 60_000 ? until : undefined);
  upsertEnergy(db, source, zonedParts(ts, tz).ymd, "day", totals);
}

export function runAlerts(db: AppDb, sample: Sample, clockNow: number): void {
  const cfg = getConfig(db);
  const ageMinutes = Math.max(0, (clockNow - sample.ts) / 60_000);
  const open = new Set(openAlertRules(db, clockNow - 12 * 3_600_000));
  for (const draft of evaluateRules(sample, ageMinutes, cfg.alerts, open)) {
    insertAlert(db, draft, sample.source, false);
  }
}

export function catchUpDemo(db: AppDb, realNow = Date.now()): void {
  const cfg = getConfig(db);
  if (cfg.demoEpochReal == null || cfg.demoEpochVirtual == null) return;
  const target = demoNow(realNow, cfg.demoEpochReal, cfg.demoEpochVirtual);
  const last = latestSnapshot(db, "demo");
  if (!last) return;
  const gap = target - last.ts;
  let step = 60_000;
  if (gap > 6 * 3_600_000) step = 5 * 60_000;
  if (gap > 48 * 3_600_000) step = 15 * 60_000;
  const batch: Sample[] = [];
  if (gap >= step) {
    let ts = last.ts + step;
    let soc = last.batterySoc;
    const sim = simConfig(cfg);
    let count = 0;
    while (ts <= target && count < 500) {
      const result = simulateStep(ts, soc, step / 3_600_000, sim);
      soc = result.soc;
      batch.push(result.sample);
      ts += step;
      count += 1;
    }
    if (batch.length) insertSnapshots(db, batch);
  }
  const touched = batch.length ? batch : [last];
  const days = new Set<string>();
  for (const sample of touched) {
    const ymd = zonedParts(sample.ts, cfg.timeZone).ymd;
    if (days.has(ymd)) continue;
    days.add(ymd);
    const isCurrent = ymd === zonedParts(target, cfg.timeZone).ymd;
    recomputeDay(db, "demo", sample.ts, isCurrent ? target : undefined);
  }
  const newest = batch.length ? batch[batch.length - 1] : last;
  runAlerts(db, newest, target);
}
