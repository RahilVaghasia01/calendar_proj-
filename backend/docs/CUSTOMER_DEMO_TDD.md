# Customer demo: Git trunk vs branches + TDD (Red → Green)

Use this outline when you present to the customer / instructor. It matches the **Testing Overview** lecture flow: specify behaviour with tests first, show **Red**, implement, show **Green**.

---

## Part A — Main trunk and feature branches (about 2 minutes)

### What to show

1. Open your repo on **GitHub** (or run `git log --oneline --graph --all --decorate` locally).
2. Point to **`main`** (or `master`):  
   **“This is our main trunk — the stable integration line we demo and deploy from.”**
3. Point to **feature branches** (examples):  
   - `feature/notifications-summary` — notification bell counts API  
   - `feature/calendar-ui` — frontend work  
   **“Branches are where we build one feature at a time without breaking the trunk.”**
4. One sentence on **merge**:  
   **“When tests pass and code is reviewed, we merge the branch into `main`.”**

### Diagram (optional slide)

```text
main (trunk)  ●────●────●────●
                    \
feature/foo          ●──●──●
                          \
                     (merge PR)
```

---

## Part B — Test-Driven Development for a new feature

### Feature chosen (small and demo-friendly)

**`GET /api/notifications/summary`**  
Returns JSON: `{ "total": <number>, "unread": <number> }` for the logged-in user — useful for a notification bell in the UI.

### TDD steps (what the lecture asks for)

1. **Write the test first** — see `backend/test/notifications-summary.test.js`.  
   The tests describe exactly what the API must do (401 without token, `{ total, unread }` shape, etc.).

2. **Red — run tests before the feature exists**  
   - Temporarily **remove** the `GET /api/notifications/summary` route from `backend/routes/notifications.js` **and** remove `getNotificationSummary` from `backend/lib/store.js` (or comment them out).  
   - From `backend/` run:
     ```bash
     npm test
     ```
   - **Expected:** tests **fail** (e.g. **404** on `/summary` or wrong body) — this is **Red**.

3. **Green — implement the minimum code**  
   - Restore **only** what makes the tests pass:
     - `db.getNotificationSummary(userId)` in `store.js`
     - `router.get('/summary', ...)` in `notifications.js` (keep it **above** any `/:id` routes if you add GET params later)
   - Run again:
     ```bash
     npm test
     ```
   - **Expected:** all tests **pass** — **Green**.

4. **Broader suite**  
   - `backend/test/notifications-api.test.js` covers list, unread-count, mark read, read-all.

---

## Commands cheat sheet (for live demo)

```bash
cd backend
npm install          # first time / after pulling
npm test             # run full Jest suite (uses temp JSON files, not your real wizz.json)
npm start            # run server for manual UI demo
```

---

## What to say in one sentence

**“We keep stable work on `main`, build features on branches, and for the notification summary we wrote Jest tests first, showed them failing, then implemented the endpoint until everything went green.”**

---

## Files involved

| File | Role |
|------|------|
| `backend/app.js` | Builds Express app without `listen` (needed for automated tests) |
| `backend/index.js` | Starts server in production |
| `backend/lib/store.js` | `getNotificationSummary`, optional `WIZZ_JSON_PATH` for tests |
| `backend/routes/notifications.js` | `GET /api/notifications/summary` |
| `backend/test/notifications-summary.test.js` | TDD tests for summary |
| `backend/test/notifications-api.test.js` | Tests for rest of notification API |
