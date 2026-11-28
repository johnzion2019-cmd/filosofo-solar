import type { EnergyTotals, GridStatus, Sample } from "@/lib/types";
import { deyePasswordField } from "@/lib/secrets";

/**
 * Deye Cloud Open API v1.0
 * Docs: https://developer.deyecloud.com/start
 * Sample client: https://github.com/DeyeCloudDevelopers/deye-openapi-client-sample-code
 *
 * Password is SHA-256 hex (lowercase) before it is posted. Tokens last 60 days;
 * this client requests a new one two days before expiry and again after an auth error.
 * The sample code sends `Authorization: bearer <token>`.
 */

export const DEYE_REGIONS = {
  eu: "https://eu1-developer.deyecloud.com/v1.0",
  us: "https://us1-developer.deyecloud.com/v1.0",
  india: "https://india-developer.deyecloud.com/v1.0",
} as const;

export type DeyeRegion = keyof typeof DEYE_REGIONS | "custom";

export class DeyeError extends Error {
  code?: string;
  auth: boolean;

  constructor(message: string, code?: string, auth = false) {
    super(message);
    this.name = "DeyeError";
    this.code = code;
    this.auth = auth;
  }
}

export type DeyeStation = {
  id: number;
  name: string;
  address: string;
  lat: number | null;
  lon: number | null;
  timezone: string | null;
};

export type DeyeDevice = {
  sn: string;
  type: string;
  stationId: number | null;
  model: string | null;
};

export type StoredToken = {
  token: string;
  obtainedAt: number;
  expiresAt: number;
};

export type DeyeCredentials = {
  region: DeyeRegion;
  baseUrl?: string;
  appId: string;
  appSecret: string;
  email: string;
  password: string;
  companyId?: string;
  stationId?: string;
  deviceSn?: string;
};

const KEY_MAP: Record<string, string> = {
  soc: "soc",
  batterysoc: "soc",
  batterypower: "batteryW",
  totalsolarpower: "pvW",
  pvpower: "pvW",
  pv1power: "pv1W",
  powerpv1: "pv1W",
  pv1voltage: "pv1V",
  dcvoltagepv1: "pv1V",
  voltagepv1: "pv1V",
  pv1current: "pv1A",
  dccurrentpv1: "pv1A",
  currentpv1: "pv1A",
  pv2power: "pv2W",
  powerpv2: "pv2W",
  pv2voltage: "pv2V",
  dcvoltagepv2: "pv2V",
  voltagepv2: "pv2V",
  pv2current: "pv2A",
  dccurrentpv2: "pv2A",
  currentpv2: "pv2A",
  totalconsumptionpower: "loadW",
  loadpower: "loadW",
  consumptionpower: "loadW",
  upspower: "upsW",
  upsloadpower: "upsW",
  upslodpower: "upsW",
  backuploadpower: "upsW",
  totalgridpower: "gridW",
  gridpower: "gridW",
  batteryvoltage: "batteryV",
  batterycurrent: "batteryA",
  temperaturebattery: "batteryTemp",
  batterytemp: "batteryTemp",
  batterytemperature: "batteryTemp",
  temperatureinverter: "inverterTemp",
  invertertemperature: "inverterTemp",
  radiatortemperature: "inverterTemp",
  radiatortemp: "inverterTemp",
  gridvoltage: "acV",
  acvoltage: "acV",
  acvoltager: "acV",
  gridfrequency: "acHz",
  acfrequency: "acHz",
  acfrequencyr: "acHz",
  dailyenergy: "dailyKwh",
  dailyproduction: "dailyKwh",
  todayenergy: "dailyKwh",
  etoday: "dailyKwh",
  dailyconsumption: "dailyLoadKwh",
  dailyloadconsumption: "dailyLoadKwh",
  dailylodconsumption: "dailyLoadKwh",
  dailyload: "dailyLoadKwh",
  todayconsumption: "dailyLoadKwh",
  dailyloadenergy: "dailyLoadKwh",
  dailydischargingenergy: "dailyDischargeKwh",
  dailydischargeenergy: "dailyDischargeKwh",
  dailydischarge: "dailyDischargeKwh",
  dailydischarging: "dailyDischargeKwh",
  dailychargingenergy: "dailyChargeKwh",
  dailychargeenergy: "dailyChargeKwh",
  dailycharge: "dailyChargeKwh",
  dailycharging: "dailyChargeKwh",
  dailyimport: "dailyImportKwh",
  dailypurchase: "dailyImportKwh",
  dailypurchasingenergy: "dailyImportKwh",
  dailyexport: "dailyExportKwh",
  dailysold: "dailyExportKwh",
  dailysell: "dailyExportKwh",
  dailygridfeedin: "dailyExportKwh",
  workmode: "mode",
  energypattern: "mode",
  runningstatus: "mode",
  gridstatus: "gridStatus",
  offgrid: "offGrid",
};

const MODE_LABELS: Record<string, string> = {
  manual: "Manual Mode",
  manualmode: "Manual Mode",
  sellingfirst: "Selling First",
  zeroexport: "Zero Export",
  selfuse: "Self Use",
  selfconsumption: "Self Use",
  batteryfirst: "Battery First",
  "0": "Standby",
  "1": "Self Use",
  "2": "Selling First",
  "3": "Manual Mode",
};

export function resolveDeyeBaseUrl(region: string, custom?: string): string {
  if (region === "eu" || region === "us" || region === "india") return DEYE_REGIONS[region];
  if (region !== "custom") throw new DeyeError("Unknown Deye region");
  const raw = (custom || "").trim().replace(/\/+$/, "");
  if (!raw) throw new DeyeError("Custom Deye base URL is required");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new DeyeError("Deye base URL is not a valid URL");
  }
  if (url.protocol !== "https:") throw new DeyeError("Deye base URL must start with https://");
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)
  ) {
    throw new DeyeError("Deye base URL must be a public https host");
  }
  const path = url.pathname.replace(/\/+$/, "");
  const base = `${url.origin}${path === "" || path === "/" ? "" : path}`;
  return base.endsWith("/v1.0") ? base : `${base}/v1.0`;
}

function normKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function epochMs(value: number | null, fallback: number): number {
  if (value == null) return fallback;
  if (value > 1e12) return value;
  if (value > 1e9) return value * 1000;
  return fallback;
}

function labelMode(raw: string | null): string {
  if (!raw) return "—";
  const compact = normKey(raw);
  if (MODE_LABELS[compact]) return MODE_LABELS[compact];
  if (MODE_LABELS[raw]) return MODE_LABELS[raw];
  return raw;
}

function asArray(body: unknown, keys: string[]): Record<string, unknown>[] {
  if (!body || typeof body !== "object") return [];
  const record = body as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object") as Record<string, unknown>[];
  }
  return [];
}

function assertOk(body: Record<string, unknown>): void {
  const code = body.code != null ? String(body.code) : "";
  const success = body.success === true || code === "1000000" || code === "0" || code === "";
  if (body.success === false || (code && code !== "1000000" && code !== "0")) {
    const message = String(body.msg || body.message || `Deye Cloud error ${code}`);
    const auth = /token|auth|unauthor|expire|login/i.test(message) || code.startsWith("2101");
    throw new DeyeError(message, code || undefined, auth);
  }
  if (!success && body.success == null && !code) return;
}

function normalizeExpires(expiresIn: unknown): number {
  const value = num(expiresIn);
  const sixtyDays = 60 * 24 * 3600;
  if (value == null) return sixtyDays;
  if (value > 1e12) return Math.max(3600, (value - Date.now()) / 1000);
  if (value > 1e9) return Math.max(3600, value - Date.now() / 1000);
  return Math.max(3600, value);
}

async function postJson(
  url: string,
  token: string | null,
  payload: unknown,
  fetchImpl: typeof fetch,
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    throw new DeyeError(`Deye Cloud request failed: ${message}`);
  }
  const text = await response.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new DeyeError(`Deye Cloud returned non-JSON (HTTP ${response.status})`);
  }
  if (response.status === 401 || response.status === 403) {
    throw new DeyeError(String(body.msg || `HTTP ${response.status}`), body.code != null ? String(body.code) : undefined, true);
  }
  if (!response.ok) {
    throw new DeyeError(String(body.msg || `HTTP ${response.status}`), body.code != null ? String(body.code) : undefined);
  }
  assertOk(body);
  return body;
}

export function mapMeasurePoints(dataList: unknown): Record<string, number | string | null> {
  const mapped: Record<string, number | string | null> = {};
  if (!Array.isArray(dataList)) return mapped;
  for (const item of dataList) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const key = typeof row.key === "string" ? KEY_MAP[normKey(row.key)] : undefined;
    if (!key) continue;
    if (key === "mode" || key === "gridStatus" || key === "offGrid") {
      mapped[key] = row.value == null ? null : String(row.value);
    } else {
      mapped[key] = num(row.value);
    }
  }
  return mapped;
}

function gridStatusFrom(
  mapped: Record<string, number | string | null>,
  loadW: number,
  acV: number | null,
  gridW: number,
  acHz: number | null,
): GridStatus {
  const explicit = mapped.gridStatus != null ? String(mapped.gridStatus) : "";
  const off = mapped.offGrid != null ? String(mapped.offGrid) : "";
  const offNorm = normKey(off);
  const statusNorm = normKey(explicit);
  if (["1", "true", "off", "offgrid", "yes"].includes(offNorm) || statusNorm.includes("off")) return "off-grid";
  if (["0", "false", "on", "ongrid", "no"].includes(offNorm) || statusNorm.includes("on")) return "on-grid";
  // Match Deye Cloud's "Off grid" badge: no grid power and no active frequency/voltage.
  if (gridW === 0 && (acHz === 0 || acHz == null || acV === 0)) return "off-grid";
  if (gridW !== 0 || (acHz != null && acHz > 0) || (acV != null && acV > 0)) return "on-grid";
  if (acV != null && acV < 50 && loadW > 50) return "off-grid";
  return "on-grid";
}

export function dailyEnergyFromDeye(deviceBody: unknown, stationBody: unknown): EnergyTotals | null {
  const device = asArray(deviceBody, ["deviceDataList", "deviceList", "list"])[0];
  const station = stationBody && typeof stationBody === "object" ? (stationBody as Record<string, unknown>) : null;
  const mapped = device ? mapMeasurePoints(device.dataList) : {};
  const pick = (...keys: string[]): number => {
    for (const key of keys) {
      const fromMap = mapped[key];
      if (typeof fromMap === "number" && Number.isFinite(fromMap)) return Math.max(0, fromMap);
      if (station) {
        const fromStation = num(station[key]);
        if (fromStation != null) return Math.max(0, fromStation);
      }
    }
    return 0;
  };
  const totals: EnergyTotals = {
    productionKwh: pick("dailyKwh", "generationValue"),
    loadKwh: pick("dailyLoadKwh", "consumptionValue"),
    chargeKwh: pick("dailyChargeKwh", "chargeValue"),
    dischargeKwh: pick("dailyDischargeKwh", "dischargeValue"),
    importKwh: pick("dailyImportKwh", "purchaseValue"),
    exportKwh: pick("dailyExportKwh", "gridValue"),
    socClose: typeof mapped.soc === "number" ? mapped.soc : num(station?.batterySOC ?? station?.batterySoc),
  };
  const hasEnergy = totals.productionKwh + totals.loadKwh + totals.chargeKwh + totals.dischargeKwh + totals.importKwh + totals.exportKwh > 0;
  return hasEnergy ? totals : null;
}

export function deviceOnline(state: unknown, hasData: boolean): boolean {
  const value = num(state);
  if (value == null) return hasData;
  return value !== 0 && value !== 3;
}

export function sampleFromDeye(deviceBody: unknown, stationBody: unknown, fallbackTs = Date.now()): Sample {
  const device = asArray(deviceBody, ["deviceDataList", "deviceList", "list"])[0];
  const station = stationBody && typeof stationBody === "object" ? (stationBody as Record<string, unknown>) : null;
  if (!device && !station) throw new DeyeError("Deye Cloud returned no station or device telemetry");

  const mapped = device ? mapMeasurePoints(device.dataList) : {};
  const stationNum = (key: string) => (station ? num(station[key]) : null);

  const pvW = (typeof mapped.pvW === "number" ? mapped.pvW : null) ?? stationNum("generationPower") ?? 0;
  const loadW = (typeof mapped.loadW === "number" ? mapped.loadW : null) ?? stationNum("consumptionPower") ?? 0;
  // Deye BatteryPower / batteryPower is signed: negative = charging, positive = discharging. Keep the sign as-is.
  let batteryW = (typeof mapped.batteryW === "number" ? mapped.batteryW : null) ?? stationNum("batteryPower");
  if (batteryW == null) {
    const charge = stationNum("chargePower");
    const discharge = stationNum("dischargePower");
    if (charge != null || discharge != null) batteryW = (discharge ?? 0) - Math.abs(charge ?? 0);
    else batteryW = 0;
  }
  const soc = (typeof mapped.soc === "number" ? mapped.soc : null) ?? stationNum("batterySOC") ?? stationNum("batterySoc") ?? 0;

  let gridW = typeof mapped.gridW === "number" ? mapped.gridW : null;
  if (gridW == null) {
    const purchase = stationNum("purchasePower");
    const exported = stationNum("gridPower");
    const wire = stationNum("wirePower");
    if (purchase != null || exported != null) gridW = (purchase ?? 0) - (exported ?? 0);
    else gridW = wire ?? 0;
  }

  const pv1W = typeof mapped.pv1W === "number" ? mapped.pv1W : null;
  const pv2W = typeof mapped.pv2W === "number" ? mapped.pv2W : null;
  const acV = typeof mapped.acV === "number" ? mapped.acV : null;
  const acHz = typeof mapped.acHz === "number" ? mapped.acHz : null;
  const modeRaw = typeof mapped.mode === "string" ? mapped.mode : null;
  const collection = device ? num(device.collectionTime) : null;
  const updated = station ? num(station.lastUpdateTime) : null;

  return {
    ts: epochMs(collection ?? updated, fallbackTs),
    source: "deye",
    pvW,
    pv1V: typeof mapped.pv1V === "number" ? mapped.pv1V : null,
    pv1A: typeof mapped.pv1A === "number" ? mapped.pv1A : null,
    pv1W,
    pv2V: typeof mapped.pv2V === "number" ? mapped.pv2V : null,
    pv2A: typeof mapped.pv2A === "number" ? mapped.pv2A : null,
    pv2W,
    loadW,
    upsW: typeof mapped.upsW === "number" ? mapped.upsW : 0,
    gridW,
    gridStatus: gridStatusFrom(mapped, loadW, acV, gridW, acHz),
    batteryW,
    batterySoc: soc,
    batteryV: typeof mapped.batteryV === "number" ? mapped.batteryV : null,
    batteryA: typeof mapped.batteryA === "number" ? mapped.batteryA : null,
    batteryTemp: typeof mapped.batteryTemp === "number" ? mapped.batteryTemp : null,
    acV,
    acHz,
    inverterTemp: typeof mapped.inverterTemp === "number" ? mapped.inverterTemp : null,
    operatingMode: labelMode(modeRaw),
    online: device ? deviceOnline(device.deviceState, true) : true,
  };
}

export function parseStations(body: unknown): DeyeStation[] {
  return asArray(body, ["stationList", "list", "data"]).map((row) => ({
    id: num(row.id) ?? 0,
    name: String(row.name || row.stationName || "Station"),
    address: String(row.locationAddress || row.address || ""),
    lat: num(row.locationLat),
    lon: num(row.locationLng),
    timezone: row.regionTimezone != null ? String(row.regionTimezone) : null,
  }));
}

export function parseDevices(body: unknown): DeyeDevice[] {
  const rows: Record<string, unknown>[] = [
    ...asArray(body, ["deviceListItems", "deviceList", "list"]),
    ...asArray(body, ["stationList"]).flatMap((station) =>
      asArray(station, ["deviceListItems", "deviceList"]).map((device) => ({ ...device, stationId: device.stationId ?? station.id })),
    ),
  ];
  const seen = new Set<string>();
  const devices: DeyeDevice[] = [];
  for (const row of rows) {
    const sn = String(row.deviceSn || row.sn || "");
    if (!sn || seen.has(sn)) continue;
    seen.add(sn);
    devices.push({
      sn,
      type: String(row.deviceType || row.type || "INVERTER"),
      stationId: num(row.stationId),
      model: row.productName != null ? String(row.productName) : row.deviceModel != null ? String(row.deviceModel) : null,
    });
  }
  return devices;
}

export type HistoryPowerPoint = {
  ts: number;
  pvW?: number;
  loadW?: number;
  gridW?: number;
  batteryW?: number;
  batterySoc?: number;
};

export type HistoryEnergyPoint = {
  period: string;
  grain: "day" | "month";
  productionKwh?: number;
  loadKwh?: number;
  chargeKwh?: number;
  dischargeKwh?: number;
  importKwh?: number;
  exportKwh?: number;
  soc?: number;
};

function stampFrom(row: Record<string, unknown>): number | null {
  const direct = num(row.timeStamp ?? row.timestamp ?? row.collectionTime);
  if (direct != null) return epochMs(direct, Date.now());
  if (typeof row.time === "string" && row.time.trim()) {
    const parsed = Date.parse(row.time.includes("T") ? row.time : row.time.replace(" ", "T") + "Z");
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function parseStationHistory(body: unknown, granularity: number): { power: HistoryPowerPoint[]; energy: HistoryEnergyPoint[] } {
  const rows = asArray(body, ["stationDataItems", "dataList", "list", "items"]);
  const power: HistoryPowerPoint[] = [];
  const energy: HistoryEnergyPoint[] = [];
  for (const row of rows) {
    if (granularity <= 1) {
      const ts = stampFrom(row);
      if (ts == null) continue;
      const purchase = num(row.purchasePower);
      const exported = num(row.gridPower);
      const wire = num(row.wirePower);
      const gridW =
        purchase != null || exported != null ? (purchase ?? 0) - (exported ?? 0) : (wire ?? undefined);
      power.push({
        ts,
        pvW: num(row.generationPower) ?? undefined,
        loadW: num(row.consumptionPower) ?? undefined,
        gridW,
        batteryW: num(row.batteryPower) ?? undefined,
        batterySoc: num(row.batterySoc ?? row.batterySOC) ?? undefined,
      });
      continue;
    }
    const year = num(row.year);
    const month = num(row.month);
    const day = num(row.day);
    if (year == null || month == null) continue;
    const grain = granularity === 2 && day != null ? "day" : "month";
    const period =
      grain === "day"
        ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
        : `${year}-${String(month).padStart(2, "0")}`;
    energy.push({
      period,
      grain,
      productionKwh: num(row.generationValue) ?? undefined,
      loadKwh: num(row.consumptionValue) ?? undefined,
      chargeKwh: num(row.chargeValue) ?? undefined,
      dischargeKwh: num(row.dischargeValue) ?? undefined,
      importKwh: num(row.purchaseValue) ?? undefined,
      exportKwh: num(row.gridValue) ?? undefined,
      soc: num(row.batterySoc ?? row.batterySOC) ?? undefined,
    });
  }
  return { power, energy };
}

export function parseDeviceHistory(body: unknown): HistoryPowerPoint[] {
  const rows = asArray(body, ["dataList", "list", "items"]);
  const points: HistoryPowerPoint[] = [];
  for (const row of rows) {
    const ts = stampFrom(row);
    if (ts == null) continue;
    const items = Array.isArray(row.itemList) ? row.itemList : Array.isArray(row.dataList) ? row.dataList : null;
    if (items) {
      const mapped = mapMeasurePoints(items);
      points.push({
        ts,
        pvW: typeof mapped.pvW === "number" ? mapped.pvW : undefined,
        loadW: typeof mapped.loadW === "number" ? mapped.loadW : undefined,
        gridW: typeof mapped.gridW === "number" ? mapped.gridW : undefined,
        batteryW: typeof mapped.batteryW === "number" ? mapped.batteryW : undefined,
        batterySoc: typeof mapped.soc === "number" ? mapped.soc : undefined,
      });
    }
  }
  return points;
}

export const DEVICE_HISTORY_POINTS = [
  "SOC",
  "TotalSolarPower",
  "TotalConsumptionPower",
  "TotalGridPower",
  "BatteryPower",
];

export class DeyeClient {
  constructor(
    private readonly credentials: DeyeCredentials,
    private readonly tokens: {
      get: () => StoredToken | null;
      set: (token: StoredToken) => void;
    },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  baseUrl(): string {
    return resolveDeyeBaseUrl(this.credentials.region, this.credentials.baseUrl);
  }

  async accessToken(force = false): Promise<string> {
    const current = this.tokens.get();
    const refreshBy = Date.now() + 2 * 24 * 3600 * 1000;
    if (!force && current && current.expiresAt > refreshBy && current.token) return current.token;
    const fresh = await this.obtainToken();
    this.tokens.set(fresh);
    return fresh.token;
  }

  async obtainToken(): Promise<StoredToken> {
    if (!this.credentials.appId || !this.credentials.appSecret || !this.credentials.email || !this.credentials.password) {
      throw new DeyeError("App ID, app secret, email, and password are required");
    }
    const url = `${this.baseUrl()}/account/token?appId=${encodeURIComponent(this.credentials.appId)}`;
    const payload: Record<string, string> = {
      appSecret: this.credentials.appSecret,
      email: this.credentials.email,
      password: deyePasswordField(this.credentials.password),
    };
    if (this.credentials.companyId && this.credentials.companyId !== "0") payload.companyId = this.credentials.companyId;
    const body = await postJson(url, null, payload, this.fetchImpl);
    const token = String(body.accessToken || body.token || "");
    if (!token) throw new DeyeError(String(body.msg || "Deye Cloud did not return an access token"), body.code != null ? String(body.code) : undefined);
    const obtainedAt = Date.now();
    return { token, obtainedAt, expiresAt: obtainedAt + normalizeExpires(body.expiresIn) * 1000 };
  }

  private async call(path: string, payload: unknown, retry = true): Promise<Record<string, unknown>> {
    const token = await this.accessToken();
    try {
      return await postJson(`${this.baseUrl()}${path}`, token, payload, this.fetchImpl);
    } catch (error) {
      if (retry && error instanceof DeyeError && error.auth) {
        await this.accessToken(true);
        return this.call(path, payload, false);
      }
      throw error;
    }
  }

  async stationList(): Promise<DeyeStation[]> {
    const stations: DeyeStation[] = [];
    for (let page = 1; page <= 5; page += 1) {
      const body = await this.call("/station/list", { page, size: 20 });
      const batch = parseStations(body);
      stations.push(...batch);
      if (batch.length < 20) break;
    }
    return stations;
  }

  async deviceList(): Promise<DeyeDevice[]> {
    const body = await this.call("/station/listWithDevice", { page: 1, size: 50, deviceType: "INVERTER" });
    return parseDevices(body);
  }

  async stationLatest(stationId: number): Promise<Record<string, unknown>> {
    return this.call("/station/latest", { stationId });
  }

  async deviceLatest(deviceSn: string): Promise<Record<string, unknown>> {
    return this.call("/device/latest", { deviceList: [deviceSn] });
  }

  async deviceHistory(deviceSn: string, startAt: string, measurePoints: string[] = DEVICE_HISTORY_POINTS): Promise<Record<string, unknown>> {
    try {
      return await this.call("/device/history", { deviceSn, granularity: 1, startAt, measurePoints });
    } catch (error) {
      if (measurePoints.length > 1 && error instanceof DeyeError && !error.auth) {
        return this.call("/device/history", { deviceSn, granularity: 1, startAt, measurePoints: ["SOC"] });
      }
      throw error;
    }
  }

  async stationHistory(stationId: number, granularity: number, startAt: string, endAt: string): Promise<Record<string, unknown>> {
    return this.call("/station/history", { stationId, granularity, startAt, endAt });
  }
}
