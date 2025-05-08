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

// Load DB (or initialize if missing/corrupt)
function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return { routes: [], vehicles: [], trailheads: [] };
  }
}

// Save DB back to disk
function saveDb(db) {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

// — Hard-coded initial trailheads — (optional; you can move these into db.json instead)
const initialTrails = [
  { id: 't1', name: 'River Bend Loop', difficulty: 'easy' },
  { id: 't2', name: 'Coastal Drive',    difficulty: 'intermediate' },
  { id: 't3', name: 'Mountain Pass',    difficulty: 'advanced' },
];

// Ensure db.json has those if empty
const dbInit = loadDb();
if (!Array.isArray(dbInit.trailheads) || dbInit.trailheads.length === 0) {
  dbInit.trailheads = initialTrails;
  saveDb(dbInit);
}

// — API Endpoints —

// 1) List all trailheads
app.get('/api/trailheads', (req, res) => {
  const db = loadDb();
  res.json(db.trailheads);
});

// 2) Create a new trailhead
app.post('/api/trailheads', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Trail name is required' });
  }
  const db = loadDb();
  const newTrail = {
    id: nanoid(),
    name: name.trim(),
    difficulty: 'Unknown',
  };
  db.trailheads.push(newTrail);
  saveDb(db);
  res.status(201).json(newTrail);
});

// 3) List all vehicles
app.get('/api/vehicles', (req, res) => {
  const db = loadDb();
  res.json(db.vehicles);
});

// 4) Create a vehicle
app.post('/api/vehicles', (req, res) => {
  const { make, model, year } = req.body;
  if (!make || !model || !year) {
    return res.status(400).json({ error: 'make, model, and year are required' });
  }
  const db = loadDb();
  const vehicle = { id: Date.now().toString(), make, model, year };
  db.vehicles.push(vehicle);
  saveDb(db);
  res.status(201).json(vehicle);
});

// 5) List all runs (needed for your new RunList screen)
app.get('/api/routes', (req, res) => {
  const db = loadDb();
  res.json(db.routes);
});

// 6) Create a run
app.post('/api/routes', (req, res) => {
  const { trailId, coords, duration, avgSpeed, vehicleId } = req.body;
  if (!trailId || !coords || !duration || !vehicleId) {
    return res.status(400).json({ error: 'trailId, coords, duration, and vehicleId are required' });
  }
  const db = loadDb();
  if (!db.vehicles.find(v => v.id === vehicleId)) {
    return res.status(400).json({ error: `No vehicle with id ${vehicleId}` });
  }
  const run = {
    id: Date.now().toString(),
    trailId,
    coords,
    duration,
    avgSpeed: avgSpeed || 0,
    vehicleId,
    timestamp: Date.now(),
  };
  db.routes.push(run);
  saveDb(db);
  res.status(201).json(run);
});

// 7) Leaderboard for a trail
app.get('/api/leaderboard/:trailId', (req, res) => {
  const db = loadDb();
  const top5 = db.routes
    .filter(r => r.trailId === req.params.trailId)
    .sort((a, b) => a.duration - b.duration)
    .slice(0, 5);
  res.json(top5);
});

// Start server
const PORT = 3000;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
