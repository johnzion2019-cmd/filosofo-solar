export type PvStringReading = {
  name: string;
  volts: number | null;
  amps: number | null;
  watts: number | null;
};

export type PvStringSample = {
  pv1V: number | null;
  pv1A: number | null;
  pv1W: number | null;
  pv2V: number | null;
  pv2A: number | null;
  pv2W: number | null;
  pv3V: number | null;
  pv3A: number | null;
  pv3W: number | null;
};

/** Official string watts if present; otherwise V × A. Zero is a real reading, not missing. */
export function stringPowerWatts(
  watts: number | null | undefined,
  volts: number | null | undefined,
  amps: number | null | undefined,
): number | null {
  if (typeof watts === "number" && Number.isFinite(watts)) return watts;
  if (typeof volts === "number" && Number.isFinite(volts) && typeof amps === "number" && Number.isFinite(amps)) {
    return volts * amps;
  }
  return null;
}

/** A string is present when Deye sent any of V, A, or W, including zeros. */
export function hasPvStringData(
  volts: number | null | undefined,
  amps: number | null | undefined,
  watts: number | null | undefined,
): boolean {
  return [volts, amps, watts].some((value) => typeof value === "number" && Number.isFinite(value));
}

export function pvStringsFromSample(sample: PvStringSample): PvStringReading[] {
  const raw = [
    { name: "PV1", volts: sample.pv1V, amps: sample.pv1A, watts: sample.pv1W },
    { name: "PV2", volts: sample.pv2V, amps: sample.pv2A, watts: sample.pv2W },
    { name: "PV3", volts: sample.pv3V, amps: sample.pv3A, watts: sample.pv3W },
  ];
  return raw
    .filter((row) => hasPvStringData(row.volts, row.amps, row.watts))
    .map((row) => ({
      name: row.name,
      volts: row.volts,
      amps: row.amps,
      watts: stringPowerWatts(row.watts, row.volts, row.amps),
    }));
}
