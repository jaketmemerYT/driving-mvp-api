// server.js
const express    = require('express');
const cors       = require('cors');
const fs         = require('fs');
const path       = require('path');
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

// Core: load, migrate, and save
function loadDb() {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    raw = {};
  }
  let db = {
    schemaVersion: raw.schemaVersion || '0.0.0',
    vehicles:      Array.isArray(raw.vehicles)      ? raw.vehicles      : [],
    routes:        Array.isArray(raw.routes)        ? raw.routes        : [],
    trailheads:    Array.isArray(raw.trailheads)    ? raw.trailheads    : INITIAL_TRAILS,
    groups:        Array.isArray(raw.groups)        ? raw.groups        : [],
    users:         Array.isArray(raw.users)         ? raw.users         : [],
    groupMembers:  Array.isArray(raw.groupMembers)  ? raw.groupMembers  : [],
    categories:    Array.isArray(raw.categories)    ? raw.categories    : [],
    trailCategories: Array.isArray(raw.trailCategories)
                     ? raw.trailCategories
                     : [],
  };

  // Run migrations in order
  if (db.schemaVersion === '0.0.0') {
    db = migrations.migrate_0_0_0_to_1_0_0(db);
    db.schemaVersion = '1.0.0';
  }
  if (db.schemaVersion === '1.0.0') {
    db = migrations.migrate_1_0_0_to_1_1_0(db);
    db.schemaVersion = '1.1.0';
  }
  if (db.schemaVersion === '1.1.0') {
    db = migrations.migrate_1_1_0_to_1_2_0(db);
    db.schemaVersion = '1.2.0';
  }

  // Ensure there's always at least one public group
  if (db.groups.length === 0) {
    db.groups.push({
      id:          'g_all',
      name:        'All Riders',
      isPrivate:   false,
      categoryIds: [],
    });
  }

  saveDb(db);
  return db;
}

function saveDb(db) {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

// — USERS —
app.get('/api/users', (_req, res) => {
  console.log('GET /api/users');
  res.json(loadDb().users);
});

app.post('/api/users', (req, res) => {
  console.log('POST /api/users', req.body);
  const { name, email } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'User name is required' });
  }
  const db = loadDb();
  const user = {
    id:        nanoid(),
    name:      name.trim(),
    email:     email?.trim() || null,
    timestamp: Date.now(),
  };
  db.users.push(user);
  saveDb(db);
  res.status(201).json(user);
});

// — CATEGORIES —
app.get('/api/categories', (_req, res) => {
  console.log('GET /api/categories');
  res.json(loadDb().categories);
});

app.post('/api/categories', (req, res) => {
  console.log('POST /api/categories', req.body);
  const { name } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Category name is required' });
  }
  const db = loadDb();
  const cat = { id: nanoid(), name: name.trim() };
  db.categories.push(cat);
  saveDb(db);
  res.status(201).json(cat);
});

// — TRAILHEADS & TRAIL↔CATEGORY JOIN —
app.get('/api/trailheads', (_req, res) => {
  console.log('GET /api/trailheads');
  res.json(loadDb().trailheads);
});

app.post('/api/trailheads', (req, res) => {
  console.log('POST /api/trailheads', req.body);
  const { name, difficulty } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Trail name is required' });
  }
  const db = loadDb();
  const t = {
    id:         nanoid(),
    name:       name.trim(),
    difficulty: difficulty?.trim() || 'Unknown',
  };
  db.trailheads.push(t);
  saveDb(db);
  res.status(201).json(t);
});

app.get('/api/trailheads/:trailId/categories', (req, res) => {
  console.log(`GET /api/trailheads/${req.params.trailId}/categories`);
  const { categories, trailCategories } = loadDb();
  const linked = trailCategories
    .filter(tc => tc.trailId === req.params.trailId)
    .map(tc => categories.find(c => c.id === tc.categoryId))
    .filter(Boolean);
  res.json(linked);
});

app.post('/api/trailheads/:trailId/categories', (req, res) => {
  console.log(`POST /api/trailheads/${req.params.trailId}/categories`, req.body);
  const { categoryId } = req.body;
  if (!categoryId) {
    return res.status(400).json({ error: 'categoryId is required' });
  }
  const db = loadDb();
  if (!db.trailheads.find(t => t.id === req.params.trailId)) {
    return res.status(404).json({ error: 'Trail not found' });
  }
  if (!db.categories.find(c => c.id === categoryId)) {
    return res.status(404).json({ error: 'Category not found' });
  }
  if (!db.trailCategories.find(tc =>
        tc.trailId === req.params.trailId && tc.categoryId === categoryId
      )) {
    db.trailCategories.push({ trailId: req.params.trailId, categoryId });
    saveDb(db);
  }
  res.status(204).end();
});

app.delete('/api/trailheads/:trailId/categories/:categoryId', (req, res) => {
  console.log(`DELETE /api/trailheads/${req.params.trailId}/categories/${req.params.categoryId}`);
  const db = loadDb();
  db.trailCategories = db.trailCategories.filter(
    tc => !(tc.trailId === req.params.trailId && tc.categoryId === req.params.categoryId)
  );
  saveDb(db);
  res.status(204).end();
});

// — GROUPS & MEMBERSHIP —
app.get('/api/groups', (_req, res) => {
  console.log('GET /api/groups');
  res.json(loadDb().groups);
});

app.post('/api/groups', (req, res) => {
  console.log('POST /api/groups', req.body);
  const { name, isPrivate, categoryIds } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Group name is required' });
  }
  const db = loadDb();
  const cats = Array.isArray(categoryIds) ? categoryIds : [];
  for (let cid of cats) {
    if (!db.categories.find(c => c.id === cid)) {
      return res.status(400).json({ error: `Invalid categoryId ${cid}` });
    }
  }
  const g = {
    id:          nanoid(),
    name:        name.trim(),
    isPrivate:   !!isPrivate,
    categoryIds: cats,
  };
  db.groups.push(g);
  saveDb(db);
  res.status(201).json(g);
});

app.get('/api/groups/:groupId/users', (req, res) => {
  console.log(`GET /api/groups/${req.params.groupId}/users`);
  const { users, groupMembers } = loadDb();
  const members = groupMembers
    .filter(gm => gm.groupId === req.params.groupId)
    .map(gm => users.find(u => u.id === gm.userId))
    .filter(Boolean);
  res.json(members);
});

app.post('/api/groups/:groupId/users', (req, res) => {
  console.log(`POST /api/groups/${req.params.groupId}/users`, req.body);
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  const db = loadDb();
  if (!db.groups.find(g => g.id === req.params.groupId)) {
    return res.status(404).json({ error: 'Group not found' });
  }
  if (!db.users.find(u => u.id === userId)) {
    return res.status(404).json({ error: 'User not found' });
  }
  if (!db.groupMembers.find(gm =>
        gm.groupId === req.params.groupId && gm.userId === userId
      )) {
    db.groupMembers.push({ groupId: req.params.groupId, userId });
    saveDb(db);
  }
  res.status(204).end();
});

app.delete('/api/groups/:groupId/users/:userId', (req, res) => {
  console.log(`DELETE /api/groups/${req.params.groupId}/users/${req.params.userId}`);
  const db = loadDb();
  db.groupMembers = db.groupMembers.filter(
    gm => !(gm.groupId === req.params.groupId && gm.userId === req.params.userId)
  );
  saveDb(db);
  res.status(204).end();
});

// — VEHICLES —
app.get('/api/vehicles', (_req, res) => {
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
  const v = {
    id:        Date.now().toString(),
    make, model, year,
    timestamp: Date.now(),
  };
  db.vehicles.push(v);
  saveDb(db);
  res.status(201).json(v);
});

// — ROUTES / RUNS —
app.get('/api/routes', (_req, res) => {
  console.log('GET /api/routes');
  res.json(loadDb().routes);
});

app.post('/api/routes', (req, res) => {
  console.log('POST /api/routes', req.body);
  const { trailId, coords, duration, avgSpeed, vehicleId, groupId, userId } = req.body;
  if (!trailId || !coords || !duration || !vehicleId || !userId) {
    return res
      .status(400)
      .json({ error: 'trailId, coords, duration, vehicleId, and userId are required' });
  }
  const db = loadDb();
  if (!db.vehicles.find(v => v.id === vehicleId)) {
    return res.status(400).json({ error: `No vehicle with id ${vehicleId}` });
  }
  if (groupId && !db.groups.find(g => g.id === groupId)) {
    return res.status(400).json({ error: `No group with id ${groupId}` });
  }
  if (!db.users.find(u => u.id === userId)) {
    return res.status(400).json({ error: `No user with id ${userId}` });
  }
  const run = {
    id:         Date.now().toString(),
    trailId, coords, duration,
    avgSpeed:   avgSpeed || 0,
    vehicleId, groupId: groupId || null,
    userId,     timestamp: Date.now(),
  };
  db.routes.push(run);
  saveDb(db);
  res.status(201).json(run);
});

// — LEADERBOARD —
app.get('/api/leaderboard/:trailId', (req, res) => {
  console.log('GET /api/leaderboard/', req.params.trailId);
  const top5 = loadDb().routes
    .filter(r => r.trailId === req.params.trailId)
    .sort((a, b) => a.duration - b.duration)
    .slice(0, 5);
  res.json(top5);
});

// — CATCH-ALL 404 —
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// — START SERVER —
const PORT = 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
}
module.exports = app;
