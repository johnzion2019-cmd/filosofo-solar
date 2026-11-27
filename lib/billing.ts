import { startOfZonedDay, zonedParts, zonedTimeToUtc } from "@/lib/time";

export const DEFAULT_TARIFF_PHP = 16.5;
export const DEFAULT_CYCLE_START_DAY = 30;
export const DEFAULT_DAILY_TARGET_KWH = 25;
export const CO2_KG_PER_KWH = 0.583;

export type CycleWindow = {
  startTs: number;
  endTs: number;
  startYmd: string;
  todayYmd: string;
  daysElapsed: number;
  daysTotal: number;
  label: string;
};

export const MAX_CYCLE_START_DAY = 31;

export function clampCycleStartDay(value: number): number {
  return Math.min(MAX_CYCLE_START_DAY, Math.max(1, Math.round(value)));
}

export function daysInCalendarMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function cycleStartDayInMonth(year: number, month: number, startDay: number): number {
  return Math.min(clampCycleStartDay(startDay), daysInCalendarMonth(year, month));
}

function ordinal(day: number): string {
  const teen = day % 100;
  if (teen >= 11 && teen <= 13) return `${day}th`;
  if (day % 10 === 1) return `${day}st`;
  if (day % 10 === 2) return `${day}nd`;
  if (day % 10 === 3) return `${day}rd`;
  return `${day}th`;
}

export function cycleWindow(now: number, timeZone: string, startDayInput: number): CycleWindow {
  const startDay = clampCycleStartDay(startDayInput);
  const z = zonedParts(now, timeZone);
  let year = z.year;
  let month = z.month;
  if (z.day < cycleStartDayInMonth(year, month, startDay)) {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  }
  const actualStartDay = cycleStartDayInMonth(year, month, startDay);
  const startTs = zonedTimeToUtc({ year, month, day: actualStartDay, hour: 0, minute: 0 }, timeZone);
  let endYear = year;
  let endMonth = month + 1;
  if (endMonth > 12) {
    endMonth = 1;
    endYear += 1;
  }
  const actualEndStartDay = cycleStartDayInMonth(endYear, endMonth, startDay);
  const endTs = zonedTimeToUtc({ year: endYear, month: endMonth, day: actualEndStartDay, hour: 0, minute: 0 }, timeZone);
  const daysTotal = Math.max(1, Math.round((endTs - startTs) / 86_400_000));
  const todayStart = startOfZonedDay(now, timeZone);
  const daysElapsed = Math.min(daysTotal, Math.max(1, Math.floor((todayStart - startTs) / 86_400_000) + 1));
  const endDay = zonedParts(endTs - 60_000, timeZone).day;
  return {
    startTs,
    endTs,
    startYmd: zonedParts(startTs, timeZone).ymd,
    todayYmd: z.ymd,
    daysElapsed,
    daysTotal,
    label: `Cycle ${ordinal(actualStartDay)}–${ordinal(endDay)}`,
  };
}

export function selfConsumptionPct(productionKwh: number, exportKwh: number): number {
  if (productionKwh <= 0) return 0;
  return Math.min(100, Math.max(0, ((productionKwh - exportKwh) / productionKwh) * 100));
}

export function directSolarKwh(productionKwh: number, chargeKwh: number, exportKwh: number): number {
  return Math.max(0, productionKwh - chargeKwh - exportKwh);
}

export function savingsPhp(generatedKwh: number, tariffPhp: number): number {
  return Math.max(0, generatedKwh) * Math.max(0, tariffPhp);
}

export function billEstimate(importKwh: number, daysElapsed: number, daysTotal: number, tariffPhp: number) {
  const imported = Math.max(0, importKwh);
  const rate = Math.max(0, tariffPhp);
  const elapsed = Math.max(1, daysElapsed);
  const billPhp = imported * rate;
  const avgImportKwhPerDay = imported / elapsed;
  return {
    billPhp,
    avgImportKwhPerDay,
    projectedBillPhp: avgImportKwhPerDay * Math.max(elapsed, daysTotal) * rate,
  };
}
