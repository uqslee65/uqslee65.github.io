import { useCallback } from 'react';
import { Figure } from '../Figure';
import { useSimulator } from '../SimulatorProvider';
import { useCanvas } from '../hooks/useCanvas';
import { FIGURE_TOOLTIPS } from '../../../lib/sim/tooltips';
import { resolveAssetData } from '../../../lib/sim/assetHelpers';

export function Fig3Volume() {
  const { activePeriods, activeIdx, selectedAssetIdx } = useSimulator();
  const periods = activePeriods ?? [];

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const pad = { top: 10, right: 12, bottom: 30, left: 36 };
    if (periods.length === 0) {
      const ch = h - pad.top - pad.bottom;
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      // X axis
      ctx.beginPath();
      ctx.moveTo(pad.left, pad.top + ch);
      ctx.lineTo(w - pad.right, pad.top + ch);
      ctx.stroke();
      // Y axis
      ctx.beginPath();
      ctx.moveTo(pad.left, pad.top);
      ctx.lineTo(pad.left, pad.top + ch);
      ctx.stroke();
      // Grid lines
      ctx.setLineDash([3, 3]);
      for (const f of [0.25, 0.5, 0.75]) {
        ctx.beginPath();
        ctx.moveTo(pad.left, pad.top + ch * f);
        ctx.lineTo(w - pad.right, pad.top + ch * f);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      // Labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('N', pad.left - 3, pad.top + 4);
      ctx.fillText('0', pad.left - 3, pad.top + ch + 3);
      ctx.textAlign = 'center';
      ctx.fillText('Period', w / 2, h - 4);
      ctx.globalAlpha = 1;
      return;
    }

    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;

    const volumes = periods.map(p => resolveAssetData(p, selectedAssetIdx).trades.length);
    const maxVol = Math.max(...volumes, 1);
    const barW = Math.max(2, cw / periods.length - 2);
    const xAt = (i: number) => pad.left + (i + 0.5) * (cw / periods.length);
    const yScale = (v: number) => pad.top + ch - (v / maxVol) * ch;

    volumes.forEach((vol, i) => {
      const isCurrent = i === activeIdx;
      ctx.fillStyle = isCurrent ? 'var(--accent)' : '#6b7280';
      const x = xAt(i) - barW / 2;
      const bh = (vol / maxVol) * ch;
      ctx.fillRect(x, pad.top + ch - bh, barW, bh);
    });

    // Axes
    ctx.fillStyle = 'var(--fg-3)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(maxVol), pad.left - 3, pad.top + 4);
    ctx.fillText('0', pad.left - 3, pad.top + ch + 3);
    ctx.textAlign = 'center';
    ctx.fillText('1', xAt(0), h - 4);
    ctx.fillText(String(periods.length), xAt(periods.length - 1), h - 4);
  }, [periods, activeIdx, selectedAssetIdx]);

  const canvasRef = useCanvas(draw, [periods, activeIdx, selectedAssetIdx]);

  return (
    <Figure figNum="3" title="Trade Volume" titleTooltip={FIGURE_TOOLTIPS['fig3']} note="Number of trades per period. Highlighted bar = current period.">
      <canvas ref={canvasRef} style={{ width: '100%', height: 'var(--fig-canvas-h, 120px)', display: 'block' }} />
    </Figure>
  );
}
