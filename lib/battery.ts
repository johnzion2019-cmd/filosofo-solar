export const DEFAULT_BATTERY_RESERVE_SOC = 20;
export const DISCHARGE_W_THRESHOLD = 30;

export type BatteryRuntimeState = "discharging" | "charging" | "standby" | "at-reserve";

export type BatteryRuntime = {
  state: BatteryRuntimeState;
  reserveSoc: number;
  remainingKwh: number;
  neededKwh: number;
  hoursToReserve: number | null;
  hoursToFull: number | null;
  label: string;
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function formatHours(hours: number): string {
  if (!Number.isFinite(hours) || hours < 0) return "~0.0 hrs";
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(hours * 60));
    return `~${minutes} min`;
  }
  return `~${hours.toFixed(1)} hrs`;
}

export function estimateBatteryRuntime(input: {
  batteryKwh: number;
  soc: number;
  batteryW: number;
  reserveSoc?: number;
}): BatteryRuntime {
  const batteryKwh = Math.max(0, Number.isFinite(input.batteryKwh) ? input.batteryKwh : 0);
  const soc = clamp(input.soc, 0, 100);
  const reserveSoc = clamp(input.reserveSoc ?? DEFAULT_BATTERY_RESERVE_SOC, 0, 90);
  const batteryW = Number.isFinite(input.batteryW) ? input.batteryW : 0;
  const remainingKwh = Math.max(0, (batteryKwh * (soc - reserveSoc)) / 100);
  const neededKwh = Math.max(0, (batteryKwh * (100 - soc)) / 100);

  if (batteryW > DISCHARGE_W_THRESHOLD) {
    if (soc <= reserveSoc) {
      return {
        state: "at-reserve",
        reserveSoc,
        remainingKwh: 0,
        neededKwh,
        hoursToReserve: 0,
        hoursToFull: null,
        label: "At reserve",
      };
    }
    const hoursToReserve = remainingKwh / (batteryW / 1000);
    return {
      state: "discharging",
      reserveSoc,
      remainingKwh,
      neededKwh,
      hoursToReserve,
      hoursToFull: null,
      label: `${formatHours(hoursToReserve)} left until ${Math.round(reserveSoc)}%`,
    };
  }

  if (batteryW < -DISCHARGE_W_THRESHOLD) {
    if (neededKwh <= 0) {
      return {
        state: "charging",
        reserveSoc,
        remainingKwh,
        neededKwh: 0,
        hoursToReserve: null,
        hoursToFull: 0,
        label: "Full",
      };
    }
    const hoursToFull = neededKwh / (Math.abs(batteryW) / 1000);
    return {
      state: "charging",
      reserveSoc,
      remainingKwh,
      neededKwh,
      hoursToReserve: null,
      hoursToFull,
      label: `${formatHours(hoursToFull)} to full`,
    };
  }

  return {
    state: "standby",
    reserveSoc,
    remainingKwh,
    neededKwh,
    hoursToReserve: null,
    hoursToFull: null,
    label: "Standby",
  };
}
