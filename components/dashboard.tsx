"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  Battery,
  Check,
  CloudSun,
  Download,
  House,
  LogOut,
  Moon,
  RefreshCw,
  Settings,
  SunMedium,
  Thermometer,
  Wallet,
  Zap,
} from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePlant } from "@/components/plant-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DashboardData } from "@/components/models";
import type { SolarForecast } from "@/lib/forecast";
import { plantHeroPeriod, type HeroPeriod } from "@/lib/house-hero";
import type { Payback } from "@/lib/payback";
import type { PlantRecords } from "@/lib/records";
import { formatAgo, formatKwh1, formatKw, formatPeso } from "@/lib/format";
import type { Sample } from "@/lib/types";
import { cn } from "@/lib/utils";

function useRefreshCountdown(receivedAt: number, refreshMs: number | null) {
  const [left, setLeft] = useState(() => Math.max(0, (refreshMs ?? 0) - (Date.now() - receivedAt)));
  useEffect(() => {
    if (!refreshMs) {
      setLeft(0);
      return;
    }
    function tick() {
      setLeft(Math.max(0, (refreshMs ?? 0) - (Date.now() - receivedAt)));
    }
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [receivedAt, refreshMs]);
  return Math.ceil(left / 1000);
}

function downloadCsv() {
  const link = document.createElement("a");
  link.href = "/api/export/csv";
  link.download = "filosofo-solar-report.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function useDashboardClock(timeZone: string) {
  const [now, setNow] = useState(() => new Date());
  const [greeting, setGreeting] = useState("Hello");
  useEffect(() => {
    function tick() {
      const date = new Date();
      setNow(date);
      const hour = date.getHours();
      setGreeting(hour < 5 || hour >= 18 ? "Good Evening" : hour < 12 ? "Good Morning" : "Good Afternoon");
    }
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);
  const zoneLabel = timeZone === "Asia/Manila" ? "PHT" : timeZone;
  return { greeting, time, zoneLabel };
}

export function DashboardView() {
  const { data, error, loading, reload, receivedAt, refreshMs } = usePlant();
  const clock = useDashboardClock(data?.plant.timeZone ?? "Asia/Manila");
  const secondsLeft = useRefreshCountdown(receivedAt, refreshMs);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 15_000);
    return () => clearInterval(timer);
  }, []);
  void tick;

  if (loading && !data) return <div className="mx-auto h-[70vh] max-w-xl animate-pulse rounded-3xl bg-white/5" />;
  if (error && !data) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-border p-6">
        <p className="text-sm">The plant overview didn’t load. {error}</p>
        <Button className="mt-3" onClick={() => void reload()}>Try again</Button>
      </div>
    );
  }
  if (!data?.live || !data.today || !data.cycle || !data.earnings) {
    return <div className="mx-auto max-w-xl rounded-3xl border border-border p-6 text-sm text-muted-foreground">Waiting for the first reading from inverter {data?.inverter.serial ?? "2508073177"}.</div>;
  }

  const ago = data.updatedAt != null ? formatAgo(data.updatedAt, data.clockNow + (Date.now() - receivedAt)) : "waiting";
  const liveLabel = data.mode === "demo" ? "DEMO" : "LIVE";

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 lg:max-w-5xl">
      <header className="px-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{clock.greeting}</h1>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/settings" className="grid size-9 place-items-center rounded-full bg-white/8 hover:bg-white/15" aria-label="Settings">
              <Settings className="size-4" />
            </Link>
            <button type="button" className="grid size-9 place-items-center rounded-full bg-white/8 hover:bg-white/15" aria-label="Refresh" onClick={() => void reload()}>
              <RefreshCw className="size-4" />
            </button>
            <span className="tabular hidden text-[11px] text-muted-foreground sm:inline">
              {secondsLeft > 0 ? `Next refresh in ${secondsLeft}s` : "Refreshing…"}
            </span>
            <span className="tabular hidden text-sm font-medium sm:inline">{clock.time} {clock.zoneLabel}</span>
            {data.pinEnabled ? (
              <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => void signOut()}>
                <LogOut className="size-3.5" /> Sign Out
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/80">
          <SunMedium className="size-3.5 text-amber-300" />
          <span className="font-semibold tracking-wide">{data.plant.name.toUpperCase()}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 font-semibold text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            {liveLabel}
          </span>
          <span className="text-muted-foreground">· {ago}</span>
          <span className="tabular text-muted-foreground sm:hidden">{secondsLeft > 0 ? `Next refresh in ${secondsLeft}s` : "Refreshing…"}</span>
          <span className="sm:hidden tabular">{clock.time} {clock.zoneLabel}</span>
          <span className="text-muted-foreground">{data.plant.location} · {clock.time} {clock.zoneLabel}</span>
          {data.weather ? <span className="text-muted-foreground">{data.weather.tempF.toFixed(0)}°F · {data.weather.label}</span> : null}
        </div>
      </header>

      <HouseHero
        live={data.live}
        photo={data.housePhotoUrl}
        custom={data.housePhotoCustom}
        dayUrl={data.houseDayUrl}
        nightUrl={data.houseNightUrl}
        timeZone={data.plant.timeZone}
      />
      {data.forecast ? <ForecastCard forecast={data.forecast} /> : null}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        <EnergySummary data={data} />
        <BatteryCard data={data} />
        <StringsCard data={data} />
        <ProductionGauge data={data} />
        <div className="flex flex-col gap-3">
          <SolarLoadChart data={data} />
          <BatteryChart data={data} />
        </div>
        <div className="lg:col-span-2">
          <EarningsCard data={data} />
        </div>
        <div className="flex flex-col gap-3">
          <SavingsCard data={data} />
          <BillCard data={data} />
        </div>
        <div className="lg:col-span-2">
          <HealthCard data={data} />
        </div>
      </div>
    </div>
  );
}

function CardShell({ title, aside, children, className }: { title?: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-3xl border border-white/10 bg-[#121a2b]/90 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.25)]", className)}>
      {title ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{title}</h2>
          {aside ? <span className="text-xs text-muted-foreground">{aside}</span> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function HouseHero({
  live,
  photo,
  custom,
  dayUrl,
  nightUrl,
  timeZone,
}: {
  live: Sample;
  photo: string;
  custom: boolean;
  dayUrl: string;
  nightUrl: string;
  timeZone: string;
}) {
  const off = live.gridStatus === "off-grid";
  const [mode, setMode] = useState<"auto" | HeroPeriod>("auto");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const saved = window.localStorage.getItem("filosofo-hero-photo");
    if (saved === "auto" || saved === "day" || saved === "night") setMode(saved);
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const autoPeriod = plantHeroPeriod(now, timeZone);
  const period: HeroPeriod = custom ? autoPeriod : mode === "auto" ? autoPeriod : mode;
  const src = custom ? photo : period === "day" ? dayUrl : nightUrl;

  function pick(next: "auto" | HeroPeriod) {
    setMode(next);
    window.localStorage.setItem("filosofo-hero-photo", next);
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
      <div className="relative aspect-[4/3] w-full">
        <Image src={src} alt="Filosofo house in Negros Oriental" fill priority unoptimized className="object-cover object-center" />
      </div>
      {custom ? null : (
        <div className="absolute left-3 top-3 z-10 inline-flex rounded-full border border-white/25 bg-black/70 p-0.5 shadow-lg backdrop-blur-sm">
          {([
            { id: "auto", label: "Auto" },
            { id: "day", label: "Day", icon: <SunMedium className="size-3" /> },
            { id: "night", label: "Night", icon: <Moon className="size-3" /> },
          ] as const).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => pick(item.id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                mode === item.id ? "bg-white/20 text-white" : "text-white/70 hover:text-white",
              )}
              aria-pressed={mode === item.id}
              aria-label={item.id === "auto" ? "Automatic day or night house photo" : `Preview ${item.id} house photo`}
            >
              {"icon" in item ? item.icon : null}
              {item.label}
            </button>
          ))}
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-black/5 to-black/40" />
      <svg viewBox="0 0 360 240" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <path d="M180 50 C 180 105, 180 140, 180 168" fill="none" stroke="#f5d76e" strokeWidth="1.6" strokeDasharray="2 4" className="flow-dash" />
        <path d="M72 188 C 115 188, 150 182, 168 174" fill="none" stroke="#3dd68c" strokeWidth="1.6" strokeDasharray="2 4" className="flow-dash" />
      </svg>
      <FlowNode align="center" className="left-1/2 top-[5%]" icon={<SunMedium className="size-4 text-amber-200" />} tone="bg-amber-400/25" label="PV Array" value={formatKw(live.pvW)} />
      <FlowNode align="end" className="right-3 top-[12%]" icon={<Zap className="size-4 text-amber-200" />} tone="bg-amber-300/20" label="Grid" value={formatKw(Math.abs(live.gridW))} badge={off ? "Off-grid" : undefined} />
      <FlowNode align="start" className="bottom-[8%] left-3" icon={<Battery className="size-4 text-emerald-300" />} tone="bg-emerald-400/25" label="Battery" value={`${formatKw(Math.abs(live.batteryW))} · ${live.batterySoc.toFixed(0)}%`} />
      <FlowNode align="center" className="bottom-[8%] left-1/2" icon={<House className="size-4 text-emerald-200" />} tone="bg-emerald-500/30" label="Home" value={formatKw(live.loadW)} />
    </section>
  );
}

function FlowNode({ align, className, icon, tone, label, value, badge }: { align: "start" | "center" | "end"; className: string; icon: React.ReactNode; tone: string; label: string; value: string; badge?: string }) {
  return (
    <div className={cn("absolute flex max-w-[42%] flex-col text-center", align === "center" && "left-1/2 -translate-x-1/2 items-center", align === "start" && "items-start text-left", align === "end" && "items-end text-right", className)}>
      <span className={cn("grid size-9 place-items-center rounded-full border border-white/40 shadow-lg backdrop-blur-md", tone)}>{icon}</span>
      <span className="mt-1 rounded-xl border border-white/25 bg-black/80 px-2 py-1 text-[10px] font-medium leading-tight text-white shadow-[0_4px_14px_rgba(0,0,0,0.55)] backdrop-blur-sm">
        {label}
        <span className="tabular mt-0.5 block text-xs font-semibold">{value}</span>
      </span>
      {badge ? <span className="mt-0.5 rounded-full bg-rose-500/90 px-1.5 py-0.5 text-[9px] font-semibold text-white">{badge}</span> : null}
    </div>
  );
}

function ForecastCard({ forecast }: { forecast: SolarForecast }) {
  const days = [
    { title: "Today", day: forecast.today },
    { title: "Tomorrow", day: forecast.tomorrow },
  ];
  return (
    <CardShell title="Solar Forecast" aside="Est.">
      <div className="grid grid-cols-2 gap-3">
        {days.map((item) => (
          <div key={item.title} className="rounded-2xl bg-black/25 p-3">
            <div className="text-[11px] font-semibold tracking-wide text-amber-300">{item.title.toUpperCase()}</div>
            <div className="tabular mt-1 text-2xl font-semibold text-amber-100">{formatKwh1(item.day.estKwh)} kWh</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {item.day.label}
              {item.day.cloudCoverPct != null ? ` · ${Math.round(item.day.cloudCoverPct)}% cloud` : ""}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 inline-flex items-start gap-2 text-sm text-emerald-100/90">
        <CloudSun className="mt-0.5 size-4 shrink-0 text-amber-300" />
        <span>{forecast.tip}</span>
      </p>
    </CardShell>
  );
}

function RecordsStrip({ records }: { records: PlantRecords }) {
  const items = [
    {
      label: "Best Day",
      primary: records.bestDay ? records.bestDay.label : "—",
      secondary: records.bestDay ? `${formatKwh1(records.bestDay.kwh)} kWh · ${formatPeso(records.bestDay.php)}` : "No daily history yet",
    },
    {
      label: "30-Day Avg",
      primary: records.average ? `${formatKwh1(records.average.kwh)} kWh` : "—",
      secondary: records.average ? `${formatPeso(records.average.php)}/day` : "No daily history yet",
    },
    {
      label: "Best Month",
      primary: records.bestMonth ? records.bestMonth.label : "—",
      secondary: records.bestMonth ? formatPeso(records.bestMonth.php) : "No monthly history yet",
    },
  ];
  return (
    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 rounded-2xl bg-black/25 px-3 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-300">{item.label}</div>
          <div className="mt-1 truncate text-sm font-semibold">{item.primary}</div>
          <div className="mt-0.5 text-xs leading-snug text-muted-foreground">{item.secondary}</div>
        </div>
      ))}
    </div>
  );
}

function EnergySummary({ data }: { data: DashboardData }) {
  const tiles = [
    { icon: <SunMedium className="size-4 text-amber-300" />, label: "Generation", value: formatKwh1(data.today.productionKwh) },
    { icon: <Battery className="size-4 text-emerald-300" />, label: "To Battery", value: formatKwh1(data.today.chargeKwh) },
    { icon: <House className="size-4 text-orange-300" />, label: "Consumption", value: formatKwh1(data.directKwh) },
    { icon: <House className="size-4 text-sky-300" />, label: "Total Consumption", value: formatKwh1(data.today.loadKwh) },
    { icon: <ArrowDownToLine className="size-4 text-sky-300" />, label: "Import", value: formatKwh1(data.today.importKwh) },
    { icon: <ArrowUpFromLine className="size-4 text-violet-300" />, label: "Export", value: formatKwh1(data.today.exportKwh) },
  ];
  return (
    <CardShell title="Energy Summary" aside="Today">
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="text-center">
            <div className="mx-auto mb-1 grid size-8 place-items-center rounded-full bg-white/5">{tile.icon}</div>
            <div className="tabular text-lg font-semibold leading-none">{tile.value}</div>
            <div className="text-[10px] text-muted-foreground">kWh</div>
            <div className="mt-1 text-[11px] text-white/70">{tile.label}</div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function BatteryCard({ data }: { data: DashboardData }) {
  const live = data.live!;
  const stored = (live.batterySoc / 100) * data.inverter.batteryKwh;
  const charging = live.batteryW < -15;
  return (
    <CardShell title="Battery Details">
      <div className="flex items-center gap-4">
        <div className="relative h-36 w-[4.5rem] shrink-0">
          <div className="absolute left-1/2 top-0 h-2 w-6 -translate-x-1/2 rounded-t-md bg-emerald-400" />
          <div className="absolute inset-x-0 bottom-0 top-2 overflow-hidden rounded-2xl border-2 border-emerald-400 bg-black/40">
            <div className="absolute inset-x-1 bottom-1 rounded-xl bg-emerald-400 transition-[height] duration-700" style={{ height: `${Math.max(6, Math.min(100, live.batterySoc))}%` }} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="tabular text-4xl font-semibold leading-none text-white">{live.batterySoc.toFixed(0)}%</div>
          <div className="mt-1 text-sm text-emerald-300">{formatKwh1(stored)} kWh <span className="text-muted-foreground">of {formatKwh1(data.inverter.batteryKwh)} kWh</span></div>
          {data.batteryRuntime ? (
            <div className="mt-1 text-sm text-amber-200/90">{data.batteryRuntime.label}</div>
          ) : null}
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row icon={<Zap className="size-3.5 text-amber-300" />} label={charging ? "Charging" : "Discharging"} value={formatKw(Math.abs(live.batteryW))} />
            <Row icon={<Zap className="size-3.5 text-sky-300" />} label="Voltage" value={live.batteryV != null ? `${live.batteryV.toFixed(2)} V` : "—"} />
            <Row icon={<span className="text-xs text-sky-300">∿</span>} label="Current" value={live.batteryA != null ? `${Math.abs(live.batteryA).toFixed(2)} A` : "—"} />
            <Row icon={<Thermometer className="size-3.5 text-rose-300" />} label="Temp" value={live.batteryTemp != null ? `${live.batteryTemp.toFixed(2)} °C` : "—"} />
          </dl>
        </div>
      </div>
    </CardShell>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="inline-flex items-center gap-2 text-muted-foreground">{icon}{label}</dt>
      <dd className="tabular font-medium">{value}</dd>
    </div>
  );
}

function StringsCard({ data }: { data: DashboardData }) {
  const live = data.live!;
  const peakTime = new Intl.DateTimeFormat("en-US", { timeZone: data.plant.timeZone, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(data.peak.ts));
  return (
    <div className="flex flex-col gap-3">
      <CardShell title="Solar Strings">
        <div className="grid grid-cols-2 gap-3">
          <StringTile name="PV1" watts={live.pv1W} volts={live.pv1V} amps={live.pv1A} />
          <StringTile name="PV2" watts={live.pv2W} volts={live.pv2V} amps={live.pv2A} />
        </div>
      </CardShell>
      <div className="grid grid-cols-2 gap-3">
        <CardShell>
          <div className="text-xs text-muted-foreground">Peak Solar</div>
          <div className="tabular mt-1 text-2xl font-semibold">{(data.peak.w / 1000).toFixed(1)} kW</div>
          <div className="text-xs text-muted-foreground">{data.peak.w > 0 ? peakTime : "No sun yet"}</div>
        </CardShell>
        <CardShell>
          <div className="text-xs text-muted-foreground">CO₂ Avoided</div>
          <div className="tabular mt-1 text-2xl font-semibold">{data.co2Kg.toFixed(1)} kg</div>
          <div className="text-xs text-muted-foreground">From today’s generation</div>
        </CardShell>
      </div>
    </div>
  );
}

function StringTile({ name, watts, volts, amps }: { name: string; watts: number | null; volts: number | null; amps: number | null }) {
  return (
    <div className="rounded-2xl bg-black/25 p-3">
      <div className="text-xs text-muted-foreground">{name}</div>
      <div className="tabular text-xl font-semibold">{watts != null ? formatKw(watts) : "—"}</div>
      <div className="text-[11px] text-muted-foreground">
        {volts != null ? `${volts.toFixed(1)} V` : "—"} · {amps != null ? `${amps.toFixed(2)} A` : "—"}
      </div>
    </div>
  );
}

function ProductionGauge({ data }: { data: DashboardData }) {
  const pct = Math.max(0, Math.min(1, data.dailyTargetKwh > 0 ? data.today.productionKwh / data.dailyTargetKwh : 0));
  const radius = 78;
  const length = Math.PI * radius;
  return (
    <CardShell>
      <div className="relative mx-auto h-36 w-64">
        <svg viewBox="0 0 200 120" className="h-full w-full">
          <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" strokeLinecap="round" />
          <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#3dd68c" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${length * pct} ${length}`} />
        </svg>
        <div className="absolute inset-x-0 bottom-2 text-center">
          <div className="tabular text-3xl font-semibold">{formatKwh1(data.today.productionKwh)} kWh</div>
          <div className="text-xs text-muted-foreground">/ {formatKwh1(data.dailyTargetKwh)} kWh target</div>
        </div>
      </div>
      <dl className="mt-2 space-y-2 text-sm">
        <Split label="Self Consumption" value={`${data.selfConsumptionPct.toFixed(0)}%`} />
        <Split label="To Battery" value={`${formatKwh1(data.today.chargeKwh)} kWh`} />
        <Split label="Grid Import" value={`${formatKwh1(data.today.importKwh)} kWh`} />
        <Split label="Estimated Savings" value={formatPeso(data.todaySavingsPhp)} accent />
      </dl>
    </CardShell>
  );
}

function Split({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("tabular font-medium", accent && "text-emerald-300")}>{value}</dd>
    </div>
  );
}

function SolarLoadChart({ data }: { data: DashboardData }) {
  const last = data.series[data.series.length - 1];
  return (
    <CardShell title="Solar vs Load (Today)" aside={last ? `Solar ${last.solarKw.toFixed(2)} · Load ${last.loadKw.toFixed(2)} kW` : undefined}>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(148,176,220,0.12)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#93a0bd", fontSize: 10 }} minTickGap={28} />
            <YAxis tick={{ fill: "#93a0bd", fontSize: 10 }} width={28} />
            <Tooltip contentStyle={{ background: "#101826", border: "1px solid rgba(148,176,220,0.2)", borderRadius: 12 }} formatter={(value, name) => [`${Number(value).toFixed(2)} kW`, name]} />
            <Line type="monotone" dataKey="solarKw" name="Solar" stroke="#3dd68c" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="loadKw" name="House Load" stroke="#fb7185" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </CardShell>
  );
}

function BatteryChart({ data }: { data: DashboardData }) {
  return (
    <CardShell title="Battery (24h)">
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(148,176,220,0.12)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#93a0bd", fontSize: 10 }} minTickGap={28} />
            <YAxis domain={[0, 100]} tick={{ fill: "#93a0bd", fontSize: 10 }} width={28} />
            <Tooltip contentStyle={{ background: "#101826", border: "1px solid rgba(148,176,220,0.2)", borderRadius: 12 }} formatter={(value) => [`${Number(value).toFixed(0)}%`, "SOC"]} />
            <Area type="monotone" dataKey="soc" name="SOC" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.25} strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </CardShell>
  );
}

function Progress({ pct }: { pct: number }) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div className="mt-3">
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${width}%` }} />
      </div>
      <div className="mt-2 flex gap-1">
        {Array.from({ length: 12 }, (_, index) => (
          <span key={index} className={cn("h-1.5 flex-1 rounded-full", index / 12 < width / 100 ? "bg-emerald-400" : "bg-white/15")} />
        ))}
      </div>
    </div>
  );
}


function EarningsCard({ data }: { data: DashboardData }) {
  const { today, daily, monthly, lifetimeTotalPhp } = data.earnings;
  const [view, setView] = useState<"day" | "month">("day");
  const defaultDay = daily[daily.length - 1]?.period ?? "";
  const defaultMonth = monthly[monthly.length - 1]?.period ?? "";
  const [selectedDay, setSelectedDay] = useState(defaultDay);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const dayPeriod = daily.some((item) => item.period === selectedDay) ? selectedDay : defaultDay;
  const monthPeriod = monthly.some((item) => item.period === selectedMonth) ? selectedMonth : defaultMonth;
  const day = daily.find((item) => item.period === dayPeriod) ?? daily[daily.length - 1];
  const month = monthly.find((item) => item.period === monthPeriod) ?? monthly[monthly.length - 1];
  const maxMonth = Math.max(1, ...monthly.map((item) => item.totalPhp));
  const maxDay = Math.max(1, ...daily.map((item) => item.totalPhp));

  return (
    <CardShell
      title="Earnings & Savings"
      aside={
        <span className="inline-flex items-center gap-2">
          <span>{`${data.plant.timeZone === "Asia/Manila" ? "PHT" : data.plant.timeZone} · ${formatPeso(today.tariffPhp)}/kWh`}</span>
          <button
            type="button"
            onClick={downloadCsv}
            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200 hover:bg-white/15"
          >
            <Download className="size-3" /> Export CSV
          </button>
        </span>
      }
    >
      <div className="text-[11px] font-semibold tracking-wide text-amber-300">TODAY&apos;S EARNINGS (DAY)</div>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div>
          <div className="tabular text-3xl font-semibold text-emerald-300">{formatPeso(today.totalPhp)}</div>
          <div className="text-xs text-muted-foreground">Total Earnings Today</div>
        </div>
        <Wallet className="size-8 text-emerald-300/80" aria-hidden="true" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-black/25 p-3">
          <div className="text-[11px] text-muted-foreground">Consumption Savings</div>
          <div className="tabular mt-1 text-lg font-semibold text-emerald-300">{formatPeso(today.consumptionSavingsPhp)}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{formatKwh1(today.selfSuppliedKwh)} kWh saved today</div>
        </div>
        <div className="rounded-2xl bg-black/25 p-3">
          <div className="text-[11px] text-muted-foreground">Feed-In Earnings</div>
          <div className="tabular mt-1 text-lg font-semibold">{formatPeso(today.feedInEarningsPhp)}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{formatKwh1(today.exportKwh)} kWh exported</div>
        </div>
      </div>

      <RecordsStrip records={data.records} />

      <div className="my-4 h-px bg-white/10" />

      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold tracking-wide text-amber-300">
          {view === "day" ? "DAILY EARNINGS" : "PAST MONTHLY EARNINGS"}
        </div>
        <div className="inline-flex rounded-full bg-white/8 p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setView("day")}
            className={cn("rounded-full px-3 py-1", view === "day" ? "bg-emerald-500/20 text-emerald-300" : "text-muted-foreground")}
            aria-pressed={view === "day"}
          >
            Day
          </button>
          <button
            type="button"
            onClick={() => setView("month")}
            className={cn("rounded-full px-3 py-1", view === "month" ? "bg-emerald-500/20 text-emerald-300" : "text-muted-foreground")}
            aria-pressed={view === "month"}
          >
            Month
          </button>
        </div>
      </div>

      {view === "month" ? (
        <>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="tabular text-3xl font-semibold">{formatPeso(lifetimeTotalPhp)}</div>
              <div className="text-xs text-muted-foreground">Total Lifetime Earnings</div>
            </div>
            <Banknote className="size-8 text-amber-300/80" aria-hidden="true" />
          </div>
          <div className="mt-4 flex items-end gap-2">
            {monthly.map((item) => {
              const height = Math.max(8, Math.round((item.totalPhp / maxMonth) * 72));
              const active = item.period === monthPeriod;
              return (
                <button
                  key={item.period}
                  type="button"
                  onClick={() => setSelectedMonth(item.period)}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1"
                  aria-pressed={active}
                  aria-label={`${item.title} ${formatPeso(item.totalPhp)}`}
                >
                  <span className={cn("w-full rounded-t-lg transition-colors", active ? "bg-emerald-400" : "bg-emerald-400/35")} style={{ height }} />
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {monthly.map((item) => {
              const active = item.period === monthPeriod;
              return (
                <button
                  key={`${item.period}-pill`}
                  type="button"
                  onClick={() => setSelectedMonth(item.period)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-semibold tracking-wide",
                    active ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40" : "bg-white/8 text-muted-foreground hover:bg-white/12",
                  )}
                  aria-pressed={active}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          {month ? (
            <div className="mt-4 rounded-2xl bg-black/25 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">{month.title}</div>
                <div className="tabular text-lg font-semibold text-emerald-300">{formatPeso(month.totalPhp)}</div>
              </div>
              <dl className="mt-2 space-y-2 text-sm">
                <Split label="Consumption Savings" value={formatPeso(month.consumptionSavingsPhp)} accent />
                <Split label="Feed-In Earnings" value={formatPeso(month.feedInEarningsPhp)} />
                <Split label="Total Earnings" value={formatPeso(month.totalPhp)} accent />
                {month.chargedEnergyKwh != null ? <Split label="Charged Energy" value={`${formatKwh1(month.chargedEnergyKwh)} kWh`} /> : null}
              </dl>
            </div>
          ) : null}
        </>
      ) : (
        <>
          {daily.length ? (
            <div className="mt-1 flex items-end gap-1 overflow-x-auto pb-1">
              {daily.map((item) => {
                const height = Math.max(6, Math.round((item.totalPhp / maxDay) * 72));
                const active = item.period === dayPeriod;
                return (
                  <button
                    key={item.period}
                    type="button"
                    onClick={() => setSelectedDay(item.period)}
                    className="flex w-6 shrink-0 flex-col items-center gap-1 sm:w-7"
                    aria-pressed={active}
                    aria-label={`${item.title} ${formatPeso(item.totalPhp)}`}
                  >
                    <span className={cn("w-full rounded-t-md transition-colors", active ? "bg-emerald-400" : "bg-emerald-400/35")} style={{ height }} />
                    <span className={cn("text-[9px] tabular", active ? "text-emerald-300" : "text-muted-foreground")}>{Number(item.period.slice(8, 10))}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Daily history will appear here once Deye Cloud day totals are available.</div>
          )}
          {day ? (
            <div className="mt-4 rounded-2xl bg-black/25 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">{day.title}</div>
                <div className="tabular text-lg font-semibold text-emerald-300">{formatPeso(day.totalPhp)}</div>
              </div>
              <dl className="mt-2 space-y-2 text-sm">
                <Split label="Consumption Savings" value={formatPeso(day.consumptionSavingsPhp)} accent />
                <Split label="Feed-In Earnings" value={formatPeso(day.feedInEarningsPhp)} />
                <Split label="Total Earnings" value={formatPeso(day.totalPhp)} accent />
                <Split label="Energy saved" value={`${formatKwh1(day.selfSuppliedKwh)} kWh`} />
              </dl>
            </div>
          ) : null}
          {daily.length ? (
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm">
              {[...daily].reverse().map((item) => {
                const active = item.period === dayPeriod;
                return (
                  <li key={`${item.period}-row`}>
                    <button
                      type="button"
                      onClick={() => setSelectedDay(item.period)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left",
                        active ? "bg-emerald-500/15 text-emerald-200" : "hover:bg-white/5",
                      )}
                    >
                      <span>
                        <span className="block font-medium text-foreground">{item.label}</span>
                        <span className="text-[11px] text-muted-foreground">{formatKwh1(item.selfSuppliedKwh)} kWh saved</span>
                      </span>
                      <span className="tabular font-semibold text-emerald-300">{formatPeso(item.totalPhp)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </>
      )}

      <div className="my-4 h-px bg-white/10" />
      <PaybackCard payback={data.payback} />
    </CardShell>
  );
}

function PaybackCard({ payback }: { payback: Payback }) {
  const plant = usePlant();
  const [cost, setCost] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasCost = payback.systemCostPhp > 0;
  const paidOff = hasCost && payback.remainingPhp <= 0;
  const showForm = !hasCost || editing;

  async function saveCost(event: React.FormEvent, nextValue?: number) {
    event.preventDefault();
    const value = nextValue ?? Number(cost.replace(/,/g, ""));
    if (!Number.isFinite(value) || value < 0) {
      setError("Enter your system install cost in pesos, or 0 to clear.");
      return;
    }
    if (!hasCost && value <= 0) {
      setError("Enter your system install cost in pesos.");
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemCostPhp: value }),
    });
    const body = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(body.error || "Save failed");
      return;
    }
    setCost("");
    setEditing(false);
    await plant.reload();
  }

  return (
    <div className="rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 to-emerald-500/5 p-4">
      <div className="text-[11px] font-semibold tracking-wide text-amber-300">SOLAR PAYBACK (ROI)</div>
      <div className="mt-2 text-xs text-muted-foreground">Total Saved So Far</div>
      <div className="tabular text-3xl font-semibold text-amber-100">{formatPeso(payback.totalSavedPhp)}</div>
      {hasCost && !showForm ? (
        <>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 to-emerald-400 transition-[width] duration-700"
              style={{ width: `${Math.min(100, payback.paidOffPct)}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="min-w-0 rounded-2xl bg-black/25 px-3 py-3 text-center">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Paid Off</div>
              <div className="tabular mt-1 text-lg font-semibold sm:text-xl">{payback.paidOffPct.toFixed(1)}%</div>
            </div>
            <div className="min-w-0 rounded-2xl bg-black/25 px-3 py-3 text-center">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Remaining</div>
              <div className="tabular mt-1 break-words text-base font-semibold leading-snug sm:text-lg">{formatPeso(payback.remainingPhp)}</div>
            </div>
            <div className="col-span-2 min-w-0 rounded-2xl bg-black/25 px-3 py-3 text-center sm:col-span-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Est. Break-Even</div>
              <div className="mt-1 whitespace-nowrap text-base font-semibold sm:text-lg">{paidOff ? "Paid off" : payback.breakEvenLabel ?? "—"}</div>
            </div>
          </div>
          <button
            type="button"
            className="mt-3 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => {
              setCost(String(payback.systemCostPhp));
              setEditing(true);
              setError(null);
            }}
          >
            Edit install cost
          </button>
        </>
      ) : (
        <form className="mt-3 space-y-2" onSubmit={(event) => void saveCost(event)}>
          <p className="text-sm text-muted-foreground">
            {hasCost ? "Update or clear your system install cost (₱)" : "Enter your system install cost (₱) to track payback"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              inputMode="decimal"
              placeholder="e.g. 630000"
              value={cost}
              onChange={(event) => setCost(event.target.value)}
              aria-label="System install cost in pesos"
              className="min-w-0 flex-1"
            />
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
            {hasCost ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={(event) => void saveCost(event, 0)}
              >
                Clear
              </Button>
            ) : null}
            {editing ? (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setCost("");
                  setError(null);
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
          {error ? <p className="text-xs text-rose-200">{error}</p> : null}
        </form>
      )}
    </div>
  );
}

function SavingsCard({ data }: { data: DashboardData }) {
  return (
    <CardShell>
      <div className="text-[11px] font-semibold tracking-wide text-amber-300">MONTHLY SAVINGS</div>
      <div className="mt-1 text-right text-[11px] text-muted-foreground">{data.cycle.label} · {formatPeso(data.cycle.tariffPhp)}/kWh</div>
      <div className="tabular text-3xl font-semibold">{formatPeso(data.cycle.savingsPhp)}</div>
      <div className="text-xs text-muted-foreground">{formatKwh1(data.cycle.generatedKwh)} kWh generated since cycle start</div>
      <Progress pct={data.cycle.progressPct} />
    </CardShell>
  );
}

function BillCard({ data }: { data: DashboardData }) {
  return (
    <CardShell>
      <div className="text-[11px] font-semibold tracking-wide text-amber-300">EST. BILL</div>
      <div className="mt-1 text-right text-[11px] text-muted-foreground">{data.cycle.label} · {formatPeso(data.cycle.tariffPhp)}/kWh</div>
      <div className="tabular text-3xl font-semibold">{formatPeso(data.cycle.billPhp)}</div>
      <div className="text-xs text-muted-foreground">{formatKwh1(data.cycle.importKwh)} kWh import · {data.cycle.daysElapsed} days</div>
      <div className="mt-1 text-xs text-orange-300">Prediction: {formatPeso(data.cycle.projectedBillPhp)} (avg {data.cycle.avgImportKwhPerDay.toFixed(1)} kWh/day)</div>
      <Progress pct={data.cycle.progressPct} />
    </CardShell>
  );
}

function HealthCard({ data }: { data: DashboardData }) {
  const live = data.live!;
  const healthy = live.online && data.unreadAlerts === 0 && !(data.mode === "deye" && data.deyeLastError);
  const connection = data.mode === "deye" ? (data.deyeLastError ? "Needs a check" : "Connected") : data.mode === "bridge" ? "Local bridge" : "Demo feed";
  const updated = new Intl.DateTimeFormat("en-US", { timeZone: data.plant.timeZone, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(data.updatedAt ?? Date.now()));
  return (
    <CardShell title="System Health" aside={<span className={healthy ? "text-emerald-300" : "text-amber-200"}>{healthy ? "All systems normal" : "Needs attention"}</span>}>
      <ul className="space-y-2 text-sm">
        <HealthRow ok={live.online} label={`Deye Inverter · ${(data.inverter.ratedW / 1000).toFixed(1)} kW`} detail={formatKw(live.loadW) + " load"} />
        <HealthRow ok={live.batteryTemp == null || live.batteryTemp < 55} label={`Battery · ${formatKwh1(data.inverter.batteryKwh)} kWh`} detail={`${live.batterySoc.toFixed(0)}% · ${live.batteryTemp != null ? `${live.batteryTemp.toFixed(1)}°C` : "—"}`} />
        <HealthRow ok label={`Solar PV · ${(data.inverter.ratedW / 1000).toFixed(2)} kWp`} detail={formatKw(live.pvW)} />
        <HealthRow ok={connection !== "Needs a check"} label="Deye Connection" detail={connection} />
      </ul>
      <div className="mt-3 text-right text-[11px] text-muted-foreground">Updated {updated}</div>
    </CardShell>
  );
}

function HealthRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2">
        <Check className={cn("size-4", ok ? "text-emerald-400" : "text-amber-300")} />
        {label}
      </span>
      <span className="tabular text-xs text-muted-foreground">{detail}</span>
    </li>
  );
}
