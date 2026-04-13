# 🚀 WIZZ — Space Calendar & Mission Tracker

A space-themed full-stack scheduling app built with **Node.js / Express** on the backend and **vanilla HTML/CSS/JS** on the frontend. Tasks are stored in a local JSON file — no database server, no native modules, no compilation required.

---

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Setup & Running](#setup--running)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Data Schema](#data-schema)
- [Frontend Overview](#frontend-overview)
- [Implementation Notes](#implementation-notes)

---

## Features

### Core
- **User accounts** — register, log in, and log out with JWT-based auth and bcrypt password hashing
- **Task management** — create, edit, delete, and complete tasks with title, time, priority (1–5), duration, deadline, and colour
- **Monthly calendar** — browse months, click any day to view and manage events for that date
- **Priority Mission Board** — Kanban-style modal showing all tasks sorted into five priority lanes (Low → High) with overdue and due-today badges; filterable by All / Pending / Done / Overdue
- **Auto-schedule** — `GET /api/tasks/schedule` sorts tasks by priority, deadline, and duration and assigns suggested start/end times starting from 08:00

### Productivity
- **Search** — debounced live search across task titles and descriptions; results shown in a dropdown bar with click-to-jump
- **My Daily Routine** — define recurring events (daily / weekly / yearly) stored in `localStorage`; expanded into the calendar grid for the visible month range
- **Mission Stats sidebar** — total events, events this month, next 7 days, and completed count; updates on every action
- **Upcoming sidebar** — next 5 non-completed events sorted by date
- **CSV export** — download all events as a `.csv` file

### Notifications
- **Background checker** — runs every 60 seconds server-side and auto-creates notifications for overdue tasks, tasks due today, and tasks due within 3 days (one notification per type per task, no duplicates)
- **Notification bell** — topbar bell with red badge; opens a "Transmissions" dropdown showing all notifications with type icon, message, and relative timestamp
- **Per-notification actions** — mark individual notifications as read (clicking the row), dismiss (delete) a single notification, mark all read, or clear all
- **Badge polling** — frontend polls `GET /api/notifications/count` every 30 seconds to keep the badge count live

### Automatic Rescheduling
- **Reschedule Overdue panel** — sidebar button opens a slide-in right panel listing all overdue non-done tasks sorted by priority
- **Smart date suggestions** — for each overdue task the app finds the next calendar day that has no existing events, so suggestions never double-book
- **Override before accepting** — each suggestion card includes an inline date picker so you can change the date before accepting
- **Accept / Skip / Accept All** — accepting patches the task's deadline via `PATCH /api/tasks/:id` and immediately reloads the calendar; skipping slides the card out without touching the backend
- **Live badge** — the Reschedule button shows a red count badge that pulses when overdue tasks exist and updates automatically after every data reload

### UX & Visual
- Space theme — animated star field, nebula gradients, shooting stars, floating planets
- Drum/scroll time picker with AM/PM and All Day toggle
- Login reminder popup on app load if any tasks are overdue or due today
- Colour-coded event chips on calendar cells (5 colours mapped to priority)
- Keyboard shortcut: `Enter` to submit login or add event

---

## Project Structure

```
wizz/
├── backend/
│   ├── index.js                  # Express entry point, routes, static serving
│   ├── package.json
│   ├── .env.example
│   ├── wizz.json                 # Auto-created JSON data file (gitignored)
│   ├── lib/
│   │   ├── db.js                 # Re-exports store.js
│   │   ├── store.js              # JSON file read/write, all DB methods
│   │   └── notificationChecker.js# Background deadline checker (60s interval)
│   ├── middleware/
│   │   └── auth.js               # JWT requireAuth middleware
│   └── routes/
│       ├── auth.js               # POST /api/register, /api/login, GET /api/me
│       ├── tasks.js              # Full task CRUD + schedule + search
│       └── notifications.js      # Full notifications CRUD
└── public/
    ├── index.html                # Single-page app (login, register, calendar)
    ├── app.js                    # All frontend JS (~1400 lines)
    └── style.css                 # All styles (~2500 lines)
```

---

## Setup & Running

### Prerequisites

- **Node.js** v18 or later
- **npm**

> **Windows / PowerShell note:** If `npm` gives a "running scripts is disabled" error, run this once in PowerShell as Administrator:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine
> ```
> Then reopen your terminal. Alternatively, use **Command Prompt (cmd)** instead of PowerShell.

### Steps

1. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment** *(optional for local dev)*
   ```bash
   cp .env.example .env
   # Edit .env and set JWT_SECRET to a long random string
   ```

3. **Start the server**
   ```bash
   # Production
   npm start

   # Development (auto-restarts on file changes)
   npm run dev
   ```

4. **Open in browser**
   ```
   http://localhost:3000
   ```
   The first run creates `wizz.json` automatically with empty `users`, `tasks`, and `notifications` arrays.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the Express server listens on |
| `JWT_SECRET` | `dev-secret-change-in-production` | Secret used to sign and verify JWTs. **Change this in production.** |

---

## API Reference

All protected routes require the header:
```
Authorization: Bearer <token>
```
The token is returned by `/api/login` and `/api/register`.

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/register` | No | Register. Body: `{ username, password }`. Returns `{ token, user }`. |
| `POST` | `/api/login` | No | Login. Body: `{ username, password }`. Returns `{ token, user }`. |
| `GET` | `/api/me` | ✓ | Returns `{ id, username }` for the token owner. |

### Tasks

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/tasks` | ✓ | All tasks for the current user, newest first. |
| `GET` | `/api/tasks/:id` | ✓ | Single task by ID. |
| `POST` | `/api/tasks` | ✓ | Create a task. Body fields below. |
| `PATCH` | `/api/tasks/:id` | ✓ | Update any subset of fields. |
| `PATCH` | `/api/tasks/:id/toggle` | ✓ | Toggle status between `todo` and `done`. |
| `DELETE` | `/api/tasks/:id` | ✓ | Delete a task. Returns 204. |
| `GET` | `/api/tasks/schedule` | ✓ | Auto-schedule: tasks sorted by priority → deadline → duration, with `suggested_start` and `suggested_end` times from 08:00. |
| `GET` | `/api/tasks/search?q=` | ✓ | Case-insensitive search across `title` and `description`. |

**Task body fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | ✓ | |
| `description` | string | | Used to store the event time (e.g. `"09:00 AM"`) |
| `status` | string | | `"todo"` (default) or `"done"` |
| `priority` | number | | 1 = Low, 2 = Med−, 3 = Med, 4 = Med+, 5 = High |
| `duration_minutes` | number | | Used by the auto-scheduler |
| `deadline` | string | | ISO date `"YYYY-MM-DD"` |

### Notifications

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/notifications` | ✓ | All notifications, newest first. Optional `?unread=true` filter. Returns `{ notifications, unreadCount }`. |
| `GET` | `/api/notifications/count` | ✓ | Lightweight — returns `{ unreadCount }` only. Polled every 30s by the frontend. |
| `PATCH` | `/api/notifications/:id/read` | ✓ | Mark a single notification as read. |
| `PATCH` | `/api/notifications/read-all` | ✓ | Mark all notifications as read. Returns `{ marked }`. |
| `DELETE` | `/api/notifications/:id` | ✓ | Delete a single notification. Returns 204. |
| `DELETE` | `/api/notifications` | ✓ | Clear all notifications for the current user. |

### Other

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | No | Health check. Returns `{ ok: true }`. |

---

## Data Schema

Data is persisted in `wizz.json` in the backend folder. The file is created automatically on first run and is listed in `.gitignore`.

### Users
| Field | Type | Notes |
|---|---|---|
| `id` | number | Auto-incrementing |
| `username` | string | Unique |
| `password_hash` | string | bcrypt hash |

### Tasks
| Field | Type | Notes |
|---|---|---|
| `id` | number | Auto-incrementing |
| `user_id` | number | Foreign key → users.id |
| `title` | string | |
| `description` | string \| null | Stores event time as a string |
| `status` | string | `"todo"` or `"done"` |
| `priority` | number \| null | 1–5 |
| `duration_minutes` | number \| null | |
| `deadline` | string \| null | `"YYYY-MM-DD"` |
| `created_at` | string | ISO 8601 |
| `updated_at` | string | ISO 8601 |

### Notifications
| Field | Type | Notes |
|---|---|---|
| `id` | number | Auto-incrementing |
| `user_id` | number | Foreign key → users.id |
| `type` | string | `overdue`, `deadline_today`, `deadline_soon`, `task_created`, `task_completed` |
| `title` | string | Display title (e.g. `"🚨 Mission Overdue"`) |
| `message` | string | Full notification body |
| `task_id` | number \| null | Related task |
| `read` | boolean | |
| `created_at` | string | ISO 8601 |

---

## Frontend Overview

The frontend is a single HTML file (`public/index.html`) with no build step, no React, and no external JS libraries. It is served by `express.static('public')`.

### Pages
- **Login** — username/password form, links to Register
- **Register** — username, email (validated client-side), password + confirm
- **App** — full calendar, sidebar, topbar with search/notifications/controls

### Key frontend modules (`app.js`)

| Module | What it does |
|---|---|
| API helper | `api(path, options)` — wraps `fetch`, injects `Authorization` header, handles 204/error responses |
| Auth | Login, register, logout; JWT stored in `localStorage` |
| Calendar | Monthly grid, navigate months, colour-coded event chips, today highlight |
| Event Panel | Click a date to open a modal — view, add, edit, delete events for that day |
| Drum time picker | Scroll-wheel hour / minute / AM-PM columns with All Day toggle |
| Priority selector | 5-button row (LOW → HIGH), default MED |
| Task Board | Priority Mission Board modal — 5 Kanban lanes, filter buttons, overdue/today badges |
| Search | Debounced 280ms, calls `/api/tasks/search`, results bar with click-to-jump |
| Sidebar stats | Total, this month, next 7 days, completed — recalculated after every action |
| Upcoming list | Next 5 non-done events sorted by date |
| My Daily Routine | Recurring events stored in `localStorage`; expanded into calendar for ±1 month of current view |
| Login reminder popup | Shows on app load if any tasks are overdue or due today |
| Notification bell | Badge-counted bell in topbar; dropdown panel with read/dismiss/clear actions |
| Reschedule panel | Slide-in right panel; finds next free day for each overdue task; inline date override; Accept / Skip / Accept All |
| CSV export | Downloads all events as a `.csv` file |

### localStorage keys

| Key | Contents |
|---|---|
| `wizz_token` | JWT auth token |
| `wizz_username` | Logged-in username |
| `wizz_routine` | JSON array of daily routine steps |

---

## Implementation Notes

### Auth flow
Register or login → server returns `{ token, user }` → token stored in `localStorage` → every subsequent `fetch` call adds `Authorization: Bearer <token>` → `requireAuth` middleware verifies the JWT and loads the user from the JSON store → sets `req.user` for the route handler.

On page load, if a token exists in `localStorage`, the frontend calls `GET /api/me`. If it succeeds the app launches directly; if it fails (expired/invalid token) the token is cleared and the login page is shown.

### JSON data store (`lib/store.js`)
No SQLite, no Postgres, no native modules. `load()` reads and parses `wizz.json` on every call; `save(data)` writes it back synchronously. `nextId(arr)` takes `Math.max` of all existing IDs + 1. All store methods (users, tasks, notifications) follow the same pattern: load → mutate → save → return.

This approach is fine for a single-user local app but would not scale to concurrent writes — switching to SQLite (`better-sqlite3`) or a proper DB is the natural next step.

### Route ordering
`GET /api/tasks/schedule` and `GET /api/tasks/search` are registered **before** `GET /api/tasks/:id` so the literal strings `"schedule"` and `"search"` are never mistaken for numeric task IDs.

### Notification deduplication
`notificationExists(userId, taskId, type)` is checked before every `createNotification` call in the background checker. This means each task gets at most one `overdue` notification, one `deadline_today`, and one `deadline_soon` — no matter how many times the 60-second interval fires.

### Rescheduling logic
`nextAvailableDate()` starts from tomorrow and walks forward day by day checking against a `Set` of dates that already have at least one non-done event. Each overdue task consumes a date from that set, so if multiple tasks are being rescheduled at once they each land on a different day. The search is capped at 60 days to prevent an infinite loop if the calendar is extremely full.

### My Daily Routine
Routine steps are stored only in `localStorage` (not the backend) and are **virtual** — they are expanded into `eventsCache` on the fly for the ±1 month window around the current view. Their IDs are prefixed with `"rt-"` so the frontend never attempts to POST or DELETE them via the API.
