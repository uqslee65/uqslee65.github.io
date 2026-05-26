/**
 * GitHub API utilities — build-time fetching with graceful null returns.
 * Uses GITHUB_TOKEN env var if available (no-auth for public repos otherwise).
 */

export interface RepoStats {
  stars: number;
  forks: number;
  language: string;
  description: string;
}

export interface WeeklyCommit {
  week: number;   // Unix timestamp of week start
  total: number;
  days: number[]; // [sun, mon, tue, wed, thu, fri, sat]
}

export interface RecentCommit {
  sha: string;
  message: string;
  date: string;
  author: string;
}

function authHeaders(): HeadersInit {
  const token =
    (typeof import.meta !== 'undefined' && import.meta.env?.GITHUB_TOKEN) ||
    (typeof process !== 'undefined' && process.env?.GITHUB_TOKEN) ||
    '';
  return token
    ? { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
    : { Accept: 'application/vnd.github+json' };
}

async function ghFetch(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchRepoStats(
  owner: string,
  repo: string
): Promise<RepoStats | null> {
  const data = await ghFetch(`https://api.github.com/repos/${owner}/${repo}`);
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  return {
    stars: (d['stargazers_count'] as number) ?? 0,
    forks: (d['forks_count'] as number) ?? 0,
    language: (d['language'] as string) ?? '',
    description: (d['description'] as string) ?? '',
  };
}

export async function fetchCommitActivity(
  owner: string,
  repo: string
): Promise<WeeklyCommit[] | null> {
  // GitHub may return 202 (computing) on first call — we retry once.
  const url = `https://api.github.com/repos/${owner}/${repo}/stats/commit_activity`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: authHeaders() });
      if (res.status === 202) {
        // GitHub is computing stats; wait 1s then retry
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data)) return null;
      return (data as Array<Record<string, unknown>>).map((w) => ({
        week: (w['week'] as number) ?? 0,
        total: (w['total'] as number) ?? 0,
        days: (w['days'] as number[]) ?? [0, 0, 0, 0, 0, 0, 0],
      }));
    } catch {
      return null;
    }
  }
  return null;
}

export async function fetchRecentCommits(
  owner: string,
  repo: string,
  count = 10
): Promise<RecentCommit[] | null> {
  const data = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${count}`
  );
  if (!Array.isArray(data)) return null;
  return (data as Array<Record<string, unknown>>).map((c) => {
    const commit = (c['commit'] as Record<string, unknown>) ?? {};
    const authorObj = (commit['author'] as Record<string, unknown>) ?? {};
    const ghAuthor = (c['author'] as Record<string, unknown>) ?? {};
    return {
      sha: ((c['sha'] as string) ?? '').slice(0, 7),
      message: ((commit['message'] as string) ?? '').split('\n')[0],
      date: (authorObj['date'] as string) ?? '',
      author:
        (ghAuthor['login'] as string) ??
        (authorObj['name'] as string) ??
        'unknown',
    };
  });
}
