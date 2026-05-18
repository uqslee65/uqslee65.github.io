import { SimulatorProvider } from './simulator/SimulatorProvider';
import { ControlBar } from './simulator/ControlBar';
import { PlanSelector } from './simulator/PlanSelector';
import { SimulatorLayout } from './simulator/SimulatorLayout';

export default function BubbleSimulator() {
  return (
    <SimulatorProvider>
      <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '0 1rem' }}>
        <ControlBar />
        <PlanSelector />
        <SimulatorLayout />
      </div>
    </SimulatorProvider>
  );
}
