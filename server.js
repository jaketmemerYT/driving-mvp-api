// server.js
const { nanoid } = require('nanoid');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const FILE = path.join(__dirname, 'db.json');
function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return { vehicles: [], routes: [], trailheads: [], groups: [] };
  }
}
function saveDb(db) {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

// Seed defaults
const initialTrails = [
  { id: 't1', name: 'River Bend Loop', difficulty: 'easy' },
  { id: 't2', name: 'Coastal Drive',    difficulty: 'intermediate' },
  { id: 't3', name: 'Mountain Pass',    difficulty: 'advanced' },
];

let db = loadDb();
db.vehicles   ||= [];
db.routes     ||= [];
db.trailheads ||= initialTrails;
db.groups     ||= [];
saveDb(db);

// — Trailheads —
app.get('/api/trailheads', (_, res) => {
  const db = loadDb();
  res.json(db.trailheads);
});
app.post('/api/trailheads', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Trail name is required' });
  const db = loadDb();
  const newTrail = { id: nanoid(), name: name.trim(), difficulty: 'Unknown' };
  db.trailheads.push(newTrail);
  saveDb(db);
  res.status(201).json(newTrail);
});

// — Groups —
app.get('/api/groups', (_, res) => {
  const db = loadDb();
  res.json(db.groups);
});
app.post('/api/groups', (req, res) => {
  const { name, isPrivate } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Group name is required' });
  const db = loadDb();
  const newGroup = { id: nanoid(), name: name.trim(), isPrivate: !!isPrivate };
  db.groups.push(newGroup);
  saveDb(db);
  res.status(201).json(newGroup);
});
// (You can extend with join/remove membership endpoints later)

// — Vehicles —
app.get('/api/vehicles', (_, res) => res.json(loadDb().vehicles));
app.post('/api/vehicles', (req, res) => {
  const { make, model, year } = req.body;
  if (!make || !model || !year) return res.status(400).json({ error: 'make, model, year required' });
  const db = loadDb();
  const vehicle = { id: Date.now().toString(), make, model, year, timestamp: Date.now() };
  db.vehicles.push(vehicle);
  saveDb(db);
  res.status(201).json(vehicle);
});

// — Runs —
app.get('/api/routes', (_, res) => res.json(loadDb().routes));
app.post('/api/routes', (req, res) => {
  const { trailId, coords, duration, avgSpeed, vehicleId, groupId } = req.body;
  if (!trailId || !coords || !duration || !vehicleId)
    return res.status(400).json({ error: 'trailId, coords, duration, vehicleId required' });
  const db = loadDb();
  if (!db.vehicles.find(v => v.id === vehicleId))
    return res.status(400).json({ error: `No vehicle with id ${vehicleId}` });
  if (groupId && !db.groups.find(g => g.id === groupId))
    return res.status(400).json({ error: `No group with id ${groupId}` });
  const run = {
    id:        Date.now().toString(),
    trailId,
    coords,
    duration,
    avgSpeed:  avgSpeed || 0,
    vehicleId,
    groupId:   groupId || null,
    timestamp: Date.now(),
  };
  db.routes.push(run);
  saveDb(db);
  res.status(201).json(run);
});

// — Leaderboard —
app.get('/api/leaderboard/:trailId', (req, res) => {
  const db = loadDb();
  const top5 = db.routes
    .filter(r => r.trailId === req.params.trailId)
    .sort((a,b)=>a.duration-b.duration)
    .slice(0,5);
  res.json(top5);
});

// Export and/or listen
const PORT = 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
}
module.exports = app;
