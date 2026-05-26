import { useState } from 'react';

export interface TabItem {
  title: string;
  subtitle?: string;
  description: string;
  tags?: string[];
  status?: string;
  href?: string;
  links: {
    notebook?: string;
    slides?: string;
    site?: string;
    paper?: string;
  };
}

interface Props {
  projects: TabItem[];
  replications: TabItem[];
  research: TabItem[];
}

const TABS = ['Projects', 'Replications', 'Research'] as const;
type TabName = (typeof TABS)[number];

export default function LandingTabs({ projects, replications, research }: Props) {
  const [active, setActive] = useState<TabName>('Projects');

  const items = active === 'Projects' ? projects : active === 'Replications' ? replications : research;

  return (
    <section id="work" className="landing-tabs-section">
      <div className="nav-tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`nav-tab${active === tab ? ' active' : ''}`}
            onClick={() => setActive(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="tab-content">
        <div className="tab-cards">
          {items.map((item, i) => (
            <TabCard key={i} item={item} tab={active} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TabCard({ item, tab }: { item: TabItem; tab: TabName }) {
  const showNotebook = (tab === 'Replications' || tab === 'Research') && !!item.links.notebook;
  const showSlides = !!item.links.slides;
  const showSite = tab === 'Projects' && !!item.links.site;
  const showPaper = (tab === 'Replications' || tab === 'Research') && !!item.links.paper;
  const hasButtons = showNotebook || showSlides || showSite || showPaper;

  const cardContent = (
    <>
      <div className="tab-card-body">
        <div className="tab-card-header">
          <h3 className="tab-card-title">{item.title}</h3>
          {item.status && (
            <span className={`tab-status tab-status--${item.status}`}>
              {item.status}
            </span>
          )}
        </div>
        {item.subtitle && <p className="tab-card-subtitle">{item.subtitle}</p>}
        <p className="tab-card-desc">{item.description}</p>
        {item.tags && item.tags.length > 0 && (
          <div className="tab-card-tags">
            {item.tags.map((t, i) => (
              <span key={i} className="tag">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {hasButtons && (
        <div className="tab-card-actions">
          {showSite && (
            <a
              href={item.links.site}
              target={item.links.site?.startsWith('http') ? '_blank' : undefined}
              rel={item.links.site?.startsWith('http') ? 'noopener' : undefined}
              className="tab-action-btn"
              onClick={(e) => e.stopPropagation()}
            >
              SITE
            </a>
          )}
          {showNotebook && (
            <a
              href={item.links.notebook}
              target="_blank"
              rel="noopener"
              className="tab-action-btn"
              onClick={(e) => e.stopPropagation()}
            >
              NOTEBOOK
            </a>
          )}
          {showSlides && (
            <a
              href={item.links.slides}
              target="_blank"
              rel="noopener"
              className="tab-action-btn"
              onClick={(e) => e.stopPropagation()}
            >
              SLIDES
            </a>
          )}
          {showPaper && (
            <a
              href={item.links.paper}
              target="_blank"
              rel="noopener"
              className="tab-action-btn"
              onClick={(e) => e.stopPropagation()}
            >
              PAPER
            </a>
          )}
        </div>
      )}
    </>
  );

  if (item.href) {
    return (
      <a href={item.href} className="tab-card tab-card--link">
        {cardContent}
      </a>
    );
  }

  return <div className="tab-card">{cardContent}</div>;
}

