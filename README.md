# Filosofo Solar

Self-hosted dashboard for John’s Deye hybrid inverter at **Filosofo**, Negros Oriental. It opens in demo mode with a full year of plant-shaped history, then switches to live data from the [Deye Cloud Open API](https://developer.deyecloud.com/start) or from a local bridge that posts to `/api/ingest`.

The overview is a dark, phone-first power-flow view: PV, home load, battery state of charge, and grid import/export, with a clear on-grid / off-grid state. History covers today, 7 days, 30 days, and the year. Inverter `2508073177` has its own page for string voltage and current, battery voltage, current, temperature, and SOC, plus AC voltage, frequency, and inverter temperature.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:38471](http://127.0.0.1:38471). No API key is required. The header badge reads **Demo** until credentials or a bridge reading arrive.

```bash
npm run typecheck
npm test
npm run build
npm start
```

`npm start` listens on `0.0.0.0` and the `PORT` environment variable (3000 if unset).

Copy `.env.example` to `.env.local` when you want a PIN or Deye credentials. SQLite is created at `data/filosofo.sqlite`. Secrets typed into Settings are encrypted with `SETTINGS_SECRET`, or with a key file created next to the database.

## Demo, Deye Cloud, and the local bridge

| Badge | When you see it |
| --- | --- |
| Demo | No fresh live reading. At night in Negros Oriental the demo clock sits on a sunny late morning so the power flow is not a black screen. |
| Deye Cloud Live | Open API credentials are saved and a recent station or inverter reading is in the database. |
| Local Bridge | Something posted to `/api/ingest` in the last few poll intervals. In Auto mode a fresh bridge reading wins, because it is the local measurement. |

Settings → Source can force one of the three. Rebuild demo history from that page if you change the battery size or rated power and want the charts redrawn. Deye and bridge rows are left alone.

## Deye Cloud Open API keys

1. Create the account you already use in the Deye Cloud app and remember the datacenter (EU, US, or India). The Philippines account is often on the EU or a custom host; the region in Settings must match the account or the token call fails.
2. Open the [developer portal](https://developer.deyecloud.com/app) and create an application. Save the **App ID** and **App Secret**.
3. In this app’s Settings (or in the environment), set:
   - Region: `eu`, `us`, `india`, or a custom `https://…/v1.0` base URL
   - App ID, app secret, the DeyeCloud email, and the account password
   - Company ID only for a business member token. Leave it empty for a personal account.
   - Station ID, if you have more than one plant. Test Connection lists stations; click one to fill the id.
   - Inverter serial, default `2508073177`
4. Press **Test connection**. The server SHA-256-hashes the password (lowercase hex, as the v1.0 spec requires), stores the access token, and refreshes it two days before the 60-day expiry or immediately after an auth error.
5. **Pull history** loads today’s device curve plus daily and monthly station energy.

Environment variables override the form and are never written back into SQLite: `DEYE_REGION`, `DEYE_BASE_URL`, `DEYE_APP_ID`, `DEYE_APP_SECRET`, `DEYE_EMAIL`, `DEYE_PASSWORD`, `DEYE_COMPANY_ID`, `DEYE_STATION_ID`, `DEYE_DEVICE_SN`, `POLL_INTERVAL_SEC`, `DATA_SOURCE`.

The official sample client is [DeyeCloudDevelopers/deye-openapi-client-sample-code](https://github.com/DeyeCloudDevelopers/deye-openapi-client-sample-code). This app calls:

- `POST /v1.0/account/token?appId=`
- `POST /v1.0/station/list` and `/station/listWithDevice`
- `POST /v1.0/station/latest` and `/station/history`
- `POST /v1.0/device/latest` and `/device/history`

Device measure points use Deye’s PascalCase names (`SOC`, `TotalSolarPower`, `TotalConsumptionPower`, `TotalGridPower`, `BatteryPower`, `Temperature- Battery`, and the PV string keys). Battery power is negative while charging. Grid power is positive while importing.

## Local ingest

Settings shows a bearer key and a curl example. `INGEST_API_KEY` replaces the generated key when set.

```bash
curl -X POST http://127.0.0.1:38471/api/ingest \
  -H "Authorization: Bearer $INGEST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"deviceSn":"2508073177","pvW":2400,"loadW":890,"gridW":0,"gridStatus":"off-grid","batteryW":1010,"batterySoc":63,"batteryV":52.1,"acV":230,"acHz":60,"operatingMode":"Manual Mode"}'
```

`X-Api-Key` is accepted as well. Snake_case fields (`pv_power`, `battery_soc`, `grid_status`) work for Home Assistant templates. The body must name this inverter serial if it includes `deviceSn`.

Home Assistant sketch:

```yaml
rest_command:
  filosofo_ingest:
    url: "http://127.0.0.1:38471/api/ingest"
    method: POST
    headers:
      authorization: "Bearer YOUR_KEY"
      content-type: "application/json"
    payload: '{"deviceSn":"2508073177","pvW":{{ states("sensor.pv_power") | float(0) }},"loadW":{{ states("sensor.load_power") | float(0) }},"batterySoc":{{ states("sensor.battery_soc") | float(0) }}}'
```

## Alerts and the PIN

Rules, all on by default:

- Battery SOC under 20%
- Grid outage / off-grid
- No telemetry for 15 minutes, or an explicit offline flag

The log is on the Alerts page. Acknowledge clears the badge until the condition happens again.

The overview is a single scrolling page: house photo with live flow nodes, today’s energy, battery, strings, a production gauge, solar-versus-load and battery charts, and a Philippine-peso billing cycle. The default tariff is ₱16.50/kWh and the billing cycle starts on the 30th (clamped to the last day of shorter months such as February), both editable in Settings. The default plant is a SUN-16K-SG01LP1 (16 kW) with a 16 kWh battery. The built-in hero is John’s Filosofo house at twilight, in warm sand beige and dark walnut. Upload another photo there (JPEG, PNG, or WebP, stored next to the SQLite file) if you want to swap it.

Set `APP_PIN` to require a PIN for the UI and JSON routes. `POST /api/ingest` and `GET /api/health` stay open so a bridge and a platform health check keep working. Leave the PIN unset only on a private network. The ingest key is visible to anyone who can open Settings.

## Weather

Current conditions for the plant coordinates come from [Open-Meteo](https://open-meteo.com/) (no key). The default location is Dumaguete, Negros Oriental (`9.3068`, `123.3054`). A failed forecast leaves the rest of the dashboard up.

## Deploy

### Docker

```bash
docker compose up --build
```

The app is published on port 38471 and stores SQLite in the `filosofo-data` volume at `/data/filosofo.sqlite`.

### Render

`render.yaml` defines a Docker web service in Singapore with a 1 GB disk mounted at `/data`. Disks need a paid instance (`starter` in the blueprint) and turn off zero-downtime deploys, because only one process can use the disk.

In the Render dashboard, fill `APP_PIN` and the `DEYE_*` secrets (they are marked `sync: false`). `SETTINGS_SECRET` and `INGEST_API_KEY` are generated. Health checks use `/api/health`.

Do not restore a disk snapshot onto this service as a database backup. Copy `filosofo.sqlite` off the disk with `sqlite3 .backup` or by downloading the file if you need a copy.

### Vercel

This build targets a long-running Node server and a writable SQLite file. Vercel’s filesystem is ephemeral and a better-sqlite3 native module is a poor fit there, so use Render or Docker when the history should survive a restart. Demo mode can be poked at locally without either.

## Layout

- `app/` pages and route handlers
- `lib/deye.ts` Open API client
- `lib/demo.ts` Filosofo simulation
- `lib/ingest.ts` webhook payload
- `components/` dashboard, power flow, history, inverter, alerts, settings
