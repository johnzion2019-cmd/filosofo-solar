import { getConfig } from "@/lib/config";
import { chooseDemoClock, simulateStep, type SimConfig } from "@/lib/demo";
import { insertAlert, insertSnapshots, setSetting, upsertEnergy, type AppDb } from "@/lib/repo";
import { zonedParts } from "@/lib/time";
import type { AlertDraft, Sample } from "@/lib/types";

function simOf(cfg: ReturnType<typeof getConfig>): SimConfig {
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

export function seedDemo(db: AppDb, realNow = Date.now()): void {
  const cfg = getConfig(db);
  const clock = chooseDemoClock(realNow, cfg.timeZone);
  setSetting(db, "demo_epoch_real", String(realNow));
  setSetting(db, "demo_epoch_virtual", String(clock.virtualNow));
  const sim = simOf(cfg);
  const end = clock.virtualNow;
  const start = end - 400 * 86_400_000;
  const recentCut = end - 45 * 86_400_000;
  let ts = Math.floor(start / (30 * 60_000)) * (30 * 60_000);
  let soc = 55;
  let day = "";
  let prevOff = false;
  let lowSocDay = "";
  const acc = { pv: 0, load: 0, charge: 0, discharge: 0, imp: 0, exp: 0 };
  let socClose = soc;
  const samples: Sample[] = [];
  const energies: { period: string; productionKwh: number; loadKwh: number; chargeKwh: number; dischargeKwh: number; importKwh: number; exportKwh: number; socClose: number }[] = [];
  const alerts: AlertDraft[] = [];

  const flush = (period: string) => {
    if (!period) return;
    energies.push({
      period,
      productionKwh: acc.pv / 1000,
      loadKwh: acc.load / 1000,
      chargeKwh: acc.charge / 1000,
      dischargeKwh: acc.discharge / 1000,
      importKwh: acc.imp / 1000,
      exportKwh: acc.exp / 1000,
      socClose,
    });
    acc.pv = acc.load = acc.charge = acc.discharge = acc.imp = acc.exp = 0;
  };

  while (ts <= end) {
    const stepMs = ts >= recentCut ? 10 * 60_000 : 30 * 60_000;
    const result = simulateStep(ts, soc, stepMs / 3_600_000, sim);
    soc = result.soc;
    const ymd = zonedParts(ts, cfg.timeZone).ymd;
    if (ymd !== day) {
      flush(day);
      day = ymd;
    }
    const dt = stepMs / 3_600_000;
    const point = result.sample;
    acc.pv += point.pvW * dt;
    acc.load += point.loadW * dt;
    if (point.batteryW < 0) acc.charge += -point.batteryW * dt;
    else acc.discharge += point.batteryW * dt;
    if (point.gridW > 0) acc.imp += point.gridW * dt;
    else acc.exp += -point.gridW * dt;
    socClose = point.batterySoc;
    if (ts >= recentCut) samples.push(point);
    if (!prevOff && point.gridStatus === "off-grid") {
      alerts.push({
        ts,
        rule: "grid-outage",
        severity: "critical",
        message: "Grid outage. The inverter is running off-grid.",
      });
    }
    prevOff = point.gridStatus === "off-grid";
    if (point.batterySoc < cfg.alerts.lowSocThreshold && lowSocDay !== ymd) {
      alerts.push({
        ts,
        rule: "low-soc",
        severity: "warning",
        message: `Battery at ${point.batterySoc.toFixed(1)}% — below the ${cfg.alerts.lowSocThreshold.toFixed(0)}% line.`,
      });
      lowSocDay = ymd;
    }
    ts += stepMs;
  }
  flush(day);

  const tx = db.transaction(() => {
    insertSnapshots(db, samples);
    for (const row of energies) {
      upsertEnergy(db, "demo", row.period, "day", row);
    }
    for (const alert of alerts) insertAlert(db, alert, "demo", true);
  });
  tx();
}
