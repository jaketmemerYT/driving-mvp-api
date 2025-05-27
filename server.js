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

function loadDb() {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { raw = {}; }

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
    groupTrails:   Array.isArray(raw.groupTrails)   ? raw.groupTrails   : [],
  };

  // run migrations in order
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

  // ensure at least the "All Riders" public group exists
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
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const db  = loadDb();
  const usr = { id: nanoid(), name: name.trim(), email: email?.trim()||null, timestamp: Date.now() };
  db.users.push(usr);
  saveDb(db);
  res.status(201).json(usr);
});

// — CATEGORIES —
app.get('/api/categories', (_req, res) => {
  console.log('GET /api/categories');
  res.json(loadDb().categories);
});
app.post('/api/categories', (req, res) => {
  console.log('POST /api/categories', req.body);
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const db = loadDb();
  const cat = { id: nanoid(), name: name.trim() };
  db.categories.push(cat);
  saveDb(db);
  res.status(201).json(cat);
});

// — TRAILHEADS & TRAIL↔CATEGORY & TRAIL↔GROUP JOIN —
app.get('/api/trailheads', (_req, res) => {
  console.log('GET /api/trailheads');
  res.json(loadDb().trailheads);
});
app.post('/api/trailheads', (req, res) => {
  console.log('POST /api/trailheads', req.body);
  const { name, difficulty, categoryIds, groupIds } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const db = loadDb();
  const th = {
    id:         nanoid(),
    name:       name.trim(),
    difficulty: difficulty?.trim() || 'Unknown',
  };
  db.trailheads.push(th);

  // assign categories
  (categoryIds||[]).forEach(cid => {
    if (!db.categories.find(c=>c.id===cid)) return;
    if (!db.trailCategories.find(tc=>tc.trailId===th.id && tc.categoryId===cid)) {
      db.trailCategories.push({ trailId: th.id, categoryId: cid });
    }
  });
  // assign group availability
  (groupIds||[]).forEach(gid => {
    if (!db.groups.find(g=>g.id===gid)) return;
    if (!db.groupTrails.find(gt=>gt.trailId===th.id && gt.groupId===gid)) {
      db.groupTrails.push({ trailId: th.id, groupId: gid });
    }
  });

  saveDb(db);
  res.status(201).json(th);
});

app.get('/api/trailheads/:tid/categories', (req,res) => {
  console.log(`GET /api/trailheads/${req.params.tid}/categories`);
  const { categories, trailCategories } = loadDb();
  const linked = trailCategories
    .filter(tc=>tc.trailId===req.params.tid)
    .map(tc=>categories.find(c=>c.id===tc.categoryId))
    .filter(Boolean);
  res.json(linked);
});
app.post('/api/trailheads/:tid/categories', (req,res) => {
  console.log(`POST /api/trailheads/${req.params.tid}/categories`, req.body);
  const { categoryId } = req.body;
  const db = loadDb();
  if (!db.trailheads.find(t=>t.id===req.params.tid))
    return res.status(404).json({ error:'Trail not found' });
  if (!db.categories.find(c=>c.id===categoryId))
    return res.status(404).json({ error:'Category not found' });
  if (!db.trailCategories.find(tc=>tc.trailId===req.params.tid && tc.categoryId===categoryId)) {
    db.trailCategories.push({ trailId:req.params.tid, categoryId });
    saveDb(db);
  }
  res.status(204).end();
});
app.delete('/api/trailheads/:tid/categories/:cid',(req,res)=> {
  console.log(`DELETE /api/trailheads/${req.params.tid}/categories/${req.params.cid}`);
  const db = loadDb();
  db.trailCategories = db.trailCategories.filter(
    tc=>!(tc.trailId===req.params.tid && tc.categoryId===req.params.cid)
  );
  saveDb(db);
  res.status(204).end();
});

// TRAIL ↔ GROUP
app.get('/api/trailheads/:tid/groups', (req,res)=> {
  console.log(`GET /api/trailheads/${req.params.tid}/groups`);
  const { groups, groupTrails } = loadDb();
  const linked = groupTrails
    .filter(gt=>gt.trailId===req.params.tid)
    .map(gt=>groups.find(g=>g.id===gt.groupId))
    .filter(Boolean);
  res.json(linked);
});
app.post('/api/trailheads/:tid/groups', (req,res)=> {
  console.log(`POST /api/trailheads/${req.params.tid}/groups`, req.body);
  const { groupId } = req.body;
  const db = loadDb();
  if (!db.trailheads.find(t=>t.id===req.params.tid))
    return res.status(404).json({ error:'Trail not found' });
  if (!db.groups.find(g=>g.id===groupId))
    return res.status(404).json({ error:'Group not found' });
  if (!db.groupTrails.find(gt=>gt.trailId===req.params.tid && gt.groupId===groupId)) {
    db.groupTrails.push({ trailId:req.params.tid, groupId });
    saveDb(db);
  }
  res.status(204).end();
});
app.delete('/api/trailheads/:tid/groups/:gid',(req,res)=> {
  console.log(`DELETE /api/trailheads/${req.params.tid}/groups/${req.params.gid}`);
  const db = loadDb();
  db.groupTrails = db.groupTrails.filter(
    gt=>!(gt.trailId===req.params.tid && gt.groupId===req.params.gid)
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
  if (!name?.trim()) return res.status(400).json({ error:'Name required' });
  const db = loadDb();
  const cats = Array.isArray(categoryIds) ? categoryIds : [];
  for (let cid of cats) {
    if (!db.categories.find(c=>c.id===cid))
      return res.status(400).json({ error:`Bad categoryId ${cid}` });
  }
  const g = { id:nanoid(), name:name.trim(), isPrivate:!!isPrivate, categoryIds:cats };
  db.groups.push(g);
  saveDb(db);
  res.status(201).json(g);
});
app.get('/api/groups/:gid/users', (req,res)=> {
  console.log(`GET /api/groups/${req.params.gid}/users`);
  const { users, groupMembers } = loadDb();
  const memb = groupMembers
    .filter(gm=>gm.groupId===req.params.gid)
    .map(gm=>users.find(u=>u.id===gm.userId))
    .filter(Boolean);
  res.json(memb);
});
app.post('/api/groups/:gid/users', (req,res)=> {
  console.log(`POST /api/groups/${req.params.gid}/users`, req.body);
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error:'userId required' });
  const db = loadDb();
  if (!db.groups.find(g=>g.id===req.params.gid))
    return res.status(404).json({ error:'Group not found' });
  if (!db.users.find(u=>u.id===userId))
    return res.status(404).json({ error:'User not found' });
  if (!db.groupMembers.find(gm=>gm.groupId===req.params.gid && gm.userId===userId)) {
    db.groupMembers.push({ groupId:req.params.gid, userId });
    saveDb(db);
  }
  res.status(204).end();
});
app.delete('/api/groups/:gid/users/:uid',(req,res)=> {
  console.log(`DELETE /api/groups/${req.params.gid}/users/${req.params.uid}`);
  const db = loadDb();
  db.groupMembers = db.groupMembers.filter(
    gm=>!(gm.groupId===req.params.gid && gm.userId===req.params.uid)
  );
  saveDb(db);
  res.status(204).end();
});

// — VEHICLES —
app.get('/api/vehicles', (req, res) => {
  console.log('GET /api/vehicles');
  let vs = loadDb().vehicles;
  if (req.query.userId) {
    vs = vs.filter(v=>v.userId===req.query.userId);
  }
  res.json(vs);
});
app.post('/api/vehicles', (req, res) => {
  console.log('POST /api/vehicles', req.body);
  const { make, model, year, userId } = req.body;
  if (!make||!model||!year||!userId)
    return res.status(400).json({ error:'make, model, year & userId required' });
  const db = loadDb();
  if (!db.users.find(u=>u.id===userId))
    return res.status(400).json({ error:`No user ${userId}` });
  const v = { id:Date.now().toString(), make, model, year, userId, timestamp:Date.now() };
  db.vehicles.push(v);
  saveDb(db);
  res.status(201).json(v);
});
app.delete('/api/vehicles/:vid', (req, res) => {
  console.log(`DELETE /api/vehicles/${req.params.vid}`);
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error:'userId query required' });
  let db = loadDb();
  const v = db.vehicles.find(v=>v.id===req.params.vid);
  if (!v) return res.status(404).json({ error:'Vehicle not found' });
  if (v.userId !== userId) return res.status(403).json({ error:'Not your vehicle' });
  db.vehicles = db.vehicles.filter(x=>x.id!==req.params.vid);
  saveDb(db);
  res.status(204).end();
});

// — RUNS (ROUTES) —
app.get('/api/routes', (_req, res) => {
  console.log('GET /api/routes');
  res.json(loadDb().routes);
});
app.post('/api/routes', (req, res) => {
  console.log('POST /api/routes', req.body);
  const { trailId, coords, duration, avgSpeed, vehicleId, groupId, userId } = req.body;
  if (!trailId||!coords||!duration||!vehicleId||!userId)
    return res.status(400).json({ error:'trailId, coords, duration, vehicleId & userId required' });
  const db = loadDb();
  if (!db.vehicles.find(v=>v.id===vehicleId))
    return res.status(400).json({ error:`No vehicle ${vehicleId}` });
  if (groupId && !db.groups.find(g=>g.id===groupId))
    return res.status(400).json({ error:`No group ${groupId}` });
  if (!db.users.find(u=>u.id===userId))
    return res.status(400).json({ error:`No user ${userId}` });
  const run = {
    id: Date.now().toString(),
    trailId, coords, duration,
    avgSpeed: avgSpeed||0,
    vehicleId, groupId:groupId||null,
    userId, timestamp:Date.now(),
  };
  db.routes.push(run);
  saveDb(db);
  res.status(201).json(run);
});

// — LEADERBOARD —
app.get('/api/leaderboard/:tid', (req,res) => {
  console.log(`GET /api/leaderboard/${req.params.tid}`);
  const top5 = loadDb().routes
    .filter(r=>r.trailId===req.params.tid)
    .sort((a,b)=>a.duration-b.duration)
    .slice(0,5);
  res.json(top5);
});

// catch-all 404
app.use((_req, res) => res.status(404).json({ error:'Not found' }));

// start server
const PORT = 3000;
if (require.main===module) {
  app.listen(PORT, ()=>console.log(`API listening on http://localhost:${PORT}`));
}
module.exports = app;
