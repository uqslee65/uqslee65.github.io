import { useCallback } from 'react';
import { Figure } from '../Figure';
import { useSimulator } from '../SimulatorProvider';
import { useCanvas } from '../hooks/useCanvas';
import type { LLMPeriodRecord } from '../../../lib/sim/types';
import type { PeriodRecord } from '../../../lib/sim/engine';
import { FIGURE_TOOLTIPS } from '../../../lib/sim/tooltips';

const AGENT_COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#a855f7','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16'];

function agentColor(p: PeriodRecord | LLMPeriodRecord, ai: number): string {
  const a = p.agentStates[ai];
  if ('riskPref' in a) {
    const rp = (a as { riskPref: string }).riskPref;
    if (rp === 'risk-loving') return '#ef4444';
    if (rp === 'risk-neutral') return '#6b7280';
    return '#22c55e';
  }
  const t = (a as { type: string }).type;
  if (t === 'speculator') return '#ef4444';
  if (t === 'moderate') return '#6b7280';
  return '#22c55e';
}

export function Fig11PerAgentPnL() {
  const { activePeriods } = useSimulator();
  const periods = activePeriods ?? [];

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const pad = { top: 12, right: 12, bottom: 24, left: 48 };
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
      ctx.fillText('+P&L', pad.left - 3, pad.top + 4);
      ctx.fillText('0', pad.left - 3, pad.top + ch / 2 + 3);
      ctx.fillText('−P&L', pad.left - 3, pad.top + ch + 3);
      ctx.textAlign = 'center';
      ctx.fillText('Period', w / 2, h - 4);
      ctx.globalAlpha = 1;
      return;
    }
    const nAgents = periods[0].agentStates.length;

    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;

    // Compute wealth per agent per period
    const wealthSeries: number[][] = Array.from({ length: nAgents }, () => []);
    periods.forEach(p => {
      for (let ai = 0; ai < nAgents; ai++) {
        const a = p.agentStates[ai];
        wealthSeries[ai].push(a.cash + a.shares * p.meanPrice);
      }
    });

    // PnL = wealth_t - wealth_0
    const w0 = wealthSeries.map(ws => ws[0]);
    const pnlSeries = wealthSeries.map((ws, ai) => ws.map(wt => wt - w0[ai]));

    const allPnl = pnlSeries.flat();
    const yMin = Math.min(...allPnl, -1);
    const yMax = Math.max(...allPnl, 1);

    const xScale = (i: number) =>
      pad.left + (periods.length > 1 ? (i / (periods.length - 1)) * cw : cw / 2);
    const yScale = (v: number) => pad.top + ch - ((v - yMin) / (yMax - yMin)) * ch;

    // Zero baseline
    ctx.strokeStyle = 'var(--fg-3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(pad.left, yScale(0));
    ctx.lineTo(w - pad.right, yScale(0));
    ctx.stroke();
    ctx.setLineDash([]);

    // Per-agent lines (fan chart stub: use lines for any N)
    // TODO: fan chart with P10/P25/P50/P75/P90 bands when N > 60
    const useLines = nAgents <= 60;
    if (useLines) {
      for (let ai = 0; ai < nAgents; ai++) {
        ctx.strokeStyle = nAgents <= 12
          ? agentColor(periods[0], ai)
          : AGENT_COLORS[ai % AGENT_COLORS.length];
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        pnlSeries[ai].forEach((pnl, pi) => {
          const x = xScale(pi);
          const y = yScale(pnl);
          if (pi === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Labels
    ctx.fillStyle = 'var(--fg-3)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.round(yMax)), pad.left - 3, pad.top + 4);
    ctx.fillText('0', pad.left - 3, yScale(0) + 3);
    ctx.fillText(String(Math.round(yMin)), pad.left - 3, pad.top + ch + 3);
    ctx.textAlign = 'center';
    ctx.fillText('1', xScale(0), h - 4);
    ctx.fillText(String(periods.length), xScale(periods.length - 1), h - 4);
  }, [periods]);

  const canvasRef = useCanvas(draw, [periods]);

  return (
    <Figure
      figNum="11"
      title="Per-Agent P&L"
      titleTooltip={FIGURE_TOOLTIPS['fig11']}
      note="Running P&L = current wealth − initial wealth. Dashed = breakeven. Colors: red=risk-loving/speculator, gray=neutral/moderate, green=averse/aware."
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: 'var(--fig-canvas-h, 240px)', display: 'block' }} />
    </Figure>
  );
}
