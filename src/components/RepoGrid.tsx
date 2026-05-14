import { useState, useEffect } from 'react';

interface Repo {
  name: string;
  description: string | null;
  stars: number;
  language: string | null;
  url: string;
  homepage: string | null;
  updated_at: string;
}

const API_URL = import.meta.env.PUBLIC_API_URL || '';

export default function RepoGrid() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!API_URL) {
      setLoading(false);
      return;
    }
    fetch(`${API_URL}/api/repos`)
      .then((r) => r.json())
      .then((data) => {
        setRepos(data.filter((r: Repo) => !r.name.startsWith('.')));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (!API_URL) return null;
  if (loading) return <p style={{ color: 'var(--fg-3)', fontSize: '0.9rem' }}>Loading repositories...</p>;
  if (!repos.length) return null;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '1rem',
      marginTop: '1.5rem',
    }}>
      {repos.map((r) => (
        <a
          key={r.name}
          href={r.url}
          target="_blank"
          rel="noopener"
          className="card"
          style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '0.95rem', color: 'var(--fg)' }}>{r.name}</strong>
            {r.stars > 0 && <span style={{ fontSize: '0.8rem', color: 'var(--fg-3)' }}>&#9733; {r.stars}</span>}
          </div>
          {r.description && <p style={{ fontSize: '0.8rem', color: 'var(--fg-2)', lineHeight: 1.4 }}>{r.description}</p>}
          {r.language && <span className="tag" style={{ alignSelf: 'flex-start' }}>{r.language}</span>}
        </a>
      ))}
    </div>
  );
}
