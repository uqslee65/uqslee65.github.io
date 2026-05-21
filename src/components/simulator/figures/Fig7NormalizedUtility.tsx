import { useCallback } from 'react';
import { Figure } from '../Figure';
import { useSimulator } from '../SimulatorProvider';
import { useCanvas } from '../hooks/useCanvas';
import type { LLMPeriodRecord } from '../../../lib/sim/types';
import type { PeriodRecord } from '../../../lib/sim/engine';
import { FIGURE_TOOLTIPS } from '../../../lib/sim/tooltips';

const DEFAULT_RHO = 1; // log utility fallback

function crra(wealth: number, rho: number): number {
  if (rho === 1) return Math.log(Math.max(wealth, 1e-6));
  return Math.pow(Math.max(wealth, 1e-6), 1 - rho) / (1 - rho);
}

function agentColor(p: PeriodRecord | LLMPeriodRecord, ai: number): string {
  const a = p.agentStates[ai];
  if ('riskPref' in a) {
    const rp = (a as { riskPref: string }).riskPref;
    if (rp === 'risk-loving') return '#ef4444';
    if (rp === 'risk-neutral') return '#6b7280';
    return '#22c55e';
  }
  const rp2 = (a as { riskPref?: string }).riskPref;
  if (rp2 === 'risk-loving') return '#ef4444';
  if (rp2 === 'risk-neutral') return '#6b7280';
  return '#22c55e';
}

function agentRho(p: PeriodRecord | LLMPeriodRecord, ai: number): number {
  const a = p.agentStates[ai];
  if ('rho' in a) return (a as { rho: number }).rho;
  return DEFAULT_RHO;
}

export function Fig7NormalizedUtility() {
  const { activePeriods } = useSimulator();
  const periods = activePeriods ?? [];

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const pad = { top: 12, right: 12, bottom: 24, left: 44 };
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
      ctx.fillText('U/U₀', pad.left - 3, pad.top + 4);
      ctx.fillText('1.0', pad.left - 3, pad.top + ch / 2 + 3);
      ctx.fillText('0', pad.left - 3, pad.top + ch + 3);
      ctx.textAlign = 'center';
      ctx.fillText('Period', w / 2, h - 4);
      ctx.globalAlpha = 1;
      return;
    }
    const nAgents = periods[0].agentStates.length;

    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;

    // Compute wealth per agent per period: cash + shares * meanPrice
    const wealthSeries: number[][] = Array.from({ length: nAgents }, () => []);
    periods.forEach(p => {
      for (let ai = 0; ai < nAgents; ai++) {
        const a = p.agentStates[ai];
        wealthSeries[ai].push(a.cash + a.shares * p.meanPrice);
      }
    });

    // Initial wealth (period 0 snapshot) and rho
    const rhos = Array.from({ length: nAgents }, (_, ai) => agentRho(periods[0], ai));
    const u0 = wealthSeries.map((ws, ai) => crra(ws[0], rhos[ai]));

    // Normalized utility series
    const utilSeries = wealthSeries.map((ws, ai) =>
      ws.map(w => crra(w, rhos[ai]) / (Math.abs(u0[ai]) + 1e-10))
    );

    const allU = utilSeries.flat();
    const yMin = Math.min(...allU, 0.5) * 0.9;
    const yMax = Math.max(...allU, 1.5) * 1.05;

    const xScale = (i: number) =>
      pad.left + (periods.length > 1 ? (i / (periods.length - 1)) * cw : cw / 2);
    const yScale = (v: number) => pad.top + ch - ((v - yMin) / (yMax - yMin)) * ch;

    // Baseline at 1.0
    ctx.strokeStyle = 'var(--fg-3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(pad.left, yScale(1));
    ctx.lineTo(w - pad.right, yScale(1));
    ctx.stroke();
    ctx.setLineDash([]);

    // Utility lines
    for (let ai = 0; ai < nAgents; ai++) {
      ctx.strokeStyle = agentColor(periods[0], ai);
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      utilSeries[ai].forEach((u, pi) => {
        const x = xScale(pi);
        const y = yScale(u);
        if (pi === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Labels
    ctx.fillStyle = 'var(--fg-3)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(yMax.toFixed(1), pad.left - 3, pad.top + 4);
    ctx.fillText('1.0', pad.left - 3, yScale(1) + 3);
    ctx.fillText(yMin.toFixed(1), pad.left - 3, pad.top + ch + 3);
    ctx.textAlign = 'center';
    ctx.fillText('1', xScale(0), h - 4);
    ctx.fillText(String(periods.length), xScale(periods.length - 1), h - 4);
  }, [periods]);

  const canvasRef = useCanvas(draw, [periods]);

  return (
    <Figure
      figNum="7"
      title="Normalized CRRA Utility"
      titleTooltip={FIGURE_TOOLTIPS['fig7']}
      equation="U(w;\\rho) = \\frac{w^{1-\\rho}}{1-\\rho}"
      note="Normalized by initial period utility. Red=risk-loving, gray=neutral, green=averse."
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: 'var(--fig-canvas-h, 160px)', display: 'block' }} />
    </Figure>
  );
}
