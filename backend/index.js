require('dotenv').config();
const express = require('express');
const cors = require('cors');

require('./lib/db'); // create DB and tables on startup

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(express.static('public'));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api', authRoutes);
app.use('/api/tasks', taskRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`WIZZ API running at http://localhost:${PORT}`);
});
