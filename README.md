# AgriGuard LIVE — Split Backend + Frontend

## Structure
- `backend/` — Node.js/Express API + Firebase Realtime Database connection. Runs on port **1573**.
- `frontend/` — React/Vite UI. Runs on port **1572**.
- `esp32/` — Arduino/ESP32 firmware aligned with the attached AgriGuard sketch.
- `start.bat` — starts backend and frontend together in **one terminal**.

## Run
Double-click `start.bat`, then open `http://localhost:1572`.

The frontend sends `/api/*` requests to its Vite server on 1572. Vite proxies those requests to the backend on 1573, so the browser only needs the 1572 address. Realtime SSE at `/api/events` is proxied the same way.

## Live Firebase paths
The project reads the ESP32 data under `/agriguard`, including zones, environment, reservoir, irrigation and system state. Pump commands are written under `/agriguard/commands/pump` for the included ESP32 firmware to consume.
