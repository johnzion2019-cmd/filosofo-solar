import { DEFAULT_TARIFF_PHP } from "@/lib/billing";
import { addEnergyTotals, emptyEnergy, mergeEnergyTotals } from "@/lib/integrate";

export { addEnergyTotals, mergeEnergyTotals };
import { zonedParts } from "@/lib/time";
import type { EnergyTotals } from "@/lib/types";

export const DEFAULT_FEED_IN_PHP = 0;

export type SeededMonthlyEarnings = {
  period: string;
  consumptionSavingsPhp: number;
  feedInEarningsPhp: number;
  totalPhp: number;
  chargedEnergyKwh?: number;
  baselineAsOfYmd?: string;
};

export const SEEDED_MONTHLY_EARNINGS: readonly SeededMonthlyEarnings[] = [
  { period: "2026-08", consumptionSavingsPhp: 6405.95, feedInEarningsPhp: 0, totalPhp: 6405.95 },
  { period: "2026-09", consumptionSavingsPhp: 16_748.6, feedInEarningsPhp: 0, totalPhp: 16_748.6 },
  { period: "2026-10", consumptionSavingsPhp: 21_883.61, feedInEarningsPhp: 0, totalPhp: 21_883.61 },
  {
    period: "2026-11",
    consumptionSavingsPhp: 20_530.06,
    feedInEarningsPhp: 0,
    totalPhp: 20_530.06,
    chargedEnergyKwh: 549.5,
    baselineAsOfYmd: "2026-11-28",
  },
];

export const SEEDED_LIFETIME_TOTAL_PHP = SEEDED_MONTHLY_EARNINGS.reduce((sum, month) => sum + month.totalPhp, 0);

export type DayEarnings = {
  totalPhp: number;
  consumptionSavingsPhp: number;
  feedInEarningsPhp: number;
  selfSuppliedKwh: number;
  selfConsumedKwh: number;
  loadKwh: number;
  importKwh: number;
  exportKwh: number;
  productionKwh: number;
  tariffPhp: number;
  feedInRatePhp: number;
};

export type DailyEarnings = DayEarnings & {
  period: string;
  label: string;
  title: string;
  source: "live";
};

export type MonthlyEarnings = {
  period: string;
  label: string;
  title: string;
  consumptionSavingsPhp: number;
  feedInEarningsPhp: number;
  totalPhp: number;
  chargedEnergyKwh: number | null;
  source: "seeded" | "live" | "seeded+live";
};

export type EarningsReport = {
  today: DayEarnings;
  daily: DailyEarnings[];
  monthly: MonthlyEarnings[];
  lifetimeTotalPhp: number;
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const MONTH_TITLES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function roundPhp(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function monthLabel(period: string): string {
  const month = Number(period.slice(5, 7));
  return MONTH_LABELS[month - 1] ?? period;
}

export function monthTitle(period: string): string {
  const month = Number(period.slice(5, 7));
  const year = period.slice(0, 4);
  const name = MONTH_TITLES[month - 1] ?? period;
  return `${name} ${year}`;
}

export function dayLabel(period: string): string {
  const month = Number(period.slice(5, 7));
  const day = Number(period.slice(8, 10));
  const name = MONTH_LABELS[month - 1] ?? period;
  return `${name} ${day}`;
}

export function dayTitle(period: string): string {
  const day = Number(period.slice(8, 10));
  return `${monthTitle(period.slice(0, 7))} ${day}`;
}

/**
 * Energy the home used today that did not come from the grid.
 * Deye Cloud's Consumption Savings uses load minus import (battery/solar
 * serving the house), which stays meaningful at night when production is 0.
 * If load is missing, fall back to production minus export, then discharge.
 */
export function selfSuppliedKwh(energy: Pick<EnergyTotals, "productionKwh" | "exportKwh" | "dischargeKwh" | "loadKwh" | "importKwh">): number {
  const load = Math.max(0, energy.loadKwh);
  const imported = Math.max(0, energy.importKwh);
  if (load > 0) return Math.max(0, load - imported);
  const production = Math.max(0, energy.productionKwh);
  const exported = Math.max(0, energy.exportKwh);
  if (production > 0) return Math.max(0, production - exported);
  return Math.max(0, energy.dischargeKwh);
}

/** @deprecated alias of selfSuppliedKwh */
export const selfConsumedKwh = selfSuppliedKwh;

export function dayEarnings(
  energy: EnergyTotals,
  tariffPhp: number = DEFAULT_TARIFF_PHP,
  feedInRatePhp: number = DEFAULT_FEED_IN_PHP,
): DayEarnings {
  const supplied = selfSuppliedKwh(energy);
  const exported = Math.max(0, energy.exportKwh);
  const rate = Math.max(0, tariffPhp);
  const feedIn = Math.max(0, feedInRatePhp);
  const consumptionSavingsPhp = roundPhp(supplied * rate);
  const feedInEarningsPhp = roundPhp(exported * feedIn);
  return {
    totalPhp: roundPhp(consumptionSavingsPhp + feedInEarningsPhp),
    consumptionSavingsPhp,
    feedInEarningsPhp,
    selfSuppliedKwh: supplied,
    selfConsumedKwh: supplied,
    loadKwh: Math.max(0, energy.loadKwh),
    importKwh: Math.max(0, energy.importKwh),
    exportKwh: exported,
    productionKwh: Math.max(0, energy.productionKwh),
    tariffPhp: rate,
    feedInRatePhp: feedIn,
  };
}

export function toDailyEarnings(period: string, energy: EnergyTotals, tariffPhp: number, feedInRatePhp: number): DailyEarnings {
  return {
    period,
    label: dayLabel(period),
    title: dayTitle(period),
    source: "live",
    ...dayEarnings(energy, tariffPhp, feedInRatePhp),
  };
}

function fromSeed(seed: SeededMonthlyEarnings, source: MonthlyEarnings["source"]): MonthlyEarnings {
  return {
    period: seed.period,
    label: monthLabel(seed.period),
    title: monthTitle(seed.period),
    consumptionSavingsPhp: seed.consumptionSavingsPhp,
    feedInEarningsPhp: seed.feedInEarningsPhp,
    totalPhp: seed.totalPhp,
    chargedEnergyKwh: seed.chargedEnergyKwh ?? null,
    source,
  };
}

function fromLive(period: string, energy: EnergyTotals, tariffPhp: number, feedInRatePhp: number): MonthlyEarnings {
  const earned = dayEarnings(energy, tariffPhp, feedInRatePhp);
  return {
    period,
    label: monthLabel(period),
    title: monthTitle(period),
    consumptionSavingsPhp: earned.consumptionSavingsPhp,
    feedInEarningsPhp: earned.feedInEarningsPhp,
    totalPhp: earned.totalPhp,
    chargedEnergyKwh: energy.chargeKwh > 0 ? roundPhp(energy.chargeKwh) : null,
    source: "live",
  };
}

function mergeMonth(seed: SeededMonthlyEarnings, live: MonthlyEarnings): MonthlyEarnings {
  const consumption = Math.max(seed.consumptionSavingsPhp, live.consumptionSavingsPhp);
  const feedIn = Math.max(seed.feedInEarningsPhp, live.feedInEarningsPhp);
  const charged =
    seed.chargedEnergyKwh != null || live.chargedEnergyKwh != null
      ? Math.max(seed.chargedEnergyKwh ?? 0, live.chargedEnergyKwh ?? 0)
      : null;
  const exceeded =
    consumption > seed.consumptionSavingsPhp ||
    feedIn > seed.feedInEarningsPhp ||
    (charged != null && seed.chargedEnergyKwh != null && charged > seed.chargedEnergyKwh);
  return {
    period: seed.period,
    label: monthLabel(seed.period),
    title: monthTitle(seed.period),
    consumptionSavingsPhp: roundPhp(consumption),
    feedInEarningsPhp: roundPhp(feedIn),
    totalPhp: roundPhp(consumption + feedIn),
    chargedEnergyKwh: charged != null ? roundPhp(charged) : null,
    source: exceeded ? "seeded+live" : "seeded",
  };
}

export function buildEarningsReport(input: {
  today: EnergyTotals;
  tariffPhp?: number;
  feedInRatePhp?: number;
  now: number;
  timeZone?: string;
  liveMonths?: Record<string, EnergyTotals>;
  liveDays?: Record<string, EnergyTotals>;
  /** When false (demo / unsynced), keep seeded history untouched. */
  accrueLiveMonths?: boolean;
}): EarningsReport {
  const tariffPhp = input.tariffPhp ?? DEFAULT_TARIFF_PHP;
  const feedInRatePhp = input.feedInRatePhp ?? DEFAULT_FEED_IN_PHP;
  const timeZone = input.timeZone ?? "Asia/Manila";
  const todayYmd = zonedParts(input.now, timeZone).ymd;
  const currentPeriod = todayYmd.slice(0, 7);
  const today = dayEarnings(input.today, tariffPhp, feedInRatePhp);
  const accrueLive = input.accrueLiveMonths === true;
  const liveMonths = accrueLive ? (input.liveMonths ?? {}) : {};
  const liveDays = input.liveDays ?? {};
  const dailyPeriods = new Set([...Object.keys(liveDays), todayYmd]);
  const daily = [...dailyPeriods]
    .filter((period) => /^\d{4}-\d{2}-\d{2}$/.test(period) && period <= todayYmd)
    .sort()
    .map((period) => toDailyEarnings(period, period === todayYmd ? input.today : (liveDays[period] ?? emptyEnergy()), tariffPhp, feedInRatePhp));
  const periods = new Set([...SEEDED_MONTHLY_EARNINGS.map((month) => month.period), ...Object.keys(liveMonths), currentPeriod]);
  const monthly = [...periods]
    .filter((period) => /^\d{4}-\d{2}$/.test(period) && period <= currentPeriod)
    .sort()
    .map((period) => {
      const seed = SEEDED_MONTHLY_EARNINGS.find((month) => month.period === period);
      const liveEnergy = liveMonths[period];
      const live = liveEnergy ? fromLive(period, liveEnergy, tariffPhp, feedInRatePhp) : null;
      // Closed historical months stay on John's verified Deye Cloud totals.
      if (seed && period < currentPeriod) return fromSeed(seed, "seeded");
      if (seed && live) return mergeMonth(seed, live);
      if (seed) return fromSeed(seed, "seeded");
      if (live) return live;
      return fromLive(period, emptyEnergy(), tariffPhp, feedInRatePhp);
    });
  const lifetimeTotalPhp = roundPhp(monthly.reduce((sum, month) => sum + month.totalPhp, 0));
  return { today, daily, monthly, lifetimeTotalPhp };
}
