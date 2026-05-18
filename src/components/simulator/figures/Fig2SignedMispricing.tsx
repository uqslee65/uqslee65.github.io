import { useCallback } from 'react';
import { Figure } from '../Figure';
import { useSimulator } from '../SimulatorProvider';
import { useCanvas } from '../hooks/useCanvas';

export function Fig2SignedMispricing() {
  const { activePeriods } = useSimulator();
  const periods = activePeriods ?? [];

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const pad = { top: 12, right: 12, bottom: 24, left: 42 };
    if (periods.length === 0) {
      const ch = h - pad.top - pad.bottom;
      ctx.globalAlpha = 0.4;
      // X axis
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, pad.top + ch);
      ctx.lineTo(w - pad.right, pad.top + ch);
      ctx.stroke();
      // Y axis
      ctx.beginPath();
      ctx.moveTo(pad.left, pad.top);
      ctx.lineTo(pad.left, pad.top + ch);
      ctx.stroke();
      // Zero line (midpoint)
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(pad.left, pad.top + ch / 2);
      ctx.lineTo(w - pad.right, pad.top + ch / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // Grid lines at 25% and 75%
      for (const f of [0.25, 0.75]) {
        ctx.beginPath();
        ctx.moveTo(pad.left, pad.top + ch * f);
        ctx.lineTo(w - pad.right, pad.top + ch * f);
        ctx.stroke();
      }
      // Labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('+%', pad.left - 3, pad.top + 4);
      ctx.fillText('0', pad.left - 3, pad.top + ch / 2 + 3);
      ctx.fillText('−%', pad.left - 3, pad.top + ch + 3);
      ctx.textAlign = 'center';
      ctx.fillText('Period', w / 2, h - 4);
      ctx.globalAlpha = 1;
      return;
    }

    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;

    const values = periods.map(p => (p.meanPrice - p.fv) / p.fv);
    const absMax = Math.max(Math.abs(Math.min(...values)), Math.abs(Math.max(...values)), 0.05);
    const yScale = (v: number) => pad.top + ch / 2 - (v / absMax) * (ch / 2);
    const barW = Math.max(2, cw / periods.length - 2);
    const xAt = (i: number) => pad.left + (i + 0.5) * (cw / periods.length);

    // Zero line
    ctx.strokeStyle = 'var(--fg-3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(pad.left, yScale(0));
    ctx.lineTo(w - pad.right, yScale(0));
    ctx.stroke();
    ctx.setLineDash([]);

    // Bars
    values.forEach((v, i) => {
      const x = xAt(i) - barW / 2;
      const y0 = yScale(0);
      const y1 = yScale(v);
      ctx.fillStyle = v >= 0 ? '#3b82f6' : '#ef4444';
      ctx.fillRect(x, Math.min(y0, y1), barW, Math.abs(y1 - y0));
    });

    // Axes labels
    ctx.fillStyle = 'var(--fg-3)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(absMax.toFixed(2), pad.left - 3, pad.top + 4);
    ctx.fillText('0', pad.left - 3, yScale(0) + 3);
    ctx.fillText((-absMax).toFixed(2), pad.left - 3, h - pad.bottom + 4);
    ctx.textAlign = 'center';
    ctx.fillText('1', xAt(0), h - 4);
    ctx.fillText(String(periods.length), xAt(periods.length - 1), h - 4);
  }, [periods]);

  const canvasRef = useCanvas(draw, [periods]);

  return (
    <Figure
      figNum="2"
      title="Signed Mispricing"
      equation="\\rho_t = \\frac{P_t - FV_t}{FV_t}"
      note="Blue = premium above FV; red = discount below FV."
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '160px', display: 'block' }}
      />
    </Figure>
  );
}
