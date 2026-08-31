"use client";

/**
 * Minimal inline-SVG charts. Charts are secondary to the tables here, so these
 * are deliberately small and dependency-free rather than a charting library.
 *
 * The viewBox is a fixed 720x320 with the aspect ratio preserved, and the
 * container caps at 700px — the chart scales down responsively but never
 * stretches. (The previous 100-unit-wide viewBox with preserveAspectRatio
 * "none" distorted text and dots at any width other than 100px.)
 */

const W = 720;
const H = 320;
const AXIS = "#1e293b";
const MUTED = "#94a3b8";

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const step = v > 100 ? 50 : v > 40 ? 10 : 5;
  return Math.ceil(v / step) * step;
}

export function LineChart({
  points,
  projected,
  yLabel = "PPG",
}: {
  points: { x: number | string; y: number }[];
  projected?: { x: number | string; y: number };
  yLabel?: string;
}) {
  const all = projected ? [...points, projected] : points;
  if (all.length === 0) {
    return <p className="text-sm text-muted">No data.</p>;
  }

  const padL = 46;
  const padR = 24;
  const padB = 34;
  const padT = 16;
  const maxY = niceMax(Math.max(...all.map((p) => p.y)));
  const n = all.length;
  const xAt = (i: number) =>
    padL + (n === 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (n - 1));
  const yAt = (v: number) => padT + (1 - v / maxY) * (H - padT - padB);

  const linePts = points.map((p, i) => `${xAt(i)},${yAt(p.y)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full max-w-[700px]"
      role="img"
      aria-label={`${yLabel} by season`}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line
            x1={padL}
            x2={W - padR}
            y1={yAt(maxY * t)}
            y2={yAt(maxY * t)}
            stroke={AXIS}
            strokeWidth={1}
          />
          <text
            x={padL - 8}
            y={yAt(maxY * t) + 4}
            fontSize={12}
            fill={MUTED}
            textAnchor="end"
          >
            {Math.round(maxY * t)}
          </text>
        </g>
      ))}

      <polyline
        points={linePts}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={xAt(i)} cy={yAt(p.y)} r={4.5} fill="#3b82f6">
            <title>{`${p.x}: ${p.y.toFixed(1)} ${yLabel}`}</title>
          </circle>
          <text
            x={xAt(i)}
            y={H - 10}
            fontSize={12}
            fill={MUTED}
            textAnchor="middle"
          >
            {p.x}
          </text>
        </g>
      ))}

      {projected && (
        <g>
          <line
            x1={xAt(n - 2)}
            y1={yAt(points[points.length - 1]?.y ?? 0)}
            x2={xAt(n - 1)}
            y2={yAt(projected.y)}
            stroke="#f1c40f"
            strokeWidth={2}
            strokeDasharray="6 5"
          />
          <circle cx={xAt(n - 1)} cy={yAt(projected.y)} r={5.5} fill="#f1c40f">
            <title>{`${projected.x} projection: ${projected.y.toFixed(1)} ${yLabel}`}</title>
          </circle>
          <text
            x={xAt(n - 1)}
            y={H - 10}
            fontSize={12}
            fill="#f1c40f"
            textAnchor="middle"
          >
            {projected.x}
          </text>
        </g>
      )}
    </svg>
  );
}

export function BarChart({
  bars,
  average,
  diverging = false,
}: {
  bars: { label: string | number; value: number; hint?: string }[];
  average?: number;
  diverging?: boolean;
}) {
  if (!bars.length) return <p className="text-sm text-muted">No data.</p>;

  const padL = 42;
  const padR = 10;
  const padB = 30;
  const padT = 14;
  const vals = bars.map((b) => b.value);
  const maxAbs = Math.max(...vals.map(Math.abs), 1);
  const maxY = diverging ? niceMax(maxAbs) : niceMax(Math.max(...vals, 0));
  const minY = diverging ? -maxY : 0;
  const span = maxY - minY;
  const plotH = H - padT - padB;
  const yAt = (v: number) => padT + (1 - (v - minY) / span) * plotH;
  const bw = (W - padL - padR) / bars.length;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full max-w-[700px]"
      role="img"
      aria-label="Weekly values"
    >
      <line
        x1={padL}
        x2={W - padR}
        y1={yAt(0)}
        y2={yAt(0)}
        stroke={AXIS}
        strokeWidth={1.2}
      />
      <text x={padL - 6} y={yAt(maxY) + 4} fontSize={12} fill={MUTED} textAnchor="end">
        {Math.round(maxY)}
      </text>
      {diverging && (
        <text x={padL - 6} y={yAt(minY) + 2} fontSize={12} fill={MUTED} textAnchor="end">
          {Math.round(minY)}
        </text>
      )}

      {bars.map((b, i) => {
        const x = padL + i * bw + bw * 0.15;
        const w = bw * 0.7;
        const top = b.value >= 0 ? yAt(b.value) : yAt(0);
        const h = Math.max(2, Math.abs(yAt(b.value) - yAt(0)));
        const fill = diverging
          ? b.value > 0.5
            ? "#2ecc71"
            : b.value < -0.5
              ? "#e74c3c"
              : "#64748b"
          : b.value >= 20
            ? "#2ecc71"
            : b.value < 8
              ? "#e74c3c"
              : "#3b82f6";
        return (
          <g key={i}>
            <rect x={x} y={top} width={w} height={h} fill={fill} rx={2}>
              <title>{b.hint ?? `${b.label}: ${b.value}`}</title>
            </rect>
            {bars.length <= 22 && (
              <text
                x={x + w / 2}
                y={H - 8}
                fontSize={11}
                fill={MUTED}
                textAnchor="middle"
              >
                {b.label}
              </text>
            )}
          </g>
        );
      })}

      {average !== undefined && (
        <line
          x1={padL}
          x2={W - padR}
          y1={yAt(average)}
          y2={yAt(average)}
          stroke="#3b82f6"
          strokeWidth={1.5}
          strokeDasharray="8 6"
        />
      )}
    </svg>
  );
}
