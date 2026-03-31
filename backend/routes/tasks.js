const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../lib/db');

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/tasks/schedule
 * Auto-schedule: tasks sorted by priority (high first), then deadline, then duration.
 */
router.get('/schedule', (req, res) => {
  try {
    const startHour = 8;
    const tasks = db.getTasksForSchedule(req.user.id);
    const now = new Date();
    let current = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, 0, 0);

    const scheduled = tasks.map(task => {
      const duration = task.duration_minutes || 30;
      const start = current.toISOString().slice(0, 16);
      current.setMinutes(current.getMinutes() + duration);
      const end = current.toISOString().slice(0, 16);
      return { ...task, suggested_start: start, suggested_end: end };
    });

    res.json(scheduled);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to build schedule' });
  }
});

/**
 * GET /api/tasks/search?q=keyword
 * Search tasks by title or description (case-insensitive).
 * Returns tasks belonging to the logged-in user only.
 */
router.get('/search', (req, res) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    if (!q) return res.json([]);

    const tasks = db.getTasksByUserId(req.user.id);
    const results = tasks.filter(t => {
      const inTitle = t.title && t.title.toLowerCase().includes(q);
      const inDesc  = t.description && t.description.toLowerCase().includes(q);
      return inTitle || inDesc;
    });

    // Sort: most recently created first
    results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Search failed' });
  }
});

/**
 * GET /api/tasks
 */
router.get('/', (req, res) => {
  try {
    const tasks = db.getTasksByUserId(req.user.id);
    tasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to fetch tasks' });
  }
});

/**
 * GET /api/tasks/:id
 */
router.get('/:id', (req, res) => {
  try {
    const task = db.getTaskByIdAndUserId(Number(req.params.id), req.user.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to fetch task' });
  }
});

/**
 * POST /api/tasks
 */
router.post('/', (req, res) => {
  try {
    const { title, description, status, duration_minutes, priority, deadline } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }

    const task = db.createTask({
      user_id: req.user.id,
      title: title.trim(),
      description: (description && typeof description === 'string') ? description.trim() : null,
      status: status ?? 'todo',
      duration_minutes: duration_minutes ?? null,
      priority: priority ?? null,
      deadline: deadline ?? null,
    });
    res.status(201).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to create task' });
  }
});

/**
 * PATCH /api/tasks/:id/toggle
 * Toggle status between 'todo' and 'done'.
 * Shortcut so the frontend doesn't need to know the current status.
 */
router.patch('/:id/toggle', (req, res) => {
  try {
    const id   = Number(req.params.id);
    const task = db.getTaskByIdAndUserId(id, req.user.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const newStatus = task.status === 'done' ? 'todo' : 'done';
    const updated   = db.updateTask(id, req.user.id, { status: newStatus });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to toggle status' });
  }
});

/**
 * PATCH /api/tasks/:id
 */
router.patch('/:id', (req, res) => {
  try {
    const { title, description, status, duration_minutes, priority, deadline } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = typeof title === 'string' ? title.trim() : title;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes;
    if (priority !== undefined) updates.priority = priority;
    if (deadline !== undefined) updates.deadline = deadline;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const id = Number(req.params.id);
    const task = db.updateTask(id, req.user.id, updates);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to update task' });
  }
});

/**
 * DELETE /api/tasks/:id
 *
 * The JSON store does not return a SQLite-style { changes: N } object.
 * So we check if the task exists BEFORE deleting, then delete it.
 * If it was not found (or belongs to another user) we return 404.
 */
router.delete('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);

    // First check the task exists and belongs to this user
    const existing = db.getTaskByIdAndUserId(id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    // Now delete it — works with both JSON store and SQLite
    db.deleteTask(id, req.user.id);

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to delete task' });
  }
});

module.exports = router;