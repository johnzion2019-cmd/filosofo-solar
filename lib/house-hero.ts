import { localHour } from "@/lib/time";

/** Daylight for the house hero: 6:00 AM–4:59 PM, twilight/night 5:00 PM–5:59 AM (Asia/Manila). */
export const HERO_DAY_START_HOUR = 6;
export const HERO_DAY_END_HOUR = 17;

export type HeroPeriod = "day" | "night";

export function plantHeroPeriod(ts: number, timeZone = "Asia/Manila"): HeroPeriod {
  const hour = localHour(ts, timeZone);
  return hour >= HERO_DAY_START_HOUR && hour < HERO_DAY_END_HOUR ? "day" : "night";
}
