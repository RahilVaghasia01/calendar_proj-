const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../lib/db');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/register
 * Body: { username, password }
 * Creates a new user and returns a token.
 */
router.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ error: 'Username must be a non-empty string' });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  try {
    const result = db.createUser(username.trim(), password_hash);
    const userId = result.lastInsertRowid;
    const token = jwt.sign({ userId }, JWT_SECRET);
    res.status(201).json({ token, user: { id: userId, username: username.trim() } });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Username already taken' });
    }
    throw e;
  }
});

/**
 * POST /api/login
 * Body: { username, password }
 * Returns a token if credentials are valid.
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = db.getUserByUsername(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET);
  res.json({ token, user: { id: user.id, username: user.username } });
});

/**
 * GET /api/me
 * Returns the current user when a valid token is sent.
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username });
});

module.exports = router;
