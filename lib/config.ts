import { DEFAULT_CYCLE_START_DAY, DEFAULT_DAILY_TARGET_KWH, DEFAULT_TARIFF_PHP } from "@/lib/billing";
import type { DeyeRegion } from "@/lib/deye";
import { getSetting, setSetting, type AppDb } from "@/lib/repo";
import { decryptSecret, encryptSecret, newIngestKey } from "@/lib/secrets";
import { PLANT_DEFAULTS, type AlertRuleConfig, type DataSource } from "@/lib/types";

export type ResolvedConfig = {
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
  nominalHz: number;
  tariffPhp: number;
  billingCycleStartDay: number;
  dailyTargetKwh: number;
  housePhotoCustom: boolean;
  deyeRegion: DeyeRegion;
  deyeBaseUrl: string;
  deyeAppId: string;
  deyeAppSecret: string;
  deyeEmail: string;
  deyePassword: string;
  deyeCompanyId: string;
  deyeStationId: string;
  deyeToken: string;
  deyeTokenObtainedAt: number | null;
  deyeTokenExpiresAt: number | null;
  deyeConfigured: boolean;
  deyeLastError: string | null;
  deyeLastOkAt: number | null;
  pollIntervalSec: number;
  preferredSource: "auto" | DataSource;
  ingestApiKey: string;
  alerts: AlertRuleConfig;
  demoEpochReal: number | null;
  demoEpochVirtual: number | null;
  envLocked: string[];
};

const SECRET_KEYS = new Set(["deye_app_secret", "deye_password", "deye_access_token", "ingest_api_key"]);

function readRaw(db: AppDb, key: string): string {
  const value = getSetting(db, key);
  if (value == null) return "";
  return SECRET_KEYS.has(key) ? decryptSecret(value) : value;
}

function writeRaw(db: AppDb, key: string, value: string): void {
  setSetting(db, key, SECRET_KEYS.has(key) ? encryptSecret(value) : value);
}

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function num(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function ensureDefaults(db: AppDb): void {
  const defaults: Record<string, string> = {
    plant_name: PLANT_DEFAULTS.plantName,
    plant_location: PLANT_DEFAULTS.plantLocation,
    plant_lat: String(PLANT_DEFAULTS.lat),
    plant_lon: String(PLANT_DEFAULTS.lon),
    plant_timezone: PLANT_DEFAULTS.timeZone,
    inverter_sn: PLANT_DEFAULTS.inverterSn,
    inverter_model: PLANT_DEFAULTS.inverterModel,
    inverter_rated_w: String(PLANT_DEFAULTS.ratedW),
    battery_kwh: String(PLANT_DEFAULTS.batteryKwh),
    operating_mode: PLANT_DEFAULTS.operatingMode,
    nominal_hz: String(PLANT_DEFAULTS.nominalHz),
    deye_region: "eu",
    poll_interval_sec: "60",
    preferred_source: "auto",
    alert_low_soc_enabled: "1",
    alert_low_soc_threshold: "20",
    alert_grid_enabled: "1",
    alert_offline_enabled: "1",
    alert_offline_minutes: "15",
    tariff_php: String(DEFAULT_TARIFF_PHP),
    billing_cycle_start_day: String(DEFAULT_CYCLE_START_DAY),
    daily_target_kwh: String(DEFAULT_DAILY_TARGET_KWH),
  };
  const insert = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  const tx = db.transaction(() => {
    for (const [key, value] of Object.entries(defaults)) insert.run(key, value);
    if (!env("INGEST_API_KEY") && !getSetting(db, "ingest_api_key")) {
      writeRaw(db, "ingest_api_key", newIngestKey());
    }
  });
  tx();
}

export function getConfig(db: AppDb): ResolvedConfig {
  const locked: string[] = [];
  const pick = (field: string, key: string, envName: string, fallback = ""): string => {
    const fromEnv = env(envName);
    if (fromEnv) {
      locked.push(field);
      return fromEnv;
    }
    return readRaw(db, key) || fallback;
  };

  const deyeRegion = (pick("deyeRegion", "deye_region", "DEYE_REGION", "eu") || "eu") as DeyeRegion;
  const region: DeyeRegion = deyeRegion === "us" || deyeRegion === "india" || deyeRegion === "custom" ? deyeRegion : "eu";
  const appId = pick("deyeAppId", "deye_app_id", "DEYE_APP_ID");
  const appSecret = pick("deyeAppSecret", "deye_app_secret", "DEYE_APP_SECRET");
  const email = pick("deyeEmail", "deye_email", "DEYE_EMAIL");
  const password = pick("deyePassword", "deye_password", "DEYE_PASSWORD");
  const preferred = pick("preferredSource", "preferred_source", "DATA_SOURCE", "auto");
  const preferredSource: ResolvedConfig["preferredSource"] =
    preferred === "demo" || preferred === "deye" || preferred === "bridge" ? preferred : "auto";

  const pollFromEnv = env("POLL_INTERVAL_SEC");
  if (pollFromEnv) locked.push("pollIntervalSec");

  return {
    plantName: pick("plantName", "plant_name", "", PLANT_DEFAULTS.plantName),
    plantLocation: pick("plantLocation", "plant_location", "", PLANT_DEFAULTS.plantLocation),
    lat: num(pick("lat", "plant_lat", "", String(PLANT_DEFAULTS.lat)), PLANT_DEFAULTS.lat),
    lon: num(pick("lon", "plant_lon", "", String(PLANT_DEFAULTS.lon)), PLANT_DEFAULTS.lon),
    timeZone: pick("timeZone", "plant_timezone", "", PLANT_DEFAULTS.timeZone),
    inverterSn: pick("inverterSn", "inverter_sn", "DEYE_DEVICE_SN", PLANT_DEFAULTS.inverterSn),
    inverterModel: pick("inverterModel", "inverter_model", "", PLANT_DEFAULTS.inverterModel),
    ratedW: num(pick("ratedW", "inverter_rated_w", "", String(PLANT_DEFAULTS.ratedW)), PLANT_DEFAULTS.ratedW),
    batteryKwh: num(pick("batteryKwh", "battery_kwh", "", String(PLANT_DEFAULTS.batteryKwh)), PLANT_DEFAULTS.batteryKwh),
    operatingMode: pick("operatingMode", "operating_mode", "", PLANT_DEFAULTS.operatingMode),
    nominalHz: num(pick("nominalHz", "nominal_hz", "", String(PLANT_DEFAULTS.nominalHz)), PLANT_DEFAULTS.nominalHz),
    tariffPhp: Math.max(0, num(pick("tariffPhp", "tariff_php", "", String(DEFAULT_TARIFF_PHP)), DEFAULT_TARIFF_PHP)),
    billingCycleStartDay: Math.min(28, Math.max(1, Math.round(num(pick("billingCycleStartDay", "billing_cycle_start_day", "", String(DEFAULT_CYCLE_START_DAY)), DEFAULT_CYCLE_START_DAY)))),
    dailyTargetKwh: Math.max(1, num(pick("dailyTargetKwh", "daily_target_kwh", "", String(DEFAULT_DAILY_TARGET_KWH)), DEFAULT_DAILY_TARGET_KWH)),
    housePhotoCustom: readRaw(db, "house_photo") === "custom",
    deyeRegion: region,
    deyeBaseUrl: pick("deyeBaseUrl", "deye_base_url", "DEYE_BASE_URL"),
    deyeAppId: appId,
    deyeAppSecret: appSecret,
    deyeEmail: email,
    deyePassword: password,
    deyeCompanyId: pick("deyeCompanyId", "deye_company_id", "DEYE_COMPANY_ID"),
    deyeStationId: pick("deyeStationId", "deye_station_id", "DEYE_STATION_ID"),
    deyeToken: readRaw(db, "deye_access_token"),
    deyeTokenObtainedAt: num(readRaw(db, "deye_token_obtained_at"), 0) || null,
    deyeTokenExpiresAt: num(readRaw(db, "deye_token_expires_at"), 0) || null,
    deyeConfigured: Boolean(appId && appSecret && email && password),
    deyeLastError: readRaw(db, "deye_last_error") || null,
    deyeLastOkAt: num(readRaw(db, "deye_last_ok_at"), 0) || null,
    pollIntervalSec: Math.min(3600, Math.max(15, num(pollFromEnv || readRaw(db, "poll_interval_sec"), 60))),
    preferredSource,
    ingestApiKey: pick("ingestApiKey", "ingest_api_key", "INGEST_API_KEY"),
    alerts: {
      lowSocEnabled: (pick("alertLowSocEnabled", "alert_low_soc_enabled", "", "1") || "1") !== "0",
      lowSocThreshold: Math.min(100, Math.max(1, num(pick("alertLowSocThreshold", "alert_low_soc_threshold", "", "20"), 20))),
      gridEnabled: (pick("alertGridEnabled", "alert_grid_enabled", "", "1") || "1") !== "0",
      offlineEnabled: (pick("alertOfflineEnabled", "alert_offline_enabled", "", "1") || "1") !== "0",
      offlineMinutes: Math.min(24 * 60, Math.max(1, num(pick("alertOfflineMinutes", "alert_offline_minutes", "", "15"), 15))),
    },
    demoEpochReal: num(readRaw(db, "demo_epoch_real"), 0) || null,
    demoEpochVirtual: num(readRaw(db, "demo_epoch_virtual"), 0) || null,
    envLocked: locked,
  };
}

export type SettingsPatch = {
  plantName?: string;
  plantLocation?: string;
  lat?: number;
  lon?: number;
  timeZone?: string;
  inverterSn?: string;
  inverterModel?: string;
  ratedW?: number;
  batteryKwh?: number;
  operatingMode?: string;
  deyeRegion?: DeyeRegion;
  deyeBaseUrl?: string;
  deyeAppId?: string;
  deyeAppSecret?: string;
  deyeEmail?: string;
  deyePassword?: string;
  deyeCompanyId?: string;
  deyeStationId?: string;
  pollIntervalSec?: number;
  preferredSource?: "auto" | DataSource;
  alertLowSocEnabled?: boolean;
  alertLowSocThreshold?: number;
  alertGridEnabled?: boolean;
  alertOfflineEnabled?: boolean;
  alertOfflineMinutes?: number;
  rotateIngestKey?: boolean;
  tariffPhp?: number;
  billingCycleStartDay?: number;
  dailyTargetKwh?: number;
};

const FIELD_ENV: Record<string, string> = {
  deyeRegion: "DEYE_REGION",
  deyeBaseUrl: "DEYE_BASE_URL",
  deyeAppId: "DEYE_APP_ID",
  deyeAppSecret: "DEYE_APP_SECRET",
  deyeEmail: "DEYE_EMAIL",
  deyePassword: "DEYE_PASSWORD",
  deyeCompanyId: "DEYE_COMPANY_ID",
  deyeStationId: "DEYE_STATION_ID",
  inverterSn: "DEYE_DEVICE_SN",
  pollIntervalSec: "POLL_INTERVAL_SEC",
  preferredSource: "DATA_SOURCE",
  ingestApiKey: "INGEST_API_KEY",
};

export function applySettings(db: AppDb, patch: SettingsPatch): void {
  const current = getConfig(db);
  const locked = new Set(current.envLocked);
  const write = (field: string, key: string, value: string) => {
    if (locked.has(field) || FIELD_ENV[field] && env(FIELD_ENV[field])) return;
    writeRaw(db, key, value);
  };
  if (patch.plantName != null) write("plantName", "plant_name", patch.plantName.trim() || PLANT_DEFAULTS.plantName);
  if (patch.plantLocation != null) write("plantLocation", "plant_location", patch.plantLocation.trim() || PLANT_DEFAULTS.plantLocation);
  if (patch.lat != null && Number.isFinite(patch.lat)) write("lat", "plant_lat", String(patch.lat));
  if (patch.lon != null && Number.isFinite(patch.lon)) write("lon", "plant_lon", String(patch.lon));
  if (patch.timeZone != null && patch.timeZone.trim()) write("timeZone", "plant_timezone", patch.timeZone.trim());
  if (patch.inverterSn != null) write("inverterSn", "inverter_sn", patch.inverterSn.trim() || PLANT_DEFAULTS.inverterSn);
  if (patch.inverterModel != null) write("inverterModel", "inverter_model", patch.inverterModel.trim() || PLANT_DEFAULTS.inverterModel);
  if (patch.ratedW != null && patch.ratedW > 0) write("ratedW", "inverter_rated_w", String(patch.ratedW));
  if (patch.batteryKwh != null && patch.batteryKwh > 0) write("batteryKwh", "battery_kwh", String(patch.batteryKwh));
  if (patch.operatingMode != null && patch.operatingMode.trim()) write("operatingMode", "operating_mode", patch.operatingMode.trim());
  if (patch.deyeRegion != null) write("deyeRegion", "deye_region", patch.deyeRegion);
  if (patch.deyeBaseUrl != null) write("deyeBaseUrl", "deye_base_url", patch.deyeBaseUrl.trim());
  if (patch.deyeAppId != null) write("deyeAppId", "deye_app_id", patch.deyeAppId.trim());
  if (patch.deyeAppSecret) write("deyeAppSecret", "deye_app_secret", patch.deyeAppSecret.trim());
  if (patch.deyeEmail != null) write("deyeEmail", "deye_email", patch.deyeEmail.trim());
  if (patch.deyePassword) write("deyePassword", "deye_password", patch.deyePassword);
  if (patch.deyeCompanyId != null) write("deyeCompanyId", "deye_company_id", patch.deyeCompanyId.trim());
  if (patch.deyeStationId != null) write("deyeStationId", "deye_station_id", patch.deyeStationId.trim());
  if (patch.pollIntervalSec != null) {
    write("pollIntervalSec", "poll_interval_sec", String(Math.min(3600, Math.max(15, Math.round(patch.pollIntervalSec)))));
  }
  if (patch.preferredSource != null) write("preferredSource", "preferred_source", patch.preferredSource);
  if (patch.alertLowSocEnabled != null) write("alertLowSocEnabled", "alert_low_soc_enabled", patch.alertLowSocEnabled ? "1" : "0");
  if (patch.alertLowSocThreshold != null) {
    write("alertLowSocThreshold", "alert_low_soc_threshold", String(Math.min(100, Math.max(1, patch.alertLowSocThreshold))));
  }
  if (patch.alertGridEnabled != null) write("alertGridEnabled", "alert_grid_enabled", patch.alertGridEnabled ? "1" : "0");
  if (patch.alertOfflineEnabled != null) write("alertOfflineEnabled", "alert_offline_enabled", patch.alertOfflineEnabled ? "1" : "0");
  if (patch.alertOfflineMinutes != null) {
    write("alertOfflineMinutes", "alert_offline_minutes", String(Math.min(1440, Math.max(1, Math.round(patch.alertOfflineMinutes)))));
  }
  if (patch.rotateIngestKey && !env("INGEST_API_KEY")) writeRaw(db, "ingest_api_key", newIngestKey());
  if (patch.tariffPhp != null && Number.isFinite(patch.tariffPhp)) write("tariffPhp", "tariff_php", String(Math.max(0, patch.tariffPhp)));
  if (patch.billingCycleStartDay != null && Number.isFinite(patch.billingCycleStartDay)) {
    write("billingCycleStartDay", "billing_cycle_start_day", String(Math.min(28, Math.max(1, Math.round(patch.billingCycleStartDay)))));
  }
  if (patch.dailyTargetKwh != null && patch.dailyTargetKwh > 0) write("dailyTargetKwh", "daily_target_kwh", String(patch.dailyTargetKwh));
}

export function saveDeyeToken(db: AppDb, token: string, obtainedAt: number, expiresAt: number): void {
  writeRaw(db, "deye_access_token", token);
  setSetting(db, "deye_token_obtained_at", String(obtainedAt));
  setSetting(db, "deye_token_expires_at", String(expiresAt));
}

export function saveDeyeStatus(db: AppDb, ok: boolean, error: string | null): void {
  if (ok) {
    setSetting(db, "deye_last_ok_at", String(Date.now()));
    setSetting(db, "deye_last_error", "");
  } else {
    setSetting(db, "deye_last_error", error || "Deye Cloud request failed");
  }
}

export function publicSettings(cfg: ResolvedConfig) {
  return {
    plantName: cfg.plantName,
    plantLocation: cfg.plantLocation,
    lat: cfg.lat,
    lon: cfg.lon,
    timeZone: cfg.timeZone,
    inverterSn: cfg.inverterSn,
    inverterModel: cfg.inverterModel,
    ratedW: cfg.ratedW,
    batteryKwh: cfg.batteryKwh,
    operatingMode: cfg.operatingMode,
    deyeRegion: cfg.deyeRegion,
    deyeBaseUrl: cfg.deyeBaseUrl,
    deyeAppId: cfg.deyeAppId,
    deyeEmail: cfg.deyeEmail,
    deyeCompanyId: cfg.deyeCompanyId,
    deyeStationId: cfg.deyeStationId,
    hasAppSecret: Boolean(cfg.deyeAppSecret),
    hasPassword: Boolean(cfg.deyePassword),
    hasToken: Boolean(cfg.deyeToken),
    tokenObtainedAt: cfg.deyeTokenObtainedAt,
    deyeConfigured: cfg.deyeConfigured,
    deyeLastError: cfg.deyeLastError,
    deyeLastOkAt: cfg.deyeLastOkAt,
    pollIntervalSec: cfg.pollIntervalSec,
    preferredSource: cfg.preferredSource,
    ingestApiKey: cfg.ingestApiKey,
    alerts: cfg.alerts,
    tariffPhp: cfg.tariffPhp,
    billingCycleStartDay: cfg.billingCycleStartDay,
    dailyTargetKwh: cfg.dailyTargetKwh,
    housePhotoCustom: cfg.housePhotoCustom,
    envLocked: cfg.envLocked,
    pinEnabled: Boolean(process.env.APP_PIN),
  };
}
