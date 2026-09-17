# ESP32 ↔ backend protocol

Two endpoints, both authenticated with the shared secret in `DEVICE_INGEST_KEY`,
sent as the `X-Device-Key` header. No user token is involved.

Ingest is refused outright when no key is configured. An open telemetry endpoint
would let anyone write readings that look genuine, which is the one failure this
whole system is built to prevent.

## 1. Post telemetry

```
POST /api/telemetry/ingest
X-Device-Key: <secret>
```

```json
{
  "farmId": "farm_abc",
  "deviceId": "esp32_north",
  "readings": [
    {
      "zoneId": "zone_a",
      "sensorId": "moisture_a1",
      "sensorType": "SOIL_MOISTURE",
      "value": 27.4,
      "unit": "%",
      "timestamp": "2026-09-17T09:14:02Z",
      "quality": "GOOD"
    }
  ]
}
```

`timestamp` is optional — arrival time is used when the device has no clock.

Set `quality` to `BAD` when a probe reads out of range. The backend turns that
into a sensor-error status instead of treating the number as a real measurement,
so a shorted probe reading zero never looks like bone-dry soil.

Accepting a batch returns 202 and a summary of what it caused:

```json
{ "accepted": 4, "zonesEvaluated": 3, "statuses": { "zone_a": "DRY" } }
```

`sensorType` is one of: `SOIL_MOISTURE`, `SOIL_TEMPERATURE`,
`AMBIENT_TEMPERATURE`, `HUMIDITY`, `LIGHT`, `RESERVOIR_LEVEL`, `FLOW`,
`SOLAR_VOLTAGE`, `SOLAR_CURRENT`, `BATTERY_VOLTAGE`, `BATTERY_PERCENT`.

A `RESERVOIR_LEVEL` reading sent in `cm` is treated as an ultrasonic distance and
converted to a percentage **only if** the tank height has been configured. Litres
appear only once a capacity has been configured too. Otherwise the distance is
stored on its own and the level is reported as unavailable.

## 2. Poll for commands, then acknowledge

```
GET /api/irrigation/devices/{deviceId}/queue
X-Device-Key: <secret>
```

Returns commands in `ACCEPTED` state and moves them to `WAITING_FOR_DEVICE`.

After acting on one:

```
POST /api/irrigation/commands/{commandId}/ack
X-Device-Key: <secret>
```

```json
{ "state": "CONFIRMED" }
```

or

```json
{ "state": "FAILED", "failureReason": "Valve did not reach the open limit switch" }
```

This is the **only** route that can set `CONFIRMED`. The dashboard shows "Pump
on" solely because a device said so, which is what lets an operator trust the
label. Report `FAILED` honestly — a silent success is far worse than a visible
failure, because nobody goes to check on equipment the screen says is fine.

## What happens after a batch lands

```
store readings
  → re-evaluate every zone against its crop profile
  → raise or resolve alerts
  → run automation rules
  → broadcast over Socket.IO
```

Automation fails safe at every step. A rule is skipped rather than guessed at
when its sensor is missing, stale or faulty; when the reservoir level is unknown
and a minimum was configured; or when the zone has no actuator assigned. A rule
with `sensorFailureBehaviour: "HALT"` closes anything it opened when its sensor
drops out.

## Socket.IO

Connect to the same host, path `socket.io`, then join a farm room:

```js
socket.emit("subscribe", { farmId: "farm_abc" });
```

Events broadcast to that room: `telemetry:update`, `zone:update`,
`device:status`, `irrigation:start`, `irrigation:stop`, `shade:deployed`,
`shade:retracted`, `reservoir:update`, `solar:update`, `alert:new`,
`alert:resolved`, `system:health`.
