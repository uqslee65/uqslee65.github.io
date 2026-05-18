import { useCallback } from 'react';
import { Figure } from '../Figure';
import { useSimulator } from '../SimulatorProvider';
import { useCanvas } from '../hooks/useCanvas';

const MUTED_COLORS = ['#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16','#ef4444'];

export function Fig8AssetOwnership() {
  const { activePeriods } = useSimulator();
  const periods = activePeriods ?? [];

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const pad = { top: 10, right: 12, bottom: 24, left: 36 };
    if (periods.length === 0) {
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
      ctx.fillText('Shares', pad.left - 3, pad.top + 4);
      ctx.fillText('0', pad.left - 3, pad.top + ch + 3);
      ctx.textAlign = 'center';
      ctx.fillText('Period', w / 2, h - 4);
      ctx.globalAlpha = 1;
      return;
    }
    const nAgents = periods[0].agentStates.length;

    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;

    // Total shares (should be conserved)
    const totalShares = periods[0].agentStates.reduce((s, a) => s + a.shares, 0);
    if (totalShares === 0) return;

    const barW = cw / periods.length;

    periods.forEach((p, pi) => {
      let yOffset = pad.top + ch;
      for (let ai = 0; ai < nAgents; ai++) {
        const agentShares = p.agentStates[ai].shares;
        const segH = (agentShares / totalShares) * ch;
        ctx.fillStyle = MUTED_COLORS[ai % MUTED_COLORS.length];
        ctx.globalAlpha = 0.8;
        ctx.fillRect(pad.left + pi * barW, yOffset - segH, barW - 1, segH);
        yOffset -= segH;
      }
    });
    ctx.globalAlpha = 1;

    // Labels
    ctx.fillStyle = 'var(--fg-3)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(totalShares), pad.left - 3, pad.top + 4);
    ctx.fillText('0', pad.left - 3, pad.top + ch + 3);
    ctx.textAlign = 'center';
    ctx.fillText('1', pad.left + barW / 2, h - 4);
    ctx.fillText(String(periods.length), pad.left + (periods.length - 0.5) * barW, h - 4);
  }, [periods]);

  const canvasRef = useCanvas(draw, [periods]);

  return (
    <Figure
      figNum="8"
      title="Asset Ownership"
      note="Stacked area: each color = one agent's share holdings. Total height = aggregate shares (conserved)."
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '160px', display: 'block' }} />
    </Figure>
  );
}
