const fs = require('fs');
const path = require('path');

/** Set WIZZ_JSON_PATH in tests so Jest uses an isolated file (see test/). */
function getFilePath() {
  return process.env.WIZZ_JSON_PATH || path.join(__dirname, '..', 'wizz.json');
}

function load() {
  try {
    const data = fs.readFileSync(getFilePath(), 'utf8');
    const parsed = JSON.parse(data);
    if (!parsed.users) parsed.users = [];
    if (!parsed.tasks) parsed.tasks = [];
    if (!parsed.notifications) parsed.notifications = [];
    return parsed;
  } catch (e) {
    if (e.code === 'ENOENT') return { users: [], tasks: [], notifications: [] };
    throw e;
  }
}

function save(data) {
  fs.writeFileSync(getFilePath(), JSON.stringify(data, null, 2), 'utf8');
}

function nextId(arr) {
  return arr.length === 0 ? 1 : Math.max(...arr.map(x => x.id)) + 1;
}

function now() {
  return new Date().toISOString();
}

const db = {
  get user() {
    return load().users;
  },
  get task() {
    return load().tasks;
  },
  get notification() {
    return load().notifications;
  },

  getUserByUsername(username) {
    return load().users.find(u => u.username === username) || null;
  },

  getUserById(id) {
    return load().users.find(u => u.id === id) || null;
  },

  createUser(username, password_hash) {
    const data = load();
    const existing = data.users.find(u => u.username === username);
    if (existing) {
      const e = new Error('Username already taken');
      e.code = 'SQLITE_CONSTRAINT_UNIQUE';
      throw e;
    }
    const id = nextId(data.users);
    data.users.push({ id, username, password_hash });
    save(data);
    return { lastInsertRowid: id };
  },

  getTasksByUserId(userId) {
    return load().tasks.filter(t => t.user_id === userId);
  },

  getTaskByIdAndUserId(id, userId) {
    const task = load().tasks.find(t => t.id === id && t.user_id === userId);
    return task || null;
  },

  getTasksForSchedule(userId) {
    const tasks = load().tasks.filter(t => t.user_id === userId);
    tasks.sort((a, b) => {
      const pa = a.priority ?? 0, pb = b.priority ?? 0;
      if (pb !== pa) return pb - pa;
      const da = a.deadline || '', db = b.deadline || '';
      if (da !== db) return da.localeCompare(db);
      return (b.duration_minutes ?? 0) - (a.duration_minutes ?? 0);
    });
    return tasks;
  },

  createTask(row) {
    const data = load();
    const id = nextId(data.tasks);
    const task = {
      id,
      user_id: row.user_id,
      title: row.title,
      description: row.description ?? null,
      status: row.status ?? 'todo',
      duration_minutes: row.duration_minutes ?? null,
      priority: row.priority ?? null,
      deadline: row.deadline ?? null,
      created_at: now(),
      updated_at: now(),
    };
    data.tasks.push(task);
    save(data);
    return task;
  },

  updateTask(id, userId, updates) {
    const data = load();
    const idx = data.tasks.findIndex(t => t.id === id && t.user_id === userId);
    if (idx === -1) return null;
    data.tasks[idx] = { ...data.tasks[idx], ...updates, updated_at: now() };
    save(data);
    return data.tasks[idx];
  },

  deleteTask(id, userId) {
    const data = load();
    const idx = data.tasks.findIndex(t => t.id === id && t.user_id === userId);
    if (idx === -1) return { changes: 0 };
    data.tasks.splice(idx, 1);
    save(data);
    return { changes: 1 };
  },

  createNotification(row) {
    const data = load();
    const id = nextId(data.notifications);
    const notification = {
      id,
      user_id: row.user_id,
      type: row.type || 'general',
      title: row.title || 'Notification',
      message: row.message || '',
      task_id: row.task_id ?? null,
      is_read: false,
      created_at: now(),
    };
    data.notifications.push(notification);
    save(data);
    return notification;
  },

  getNotificationsByUserId(userId) {
    const notifications = load().notifications.filter(n => n.user_id === userId);
    notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return notifications;
  },

  getNotificationByIdAndUserId(id, userId) {
    return load().notifications.find(n => n.id === id && n.user_id === userId) || null;
  },

  markNotificationRead(id, userId) {
    const data = load();
    const idx = data.notifications.findIndex(n => n.id === id && n.user_id === userId);
    if (idx === -1) return null;
    data.notifications[idx].is_read = true;
    save(data);
    return data.notifications[idx];
  },

  markAllNotificationsRead(userId) {
    const data = load();
    let count = 0;
    data.notifications.forEach((n, idx) => {
      if (n.user_id === userId && !n.is_read) {
        data.notifications[idx].is_read = true;
        count += 1;
      }
    });
    if (count > 0) save(data);
    return count;
  },

  getUnreadNotificationCount(userId) {
    return load().notifications.filter(n => n.user_id === userId && !n.is_read).length;
  },

  /** Notification bell / dashboard — TDD feature (GET /api/notifications/summary). */
  getNotificationSummary(userId) {
    const list = load().notifications.filter(n => n.user_id === userId);
    return {
      total: list.length,
      unread: list.filter(n => !n.is_read).length,
    };
  },
};

module.exports = db;
