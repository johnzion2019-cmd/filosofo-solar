export type DataSource = "demo" | "deye" | "bridge";

export type GridStatus = "on-grid" | "off-grid";

export type Sample = {
  ts: number;
  source: DataSource;
  pvW: number;
  pv1V: number | null;
  pv1A: number | null;
  pv1W: number | null;
  pv2V: number | null;
  pv2A: number | null;
  pv2W: number | null;
  loadW: number;
  upsW: number;
  gridW: number;
  gridStatus: GridStatus;
  batteryW: number;
  batterySoc: number;
  batteryV: number | null;
  batteryA: number | null;
  batteryTemp: number | null;
  acV: number | null;
  acHz: number | null;
  inverterTemp: number | null;
  operatingMode: string;
  online: boolean;
};

export type EnergyTotals = {
  productionKwh: number;
  loadKwh: number;
  chargeKwh: number;
  dischargeKwh: number;
  importKwh: number;
  exportKwh: number;
  socClose: number | null;
};

export type AlertRuleId = "low-soc" | "grid-outage" | "inverter-offline";

export type AlertDraft = {
  ts: number;
  rule: AlertRuleId;
  severity: "warning" | "critical";
  message: string;
};

export type AlertRuleConfig = {
  lowSocEnabled: boolean;
  lowSocThreshold: number;
  gridEnabled: boolean;
  offlineEnabled: boolean;
  offlineMinutes: number;
};

export type WeatherSnapshot = {
  tempF: number;
  code: number;
  label: string;
};

export const PLANT_DEFAULTS = {
  plantName: "Filosofo",
  plantLocation: "Negros Oriental",
  lat: 9.3068,
  lon: 123.3054,
  timeZone: "Asia/Manila",
  inverterSn: "2508073177",
  inverterModel: "SUN-5K-SG04LP1",
  ratedW: 5000,
  batteryKwh: 10.24,
  operatingMode: "Manual Mode",
  nominalHz: 60,
} as const;
