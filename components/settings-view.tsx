"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { SettingsData } from "@/components/models";
import { useJson } from "@/components/use-json";
import { usePlant } from "@/components/plant-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { sourceLabel } from "@/lib/format";

type FormState = {
  plantName: string;
  plantLocation: string;
  lat: string;
  lon: string;
  timeZone: string;
  inverterSn: string;
  inverterModel: string;
  ratedW: string;
  batteryKwh: string;
  operatingMode: string;
  deyeRegion: SettingsData["deyeRegion"];
  deyeBaseUrl: string;
  deyeAppId: string;
  deyeAppSecret: string;
  deyeEmail: string;
  deyePassword: string;
  deyeCompanyId: string;
  deyeStationId: string;
  pollIntervalSec: string;
  preferredSource: SettingsData["preferredSource"];
  tariffPhp: string;
  billingCycleStartDay: string;
  dailyTargetKwh: string;
  batteryReserveSoc: string;
  systemCostPhp: string;
  alertLowSocEnabled: boolean;
  alertLowSocThreshold: string;
  alertGridEnabled: boolean;
  alertOfflineEnabled: boolean;
  alertOfflineMinutes: string;
};

type TestResult = {
  ok: boolean;
  error?: string;
  warning?: string;
  stations?: { id: number; name: string; address: string }[];
  devices?: { sn: string; model: string | null }[];
  live?: { pvW: number; batterySoc: number; online: boolean };
};

function toForm(data: SettingsData): FormState {
  return {
    plantName: data.plantName,
    plantLocation: data.plantLocation,
    lat: String(data.lat),
    lon: String(data.lon),
    timeZone: data.timeZone,
    inverterSn: data.inverterSn,
    inverterModel: data.inverterModel,
    ratedW: String(data.ratedW),
    batteryKwh: String(data.batteryKwh),
    operatingMode: data.operatingMode,
    deyeRegion: data.deyeRegion,
    deyeBaseUrl: data.deyeBaseUrl,
    deyeAppId: data.deyeAppId,
    deyeAppSecret: "",
    deyeEmail: data.deyeEmail,
    deyePassword: "",
    deyeCompanyId: data.deyeCompanyId,
    deyeStationId: data.deyeStationId,
    pollIntervalSec: String(data.pollIntervalSec),
    preferredSource: data.preferredSource,
    tariffPhp: String(data.tariffPhp),
    billingCycleStartDay: String(data.billingCycleStartDay),
    dailyTargetKwh: String(data.dailyTargetKwh),
    batteryReserveSoc: String(data.batteryReserveSoc),
    systemCostPhp: data.systemCostPhp > 0 ? String(data.systemCostPhp) : "",
    alertLowSocEnabled: data.alerts.lowSocEnabled,
    alertLowSocThreshold: String(data.alerts.lowSocThreshold),
    alertGridEnabled: data.alerts.gridEnabled,
    alertOfflineEnabled: data.alerts.offlineEnabled,
    alertOfflineMinutes: String(data.alerts.offlineMinutes),
  };
}

export function SettingsView() {
  const plant = usePlant();
  const { data, error, loading, reload } = useJson<SettingsData>("/api/settings");
  const [form, setForm] = useState<FormState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [test, setTest] = useState<TestResult | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (data) setForm(toForm(data));
  }, [data]);
  useEffect(() => setOrigin(window.location.origin), []);

  const curl = useMemo(() => {
    if (!data) return "";
    const payload = {
      deviceSn: data.inverterSn,
      pvW: 2400,
      loadW: 890,
      gridW: 0,
      gridStatus: "off-grid",
      batteryW: 1010,
      batterySoc: 63,
      batteryV: 52.1,
      batteryA: 19.4,
      batteryTemp: 30.5,
      pv1V: 312,
      pv1A: 4.1,
      pv2V: 308,
      pv2A: 3.8,
      acV: 230.4,
      acHz: 60,
      inverterTemp: 41,
      operatingMode: "Manual Mode",
    };
    return `curl -X POST ${origin}/api/ingest \\\n  -H "Authorization: Bearer ${data.ingestApiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(payload)}'`;
  }, [data, origin]);

  if (loading && !form) return <div className="h-64 animate-pulse rounded-2xl bg-white/5" />;
  if (error || !data || !form) {
    return (
      <Card>
        <CardContent className="space-y-3 py-6">
          <p className="text-sm">Settings didn’t load. {error}</p>
          <Button onClick={() => void reload()}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  const draft = form;
  const locked = new Set(data.envLocked);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => (current ? { ...current, [key]: value } : current));

  async function save() {
    setBusy("save");
    setNotice(null);
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plantName: draft.plantName,
        plantLocation: draft.plantLocation,
        lat: Number(draft.lat),
        lon: Number(draft.lon),
        timeZone: draft.timeZone,
        inverterSn: draft.inverterSn,
        inverterModel: draft.inverterModel,
        ratedW: Number(draft.ratedW),
        batteryKwh: Number(draft.batteryKwh),
        operatingMode: draft.operatingMode,
        deyeRegion: draft.deyeRegion,
        deyeBaseUrl: draft.deyeBaseUrl,
        deyeAppId: draft.deyeAppId,
        deyeAppSecret: draft.deyeAppSecret || undefined,
        deyeEmail: draft.deyeEmail,
        deyePassword: draft.deyePassword || undefined,
        deyeCompanyId: draft.deyeCompanyId,
        deyeStationId: draft.deyeStationId,
        pollIntervalSec: Number(draft.pollIntervalSec),
        preferredSource: draft.preferredSource,
        alertLowSocEnabled: draft.alertLowSocEnabled,
        alertLowSocThreshold: Number(draft.alertLowSocThreshold),
        alertGridEnabled: draft.alertGridEnabled,
        alertOfflineEnabled: draft.alertOfflineEnabled,
        alertOfflineMinutes: Number(draft.alertOfflineMinutes),
        tariffPhp: Number(draft.tariffPhp),
        billingCycleStartDay: Number(draft.billingCycleStartDay),
        dailyTargetKwh: Number(draft.dailyTargetKwh),
        batteryReserveSoc: Number(draft.batteryReserveSoc),
        systemCostPhp: draft.systemCostPhp.trim() === "" ? 0 : Number(draft.systemCostPhp),
      }),
    });
    const body = (await response.json()) as { error?: string };
    setBusy(null);
    if (!response.ok) {
      setNotice(body.error || "Save failed");
      return;
    }
    setNotice("Saved.");
    await reload();
    await plant.reload();
  }

  async function testConnection() {
    setBusy("test");
    setNotice(null);
    const response = await fetch("/api/deye/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        region: draft.deyeRegion,
        baseUrl: draft.deyeBaseUrl,
        appId: draft.deyeAppId,
        appSecret: draft.deyeAppSecret || undefined,
        email: draft.deyeEmail,
        password: draft.deyePassword || undefined,
        companyId: draft.deyeCompanyId,
        stationId: draft.deyeStationId,
        deviceSn: draft.inverterSn,
      }),
    });
    const body = (await response.json()) as TestResult;
    setTest(body);
    setBusy(null);
    setNotice(body.ok ? "Deye Cloud accepted the credentials." : body.error || "Connection failed");
    if (body.ok) {
      await reload();
      await plant.reload();
    }
  }

  async function pullHistory() {
    setBusy("sync");
    setNotice(null);
    const response = await fetch("/api/deye/sync", { method: "POST" });
    const body = (await response.json()) as { error?: string; snapshots?: number; days?: number };
    setBusy(null);
    setNotice(response.ok ? `Imported ${body.snapshots ?? 0} points and ${body.days ?? 0} daily rows.` : body.error || "Sync failed");
    await plant.reload();
  }

  async function rotateKey() {
    setBusy("key");
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rotateIngestKey: true }),
    });
    setBusy(null);
    setNotice("Ingest key rotated. Update any bridge that was using the old key.");
    await reload();
  }

  async function rebuildDemo() {
    setBusy("demo");
    await fetch("/api/demo/reset", { method: "POST" });
    setBusy(null);
    setNotice("Demo history rebuilt for Filosofo.");
    await plant.reload();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Showing {sourceLabel(data.mode)}. Credentials stay on this server.
          {!data.pinEnabled ? " Set APP_PIN before you put this on the internet." : ""}
        </p>
      </div>
      {notice ? <p className="rounded-xl bg-white/5 px-3 py-2 text-sm">{notice}</p> : null}

      <Card>
        <CardHeader><CardTitle>House photo</CardTitle></CardHeader>
        <CardContent className="space-y-3 pb-4">
          <p className="text-xs text-muted-foreground">This photo sits behind the energy-flow nodes. Take it from the street, in daylight, with the whole facade in frame.</p>
          <div className="relative h-40 w-full overflow-hidden rounded-xl">
            <Image src={`/api/house-photo?t=${data.housePhotoCustom ? "custom" : "default"}`} alt="House used on the dashboard" fill unoptimized className="object-cover object-center" />
          </div>
          <input
            id="house-photo"
            name="housePhoto"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:text-primary-foreground"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const body = new FormData();
              body.set("photo", file);
              setBusy("photo");
              const response = await fetch("/api/house-photo", { method: "POST", body });
              const payload = (await response.json().catch(() => null)) as { error?: string } | null;
              setBusy(null);
              setNotice(response.ok ? "House photo updated." : payload?.error || "Upload failed");
              if (response.ok) {
                await reload();
                await plant.reload();
              }
            }}
          />
          {data.housePhotoCustom ? (
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={async () => {
                setBusy("photo");
                await fetch("/api/house-photo", { method: "DELETE" });
                setBusy(null);
                setNotice("Back to the default house photo.");
                await reload();
                await plant.reload();
              }}
            >
              Use the default photo
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Billing</CardTitle></CardHeader>
        <CardContent className="grid gap-3 pb-4 md:grid-cols-3">
          <Field label="Electricity rate (₱/kWh)" value={form.tariffPhp} onChange={(value) => set("tariffPhp", value)} />
          <Field label="Cycle starts on day" value={form.billingCycleStartDay} onChange={(value) => set("billingCycleStartDay", value)} />
          <Field label="Daily generation target (kWh)" value={form.dailyTargetKwh} onChange={(value) => set("dailyTargetKwh", value)} />
          <Field label="System install cost (₱)" value={form.systemCostPhp} onChange={(value) => set("systemCostPhp", value)} placeholder="Leave blank until entered" />
          <div className="md:col-span-3">
            <Button onClick={() => void save()} disabled={busy !== null}>Save billing</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Plant and inverter</CardTitle></CardHeader>
        <CardContent className="grid gap-3 pb-4 md:grid-cols-2">
          <Field label="Plant name" value={form.plantName} onChange={(value) => set("plantName", value)} />
          <Field label="Location" value={form.plantLocation} onChange={(value) => set("plantLocation", value)} />
          <Field label="Latitude" value={form.lat} onChange={(value) => set("lat", value)} />
          <Field label="Longitude" value={form.lon} onChange={(value) => set("lon", value)} />
          <Field label="Time zone" value={form.timeZone} onChange={(value) => set("timeZone", value)} />
          <Field label="Operating mode label" value={form.operatingMode} onChange={(value) => set("operatingMode", value)} />
          <Field label="Inverter serial" value={form.inverterSn} disabled={locked.has("inverterSn")} onChange={(value) => set("inverterSn", value)} />
          <Field label="Model" value={form.inverterModel} onChange={(value) => set("inverterModel", value)} />
          <Field label="Rated power (W)" value={form.ratedW} onChange={(value) => set("ratedW", value)} />
          <Field label="Battery (kWh)" value={form.batteryKwh} onChange={(value) => set("batteryKwh", value)} />
          <Field label="Battery reserve SOC (%)" value={form.batteryReserveSoc} onChange={(value) => set("batteryReserveSoc", value)} />
          <div className="md:col-span-2">
            <Button onClick={() => void save()} disabled={busy !== null}>Save plant</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Deye Cloud Open API</CardTitle></CardHeader>
        <CardContent className="space-y-3 pb-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Create an application at developer.deyecloud.com and use the same datacenter you picked when the DeyeCloud account was registered. The password is SHA-256 hashed on this server before it is sent. A 64-character hex string is treated as an existing digest.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5 text-sm" htmlFor="deye-region">
              <span>Region</span>
              <select
                id="deye-region"
                name="deyeRegion"
                className="h-10 w-full rounded-md border border-input bg-[#0c1424] px-3"
                value={form.deyeRegion}
                disabled={locked.has("deyeRegion")}
                onChange={(event) => set("deyeRegion", event.target.value as FormState["deyeRegion"])}
              >
                <option value="eu">Europe — eu1-developer.deyecloud.com</option>
                <option value="us">United States — us1-developer.deyecloud.com</option>
                <option value="india">India — india-developer.deyecloud.com</option>
                <option value="custom">Custom base URL</option>
              </select>
            </label>
            <label className="space-y-1.5 text-sm" htmlFor="data-source">
              <span>Source</span>
              <select
                id="data-source"
                name="preferredSource"
                className="h-10 w-full rounded-md border border-input bg-[#0c1424] px-3"
                value={form.preferredSource}
                disabled={locked.has("preferredSource")}
                onChange={(event) => set("preferredSource", event.target.value as FormState["preferredSource"])}
              >
                <option value="auto">Auto — bridge, then Deye, then demo</option>
                <option value="demo">Demo</option>
                <option value="deye">Deye Cloud</option>
                <option value="bridge">Local bridge</option>
              </select>
            </label>
            {form.deyeRegion === "custom" ? (
              <Field label="Base URL" value={form.deyeBaseUrl} disabled={locked.has("deyeBaseUrl")} onChange={(value) => set("deyeBaseUrl", value)} />
            ) : null}
            <Field label="App ID" value={form.deyeAppId} disabled={locked.has("deyeAppId")} onChange={(value) => set("deyeAppId", value)} />
            <Field label={data.hasAppSecret ? "App secret (saved)" : "App secret"} type="password" value={form.deyeAppSecret} disabled={locked.has("deyeAppSecret")} placeholder={data.hasAppSecret ? "Leave blank to keep" : ""} onChange={(value) => set("deyeAppSecret", value)} />
            <Field label="Account email" value={form.deyeEmail} disabled={locked.has("deyeEmail")} onChange={(value) => set("deyeEmail", value)} />
            <Field label={data.hasPassword ? "Password (saved)" : "Password"} type="password" value={form.deyePassword} disabled={locked.has("deyePassword")} placeholder={data.hasPassword ? "Leave blank to keep" : ""} onChange={(value) => set("deyePassword", value)} />
            <Field label="Company ID (business accounts)" value={form.deyeCompanyId} disabled={locked.has("deyeCompanyId")} onChange={(value) => set("deyeCompanyId", value)} />
            <Field label="Station ID" value={form.deyeStationId} disabled={locked.has("deyeStationId")} onChange={(value) => set("deyeStationId", value)} />
            <Field label="Poll interval (seconds)" value={form.pollIntervalSec} disabled={locked.has("pollIntervalSec")} onChange={(value) => set("pollIntervalSec", value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void save()} disabled={busy !== null}>{busy === "save" ? "Saving…" : "Save settings"}</Button>
            <Button variant="secondary" onClick={() => void testConnection()} disabled={busy !== null}>{busy === "test" ? "Testing…" : "Test connection"}</Button>
            <Button variant="outline" onClick={() => void pullHistory()} disabled={busy !== null}>{busy === "sync" ? "Pulling…" : "Pull history"}</Button>
          </div>
          {data.deyeLastError ? <p className="text-xs text-rose-200">Last error: {data.deyeLastError}</p> : null}
          {data.deyeLastOkAt ? <p className="text-xs text-muted-foreground">Last successful Deye call {new Date(data.deyeLastOkAt).toLocaleString()}.</p> : null}
          {test?.stations && test.stations.length > 0 ? (
            <div className="space-y-1 text-sm">
              {test.stations.map((station) => (
                <button
                  key={station.id}
                  type="button"
                  className="block w-full rounded-lg bg-white/5 px-3 py-2 text-left hover:bg-white/10"
                  onClick={() => set("deyeStationId", String(station.id))}
                >
                  {station.name} · ID {station.id}
                  {station.address ? ` · ${station.address}` : ""}
                </button>
              ))}
            </div>
          ) : null}
          {test?.warning ? <p className="text-xs text-amber-100">{test.warning}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Local ingest webhook</CardTitle></CardHeader>
        <CardContent className="space-y-3 pb-4">
          <p className="text-xs text-muted-foreground">POST /api/ingest with this key from an ESP32, Home Assistant, or a Solarman poller. A fresh local reading takes over Auto mode.</p>
          <Label htmlFor="ingest-key">API key</Label>
          <Input id="ingest-key" readOnly value={locked.has("ingestApiKey") ? "Set by INGEST_API_KEY" : data.ingestApiKey} />
          <pre className="overflow-auto rounded-xl bg-black/30 p-3 text-xs leading-relaxed">{curl}</pre>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void navigator.clipboard.writeText(curl)}>Copy curl</Button>
            <Button variant="secondary" onClick={() => void rotateKey()} disabled={busy !== null || locked.has("ingestApiKey")}>
              {busy === "key" ? "Rotating…" : "Rotate key"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Alert rules</CardTitle></CardHeader>
        <CardContent className="space-y-4 pb-4">
          <Rule label="Low battery SOC" enabled={form.alertLowSocEnabled} onEnabled={(value) => set("alertLowSocEnabled", value)}>
            <Field label="Threshold %" value={form.alertLowSocThreshold} onChange={(value) => set("alertLowSocThreshold", value)} />
          </Rule>
          <Rule label="Grid outage / off-grid" enabled={form.alertGridEnabled} onEnabled={(value) => set("alertGridEnabled", value)} />
          <Rule label="Inverter offline" enabled={form.alertOfflineEnabled} onEnabled={(value) => set("alertOfflineEnabled", value)}>
            <Field label="Minutes without data" value={form.alertOfflineMinutes} onChange={(value) => set("alertOfflineMinutes", value)} />
          </Rule>
          <Button onClick={() => void save()} disabled={busy !== null}>Save rules</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Demo data</CardTitle></CardHeader>
        <CardContent className="space-y-3 pb-4">
          <p className="text-sm text-muted-foreground">Rebuilds a year of Filosofo weather-shaped history and restarts the demo clock. Live Deye and bridge rows stay put.</p>
          <Button variant="outline" onClick={() => void rebuildDemo()} disabled={busy !== null}>{busy === "demo" ? "Rebuilding…" : "Rebuild demo history"}</Button>
          {data.pinEnabled ? <Button variant="ghost" onClick={() => void logout()}>Lock</Button> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <label className="space-y-1.5 text-sm" htmlFor={id}>
      <span className="block">{label}</span>
      <Input id={id} type={type} value={value} disabled={disabled} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Rule({
  label,
  enabled,
  onEnabled,
  children,
}: {
  label: string;
  enabled: boolean;
  onEnabled: (value: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-xl bg-white/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">{label}</span>
        <Switch checked={enabled} onCheckedChange={onEnabled} aria-label={label} />
      </div>
      {children}
    </div>
  );
}
