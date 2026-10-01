require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const initDB = require('./db/init');
const { startJobs } = require('./jobs/cron');

const app = express();

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/visitors'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api', require('./routes/dashboard'));

// Serve React build in production
app.use(express.static(path.join(__dirname, '../../frontend/build')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../../frontend/build/index.html'));
  }
});

const PORT = process.env.PORT || 5000;

async function start() {
  await initDB();
  startJobs();
  app.listen(PORT, '0.0.0.0', () => console.log(`VMS running on port ${PORT}`));
}

start().catch(console.error);
