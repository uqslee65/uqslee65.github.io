import { ReplayControls } from './ReplayControls';
import { TraceInspector } from './TraceInspector';

export function ReplayPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <ReplayControls />
      <div style={{ borderTop: '1px solid var(--border)', margin: '0.25rem 0' }} />
      <TraceInspector />
    </div>
  );
}
