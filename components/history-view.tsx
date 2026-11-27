"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HistoryData } from "@/components/models";
import { useJson } from "@/components/use-json";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const RANGES = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "year", label: "Year" },
] as const;

const SERIES = [
  { key: "pv", name: "PV", color: "#3dd68c" },
  { key: "load", name: "Load", color: "#ffb020" },
  { key: "grid", name: "Grid", color: "#c4b5fd" },
  { key: "battery", name: "Battery", color: "#49d2ff" },
] as const;

export function HistoryView() {
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("today");
  const [visible, setVisible] = useState<Record<string, boolean>>({ pv: true, load: true, grid: true, battery: true, soc: true });
  const { data, error, loading, reload } = useJson<HistoryData>(`/api/history?range=${range}`);
  const unit = data?.unit ?? (range === "today" || range === "7d" ? "kW" : "kWh");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">History</h2>
          <p className="text-sm text-muted-foreground">
            {unit === "kW" ? "Average power through the period." : "Energy totals. Grid and battery keep the live sign: positive grid is import, positive battery is discharge."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const link = document.createElement("a");
            link.href = "/api/export/csv";
            link.download = "filosofo-solar-report.csv";
            document.body.appendChild(link);
            link.click();
            link.remove();
          }}
          className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/15"
        >
          <Download className="size-3.5" /> Export CSV
        </button>
        <Tabs value={range} onValueChange={(value) => setRange(value as typeof range)}>
          <TabsList>
            {RANGES.map((item) => (
              <TabsTrigger key={item.id} value={item.id}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {SERIES.map((series) => (
          <button
            key={series.key}
            type="button"
            onClick={() => setVisible((current) => ({ ...current, [series.key]: !current[series.key] }))}
            className={cn("rounded-full border px-3 py-1 text-xs", visible[series.key] ? "border-transparent text-[#04101f]" : "border-border text-muted-foreground")}
            style={visible[series.key] ? { background: series.color } : undefined}
          >
            {series.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setVisible((current) => ({ ...current, soc: !current.soc }))}
          className={cn("rounded-full border px-3 py-1 text-xs", visible.soc ? "border-transparent bg-[#49d2ff] text-[#04101f]" : "border-border text-muted-foreground")}
        >
          SOC %
        </button>
      </div>
      <Card>
        <CardContent className="h-[340px] pt-4">
          {loading && !data ? <div className="h-full animate-pulse rounded-xl bg-white/5" /> : null}
          {error ? (
            <div className="flex h-full flex-col items-start justify-center gap-3 text-sm">
              <p>History didn’t load. {error}</p>
              <Button onClick={() => void reload()}>Try again</Button>
            </div>
          ) : null}
          {data && data.points.length === 0 ? (
            <div className="flex h-full items-center text-sm text-muted-foreground">No readings in this range yet.</div>
          ) : null}
          {data && data.points.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.points} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148,176,220,0.12)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#93a0bd", fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
                <YAxis yAxisId="power" tick={{ fill: "#93a0bd", fontSize: 11 }} width={48} unit={unit === "kW" ? "" : ""} />
                <YAxis yAxisId="soc" orientation="right" domain={[0, 100]} tick={{ fill: "#49d2ff", fontSize: 11 }} width={36} />
                <Tooltip
                  contentStyle={{ background: "#101826", border: "1px solid rgba(148,176,220,0.2)", borderRadius: 12 }}
                  labelStyle={{ color: "#e8eefc" }}
                  formatter={(value, name) => {
                    const numeric = typeof value === "number" ? value : Number(value);
                    const digits = name === "SOC %" ? 0 : 2;
                    const suffix = name === "SOC %" ? "%" : ` ${unit}`;
                    return [`${Number.isFinite(numeric) ? numeric.toFixed(digits) : "—"}${suffix}`, name];
                  }}
                />
                <Legend />
                {SERIES.map((series) =>
                  visible[series.key] ? (
                    <Area
                      key={series.key}
                      yAxisId="power"
                      type="monotone"
                      dataKey={series.key}
                      name={series.name}
                      stroke={series.color}
                      fill={series.color}
                      fillOpacity={0.12}
                      strokeWidth={2}
                      dot={false}
                    />
                  ) : null,
                )}
                {visible.soc ? (
                  <Line yAxisId="soc" type="monotone" dataKey="soc" name="SOC %" stroke="#49d2ff" strokeWidth={2} dot={false} connectNulls />
                ) : null}
              </ComposedChart>
            </ResponsiveContainer>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
