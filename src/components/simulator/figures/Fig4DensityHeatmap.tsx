import { useCallback } from 'react';
import { Figure } from '../Figure';
import { useSimulator } from '../SimulatorProvider';
import { useCanvas } from '../hooks/useCanvas';
import { FIGURE_TOOLTIPS } from '../../../lib/sim/tooltips';
import { resolveAssetData } from '../../../lib/sim/assetHelpers';

const N_BINS = 20;

export function Fig4DensityHeatmap() {
  const { activePeriods } = useSimulator();
  const periods = activePeriods ?? [];

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const pad = { top: 10, right: 12, bottom: 24, left: 36 };
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
      ctx.fillText('Price', pad.left - 3, pad.top + 4);
      ctx.fillText('0', pad.left - 3, pad.top + ch + 3);
      ctx.textAlign = 'center';
      ctx.fillText('Period', w / 2, h - 4);
      ctx.globalAlpha = 1;
      return;
    }

    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;

    // Collect all trade prices for range
    const allPrices: number[] = [];
    periods.forEach(p => resolveAssetData(p, 0).trades.forEach(t => allPrices.push(t.price)));
    const fvs = periods.map(p => resolveAssetData(p, 0).fv);
    const allVals = [...allPrices, ...fvs];
    if (allVals.length === 0) return;

    const pMin = Math.min(...allVals) * 0.95;
    const pMax = Math.max(...allVals) * 1.05;

    // Build 2D histogram [period][bin] = count
    const grid: number[][] = Array.from({ length: periods.length }, () => new Array(N_BINS).fill(0));
    const toBin = (price: number) =>
      Math.min(N_BINS - 1, Math.floor(((price - pMin) / (pMax - pMin)) * N_BINS));

    periods.forEach((p, pi) => {
      resolveAssetData(p, 0).trades.forEach(t => {
        grid[pi][toBin(t.price)]++;
      });
    });

    const maxCount = Math.max(...grid.flat(), 1);
    const cellW = cw / periods.length;
    const cellH = ch / N_BINS;

    grid.forEach((row, pi) => {
      row.forEach((count, bi) => {
        if (count === 0) return;
        const intensity = count / maxCount;
        // Blue (low) → Red (high)
        const r = Math.round(intensity * 239 + (1 - intensity) * 59);
        const g = Math.round((1 - intensity) * 130);
        const b = Math.round((1 - intensity) * 246 + intensity * 68);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(
          pad.left + pi * cellW,
          pad.top + (N_BINS - 1 - bi) * cellH,
          cellW - 1,
          cellH - 1,
        );
      });
    });

    // FV staircase overlay
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    periods.forEach((p, pi) => {
      const x1 = pad.left + pi * cellW;
      const x2 = x1 + cellW;
      const y = pad.top + ch - ((resolveAssetData(p, 0).fv - pMin) / (pMax - pMin)) * ch;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Axis labels
    ctx.fillStyle = 'var(--fg-3)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.round(pMax)), pad.left - 3, pad.top + 4);
    ctx.fillText(String(Math.round(pMin)), pad.left - 3, pad.top + ch + 3);
    ctx.textAlign = 'center';
    ctx.fillText('1', pad.left + cellW / 2, h - 4);
    ctx.fillText(String(periods.length), pad.left + (periods.length - 0.5) * cellW, h - 4);
  }, [periods]);

  const canvasRef = useCanvas(draw, [periods]);

  return (
    <Figure
      figNum="4"
      title="Price Density Heatmap"
      titleTooltip={FIGURE_TOOLTIPS['fig4']}
      note="Color intensity = trade density. Amber dashed = FV staircase."
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: 'var(--fig-canvas-h, 200px)', display: 'block' }} />
    </Figure>
  );
}
