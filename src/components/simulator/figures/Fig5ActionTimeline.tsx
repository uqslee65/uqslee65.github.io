import { useCallback } from 'react';
import { Figure } from '../Figure';
import { useSimulator } from '../SimulatorProvider';
import { useCanvas } from '../hooks/useCanvas';
import type { LLMPeriodRecord } from '../../../lib/sim/types';
import type { PeriodRecord } from '../../../lib/sim/engine';
import { FIGURE_TOOLTIPS } from '../../../lib/sim/tooltips';

// Color for LLM actions
function actionColor(action: string | null): string {
  switch (action) {
    case 'BUY_NOW': return '#22c55e';
    case 'SELL_NOW': return '#ef4444';
    case 'BID':     return '#93c5fd';
    case 'ASK_1':   return '#fb923c';
    case 'HOLD':
    default:        return '#6b7280';
  }
}

// Color for Plan I agent types
function typeColor(type: string): string {
  switch (type) {
    case 'speculator': return '#ef4444';
    case 'moderate':   return '#6b7280';
    case 'aware':      return '#22c55e';
    default:           return '#6b7280';
  }
}

function isLLMPeriod(p: PeriodRecord | LLMPeriodRecord): p is LLMPeriodRecord {
  return 'agentStates' in p && Array.isArray((p as LLMPeriodRecord).agentStates)
    && (p as LLMPeriodRecord).agentStates.length > 0
    && 'lastAction' in (p as LLMPeriodRecord).agentStates[0];
}

export function Fig5ActionTimeline() {
  const { activePeriods, config } = useSimulator();
  const periods = activePeriods ?? [];

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const pad = { top: 10, right: 12, bottom: 24, left: 60 };
    if (periods.length === 0) {
      const nAgents = config.nAgents;
      const ch = h - pad.top - pad.bottom;
      const cellH = ch / nAgents;
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
      // Horizontal agent row dividers + labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'right';
      for (let ai = 0; ai < Math.min(nAgents, 12); ai++) {
        const y = pad.top + (ai + 0.5) * cellH;
        ctx.fillText(`A${ai}`, pad.left - 4, y + 3);
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(pad.left, pad.top + ai * cellH);
        ctx.lineTo(w - pad.right, pad.top + ai * cellH);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // X label
      ctx.textAlign = 'center';
      ctx.fillText('Period', w / 2, h - 4);
      ctx.globalAlpha = 1;
      return;
    }
    const nAgents = periods[0].agentStates.length;
    if (nAgents === 0) return;

    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;
    const dotR = Math.min(6, Math.min(cw / periods.length, ch / nAgents) / 2 - 1);
    const cellW = cw / periods.length;
    const cellH = ch / nAgents;

    periods.forEach((p, pi) => {
      const llm = isLLMPeriod(p);
      p.agentStates.forEach((agent, ai) => {
        const cx = pad.left + (pi + 0.5) * cellW;
        const cy = pad.top + (ai + 0.5) * cellH;
        if (llm) {
          const a = (p as LLMPeriodRecord).agentStates[ai];
          ctx.fillStyle = actionColor(a.lastAction);
        } else {
          const a = (p as PeriodRecord).agentStates[ai];
          ctx.fillStyle = typeColor(a.type);
        }
        ctx.beginPath();
        ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // Agent labels
    ctx.fillStyle = 'var(--fg-3)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    for (let ai = 0; ai < Math.min(nAgents, 12); ai++) {
      ctx.fillText(`A${ai}`, pad.left - 4, pad.top + (ai + 0.5) * cellH + 3);
    }
    // Period labels
    ctx.textAlign = 'center';
    ctx.fillText('1', pad.left + cellW / 2, h - 4);
    ctx.fillText(String(periods.length), pad.left + (periods.length - 0.5) * cellW, h - 4);
  }, [periods, config.nAgents]);

  const canvasRef = useCanvas(draw, [periods, config.nAgents]);

  return (
    <Figure
      figNum="5"
      title="Agent Action Timeline"
      titleTooltip={FIGURE_TOOLTIPS['fig5']}
      note="LLM: green=BUY, red=SELL, blue=BID, orange=ASK, gray=HOLD. Plan I: red=speculator, gray=moderate, green=aware."
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: 'var(--fig-canvas-h, 240px)', display: 'block' }} />
    </Figure>
  );
}
