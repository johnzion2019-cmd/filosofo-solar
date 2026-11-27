import type Database from "better-sqlite3";
import { mergeEnergyTotals } from "@/lib/integrate";
import type { AlertDraft, AlertRuleId, DataSource, EnergyTotals, Sample } from "@/lib/types";

export type AppDb = InstanceType<typeof Database>;

export function migrate(db: AppDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      source TEXT NOT NULL,
      pv_w REAL NOT NULL,
      pv1_v REAL,
      pv1_a REAL,
      pv1_w REAL,
      pv2_v REAL,
      pv2_a REAL,
      pv2_w REAL,
      load_w REAL NOT NULL,
      ups_w REAL NOT NULL DEFAULT 0,
      grid_w REAL NOT NULL,
      grid_status TEXT NOT NULL,
      battery_w REAL NOT NULL,
      battery_soc REAL NOT NULL,
      battery_v REAL,
      battery_a REAL,
      battery_temp REAL,
      ac_v REAL,
      ac_hz REAL,
      inverter_temp REAL,
      operating_mode TEXT,
      online INTEGER NOT NULL DEFAULT 1,
      UNIQUE(ts, source)
    );

    CREATE INDEX IF NOT EXISTS idx_snapshots_source_ts ON snapshots(source, ts);
  `);
  const columns = db.prepare("PRAGMA table_info(snapshots)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "ups_w")) {
    db.exec("ALTER TABLE snapshots ADD COLUMN ups_w REAL NOT NULL DEFAULT 0");
  }
  db.exec(`

    CREATE TABLE IF NOT EXISTS energy (
      period TEXT NOT NULL,
      grain TEXT NOT NULL,
      source TEXT NOT NULL,
      production_kwh REAL NOT NULL,
      load_kwh REAL NOT NULL,
      charge_kwh REAL NOT NULL,
      discharge_kwh REAL NOT NULL,
      import_kwh REAL NOT NULL,
      export_kwh REAL NOT NULL,
      soc_close REAL,
      PRIMARY KEY (period, grain, source)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      source TEXT NOT NULL,
      rule TEXT NOT NULL,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      acknowledged INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_ts ON alerts(ts DESC);
  `);
}

export function getSetting(db: AppDb, key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(db: AppDb, key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}

type SnapshotRow = {
  ts: number;
  source: DataSource;
  pv_w: number;
  pv1_v: number | null;
  pv1_a: number | null;
  pv1_w: number | null;
  pv2_v: number | null;
  pv2_a: number | null;
  pv2_w: number | null;
  load_w: number;
  ups_w: number | null;
  grid_w: number;
  grid_status: Sample["gridStatus"];
  battery_w: number;
  battery_soc: number;
  battery_v: number | null;
  battery_a: number | null;
  battery_temp: number | null;
  ac_v: number | null;
  ac_hz: number | null;
  inverter_temp: number | null;
  operating_mode: string | null;
  online: number;
};

function toSample(row: SnapshotRow): Sample {
  return {
    ts: row.ts,
    source: row.source,
    pvW: row.pv_w,
    pv1V: row.pv1_v,
    pv1A: row.pv1_a,
    pv1W: row.pv1_w,
    pv2V: row.pv2_v,
    pv2A: row.pv2_a,
    pv2W: row.pv2_w,
    loadW: row.load_w,
    upsW: row.ups_w ?? 0,
    gridW: row.grid_w,
    gridStatus: row.grid_status,
    batteryW: row.battery_w,
    batterySoc: row.battery_soc,
    batteryV: row.battery_v,
    batteryA: row.battery_a,
    batteryTemp: row.battery_temp,
    acV: row.ac_v,
    acHz: row.ac_hz,
    inverterTemp: row.inverter_temp,
    operatingMode: row.operating_mode || "Manual Mode",
    online: row.online === 1,
  };
}

const UPSERT = `
  INSERT INTO snapshots (
    ts, source, pv_w, pv1_v, pv1_a, pv1_w, pv2_v, pv2_a, pv2_w,
    load_w, ups_w, grid_w, grid_status, battery_w, battery_soc, battery_v, battery_a, battery_temp,
    ac_v, ac_hz, inverter_temp, operating_mode, online
  ) VALUES (
    @ts, @source, @pv_w, @pv1_v, @pv1_a, @pv1_w, @pv2_v, @pv2_a, @pv2_w,
    @load_w, @ups_w, @grid_w, @grid_status, @battery_w, @battery_soc, @battery_v, @battery_a, @battery_temp,
    @ac_v, @ac_hz, @inverter_temp, @operating_mode, @online
  )
  ON CONFLICT(ts, source) DO UPDATE SET
    pv_w = excluded.pv_w,
    pv1_v = excluded.pv1_v,
    pv1_a = excluded.pv1_a,
    pv1_w = excluded.pv1_w,
    pv2_v = excluded.pv2_v,
    pv2_a = excluded.pv2_a,
    pv2_w = excluded.pv2_w,
    load_w = excluded.load_w,
    ups_w = excluded.ups_w,
    grid_w = excluded.grid_w,
    grid_status = excluded.grid_status,
    battery_w = excluded.battery_w,
    battery_soc = excluded.battery_soc,
    battery_v = excluded.battery_v,
    battery_a = excluded.battery_a,
    battery_temp = excluded.battery_temp,
    ac_v = excluded.ac_v,
    ac_hz = excluded.ac_hz,
    inverter_temp = excluded.inverter_temp,
    operating_mode = excluded.operating_mode,
    online = excluded.online
`;

export function insertSnapshot(db: AppDb, sample: Sample): void {
  db.prepare(UPSERT).run({
    ts: sample.ts,
    source: sample.source,
    pv_w: sample.pvW,
    pv1_v: sample.pv1V,
    pv1_a: sample.pv1A,
    pv1_w: sample.pv1W,
    pv2_v: sample.pv2V,
    pv2_a: sample.pv2A,
    pv2_w: sample.pv2W,
    load_w: sample.loadW,
    ups_w: sample.upsW,
    grid_w: sample.gridW,
    grid_status: sample.gridStatus,
    battery_w: sample.batteryW,
    battery_soc: sample.batterySoc,
    battery_v: sample.batteryV,
    battery_a: sample.batteryA,
    battery_temp: sample.batteryTemp,
    ac_v: sample.acV,
    ac_hz: sample.acHz,
    inverter_temp: sample.inverterTemp,
    operating_mode: sample.operatingMode,
    online: sample.online ? 1 : 0,
  });
}

export function insertSnapshots(db: AppDb, samples: Sample[]): void {
  const stmt = db.prepare(UPSERT);
  const tx = db.transaction((rows: Sample[]) => {
    for (const sample of rows) {
      stmt.run({
        ts: sample.ts,
        source: sample.source,
        pv_w: sample.pvW,
        pv1_v: sample.pv1V,
        pv1_a: sample.pv1A,
        pv1_w: sample.pv1W,
        pv2_v: sample.pv2V,
        pv2_a: sample.pv2A,
        pv2_w: sample.pv2W,
        load_w: sample.loadW,
        ups_w: sample.upsW,
        grid_w: sample.gridW,
        grid_status: sample.gridStatus,
        battery_w: sample.batteryW,
        battery_soc: sample.batterySoc,
        battery_v: sample.batteryV,
        battery_a: sample.batteryA,
        battery_temp: sample.batteryTemp,
        ac_v: sample.acV,
        ac_hz: sample.acHz,
        inverter_temp: sample.inverterTemp,
        operating_mode: sample.operatingMode,
        online: sample.online ? 1 : 0,
      });
    }
  });
  tx(samples);
}

export function latestSnapshot(db: AppDb, source: DataSource): Sample | null {
  const row = db.prepare("SELECT * FROM snapshots WHERE source = ? ORDER BY ts DESC LIMIT 1").get(source) as SnapshotRow | undefined;
  return row ? toSample(row) : null;
}

export function snapshotsBetween(db: AppDb, source: DataSource, start: number, end: number): Sample[] {
  const rows = db
    .prepare("SELECT * FROM snapshots WHERE source = ? AND ts >= ? AND ts <= ? ORDER BY ts ASC")
    .all(source, start, end) as SnapshotRow[];
  return rows.map(toSample);
}

export function countSnapshots(db: AppDb, source: DataSource): number {
  const row = db.prepare("SELECT COUNT(*) AS c FROM snapshots WHERE source = ?").get(source) as { c: number };
  return row.c;
}

export function deleteSource(db: AppDb, source: DataSource): void {
  db.prepare("DELETE FROM snapshots WHERE source = ?").run(source);
  db.prepare("DELETE FROM energy WHERE source = ?").run(source);
  db.prepare("DELETE FROM alerts WHERE source = ?").run(source);
}

export function getEnergy(db: AppDb, source: DataSource, grain: "day" | "month", period: string): EnergyRow | null {
  const row = db
    .prepare(
      `SELECT period, grain, source, production_kwh AS productionKwh, load_kwh AS loadKwh,
              charge_kwh AS chargeKwh, discharge_kwh AS dischargeKwh, import_kwh AS importKwh,
              export_kwh AS exportKwh, soc_close AS socClose
       FROM energy WHERE source = ? AND grain = ? AND period = ?`,
    )
    .get(source, grain, period) as EnergyRow | undefined;
  return row ?? null;
}

export function upsertEnergy(db: AppDb, source: DataSource, period: string, grain: "day" | "month", totals: EnergyTotals): void {
  const merged = mergeEnergyTotals(totals, getEnergy(db, source, grain, period));
  db.prepare(
    `INSERT INTO energy (
      period, grain, source, production_kwh, load_kwh, charge_kwh, discharge_kwh, import_kwh, export_kwh, soc_close
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(period, grain, source) DO UPDATE SET
      production_kwh = excluded.production_kwh,
      load_kwh = excluded.load_kwh,
      charge_kwh = excluded.charge_kwh,
      discharge_kwh = excluded.discharge_kwh,
      import_kwh = excluded.import_kwh,
      export_kwh = excluded.export_kwh,
      soc_close = excluded.soc_close`,
  ).run(
    period,
    grain,
    source,
    merged.productionKwh,
    merged.loadKwh,
    merged.chargeKwh,
    merged.dischargeKwh,
    merged.importKwh,
    merged.exportKwh,
    merged.socClose,
  );
}

export type EnergyRow = EnergyTotals & { period: string; grain: "day" | "month"; source: DataSource };

export function energyRows(db: AppDb, source: DataSource, grain: "day" | "month", fromPeriod: string): EnergyRow[] {
  return db
    .prepare(
      `SELECT period, grain, source, production_kwh AS productionKwh, load_kwh AS loadKwh,
              charge_kwh AS chargeKwh, discharge_kwh AS dischargeKwh, import_kwh AS importKwh,
              export_kwh AS exportKwh, soc_close AS socClose
       FROM energy WHERE source = ? AND grain = ? AND period >= ? ORDER BY period ASC`,
    )
    .all(source, grain, fromPeriod) as EnergyRow[];
}

export function insertAlert(db: AppDb, draft: AlertDraft, source: DataSource, acknowledged = false): void {
  db.prepare("INSERT INTO alerts (ts, source, rule, severity, message, acknowledged) VALUES (?, ?, ?, ?, ?, ?)").run(
    draft.ts,
    source,
    draft.rule,
    draft.severity,
    draft.message,
    acknowledged ? 1 : 0,
  );
}

export function listAlerts(db: AppDb, limit = 100): {
  id: number;
  ts: number;
  source: DataSource;
  rule: AlertRuleId;
  severity: "warning" | "critical";
  message: string;
  acknowledged: boolean;
}[] {
  const rows = db
    .prepare("SELECT id, ts, source, rule, severity, message, acknowledged FROM alerts ORDER BY ts DESC LIMIT ?")
    .all(limit) as {
    id: number;
    ts: number;
    source: DataSource;
    rule: AlertRuleId;
    severity: "warning" | "critical";
    message: string;
    acknowledged: number;
  }[];
  return rows.map((row) => ({ ...row, acknowledged: row.acknowledged === 1 }));
}

export function unreadCount(db: AppDb): number {
  const row = db.prepare("SELECT COUNT(*) AS c FROM alerts WHERE acknowledged = 0").get() as { c: number };
  return row.c;
}

export function openAlertRules(db: AppDb, since: number): AlertRuleId[] {
  const rows = db
    .prepare("SELECT DISTINCT rule FROM alerts WHERE acknowledged = 0 AND ts >= ?")
    .all(since) as { rule: AlertRuleId }[];
  return rows.map((row) => row.rule);
}

export function acknowledgeAlert(db: AppDb, id: number): void {
  db.prepare("UPDATE alerts SET acknowledged = 1 WHERE id = ?").run(id);
}

export function acknowledgeAll(db: AppDb): void {
  db.prepare("UPDATE alerts SET acknowledged = 1 WHERE acknowledged = 0").run();
}
