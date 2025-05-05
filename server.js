import express from 'express';
import cors from 'cors';
import { Low, JSONFile } from 'lowdb';

const app = express();
app.use(cors(), express.json());

// Lowdb setup
const db = new Low(new JSONFile('db.json'));
await db.read();
db.data ||= { routes: [] };

// Hard-coded sample trails
const trails = [
  { id: 't1', name: 'River Bend Loop', difficulty: 'easy', gpxUrl: '/assets/river.gpx' },
  { id: 't2', name: 'Mountain Pass', difficulty: 'advanced', gpxUrl: '/assets/mountain.gpx' },
];

// Endpoints
app.get('/api/trailheads', (_, res) => res.json(trails));

app.post('/api/routes', async (req, res) => {
  const run = { ...req.body, timestamp: Date.now() };
  db.data.routes.push(run);
  await db.write();
  res.status(201).json(run);
});

app.get('/api/leaderboard/:trailId', (req, res) => {
  const top5 = db.data.routes
    .filter(r => r.trailId === req.params.trailId)
    .sort((a,b)=>a.duration - b.duration)
    .slice(0,5);
  res.json(top5);
});

app.listen(3000, () => console.log('API listening on http://localhost:3000'));
