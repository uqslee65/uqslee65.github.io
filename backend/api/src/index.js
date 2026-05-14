import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';

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

const port = parseInt(process.env.PORT || '3000');
serve({ fetch: app.fetch, port }, () => {
  console.log(`API server running on port ${port}`);
});
