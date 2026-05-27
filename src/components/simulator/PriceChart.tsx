import { useSimulator } from './SimulatorProvider';
import { Figure } from './Figure';
import { resolveAssetData } from '../../lib/sim/assetHelpers';

export function PriceChart() {
  const { roundPeriods, roundIdx, selectedAssetIdx } = useSimulator();

  const width = 600;
  const height = 260;
  const pad = { top: 20, right: 20, bottom: 30, left: 45 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  const periods = roundPeriods;
  const currentIdx = roundIdx >= 0 ? roundIdx : 0;
  const visible = periods.slice(0, currentIdx + 1);

  if (visible.length === 0) {
    // Ghost: full SVG skeleton with axes, grid, labels — no data paths
    const ghostYMax = 100;
    const ghostYMin = 0;
    const ghostGridVals = [25, 50, 75];
    const ghostYScale = (v: number) =>
      pad.top + h - ((v - ghostYMin) / (ghostYMax - ghostYMin)) * h;
    return (
      <Figure figNum="1a" title="Price Path">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', opacity: 0.4 }}
        >
          {/* Grid lines */}
          {ghostGridVals.map((v, i) => (
            <line
              key={i}
              x1={pad.left} x2={width - pad.right}
              y1={ghostYScale(v)} y2={ghostYScale(v)}
              stroke="#94a3b8" strokeDasharray="3,3"
            />
          ))}
          {/* X axis */}
          <line
            x1={pad.left} x2={width - pad.right}
            y1={pad.top + h} y2={pad.top + h}
            stroke="#94a3b8" strokeWidth="1"
          />
          {/* Y axis */}
          <line
            x1={pad.left} x2={pad.left}
            y1={pad.top} y2={pad.top + h}
            stroke="#94a3b8" strokeWidth="1"
          />
          {/* X-axis labels */}
          <text x={pad.left} y={height - 5} fontSize="10" fill="#94a3b8">Period 1</text>
          <text x={width - pad.right} y={height - 5} fontSize="10" fill="#94a3b8" textAnchor="end">Period N</text>
          {/* Y-axis labels */}
          <text x={pad.left - 5} y={pad.top + 5} fontSize="10" fill="#94a3b8" textAnchor="end">100</text>
          <text x={pad.left - 5} y={pad.top + h} fontSize="10" fill="#94a3b8" textAnchor="end">0</text>
          {/* Legend */}
          <text x={width / 2} y={height - 5} fontSize="10" fill="#94a3b8" textAnchor="middle">
            <tspan>--- Price</tspan>
            {'  '}
            <tspan>- - FV</tspan>
          </text>
        </svg>
      </Figure>
    );
  }

  const allPrices = periods.map(p => resolveAssetData(p, selectedAssetIdx).meanPrice);
  const allFVs = periods.map(p => resolveAssetData(p, selectedAssetIdx).fv);
  const yMin = Math.min(...allPrices, ...allFVs) * 0.85;
  const yMax = Math.max(...allPrices, ...allFVs) * 1.15;

  const xScale = (i: number) =>
    pad.left + (periods.length > 1 ? (i / (periods.length - 1)) * w : w / 2);
  const yScale = (v: number) =>
    pad.top + h - ((v - yMin) / (yMax - yMin)) * h;

  const fvPath = periods.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(resolveAssetData(p, selectedAssetIdx).fv)}`
  ).join(' ');
  const pricePath = visible.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(resolveAssetData(p, selectedAssetIdx).meanPrice)}`
  ).join(' ');

  const gridLines = [0.25, 0.5, 0.75].map(f => yMin + f * (yMax - yMin));

  return (
    <Figure figNum="1a" title="Price Path">
      <svg
        data-testid="price-chart"
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto' }}
      >
        {gridLines.map((v, i) => (
          <line
            key={i}
            x1={pad.left} x2={width - pad.right}
            y1={yScale(v)} y2={yScale(v)}
            stroke="var(--border)" strokeDasharray="3,3"
          />
        ))}
        <path data-testid="fv-path" d={fvPath} fill="none" stroke="var(--fg-3)" strokeWidth="1.5" strokeDasharray="5,3" />
        <path d={pricePath} fill="none" stroke="var(--accent)" strokeWidth="2" />
        {visible.length > 0 && (
          <circle
            cx={xScale(currentIdx)}
            cy={yScale(resolveAssetData(visible[currentIdx], selectedAssetIdx).meanPrice)}
            r="4"
            fill="var(--accent)"
          />
        )}
        <text x={pad.left} y={height - 5} fontSize="10" fill="var(--fg-3)">Period 1</text>
        <text x={width - pad.right} y={height - 5} fontSize="10" fill="var(--fg-3)" textAnchor="end">
          Period {periods.length}
        </text>
        <text x={pad.left - 5} y={pad.top + 5} fontSize="10" fill="var(--fg-3)" textAnchor="end">
          {Math.round(yMax)}
        </text>
        <text x={pad.left - 5} y={pad.top + h} fontSize="10" fill="var(--fg-3)" textAnchor="end">
          {Math.round(yMin)}
        </text>
        <text x={width / 2} y={height - 5} fontSize="10" fill="var(--fg-2)" textAnchor="middle">
          <tspan fill="var(--accent)">--- Price</tspan>
          {'  '}
          <tspan fill="var(--fg-3)">- - FV</tspan>
        </text>
      </svg>
    </Figure>
  );
}
