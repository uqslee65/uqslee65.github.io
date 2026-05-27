import { useCallback } from 'react';
import { Figure } from '../Figure';
import { useSimulator } from '../SimulatorProvider';
import { useCanvas } from '../hooks/useCanvas';
import type { LLMPeriodRecord } from '../../../lib/sim/types';
import { FIGURE_TOOLTIPS } from '../../../lib/sim/tooltips';

export function Fig10TrustMatrix() {
  const { currentPeriod, config } = useSimulator();

  // trustMatrix only exists on LLMPeriodRecord
  const hasTrust = !!currentPeriod && 'trustMatrix' in currentPeriod
    && Array.isArray((currentPeriod as LLMPeriodRecord).trustMatrix)
    && (currentPeriod as LLMPeriodRecord).trustMatrix.length > 0;

  const matrix = hasTrust ? (currentPeriod as LLMPeriodRecord).trustMatrix : null;

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const pad = { top: 14, right: 14, bottom: 14, left: 14 };
    if (!matrix) {
      // Ghost: empty NxN grid outline
      const n = config.nAgents;
      const size = Math.min(w - pad.left - pad.right, h - pad.top - pad.bottom);
      const cell = size / n;
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 0.5;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const x = pad.left + c * cell;
          const y = pad.top + r * cell;
          ctx.strokeRect(x, y, cell - 1, cell - 1);
        }
      }
      // Row/col labels if space allows
      if (cell >= 14) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        for (let i = 0; i < n; i++) {
          ctx.fillText(String(i), pad.left + (i + 0.5) * cell, pad.top - 3);
        }
      }
      ctx.globalAlpha = 1;
      return;
    }
    const n = matrix.length;

    const size = Math.min(w - pad.left - pad.right, h - pad.top - pad.bottom);
    const cell = size / n;

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const x = pad.left + c * cell;
        const y = pad.top + r * cell;
        if (r === c) {
          ctx.fillStyle = '#d1d5db'; // diagonal masked (light-theme safe: visible gray on white canvas)
        } else {
          const t = matrix[r][c]; // [0,1]
          const blue = Math.round(t * 220 + (1 - t) * 30);
          ctx.fillStyle = `rgb(10,${Math.round(t * 60 + 30)},${blue})`;
        }
        ctx.fillRect(x, y, cell - 1, cell - 1);
      }
    }

    // Row/col index labels if space allows
    if (cell >= 14) {
      ctx.fillStyle = 'var(--fg-3)';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      for (let i = 0; i < n; i++) {
        ctx.fillText(String(i), pad.left + (i + 0.5) * cell, pad.top - 3);
      }
    }
  }, [matrix, config.nAgents]);

  const canvasRef = useCanvas(draw, [matrix, config.nAgents]);

  return (
    <Figure
      figNum="10"
      title="Trust Matrix"
      titleTooltip={FIGURE_TOOLTIPS['fig10']}
      equation="\\tau_{r \\to s} \\leftarrow (1 - \\lambda)\\tau_{r \\to s} + \\lambda \\cdot \\text{closeness}_{rs}"
      note="Light = low trust, dark = high trust. Diagonal masked."
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: 'var(--fig-canvas-h, 160px)', display: 'block' }} />
    </Figure>
  );
}
