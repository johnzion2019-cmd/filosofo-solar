import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterAll, describe, expect, it } from "vitest";
import { evaluateRules } from "@/lib/alerts";
import { openDatabase } from "@/lib/db";
import { FILOSOFO_SIM, cloudFactor, demoNow, pvPowerW, simulateStep } from "@/lib/demo";
import { parseDeviceHistory, parseStationHistory, resolveDeyeBaseUrl, sampleFromDeye } from "@/lib/deye";
import { formatPowerParts } from "@/lib/format";
import { allowIngest, parseIngestBody } from "@/lib/ingest";
import { billEstimate, cycleWindow, savingsPhp, selfConsumptionPct } from "@/lib/billing";
import { buildEarningsReport, dayEarnings, SEEDED_LIFETIME_TOTAL_PHP, SEEDED_MONTHLY_EARNINGS, selfConsumedKwh } from "@/lib/earnings";
import { buildHistory, todayTotals } from "@/lib/history";
import { latestSnapshot } from "@/lib/repo";
import { resolveSource } from "@/lib/runtime";
import { decryptSecret, deyePasswordField, encryptSecret, hashDeyePassword, safeEqual } from "@/lib/secrets";
import { sessionToken } from "@/lib/session";
import { viewContext } from "@/lib/status";
import { startOfZonedDay, zonedTimeToUtc } from "@/lib/time";
import { PLANT_DEFAULTS, type Sample } from "@/lib/types";

process.env.SETTINGS_SECRET = "unit-test-secret";

const day = { year: 2026, month: 11, day: 28 };

describe("Deye Cloud client", () => {
  it("hashes passwords the way the Open API expects", () => {
    expect(hashDeyePassword("123456")).toBe("8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92");
    expect(deyePasswordField("123456")).toBe(hashDeyePassword("123456"));
    expect(deyePasswordField(hashDeyePassword("123456").toUpperCase())).toBe(hashDeyePassword("123456"));
  });

  it("builds regional base URLs and rejects private hosts", () => {
    expect(resolveDeyeBaseUrl("eu")).toBe("https://eu1-developer.deyecloud.com/v1.0");
    expect(resolveDeyeBaseUrl("us")).toBe("https://us1-developer.deyecloud.com/v1.0");
    expect(resolveDeyeBaseUrl("india")).toBe("https://india-developer.deyecloud.com/v1.0");
    expect(resolveDeyeBaseUrl("custom", "https://eu1-developer.deyecloud.com")).toBe("https://eu1-developer.deyecloud.com/v1.0");
    expect(() => resolveDeyeBaseUrl("custom", "http://example.com")).toThrow(/https/);
    expect(() => resolveDeyeBaseUrl("custom", "https://127.0.0.1/v1.0")).toThrow(/public/);
  });

  it("maps device and station telemetry, including off-grid", () => {
    const sample = sampleFromDeye(
      {
        deviceDataList: [
          {
            deviceSn: "2508073177",
            deviceState: 1,
            collectionTime: 1_730_000_000,
            dataList: [
              { key: "SOC", value: "63" },
              { key: "BatteryPower", value: "1010" },
              { key: "TotalSolarPower", value: "2" },
              { key: "TotalConsumptionPower", value: "890" },
              { key: "TotalGridPower", value: "0" },
              { key: "Temperature- Battery", value: "30.5" },
              { key: "PV1Voltage", value: "32" },
              { key: "BatteryVoltage", value: "52.1" },
              { key: "GridVoltage", value: "0" },
              { key: "WorkMode", value: "Manual Mode" },
            ],
          },
        ],
      },
      null,
    );
    expect(sample.batterySoc).toBe(63);
    expect(sample.batteryW).toBe(1010);
    expect(sample.pvW).toBe(2);
    expect(sample.loadW).toBe(890);
    expect(sample.batteryTemp).toBe(30.5);
    expect(sample.gridStatus).toBe("off-grid");
    expect(sample.operatingMode).toBe("Manual Mode");
    expect(sample.ts).toBe(1_730_000_000_000);

    const merged = sampleFromDeye(null, {
      generationPower: 2985,
      consumptionPower: 54,
      batteryPower: -3016,
      batterySOC: 83,
      purchasePower: 0,
      gridPower: 120,
      lastUpdateTime: 1_737_070_476,
    });
    expect(merged.pvW).toBe(2985);
    expect(merged.batteryW).toBe(-3016);
    expect(merged.gridW).toBe(-120);
    expect(merged.batterySoc).toBe(83);
  });

  it("parses station and device history", () => {
    const daily = parseStationHistory(
      {
        stationDataItems: [{ year: 2026, month: 11, day: 27, generationValue: 18.4, consumptionValue: 11.2, purchaseValue: 1.1, gridValue: 4.4, chargeValue: 6, dischargeValue: 5.2, batterySOC: 70 }],
      },
      2,
    );
    expect(daily.energy[0]).toMatchObject({ period: "2026-11-27", grain: "day", productionKwh: 18.4, exportKwh: 4.4 });

    const points = parseDeviceHistory({
      dataList: [
        {
          timeStamp: 1_730_000_000,
          itemList: [
            { key: "SOC", value: "70" },
            { key: "TotalSolarPower", value: "1500" },
          ],
        },
      ],
    });
    expect(points[0]).toMatchObject({ ts: 1_730_000_000_000, batterySoc: 70, pvW: 1500 });
  });
});

describe("demo plant", () => {
  it("is dark at night and producing at solar noon", () => {
    const night = zonedTimeToUtc({ ...day, hour: 2, minute: 0 }, "Asia/Manila");
    const noon = zonedTimeToUtc({ ...day, hour: 12, minute: 0 }, "Asia/Manila");
    expect(pvPowerW(night, FILOSOFO_SIM)).toBe(0);
    expect(pvPowerW(noon, FILOSOFO_SIM)).toBeGreaterThan(1500);
    expect(cloudFactor("2026-11-28", 12)).toBeGreaterThan(0);
    expect(cloudFactor("2026-11-28", 12)).toBeLessThanOrEqual(1);
  });

  it("keeps a believable late-morning balance for Filosofo", () => {
    const start = zonedTimeToUtc({ ...day, hour: 0, minute: 0 }, "Asia/Manila");
    const target = zonedTimeToUtc({ ...day, hour: 11, minute: 15 }, "Asia/Manila");
    let soc = 45;
    let last = simulateStep(start, soc, 10 / 60, FILOSOFO_SIM);
    for (let ts = start; ts <= target; ts += 10 * 60_000) {
      last = simulateStep(ts, soc, 10 / 60, FILOSOFO_SIM);
      soc = last.soc;
      expect(soc).toBeGreaterThanOrEqual(0);
      expect(soc).toBeLessThanOrEqual(100);
      if (!last.curtailed && last.sample.gridStatus === "on-grid") {
        const balance = last.sample.loadW - (last.sample.pvW + last.sample.gridW + last.sample.batteryW);
        expect(Math.abs(balance)).toBeLessThan(2);
      }
    }
    const flows = {
      pv: Math.round(last.sample.pvW),
      load: Math.round(last.sample.loadW),
      battery: Math.round(last.sample.batteryW),
      grid: Math.round(last.sample.gridW),
      soc: Math.round(last.sample.batterySoc),
    };
    expect(flows.pv, JSON.stringify(flows)).toBeGreaterThan(800);
    expect(flows.load, JSON.stringify(flows)).toBeGreaterThan(200);
    expect(flows.battery, JSON.stringify(flows)).toBeLessThan(-100);
    expect(flows.grid, JSON.stringify(flows)).toBeLessThan(0);
    expect(flows.soc, JSON.stringify(flows)).toBeGreaterThan(25);
    expect(flows.soc, JSON.stringify(flows)).toBeLessThan(98);
    expect(last.sample.acHz).toBeGreaterThan(59);
    expect(last.sample.operatingMode).toBe("Manual Mode");
    expect(last.sample.pv1V).toBeGreaterThan(200);
  });

  it("advances the demo clock one second per real second", () => {
    expect(demoNow(1_000, 0, 50_000)).toBe(51_000);
  });
});

describe("alerts, ingest, and session", () => {
  const sample = {
    ts: 1_000,
    source: "demo",
    pvW: 0,
    pv1V: null,
    pv1A: null,
    pv1W: null,
    pv2V: null,
    pv2A: null,
    pv2W: null,
    loadW: 400,
    upsW: 12,
    gridW: 0,
    gridStatus: "off-grid",
    batteryW: 400,
    batterySoc: 15,
    batteryV: 50,
    batteryA: 8,
    batteryTemp: 30,
    acV: 228,
    acHz: 60,
    inverterTemp: 35,
    operatingMode: "Manual Mode",
    online: false,
  } satisfies Sample;

  it("fires each enabled rule once until it is open", () => {
    const rules = { lowSocEnabled: true, lowSocThreshold: 20, gridEnabled: true, offlineEnabled: true, offlineMinutes: 15 };
    const first = evaluateRules(sample, 2, rules, new Set());
    expect(first.map((item) => item.rule).sort()).toEqual(["grid-outage", "inverter-offline", "low-soc"]);
    const second = evaluateRules(sample, 30, rules, new Set(["low-soc", "grid-outage", "inverter-offline"]));
    expect(second).toHaveLength(0);
  });

  it("accepts a bridge payload and rejects garbage", () => {
    const parsed = parseIngestBody({ deviceSn: "2508073177", pv_power: 1000, soc: 60, grid_status: "off-grid" }, 2_000_000_000_000);
    expect(parsed.sample.pvW).toBe(1000);
    expect(parsed.sample.batterySoc).toBe(60);
    expect(parsed.sample.gridStatus).toBe("off-grid");
    expect(parsed.sample.source).toBe("bridge");
    expect(() => parseIngestBody({ batterySoc: 140 })).toThrow(/range/);
    expect(() => parseIngestBody({})).toThrow(/at least one/);
  });

  it("rate limits ingest keys", () => {
    const key = `k-${Math.random()}`;
    for (let i = 0; i < 3; i += 1) expect(allowIngest(key, 3, 60_000, 1_000)).toBe(true);
    expect(allowIngest(key, 3, 60_000, 1_000)).toBe(false);
  });

  it("compares secrets without matching different lengths", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });

  it("round-trips encrypted settings and session tokens", async () => {
    const encrypted = encryptSecret("super-secret");
    expect(encrypted.startsWith("enc:v1:")).toBe(true);
    expect(decryptSecret(encrypted)).toBe("super-secret");
    const token = await sessionToken("2468");
    expect(token).toHaveLength(64);
    expect(await sessionToken("2468")).toBe(token);
  });
});

describe("billing cycle", () => {
  it("prices a NORECO-style cycle the way the dashboard cards do", () => {
    const now = zonedTimeToUtc({ year: 2026, month: 11, day: 27, hour: 14, minute: 0 }, "Asia/Manila");
    const cycle = cycleWindow(now, "Asia/Manila", 20);
    expect(cycle.daysElapsed).toBe(8);
    expect(cycle.label).toBe("Cycle 20th–19th");
    expect(savingsPhp(140, 16.5)).toBe(2310);
    expect(savingsPhp(18, 16.5)).toBe(297);
    expect(billEstimate(3, cycle.daysElapsed, cycle.daysTotal, 16.5).billPhp).toBe(49.5);
    expect(selfConsumptionPct(18, 0)).toBe(100);
  });
});

describe("stored telemetry", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "filosofo-"));
  const db = openDatabase(path.join(dir, "plant.sqlite"));

  afterAll(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("seeds Filosofo and serves today, history, and power formatting", () => {
    const view = viewContext(db);
    expect(view.mode).toBe("demo");
    expect(view.cfg.plantName).toBe(PLANT_DEFAULTS.plantName);
    expect(view.cfg.inverterSn).toBe("2508073177");
    expect(view.live?.online).toBe(true);
    expect(view.live?.pvW ?? 0).toBeGreaterThan(400);
    expect(view.live?.loadW ?? 0).toBeGreaterThan(150);
    const today = todayTotals(db, "demo", view.clock.now);
    expect(today.productionKwh).toBeGreaterThan(0);
    expect(today.loadKwh).toBeGreaterThan(0);
    const history = buildHistory(db, "demo", "year", view.clock.now);
    expect(history.points.length).toBeGreaterThan(6);
    expect(history.unit).toBe("kWh");
    const latest = latestSnapshot(db, "demo");
    expect(latest?.source).toBe("demo");
    const midnight = startOfZonedDay(view.clock.now, "Asia/Manila");
    expect(view.clock.now).toBeGreaterThan(midnight);
    expect(formatPowerParts(890)).toEqual({ value: "890", unit: "W" });
    expect(formatPowerParts(1010)).toEqual({ value: "1.01", unit: "kW" });
    expect(formatPowerParts(0, true)).toEqual({ value: "0", unit: "kW" });
    expect(resolveSource(view.cfg, { demo: view.live, deye: null, bridge: null }, Date.now())).toBe("demo");
  });
});

describe("earnings", () => {
  const empty = { productionKwh: 0, loadKwh: 0, chargeKwh: 0, dischargeKwh: 0, importKwh: 0, exportKwh: 0, socClose: null };

  it("prices today's self-consumption and leaves feed-in at the default zero rate", () => {
    expect(selfConsumedKwh({ productionKwh: 10, exportKwh: 2, dischargeKwh: 1 })).toBe(8);
    const earned = dayEarnings({ ...empty, productionKwh: 10, exportKwh: 2 }, 16.5, 0);
    expect(earned.consumptionSavingsPhp).toBe(132);
    expect(earned.feedInEarningsPhp).toBe(0);
    expect(earned.totalPhp).toBe(132);
    expect(dayEarnings({ ...empty, productionKwh: 18 }, 16.5).consumptionSavingsPhp).toBe(297);
  });

  it("falls back to battery discharge when today's production is still 0 at night", () => {
    const earned = dayEarnings({ ...empty, dischargeKwh: 5, loadKwh: 5 }, 16.5, 0);
    expect(earned.selfConsumedKwh).toBe(5);
    expect(earned.consumptionSavingsPhp).toBe(82.5);
    expect(earned.totalPhp).toBe(82.5);
  });

  it("seeds John\'s verified Aug–Nov 2026 earnings and keeps the lifetime floor", () => {
    const now = zonedTimeToUtc({ year: 2026, month: 11, day: 28, hour: 3, minute: 50 }, "Asia/Manila");
    const report = buildEarningsReport({ today: empty, now, timeZone: "Asia/Manila", tariffPhp: 16.5, feedInRatePhp: 0 });
    expect(SEEDED_MONTHLY_EARNINGS.map((month) => month.totalPhp)).toEqual([6405.95, 16748.6, 21883.61, 20530.06]);
    expect(SEEDED_LIFETIME_TOTAL_PHP).toBe(65568.22);
    expect(report.monthly.map((month) => [month.period, month.totalPhp, month.source])).toEqual([
      ["2026-08", 6405.95, "seeded"],
      ["2026-09", 16748.6, "seeded"],
      ["2026-10", 21883.61, "seeded"],
      ["2026-11", 20530.06, "seeded"],
    ]);
    expect(report.monthly[3]?.chargedEnergyKwh).toBe(549.5);
    expect(report.lifetimeTotalPhp).toBe(65568.22);
    expect(report.today.totalPhp).toBe(0);
  });

  it("lets the current month grow above the seeded November baseline", () => {
    const now = zonedTimeToUtc({ year: 2026, month: 11, day: 29, hour: 16, minute: 0 }, "Asia/Manila");
    const liveNovember = { ...empty, productionKwh: 1300, chargeKwh: 560, exportKwh: 0 };
    const report = buildEarningsReport({
      today: { ...empty, productionKwh: 18 },
      now,
      timeZone: "Asia/Manila",
      tariffPhp: 16.5,
      feedInRatePhp: 0,
      liveMonths: { "2026-11": liveNovember },
      accrueLiveMonths: true,
    });
    const november = report.monthly.find((month) => month.period === "2026-11");
    expect(november?.consumptionSavingsPhp).toBe(21450);
    expect(november?.chargedEnergyKwh).toBe(560);
    expect(november?.source).toBe("seeded+live");
    expect(report.lifetimeTotalPhp).toBe(66488.16);
  });

  it("does not let demo history overwrite verified closed months", () => {
    const now = zonedTimeToUtc({ year: 2026, month: 11, day: 28, hour: 4, minute: 0 }, "Asia/Manila");
    const inflated = { ...empty, productionKwh: 400, chargeKwh: 213.74 };
    const report = buildEarningsReport({
      today: empty,
      now,
      timeZone: "Asia/Manila",
      liveMonths: { "2026-08": inflated, "2026-11": inflated },
      accrueLiveMonths: false,
    });
    expect(report.monthly.map((month) => [month.period, month.totalPhp, month.source])).toEqual([
      ["2026-08", 6405.95, "seeded"],
      ["2026-09", 16748.6, "seeded"],
      ["2026-10", 21883.61, "seeded"],
      ["2026-11", 20530.06, "seeded"],
    ]);
    expect(report.lifetimeTotalPhp).toBe(65568.22);
  });
});
