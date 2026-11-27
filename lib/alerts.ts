import type { AlertDraft, AlertRuleConfig, AlertRuleId, Sample } from "@/lib/types";

export function evaluateRules(
  sample: Sample,
  ageMinutes: number,
  rules: AlertRuleConfig,
  openRules: Set<AlertRuleId>,
): AlertDraft[] {
  const drafts: AlertDraft[] = [];
  if (rules.lowSocEnabled && sample.batterySoc < rules.lowSocThreshold && !openRules.has("low-soc")) {
    drafts.push({
      ts: sample.ts,
      rule: "low-soc",
      severity: "warning",
      message: `Battery at ${sample.batterySoc.toFixed(1)}% — below the ${rules.lowSocThreshold.toFixed(0)}% line.`,
    });
  }
  if (rules.gridEnabled && sample.gridStatus === "off-grid" && !openRules.has("grid-outage")) {
    drafts.push({
      ts: sample.ts,
      rule: "grid-outage",
      severity: "critical",
      message: "Grid outage. The inverter is running off-grid.",
    });
  }
  if (
    rules.offlineEnabled &&
    (!sample.online || ageMinutes >= rules.offlineMinutes) &&
    !openRules.has("inverter-offline")
  ) {
    drafts.push({
      ts: sample.ts,
      rule: "inverter-offline",
      severity: "critical",
      message: sample.online
        ? `Inverter telemetry is ${Math.round(ageMinutes)} minutes old.`
        : "Inverter is offline.",
    });
  }
  return drafts;
}
