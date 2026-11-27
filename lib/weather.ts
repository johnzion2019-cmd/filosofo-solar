import { buildForecastDay, buildSolarForecast, type SolarForecast } from "@/lib/forecast";
import type { WeatherSnapshot } from "@/lib/types";

export function weatherLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code >= 45 && code <= 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 95) return "Thunderstorm";
  return "Weather";
}

export type PlantWeather = {
  current: WeatherSnapshot | null;
  forecast: SolarForecast | null;
};

const CACHE_MS = 30 * 60_000;
const FAILED_CACHE_MS = 5 * 60_000;

type WeatherCache = { key: string; at: number; value: PlantWeather };

function weatherStore(): { cache: WeatherCache | null } {
  const globalState = globalThis as typeof globalThis & { __filosofoWeather?: { cache: WeatherCache | null } };
  if (!globalState.__filosofoWeather) globalState.__filosofoWeather = { cache: null };
  return globalState.__filosofoWeather;
}

function num(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dailyValue(block: Record<string, unknown> | undefined, key: string, index: number): number | null {
  const series = block?.[key];
  if (!Array.isArray(series)) return null;
  return num(series[index]);
}

export function parsePlantWeather(body: {
  current?: { temperature_2m?: number; weather_code?: number };
  daily?: Record<string, unknown>;
}): PlantWeather {
  const temp = body.current?.temperature_2m;
  const current: WeatherSnapshot | null =
    typeof temp === "number"
      ? { tempF: temp, code: Number(body.current?.weather_code ?? 0), label: weatherLabel(Number(body.current?.weather_code ?? 0)) }
      : null;

  const daily = body.daily;
  const days = Array.isArray(daily?.time) ? (daily.time as unknown[]) : [];
  const parsed = days.slice(0, 2).map((ymd, index) => {
    const code = dailyValue(daily, "weather_code", index) ?? 2;
    return buildForecastDay({
      ymd: String(ymd),
      shortwaveMj: dailyValue(daily, "shortwave_radiation_sum", index),
      cloudCoverPct: dailyValue(daily, "cloud_cover_mean", index),
      weatherCode: code,
      label: weatherLabel(code),
      tempMaxF: dailyValue(daily, "temperature_2m_max", index),
      tempMinF: dailyValue(daily, "temperature_2m_min", index),
    });
  });
  const forecast = parsed.length >= 2 ? buildSolarForecast(parsed[0], parsed[1]) : parsed.length === 1 ? buildSolarForecast(parsed[0], parsed[0]) : null;
  return { current, forecast };
}

export function openMeteoForecastUrl(lat: number, lon: number, timeZone: string): string {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set("daily", "shortwave_radiation_sum,cloud_cover_mean,weather_code,temperature_2m_max,temperature_2m_min");
  url.searchParams.set("forecast_days", "3");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("timezone", timeZone);
  return url.toString();
}

export async function fetchPlantWeather(lat: number, lon: number, timeZone: string): Promise<PlantWeather> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)},${timeZone}`;
  const store = weatherStore();
  const cache = store.cache;
  const hasData = Boolean(cache?.value.current || cache?.value.forecast);
  const maxAge = hasData ? CACHE_MS : FAILED_CACHE_MS;
  if (cache && cache.key === key && Date.now() - cache.at < maxAge) return cache.value;
  try {
    const response = await fetch(openMeteoForecastUrl(lat, lon, timeZone), {
      headers: { "User-Agent": "FilosofoSolar/1.0 (+https://filosofo-solar.onrender.com)" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Weather request failed (${response.status})`);
    const value = parsePlantWeather((await response.json()) as { current?: { temperature_2m?: number; weather_code?: number }; daily?: Record<string, unknown> });
    store.cache = { key, at: Date.now(), value };
    return value;
  } catch (error) {
    console.error("Open-Meteo weather/forecast fetch failed:", error);
    const fallback = cache && cache.key === key && (cache.value.current || cache.value.forecast) ? cache.value : { current: null, forecast: null };
    store.cache = { key, at: Date.now(), value: fallback };
    return fallback;
  }
}

export async function fetchWeather(lat: number, lon: number, timeZone: string): Promise<WeatherSnapshot | null> {
  const weather = await fetchPlantWeather(lat, lon, timeZone);
  return weather.current;
}
