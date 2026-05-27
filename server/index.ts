import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3001;
const resultsDir = path.join(__dirname, 'results');
const dbPath = path.join(__dirname, 'results.db');

// Ensure results directory exists
fs.mkdirSync(resultsDir, { recursive: true });

// Initialize SQLite
const db = new Database(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    plan TEXT,
    treatment TEXT,
    n_agents INTEGER,
    n_rounds INTEGER,
    n_periods INTEGER,
    asset_class TEXT,
    config TEXT,
    periods TEXT,
    exported_at TEXT,
    received_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function setCors(res: http.ServerResponse) {
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.setHeader(k, v);
  }
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body);
  setCors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(json);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url ?? '/';
  const method = req.method ?? 'GET';

  // CORS preflight
  if (method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // GET /health
  if (method === 'GET' && url === '/health') {
    return send(res, 200, { status: 'ok' });
  }

  // POST /api/results
  if (method === 'POST' && url === '/api/results') {
    try {
      const raw = await readBody(req);
      const data = JSON.parse(raw);

      const cfg = data.config ?? {};
      const plan = cfg.plan ?? 'unknown';
      const treatment = cfg.treatment ?? null;
      const nAgents = cfg.nAgents ?? null;
      const nRounds = cfg.nRounds ?? null;
      const nPeriods = cfg.nPeriods ?? null;
      const assetClass = cfg.assetClass ?? null;
      const seed = cfg.seed ?? 0;
      const exportedAt = data.exportedAt ?? null;

      const session_id = `${plan}-${seed}-${Date.now()}`;

      const stmt = db.prepare(`
        INSERT INTO sessions
          (session_id, plan, treatment, n_agents, n_rounds, n_periods, asset_class,
           config, periods, exported_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        session_id,
        plan,
        treatment,
        nAgents,
        nRounds,
        nPeriods,
        assetClass,
        JSON.stringify(cfg),
        JSON.stringify(data.periods ?? null),
        exportedAt,
      );

      // Write JSON file
      const filePath = path.join(resultsDir, `${session_id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

      return send(res, 200, {
        ok: true,
        id: result.lastInsertRowid,
        sessionId: session_id,
      });
    } catch (err) {
      console.error('POST /api/results error:', err);
      return send(res, 400, { ok: false, error: String(err) });
    }
  }

  // GET /api/results/:id
  const idMatch = url.match(/^\/api\/results\/(\d+)$/);
  if (method === 'GET' && idMatch) {
    const id = Number(idMatch[1]);
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) {
      return send(res, 404, { ok: false, error: 'Not found' });
    }
    row.config = JSON.parse(row.config as string);
    row.periods = JSON.parse(row.periods as string);
    return send(res, 200, row);
  }

  // GET /api/results
  if (method === 'GET' && url === '/api/results') {
    const rows = db
      .prepare(
        `SELECT id, session_id, plan, treatment, n_agents, n_rounds, n_periods,
                asset_class, exported_at, received_at
         FROM sessions ORDER BY id DESC`,
      )
      .all();
    return send(res, 200, rows);
  }

  // DELETE /api/results
  if (method === 'DELETE' && url === '/api/results') {
    const { count } = db.prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number };
    db.prepare('DELETE FROM sessions').run();

    // Remove all .json files
    const files = fs.readdirSync(resultsDir).filter((f) => f.endsWith('.json'));
    for (const f of files) {
      fs.unlinkSync(path.join(resultsDir, f));
    }

    return send(res, 200, { ok: true, deleted: count });
  }

  send(res, 404, { error: 'Not found' });
});

server.listen(port, () => {
  console.log(`Mock results server listening on http://localhost:${port}`);
});
