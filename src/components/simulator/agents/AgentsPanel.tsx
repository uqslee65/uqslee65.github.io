import { useSimulator } from '../SimulatorProvider';
import { AgentCard } from './AgentCard';
import type { PeriodRecord } from '../../../lib/sim/engine';
import type { LLMPeriodRecord } from '../../../lib/sim/types';

function gridCols(n: number): string {
  if (n <= 6) return 'repeat(2, 1fr)';
  if (n <= 12) return 'repeat(3, 1fr)';
  if (n <= 20) return 'repeat(4, 1fr)';
  return 'repeat(5, 1fr)';
}

export function AgentsPanel() {
  const {
    config, currentPeriod, activePeriods, activeIdx,
    isLLM, currentRound,
  } = useSimulator();

  if (!currentPeriod) {
    return (
      <p style={{ fontSize: '0.8rem', color: 'var(--fg-3)', margin: 0 }}>
        Run simulation to see agents.
      </p>
    );
  }

  const N = config.nAgents;
  const agentIds: number[] = Array.from({ length: N }, (_, i) => i);

  // Build per-agent history arrays from all periods up to current
  const pastPeriods = activePeriods ? activePeriods.slice(0, activeIdx + 1) : [];
  const priceHistory = pastPeriods.map(p => p.meanPrice);

  return (
    <div>
      <div style={{
        fontSize: '0.72rem', color: 'var(--fg-3)',
        marginBottom: '0.75rem',
      }}>
        Agents · {N} total · Round {currentRound}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: gridCols(N),
        gap: '0.5rem',
      }}>
        {agentIds.map(id => {
          // Build cash/shares history for this agent
          const cashHistory = pastPeriods.map(p => {
            if (isLLM) {
              const s = (p as LLMPeriodRecord).agentStates.find(a => a.id === id);
              return s?.cash ?? 0;
            } else {
              const s = (p as PeriodRecord).agentStates.find(a => a.id === id);
              return s?.cash ?? 0;
            }
          });

          const sharesHistory = pastPeriods.map(p => {
            if (isLLM) {
              const s = (p as LLMPeriodRecord).agentStates.find(a => a.id === id);
              return s?.shares ?? 0;
            } else {
              const s = (p as PeriodRecord).agentStates.find(a => a.id === id);
              return s?.shares ?? 0;
            }
          });

          if (isLLM) {
            const llmState = (currentPeriod as LLMPeriodRecord).agentStates.find(a => a.id === id);
            return (
              <AgentCard
                key={id}
                id={id}
                isLLM
                llmState={llmState}
                fv={currentPeriod.fv}
                cashHistory={cashHistory}
                sharesHistory={sharesHistory}
                priceHistory={priceHistory}
                sharesHistoryForWealth={sharesHistory}
              />
            );
          } else {
            const planIState = (currentPeriod as PeriodRecord).agentStates.find(a => a.id === id);
            return (
              <AgentCard
                key={id}
                id={id}
                isLLM={false}
                planIState={planIState}
                fv={currentPeriod.fv}
                cashHistory={cashHistory}
                sharesHistory={sharesHistory}
                priceHistory={priceHistory}
                sharesHistoryForWealth={sharesHistory}
              />
            );
          }
        })}
      </div>
    </div>
  );
}
