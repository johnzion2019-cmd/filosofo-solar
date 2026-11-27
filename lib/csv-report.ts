import type { EarningsReport } from "@/lib/earnings";

function csvCell(value: string | number): string {
  const text = typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function line(cells: Array<string | number>): string {
  return cells.map(csvCell).join(",");
}

export function buildEarningsCsv(earnings: EarningsReport): string {
  const rows: string[] = [
    "Monthly Summary",
    line(["Month", "Consumption Savings PHP", "Feed-In PHP", "Total Earnings PHP"]),
    ...earnings.monthly.map((month) =>
      line([month.period, month.consumptionSavingsPhp, month.feedInEarningsPhp, month.totalPhp]),
    ),
    "",
    "Daily History",
    line(["Date", "kWh Saved", "Consumption Savings PHP", "Feed-In PHP", "Total Earnings PHP"]),
    ...earnings.daily.map((day) =>
      line([day.period, day.selfSuppliedKwh, day.consumptionSavingsPhp, day.feedInEarningsPhp, day.totalPhp]),
    ),
  ];
  return `\uFEFF${rows.join("\r\n")}\r\n`;
}

export function csvFilename(ymd: string): string {
  return `filosofo-solar-report-${ymd}.csv`;
}
