import type { DailyEarnings, MonthlyEarnings } from "@/lib/earnings";

export type RecordDay = {
  period: string;
  label: string;
  kwh: number;
  php: number;
};

export type PlantRecords = {
  bestDay: RecordDay | null;
  average: { kwh: number; php: number; days: number } | null;
  bestMonth: { period: string; label: string; php: number } | null;
};

function dayKwh(day: DailyEarnings): number {
  return day.productionKwh > 0 ? day.productionKwh : day.selfSuppliedKwh;
}

function shortDayLabel(period: string): string {
  const [year, month, day] = period.split("-").map(Number);
  if (!year || !month || !day) return period;
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

function shortMonthLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

export function buildPlantRecords(daily: DailyEarnings[], monthly: MonthlyEarnings[]): PlantRecords {
  const activeDays = daily.filter((day) => dayKwh(day) > 0 || day.totalPhp > 0);
  let bestDay: RecordDay | null = null;
  if (activeDays.length) {
    const top = activeDays.reduce((winner, day) => {
      const wKwh = dayKwh(winner);
      const dKwh = dayKwh(day);
      if (dKwh > wKwh) return day;
      if (dKwh === wKwh && day.totalPhp > winner.totalPhp) return day;
      return winner;
    });
    bestDay = {
      period: top.period,
      label: shortDayLabel(top.period),
      kwh: dayKwh(top),
      php: top.totalPhp,
    };
  }

  const average = activeDays.length
    ? {
        kwh: activeDays.reduce((sum, day) => sum + dayKwh(day), 0) / activeDays.length,
        php: activeDays.reduce((sum, day) => sum + day.totalPhp, 0) / activeDays.length,
        days: activeDays.length,
      }
    : null;

  const activeMonths = monthly.filter((month) => month.totalPhp > 0);
  const bestMonth = activeMonths.length
    ? (() => {
        const top = activeMonths.reduce((winner, month) => (month.totalPhp > winner.totalPhp ? month : winner));
        return { period: top.period, label: shortMonthLabel(top.period), php: top.totalPhp };
      })()
    : null;

  return { bestDay, average, bestMonth };
}
