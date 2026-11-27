import type { WeatherSnapshot } from "@/lib/types";

export function weatherLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 95) return "Thunderstorm";
  return "Weather";
}

let cache: { key: string; at: number; value: WeatherSnapshot | null } | null = null;

export async function fetchWeather(lat: number, lon: number, timeZone: string): Promise<WeatherSnapshot | null> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const maxAge = cache?.value ? 10 * 60_000 : 60_000;
  if (cache && cache.key === key && Date.now() - cache.at < maxAge) return cache.value;
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("current", "temperature_2m,weather_code");
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("timezone", timeZone);
    const response = await fetch(url, { signal: AbortSignal.timeout(4000), cache: "no-store" });
    if (!response.ok) throw new Error(`Weather request failed (${response.status})`);
    const body = (await response.json()) as { current?: { temperature_2m?: number; weather_code?: number } };
    const temp = body.current?.temperature_2m;
    if (typeof temp !== "number") throw new Error("Weather response was missing a temperature");
    const code = Number(body.current?.weather_code ?? 0);
    const value = { tempF: temp, code, label: weatherLabel(code) };
    cache = { key, at: Date.now(), value };
    return value;
  } catch {
    cache = { key, at: Date.now(), value: null };
    return null;
  }
}
