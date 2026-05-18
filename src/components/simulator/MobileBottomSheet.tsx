import { useState, useRef, useCallback } from 'react';

interface MobileBottomSheetProps {
  children: React.ReactNode;
}

type SnapPoint = 'peek' | 'half' | 'full';

const SNAP_HEIGHTS: Record<SnapPoint, string> = {
  peek: '64px',
  half: '50vh',
  full: '90vh',
};

const SNAP_PX: Record<SnapPoint, (windowHeight: number) => number> = {
  peek: () => 64,
  half: (h) => h * 0.5,
  full: (h) => h * 0.9,
};

export function MobileBottomSheet({ children }: MobileBottomSheetProps) {
  const [snap, setSnap] = useState<SnapPoint>('peek');
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0); // positive = dragging up (expanding)

  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number | null>(null);

  const snapOrder: SnapPoint[] = ['peek', 'half', 'full'];

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    setIsDragging(true);
    setDragOffset(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const delta = touchStartY.current - e.touches[0].clientY; // positive = dragging up
    setDragOffset(delta);
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null || touchStartTime.current === null) return;

    const endY = e.changedTouches[0].clientY;
    const deltaY = touchStartY.current - endY; // positive = swiped up
    const elapsed = Date.now() - touchStartTime.current;
    const velocity = deltaY / elapsed; // px/ms, positive = upward

    const windowHeight = window.innerHeight;
    const currentHeightPx = SNAP_PX[snap](windowHeight) + dragOffset;

    // Velocity-based snap: fast swipe overrides position
    const VELOCITY_THRESHOLD = 0.3; // px/ms
    let nextSnap: SnapPoint = snap;

    if (velocity > VELOCITY_THRESHOLD) {
      // Fast swipe up — move one step up
      const idx = snapOrder.indexOf(snap);
      nextSnap = snapOrder[Math.min(idx + 1, snapOrder.length - 1)];
    } else if (velocity < -VELOCITY_THRESHOLD) {
      // Fast swipe down — move one step down
      const idx = snapOrder.indexOf(snap);
      nextSnap = snapOrder[Math.max(idx - 1, 0)];
    } else {
      // Slow drag — snap to nearest by position
      let minDist = Infinity;
      for (const s of snapOrder) {
        const dist = Math.abs(currentHeightPx - SNAP_PX[s](windowHeight));
        if (dist < minDist) {
          minDist = dist;
          nextSnap = s;
        }
      }
    }

    setSnap(nextSnap);
    setDragOffset(0);
    setIsDragging(false);
    touchStartY.current = null;
    touchStartTime.current = null;
  }, [snap, dragOffset, snapOrder]);

  // Compute current height: base snap height + drag offset (clamped)
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const baseHeightPx = SNAP_PX[snap](windowHeight);
  const clampedOffset = Math.max(
    -(baseHeightPx - SNAP_PX['peek'](windowHeight)),
    Math.min(dragOffset, SNAP_PX['full'](windowHeight) - baseHeightPx)
  );

  const displayHeight = isDragging
    ? `${baseHeightPx + clampedOffset}px`
    : SNAP_HEIGHTS[snap];

  const isScrollable = snap === 'half' || snap === 'full';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: displayHeight,
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--border)',
        borderRadius: '12px 12px 0 0',
        display: 'flex',
        flexDirection: 'column',
        transition: isDragging ? 'none' : 'height 0.3s ease',
        overflow: 'hidden',
      }}
    >
      {/* Drag handle area — touch target */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          flexShrink: 0,
          paddingTop: '8px',
          paddingBottom: '8px',
          cursor: 'grab',
          touchAction: 'none',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '4px',
            borderRadius: '2px',
            background: 'var(--fg-3)',
            margin: '0 auto',
          }}
        />
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: isScrollable ? 'auto' : 'hidden',
          overflowX: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}
