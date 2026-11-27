import { getConfig, saveDeyeStatus } from "@/lib/config";
import { getDb } from "@/lib/db";
import { catchUpDemo } from "@/lib/runtime";
import { ensureDeyeDailyHistory, pullDeyeLatest, storeDeyeSample } from "@/lib/sync";
import { errorMessage } from "@/lib/utils";

const globalForPoller = globalThis as unknown as { filosofoPoller?: boolean };

export function startPoller(): void {
  if (globalForPoller.filosofoPoller) return;
  globalForPoller.filosofoPoller = true;

  const loop = async () => {
    let delay = 60_000;
    try {
      const db = getDb();
      catchUpDemo(db);
      const cfg = getConfig(db);
      delay = cfg.pollIntervalSec * 1000;
      if (cfg.deyeConfigured) {
        try {
          const sample = await pullDeyeLatest(db);
          await storeDeyeSample(db, sample);
        } catch (error) {
          saveDeyeStatus(db, false, errorMessage(error));
        }
        try {
          await ensureDeyeDailyHistory(db);
        } catch (error) {
          console.error("Deye daily history sync failed:", errorMessage(error));
        }
      }
    } catch (error) {
      console.error("Solar poller tick failed:", errorMessage(error));
    } finally {
      setTimeout(loop, delay);
    }
  };

  setTimeout(loop, 2_000);
}
