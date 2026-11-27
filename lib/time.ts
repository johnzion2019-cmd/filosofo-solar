export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  ymd: string;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timeZone, fmt);
  }
  return fmt;
}

export function zonedParts(ts: number, timeZone: string): ZonedParts {
  const bag: Record<string, string> = {};
  for (const part of formatter(timeZone).formatToParts(new Date(ts))) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  const month = bag.month ?? "01";
  const day = bag.day ?? "01";
  const year = bag.year ?? "1970";
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour,
    minute: Number(bag.minute ?? 0),
    second: Number(bag.second ?? 0),
    ymd: `${year}-${month}-${day}`,
  };
}

export function zonedTimeToUtc(
  parts: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string,
): number {
  let utc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  for (let i = 0; i < 3; i += 1) {
    const z = zonedParts(utc, timeZone);
    const got = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute);
    const want = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    const delta = want - got;
    if (delta === 0) break;
    utc += delta;
  }
  return utc;
}

export function timezoneOffsetHours(ts: number, timeZone: string): number {
  const z = zonedParts(ts, timeZone);
  const wallAsUtc = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute, z.second);
  return (wallAsUtc - ts) / 3_600_000;
}

export function dayOfYear(parts: { year: number; month: number; day: number }): number {
  const start = Date.UTC(parts.year, 0, 1);
  const current = Date.UTC(parts.year, parts.month - 1, parts.day);
  return Math.floor((current - start) / 86_400_000) + 1;
}

export function localHour(ts: number, timeZone: string): number {
  const z = zonedParts(ts, timeZone);
  return z.hour + z.minute / 60 + z.second / 3600;
}

export function startOfZonedDay(ts: number, timeZone: string): number {
  const z = zonedParts(ts, timeZone);
  return zonedTimeToUtc({ year: z.year, month: z.month, day: z.day, hour: 0, minute: 0 }, timeZone);
}

export function addZonedDays(ts: number, timeZone: string, days: number): number {
  const z = zonedParts(ts, timeZone);
  const utc = Date.UTC(z.year, z.month - 1, z.day + days, z.hour, z.minute, z.second);
  const shifted = new Date(utc);
  return zonedTimeToUtc(
    {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour: shifted.getUTCHours(),
      minute: shifted.getUTCMinutes(),
    },
    timeZone,
  );
}

export function formatPlantClock(ts: number, timeZone: string): string {
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ts));
  if (timeZone === "Asia/Manila") return `${time} PHT`;
  const zone =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
      .formatToParts(new Date(ts))
      .find((part) => part.type === "timeZoneName")?.value ?? timeZone;
  return `${time} ${zone}`;
}

export function monthKey(ymd: string): string {
  return ymd.slice(0, 7);
}
