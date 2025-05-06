// server.js
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
    const content = fs.readFileSync(FILE, 'utf8');
    return JSON.parse(content);
  } catch {
    return { routes: [], vehicles: [] };
  }
}

// Save DB back to disk
function saveDb(db) {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

// — Hard-coded trailheads —
const trails = [
  { id: 't1', name: 'River Bend Loop', difficulty: 'easy' },
  { id: 't2', name: 'Coastal Drive', difficulty: 'intermediate' },
  { id: 't3', name: 'Mountain Pass', difficulty: 'advanced' },
];

// — API Endpoints —

app.get('/api/trailheads', (_, res) => res.json(trails));

// Vehicles
app.get('/api/vehicles', (_, res) => {
  const db = loadDb();
  res.json(db.vehicles);
});

app.post('/api/vehicles', (req, res) => {
  const { make, model, year } = req.body;
  if (!make || !model || !year) {
    return res.status(400).json({ error: 'make, model and year are required' });
  }

  const db = loadDb();
  // Ensure vehicles array exists
  if (!Array.isArray(db.vehicles)) {
    db.vehicles = [];
    saveDb(db);
  }  
  const vehicle = { id: Date.now().toString(), make, model, year };
  db.vehicles.push(vehicle);
  saveDb(db);
  res.status(201).json(vehicle);
});

// Routes / Runs
app.post('/api/routes', (req, res) => {
  const { trailId, coords, duration, avgSpeed, vehicleId } = req.body;
  if (!trailId || !coords || !duration || !vehicleId) {
    return res
      .status(400)
      .json({ error: 'trailId, coords, duration, and vehicleId are required' });
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

// Leaderboard
app.get('/api/leaderboard/:trailId', (req, res) => {
  const db = loadDb();
  const top5 = db.routes
    .filter(r => r.trailId === req.params.trailId)
    .sort((a, b) => a.duration - b.duration)
    .slice(0, 5);
  res.json(top5);
});

// Start Server
const PORT = 3000;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
