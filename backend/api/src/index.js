import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { ObjectId } from 'mongodb';
import { connectDB, getDB } from './db.js';

const app = new Hono();

const GITHUB_USER = process.env.GITHUB_USER || 'lszeray';
const FORMULAS_URL = process.env.FORMULAS_URL || 'http://formulas:8000';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://lszeray.github.io';

app.use('/api/*', cors({ origin: CORS_ORIGIN }));

let repoCache = { data: null, ts: 0 };
const CACHE_TTL = 3600_000;

app.get('/api/repos', async (c) => {
  const now = Date.now();
  if (repoCache.data && now - repoCache.ts < CACHE_TTL) {
    return c.json(repoCache.data);
  }
  const res = await fetch(
    `https://api.github.com/users/${GITHUB_USER}/repos?sort=updated&per_page=30`,
    { headers: { 'User-Agent': 'phd-api', Accept: 'application/vnd.github+json' } }
  );
  if (!res.ok) return c.json({ error: 'GitHub API error' }, 502);
  const repos = await res.json();
  const data = repos.map((r) => ({
    name: r.name,
    description: r.description,
    stars: r.stargazers_count,
    language: r.language,
    url: r.html_url,
    homepage: r.homepage,
    updated_at: r.updated_at,
  }));
  repoCache = { data, ts: now };
  return c.json(data);
});

app.get('/api/formulas', async (c) => {
  const res = await fetch(`${FORMULAS_URL}/formulas`);
  if (!res.ok) return c.json({ error: 'Formula service error' }, 502);
  return c.json(await res.json());
});

app.get('/api/formulas/:id', async (c) => {
  const id = c.req.param('id');
  const res = await fetch(`${FORMULAS_URL}/formulas/${id}`);
  if (!res.ok) return c.json({ error: 'Formula not found' }, res.status);
  return c.json(await res.json());
});

app.get('/api/health', (c) => c.json({ status: 'ok' }));

// ---------------------------------------------------------------------------
// Simulation persistence routes
// ---------------------------------------------------------------------------

// POST /api/sim/runs — create a new run, return { id }
app.post('/api/sim/runs', async (c) => {
  try {
    const body = await c.req.json();
    const doc = {
      seed: body.seed,
      plan: body.plan,
      treatment: body.treatment,
      assetClass: body.assetClass,
      nAgents: body.nAgents,
      nRounds: body.nRounds,
      config: body.config ?? null,
      startedAt: body.startedAt ?? new Date().toISOString(),
      completedAt: null,
      metrics: null,
    };
    const result = await getDB().collection('sim_runs').insertOne(doc);
    return c.json({ id: result.insertedId.toHexString() }, 201);
  } catch (err) {
    console.error('POST /api/sim/runs', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/sim/runs — list runs; query params: plan, treatment, limit, offset
app.get('/api/sim/runs', async (c) => {
  try {
    const { plan, treatment, limit = '20', offset = '0' } = c.req.query();
    const filter = {};
    if (plan) filter.plan = plan;
    if (treatment) filter.treatment = treatment;
    const docs = await getDB()
      .collection('sim_runs')
      .find(filter)
      .sort({ startedAt: -1 })
      .skip(parseInt(offset))
      .limit(Math.min(parseInt(limit), 100))
      .toArray();
    return c.json(docs.map(({ _id, ...rest }) => ({ id: _id.toHexString(), ...rest })));
  } catch (err) {
    console.error('GET /api/sim/runs', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/sim/runs/:id — get a single run by id
app.get('/api/sim/runs/:id', async (c) => {
  try {
    const id = c.req.param('id');
    let oid;
    try { oid = new ObjectId(id); } catch { return c.json({ error: 'Invalid id' }, 400); }
    const doc = await getDB().collection('sim_runs').findOne({ _id: oid });
    if (!doc) return c.json({ error: 'Not found' }, 404);
    const { _id, ...rest } = doc;
    return c.json({ id: _id.toHexString(), ...rest });
  } catch (err) {
    console.error('GET /api/sim/runs/:id', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// PATCH /api/sim/runs/:id — update completedAt and metrics
app.patch('/api/sim/runs/:id', async (c) => {
  try {
    const id = c.req.param('id');
    let oid;
    try { oid = new ObjectId(id); } catch { return c.json({ error: 'Invalid id' }, 400); }
    const body = await c.req.json();
    const update = {};
    if (body.completedAt !== undefined) update.completedAt = body.completedAt;
    if (body.metrics !== undefined) update.metrics = body.metrics;
    const result = await getDB()
      .collection('sim_runs')
      .updateOne({ _id: oid }, { $set: update });
    if (result.matchedCount === 0) return c.json({ error: 'Not found' }, 404);
    return c.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/sim/runs/:id', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/sim/runs/:id/periods — batch insert periods for a run
app.post('/api/sim/runs/:id/periods', async (c) => {
  try {
    const id = c.req.param('id');
    let oid;
    try { oid = new ObjectId(id); } catch { return c.json({ error: 'Invalid id' }, 400); }
    const body = await c.req.json();
    const periods = (body.periods ?? []).map((p) => ({ ...p, runId: oid }));
    if (periods.length === 0) return c.json({ inserted: 0 }, 200);
    const result = await getDB().collection('sim_periods').insertMany(periods);
    return c.json({ inserted: result.insertedCount }, 201);
  } catch (err) {
    console.error('POST /api/sim/runs/:id/periods', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/sim/runs/:id/periods — retrieve periods for a run
app.get('/api/sim/runs/:id/periods', async (c) => {
  try {
    const id = c.req.param('id');
    let oid;
    try { oid = new ObjectId(id); } catch { return c.json({ error: 'Invalid id' }, 400); }
    const docs = await getDB()
      .collection('sim_periods')
      .find({ runId: oid })
      .sort({ round: 1, period: 1 })
      .toArray();
    return c.json(docs.map(({ _id, runId, ...rest }) => ({ id: _id.toHexString(), runId: runId.toHexString(), ...rest })));
  } catch (err) {
    console.error('GET /api/sim/runs/:id/periods', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/sim/configs — list saved configs
app.get('/api/sim/configs', async (c) => {
  try {
    const docs = await getDB()
      .collection('sim_configs')
      .find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    return c.json(docs.map(({ _id, ...rest }) => ({ id: _id.toHexString(), ...rest })));
  } catch (err) {
    console.error('GET /api/sim/configs', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/sim/configs — save a named config preset
app.post('/api/sim/configs', async (c) => {
  try {
    const body = await c.req.json();
    const doc = {
      name: body.name,
      config: body.config,
      createdAt: body.createdAt ?? new Date().toISOString(),
    };
    const result = await getDB().collection('sim_configs').insertOne(doc);
    return c.json({ id: result.insertedId.toHexString() }, 201);
  } catch (err) {
    console.error('POST /api/sim/configs', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// DELETE /api/sim/configs/:id — delete a saved config
app.delete('/api/sim/configs/:id', async (c) => {
  try {
    const id = c.req.param('id');
    let oid;
    try { oid = new ObjectId(id); } catch { return c.json({ error: 'Invalid id' }, 400); }
    const result = await getDB().collection('sim_configs').deleteOne({ _id: oid });
    if (result.deletedCount === 0) return c.json({ error: 'Not found' }, 404);
    return c.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/sim/configs/:id', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/sim/prompts — list prompt versions
app.get('/api/sim/prompts', async (c) => {
  try {
    const docs = await getDB()
      .collection('sim_prompts')
      .find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    return c.json(docs.map(({ _id, ...rest }) => ({ id: _id.toHexString(), ...rest })));
  } catch (err) {
    console.error('GET /api/sim/prompts', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/sim/prompts — save a prompt version
app.post('/api/sim/prompts', async (c) => {
  try {
    const body = await c.req.json();
    const doc = {
      plan: body.plan,
      version: body.version ?? Date.now(),
      systemTemplate: body.systemTemplate,
      userTemplate: body.userTemplate,
      createdAt: body.createdAt ?? new Date().toISOString(),
    };
    const result = await getDB().collection('sim_prompts').insertOne(doc);
    return c.json({ id: result.insertedId.toHexString() }, 201);
  } catch (err) {
    console.error('POST /api/sim/prompts', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

connectDB().catch((err) => console.error('MongoDB connection failed:', err));

const port = parseInt(process.env.PORT || '3000');
serve({ fetch: app.fetch, port }, () => {
  console.log(`API server running on port ${port}`);
});
