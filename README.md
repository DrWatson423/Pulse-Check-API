# Pulse-Check-API ("Watchdog" Sentinel)
This is a switch API built with Node.js and Express. A remote device can register a monitor with a countdown timer. If no hearbeat is sent before the timer expires, an alert is fired.


## Architecture Diagram

### State Machine — Monitor Lifecycle

```
                     POST /monitors
                          │
                          ▼
                    ┌─────────────┐
                    │  REGISTERED │  Timer starts immediately
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
              ┌────▶│   ACTIVE    │◀────────────────────────────┐
              │     └──────┬──────┘                              │
              │            │                                     │
              │     timer expires?                      POST /:id/heartbeat
              │            │                            (un-pauses + resets)
              │            ▼                                     │
              │     ┌─────────────┐                     ┌─────── ┴─────┐
              │     │    DOWN     │                     │   PAUSED     │
              │     │  (alert!)   │          POST /:id/pause           │
              │     └─────────────┘          └─────────────────────────┘
              │
              └──── POST /:id/heartbeat (timer reset → stays ACTIVE)
```

### Sequence Diagram — Happy Path

```
Device          API Server          Timer Engine
  │                  │                    │
  │ POST /monitors   │                    │
  │─────────────────▶│                    │
  │  201 Created     │  startTimer(60s)   │
  │◀─────────────────│───────────────────▶│
  │                  │                    │
  │                  │   ... 45 seconds   │
  │                  │                    │
  │ POST /heartbeat  │                    │
  │─────────────────▶│  clearTimer()      │
  │  200 OK          │  startTimer(60s)   │
  │◀─────────────────│───────────────────▶│
  │                  │                    │
  │   (device goes offline)               │
  │                  │                    │
  │                  │   ... 60 seconds   │
  │                  │                    │
  │                  │◀── timeout fires ──│
  │                  │  status = 'down'   │
  │                  │  console.error(🚨) │
```

---

## Setup Instructions

### Prerequisites
- Node.js v16 or higher
- npm

### Install & Run

```bash
# Clone your fork
git clone https://github.com/<your-username>/Pulse-Check-API.git
cd Pulse-Check-API

# Install dependencies
npm install

# Start the server
npm start
# → 🚀 Pulse-Check API running on http://localhost:3000

# Development mode (auto-restart on file changes)
npm run dev
```

The server defaults to **port 3000**. Override with an environment variable:

```bash
PORT=8080 npm start
```

---

## API Documentation

### Base URL
```
http://localhost:3000
```

---

### `POST /monitors`
Register a new device monitor and start its countdown.

**Request Body**
```json
{
  "id": "device-123",
  "timeout": 60,
  "alert_email": "admin@critmon.com"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique device identifier |
| `timeout` | number | ✅ | Countdown duration in **seconds** |
| `alert_email` | string | ✅ | Email to notify when the device goes down |

**Responses**

| Status | Description |
|--------|-------------|
| `201 Created` | Monitor registered, timer started |
| `400 Bad Request` | Missing or invalid fields |
| `409 Conflict` | A monitor with this `id` already exists |

**Example**
```bash
curl -X POST http://localhost:3000/monitors \
  -H "Content-Type: application/json" \
  -d '{"id": "device-123", "timeout": 60, "alert_email": "admin@critmon.com"}'
```
```json
{ "message": "Monitor 'device-123' registered. Countdown started (60s)." }
```

---

### `POST /monitors/:id/heartbeat`
Reset the countdown timer for a registered monitor.

- If the monitor is **paused**, this call also **un-pauses** it and restarts the timer.
- If the monitor is already **down**, returns `409`.

**Responses**

| Status | Description |
|--------|-------------|
| `200 OK` | Timer reset successfully |
| `404 Not Found` | No monitor with this `id` |
| `409 Conflict` | Monitor already in `down` state |

**Example**
```bash
curl -X POST http://localhost:3000/monitors/device-123/heartbeat
```
```json
{ "message": "Heartbeat received. Timer reset to 60s.", "status": "active" }
```

---

### `POST /monitors/:id/pause`
Pause a monitor. The timer stops completely; no alert will fire while paused. Calling `/heartbeat` resumes it.

**Responses**

| Status | Description |
|--------|-------------|
| `200 OK` | Monitor paused |
| `404 Not Found` | No monitor with this `id` |
| `409 Conflict` | Monitor is already paused or is `down` |

**Example**
```bash
curl -X POST http://localhost:3000/monitors/device-123/pause
```
```json
{ "message": "Monitor 'device-123' paused. No alerts will fire until the next heartbeat." }
```

---

### `GET /monitors/:id` *(Developer's Choice)*
Retrieve the full current state of a single monitor.

**Response**
```json
{
  "id": "device-123",
  "timeout": 60,
  "alert_email": "admin@critmon.com",
  "status": "active",
  "createdAt": "2026-04-18T10:00:00.000Z",
  "lastPing": "2026-04-18T10:01:30.000Z"
}
```

| Status | Description |
|--------|-------------|
| `200 OK` | Monitor data returned |
| `404 Not Found` | No monitor with this `id` |

**Example**
```bash
curl http://localhost:3000/monitors/device-123
```

---

### `GET /monitors` *(Developer's Choice)*
List all registered monitors (all statuses).

**Example**
```bash
curl http://localhost:3000/monitors
```
```json
[
  {
    "id": "device-123",
    "status": "active",
    "timeout": 60,
    "alert_email": "admin@critmon.com",
    "createdAt": "2026-04-18T10:00:00.000Z",
    "lastPing": "2026-04-18T10:01:30.000Z"
  }
]
```

---

## Alert Behaviour

When a monitor's countdown reaches zero with no heartbeat, the system fires to the server console:

```
🚨 CRITICAL ALERT 🚨
{
  "ALERT": "Device device-123 is down!",
  "alert_email": "admin@critmon.com",
  "time": "2026-04-18T10:02:00.000Z"
}
```

The monitor's status changes to `"down"` and the timer stops. To resume monitoring, **delete and re-register** the monitor (or extend the API with a `/reset` endpoint).

---

## Developer's Choice — Status Inspection Endpoints

**Added:** `GET /monitors/:id` and `GET /monitors`

**Why?**

The core spec defines write operations (register, heartbeat, pause) but provides no read path. In a real-world monitoring system this creates a blind spot — there's no way to:

- Confirm a monitor registered correctly
- Check whether a device is currently `active`, `paused`, or `down` without waiting for an alert
- Build a simple dashboard or health-check script that polls device states

These two read endpoints close that gap with zero added complexity. They're read-only, stateless, and expose no sensitive internals (the internal `timerId` handle is stripped before returning). Any support engineer or ops dashboard can `GET /monitors` to get a full picture of the fleet in one request.

---

## Project Structure

```
pulse-check-api/
├── src/
│   ├── app.js            # Express setup, middleware, server start
│   ├── monitors.js       # In-memory store + timer logic
│   └── routes/
│       └── monitors.js   # Route handlers
├── package.json
└── README.md
```

---

## License

CC0-1.0 — see [LICENSE](./LICENSE).
