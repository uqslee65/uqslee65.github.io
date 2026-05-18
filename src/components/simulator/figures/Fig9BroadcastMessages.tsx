import { useCallback } from 'react';
import { Figure } from '../Figure';
import { useSimulator } from '../SimulatorProvider';
import { useCanvas } from '../hooks/useCanvas';

/**
 * Fig 9: Broadcast Messages (Plan I only in spirit, but data field doesn't exist yet).
 * Gates on actual data presence — always shows ghost skeleton until the field is added.
 */
export function Fig9BroadcastMessages() {
  const { activePeriods, config } = useSimulator();
  const periods = activePeriods ?? [];

  // No broadcast field exists on either PeriodRecord or LLMPeriodRecord yet.
  // When added, check: 'broadcastMessages' in (periods[0] ?? {})
  const hasData = false;

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const pad = { top: 10, right: 12, bottom: 24, left: 60 };
    const nAgents = config.nAgents;
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
    // Agent rows with labels (dot-matrix skeleton)
    const cellH = ch / nAgents;
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
    ctx.textAlign = 'center';
    ctx.fillText('Period', w / 2, h - 4);
    ctx.globalAlpha = 1;
  }, [config.nAgents]);

  const canvasRef = useCanvas(draw, [config.nAgents]);

  // Future: render dot matrix when broadcastMessages field exists and hasData is true
  void hasData; // suppress unused variable

  return (
    <Figure figNum="9" title="Broadcast Messages" note="Dot matrix: rows=agents, columns=periods. Red ring = deceptive message.">
      <canvas ref={canvasRef} style={{ width: '100%', height: '160px', display: 'block' }} />
    </Figure>
  );
}
