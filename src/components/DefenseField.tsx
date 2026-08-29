"use client";

/**
 * SVG football field showing a defensive alignment: the mirror of
 * FormationField. The line of scrimmage sits at the same height and the
 * defense deploys ABOVE it, so depth reads upward — DL on the ball, LBs at
 * the second level, corners out wide, safeties deep near the top.
 *
 * There are no player names by design: participation data says which package
 * a defense ran, not which defenders were in it. Dots carry position labels
 * derived from the front (DE/DT/NT, MLB/OLB/ILB, CB/FS/SS).
 *
 * `front` is the package's actual average front rounded to integers by the
 * caller — a Nickel renders as 4-2-5 for one team and 2-4-5 for another.
 */

const W = 500;
const H = 600;
const LOS = 310;
const CX = 250;

const STYLE: Record<string, { r: number; fill: string }> = {
  DL: { r: 18, fill: "#e74c3c" },
  LB: { r: 18, fill: "#f39c12" },
  CB: { r: 17, fill: "#3498db" },
  S: { r: 17, fill: "#2ecc71" },
};

type Dot = { x: number; y: number; label: string; kind: keyof typeof STYLE };

/** Spread n points symmetrically around cx with the given gap. */
function spread(n: number, cx: number, gap: number): number[] {
  return Array.from({ length: n }, (_, i) => cx + (i - (n - 1) / 2) * gap);
}

function dlLabels(n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return ["NT"];
  if (n === 2) return ["DT", "DT"];
  if (n === 3) return ["DE", "NT", "DE"];
  if (n === 4) return ["DE", "DT", "DT", "DE"];
  return ["DE", "DT", "NT", "DT", "DE"].concat(Array(Math.max(0, n - 5)).fill("DT")).slice(0, n);
}

function lbLabels(n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return ["MLB"];
  if (n === 2) return ["ILB", "ILB"];
  if (n === 3) return ["OLB", "MLB", "OLB"];
  return ["OLB", "ILB", "ILB", "OLB"].concat(Array(Math.max(0, n - 4)).fill("LB")).slice(0, n);
}

export default function DefenseField({
  front,
  shell,
  packageLabel,
}: {
  front: { dl: number; lb: number; db: number };
  shell: string | null;
  packageLabel: string;
}) {
  const dl = Math.max(0, Math.min(front.dl, 7));
  const lb = Math.max(0, Math.min(front.lb, 5));
  const db = Math.max(0, Math.min(front.db, 8));

  const dots: Dot[] = [];

  // Defensive line: on the ball, mirroring the OL spacing.
  dlLabels(dl).forEach((label, i) => {
    dots.push({ x: spread(dl, CX, 46)[i], y: LOS - 26, label, kind: "DL" });
  });

  // Linebackers: second level.
  lbLabels(lb).forEach((label, i) => {
    dots.push({ x: spread(lb, CX, 78)[i], y: LOS - 92, label, kind: "LB" });
  });

  // Secondary. Safeties come off the top of the DB count by shell, corners
  // take the boundaries, leftovers play the slots.
  const safeties = db >= 2 && shell === "2-High" ? 2 : db >= 1 ? 1 : 0;
  let remaining = db - safeties;
  const corners = Math.min(2, remaining);
  remaining -= corners;

  if (corners >= 1) dots.push({ x: 52, y: LOS - 30, label: "CB", kind: "CB" });
  if (corners >= 2) dots.push({ x: 448, y: LOS - 30, label: "CB", kind: "CB" });

  // Slot DBs: nickel right, then left, then shallow middle.
  const slotSpots = [
    { x: 396, y: LOS - 52 },
    { x: 104, y: LOS - 52 },
    { x: CX, y: LOS - 130 },
    { x: 175, y: LOS - 130 },
    { x: 325, y: LOS - 130 },
    { x: CX - 60, y: LOS - 52 },
  ];
  for (let i = 0; i < remaining && i < slotSpots.length; i++) {
    dots.push({ ...slotSpots[i], label: "CB", kind: "CB" });
  }

  // Safeties: two high splits the deep halves; one high centers, and against
  // a loaded box the strong safety is already counted down in the slots.
  if (safeties === 2) {
    dots.push({ x: 165, y: 96, label: "FS", kind: "S" });
    dots.push({ x: 335, y: 96, label: "SS", kind: "S" });
  } else if (safeties === 1) {
    dots.push({ x: CX, y: 84, label: "FS", kind: "S" });
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full max-w-[500px]"
      role="img"
      aria-label={`${packageLabel} defense, ${dl}-${lb}-${db} front${shell ? `, ${shell}` : ""}`}
    >
      <defs>
        <linearGradient id="df-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#153a22" />
          <stop offset="45%" stopColor="#1a472a" />
          <stop offset="100%" stopColor="#1d5233" />
        </linearGradient>
        <clipPath id="df-clip">
          <rect x={8} y={8} width={W - 16} height={H - 16} rx={14} />
        </clipPath>
      </defs>

      <rect
        x={8}
        y={8}
        width={W - 16}
        height={H - 16}
        rx={14}
        fill="url(#df-grass)"
        stroke="var(--color-border)"
        strokeWidth={1.5}
      />

      <g clipPath="url(#df-clip)">
        {Array.from({ length: 15 }).map((_, i) => {
          const y = 8 + i * 40;
          return (
            <g key={i}>
              {i % 2 === 0 && (
                <rect x={8} y={y} width={W - 16} height={40} fill="rgba(255,255,255,0.02)" />
              )}
              <line x1={8} x2={W - 8} y1={y} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
            </g>
          );
        })}
        {[185, 315].map((hx) =>
          Array.from({ length: 29 }).map((_, i) => (
            <line
              key={`${hx}-${i}`}
              x1={hx - 5}
              x2={hx + 5}
              y1={28 + i * 20}
              y2={28 + i * 20}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1.5}
            />
          )),
        )}
        <line
          x1={8}
          x2={W - 8}
          y1={LOS}
          y2={LOS}
          stroke="#facc15"
          strokeWidth={2}
          strokeDasharray="10 7"
          opacity={0.65}
        />
        {/* Ghost of the offense the defense is aligned against */}
        {[170, 210, 250, 290, 330].map((x) => (
          <circle key={x} cx={x} cy={LOS + 18} r={13} fill="rgba(255,255,255,0.06)" />
        ))}
      </g>

      {dots.map((d, i) => {
        const { r, fill } = STYLE[d.kind];
        return (
          <g key={i} className="ff-player" style={{ transformOrigin: `${d.x}px ${d.y}px` }}>
            <title>{d.label}</title>
            <circle cx={d.x} cy={d.y} r={r} fill={fill} stroke="rgba(0,0,0,0.35)" strokeWidth={1.5} />
            <text
              x={d.x}
              y={d.y + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={d.label.length > 2 ? 10 : 11}
              fontWeight={700}
              fill="#fff"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
