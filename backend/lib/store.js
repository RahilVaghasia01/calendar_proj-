const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'wizz.json');

function load() {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    if (e.code === 'ENOENT') return { users: [], tasks: [] };
    throw e;
  }
}

function save(data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
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
};

module.exports = db;
