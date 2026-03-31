const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../lib/db');

const router = express.Router();

// All notification routes require login
router.use(requireAuth);

/**
 * GET /api/notifications
 * Returns all notifications for the current user, newest first.
 * Query param: ?unread=true  →  only unread
 */
router.get('/', (req, res) => {
  try {
    let notifications = db.getNotificationsByUserId(req.user.id);
    if (req.query.unread === 'true') {
      notifications = notifications.filter(n => !n.read);
    }
    const unreadCount = db.getUnreadCount(req.user.id);
    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to fetch notifications' });
  }
});

/**
 * GET /api/notifications/count
 * Lightweight endpoint — just returns the unread badge count.
 * Polled frequently by the frontend.
 */
router.get('/count', (req, res) => {
  try {
    const unreadCount = db.getUnreadCount(req.user.id);
    res.json({ unreadCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get count' });
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
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

/**
 * PATCH /api/notifications/read-all
 * Mark ALL notifications for the current user as read.
 */
router.patch('/read-all', (req, res) => {
  try {
    const count = db.markAllNotificationsRead(req.user.id);
    res.json({ marked: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a single notification.
 */
router.delete('/:id', (req, res) => {
  try {
    const result = db.deleteNotification(Number(req.params.id), req.user.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Notification not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

/**
 * DELETE /api/notifications
 * Clear ALL notifications for the current user.
 */
router.delete('/', (req, res) => {
  try {
    const count = db.clearNotifications(req.user.id);
    res.json({ deleted: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

module.exports = router;