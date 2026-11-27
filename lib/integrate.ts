import type { EnergyTotals, Sample } from "@/lib/types";

export function integrateSamples(samples: Pick<Sample, "ts" | "pvW" | "loadW" | "batteryW" | "gridW" | "batterySoc">[], until?: number): EnergyTotals {
  let production = 0;
  let load = 0;
  let charge = 0;
  let discharge = 0;
  let imported = 0;
  let exported = 0;

  const add = (point: (typeof samples)[number], dtHours: number) => {
    if (dtHours <= 0 || dtHours > 2) return;
    production += point.pvW * dtHours;
    load += point.loadW * dtHours;
    if (point.batteryW < 0) charge += -point.batteryW * dtHours;
    else discharge += point.batteryW * dtHours;
    if (point.gridW > 0) imported += point.gridW * dtHours;
    else exported += -point.gridW * dtHours;
  };

  for (let i = 1; i < samples.length; i += 1) {
    add(samples[i - 1], (samples[i].ts - samples[i - 1].ts) / 3_600_000);
  }
  if (until != null && samples.length > 0) {
    const last = samples[samples.length - 1];
    add(last, (until - last.ts) / 3_600_000);
  }

  return {
    productionKwh: production / 1000,
    loadKwh: load / 1000,
    chargeKwh: charge / 1000,
    dischargeKwh: discharge / 1000,
    importKwh: imported / 1000,
    exportKwh: exported / 1000,
    socClose: samples.length ? samples[samples.length - 1].batterySoc : null,
  };
}

export function emptyEnergy(): EnergyTotals {
  return {
    productionKwh: 0,
    loadKwh: 0,
    chargeKwh: 0,
    dischargeKwh: 0,
    importKwh: 0,
    exportKwh: 0,
    socClose: null,
  };
}
