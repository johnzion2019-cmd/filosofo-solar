"use client";

import type { AlertItem } from "@/components/models";
import { useJson } from "@/components/use-json";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePlant } from "@/components/plant-context";

function stamp(ts: number, timeZone: string): string {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ts));
  return timeZone === "Asia/Manila" ? `${formatted} PHT` : formatted;
}

export function AlertsView() {
  const plant = usePlant();
  const { data, error, loading, reload } = useJson<{ alerts: AlertItem[] }>("/api/alerts", 20_000);
  const timeZone = plant.data?.plant.timeZone ?? "Asia/Manila";

  async function acknowledge(body: { id?: number; all?: boolean }) {
    await fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    await reload();
    await plant.reload();
  }

  const alerts = data?.alerts ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Alerts</h2>
          <p className="text-sm text-muted-foreground">Low battery, grid outages, and an inverter that stops reporting.</p>
        </div>
        {alerts.some((alert) => !alert.acknowledged) ? (
          <Button variant="outline" onClick={() => void acknowledge({ all: true })}>Acknowledge all</Button>
        ) : null}
      </div>
      {loading && !data ? <div className="h-28 animate-pulse rounded-2xl bg-white/5" /> : null}
      {error ? (
        <Card>
          <CardContent className="space-y-3 py-6">
            <p className="text-sm">The alert log didn’t load. {error}</p>
            <Button onClick={() => void reload()}>Try again</Button>
          </CardContent>
        </Card>
      ) : null}
      {data && alerts.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">No alerts yet. Rules are edited on the Settings page.</CardContent>
        </Card>
      ) : null}
      <div className="space-y-2">
        {alerts.map((alert) => (
          <Card key={alert.id}>
            <CardContent className="flex flex-wrap items-start justify-between gap-3 pt-4">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant={alert.severity === "critical" ? "danger" : "warning"}>{alert.severity === "critical" ? "Critical" : "Warning"}</Badge>
                  <span className="text-xs text-muted-foreground">{stamp(alert.ts, timeZone)}</span>
                  {alert.acknowledged ? <span className="text-xs text-muted-foreground">Acknowledged</span> : null}
                </div>
                <p className="text-sm">{alert.message}</p>
              </div>
              {!alert.acknowledged ? (
                <Button size="sm" variant="secondary" onClick={() => void acknowledge({ id: alert.id })}>Acknowledge</Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
