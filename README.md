# 🌌 Orbitly — Your Personal Space Calendar

> A lightweight, browser-based calendar app for organizing your universe — no servers, no sign-ups, no fuss.

---

## ✨ What is Orbitly?

Orbitly is a **prototype** frontend calendar web app built for personal event management. Create an account, log in, and take control of your schedule — all without leaving your browser. Your data stays on your device, private and instant.

---

## 🚀 Features

- 🔐 **User registration & login** — Create a local account and log back in anytime
- 📅 **Monthly calendar view** — Clean, navigable month grid
- ➕ **Add events** — Tap any date to drop in an event
- ✏️ **Edit events** — Update event details on the fly
- 🗑️ **Delete events** — Remove anything you no longer need
- 🔮 **Upcoming events panel** — See what's coming at a glance
- 📤 **CSV export** — Download your events as a spreadsheet
- 💾 **Browser storage** — Everything saves locally, no backend needed

---

## 📁 Project Structure

```
orbitly/
├── backend/           # Backend server logic
│   ├── lib/           # Utility/helper modules
│   ├── middleware/    # Express middleware (auth, validation, etc.)
│   ├── public/        # Static assets served by backend
│   ├── routes/        # API route handlers
│   └── index.js       # Backend entry point
│
├── .env.example       # Environment variable template
├── .gitignore         # Git ignored files
├── package.json       # Project dependencies and scripts
├── package-lock.json  # Dependency lock file
│
├── index.html         # Frontend app shell
├── style.css          # Frontend styles
├── app.js             # Frontend logic
│
└── README.md          # Project documentation
```

---

## 🛠️ Getting Started

1. **Clone or download** this repository  

2. **Install backend dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   - Copy `.env.example` → `.env`
   - Fill in any required values

4. **Start the backend server**:
   ```bash
   node index.js
   ```
   or (if using nodemon):
   ```bash
   npx nodemon index.js
   ```

5. **Run the frontend**:
   - Open `index.html` directly in your browser  
   **OR**
   - Serve it locally for best results:

   ```bash
   # Python 3
   python -m http.server
   ```

   Then visit:  
   `http://localhost:8000`

---

## 🧭 Roadmap Ideas

Things that could make Orbitly even better down the line:

- 🔁 Recurring events
 🌐 Cloud sync / backend integration
- 📆 Week and day views
- 🎨 Color-coded event categories
- 🔔 Browser notifications for upcoming events
- 📱 Mobile-responsive polish
