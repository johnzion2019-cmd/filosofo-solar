import { estimateBatteryRuntime } from "@/lib/battery";
import { billEstimate, CO2_KG_PER_KWH, cycleWindow, directSolarKwh, savingsPhp, selfConsumptionPct } from "@/lib/billing";
import { buildPayback } from "@/lib/payback";
import { addEnergyTotals, buildEarningsReport, DEFAULT_FEED_IN_PHP, mergeEnergyTotals } from "@/lib/earnings";
import { getConfig } from "@/lib/config";
import { emptyEnergy } from "@/lib/integrate";
import { todayTotals } from "@/lib/history";
import { energyRows, latestSnapshot, snapshotsBetween, unreadCount } from "@/lib/repo";
import { clockFor, resolveSource } from "@/lib/runtime";
import { formatPlantClock, startOfZonedDay, zonedParts } from "@/lib/time";
import type { AppDb } from "@/lib/repo";
import type { DataSource, EnergyTotals, Sample } from "@/lib/types";
import { ensureDeyeDailyHistory } from "@/lib/sync";
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


function energyForPeriod(rows: Array<EnergyTotals & { period: string }>, period: string): EnergyTotals | null {
  return rows.find((row) => row.period === period) ?? null;
}

function resolveTodayEnergy(db: AppDb, mode: DataSource, clockNow: number, timeZone: string): EnergyTotals {
  const fromSamples = todayTotals(db, mode, clockNow);
  const todayYmd = zonedParts(clockNow, timeZone).ymd;
  const official = energyForPeriod(energyRows(db, mode, "day", todayYmd), todayYmd);
  return mergeEnergyTotals(fromSamples, official);
}

function liveMonthEnergy(
  db: AppDb,
  mode: DataSource,
  period: string,
  todayYmd: string,
  today: EnergyTotals,
): EnergyTotals {
  let totals = emptyEnergy();
  for (const row of energyRows(db, mode, "day", `${period}-01`)) {
    if (!row.period.startsWith(period)) continue;
    if (row.period === todayYmd) continue;
    totals = addEnergyTotals(totals, row);
  }
  if (todayYmd.startsWith(period)) totals = addEnergyTotals(totals, today);
  const officialMonth = energyForPeriod(energyRows(db, mode, "month", period), period);
  return mergeEnergyTotals(totals, officialMonth);
}

export async function buildDashboard(db: AppDb) {
  const status = await buildStatus(db);
  const cfg = getConfig(db);
  if (cfg.deyeConfigured) {
    try {
      await ensureDeyeDailyHistory(db);
    } catch {
      // Serve any cached daily totals if Deye history is briefly unavailable.
    }
  }
  const energySource: DataSource = status.mode === "bridge" ? "bridge" : cfg.deyeConfigured ? "deye" : "demo";
  const energyNow = energySource === "demo" ? status.clockNow : Date.now();
  const today = status.live || energySource === "deye" ? resolveTodayEnergy(db, energySource, energyNow, cfg.timeZone) : emptyEnergy();
  const todayYmd = zonedParts(energyNow, cfg.timeZone).ymd;
  const currentPeriod = todayYmd.slice(0, 7);
  const liveMonths: Record<string, EnergyTotals> = {};
  const monthPeriods = new Set<string>([currentPeriod]);
  for (const row of energyRows(db, energySource, "month", "2026-08")) monthPeriods.add(row.period);
  for (const row of energyRows(db, energySource, "day", "2026-08-01")) monthPeriods.add(row.period.slice(0, 7));
  for (const period of monthPeriods) {
    liveMonths[period] = liveMonthEnergy(db, energySource, period, todayYmd, today);
  }
  const liveDays: Record<string, EnergyTotals> = {};
  const dailyFrom = zonedParts(energyNow - 31 * 86_400_000, cfg.timeZone).ymd;
  for (const row of energyRows(db, energySource, "day", dailyFrom)) {
    liveDays[row.period] = row;
  }
  const earnings = buildEarningsReport({
    today,
    tariffPhp: cfg.tariffPhp,
    feedInRatePhp: DEFAULT_FEED_IN_PHP,
    now: energyNow,
    timeZone: cfg.timeZone,
    liveMonths,
    liveDays,
    accrueLiveMonths: energySource === "deye",
  });
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
    todaySavingsPhp: earnings.today.consumptionSavingsPhp,
    earnings,
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
    batteryRuntime: estimateBatteryRuntime({
      batteryKwh: cfg.batteryKwh,
      soc: status.live?.batterySoc ?? 0,
      batteryW: status.live?.batteryW ?? 0,
      reserveSoc: cfg.batteryReserveSoc,
    }),
    payback: buildPayback({
      systemCostPhp: cfg.systemCostPhp,
      lifetimeTotalPhp: earnings.lifetimeTotalPhp,
      monthly: earnings.monthly,
      now: status.clockNow,
      timeZone: cfg.timeZone,
    }),
  };
}

