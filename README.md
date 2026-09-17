# AgriGuard 3D

Solar-powered precision irrigation, climate defence and digital-twin monitoring for macadamia and citrus orchards in Mpumalanga.

React · TypeScript · Vite · Tailwind · Framer Motion · TanStack Query · Firebase · Socket.IO · Three.js

---

## The core contract

**There is no mock data anywhere in this codebase.** No `Math.random`, no seeded telemetry, no example charts, no demo fallback when Firebase is unreachable. This is enforced structurally rather than by convention:

| Situation | What the UI does |
|---|---|
| No reading has ever arrived | Shows `--` and a reason ("Waiting for data", "Reservoir sensor unavailable") |
| A request is in flight | Shows a loading skeleton |
| The transport failed | Shows an error state with a retry action |
| The newest reading is older than `VITE_STALE_DATA_SECONDS` | Labels it **Stale data** and never presents it as live |
| A crop profile lacks the threshold needed to judge a zone | Status is **Not evaluated**, with "No crop profile assigned" beneath it |
| A period has no stored history | "Insufficient historical data for comparison." |
| A component has no health record | **Unknown** — never Online |

A reading missing its value, timestamp or sensor type is **dropped in the mapper** (`services/firebase/telemetry.ts`) rather than defaulted, so a malformed document can never reach a screen as a number.

### Agronomy is configuration, not code

No moisture or temperature threshold appears anywhere in the source. Every one comes from a `CropProfile` record supplied by the backend, and every field on that record is optional. `utils/zoneStatus.ts` evaluates a zone only against thresholds that are actually present; if the profile does not define them, it returns `UNKNOWN` with `profileIncomplete: true` instead of falling back to a literature value. Macadamia and citrus are separate profiles by construction — nothing in the code treats them interchangeably.

### Actuator commands never lie

Clicking a control does not change any equipment label. `hooks/useActuatorCommand.ts` moves through `SENDING → WAITING_FOR_DEVICE → CONFIRMED | FAILED`, driven entirely by the command record the device writes back. "Pump on" appears only after confirmation. Every command is gated behind a confirmation dialog naming the device and action, and behind a role permission.

---

## Architecture

```
ESP32 ──┬──────────────────────────► Firebase ──┐
        │                                        ├──► RepositoryBundle ──► hooks ──► UI
        └──► Node.js REST + Socket.IO ──────────┘
```

The UI imports **no Firebase symbol anywhere**. It depends on the interfaces in `services/repositories/index.ts`. Two full implementations exist:

- `services/firebase/` — Firestore queries and `onSnapshot` listeners
- `services/api/` — Axios REST plus Socket.IO events

`services/repositoryProvider.tsx` picks one at the root from `VITE_DATA_SOURCE`. Switching data paths does not touch a single screen.

```
src/
  animations/     Framer Motion variants
  api/            Axios client (token injected at request time), typed Socket.IO wrapper
  components/
    common/       DataState, StatusBadge, LiveIndicator, AnimatedNumber, MetricCard, ConfirmDialog, ErrorBoundary
    dashboard/    ZoneCard, SystemHealthPanel, ComparisonPanel
    landing/      SystemFlowDiagram, OrchardPanel
  constants/      config (env), sensor labels, status presentation, navigation
  contexts/       AuthContext (Firebase Auth + role permissions), FarmScopeContext
  firebase/       config from env only, Timestamp converters
  hooks/          useTelemetry, useZones, useAlerts, useLiveStatus, useSystemHealth, useActuatorCommand
  layouts/        DashboardLayout, Sidebar, TopBar, MobileNav
  pages/          Route screens
  schemas/        Zod validation
  services/       Repository interfaces + both implementations + provider
  types/          Complete domain model
  utils/          zoneStatus (the evaluation engine), formatting, cn
```

## Accessibility and motion

Status is never colour alone — every badge carries colour, an icon and a text label. Focus rings are visible and never removed. `prefers-reduced-motion` is honoured twice over: through `MotionConfig reducedMotion="user"` and in the stylesheet. The live indicator pulses only when the connection is genuinely live, so the animation is itself a truthful signal.

## Setup

```bash
cp .env.example .env     # fill in your Firebase or backend values
npm install
npm run dev
```

With no credentials set, the app runs and shows a configuration banner explaining which variables are missing — so an empty dashboard is never mistaken for a farm without sensors.

```bash
npm run typecheck   # passes clean
npm run build
```

## Firestore collections

`users`, `farms`, `fields`, `zones`, `cropProfiles`, `devices`, `sensors`, `sensorReadings`, `latestReadings`, `irrigationEvents`, `shadeEvents`, `reservoirReadings`, `reservoirConfig`, `flowReadings`, `solarReadings`, `batteryReadings`, `alerts`, `systemHealth`, `automationRules`, `commands`, `auditLogs`

Period comparisons read pre-aggregated `comparisons` documents written by the backend; the client never computes a comparison from data it invented.

---

## Build status

**Complete:** domain model · repository abstraction (both implementations) · Firebase config and auth · role permissions · zone status engine · live/stale/offline detection · shared state components · app shell (sidebar, top bar, mobile nav) · landing page · login · register · main dashboard

**Next:** onboarding wizard · zones and zone detail · digital twin · irrigation · reservoir · energy · crop intelligence · analytics · alerts · devices · automation · reports · settings · profile

Every remaining route is registered and reachable; each currently states plainly that its screen is still being built rather than rendering an empty dashboard.
