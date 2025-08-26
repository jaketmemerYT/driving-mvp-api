const express    = require('express');
const cors       = require('cors');
const fs         = require('fs');
const path       = require('path');
const { nanoid } = require('nanoid');
const haversine  = require('haversine-distance');
const migrations = require('./migrations');
const multer     = require('multer');

const FILE = path.join(__dirname, 'db.json');

// ---- uploads (public) ----
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const VEHICLE_UPLOAD_DIR = path.join(UPLOAD_DIR, 'vehicles');
ensureDir(UPLOAD_DIR);
ensureDir(VEHICLE_UPLOAD_DIR);

// Static file hosting for uploads
// e.g. http://<host>:3000/uploads/vehicles/<file>.jpg
function ensureDir(p) {
  try { fs.mkdirSync(p, { recursive: true }); } catch {}
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, VEHICLE_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const vid = req.params.vid || 'veh';
    const ext = path.extname((file.originalname || '').toLowerCase()) || '.jpg';
    cb(null, `${vid}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// Seed trails if none exist
const INITIAL_TRAILS = [
  {
    id: 't1',
    name: 'River Bend Loop',
    difficulty: 'easy',
    coords: { latitude: 45.4113446, longitude: -122.8243322 },
    endCoords: null,
    route: []
  },
  {
    id: 't2',
    name: 'Coastal Drive',
    difficulty: 'intermediate',
    coords: { latitude: 36.62, longitude: -121.9 },
    endCoords: null,
    route: []
  },
  {
    id: 't3',
    name: 'Mountain Pass',
    difficulty: 'advanced',
    coords: { latitude: 39.7392, longitude: -119.9373 },
    endCoords: null,
    route: []
  }
];

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR)); // serve uploaded files

// Load and migrate the DB
function loadDb() {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    raw = {};
  }

  let db = {
    schemaVersion:    raw.schemaVersion    || '0.0.0',
    users:            Array.isArray(raw.users)           ? raw.users           : [],
    vehicles:         Array.isArray(raw.vehicles)        ? raw.vehicles        : [],
    groups:           Array.isArray(raw.groups)          ? raw.groups          : [],
    groupMembers:     Array.isArray(raw.groupMembers)    ? raw.groupMembers    : [],
    categories:       Array.isArray(raw.categories)      ? raw.categories      : [],
    trailCategories:  Array.isArray(raw.trailCategories) ? raw.trailCategories : [],
    groupTrails:      Array.isArray(raw.groupTrails)     ? raw.groupTrails     : [],
    routes:           Array.isArray(raw.routes)          ? raw.routes          : [],
    trailheads:       Array.isArray(raw.trailheads)      ? raw.trailheads      : INITIAL_TRAILS
  };

  // Ensure every user has a preferences object
  db.users = db.users.map(u => ({
    ...u,
    preferences: u.preferences || {}
  }));

  // Ensure vehicle photos fields exist
  db.vehicles = db.vehicles.map(v => ({
    ...v,
    photoUrl: v.photoUrl || null,   // public URL
    photoPath: v.photoPath || null, // absolute disk path for cleanup
  }));

  // Patch trails missing fields
  db.trailheads = db.trailheads.map(th => {
    const def = INITIAL_TRAILS.find(d => d.id === th.id) || {};
    return {
      id:         th.id,
      name:       th.name || def.name || '',
      difficulty: th.difficulty || def.difficulty || 'Unknown',
      coords:     (th.coords && th.coords.latitude != null)
                    ? th.coords
                    : def.coords || { latitude: 0, longitude: 0 },
      endCoords:  'endCoords' in th
                    ? th.endCoords
                    : def.endCoords || null,
      route:      Array.isArray(th.route)
                    ? th.route
                    : def.route || []
    };
  });

  // Migrations
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
  if (db.schemaVersion === '1.2.0') {
    db = migrations.migrate_1_2_0_to_1_3_0(db);
    db.schemaVersion = '1.3.0';
  }

  // Ensure default public group
  if (!db.groups.find(g => g.id === 'g_all')) {
    db.groups.unshift({
      id: 'g_all',
      name: 'All Riders',
      isPrivate: false,
      categoryIds: []
    });
  }

  saveDb(db);
  return db;
}

// Save the DB
function saveDb(db) {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

// Helper: delete file quietly
function tryUnlink(p) {
  try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch {}
}

// Helper: absolute public URL for an uploaded path
function publicUrl(req, relPath) {
  return `${req.protocol}://${req.get('host')}${relPath.startsWith('/') ? '' : '/'}${relPath}`;
}

// ――― USERS ―――

// List users
app.get('/api/users', (_req, res) => {
  res.json(loadDb().users);
});

// Get one user
app.get('/api/users/:uid', (req, res) => {
  const db = loadDb();
  const u = db.users.find(x => x.id === req.params.uid);
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json(u);
});

// Create user
app.post('/api/users', (req, res) => {
  const { name, email } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Name required' });
  }
  const db = loadDb();
  const u = {
    id: nanoid(),
    name: name.trim(),
    email: email?.trim() || null,
    timestamp: Date.now(),
    preferences: {}
  };
  db.users.push(u);
  saveDb(db);
  res.status(201).json(u);
});

// Update user (name/email/preferences)
app.put('/api/users/:uid', (req, res) => {
  const { name, email, preferences } = req.body || {};
  const db = loadDb();
  const u = db.users.find(x => x.id === req.params.uid);
  if (!u) return res.status(404).json({ error: 'User not found' });

  if (name !== undefined) u.name = String(name || '').trim();
  if (email !== undefined) u.email = email ? String(email).trim() : null;
  if (preferences && typeof preferences === 'object') u.preferences = preferences;

  saveDb(db);
  res.json(u);
});

// Update user preferences (legacy route still supported)
app.patch('/api/users/:uid/preferences', (req, res) => {
  const { preferences } = req.body;
  if (typeof preferences !== 'object') {
    return res.status(400).json({ error: 'preferences object required' });
  }
  const db = loadDb();
  const user = db.users.find(u => u.id === req.params.uid);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  user.preferences = preferences;
  saveDb(db);
  res.json(user);
});

// Delete user (admin-style; cascade vehicles, routes, memberships)
app.delete('/api/users/:uid', (req, res) => {
  const db = loadDb();
  const u = db.users.find(x => x.id === req.params.uid);
  if (!u) return res.status(404).json({ error: 'User not found' });

  // delete user's vehicles (and photos)
  const userVehicles = db.vehicles.filter(v => v.userId === u.id);
  userVehicles.forEach(v => tryUnlink(v.photoPath));
  db.vehicles = db.vehicles.filter(v => v.userId !== u.id);

  // delete user's routes
  db.routes = db.routes.filter(r => r.userId !== u.id);

  // remove group memberships
  db.groupMembers = db.groupMembers.filter(gm => gm.userId !== u.id);

  // remove user
  db.users = db.users.filter(x => x.id !== u.id);

  saveDb(db);
  res.status(204).end();
});

// ――― CATEGORIES ―――

app.get('/api/categories', (_req, res) => {
  res.json(loadDb().categories);
});

app.post('/api/categories', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Name required' });
  }
  const db = loadDb();
  const c = { id: nanoid(), name: name.trim() };
  db.categories.push(c);
  saveDb(db);
  res.status(201).json(c);
});

// ――― TRAILHEADS ―――

app.get('/api/trailheads', (_req, res) => {
  res.json(loadDb().trailheads);
});

app.get('/api/trailheads/:tid', (req, res) => {
  const t = loadDb().trailheads.find(x => x.id === req.params.tid);
  if (!t) return res.status(404).json({ error: 'Trail not found' });
  res.json(t);
});

app.post('/api/trailheads', (req, res) => {
  const {
    name,
    difficulty,
    coords,
    endCoords,
    route,
    categoryIds,
    groupIds
  } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Name required' });
  }
  if (!coords || coords.latitude == null || coords.longitude == null) {
    return res.status(400).json({ error: 'start coords required' });
  }
  if (!Array.isArray(route) || !route.length) {
    return res.status(400).json({ error: 'route array required' });
  }

  const db = loadDb();
  const th = {
    id:          nanoid(),
    name:        name.trim(),
    difficulty:  difficulty?.trim() || 'Unknown',
    coords:      { latitude: coords.latitude, longitude: coords.longitude },
    endCoords:   endCoords && ({
                   latitude: endCoords.latitude,
                   longitude: endCoords.longitude
                 }),
    route:       route.map(pt => ({
                   latitude: pt.latitude,
                   longitude: pt.longitude,
                   speed: pt.speed || 0,
                   heading: pt.heading || 0,
                   altitude: pt.altitude || 0,
                   accuracy: pt.accuracy || 0,
                   timestamp: pt.timestamp || Date.now()
                 }))
  };
  db.trailheads.push(th);

  (categoryIds || []).forEach(cid => {
    if (db.categories.find(c => c.id === cid) &&
        !db.trailCategories.find(tc => tc.trailId === th.id && tc.categoryId === cid)) {
      db.trailCategories.push({ trailId: th.id, categoryId: cid });
    }
  });

  (groupIds || []).forEach(gid => {
    if (db.groups.find(g => g.id === gid) &&
        !db.groupTrails.find(gt => gt.trailId === th.id && gt.groupId === gid)) {
      db.groupTrails.push({ trailId: th.id, groupId: gid });
    }
  });

  saveDb(db);
  res.status(201).json(th);
});

// ――― TRAIL ↔ CATEGORY ―――

app.get('/api/trailheads/:tid/categories', (req, res) => {
  const { categories, trailCategories } = loadDb();
  const linked = trailCategories
    .filter(tc => tc.trailId === req.params.tid)
    .map(tc => categories.find(c => c.id === tc.categoryId))
    .filter(Boolean);
  res.json(linked);
});

app.post('/api/trailheads/:tid/categories', (req, res) => {
  const { categoryId } = req.body;
  const db = loadDb();
  if (!db.trailheads.find(t => t.id === req.params.tid)) {
    return res.status(404).json({ error: 'Trail not found' });
  }
  if (!db.categories.find(c => c.id === categoryId)) {
    return res.status(404).json({ error: 'Category not found' });
  }
  if (!db.trailCategories.find(tc =>
        tc.trailId === req.params.tid && tc.categoryId === categoryId)) {
    db.trailCategories.push({ trailId: req.params.tid, categoryId });
    saveDb(db);
  }
  res.status(204).end();
});

app.delete('/api/trailheads/:tid/categories/:cid', (req, res) => {
  const db = loadDb();
  db.trailCategories = db.trailCategories.filter(tc =>
    !(tc.trailId === req.params.tid && tc.categoryId === req.params.cid)
  );
  saveDb(db);
  res.status(204).end();
});

// ――― TRAIL ↔ GROUP ―――

app.get('/api/trailheads/:tid/groups', (req, res) => {
  const { groups, groupTrails } = loadDb();
  const linked = groupTrails
    .filter(gt => gt.trailId === req.params.tid)
    .map(gt => groups.find(g => g.id === gt.groupId))
    .filter(Boolean);
  res.json(linked);
});

app.post('/api/trailheads/:tid/groups', (req, res) => {
  const { groupId } = req.body;
  const db = loadDb();
  if (!db.trailheads.find(t => t.id === req.params.tid)) {
    return res.status(404).json({ error: 'Trail not found' });
  }
  if (!db.groups.find(g => g.id === groupId)) {
    return res.status(404).json({ error: 'Group not found' });
  }
  if (!db.groupTrails.find(gt =>
        gt.trailId === req.params.tid && gt.groupId === groupId)) {
    db.groupTrails.push({ trailId: req.params.tid, groupId });
    saveDb(db);
  }
  res.status(204).end();
});

app.delete('/api/trailheads/:tid/groups/:gid', (req, res) => {
  const db = loadDb();
  db.groupTrails = db.groupTrails.filter(gt =>
    !(gt.trailId === req.params.tid && gt.groupId === req.params.gid)
  );
  saveDb(db);
  res.status(204).end();
});

// ――― GROUPS & MEMBERSHIP ―――

app.get('/api/groups', (_req, res) => {
  res.json(loadDb().groups);
});

app.post('/api/groups', (req, res) => {
  const { name, isPrivate, categoryIds } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Name required' });
  }
  const db = loadDb();
  const cats = Array.isArray(categoryIds) ? categoryIds : [];
  for (let cid of cats) {
    if (!db.categories.find(c => c.id === cid)) {
      return res.status(400).json({ error: `Invalid categoryId ${cid}` });
    }
  }
  const g = {
    id: nanoid(),
    name: name.trim(),
    isPrivate: !!isPrivate,
    categoryIds: cats
  };
  db.groups.push(g);
  saveDb(db);
  res.status(201).json(g);
});

app.get('/api/groups/:gid/users', (req, res) => {
  const { users, groupMembers } = loadDb();
  const memb = groupMembers
    .filter(gm => gm.groupId === req.params.gid)
    .map(gm => users.find(u => u.id === gm.userId))
    .filter(Boolean);
  res.json(memb);
});

app.post('/api/groups/:gid/users', (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }
  const db = loadDb();
  if (!db.groups.find(g => g.id === req.params.gid)) {
    return res.status(404).json({ error: 'Group not found' });
  }
  if (!db.users.find(u => u.id === userId)) {
    return res.status(404).json({ error: 'User not found' });
  }
  if (!db.groupMembers.find(gm =>
        gm.groupId === req.params.gid && gm.userId === userId)) {
    db.groupMembers.push({ groupId: req.params.gid, userId });
    saveDb(db);
  }
  res.status(204).end();
});

app.delete('/api/groups/:gid/users/:uid', (req, res) => {
  const db = loadDb();
  db.groupMembers = db.groupMembers.filter(gm =>
    !(gm.groupId === req.params.gid && gm.userId === req.params.uid)
  );
  saveDb(db);
  res.status(204).end();
});

// ――― VEHICLES ―――

app.get('/api/vehicles', (req, res) => {
  let vs = loadDb().vehicles;
  if (req.query.userId) {
    vs = vs.filter(v => v.userId === req.query.userId);
  }
  res.json(vs);
});

app.post('/api/vehicles', (req, res) => {
  const { make, model, year, userId } = req.body;
  if (!make || !model || !year || !userId) {
    return res.status(400).json({ error: 'make, model, year & userId required' });
  }
  const db = loadDb();
  if (!db.users.find(u => u.id === userId)) {
    return res.status(400).json({ error: `No user ${userId}` });
  }
  const v = {
    id: Date.now().toString(),
    make, model, year,
    userId,
    timestamp: Date.now(),
    photoUrl: null,
    photoPath: null,
  };
  db.vehicles.push(v);
  saveDb(db);
  res.status(201).json(v);
});

app.delete('/api/vehicles/:vid', (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ error: 'userId query required' });
  }
  const db = loadDb();
  const v = db.vehicles.find(x => x.id === req.params.vid);
  if (!v) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }
  if (v.userId !== userId) {
    return res.status(403).json({ error: 'Not your vehicle' });
  }
  // delete photo if exists
  tryUnlink(v.photoPath);

  db.vehicles = db.vehicles.filter(x => x.id !== req.params.vid);
  saveDb(db);
  res.status(204).end();
});

// Vehicle photo upload (multipart/form-data; field name: "file")
app.post('/api/vehicles/:vid/photo', upload.single('file'), (req, res) => {
  const db = loadDb();
  const v = db.vehicles.find(x => x.id === req.params.vid);
  if (!v) return res.status(404).json({ error: 'Vehicle not found' });

  if (!req.file || !req.file.path) {
    return res.status(400).json({ error: 'file is required' });
  }

  // Remove previous photo if any
  tryUnlink(v.photoPath);

  // Build public URL. We want a stable web path /uploads/vehicles/<filename>
  const relWebPath = `/uploads/vehicles/${path.basename(req.file.path)}`;

  v.photoUrl  = publicUrl(req, relWebPath);
  v.photoPath = req.file.path;

  saveDb(db);
  res.json(v);
});

// ――― RUNS / ROUTES ―――

app.get('/api/routes', (_req, res) => {
  res.json(loadDb().routes);
});

app.post('/api/routes', (req, res) => {
  const {
    trailId,
    coords,
    duration,
    avgSpeed,
    vehicleId,
    groupId,
    userId
  } = req.body;

  if (!trailId || !Array.isArray(coords) || !coords.length ||
      duration == null || !vehicleId || !userId) {
    return res.status(400).json({
      error: 'trailId, coords (non-empty), duration, vehicleId & userId required'
    });
  }

  const db = loadDb();
  if (!db.trailheads.find(t => t.id === trailId)) {
    return res.status(404).json({ error: 'Unknown trailId' });
  }
  if (!db.vehicles.find(v => v.id === vehicleId)) {
    return res.status(404).json({ error: 'Unknown vehicleId' });
  }
  if (!db.users.find(u => u.id === userId)) {
    return res.status(404).json({ error: 'Unknown userId' });
  }
  if (groupId && !db.groups.find(g => g.id === groupId)) {
    return res.status(404).json({ error: 'Unknown groupId' });
  }

  // compute distance and min/max speed
  let distance = 0;
  let minSpeed = Infinity;
  let maxSpeed = -Infinity;
  for (let i = 1; i < coords.length; i++) {
    distance += haversine(coords[i-1], coords[i]);
  }
  coords.forEach(pt => {
    const s = pt.speed || 0;
    if (s < minSpeed) minSpeed = s;
    if (s > maxSpeed) maxSpeed = s;
  });
  if (minSpeed === Infinity) minSpeed = 0;
  if (maxSpeed === -Infinity) maxSpeed = 0;

  const run = {
    id:        Date.now().toString(),
    trailId,
    coords,
    duration,
    distance,
    avgSpeed:  avgSpeed || 0,
    minSpeed,
    maxSpeed,
    vehicleId,
    userId,
    groupId:   groupId || null,
    timestamp: Date.now()
  };

  db.routes.push(run);
  saveDb(db);
  res.status(201).json(run);
});

// ――― LEADERBOARD ―――

app.get('/api/leaderboard/:tid', (req, res) => {
  const top5 = loadDb().routes
    .filter(r => r.trailId === req.params.tid)
    .sort((a, b) => a.duration - b.duration)
    .slice(0, 5);
  res.json(top5);
});

// catch-all 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// start server
const PORT = 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
}
module.exports = app;
