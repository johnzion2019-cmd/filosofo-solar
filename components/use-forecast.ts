"use client";

import { useEffect, useState } from "react";
import type { SolarForecast } from "@/lib/forecast";
import { openMeteoForecastUrl, parsePlantWeather } from "@/lib/weather";

export function useForecast(
  serverForecast: SolarForecast | null | undefined,
  plant: { lat: number; lon: number; timeZone: string } | null,
): SolarForecast | null {
  const [forecast, setForecast] = useState<SolarForecast | null>(serverForecast ?? null);
  const lat = plant?.lat;
  const lon = plant?.lon;
  const timeZone = plant?.timeZone;

  useEffect(() => {
    if (serverForecast) {
      setForecast(serverForecast);
      return;
    }
    if (lat == null || lon == null || !timeZone) return;
    const key = `filosofo-forecast:${lat.toFixed(4)},${lon.toFixed(4)}`;
    const now = Date.now();
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw) as { at: number; forecast: SolarForecast };
        if (now - saved.at < 30 * 60_000 && saved.forecast) {
          setForecast(saved.forecast);
          return;
        }
      }
    } catch {
      // Ignore storage issues and fetch a fresh forecast.
    }
    const controller = new AbortController();
    void fetch(openMeteoForecastUrl(lat, lon, timeZone), { signal: controller.signal, cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`Weather request failed (${response.status})`);
        return response.json();
      })
      .then((body) => {
        const parsed = parsePlantWeather(body).forecast;
        if (!parsed) return;
        setForecast(parsed);
        try {
          sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), forecast: parsed }));
        } catch {
          // Ignore storage quota issues.
        }
      })
      .catch(() => {
        // Leave the server value (usually null) in place.
      });
    return () => controller.abort();
  }, [serverForecast, lat, lon, timeZone]);

  return serverForecast ?? forecast;
}
