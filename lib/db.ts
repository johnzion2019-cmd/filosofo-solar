import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { ensureDefaults } from "@/lib/config";
import { countSnapshots, deleteSource, migrate, type AppDb } from "@/lib/repo";
import { seedDemo } from "@/lib/seed";

const globalForDb = globalThis as unknown as { filosofoDb?: AppDb };

export function databaseFile(): string {
  return process.env.DATABASE_PATH || path.join(process.cwd(), "data", "filosofo.sqlite");
}

export function openDatabase(file: string, options?: { seed?: boolean }): AppDb {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  ensureDefaults(db);
  if (options?.seed !== false && countSnapshots(db, "demo") === 0) seedDemo(db);
  return db;
}

export function getDb(): AppDb {
  if (!globalForDb.filosofoDb) {
    globalForDb.filosofoDb = openDatabase(databaseFile());
    void import("@/lib/poller").then((mod) => mod.startPoller());
  }
  return globalForDb.filosofoDb;
}

export function resetDemoData(db: AppDb): void {
  deleteSource(db, "demo");
  seedDemo(db);
}
