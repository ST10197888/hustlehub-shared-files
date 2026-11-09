import { useState } from "react";
import type { MonthlyEarning } from "../types/models";
import { formatRand } from "../utils/money";

interface IncomeChartProps {
  data: MonthlyEarning[];
  taxYear: string;
}

const WIDTH = 720;
const HEIGHT = 280;
const PAD = { top: 16, right: 12, bottom: 44, left: 12 };

/** Picks a tidy upper bound (1, 2, 5 x 10^n) for the tallest bar. */
function niceMax(value: number): number {
  if (value <= 0) return 100;
  const power = 10 ** Math.floor(Math.log10(value));
  const fraction = value / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

function IncomeChart({ data, taxYear }: IncomeChartProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const safe = (data || []).map((item) => ({
    ...item,
    amount: Number.isFinite(item.amount) && item.amount > 0 ? item.amount : 0,
  }));
  const total = safe.reduce((sum, item) => sum + item.amount, 0);

  if (safe.length === 0 || total === 0) {
    return (
      <div className="chart-empty" role="status">
        <p><strong>No earnings to chart yet</strong></p>
        <p className="muted">Income from confirmed bookings in {taxYear} will appear here, month by month.</p>
      </div>
    );
  }

  const max = niceMax(Math.max(...safe.map((item) => item.amount)));
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotWidth / safe.length;
  const barWidth = Math.min(40, slot * 0.62);
  const active = safe.find((item) => item.month === selected) || null;

  return (
    <figure className="income-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Monthly earnings for the ${taxYear} tax year`}
        preserveAspectRatio="xMidYMid meet"
      >
        {[0.25, 0.5, 0.75, 1].map((step) => (
          <line
            key={step}
            className="chart-grid"
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={PAD.top + plotHeight * (1 - step)}
            y2={PAD.top + plotHeight * (1 - step)}
          />
        ))}
        <line className="chart-axis" x1={PAD.left} x2={WIDTH - PAD.right} y1={PAD.top + plotHeight} y2={PAD.top + plotHeight} />
        {safe.map((item, index) => {
          const height = (item.amount / max) * plotHeight;
          const x = PAD.left + slot * index + (slot - barWidth) / 2;
          const y = PAD.top + plotHeight - height;
          const isActive = item.month === selected;
          return (
            <g
              key={item.month}
              className={`chart-bar${isActive ? " chart-bar-active" : ""}`}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              aria-label={`${item.label}: ${formatRand(item.amount)}`}
              onClick={() => setSelected(isActive ? null : item.month)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelected(isActive ? null : item.month);
                }
              }}
            >
              <rect className="chart-hit" x={x - (slot - barWidth) / 2} y={PAD.top} width={slot} height={plotHeight} />
              <rect className="chart-rect" x={x} y={item.amount > 0 ? y : PAD.top + plotHeight - 2} width={barWidth} height={item.amount > 0 ? height : 2} rx={4} />
              <text className="chart-label" x={x + barWidth / 2} y={HEIGHT - 20} textAnchor="middle">
                {item.label.split(" ")[0]}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="chart-caption" aria-live="polite">
        {active
          ? <><strong>{active.label}</strong>: {formatRand(active.amount)}</>
          : <span className="muted">Select a month to see its earnings. Scale tops out at {formatRand(max)}.</span>}
      </figcaption>
    </figure>
  );
}

export default IncomeChart;
