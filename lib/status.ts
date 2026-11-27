import { billEstimate, CO2_KG_PER_KWH, cycleWindow, directSolarKwh, savingsPhp, selfConsumptionPct } from "@/lib/billing";
import { getConfig } from "@/lib/config";
import { emptyEnergy } from "@/lib/integrate";
import { todayTotals } from "@/lib/history";
import { energyRows, latestSnapshot, snapshotsBetween, unreadCount } from "@/lib/repo";
import { clockFor, resolveSource } from "@/lib/runtime";
import { formatPlantClock, startOfZonedDay } from "@/lib/time";
import type { AppDb } from "@/lib/repo";
import type { DataSource, Sample } from "@/lib/types";
import { fetchWeather } from "@/lib/weather";

function clockNote(simulated: boolean, timeZone: string, now: number): string | null {
  if (!simulated) return null;
  return `Demo time is ${formatPlantClock(now, timeZone)}. It's outside daylight at the plant, so the clock sits on a sunny day instead of a dark live view.`;
}

export function viewContext(db: AppDb) {
  const cfg = getConfig(db);
  const realNow = Date.now();
  const latest: Record<DataSource, Sample | null> = {
    demo: latestSnapshot(db, "demo"),
    deye: latestSnapshot(db, "deye"),
    bridge: latestSnapshot(db, "bridge"),
  };
  const mode = resolveSource(cfg, latest, realNow);
  const clock = clockFor(cfg, mode, realNow);
  return { cfg, mode, clock, live: latest[mode], realNow };
}

export async function buildStatus(db: AppDb) {
  const { cfg, mode, clock, live } = viewContext(db);
  const weather = await fetchWeather(cfg.lat, cfg.lon, cfg.timeZone);
  const simulated = mode === "demo" && clock.simulated;
  return {
    mode,
    plant: {
      name: cfg.plantName,
      location: cfg.plantLocation,
      lat: cfg.lat,
      lon: cfg.lon,
      timeZone: cfg.timeZone,
    },
    inverter: {
      serial: cfg.inverterSn,
      model: cfg.inverterModel,
      ratedW: cfg.ratedW,
      batteryKwh: cfg.batteryKwh,
    },
    updatedAt: live?.ts ?? null,
    clockNow: clock.now,
    simulatedClock: simulated,
    clockLabel: formatPlantClock(live?.ts ?? clock.now, cfg.timeZone),
    clockNote: clockNote(simulated, cfg.timeZone, clock.now),
    weather,
    operatingMode: live?.operatingMode && live.operatingMode !== "—" ? live.operatingMode : cfg.operatingMode,
    gridStatus: live?.gridStatus ?? null,
    unreadAlerts: unreadCount(db),
    deyeConfigured: cfg.deyeConfigured,
    deyeLastError: cfg.deyeConfigured ? cfg.deyeLastError : null,
    pinEnabled: Boolean(process.env.APP_PIN),
    live,
  };
}

export async function buildDashboard(db: AppDb) {
  const status = await buildStatus(db);
  const cfg = getConfig(db);
  const today = status.live ? todayTotals(db, status.mode, status.clockNow) : emptyEnergy();
  const cycle = cycleWindow(status.clockNow, cfg.timeZone, cfg.billingCycleStartDay);
  let cycleGenerated = 0;
  let cycleImport = 0;
  for (const row of energyRows(db, status.mode, "day", cycle.startYmd)) {
    if (row.period >= cycle.startYmd && row.period < cycle.todayYmd) {
      cycleGenerated += row.productionKwh;
      cycleImport += row.importKwh;
    }
  }
  cycleGenerated += today.productionKwh;
  cycleImport += today.importKwh;
  const bill = billEstimate(cycleImport, cycle.daysElapsed, cycle.daysTotal, cfg.tariffPhp);
  const start = startOfZonedDay(status.clockNow, cfg.timeZone);
  const samples = snapshotsBetween(db, status.mode, start, status.clockNow);
  let peakW = 0;
  let peakTs = start;
  for (const sample of samples) {
    if (sample.pvW >= peakW) {
      peakW = sample.pvW;
      peakTs = sample.ts;
    }
  }
  const stride = Math.max(1, Math.ceil(samples.length / 180));
  const series = samples
    .filter((sample, index) => index % stride === 0 || index === samples.length - 1)
    .map((sample) => ({
      ts: sample.ts,
      label: new Intl.DateTimeFormat("en-US", {
        timeZone: cfg.timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(sample.ts)),
      solarKw: sample.pvW / 1000,
      loadKw: sample.loadW / 1000,
      soc: sample.batterySoc,
    }));
  return {
    ...status,
    today,
    tariffPhp: cfg.tariffPhp,
    dailyTargetKwh: cfg.dailyTargetKwh,
    co2Kg: today.productionKwh * CO2_KG_PER_KWH,
    selfConsumptionPct: selfConsumptionPct(today.productionKwh, today.exportKwh),
    directKwh: directSolarKwh(today.productionKwh, today.chargeKwh, today.exportKwh),
    todaySavingsPhp: savingsPhp(today.productionKwh, cfg.tariffPhp),
    peak: { w: peakW, ts: peakTs },
    cycle: {
      label: cycle.label,
      tariffPhp: cfg.tariffPhp,
      daysElapsed: cycle.daysElapsed,
      daysTotal: cycle.daysTotal,
      generatedKwh: cycleGenerated,
      importKwh: cycleImport,
      savingsPhp: savingsPhp(cycleGenerated, cfg.tariffPhp),
      billPhp: bill.billPhp,
      projectedBillPhp: bill.projectedBillPhp,
      avgImportKwhPerDay: bill.avgImportKwhPerDay,
      progressPct: (cycle.daysElapsed / cycle.daysTotal) * 100,
    },
    series,
    housePhotoUrl: "/api/house-photo?v=final",
  };
}
