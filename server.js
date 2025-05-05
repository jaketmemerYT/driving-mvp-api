// server.js
const express = require('express');
const cors = require('cors');
// lowdb v4 adapter lives under 'lowdb/node'
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// point at a JSON file in this folder
const file = path.join(__dirname, 'db.json');
const adapter = new JSONFile(file);
// ← supply your default structure here to avoid the "missing default data" error :contentReference[oaicite:0]{index=0}
const db = new Low(adapter, { routes: [] });

(async () => {
  // read from file, or start with default { routes: [] }
  await db.read();

  // Hard-coded trailheads
  const trails = [
    { id: 't1', name: 'River Bend Loop', difficulty: 'easy' },
    { id: 't2', name: 'Coastal Drive', difficulty: 'intermediate' },
    { id: 't3', name: 'Mountain Pass', difficulty: 'advanced' },
  ];

  // GET /api/trailheads
  app.get('/api/trailheads', (_, res) => {
    res.json(trails);
  });

  // POST /api/routes
  app.post('/api/routes', async (req, res) => {
    const run = { ...req.body, timestamp: Date.now() };
    db.data.routes.push(run);
    await db.write();
    res.status(201).json(run);
  });

  // GET /api/leaderboard/:trailId
  app.get('/api/leaderboard/:trailId', (req, res) => {
    const top5 = db.data.routes
      .filter(r => r.trailId === req.params.trailId)
      .sort((a, b) => a.duration - b.duration)
      .slice(0, 5);
    res.json(top5);
  });

  // start the server
  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
})();
