const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../lib/db');

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/notifications
 * Returns all notifications for the current user, newest first.
 */
router.get('/', (req, res) => {
  try {
    const notifications = db.getNotificationsByUserId(req.user.id);
    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to fetch notifications' });
  }
});

/**
 * GET /api/notifications/unread-count
 * Returns { count } for the current user.
 */
router.get('/unread-count', (req, res) => {
  try {
    const count = db.getUnreadNotificationCount(req.user.id);
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to fetch unread count' });
  }
});

/**
 * GET /api/notifications/summary
 * Returns { total, unread } for the current user (TDD / customer-demo feature).
 */
router.get('/summary', (req, res) => {
  try {
    const summary = db.getNotificationSummary(req.user.id);
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to fetch notification summary' });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
router.patch('/:id/read', (req, res) => {
  try {
    const notification = db.markNotificationRead(Number(req.params.id), req.user.id);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json(notification);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to mark notification as read' });
  }
});

/**
 * PATCH /api/notifications/read-all
 * Mark all current user's notifications as read.
 */
router.patch('/read-all', (req, res) => {
  try {
    const updated = db.markAllNotificationsRead(req.user.id);
    res.json({ updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to mark all notifications as read' });
  }
});

module.exports = router;
