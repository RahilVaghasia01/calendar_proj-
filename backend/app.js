/**
 * Express app factory (no listen) — used by index.js and automated tests.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');

require('./lib/db');

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const notificationRoutes = require('./routes/notifications');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.static('public'));

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.use('/api', authRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/notifications', notificationRoutes);

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = createApp;
