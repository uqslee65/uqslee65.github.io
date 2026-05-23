import {
  createContext, useContext, useState, useCallback, useRef, useEffect,
  type ReactNode,
} from 'react';
import {
  runSession, fundamentalValue,
  type PeriodRecord, type SessionResult,
} from '../../lib/sim/engine';
import { computeMetrics, type BubbleMetrics } from '../../lib/sim/metrics';
import type { LLMPeriodRecord, LLMSessionResult, TickProgress } from '../../lib/sim/types';
import type { SimConfig } from '../../lib/sim/types';
import { DLM_DEFAULTS, LLM_SCALED_DEFAULTS } from '../../lib/sim/types';
import { runLLMSession } from '../../lib/sim/llm-engine';

// --- Published bubble metrics targets by round (DLM 2005, Table 2) ---
export const PUBLISHED: Record<number, BubbleMetrics> = {
  1: { haesselR2: 0.37, normAbsDev: 1.67, normAvgDev: 0.12, amplitude: 0.81, turnover: 0 },
  2: { haesselR2: 0.47, normAbsDev: 1.61, normAvgDev: 0.14, amplitude: 0.80, turnover: 0 },
  3: { haesselR2: 0.64, normAbsDev: 0.81, normAvgDev: 0.09, amplitude: 0.59, turnover: 0 },
  4: { haesselR2: 0.65, normAbsDev: 1.06, normAvgDev: 0.08, amplitude: 0.55, turnover: 0 },
};

// --- Context shape ---

interface SimulatorContextValue {
  // State
  config: SimConfig;
  session: SessionResult | null;
  llmSession: LLMSessionResult | null;
  currentIdx: number;
  playing: boolean;
  llmRunning: boolean;
  llmProgress: TickProgress | null;
  replayMode: 'live' | 'replay';
  replayTick: number;

  // Derived helpers (computed in provider, exposed to avoid duplication)
  isLLM: boolean;
  activePeriods: (PeriodRecord | LLMPeriodRecord)[] | undefined;
  activeIdx: number;
  currentRound: number;
  roundPeriods: (PeriodRecord | LLMPeriodRecord)[];
  roundIdx: number;
  currentPeriod: PeriodRecord | LLMPeriodRecord | null;
  metrics: BubbleMetrics | null;
  canRun: boolean;
  hasData: boolean;

  // Error state
  error: string | null;
  setError: (msg: string) => void;
  clearError: () => void;

  // Actions
  setConfig: (partial: Partial<SimConfig>) => void;
  runPlanI: () => void;
  runLLM: () => void;
  stop: () => void;
  play: () => void;
  pause: () => void;
  step: () => void;
  seek: (idx: number) => void;
  goLive: () => void;
  reset: () => void;
  exportSession: () => void;
}

const SimulatorContext = createContext<SimulatorContextValue | null>(null);

export function useSimulator(): SimulatorContextValue {
  const ctx = useContext(SimulatorContext);
  if (!ctx) throw new Error('useSimulator must be used inside SimulatorProvider');
  return ctx;
}

// --- Provider ---

export function SimulatorProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<SimConfig>({ ...DLM_DEFAULTS });

  // Plan I state
  const [session, setSession] = useState<SessionResult | null>(null);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<number | null>(null);

  // LLM state
  const [llmSession, setLlmSession] = useState<LLMSessionResult | null>(null);
  const [llmIdx, setLlmIdx] = useState(-1);
  const [llmRunning, setLlmRunning] = useState(false);
  const [llmProgress, setLlmProgress] = useState<TickProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Replay
  const [replayMode, setReplayMode] = useState<'live' | 'replay'>('live');
  const [replayTick, setReplayTick] = useState(0);

  // Error state
  const [error, setErrorState] = useState<string | null>(null);
  const setError = useCallback((msg: string) => {
    setErrorState(msg);
    console.error('[Simulator]', msg);
  }, []);
  const clearError = useCallback(() => setErrorState(null), []);

  // --- Derived values ---
  const isLLM = config.plan !== 'plan-i';
  const activePeriods = isLLM ? llmSession?.periods : session?.periods;
  const activeIdx = isLLM ? llmIdx : currentIdx;

  const currentRound = activePeriods && activeIdx >= 0
    ? activePeriods[activeIdx].round : 1;

  const roundPeriods = activePeriods
    ? activePeriods.filter(p => p.round === currentRound) : [];
  const roundIdx = roundPeriods.findIndex(p => p === activePeriods?.[activeIdx]);

  const totalSharesForMetrics = config.nAgents * Math.round(
    (config.endowmentShares.reduce((a, b) => a + b, 0) /
     config.endowmentShares.length)
  );

  const metrics = roundPeriods.length > 0 && roundIdx >= 0
    ? computeMetrics(
        roundPeriods.slice(0, roundIdx + 1) as PeriodRecord[],
        isLLM ? config.fv1 : DLM_DEFAULTS.fv1,
        totalSharesForMetrics,
      )
    : null;

  const currentPeriod = activePeriods && activeIdx >= 0 ? activePeriods[activeIdx] : null;

  const isOllamaProvider = config.llm?.provider === 'ollama';
  const canRun = isLLM ? (isOllamaProvider || !!(config.llm?.apiKey)) && !llmRunning : true;
  const hasData = isLLM ? !!llmSession : !!session;

  // --- Actions ---

  const setConfig = useCallback((partial: Partial<SimConfig>) => {
    setConfigState(prev => {
      const next = { ...prev, ...partial };
      // If plan changed, swap to appropriate defaults and clear sessions
      if (partial.plan && partial.plan !== prev.plan) {
        const base = partial.plan === 'plan-i' ? DLM_DEFAULTS : LLM_SCALED_DEFAULTS;
        return { ...base, ...partial, llm: prev.llm };
      }
      return next;
    });
    // Clear sessions when plan changes
    if (partial.plan && partial.plan !== config.plan) {
      setSession(null);
      setCurrentIdx(-1);
      setLlmSession(null);
      setLlmIdx(-1);
      setPlaying(false);
      setReplayMode('live');
    }
  }, [config.plan]);

  const runPlanI = useCallback(() => {
    try {
      const result = runSession({ ...config }, config.seed);
      setSession(result);
      setCurrentIdx(result.periods.length - 1);
      setPlaying(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Plan I simulation failed');
    }
  }, [config, setError]);

  const runLLMFn = useCallback(async () => {
    if (config.llm?.provider !== 'ollama' && !config.llm?.apiKey) return;
    setLlmRunning(true);
    setLlmSession(null);
    setLlmIdx(-1);

    abortRef.current = new AbortController();

    try {
      const result = await runLLMSession(
        { ...config },
        (progress) => {
          setLlmProgress(progress);
        },
        (periodRecord) => {
          setLlmSession(prev => {
            const periods = prev ? [...prev.periods, periodRecord] : [periodRecord];
            return {
              sessionId: config.seed,
              treatment: config.treatment,
              plan: config.plan,
              periods,
            };
          });
          setLlmIdx(prev => prev + 1);
        },
        abortRef.current.signal,
      );
      setLlmSession(result);
      setLlmIdx(result.periods.length - 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'LLM run failed');
    } finally {
      setLlmRunning(false);
      setLlmProgress(null);
    }
  }, [config, setError]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setLlmRunning(false);
    setLlmProgress(null);
  }, []);

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);

  const step = useCallback(() => {
    if (isLLM) {
      if (!llmSession) return;
      setLlmIdx(i => Math.min(i + 1, llmSession.periods.length - 1));
    } else {
      if (!session) return;
      setCurrentIdx(i => Math.min(i + 1, session.periods.length - 1));
    }
  }, [isLLM, session, llmSession]);

  const seek = useCallback((idx: number) => {
    setReplayMode('replay');
    setReplayTick(idx);
    if (isLLM) {
      if (llmSession) setLlmIdx(Math.max(0, Math.min(idx, llmSession.periods.length - 1)));
    } else {
      if (session) setCurrentIdx(Math.max(0, Math.min(idx, session.periods.length - 1)));
    }
  }, [isLLM, session, llmSession]);

  const goLive = useCallback(() => {
    setReplayMode('live');
    if (isLLM) {
      if (llmSession) setLlmIdx(llmSession.periods.length - 1);
    } else {
      if (session) setCurrentIdx(session.periods.length - 1);
    }
  }, [isLLM, session, llmSession]);

  const exportSession = useCallback(() => {
    if (!hasData) return;
    const data = {
      exportedAt: new Date().toISOString(),
      config,
      periods: activePeriods,
      metrics,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sim-${config.plan}-${config.seed}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [hasData, config, activePeriods, metrics]);

  const reset = useCallback(() => {
    setSession(null);
    setCurrentIdx(-1);
    setLlmSession(null);
    setLlmIdx(-1);
    setPlaying(false);
    setLlmProgress(null);
    setReplayMode('live');
    setReplayTick(0);
    setErrorState(null);
    // Regenerate seed
    setConfigState(prev => ({ ...prev, seed: Math.floor(Math.random() * 9999) + 1 }));
  }, []);

  // --- Playback interval ---
  useEffect(() => {
    if (playing && !isLLM && session) {
      intervalRef.current = window.setInterval(() => {
        setCurrentIdx(i => {
          if (i >= session.periods.length - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        });
      }, config.speed);
    }
    if (playing && isLLM && llmSession) {
      intervalRef.current = window.setInterval(() => {
        setLlmIdx(i => {
          if (i >= llmSession.periods.length - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        });
      }, config.speed);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, isLLM, session, llmSession, config.speed]);

  const value: SimulatorContextValue = {
    config,
    session,
    llmSession,
    currentIdx,
    playing,
    llmRunning,
    llmProgress,
    replayMode,
    replayTick,
    isLLM,
    activePeriods: activePeriods as (PeriodRecord | LLMPeriodRecord)[] | undefined,
    activeIdx,
    currentRound,
    roundPeriods: roundPeriods as (PeriodRecord | LLMPeriodRecord)[],
    roundIdx,
    currentPeriod: currentPeriod as PeriodRecord | LLMPeriodRecord | null,
    metrics,
    canRun,
    hasData,
    error,
    setError,
    clearError,
    setConfig,
    runPlanI,
    runLLM: runLLMFn,
    stop,
    play,
    pause,
    step,
    seek,
    goLive,
    reset,
    exportSession,
  };

  return (
    <SimulatorContext.Provider value={value}>
      {children}
    </SimulatorContext.Provider>
  );
}
