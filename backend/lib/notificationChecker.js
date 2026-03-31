/**
 * notificationChecker.js
 * ──────────────────────
 * Runs on a schedule (default: every 60 seconds) and scans all tasks to
 * auto-generate notifications for upcoming and overdue deadlines.
 *
 * Notification types created automatically:
 *   • overdue        — task is past its deadline and not done
 *   • deadline_today — task is due today and not done
 *   • deadline_soon  — task deadline is in 1–3 days and not done
 *
 * Each type is created only ONCE per task (deduplicated via notificationExists).
 * When a task is completed the overdue/deadline alerts are no longer created.
 */

const db = require('./db');

const INTERVAL_MS = 60 * 1000; // check every 60 seconds

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(deadlineStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dl = new Date(deadlineStr);
  dl.setHours(0, 0, 0, 0);
  return Math.ceil((dl - today) / (1000 * 60 * 60 * 24));
}

function priorityLabel(p) {
  const labels = { 1: 'Low', 2: 'Medium-Low', 3: 'Medium', 4: 'High', 5: 'Critical' };
  return labels[p] || 'Normal';
}

function checkDeadlines() {
  try {
    const data = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'wizz.json'), 'utf8'
    );
    const { users = [], tasks = [] } = JSON.parse(data);

    // Group tasks by user so we can query per-user
    const tasksByUser = {};
    tasks.forEach(t => {
      if (!tasksByUser[t.user_id]) tasksByUser[t.user_id] = [];
      tasksByUser[t.user_id].push(t);
    });

    users.forEach(user => {
      const userTasks = tasksByUser[user.id] || [];

      userTasks.forEach(task => {
        if (!task.deadline || task.status === 'done') return;

        const days = daysUntil(task.deadline.slice(0, 10));
        const priLabel = priorityLabel(task.priority);

        if (days < 0) {
          // ── Overdue ──────────────────────────────────────────────
          if (!db.notificationExists(user.id, task.id, 'overdue')) {
            db.createNotification({
              user_id:  user.id,
              type:     'overdue',
              title:    '🚨 Mission Overdue',
              message:  `"${task.title}" was due ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago. [${priLabel} Priority]`,
              task_id:  task.id,
            });
          }
        } else if (days === 0) {
          // ── Due today ─────────────────────────────────────────────
          if (!db.notificationExists(user.id, task.id, 'deadline_today')) {
            db.createNotification({
              user_id:  user.id,
              type:     'deadline_today',
              title:    '⚡ Mission Due Today',
              message:  `"${task.title}" is due today! [${priLabel} Priority]`,
              task_id:  task.id,
            });
          }
        } else if (days <= 3) {
          // ── Due soon (1–3 days) ───────────────────────────────────
          if (!db.notificationExists(user.id, task.id, 'deadline_soon')) {
            db.createNotification({
              user_id:  user.id,
              type:     'deadline_soon',
              title:    '📡 Upcoming Mission',
              message:  `"${task.title}" is due in ${days} day${days !== 1 ? 's' : ''}. [${priLabel} Priority]`,
              task_id:  task.id,
            });
          }
        }
      });
    });
  } catch (err) {
    console.error('[NotificationChecker] Error:', err.message);
  }
}

/**
 * Call this once from index.js to start the background checker.
 */
function startNotificationChecker() {
  console.log('[NotificationChecker] Started — checking every 60s');
  checkDeadlines(); // run immediately on startup
  setInterval(checkDeadlines, INTERVAL_MS);
}

module.exports = { startNotificationChecker };