import { applySettings, getConfig, saveDeyeStatus, saveDeyeToken, type ResolvedConfig } from "@/lib/config";
import {
  DeyeClient,
  DeyeError,
  dailyEnergyFromDeye,
  parseDeviceHistory,
  parseStationHistory,
  sampleFromDeye,
  stationDailyHistoryRange,
  type DeyeCredentials,
  type DeyeDevice,
  type DeyeStation,
  type StoredToken,
} from "@/lib/deye";
import { errorMessage } from "@/lib/utils";
import { insertSnapshot, insertSnapshots, upsertEnergy } from "@/lib/repo";
import { recomputeDay, runAlerts } from "@/lib/runtime";
import { zonedParts } from "@/lib/time";
import type { Sample } from "@/lib/types";
import type { AppDb } from "@/lib/repo";

function clientFor(db: AppDb, cfg: ResolvedConfig, override?: Partial<DeyeCredentials>): DeyeClient {
  let stored: StoredToken | null =
    !override && cfg.deyeToken
      ? { token: cfg.deyeToken, obtainedAt: cfg.deyeTokenObtainedAt ?? 0, expiresAt: cfg.deyeTokenExpiresAt ?? 0 }
      : null;
  const credentials: DeyeCredentials = {
    region: override?.region ?? cfg.deyeRegion,
    baseUrl: override?.baseUrl ?? cfg.deyeBaseUrl,
    appId: override?.appId ?? cfg.deyeAppId,
    appSecret: override?.appSecret || cfg.deyeAppSecret,
    email: override?.email ?? cfg.deyeEmail,
    password: override?.password || cfg.deyePassword,
    companyId: override?.companyId ?? cfg.deyeCompanyId,
    stationId: override?.stationId ?? cfg.deyeStationId,
    deviceSn: override?.deviceSn ?? cfg.inverterSn,
  };
  return new DeyeClient(credentials, {
    get: () => stored,
    set: (token) => {
      stored = token;
      if (!override) saveDeyeToken(db, token.token, token.obtainedAt, token.expiresAt);
    },
  });
}

export async function pullDeyeLatest(db: AppDb): Promise<Sample> {
  const cfg = getConfig(db);
  if (!cfg.deyeConfigured) throw new DeyeError("Deye Cloud credentials are not configured");
  const client = clientFor(db, cfg);
  let stationId = cfg.deyeStationId;
  if (!stationId) {
    const stations = await client.stationList();
    if (stations.length === 1) {
      stationId = String(stations[0].id);
      applySettings(db, { deyeStationId: stationId });
    }
  }
  const stationBody = stationId ? await client.stationLatest(Number(stationId)) : null;
  const deviceBody = cfg.inverterSn ? await client.deviceLatest(cfg.inverterSn) : null;
  const sample = sampleFromDeye(deviceBody, stationBody);
  if (sample.operatingMode === "—") sample.operatingMode = cfg.operatingMode;
  const daily = dailyEnergyFromDeye(deviceBody, stationBody);
  if (daily) {
    const ymd = zonedParts(sample.ts, cfg.timeZone).ymd;
    upsertEnergy(db, "deye", ymd, "day", daily);
  }
  return sample;
}

export async function storeDeyeSample(db: AppDb, sample: Sample): Promise<void> {
  insertSnapshot(db, sample);
  recomputeDay(db, "deye", sample.ts, Date.now());
  saveDeyeStatus(db, true, null);
  runAlerts(db, sample, Date.now());
}

export type ConnectionTest = {
  ok: boolean;
  error?: string;
  warning?: string;
  stations: DeyeStation[];
  devices: DeyeDevice[];
  stationId?: string;
  live?: { pvW: number; loadW: number; batterySoc: number; gridStatus: string; online: boolean };
};

export async function testDeyeConnection(
  db: AppDb,
  input: Partial<DeyeCredentials>,
): Promise<ConnectionTest> {
  const cfg = getConfig(db);
  const credentials: DeyeCredentials = {
    region: input.region ?? cfg.deyeRegion,
    baseUrl: input.baseUrl ?? cfg.deyeBaseUrl,
    appId: input.appId ?? cfg.deyeAppId,
    appSecret: input.appSecret || cfg.deyeAppSecret,
    email: input.email ?? cfg.deyeEmail,
    password: input.password || cfg.deyePassword,
    companyId: input.companyId ?? cfg.deyeCompanyId,
    stationId: input.stationId ?? cfg.deyeStationId,
    deviceSn: input.deviceSn ?? cfg.inverterSn,
  };
  const holder: { token: StoredToken | null } = { token: null };
  const client = new DeyeClient(credentials, {
    get: () => holder.token,
    set: (token) => {
      holder.token = token;
    },
  });
  try {
    await client.accessToken(true);
    const stations = await client.stationList();
    let devices: DeyeDevice[] = [];
    let warning: string | undefined;
    try {
      devices = await client.deviceList();
    } catch (error) {
      warning = errorMessage(error);
    }
    const stationId = credentials.stationId || (stations.length === 1 ? String(stations[0].id) : "");
    let live: ConnectionTest["live"];
    if (stationId || credentials.deviceSn) {
      try {
        const stationBody = stationId ? await client.stationLatest(Number(stationId)) : null;
        const deviceBody = credentials.deviceSn ? await client.deviceLatest(credentials.deviceSn) : null;
        if (stationBody || deviceBody) {
          const sample = sampleFromDeye(deviceBody, stationBody);
          live = {
            pvW: sample.pvW,
            loadW: sample.loadW,
            batterySoc: sample.batterySoc,
            gridStatus: sample.gridStatus,
            online: sample.online,
          };
          insertSnapshot(db, sample);
          recomputeDay(db, "deye", sample.ts, Date.now());
          runAlerts(db, sample, Date.now());
        }
      } catch (error) {
        warning = warning ?? errorMessage(error);
      }
    }
    applySettings(db, {
      deyeRegion: credentials.region,
      deyeBaseUrl: credentials.baseUrl,
      deyeAppId: credentials.appId,
      deyeAppSecret: input.appSecret || undefined,
      deyeEmail: credentials.email,
      deyePassword: input.password || undefined,
      deyeCompanyId: credentials.companyId,
      deyeStationId: stationId,
    });
    if (holder.token) saveDeyeToken(db, holder.token.token, holder.token.obtainedAt, holder.token.expiresAt);
    saveDeyeStatus(db, true, null);
    return { ok: true, stations, devices, stationId, live, warning };
  } catch (error) {
    const message = errorMessage(error);
    saveDeyeStatus(db, false, message);
    return { ok: false, error: message, stations: [], devices: [] };
  }
}

export async function syncDeyeHistory(db: AppDb): Promise<{ snapshots: number; days: number; months: number }> {
  const cfg = getConfig(db);
  if (!cfg.deyeConfigured) throw new DeyeError("Deye Cloud credentials are not configured");
  const client = clientFor(db, cfg);
  const today = zonedParts(Date.now(), cfg.timeZone).ymd;
  let snapshots = 0;
  if (cfg.inverterSn) {
    const body = await client.deviceHistory(cfg.inverterSn, today);
    const points = parseDeviceHistory(body).filter((point) => point.pvW != null || point.loadW != null || point.batteryW != null);
    const samples: Sample[] = points.map((point) => ({
      ts: point.ts,
      source: "deye",
      pvW: point.pvW ?? 0,
      pv1V: null,
      pv1A: null,
      pv1W: null,
      pv2V: null,
      pv2A: null,
      pv2W: null,
      loadW: point.loadW ?? 0,
      upsW: 0,
      gridW: point.gridW ?? 0,
      gridStatus: "on-grid",
      batteryW: point.batteryW ?? 0,
      batterySoc: point.batterySoc ?? 0,
      batteryV: null,
      batteryA: null,
      batteryTemp: null,
      acV: null,
      acHz: null,
      inverterTemp: null,
      operatingMode: cfg.operatingMode,
      online: true,
    }));
    if (samples.length) {
      insertSnapshots(db, samples);
      recomputeDay(db, "deye", samples[samples.length - 1].ts, Date.now());
      snapshots = samples.length;
    }
  }
  let days = 0;
  let months = 0;
  if (cfg.deyeStationId) {
    const stationId = Number(cfg.deyeStationId);
    if (snapshots === 0) {
      const frame = await client.stationHistory(stationId, 1, today, today);
      const power = parseStationHistory(frame, 1).power;
      const samples: Sample[] = power.map((point) => ({
        ts: point.ts,
        source: "deye",
        pvW: point.pvW ?? 0,
        pv1V: null,
        pv1A: null,
        pv1W: null,
        pv2V: null,
        pv2A: null,
        pv2W: null,
        loadW: point.loadW ?? 0,
      upsW: 0,
        gridW: point.gridW ?? 0,
        gridStatus: "on-grid",
        batteryW: point.batteryW ?? 0,
        batterySoc: point.batterySoc ?? 0,
        batteryV: null,
        batteryA: null,
        batteryTemp: null,
        acV: null,
        acHz: null,
        inverterTemp: null,
        operatingMode: cfg.operatingMode,
        online: true,
      }));
      if (samples.length) {
        insertSnapshots(db, samples);
        recomputeDay(db, "deye", samples[samples.length - 1].ts, Date.now());
        snapshots = samples.length;
      }
    }
    const range = stationDailyHistoryRange(Date.now(), cfg.timeZone);
    const daily = await client.stationHistory(stationId, 2, range.startAt, range.endAt);
    for (const row of parseStationHistory(daily, 2).energy) {
      insertEnergyRow(db, row);
      days += 1;
    }
    const monthStart = zonedParts(Date.now() - 370 * 86_400_000, cfg.timeZone).ymd.slice(0, 7);
    const monthEnd = today.slice(0, 7);
    const monthly = await client.stationHistory(stationId, 3, monthStart, monthEnd);
    for (const row of parseStationHistory(monthly, 3).energy) {
      insertEnergyRow(db, row);
      months += 1;
    }
  }
  saveDeyeStatus(db, true, null);
  return { snapshots, days, months };
}

function insertEnergyRow(db: AppDb, row: ReturnType<typeof parseStationHistory>["energy"][number]): void {
  upsertEnergy(db, "deye", row.period, row.grain, {
    productionKwh: row.productionKwh ?? 0,
    loadKwh: row.loadKwh ?? 0,
    chargeKwh: row.chargeKwh ?? 0,
    dischargeKwh: row.dischargeKwh ?? 0,
    importKwh: row.importKwh ?? 0,
    exportKwh: row.exportKwh ?? 0,
    socClose: row.soc ?? null,
  });
}

const HISTORY_INTERVAL_MS = 12 * 60_000;

type DailySyncState = { at: number; inflight?: Promise<{ days: number; months: number; skipped?: boolean }> };

const globalForHistory = globalThis as unknown as { filosofoDailySync?: DailySyncState };

async function resolveStationId(db: AppDb, cfg: ResolvedConfig, client: DeyeClient): Promise<string> {
  if (cfg.deyeStationId) return cfg.deyeStationId;
  const stations = await client.stationList();
  if (stations.length === 1) {
    const stationId = String(stations[0].id);
    applySettings(db, { deyeStationId: stationId });
    return stationId;
  }
  return "";
}

export async function syncDeyeEnergyHistory(db: AppDb): Promise<{ days: number; months: number }> {
  const cfg = getConfig(db);
  if (!cfg.deyeConfigured) throw new DeyeError("Deye Cloud credentials are not configured");
  const client = clientFor(db, cfg);
  const stationId = await resolveStationId(db, getConfig(db), client);
  if (!stationId) return { days: 0, months: 0 };
  const today = zonedParts(Date.now(), cfg.timeZone).ymd;
  // Deye Cloud rejects inclusive windows longer than 31 days ("should be within 31 days").
  const range = stationDailyHistoryRange(Date.now(), cfg.timeZone);
  let days = 0;
  const daily = await client.stationHistory(Number(stationId), 2, range.startAt, range.endAt);
  for (const row of parseStationHistory(daily, 2).energy) {
    insertEnergyRow(db, row);
    days += 1;
  }
  let months = 0;
  try {
    const monthStart = zonedParts(Date.now() - 370 * 86_400_000, cfg.timeZone).ymd.slice(0, 7);
    const monthEnd = today.slice(0, 7);
    const monthly = await client.stationHistory(Number(stationId), 3, monthStart, monthEnd);
    for (const row of parseStationHistory(monthly, 3).energy) {
      insertEnergyRow(db, row);
      months += 1;
    }
  } catch (error) {
    console.error("Deye monthly history sync failed:", error instanceof Error ? error.message : error);
  }
  saveDeyeStatus(db, true, null);
  return { days, months };
}

export async function ensureDeyeDailyHistory(
  db: AppDb,
  options?: { force?: boolean },
): Promise<{ days: number; months: number; skipped?: boolean }> {
  const cfg = getConfig(db);
  if (!cfg.deyeConfigured) return { days: 0, months: 0, skipped: true };
  const state = globalForHistory.filosofoDailySync ?? { at: 0 };
  const now = Date.now();
  if (!options?.force && state.at > 0 && now - state.at < HISTORY_INTERVAL_MS) {
    return { days: 0, months: 0, skipped: true };
  }
  if (state.inflight) return state.inflight;
  const inflight = (async () => {
    try {
      const result = await syncDeyeEnergyHistory(db);
      state.at = Date.now();
      return result;
    } finally {
      state.inflight = undefined;
      globalForHistory.filosofoDailySync = state;
    }
  })();
  state.inflight = inflight;
  globalForHistory.filosofoDailySync = state;
  return inflight;
}
