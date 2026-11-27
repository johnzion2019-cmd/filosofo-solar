"use client";

import { usePlant } from "@/components/plant-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPower } from "@/lib/format";

function metric(value: number | null | undefined, digits: number, unit: string): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)} ${unit}`;
}

export function InverterView() {
  const { data, error, loading, reload } = usePlant();
  if (loading && !data) return <div className="h-64 animate-pulse rounded-2xl bg-white/5" />;
  if (error && !data) {
    return (
      <Card>
        <CardContent className="space-y-3 py-6">
          <p className="text-sm">Inverter details didn’t load. {error}</p>
          <Button onClick={() => void reload()}>Try again</Button>
        </CardContent>
      </Card>
    );
  }
  if (!data?.live) {
    return <Card><CardContent className="py-6 text-sm text-muted-foreground">Waiting for the first reading from inverter {data?.inverter.serial ?? "2508073177"}.</CardContent></Card>;
  }
  const live = data.live;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Inverter {data.inverter.serial}</h2>
          <p className="text-sm text-muted-foreground">
            {data.inverter.model} · {(data.inverter.ratedW / 1000).toFixed(1)} kW · {data.inverter.batteryKwh.toFixed(2)} kWh battery
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={live.online ? "success" : "danger"}>{live.online ? "Online" : "Offline"}</Badge>
          <Badge variant="outline">{live.operatingMode}</Badge>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>PV strings</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 pb-4">
            <Field label="String 1" value={`${metric(live.pv1V, 1, "V")} · ${metric(live.pv1A, 2, "A")}`} hint={live.pv1W != null ? formatPower(live.pv1W) : undefined} />
            <Field label="String 2" value={`${metric(live.pv2V, 1, "V")} · ${metric(live.pv2A, 2, "A")}`} hint={live.pv2W != null ? formatPower(live.pv2W) : undefined} />
            <Field label="Array power" value={formatPower(live.pvW)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Battery</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 pb-4">
            <Field label="State of charge" value={`${live.batterySoc.toFixed(0)}%`} />
            <Field label="Power" value={formatPower(live.batteryW, true)} hint={live.batteryW < -25 ? "Charging" : live.batteryW > 25 ? "Discharging" : "Idle"} />
            <Field label="Voltage" value={metric(live.batteryV, 1, "V")} />
            <Field label="Current" value={metric(live.batteryA, 1, "A")} />
            <Field label="Temperature" value={metric(live.batteryTemp, 1, "°C")} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>AC output</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 pb-4">
            <Field label="Voltage" value={metric(live.acV, 1, "V")} />
            <Field label="Frequency" value={metric(live.acHz, 2, "Hz")} />
            <Field label="Grid" value={live.gridStatus === "off-grid" ? "Off-grid" : "On-grid"} />
            <Field label="Grid power" value={formatPower(live.gridW, true)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Inverter</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 pb-4">
            <Field label="Temperature" value={metric(live.inverterTemp, 1, "°C")} />
            <Field label="Home Load" value={formatPower(live.loadW)} />
            <Field label="Operating mode" value={live.operatingMode} />
            <Field label="Serial" value={data.inverter.serial} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tabular mt-1 text-sm font-medium">{value}</div>
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
