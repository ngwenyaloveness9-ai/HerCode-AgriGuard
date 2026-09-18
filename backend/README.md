# AgriGuard 3D — backend

FastAPI over Firestore, with Socket.IO for live telemetry. Serves the AgriGuard 3D
frontend and ingests readings from the ESP32 controllers.

Python 3.12 · FastAPI · Pydantic v2 · Firebase Admin · python-socketio

---

## The same contract, enforced server-side

The frontend refuses to invent data. So does this. The difference is that here it
is enforced at the point where a reading enters the system, which means a second
client — a mobile app, a script, a Firestore console — cannot get a different
answer than the dashboard shows.

| Situation | What the API returns |
|---|---|
| A document is missing its value, timestamp or sensor type | The reading is **dropped in the mapper**, not defaulted |
| A sensor type has never reported | That key is **absent** from `/telemetry/latest`, not present with `0` |
| A crop profile lacks the needed threshold | `UNKNOWN` with `profileIncomplete: true` |
| Either comparison window is empty | `sufficientData: false` and no numbers |
| A device has no heartbeat record | `UNKNOWN` — never `ONLINE` |
| A device stopped reporting | Downgraded to `OFFLINE` on read, regardless of its stored flag |
| Reservoir geometry not configured | Level is `null`; litres are `null` |
| Firebase is not configured | **503**, never empty collections |

That last row matters more than it looks. If an unconfigured deployment returned
empty lists, it would be indistinguishable from a farm whose sensors have all
failed.

### Thresholds are configuration

No moisture or temperature figure appears anywhere in this codebase. `services/evaluation.py`
evaluates only against thresholds present on the zone's `CropProfile`, and every
field on that model is optional. A profile that omits `moistureCriticalLow` means
"not configured", and the evaluator declines to judge that condition rather than
reaching for a macadamia textbook value.

This is what makes the two crops genuinely separate:

```python
# Same reading, different profiles, different answers.
evaluate_zone(macadamia_zone, {moisture: 22}, mac_profile)  # DRY   (target_low=25)
evaluate_zone(citrus_zone,    {moisture: 22}, cit_profile)  # NORMAL (target_low=18)
```

### Commands never lie

`POST /api/irrigation/commands` returns **202 Accepted** — queued for delivery,
not performed. The state machine is `ACCEPTED → WAITING_FOR_DEVICE → CONFIRMED | FAILED`,
and only the device's own acknowledgement endpoint can reach `CONFIRMED`.
Irrigation history is written on confirmation, not on request, so the water-usage
report counts water that actually moved.

### Automation fails safe

`services/automation.py` skips a rule rather than guessing whenever anything it
depends on is unavailable: a missing, stale or `BAD`-quality sensor reading; an
unknown reservoir level when a minimum was configured; a zone with no actuator.
A rule set to `HALT` on sensor failure closes what it opened. A rule cannot be
saved at all without either a recovery threshold or a maximum runtime — otherwise
nothing would stop it.

---

## Architecture

```
ESP32 ──► POST /api/telemetry/ingest
             │
             ├─ store reading (history + latest)
             ├─ mirror reservoir / flow / solar / battery to their collections
             ├─ re-evaluate every zone against its crop profile
             ├─ raise or resolve alerts (deduplicated per zone + category)
             ├─ run automation rules → queue commands
             └─ broadcast over Socket.IO
                        │
Frontend ◄──────────────┘  REST for initial state, sockets for updates
```

```
app/
  main.py               App, middleware, error handlers, /health, Socket.IO mount
  config.py             Environment settings
  core/
    security.py         Firebase ID-token verification, roles, device-key auth
    errors.py           Error types mapped to status codes
  firebase/client.py    Admin SDK init, collection names
  models/domain.py      Pydantic models mirroring the frontend TypeScript types
  repositories/
    base.py             Defensive Firestore converters
    telemetry.py        Readings, history, bucketing, comparison windows
    entities.py         Farms, zones, crop profiles, devices, alerts, rules, users
    operations.py       Irrigation, shade, reservoir, flow, energy, command queue
  services/
    evaluation.py       Zone status engine — the authoritative agronomic rules
    alerts.py           Alert raise/resolve with deduplication
    automation.py       Rule engine with safety interlocks
    analytics.py        Period comparisons
    ingest.py           The telemetry pipeline above
  realtime/events.py    Socket.IO server, per-farm rooms
  api/routes/           auth · farms · zones · telemetry · irrigation · devices
```

`services/evaluation.py` is a deliberate mirror of the frontend's
`src/utils/zoneStatus.ts`. Changing the rules means changing both, and
`tests/test_evaluation.py` is what stops them drifting apart silently.

---

## Setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env          # add your service-account path and device key
uvicorn app.main:app --reload
```

Interactive docs at `/docs` (disabled when `ENVIRONMENT=production`).
Health check at `/health` — it performs a real Firestore round trip and reports
`degraded` rather than `ok` when the database is unreachable.

```bash
pytest          # 18 tests covering the evaluation engine and reservoir maths
ruff check .
docker build -t agriguard-api .
```

Point the frontend at it:

```
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=http://localhost:8000
VITE_SOCKET_URL=http://localhost:8000
```

`STALE_DATA_SECONDS` must match the frontend's `VITE_STALE_DATA_SECONDS`, or the
two will disagree about what counts as live.

---

## Routes

| Group | Routes |
|---|---|
| Auth | `GET /api/auth/me` · `POST /api/auth/profile` |
| Farms | `GET POST /api/farms` · `GET /api/farms/{id}` · `GET POST /api/fields` |
| Zones | `GET POST /api/zones` · `GET PATCH /api/zones/{id}` · `GET /api/zones/{id}/evaluation` |
| Crops | `GET /api/crops` · `GET /api/crop-profiles` · `GET PUT /api/crop-profiles/{id}` |
| Telemetry | `GET /api/telemetry/latest` · `GET /api/telemetry/history` · `POST /api/telemetry/ingest` |
| Analytics | `GET /api/analytics/comparison` |
| Irrigation | `GET /api/irrigation/events` · `/active` · `/flow/latest` · `GET POST /api/irrigation/commands` · `POST /api/irrigation/commands/{id}/ack` · `GET /api/irrigation/devices/{id}/queue` |
| Shade | `GET /api/shade/events` |
| Reservoir | `GET PUT /api/reservoir/config` · `GET /api/reservoir/latest` |
| Energy | `GET /api/solar/latest` · `GET /api/solar/battery/latest` |
| Devices | `GET /api/devices` · `GET /api/devices/{id}` · `GET /api/system-health` |
| Alerts | `GET /api/alerts` · `POST /api/alerts/{id}/resolve` |
| Automation | `GET /api/automation` · `PUT DELETE /api/automation/{id}` |
| Users | `GET /api/users` · `GET /api/users/{id}` · `PATCH /api/users/{id}/role` |
| Reports | `GET /api/reports/{type}` |

See `DEVICE_PROTOCOL.md` for the ESP32 side.

## Permissions

| Role | May do |
|---|---|
| Administrator | Everything, across all farms |
| Farm manager | Control actuators, edit crop profiles and automation |
| Agronomist | Edit crop profiles (the thresholds that drive every decision) |
| Operator | Control actuators |
| Viewer | Read only |

A verified token with no Firestore profile gets **no** permissions, not a default
role. Every actuator command and threshold change is written to `auditLogs` with
the user, the target and the values.

## Firestore indexes

Composite indexes are needed for these query shapes:

- `sensorReadings`: `farmId` + `sensorType` + `timestamp`, and with `zoneId` added
- `irrigationEvents`: `farmId` + `startedAt`, and `farmId` + `zoneId` + `startedAt`
- `alerts`: `farmId` + `timestamp`, and `farmId` + `category` + `resolvedAt`
- `commands`: `deviceId` + `state`, and `farmId` + `issuedAt`

Firestore returns an error containing a direct link to create each one the first
time it is needed.
