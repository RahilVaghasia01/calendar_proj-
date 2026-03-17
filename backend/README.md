# WIZZ Backend – Week 1 Starter

Simple Express API using a **JSON file** (`wizz.json`) for data—no database server and **no native modules** (so no Visual Studio or compilation needed). Uses **bcrypt** for passwords and **JWT** for login.

A **single-page frontend** is included in `public/` so you can use the app in the browser: login, register, create tasks (with duration & priority), edit/delete tasks, and view your **auto-schedule**.

## If npm says "running scripts is disabled" (PowerShell)

Run this once in **PowerShell (Run as Administrator)**:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine
```

Then close and reopen your terminal. Alternatively, use **Command Prompt (cmd)** instead of PowerShell: open cmd, `cd` to `backend`, and run `npm install` and `npm start` there.

## Setup

1. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```
   (Use **Command Prompt** if PowerShell blocks npm; see above.)

2. **Environment (optional)**  
   Copy `.env.example` to `.env` and set `JWT_SECRET` to a long random string. If you don’t, the code uses a default secret (fine for local dev only).

3. **Run the server**
   ```bash
   npm start
   ```
   Or with auto-reload: `npm run dev`

4. **Open in browser**  
   Go to **http://localhost:3000** — you’ll see the login/register page and (after logging in) task list and auto-schedule.

The first time you run, the app creates `wizz.json` in the backend folder with empty `users` and `tasks` arrays.

## API (Week 1)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |
| POST | `/api/register` | No | Register. Body: `{ "username": "...", "password": "..." }`. Returns `{ token, user }`. |
| POST | `/api/login` | No | Login. Body: `{ "username": "...", "password": "..." }`. Returns `{ token, user }`. |
| GET | `/api/me` | Bearer token | Current user `{ id, username }`. |
| GET | `/api/tasks` | Bearer token | List my tasks |
| GET | `/api/tasks/schedule` | Bearer token | **Auto-schedule**: tasks sorted by priority and deadline with suggested start/end times. |
| GET | `/api/tasks/:id` | Bearer token | Get one task |
| POST | `/api/tasks` | Bearer token | Create task. Body: `title`, optional: `description`, `status`, `duration_minutes`, `priority`, `deadline`. |
| PATCH | `/api/tasks/:id` | Bearer token | Update task |
| DELETE | `/api/tasks/:id` | Bearer token | Delete task |

**Auth:** After login or register, the response includes a `token`. The frontend should send it on later requests in the header:  
`Authorization: Bearer <token>`.

## Folder layout

- `index.js` – Express app, CORS, JSON, static frontend, routes
- `lib/db.js` – exports the JSON store
- `lib/store.js` – reads/writes `wizz.json` (users and tasks)
- `middleware/auth.js` – Validates JWT and sets `req.user`
- `routes/auth.js` – Register, login, GET /api/me
- `routes/tasks.js` – Task CRUD + GET /api/tasks/schedule (auto-schedule)
- `public/index.html` – Single-page UI: login, register, create/edit/delete tasks, view schedule

## Database (JSON file)

- Data is stored in **wizz.json** in the backend folder.
- **users** – `id`, `username`, `password_hash`
- **tasks** – `id`, `user_id`, `title`, `description`, `status`, `duration_minutes`, `priority`, `deadline`, `created_at`, `updated_at`

No SQLite or other database install required.

---

## Implementation notes (jot notes)

How each part was done, in brief.

### Student account & login (Must Have)
- **Register:** `POST /api/register` in `routes/auth.js`. Validate `username`/`password` → hash password with `bcrypt.hashSync(password, 10)` → `db.createUser(username, password_hash)` → `jwt.sign({ userId }, JWT_SECRET)` → return `{ token, user }`. Duplicate username → catch store error, return 409.
- **Login:** `POST /api/login`. Get user by username with `db.getUserByUsername()` → `bcrypt.compareSync(password, user.password_hash)` → if match, sign JWT and return `{ token, user }`; else 401.
- **Who am I:** `GET /api/me` uses `requireAuth` middleware; returns `req.user` (set by middleware after JWT verify + `db.getUserById()`).
- **Auth middleware** (`middleware/auth.js`): Read `Authorization: Bearer <token>` → `jwt.verify(token, JWT_SECRET)` → load user from store → set `req.user` and call `next()`; on any failure return 401.

### Create tasks with duration & priority (Must Have)
- **Backend:** `POST /api/tasks` in `routes/tasks.js`. Require `title`; accept `duration_minutes`, `priority`, `description`, `status`, `deadline`. Set `user_id` from `req.user.id`. Call `db.createTask({ ... })`, return created task with 201.
- **Store:** `lib/store.js` – `createTask(row)` assigns next id, pushes task into `data.tasks`, saves `wizz.json`, returns the new task.
- **Frontend:** Form with title, number input for minutes, dropdown for priority 1–5; on submit `fetch('/api/tasks', { method: 'POST', body: JSON.stringify({ title, duration_minutes, priority }) })` with Bearer token; then refresh task list and schedule.

### Edit or delete tasks (Must Have)
- **Edit:** `PATCH /api/tasks/:id`. Build `updates` from `req.body` (only fields present); `db.updateTask(id, req.user.id, updates)` so user can only edit own tasks; return updated task or 404.
- **Delete:** `DELETE /api/tasks/:id`. `db.deleteTask(id, req.user.id)`; return 204 or 404.
- **Frontend:** Each task row has Edit / Delete. Edit uses `prompt()` for new title/duration/priority then `PATCH`. Delete confirms then `DELETE`; then reload list and schedule.

### Auto-schedule tasks (Must Have)
- **Backend:** `GET /api/tasks/schedule`. `db.getTasksForSchedule(req.user.id)` returns tasks sorted by priority (high first), then deadline (soonest), then duration (longer first). Loop over tasks: start at 8:00, set `suggested_start` and `suggested_end` (start + duration_minutes), next task starts at previous end. Return array with those fields added.
- **Store:** `getTasksForSchedule(userId)` filters by `user_id`, then `sort()` with custom compare (priority desc, deadline asc, duration desc).
- **Frontend:** Call `GET /api/tasks/schedule`, render list with `suggested_start`–`suggested_end` and task title/priority/duration.

### Data layer (no Supabase / no native DB)
- Replaced Supabase and SQLite with a **JSON file** so no cloud signup and no C++ build (avoids Node 25 + Windows VS build issues).
- **`lib/store.js`:** `load()` reads `wizz.json` (or returns `{ users: [], tasks: [] }` if missing), `save(data)` writes it back. Helpers: `nextId(arr)`, `now()`. Methods: `getUserByUsername`, `getUserById`, `createUser`; `getTasksByUserId`, `getTaskByIdAndUserId`, `getTasksForSchedule`, `createTask`, `updateTask`, `deleteTask`.
- **`lib/db.js`:** Just `module.exports = require('./store')` so rest of app uses `require('../lib/db')`.

### Frontend (single page, no build)
- **One file:** `public/index.html`. Vanilla JS, no React/build. Served by `express.static('public')` so `GET /` returns it.
- **Token:** Stored in `localStorage`; `api(path, options)` adds `Authorization: Bearer <token>` to every request; logout clears token.
- **Flow:** Login/register → set token → show "when logged in" div and call `loadTasks()` + `loadSchedule()`. Create task → POST → reload. Edit/delete → PATCH/DELETE → reload. On page load, if token exists, `GET /api/me` to restore session.

### Other decisions
- **CORS** enabled so API can be called from other origins if needed.
- **404** for unknown routes; **500** handler logs and returns generic error.
- **Route order:** `GET /api/tasks/schedule` defined before `GET /api/tasks/:id` so `"schedule"` is not treated as an id.
