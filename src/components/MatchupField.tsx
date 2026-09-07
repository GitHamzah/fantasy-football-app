"use client";

import { MatchupDefPlayer, MatchupOffPlayer } from "@/lib/api";
import {
  GradeDot,
  GradedDefense,
  GradedOffense,
  defTooltip,
  offTooltip,
} from "@/components/GradedFields";

/**
 * One unified football field, viewed from above: offense on the bottom half
 * driving up at the line of scrimmage, defense arrayed on the top half.
 * Counterparts roughly align — corners over the wideouts, the front over the
 * OL, safeties deep. Grades, tooltips and click-through match the split
 * fields this replaces.
 */

const W = 600;
const H = 700;
const LOS = 360;
const CX = 300;

/* offense (bottom half, facing up) */
const QB_DEPTH: Record<string, number> = {
  "UNDER CENTER": 396,
  SHOTGUN: 452,
  PISTOL: 422,
  SINGLEBACK: 396,
  I_FORM: 396,
  JUMBO: 396,
  WILDCAT: 452,
  EMPTY: 452,
};
const OL_X = [208, 254, 300, 346, 392];
const OL_LABELS = ["LT", "LG", "C", "RG", "RT"];
const OL_Y = LOS + 26;
// TE1 right end of the line, TE2 left end.
const TE_XY = [
  { x: 452, y: LOS + 30 },
  { x: 148, y: LOS + 30 },
];
// Split wide first, then slots.
const WR_XY = [
  { x: 62, y: LOS + 18 },
  { x: 538, y: LOS + 18 },
  { x: 120, y: LOS + 38 },
  { x: 480, y: LOS + 38 },
];

/* defense (top half, facing down) */
const DL_Y = LOS - 26;
const LB_Y = LOS - 88;
// Corners mirror the wide receivers.
const CB_XY = [
  { x: 62, y: LOS - 34 },
  { x: 538, y: LOS - 34 },
  { x: 120, y: LOS - 56 },
  { x: 480, y: LOS - 56 },
];
const S2_XY = [
  { x: 210, y: 96 },
  { x: 390, y: 96 },
];
const S1_XY = [{ x: CX, y: 86 }];

function spread(n: number, cx: number, gap: number): number[] {
  return Array.from({ length: n }, (_, i) => cx + (i - (n - 1) / 2) * gap);
}

export default function MatchupField({
  formation,
  personnelGrouping,
  offense,
  defense,
  front,
  shell,
  displayGrade,
  onSelectOff,
  onSelectDef,
}: {
  formation: string;
  personnelGrouping: string;
  offense: GradedOffense;
  defense: GradedDefense;
  front: { dl: number; lb: number; db: number };
  shell: string | null;
  displayGrade: (p: MatchupOffPlayer) => number | null;
  onSelectOff: (p: MatchupOffPlayer, pos: string) => void;
  onSelectDef: (p: MatchupDefPlayer) => void;
}) {
  /* offense counts from personnel */
  const rb = Math.min(Number(personnelGrouping[0]) || 1, 2);
  const te = Math.min(Number(personnelGrouping[1]) || 1, 2);
  const wr = Math.max(0, Math.min(5 - rb - te, 4));
  const gun = ["SHOTGUN", "EMPTY", "WILDCAT"].includes(formation);
  const rbXY = gun
    ? [
        { x: 236, y: 454 },
        { x: 364, y: 454 },
      ]
    : [
        { x: CX, y: 448 },
        { x: CX, y: 500 },
      ];

  /* defense counts from the selected package */
  const dlN = Math.max(1, Math.min(front.dl, 5));
  const lbN = Math.max(0, Math.min(front.lb, 4));
  const safeties = front.db >= 2 && shell !== "1-High" && shell !== "Loaded Box" ? 2 : 1;
  const corners = Math.min(2, front.db - safeties);
  const slots = Math.max(0, Math.min(front.db - safeties - corners, 2));

  const dls = defense.DL.slice(0, dlN);
  const lbs = defense.LB.slice(0, lbN);
  const cbs = defense.CB;
  const ss = defense.S;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full max-w-[620px]"
      role="img"
      aria-label={`unified matchup field, ${formation} offense vs ${shell ?? "base"} defense`}
    >
      <defs>
        <linearGradient id="mf-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#153a22" />
          <stop offset="50%" stopColor="#1a472a" />
          <stop offset="100%" stopColor="#153a22" />
        </linearGradient>
        <clipPath id="mf-clip">
          <rect x={6} y={6} width={W - 12} height={H - 12} rx={14} />
        </clipPath>
      </defs>

      <rect
        x={6}
        y={6}
        width={W - 12}
        height={H - 12}
        rx={14}
        fill="url(#mf-grass)"
        stroke="var(--color-border)"
        strokeWidth={1.5}
      />

      <g clipPath="url(#mf-clip)">
        {/* yard lines + mow stripes */}
        {Array.from({ length: 17 }).map((_, i) => {
          const y = 6 + i * 43;
          return (
            <g key={i}>
              {i % 2 === 0 && (
                <rect x={6} y={y} width={W - 12} height={43} fill="rgba(255,255,255,0.018)" />
              )}
              <line
                x1={6}
                x2={W - 6}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
            </g>
          );
        })}
        {/* hash marks */}
        {[222, 378].map((hx) =>
          Array.from({ length: 33 }).map((_, i) => (
            <line
              key={`${hx}-${i}`}
              x1={hx - 5}
              x2={hx + 5}
              y1={16 + i * 21}
              y2={16 + i * 21}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={1.5}
            />
          )),
        )}
        {/* line of scrimmage */}
        <line
          x1={6}
          x2={W - 6}
          y1={LOS}
          y2={LOS}
          stroke="#facc15"
          strokeWidth={2.5}
          strokeDasharray="12 8"
          opacity={0.7}
        />
      </g>

      {/* ---------------- defense: top half ---------------- */}
      {dls.map((p, i) => (
        <GradeDot
          key={`dl-${i}`}
          x={spread(dls.length, CX, 48)[i]}
          y={DL_Y}
          grade={p.grade}
          name={p.name}
          tooltip={defTooltip(p)}
          onClick={() => onSelectDef(p)}
        />
      ))}
      {lbs.map((p, i) => (
        <GradeDot
          key={`lb-${i}`}
          x={spread(lbs.length, CX, 84)[i]}
          y={LB_Y}
          grade={p.grade}
          name={p.name}
          tooltip={defTooltip(p)}
          onClick={() => onSelectDef(p)}
        />
      ))}
      {cbs.slice(0, corners).map((p, i) => (
        <GradeDot
          key={`cb-${i}`}
          {...CB_XY[i]}
          grade={p.grade}
          name={p.name}
          tooltip={defTooltip(p)}
          onClick={() => onSelectDef(p)}
        />
      ))}
      {cbs.slice(corners, corners + slots).map((p, i) => (
        <GradeDot
          key={`nb-${i}`}
          {...CB_XY[2 + (i % 2)]}
          grade={p.grade}
          name={p.name}
          tooltip={defTooltip(p)}
          onClick={() => onSelectDef(p)}
        />
      ))}
      {ss.slice(0, safeties).map((p, i) => (
        <GradeDot
          key={`s-${i}`}
          {...(safeties === 2 ? S2_XY[i] : S1_XY[0])}
          grade={p.grade}
          name={p.name}
          tooltip={defTooltip(p)}
          onClick={() => onSelectDef(p)}
        />
      ))}

      {/* ---------------- offense: bottom half ---------------- */}
      {OL_X.map((x, i) => {
        const p = offense.OL[i];
        return (
          <GradeDot
            key={`ol-${i}`}
            x={x}
            y={OL_Y}
            grade={null}
            label={OL_LABELS[i]}
            name={p?.name}
            small
            tooltip={p ? `${p.name} (${OL_LABELS[i]})` : undefined}
          />
        );
      })}
      {offense.TE.slice(0, te).map((p, i) => (
        <GradeDot
          key={`te-${i}`}
          {...TE_XY[i]}
          grade={displayGrade(p)}
          name={p.name}
          tooltip={offTooltip(p, "TE")}
          onClick={() => onSelectOff(p, "TE")}
        />
      ))}
      {offense.WR.slice(0, wr).map((p, i) => (
        <GradeDot
          key={`wr-${i}`}
          {...WR_XY[i]}
          grade={displayGrade(p)}
          name={p.name}
          tooltip={offTooltip(p, "WR")}
          onClick={() => onSelectOff(p, "WR")}
        />
      ))}
      {offense.QB.slice(0, 1).map((p) => (
        <GradeDot
          key="qb"
          x={CX}
          y={QB_DEPTH[formation] ?? 396}
          grade={displayGrade(p)}
          name={p.name}
          tooltip={offTooltip(p, "QB")}
          onClick={() => onSelectOff(p, "QB")}
        />
      ))}
      {offense.RB.slice(0, rb).map((p, i) => (
        <GradeDot
          key={`rb-${i}`}
          {...rbXY[i]}
          grade={displayGrade(p)}
          name={p.name}
          tooltip={offTooltip(p, "RB")}
          onClick={() => onSelectOff(p, "RB")}
        />
      ))}
    </svg>
  );
}
