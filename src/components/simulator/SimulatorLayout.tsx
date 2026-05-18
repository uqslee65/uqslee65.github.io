import { useState, useEffect } from 'react';
import { Sidebar, SidebarContent } from './Sidebar';
import { Canvas } from './Canvas';
import { MobileBottomSheet } from './MobileBottomSheet';

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

export function SimulatorLayout() {
  const isMobile = useIsMobile();

  return (
    <div style={{
      display: 'flex',
      gap: '0.75rem',
      position: 'relative',
      paddingBottom: isMobile ? '72px' : undefined,
    }}>
      {!isMobile && <Sidebar />}
      <Canvas />
      {isMobile && (
        <MobileBottomSheet>
          <SidebarContent />
        </MobileBottomSheet>
      )}
    </div>
  );
}
