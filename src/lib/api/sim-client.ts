const API_BASE = import.meta.env.PUBLIC_API_URL || '';

// All methods are fire-and-forget safe — simulation works without persistence

export interface RunRecord {
  id: string;
  seed: number;
  plan: string;
  treatment: string;
  assetClass: string;
  nAgents: number;
  startedAt: string;
  completedAt?: string;
  metrics?: any;
}

export async function createRun(config: any): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/sim/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seed: config.seed,
        plan: config.plan,
        treatment: config.treatment,
        assetClass: config.assetClass,
        nAgents: config.nAgents,
        nRounds: config.nRounds,
        config,
        startedAt: new Date().toISOString(),
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.id;
  } catch { return null; }
}

export async function savePeriods(runId: string, periods: any[]): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/sim/runs/${runId}/periods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periods }),
    });
    return res.ok;
  } catch { return false; }
}

export async function completeRun(runId: string, metrics: any): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/sim/runs/${runId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completedAt: new Date().toISOString(), metrics }),
    });
    return res.ok;
  } catch { return false; }
}

export async function listRuns(filters?: { plan?: string; limit?: number }): Promise<RunRecord[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.plan) params.set('plan', filters.plan);
    if (filters?.limit) params.set('limit', String(filters.limit));
    const res = await fetch(`${API_BASE}/api/sim/runs?${params}`);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export async function getRunPeriods(runId: string): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/api/sim/runs/${runId}/periods`);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export async function saveConfig(name: string, config: any): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/sim/configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, config, createdAt: new Date().toISOString() }),
    });
    return res.ok;
  } catch { return false; }
}

export async function listConfigs(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/api/sim/configs`);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export async function savePrompt(
  plan: string,
  systemTemplate: string,
  userTemplate: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/sim/prompts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan,
        version: Date.now(),
        systemTemplate,
        userTemplate,
        createdAt: new Date().toISOString(),
      }),
    });
    return res.ok;
  } catch { return false; }
}

export async function listPrompts(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/api/sim/prompts`);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}
