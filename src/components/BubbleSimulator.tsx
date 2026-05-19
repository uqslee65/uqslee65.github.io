import { SimulatorProvider, useSimulator } from './simulator/SimulatorProvider';
import { ControlBar } from './simulator/ControlBar';
import { PlanSelector } from './simulator/PlanSelector';
import { SimulatorLayout } from './simulator/SimulatorLayout';
import { ErrorBoundary } from './simulator/ErrorBoundary';
import { ErrorToast } from './simulator/ErrorToast';

function SimulatorInner() {
  const { reset, error, clearError } = useSimulator();
  return (
    <ErrorBoundary onReset={reset}>
      <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '0 1rem' }}>
        <ControlBar />
        <PlanSelector />
        <SimulatorLayout />
      </div>
      {error && <ErrorToast message={error} onDismiss={clearError} />}
    </ErrorBoundary>
  );
}

export default function BubbleSimulator() {
  return (
    <SimulatorProvider>
      <SimulatorInner />
    </SimulatorProvider>
  );
}
