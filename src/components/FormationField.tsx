"use client";

import { RosterPlayer } from "@/lib/api";

/**
 * SVG football field that arranges a team's actual players into a formation.
 *
 * Positions are approximate X's-and-O's placement, not tracking data: the OL
 * anchors the line of scrimmage, QB depth encodes the formation, and skill
 * players fill anchor slots in a fixed priority order based on the personnel
 * grouping (first digit RB, second digit TE, WR = 5 - RB - TE).
 *
 * The data carries legacy formations too (SINGLEBACK, I_FORM, EMPTY, JUMBO,
 * WILDCAT in 2021-22), so QB depth falls back by family rather than assuming
 * the three modern labels.
 */

const W = 500;
const H = 600;
const LOS = 310; // line of scrimmage y
const CX = 250; // field center x

type XY = { x: number; y: number };

/** QB depth per formation; unknown labels get an under-center look. */
const QB_DEPTH: Record<string, number> = {
  "UNDER CENTER": 344,
  SHOTGUN: 390,
  PISTOL: 360,
  SINGLEBACK: 344,
  I_FORM: 344,
  JUMBO: 344,
  WILDCAT: 390,
  EMPTY: 390,
};

/** RB anchors per formation family: beside the QB in gun, stacked behind otherwise. */
function rbAnchors(formation: string): XY[] {
  const gun = formation === "SHOTGUN" || formation === "EMPTY" || formation === "WILDCAT";
  if (gun) {
    return [
      { x: 190, y: 392 },
      { x: 310, y: 392 },
      { x: 250, y: 450 },
    ];
  }
  if (formation === "PISTOL") {
    return [
      { x: CX, y: 418 },
      { x: CX, y: 468 },
      { x: 190, y: 400 },
    ];
  }
  // Under center / singleback / I-form: FB then TB stacked.
  return [
    { x: CX, y: 402 },
    { x: CX, y: 458 },
    { x: 190, y: 402 },
  ];
}

// Attached to the line, outside the tackles.
const TE_ANCHORS: XY[] = [
  { x: 378, y: 314 },
  { x: 122, y: 314 },
  { x: 420, y: 324 },
];

// Split wide first, then the slots.
const WR_ANCHORS: XY[] = [
  { x: 52, y: 302 },
  { x: 448, y: 302 },
  { x: 100, y: 320 },
  { x: 402, y: 320 },
];

const OL: { label: string; x: number }[] = [
  { label: "LT", x: 170 },
  { label: "LG", x: 210 },
  { label: "C", x: CX },
  { label: "RG", x: 290 },
  { label: "RT", x: 330 },
];

const POS_STYLE: Record<string, { r: number; fill: string }> = {
  QB: { r: 22, fill: "var(--color-qb)" },
  RB: { r: 18, fill: "var(--color-rb)" },
  WR: { r: 18, fill: "var(--color-wr)" },
  TE: { r: 18, fill: "var(--color-te)" },
  OL: { r: 16, fill: "#64748b" },
};

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? name;
  return last.length > 11 ? `${last.slice(0, 10)}…` : last;
}

function PlayerDot({
  pos,
  x,
  y,
  name,
  badge,
}: {
  pos: keyof typeof POS_STYLE;
  x: number;
  y: number;
  name?: string;
  badge?: string;
}) {
  const { r, fill } = POS_STYLE[pos];
  return (
    <g className="ff-player" style={{ transformOrigin: `${x}px ${y}px` }}>
      {name && <title>{name}</title>}
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={fill}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth={1.5}
      />
      <text
        x={x}
        y={y + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={pos === "QB" ? 13 : 11}
        fontWeight={700}
        fill="#fff"
      >
        {badge ?? pos}
      </text>
      {name && (
        <text
          x={x}
          y={y + r + 13}
          textAnchor="middle"
          fontSize={10.5}
          fontWeight={500}
          fill="rgba(255,255,255,0.88)"
          stroke="rgba(0,0,0,0.55)"
          strokeWidth={2.5}
          paintOrder="stroke"
        >
          {lastName(name)}
        </text>
      )}
    </g>
  );
}

export default function FormationField({
  formation,
  personnel,
  personnelGrouping,
}: {
  formation: string;
  personnel: Record<string, RosterPlayer[]>;
  personnelGrouping: string;
}) {
  const rbCount = Number(personnelGrouping[0]) || 0;
  const teCount = Number(personnelGrouping[1]) || 0;
  const wrCount = Math.max(0, Math.min(5 - rbCount - teCount, WR_ANCHORS.length));

  const qbDepth = QB_DEPTH[formation] ?? 344;
  const qb = personnel.QB?.[0];

  const pick = (pos: string, n: number) => (personnel[pos] ?? []).slice(0, n);
  const rbs = pick("RB", Math.min(rbCount, 3));
  const tes = pick("TE", Math.min(teCount, TE_ANCHORS.length));
  const wrs = pick("WR", wrCount);
  const rbXY = rbAnchors(formation);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full max-w-[500px]"
      role="img"
      aria-label={`${formation} formation, ${personnelGrouping} personnel`}
    >
      <defs>
        <linearGradient id="ff-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d5233" />
          <stop offset="55%" stopColor="#1a472a" />
          <stop offset="100%" stopColor="#153a22" />
        </linearGradient>
        <clipPath id="ff-clip">
          <rect x={8} y={8} width={W - 16} height={H - 16} rx={14} />
        </clipPath>
      </defs>

      {/* Field */}
      <rect
        x={8}
        y={8}
        width={W - 16}
        height={H - 16}
        rx={14}
        fill="url(#ff-grass)"
        stroke="var(--color-border)"
        strokeWidth={1.5}
      />

      <g clipPath="url(#ff-clip)">
        {/* Mowing stripes + yard lines every 40px */}
        {Array.from({ length: 15 }).map((_, i) => {
          const y = 8 + i * 40;
          return (
            <g key={i}>
              {i % 2 === 0 && (
                <rect x={8} y={y} width={W - 16} height={40} fill="rgba(255,255,255,0.02)" />
              )}
              <line
                x1={8}
                x2={W - 8}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.07)"
                strokeWidth={1}
              />
            </g>
          );
        })}

        {/* Hash marks, inner thirds like the pro field */}
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

        {/* Line of scrimmage */}
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
      </g>

      {/* Offensive line */}
      {OL.map((o) => (
        <PlayerDot key={o.label} pos="OL" x={o.x} y={LOS} badge={o.label} />
      ))}

      {/* Tight ends */}
      {Array.from({ length: teCount }).map((_, i) => (
        <PlayerDot
          key={`te-${i}`}
          pos="TE"
          x={TE_ANCHORS[i].x}
          y={TE_ANCHORS[i].y}
          name={tes[i]?.name}
        />
      ))}

      {/* Wide receivers */}
      {Array.from({ length: wrCount }).map((_, i) => (
        <PlayerDot
          key={`wr-${i}`}
          pos="WR"
          x={WR_ANCHORS[i].x}
          y={WR_ANCHORS[i].y}
          name={wrs[i]?.name}
        />
      ))}

      {/* Quarterback */}
      <PlayerDot pos="QB" x={CX} y={qbDepth} name={qb?.name} />

      {/* Running backs */}
      {Array.from({ length: Math.min(rbCount, 3) }).map((_, i) => (
        <PlayerDot
          key={`rb-${i}`}
          pos="RB"
          x={rbXY[i].x}
          y={rbXY[i].y}
          name={rbs[i]?.name}
        />
      ))}
    </svg>
  );
}
