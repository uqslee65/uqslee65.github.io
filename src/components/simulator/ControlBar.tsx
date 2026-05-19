import { useState, useEffect, useRef } from 'react';
import { useSimulator } from './SimulatorProvider';
import { HelpModal } from './HelpModal';
import { ExperimentSetupModal } from './ExperimentSetupModal';

const btnBase: React.CSSProperties = {
  padding: '0.4rem 0.75rem',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'var(--border)',
  borderRadius: '6px',
  background: 'var(--bg-card)',
  color: 'var(--fg)',
  fontSize: '0.8rem',
  cursor: 'pointer',
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: 'var(--accent)',
  color: 'white',
  borderColor: 'var(--accent)',
};

const btnDanger: React.CSSProperties = {
  ...btnBase,
  background: '#ef4444',
  color: 'white',
  borderColor: '#ef4444',
};

const btnSuccess: React.CSSProperties = {
  ...btnBase,
  background: '#22c55e',
  color: 'white',
  borderColor: '#22c55e',
};

const btnDisabled: React.CSSProperties = {
  opacity: 0.4,
  cursor: 'not-allowed',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 600,
  color: 'var(--fg-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  display: 'block',
  marginBottom: '0.2rem',
};

export function ControlBar() {
  const {
    config, setConfig,
    isLLM, canRun, hasData,
    playing, llmRunning,
    runPlanI, runLLM, stop,
    play, pause, step, reset,
    exportSession,
  } = useSimulator();

  const [showHelp,  setShowHelp]  = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [setupStep, setSetupStep] = useState(1);

  const handleRun = () => isLLM ? runLLM() : runPlanI();

  // Auto-open setup modal whenever the user switches to a different plan.
  const prevPlan = useRef(config.plan);
  useEffect(() => {
    if (config.plan !== prevPlan.current) {
      prevPlan.current = config.plan;
      setSetupStep(1);
      setShowSetup(true);
    }
  }, [config.plan]);

  return (
    <>
      <div
        className="controlbar"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '1rem',
          flexWrap: 'wrap',
          padding: '0.75rem 1rem',
          background: 'var(--stat-bg)',
          borderRadius: 'var(--radius)',
          marginBottom: '0.75rem',
        }}
      >
        {/* Version selector */}
        <div>
          <label style={labelStyle}>Version</label>
          <select style={{
            padding: '0.35rem 0.5rem',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            background: 'var(--bg-card)',
            color: 'var(--fg)',
            fontSize: '0.8rem',
          }}>
            <option value="v1">v1 — DLM (2005)</option>
          </select>
        </div>

        {/* Speed */}
        <div
          title={isLLM ? 'Speed is controlled by LLM API response time' : undefined}
          style={isLLM ? { opacity: 0.35, pointerEvents: 'none' as const } : undefined}
        >
          <label style={labelStyle}>Speed</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <input
              type="range"
              min={100}
              max={1500}
              step={100}
              value={config.speed}
              onChange={e => setConfig({ speed: Number(e.target.value) })}
              style={{ width: '90px' }}
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--fg-3)' }}>{config.speed}ms</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="controlbar-btns" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {llmRunning ? (
            <button onClick={stop} style={btnDanger}>Stop</button>
          ) : (
            <button
              onClick={handleRun}
              disabled={!canRun}
              style={{ ...btnPrimary, ...(canRun ? {} : btnDisabled) }}
              title="Execute simulation and generate period data"
            >
              {isLLM ? 'Run LLM' : 'Run'}
            </button>
          )}

          <button
            onClick={playing ? pause : play}
            disabled={!hasData || llmRunning}
            style={{ ...btnBase, ...(!hasData || llmRunning ? btnDisabled : {}) }}
            title="Animate through generated data at the speed setting"
          >
            {playing ? 'Pause' : 'Play'}
          </button>

          <button
            onClick={step}
            disabled={!hasData || playing || llmRunning}
            style={{ ...btnBase, ...(!hasData || playing || llmRunning ? btnDisabled : {}) }}
          >
            Step
          </button>

          <button onClick={reset} style={btnBase}>Reset</button>

          <button
            onClick={hasData ? exportSession : undefined}
            disabled={!hasData}
            style={{ ...( hasData ? btnSuccess : btnBase), ...(!hasData ? btnDisabled : {}) }}
            title={hasData ? 'Export session as JSON' : 'Run the simulation first'}
          >
            Download JSON
          </button>

          <button
            style={btnBase}
            title="Experiment Setup"
            onClick={() => { setSetupStep(1); setShowSetup(true); }}
          >
            Setup
          </button>

          <button
            style={btnBase}
            title="Help"
            onClick={() => setShowHelp(true)}
          >
            ?
          </button>
        </div>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.65rem', color: 'var(--fg-3)' }}>
          Run generates data · Play animates it
        </p>
      </div>

      {/* Mobile responsive overrides */}
      <style>{`
        @media (max-width: 768px) {
          .controlbar {
            flex-direction: column;
            align-items: stretch;
          }
          .controlbar-btns {
            flex-wrap: wrap;
          }
          .controlbar button,
          .controlbar select,
          .controlbar input[type="range"] {
            min-height: 44px;
          }
          .controlbar button {
            flex: 1 1 auto;
            min-width: 64px;
          }
        }
      `}</style>

      {showSetup && (
        <ExperimentSetupModal
          onClose={() => setShowSetup(false)}
          onRun={handleRun}
          initialStep={setupStep}
        />
      )}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </>
  );
}
