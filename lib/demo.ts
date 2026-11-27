import { PLANT_DEFAULTS, type Sample } from "@/lib/types";
import { dayOfYear, localHour, timezoneOffsetHours, zonedParts, zonedTimeToUtc } from "@/lib/time";

export const SHOWCASE_HOUR = 11;
export const SHOWCASE_MINUTE = 15;
export const RESERVE_SOC = 12;
export const MAX_CHARGE_W = 1400;
export const MAX_DISCHARGE_W = 3500;

export type SimConfig = {
  timeZone: string;
  lat: number;
  lon: number;
  ratedW: number;
  batteryKwh: number;
  operatingMode: string;
  nominalHz: number;
};

export const FILOSOFO_SIM: SimConfig = {
  timeZone: PLANT_DEFAULTS.timeZone,
  lat: PLANT_DEFAULTS.lat,
  lon: PLANT_DEFAULTS.lon,
  ratedW: PLANT_DEFAULTS.ratedW,
  batteryKwh: PLANT_DEFAULTS.batteryKwh,
  operatingMode: PLANT_DEFAULTS.operatingMode,
  nominalHz: PLANT_DEFAULTS.nominalHz,
};

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function hash01(n: number): number {
  let x = n >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 4294967296;
}

function gauss(x: number, center: number, width: number): number {
  const d = (x - center) / width;
  return Math.exp(-d * d);
}

export function cloudFactor(ymd: string, hour: number): number {
  const dayHash = hashString(ymd);
  const rainy = dayHash % 7 === 3;
  const at = (h: number) => {
    const hh = ((Math.floor(h) % 24) + 24) % 24;
    const n = hash01(dayHash ^ Math.imul(hh + 1, 997));
    return rainy ? 0.18 + n * 0.32 : 0.62 + n * 0.38;
  };
  const h0 = Math.floor(hour);
  const frac = hour - h0;
  const smooth = frac * frac * (3 - 2 * frac);
  return at(h0) * (1 - smooth) + at(h0 + 1) * smooth;
}

export function isOutage(ymd: string, hour: number): boolean {
  if (hashString(ymd) % 9 !== 2) return false;
  return hour >= 18.1 && hour < 19.05;
}

export function pvPowerW(ts: number, cfg: SimConfig): number {
  if (cfg.ratedW <= 0) return 0;
  const parts = zonedParts(ts, cfg.timeZone);
  const hour = localHour(ts, cfg.timeZone);
  const declDeg = 23.44 * Math.sin((2 * Math.PI * (dayOfYear(parts) - 81)) / 365);
  const lat = (cfg.lat * Math.PI) / 180;
  const dec = (declDeg * Math.PI) / 180;
  const offset = timezoneOffsetHours(ts, cfg.timeZone);
  const solarNoon = 12 - cfg.lon / 15 + offset;
  const hourAngle = ((hour - solarNoon) * 15 * Math.PI) / 180;
  const sinElev = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle);
  if (sinElev <= 0.02) return 0;
  const sinNoon = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec);
  if (sinNoon <= 0.05) return 0;
  const clear = cloudFactor(parts.ymd, hour);
  const wobble = 0.97 + hash01(Math.floor(ts / 60_000)) * 0.06;
  return Math.max(0, Math.min(cfg.ratedW, cfg.ratedW * (sinElev / sinNoon) * clear * wobble * 0.97));
}

export function loadPowerW(ts: number, cfg: SimConfig): number {
  const parts = zonedParts(ts, cfg.timeZone);
  const hour = localHour(ts, cfg.timeZone);
  const dayScale = 0.92 + hash01(hashString(parts.ymd)) * 0.16;
  const wobble = 0.94 + hash01((Math.floor(ts / 60_000) ^ 0x9e3779b9) >>> 0) * 0.1;
  const heavy = hash01(hashString(`${parts.ymd}:load`)) > 0.9;
  const base =
    340 +
    520 * gauss(hour, 7.1, 1.15) +
    240 * gauss(hour, 12.4, 2.3) +
    920 * gauss(hour, 19.25, 1.65) +
    (heavy ? 780 * gauss(hour, 20.1, 1.4) : 0);
  return Math.max(180, base * dayScale * wobble);
}

export type StepResult = {
  sample: Sample;
  soc: number;
  curtailed: boolean;
};

export function simulateStep(ts: number, socIn: number, dtHours: number, cfg: SimConfig): StepResult {
  const dt = dtHours > 0 ? dtHours : 0.25;
  const parts = zonedParts(ts, cfg.timeZone);
  const hour = localHour(ts, cfg.timeZone);
  const pvW = pvPowerW(ts, cfg);
  const demandW = loadPowerW(ts, cfg);
  const capacityWh = Math.max(0.1, cfg.batteryKwh * 1000);
  const soc = Math.min(100, Math.max(0, socIn));
  const outage = isOutage(parts.ymd, hour);
  const net = pvW - demandW;
  const roomWh = Math.max(0, ((100 - soc) / 100) * capacityWh);
  const availWh = Math.max(0, ((soc - RESERVE_SOC) / 100) * capacityWh);
  const roomW = roomWh / dt;
  const availW = availWh / dt;

  let batteryW = 0;
  let gridW = 0;
  let loadW = demandW;
  let curtailed = false;

  if (net >= 0) {
    const charge = Math.min(net, MAX_CHARGE_W, roomW);
    batteryW = -charge;
    if (outage) {
      gridW = 0;
      curtailed = net - charge > 15;
    } else {
      gridW = -(net - charge);
    }
  } else {
    const need = -net;
    const discharge = Math.min(need, MAX_DISCHARGE_W, availW);
    batteryW = discharge;
    if (outage) {
      gridW = 0;
      if (need - discharge > 15) {
        loadW = pvW + discharge;
        curtailed = true;
      }
    } else {
      gridW = need - discharge;
    }
  }

  const nextSoc = Math.min(100, Math.max(0, soc + (-batteryW * dt * 100) / capacityWh));
  const gridStatus = outage ? "off-grid" : "on-grid";
  const irr = cfg.ratedW > 0 ? Math.min(1, pvW / cfg.ratedW) : 0;
  const pv1W = pvW * 0.54;
  const pv2W = pvW * 0.46;
  const pv1V = pvW < 8 ? 0 : 286 + irr * 92;
  const pv2V = pvW < 8 ? 0 : 280 + irr * 90;
  const batteryV = 49.2 + (nextSoc / 100) * 5.4;
  const batteryA = batteryV > 0 ? batteryW / batteryV : 0;
  const acV = outage ? (loadW > 40 ? 228.5 : 0) : 229.4 + hash01(Math.floor(ts / 60_000)) * 1.6;
  const acHz = loadW > 40 || !outage ? cfg.nominalHz + (hash01(Math.floor(ts / 30_000)) - 0.5) * 0.04 : 0;

  const sample: Sample = {
    ts,
    source: "demo",
    pvW,
    pv1V,
    pv1A: pv1V > 0 ? pv1W / pv1V : 0,
    pv1W,
    pv2V,
    pv2A: pv2V > 0 ? pv2W / pv2V : 0,
    pv2W,
    loadW,
    gridW,
    gridStatus,
    batteryW,
    batterySoc: nextSoc,
    batteryV,
    batteryA,
    batteryTemp: 28.5 + Math.min(12, Math.abs(batteryW) / 450),
    acV,
    acHz,
    inverterTemp: 32 + irr * 18 + Math.min(8, loadW / 700),
    upsW: Math.min(loadW, 18 + hash01(Math.floor(ts / 60_000) ^ 0x51) * 28),
    operatingMode: cfg.operatingMode,
    online: true,
  };

  return { sample, soc: nextSoc, curtailed };
}

export function chooseDemoClock(
  realNow: number,
  timeZone: string,
): { virtualNow: number; showcase: boolean } {
  const parts = zonedParts(realNow, timeZone);
  const hour = localHour(realNow, timeZone);
  if (hour >= 7 && hour <= 17) return { virtualNow: realNow, showcase: false };
  return {
    virtualNow: zonedTimeToUtc(
      {
        year: parts.year,
        month: parts.month,
        day: parts.day,
        hour: SHOWCASE_HOUR,
        minute: SHOWCASE_MINUTE,
      },
      timeZone,
    ),
    showcase: true,
  };
}

export function demoNow(realNow: number, epochReal: number, epochVirtual: number): number {
  return epochVirtual + (realNow - epochReal);
}
