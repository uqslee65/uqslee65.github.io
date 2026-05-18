import { useCallback } from 'react';
import { Figure } from '../Figure';
import { useSimulator } from '../SimulatorProvider';
import { useCanvas } from '../hooks/useCanvas';

const AGENT_COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#a855f7','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16'];

export function Fig6SubjectiveValuation() {
  const { activePeriods } = useSimulator();
  const periods = activePeriods ?? [];

  // Check whether belief data exists
  const hasBelief = periods.length > 0 && periods[0].agentStates.length > 0
    && 'belief' in periods[0].agentStates[0];

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const pad = { top: 12, right: 12, bottom: 24, left: 44 };
    if (periods.length === 0 || !hasBelief) {
      const ch = h - pad.top - pad.bottom;
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, pad.top + ch);
      ctx.lineTo(w - pad.right, pad.top + ch);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pad.left, pad.top);
      ctx.lineTo(pad.left, pad.top + ch);
      ctx.stroke();
      ctx.setLineDash([3, 3]);
      for (const f of [0.25, 0.5, 0.75]) {
        ctx.beginPath();
        ctx.moveTo(pad.left, pad.top + ch * f);
        ctx.lineTo(w - pad.right, pad.top + ch * f);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('Value', pad.left - 3, pad.top + 4);
      ctx.fillText('0', pad.left - 3, pad.top + ch + 3);
      ctx.textAlign = 'center';
      ctx.fillText('Period', w / 2, h - 4);
      ctx.globalAlpha = 1;
      return;
    }
    const nAgents = periods[0].agentStates.length;

    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;

    // Gather all belief values + FVs for y range
    const allVals: number[] = periods.flatMap(p =>
      p.agentStates.map((a: { belief: number }) => a.belief)
    ).concat(periods.map(p => p.fv));
    const yMin = Math.min(...allVals) * 0.9;
    const yMax = Math.max(...allVals) * 1.1;

    const xScale = (i: number) =>
      pad.left + (periods.length > 1 ? (i / (periods.length - 1)) * cw : cw / 2);
    const yScale = (v: number) => pad.top + ch - ((v - yMin) / (yMax - yMin)) * ch;

    // FV staircase (amber dashed)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    periods.forEach((p, i) => {
      const x1 = xScale(i);
      const x2 = i < periods.length - 1 ? xScale(i + 1) : x1;
      const y = yScale(p.fv);
      ctx.beginPath();
      if (i === 0) ctx.moveTo(x1, y); else ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Per-agent belief lines
    for (let ai = 0; ai < nAgents; ai++) {
      ctx.strokeStyle = AGENT_COLORS[ai % AGENT_COLORS.length];
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      periods.forEach((p, pi) => {
        const belief = (p.agentStates[ai] as { belief: number }).belief;
        const x = xScale(pi);
        const y = yScale(belief);
        if (pi === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Axis labels
    ctx.fillStyle = 'var(--fg-3)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.round(yMax)), pad.left - 3, pad.top + 4);
    ctx.fillText(String(Math.round(yMin)), pad.left - 3, pad.top + ch + 3);
    ctx.textAlign = 'center';
    ctx.fillText('1', xScale(0), h - 4);
    ctx.fillText(String(periods.length), xScale(periods.length - 1), h - 4);
  }, [periods, hasBelief]);

  const canvasRef = useCanvas(draw, [periods, hasBelief]);

  return (
    <Figure
      figNum="6"
      title="Subjective Valuation"
      note="Each line = one agent's belief. Amber dashed = fundamental value."
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '240px', display: 'block' }} />
    </Figure>
  );
}
