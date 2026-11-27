import { DEFAULT_TARIFF_PHP } from "@/lib/billing";
import { emptyEnergy } from "@/lib/integrate";
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
  selfConsumedKwh: number;
  exportKwh: number;
  productionKwh: number;
  tariffPhp: number;
  feedInRatePhp: number;
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

export function mergeEnergyTotals(primary: EnergyTotals, secondary?: EnergyTotals | null): EnergyTotals {
  if (!secondary) return primary;
  return {
    productionKwh: Math.max(primary.productionKwh, secondary.productionKwh),
    loadKwh: Math.max(primary.loadKwh, secondary.loadKwh),
    chargeKwh: Math.max(primary.chargeKwh, secondary.chargeKwh),
    dischargeKwh: Math.max(primary.dischargeKwh, secondary.dischargeKwh),
    importKwh: Math.max(primary.importKwh, secondary.importKwh),
    exportKwh: Math.max(primary.exportKwh, secondary.exportKwh),
    socClose: primary.socClose ?? secondary.socClose,
  };
}

export function addEnergyTotals(left: EnergyTotals, right: EnergyTotals): EnergyTotals {
  return {
    productionKwh: left.productionKwh + right.productionKwh,
    loadKwh: left.loadKwh + right.loadKwh,
    chargeKwh: left.chargeKwh + right.chargeKwh,
    dischargeKwh: left.dischargeKwh + right.dischargeKwh,
    importKwh: left.importKwh + right.importKwh,
    exportKwh: left.exportKwh + right.exportKwh,
    socClose: right.socClose ?? left.socClose,
  };
}

/**
 * Solar energy used on-site (self-consumption).
 * When the inverter has produced today, this is production minus export.
 * At night / before first-light, if today's production is still 0, fall back to
 * battery discharge (stored solar being consumed) so Day earnings stay meaningful.
 */
export function selfConsumedKwh(energy: Pick<EnergyTotals, "productionKwh" | "exportKwh" | "dischargeKwh">): number {
  const production = Math.max(0, energy.productionKwh);
  const exported = Math.max(0, energy.exportKwh);
  if (production > 0) return Math.max(0, production - exported);
  return Math.max(0, energy.dischargeKwh);
}

export function dayEarnings(
  energy: EnergyTotals,
  tariffPhp: number = DEFAULT_TARIFF_PHP,
  feedInRatePhp: number = DEFAULT_FEED_IN_PHP,
): DayEarnings {
  const selfConsumed = selfConsumedKwh(energy);
  const exported = Math.max(0, energy.exportKwh);
  const rate = Math.max(0, tariffPhp);
  const feedIn = Math.max(0, feedInRatePhp);
  const consumptionSavingsPhp = roundPhp(selfConsumed * rate);
  const feedInEarningsPhp = roundPhp(exported * feedIn);
  return {
    totalPhp: roundPhp(consumptionSavingsPhp + feedInEarningsPhp),
    consumptionSavingsPhp,
    feedInEarningsPhp,
    selfConsumedKwh: selfConsumed,
    exportKwh: exported,
    productionKwh: Math.max(0, energy.productionKwh),
    tariffPhp: rate,
    feedInRatePhp: feedIn,
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
  /** When false (demo / unsynced), keep seeded history untouched. */
  accrueLiveMonths?: boolean;
}): EarningsReport {
  const tariffPhp = input.tariffPhp ?? DEFAULT_TARIFF_PHP;
  const feedInRatePhp = input.feedInRatePhp ?? DEFAULT_FEED_IN_PHP;
  const today = dayEarnings(input.today, tariffPhp, feedInRatePhp);
  const currentPeriod = zonedParts(input.now, input.timeZone ?? "Asia/Manila").ymd.slice(0, 7);
  const accrueLive = input.accrueLiveMonths === true;
  const liveMonths = accrueLive ? (input.liveMonths ?? {}) : {};
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
  return { today, monthly, lifetimeTotalPhp };
}
