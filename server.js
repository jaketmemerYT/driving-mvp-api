// server.js

const express   = require('express');
const cors      = require('cors');
const fs        = require('fs');
const path      = require('path');
const { nanoid } = require('nanoid');
const migrations = require('./migrations');

const FILE = path.join(__dirname, 'db.json');
const INITIAL_TRAILS = [
  { id: 't1', name: 'River Bend Loop', difficulty: 'easy' },
  { id: 't2', name: 'Coastal Drive',    difficulty: 'intermediate' },
  { id: 't3', name: 'Mountain Pass',    difficulty: 'advanced' },
];

const app = express();
app.use(cors());
app.use(express.json());

// Load, migrate, and save DB
function loadDb() {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    raw = {};
  }

  // Normalize top-level structure
  let db = {
    schemaVersion: raw.schemaVersion || '0.0.0',
    vehicles:      raw.vehicles   || [],
    routes:        raw.routes     || [],
    trailheads:    raw.trailheads || INITIAL_TRAILS,
    groups:        raw.groups     || [],
  };

  // Run migrations in sequence
  if (db.schemaVersion === '0.0.0') {
    db = migrations.migrate_0_0_0_to_1_0_0(db);
    db.schemaVersion = '1.0.0';
  }

  // (Add future migrations here:
  //  if (db.schemaVersion === '1.0.0') { … } )

  // Persist any changes
  saveDb(db);
  return db;
}

function saveDb(db) {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

// ——————————————————————————————————————————
// Trailheads
// ——————————————————————————————————————————
app.get('/api/trailheads', (req, res) => {
  console.log('GET /api/trailheads');
  const { trailheads } = loadDb();
  res.json(trailheads);
});

app.post('/api/trailheads', (req, res) => {
  console.log('POST /api/trailheads', req.body);
  const { name } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Trail name is required' });
  }
  const db = loadDb();
  const newTrail = { id: nanoid(), name: name.trim(), difficulty: 'Unknown' };
  db.trailheads.push(newTrail);
  saveDb(db);
  res.status(201).json(newTrail);
});

// ——————————————————————————————————————————
// Groups
// ——————————————————————————————————————————
app.get('/api/groups', (req, res) => {
  console.log('GET /api/groups');
  const { groups } = loadDb();
  res.json(groups);
});

app.post('/api/groups', (req, res) => {
  console.log('POST /api/groups', req.body);
  const { name, isPrivate } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Group name is required' });
  }
  const db = loadDb();
  const newGroup = { id: nanoid(), name: name.trim(), isPrivate: !!isPrivate };
  db.groups.push(newGroup);
  saveDb(db);
  res.status(201).json(newGroup);
});

// ——————————————————————————————————————————
// Vehicles
// ——————————————————————————————————————————
app.get('/api/vehicles', (req, res) => {
  console.log('GET /api/vehicles');
  res.json(loadDb().vehicles);
});

app.post('/api/vehicles', (req, res) => {
  console.log('POST /api/vehicles', req.body);
  const { make, model, year } = req.body;
  if (!make || !model || !year) {
    return res.status(400).json({ error: 'make, model, and year are required' });
  }
  const db = loadDb();
  const vehicle = {
    id:        Date.now().toString(),
    make,
    model,
    year,
    timestamp: Date.now(),
  };
  db.vehicles.push(vehicle);
  saveDb(db);
  res.status(201).json(vehicle);
});

// ——————————————————————————————————————————
// Routes / Runs
// ——————————————————————————————————————————
app.get('/api/routes', (req, res) => {
  console.log('GET /api/routes');
  res.json(loadDb().routes);
});

app.post('/api/routes', (req, res) => {
  console.log('POST /api/routes', req.body);
  const { trailId, coords, duration, avgSpeed, vehicleId, groupId } = req.body;
  if (!trailId || !coords || !duration || !vehicleId) {
    return res
      .status(400)
      .json({ error: 'trailId, coords, duration, and vehicleId are required' });
  }

  const db = loadDb();
  if (!db.vehicles.find(v => v.id === vehicleId)) {
    return res.status(400).json({ error: `No vehicle with id ${vehicleId}` });
  }
  if (groupId && !db.groups.find(g => g.id === groupId)) {
    return res.status(400).json({ error: `No group with id ${groupId}` });
  }

  const run = {
    id:         Date.now().toString(),
    trailId,
    coords,
    duration,
    avgSpeed:   avgSpeed || 0,
    vehicleId,
    groupId:    groupId || null,
    timestamp:  Date.now(),
  };
  db.routes.push(run);
  saveDb(db);
  res.status(201).json(run);
});

// ——————————————————————————————————————————
// Leaderboard
// ——————————————————————————————————————————
app.get('/api/leaderboard/:trailId', (req, res) => {
  console.log('GET /api/leaderboard/', req.params.trailId);
  const db = loadDb();
  const top5 = db.routes
    .filter(r => r.trailId === req.params.trailId)
    .sort((a, b) => a.duration - b.duration)
    .slice(0, 5);
  res.json(top5);
});

// ——————————————————————————————————————————
// Start server
// ——————————————————————————————————————————
const PORT = 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
}
module.exports = app;
