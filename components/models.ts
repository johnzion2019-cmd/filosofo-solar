import type { BatteryRuntime } from "@/lib/battery";
import type { EarningsReport } from "@/lib/earnings";
import type { Payback } from "@/lib/payback";
import type { DataSource, EnergyTotals, GridStatus, Sample, WeatherSnapshot } from "@/lib/types";

export type DashboardData = {
  mode: DataSource;
  plant: { name: string; location: string; lat: number; lon: number; timeZone: string };
  inverter: { serial: string; model: string; ratedW: number; batteryKwh: number };
  updatedAt: number | null;
  clockNow: number;
  simulatedClock: boolean;
  clockLabel: string;
  clockNote: string | null;
  weather: WeatherSnapshot | null;
  operatingMode: string;
  gridStatus: GridStatus | null;
  unreadAlerts: number;
  deyeConfigured: boolean;
  deyeLastError: string | null;
  pinEnabled: boolean;
  live: Sample | null;
  today: EnergyTotals;
  tariffPhp: number;
  dailyTargetKwh: number;
  co2Kg: number;
  selfConsumptionPct: number;
  directKwh: number;
  todaySavingsPhp: number;
  earnings: EarningsReport;
  batteryRuntime: BatteryRuntime;
  payback: Payback;
  peak: { w: number; ts: number };
  cycle: {
    label: string;
    tariffPhp: number;
    daysElapsed: number;
    daysTotal: number;
    generatedKwh: number;
    importKwh: number;
    savingsPhp: number;
    billPhp: number;
    projectedBillPhp: number;
    avgImportKwhPerDay: number;
    progressPct: number;
  };
  series: { ts: number; label: string; solarKw: number; loadKw: number; soc: number }[];
  housePhotoUrl: string;
};

export type SettingsData = {
  plantName: string;
  plantLocation: string;
  lat: number;
  lon: number;
  timeZone: string;
  inverterSn: string;
  inverterModel: string;
  ratedW: number;
  batteryKwh: number;
  operatingMode: string;
  deyeRegion: "eu" | "us" | "india" | "custom";
  deyeBaseUrl: string;
  deyeAppId: string;
  deyeEmail: string;
  deyeCompanyId: string;
  deyeStationId: string;
  hasAppSecret: boolean;
  hasPassword: boolean;
  hasToken: boolean;
  tokenObtainedAt: number | null;
  deyeConfigured: boolean;
  deyeLastError: string | null;
  deyeLastOkAt: number | null;
  pollIntervalSec: number;
  preferredSource: "auto" | DataSource;
  ingestApiKey: string;
  alerts: {
    lowSocEnabled: boolean;
    lowSocThreshold: number;
    gridEnabled: boolean;
    offlineEnabled: boolean;
    offlineMinutes: number;
  };
  envLocked: string[];
  pinEnabled: boolean;
  tariffPhp: number;
  billingCycleStartDay: number;
  dailyTargetKwh: number;
  batteryReserveSoc: number;
  systemCostPhp: number;
  housePhotoCustom: boolean;
  mode: DataSource;
};

export type AlertItem = {
  id: number;
  ts: number;
  source: DataSource;
  rule: string;
  severity: "warning" | "critical";
  message: string;
  acknowledged: boolean;
};

export type HistoryPoint = {
  ts: number;
  label: string;
  pv: number;
  load: number;
  grid: number;
  battery: number;
  soc: number | null;
};

export type HistoryData = {
  range: "today" | "7d" | "30d" | "year";
  unit: "kW" | "kWh";
  source: DataSource;
  points: HistoryPoint[];
};
