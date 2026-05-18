import type { LLMConfig, LLMDecision } from './types';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

class Semaphore {
  private queue: (() => void)[] = [];
  private active = 0;

  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return;
    }
    return new Promise<void>(resolve => this.queue.push(resolve));
  }

  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) {
      this.active++;
      next();
    }
  }
}

const semaphores = new Map<number, Semaphore>();

function getSemaphore(maxConcurrent: number): Semaphore {
  if (!semaphores.has(maxConcurrent)) {
    semaphores.set(maxConcurrent, new Semaphore(maxConcurrent));
  }
  return semaphores.get(maxConcurrent)!;
}

const DEFAULT_DECISION: LLMDecision = { action: 'HOLD', spread: 0.05 };
const TIMEOUT_MS = 30000;
const MAX_RETRIES = 1;

export function parseDecision(raw: string): LLMDecision {
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const jsonMatch = cleaned.match(/\{[^}]*\}/);
  if (!jsonMatch) return DEFAULT_DECISION;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const action = parsed.action?.toUpperCase?.();
    const validActions = ['BUY_NOW', 'SELL_NOW', 'BID', 'ASK_1', 'HOLD'];
    if (!validActions.includes(action)) return DEFAULT_DECISION;

    let spread = parseFloat(parsed.spread) || 0.05;
    spread = Math.max(0.01, Math.min(0.10, spread));

    return { action, spread, reasoning: parsed.reasoning };
  } catch {
    return DEFAULT_DECISION;
  }
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function callLLM(
  config: LLMConfig,
  messages: ChatMessage[],
): Promise<LLMDecision> {
  const sem = getSemaphore(config.maxConcurrent);
  await sem.acquire();

  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const resp = await fetchWithTimeout(
          `${config.baseUrl}/api/chat`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: config.model,
              messages,
              stream: false,
            }),
          },
          TIMEOUT_MS,
        );

        if (resp.status === 429 || resp.status >= 500) {
          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
          return DEFAULT_DECISION;
        }

        if (!resp.ok) return DEFAULT_DECISION;

        const data = await resp.json();
        const content = data.message?.content ?? '';
        return parseDecision(content);
      } catch (e) {
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        console.warn('[llm-client] request failed:', e);
        return DEFAULT_DECISION;
      }
    }
    return DEFAULT_DECISION;
  } finally {
    sem.release();
  }
}

export async function testConnection(config: LLMConfig): Promise<boolean> {
  try {
    const resp = await fetchWithTimeout(
      `${config.baseUrl}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: 'Reply with: ok' }],
          stream: false,
        }),
      },
      5000,
    );
    return resp.ok;
  } catch {
    return false;
  }
}
