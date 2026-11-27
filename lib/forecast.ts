/** Effective array size that maps a 20 MJ/m² Negros Oriental day to ~51 kWh (mid 45–55). */
export const EFFECTIVE_ARRAY_KW = 9.2;

export type ForecastDay = {
  ymd: string;
  shortwaveMj: number | null;
  cloudCoverPct: number | null;
  weatherCode: number;
  label: string;
  tempMaxF: number | null;
  tempMinF: number | null;
  estKwh: number;
};

export type SolarForecast = {
  today: ForecastDay;
  tomorrow: ForecastDay;
  tip: string;
};

export function estimateGenerationKwh(shortwaveMj: number, effectiveKw = EFFECTIVE_ARRAY_KW): number {
  if (!Number.isFinite(shortwaveMj) || shortwaveMj <= 0) return 0;
  const peakSunHours = shortwaveMj / 3.6;
  return Math.round(peakSunHours * effectiveKw * 10) / 10;
}

export function estimateFromSky(weatherCode: number, cloudCoverPct: number | null, effectiveKw = EFFECTIVE_ARRAY_KW): number {
  const cloud = cloudCoverPct == null ? skyCloudFallback(weatherCode) : Math.min(100, Math.max(0, cloudCoverPct));
  // A clear Negros Oriental day is about 20–22 MJ/m²; scale down with cloud cover.
  const clearMj = 21;
  const mj = clearMj * (1 - 0.75 * (cloud / 100));
  return estimateGenerationKwh(mj, effectiveKw);
}

function skyCloudFallback(code: number): number {
  if (code === 0) return 10;
  if (code === 1) return 25;
  if (code === 2) return 50;
  if (code === 3) return 85;
  if (code >= 51) return 90;
  return 60;
}

export function forecastTip(today: ForecastDay, tomorrow: ForecastDay): string {
  const rainy = (code: number) => (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
  const sunny = (day: ForecastDay) => day.estKwh >= 45 && day.weatherCode <= 1 && (day.cloudCoverPct ?? 0) <= 35;
  const cloudy = (day: ForecastDay) => day.estKwh < 35 || day.weatherCode >= 3 || (day.cloudCoverPct ?? 0) >= 60;

  if (rainy(tomorrow.weatherCode) || rainy(today.weatherCode)) {
    return "Rain in the forecast — conserve battery overnight";
  }
  if (sunny(tomorrow)) {
    return "Sunny tomorrow — expect strong recharge";
  }
  if (cloudy(tomorrow)) {
    return "Cloudy — conserve battery overnight";
  }
  if (tomorrow.estKwh >= 40) {
    return "A solid solar day ahead — good for a full recharge";
  }
  return "A mixed sky ahead — keep an eye on the reserve";
}

export function buildForecastDay(input: {
  ymd: string;
  shortwaveMj: number | null;
  cloudCoverPct: number | null;
  weatherCode: number;
  label: string;
  tempMaxF: number | null;
  tempMinF: number | null;
}): ForecastDay {
  const weatherCode = Number.isFinite(input.weatherCode) ? input.weatherCode : 2;
  const estKwh =
    input.shortwaveMj != null && input.shortwaveMj > 0
      ? estimateGenerationKwh(input.shortwaveMj)
      : estimateFromSky(weatherCode, input.cloudCoverPct);
  return {
    ymd: input.ymd,
    shortwaveMj: input.shortwaveMj,
    cloudCoverPct: input.cloudCoverPct,
    weatherCode,
    label: input.label,
    tempMaxF: input.tempMaxF,
    tempMinF: input.tempMinF,
    estKwh,
  };
}

export function buildSolarForecast(today: ForecastDay, tomorrow: ForecastDay): SolarForecast {
  return { today, tomorrow, tip: forecastTip(today, tomorrow) };
}
