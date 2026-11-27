import { zonedParts } from "@/lib/time";

const MS_PER_MONTH = 30.4375 * 24 * 60 * 60 * 1000;

export type Payback = {
  systemCostPhp: number;
  totalSavedPhp: number;
  remainingPhp: number;
  paidOffPct: number;
  averageMonthlySavingsPhp: number | null;
  monthsToBreakEven: number | null;
  breakEvenYmd: string | null;
  breakEvenLabel: string | null;
};

export function buildPayback(input: {
  systemCostPhp: number;
  lifetimeTotalPhp: number;
  monthly: { totalPhp: number }[];
  now: number;
  timeZone: string;
}): Payback {
  const systemCostPhp = Math.max(0, Number.isFinite(input.systemCostPhp) ? input.systemCostPhp : 0);
  const totalSavedPhp = Math.max(0, Number.isFinite(input.lifetimeTotalPhp) ? input.lifetimeTotalPhp : 0);
  const remainingPhp = Math.max(0, systemCostPhp - totalSavedPhp);
  const paidOffPct = systemCostPhp > 0 ? Math.min(100, (totalSavedPhp / systemCostPhp) * 100) : 0;

  const activeMonths = input.monthly.filter((month) => Number.isFinite(month.totalPhp) && month.totalPhp > 0);
  const averageMonthlySavingsPhp =
    activeMonths.length > 0
      ? activeMonths.reduce((sum, month) => sum + month.totalPhp, 0) / activeMonths.length
      : null;

  if (systemCostPhp <= 0) {
    return {
      systemCostPhp: 0,
      totalSavedPhp,
      remainingPhp: 0,
      paidOffPct: 0,
      averageMonthlySavingsPhp,
      monthsToBreakEven: null,
      breakEvenYmd: null,
      breakEvenLabel: null,
    };
  }

  if (remainingPhp <= 0) {
    const breakEvenYmd = zonedParts(input.now, input.timeZone).ymd;
    return {
      systemCostPhp,
      totalSavedPhp,
      remainingPhp: 0,
      paidOffPct: 100,
      averageMonthlySavingsPhp,
      monthsToBreakEven: 0,
      breakEvenYmd,
      breakEvenLabel: "Paid off",
    };
  }

  if (!averageMonthlySavingsPhp || averageMonthlySavingsPhp <= 0) {
    return {
      systemCostPhp,
      totalSavedPhp,
      remainingPhp,
      paidOffPct,
      averageMonthlySavingsPhp,
      monthsToBreakEven: null,
      breakEvenYmd: null,
      breakEvenLabel: null,
    };
  }

  const monthsToBreakEven = remainingPhp / averageMonthlySavingsPhp;
  const breakEvenAt = input.now + monthsToBreakEven * MS_PER_MONTH;
  const breakEvenYmd = zonedParts(breakEvenAt, input.timeZone).ymd;
  const breakEvenLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: input.timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(breakEvenAt));

  return {
    systemCostPhp,
    totalSavedPhp,
    remainingPhp,
    paidOffPct,
    averageMonthlySavingsPhp,
    monthsToBreakEven,
    breakEvenYmd,
    breakEvenLabel,
  };
}
