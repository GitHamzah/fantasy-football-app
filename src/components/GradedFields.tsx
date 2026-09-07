"use client";

import { MatchupDefPlayer, MatchupOffPlayer } from "@/lib/api";

/**
 * The dual matchup fields: the same football-field framing as FormationField /
 * DefenseField, but every circle carries a 0-100 matchup grade, colored by
 * tier. Hover shows the stat card (native SVG title); click hands the player
 * to the caller for the slide-out panel.
 */

const W = 500;
const H = 470; // shorter than the formation pages - these sit side by side
const LOS = 235;
const CX = 250;

export function tierColor(grade: number | null | undefined): string {
  if (grade === null || grade === undefined) return "#64748b";
  if (grade >= 80) return "#2ecc71";
  if (grade >= 60) return "#f39c12";
  if (grade >= 40) return "#e67e22";
  return "#e74c3c";
}

function lastName(name: string): string {
  const parts = (name ?? "").trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? name;
  return last.length > 11 ? `${last.slice(0, 10)}…` : last;
}

export function offTooltip(p: MatchupOffPlayer, pos: string): string {
  const lines = [
    `${p.name} (${pos}) — Grade: ${p.grade ?? "—"}${p.grade_label ? ` (${p.grade_label})` : ""}`,
  ];
  if (p.ppg != null) lines.push(`2025: ${p.ppg.toFixed(1)} PPG`);
  const v = p.vs_this_defense;
  if (v)
    lines.push(
      `vs this defense: ${v.attempts} att, ${v.yards ?? 0} yds, ${v.tds} TD (${v.avg_yards ?? "—"} avg)`,
    );
  const shells = p.vs_defense_shell ?? {};
  const shellBits = Object.entries(shells)
    .filter(([, s]) => s.avg_yards != null)
    .map(([k, s]) => `${k}: ${s.avg_yards!.toFixed(1)} avg`);
  if (shellBits.length) lines.push(shellBits.join(" · "));
  return lines.join("\n");
}

export function defTooltip(p: MatchupDefPlayer): string {
  const lines = [
    `${p.name} (${p.position}) — Grade: ${p.grade ?? "—"} (${p.grade_label})`,
  ];
  const f = p.pfr;
  if (f) {
    const bits: string[] = [];
    if (f.comp_pct_allowed != null) bits.push(`${f.comp_pct_allowed}% comp allowed`);
    if (f.yards_per_tgt != null) bits.push(`${f.yards_per_tgt} yds/tgt`);
    if (f.passer_rating != null) bits.push(`${f.passer_rating} passer rating`);
    if (f.ints) bits.push(`${f.ints} INTs`);
    if (f.sacks) bits.push(`${f.sacks} sacks`);
    if (f.pressures_pg) bits.push(`${f.pressures_pg} pressures/g`);
    if (bits.length) lines.push(bits.join(" · "));
  } else {
    lines.push("No PFR coverage — neutral grade");
  }
  return lines.join("\n");
}

function GradeDot({
  x,
  y,
  grade,
  label,
  name,
  tooltip,
  small,
  onClick,
}: {
  x: number;
  y: number;
  grade: number | null;
  label?: string;
  name?: string;
  tooltip?: string;
  small?: boolean;
  onClick?: () => void;
}) {
  const r = small ? 14 : 19;
  return (
    <g
      className="ff-player"
      style={{ transformOrigin: `${x}px ${y}px`, cursor: onClick ? "pointer" : "default" }}
      onClick={onClick}
    >
      {tooltip && <title>{tooltip}</title>}
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={tierColor(grade)}
        stroke="rgba(0,0,0,0.4)"
        strokeWidth={1.5}
      />
      <text
        x={x}
        y={y + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={grade === null ? 10 : small ? 11 : 13}
        fontWeight={700}
        fill="#fff"
      >
        {grade === null ? label : Math.round(grade)}
      </text>
      {name && (
        <text
          x={x}
          y={y + r + 12}
          textAnchor="middle"
          fontSize={10}
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

function FieldChrome({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      <defs>
        <linearGradient id="gf-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d5233" />
          <stop offset="55%" stopColor="#1a472a" />
          <stop offset="100%" stopColor="#153a22" />
        </linearGradient>
        <clipPath id="gf-clip">
          <rect x={6} y={6} width={W - 12} height={H - 12} rx={12} />
        </clipPath>
      </defs>
      <rect
        x={6}
        y={6}
        width={W - 12}
        height={H - 12}
        rx={12}
        fill="url(#gf-grass)"
        stroke="var(--color-border)"
        strokeWidth={1.5}
      />
      <g clipPath="url(#gf-clip)">
        {Array.from({ length: 12 }).map((_, i) => (
          <line
            key={i}
            x1={6}
            x2={W - 6}
            y1={6 + i * 40}
            y2={6 + i * 40}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}
        <line
          x1={6}
          x2={W - 6}
          y1={LOS}
          y2={LOS}
          stroke="#facc15"
          strokeWidth={2}
          strokeDasharray="10 7"
          opacity={0.6}
        />
      </g>
      {children}
    </svg>
  );
}

/* ---------------- offense ---------------- */

const QB_DEPTH: Record<string, number> = {
  "UNDER CENTER": 264,
  SHOTGUN: 300,
  PISTOL: 280,
  SINGLEBACK: 264,
  I_FORM: 264,
  JUMBO: 264,
  WILDCAT: 300,
  EMPTY: 300,
};
const OL_X = [170, 210, 250, 290, 330];
const OL_LABELS = ["LT", "LG", "C", "RG", "RT"];
const TE_XY = [
  { x: 378, y: LOS + 4 },
  { x: 122, y: LOS + 4 },
];
const WR_XY = [
  { x: 52, y: LOS - 8 },
  { x: 448, y: LOS - 8 },
  { x: 100, y: LOS + 10 },
  { x: 402, y: LOS + 10 },
];

export type GradedOffense = {
  QB: MatchupOffPlayer[];
  RB: MatchupOffPlayer[];
  WR: MatchupOffPlayer[];
  TE: MatchupOffPlayer[];
  OL: MatchupOffPlayer[];
};

export function GradedOffenseField({
  formation,
  personnelGrouping,
  players,
  displayGrade,
  onSelect,
}: {
  formation: string;
  personnelGrouping: string;
  players: GradedOffense;
  /** Grade to show per player (may be look-adjusted by the caller). */
  displayGrade: (p: MatchupOffPlayer) => number | null;
  onSelect: (p: MatchupOffPlayer, pos: string) => void;
}) {
  const rb = Math.min(Number(personnelGrouping[0]) || 1, 2);
  const te = Math.min(Number(personnelGrouping[1]) || 1, 2);
  const wr = Math.max(0, Math.min(5 - rb - te, 4));
  const gun = ["SHOTGUN", "EMPTY", "WILDCAT"].includes(formation);
  const rbXY = gun
    ? [
        { x: 190, y: 302 },
        { x: 310, y: 302 },
      ]
    : [
        { x: CX, y: 322 },
        { x: CX, y: 368 },
      ];

  return (
    <FieldChrome label={`${formation} offense, graded`}>
      {OL_X.map((x, i) => {
        const p = players.OL[i];
        return (
          <GradeDot
            key={`ol-${i}`}
            x={x}
            y={LOS}
            grade={null}
            label={OL_LABELS[i]}
            name={p?.name}
            small
            tooltip={p ? `${p.name} (${OL_LABELS[i]})` : undefined}
          />
        );
      })}
      {players.TE.slice(0, te).map((p, i) => (
        <GradeDot
          key={`te-${i}`}
          {...TE_XY[i]}
          grade={displayGrade(p)}
          name={p.name}
          tooltip={offTooltip(p, "TE")}
          onClick={() => onSelect(p, "TE")}
        />
      ))}
      {players.WR.slice(0, wr).map((p, i) => (
        <GradeDot
          key={`wr-${i}`}
          {...WR_XY[i]}
          grade={displayGrade(p)}
          name={p.name}
          tooltip={offTooltip(p, "WR")}
          onClick={() => onSelect(p, "WR")}
        />
      ))}
      {players.QB.slice(0, 1).map((p) => (
        <GradeDot
          key="qb"
          x={CX}
          y={QB_DEPTH[formation] ?? 264}
          grade={displayGrade(p)}
          name={p.name}
          tooltip={offTooltip(p, "QB")}
          onClick={() => onSelect(p, "QB")}
        />
      ))}
      {players.RB.slice(0, rb).map((p, i) => (
        <GradeDot
          key={`rb-${i}`}
          {...rbXY[i]}
          grade={displayGrade(p)}
          name={p.name}
          tooltip={offTooltip(p, "RB")}
          onClick={() => onSelect(p, "RB")}
        />
      ))}
    </FieldChrome>
  );
}

/* ---------------- defense ---------------- */

function spread(n: number, cx: number, gap: number): number[] {
  return Array.from({ length: n }, (_, i) => cx + (i - (n - 1) / 2) * gap);
}

export type GradedDefense = {
  DL: MatchupDefPlayer[];
  LB: MatchupDefPlayer[];
  CB: MatchupDefPlayer[];
  S: MatchupDefPlayer[];
};

export function GradedDefenseField({
  front,
  shell,
  players,
  onSelect,
}: {
  front: { dl: number; lb: number; db: number };
  shell: string | null;
  players: GradedDefense;
  onSelect: (p: MatchupDefPlayer) => void;
}) {
  const dl = Math.min(front.dl, players.DL.length || front.dl, 5);
  const lb = Math.min(front.lb, 4);
  const db = front.db;
  const safeties = db >= 2 && shell !== "1-High" && shell !== "Loaded Box" ? 2 : 1;
  const corners = Math.min(2, db - safeties);
  const slots = Math.max(0, db - safeties - corners);

  const dlPlayers = players.DL.slice(0, dl);
  const lbPlayers = players.LB.slice(0, lb);
  const cbPlayers = players.CB;
  const sPlayers = players.S;

  const slotSpots = [
    { x: 396, y: LOS - 44 },
    { x: 104, y: LOS - 44 },
    { x: CX, y: LOS - 108 },
  ];

  return (
    <FieldChrome label={`defense, graded${shell ? `, ${shell}` : ""}`}>
      {/* ghost OL */}
      {OL_X.map((x) => (
        <circle key={x} cx={x} cy={LOS + 16} r={11} fill="rgba(255,255,255,0.06)" />
      ))}
      {dlPlayers.map((p, i) => (
        <GradeDot
          key={`dl-${i}`}
          x={spread(dlPlayers.length, CX, 46)[i]}
          y={LOS - 22}
          grade={p.grade}
          name={p.name}
          tooltip={defTooltip(p)}
          onClick={() => onSelect(p)}
        />
      ))}
      {lbPlayers.map((p, i) => (
        <GradeDot
          key={`lb-${i}`}
          x={spread(lbPlayers.length, CX, 78)[i]}
          y={LOS - 76}
          grade={p.grade}
          name={p.name}
          tooltip={defTooltip(p)}
          onClick={() => onSelect(p)}
        />
      ))}
      {cbPlayers.slice(0, corners).map((p, i) => (
        <GradeDot
          key={`cb-${i}`}
          x={i === 0 ? 52 : 448}
          y={LOS - 26}
          grade={p.grade}
          name={p.name}
          tooltip={defTooltip(p)}
          onClick={() => onSelect(p)}
        />
      ))}
      {cbPlayers.slice(corners, corners + slots).map((p, i) => (
        <GradeDot
          key={`nb-${i}`}
          {...slotSpots[i % slotSpots.length]}
          grade={p.grade}
          name={p.name}
          tooltip={defTooltip(p)}
          onClick={() => onSelect(p)}
        />
      ))}
      {sPlayers.slice(0, safeties).map((p, i) => (
        <GradeDot
          key={`s-${i}`}
          x={safeties === 2 ? (i === 0 ? 165 : 335) : CX}
          y={70}
          grade={p.grade}
          name={p.name}
          tooltip={defTooltip(p)}
          onClick={() => onSelect(p)}
        />
      ))}
    </FieldChrome>
  );
}
