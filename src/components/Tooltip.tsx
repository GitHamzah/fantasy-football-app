"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Definitions for statistical abbreviations, keyed by the exact header/label
 * strings used across the app (lowercased). SortableTable looks headers up
 * here automatically, so a column named "EPA" gets its tooltip everywhere
 * without per-page wiring. Plain identity labels (Player, Team, Season) are
 * deliberately absent.
 */
const METRIC_TIPS: Record<string, string> = {
  epa: "Expected Points Added — measures how much a play improved the team's expected score. Positive = good play, negative = bad play.",
  "epa / play": "Expected Points Added per play — how much the average play improved the team's expected score. Positive favors the offense.",
  ppg: "Points Per Game — average fantasy points scored per game played.",
  vor: "Value Over Replacement — how many more points per game this player scores compared to a replacement-level player at their position.",
  "success%": "Percentage of plays that gained positive Expected Points Added (EPA > 0).",
  "success rate": "Percentage of plays that gained positive Expected Points Added (EPA > 0).",
  "boom%": "Percentage of weeks the player scored 20+ fantasy points.",
  "bust%": "Percentage of weeks the player scored under 8 fantasy points.",
  consistency: "Standard deviation of weekly fantasy scores. Lower = more consistent.",
  "avg box": "Average number of defenders in the box (within ~5 yards of the line of scrimmage).",
  targets: "Number of times a pass was thrown to this player.",
  carries: "Number of rushing attempts.",
  dropbacks: "Number of pass plays with this quarterback dropping back.",
  receptions: "Completed catches.",
  rec: "Completed catches.",
  "avg yds": "Average yards gained per play/target/carry.",
  "avg yards": "Average yards gained per play/target/carry.",
  "avg yards / play": "Average yards gained per offensive play.",
  "pass%": "Percentage of plays that were pass attempts.",
  "pass rate": "Percentage of plays that were pass attempts.",
  package: "Defensive personnel grouping — Nickel (5 DBs), Dime (6 DBs), 4-3 Base (4 DL, 3 LB, 4 DB), etc.",
  "def package": "Defensive personnel grouping — Nickel (5 DBs), Dime (6 DBs), 4-3 Base (4 DL, 3 LB, 4 DB), etc.",
  "top package": "The defensive personnel grouping this team ran most often.",
  shell: "Pre-snap safety alignment — 2-High (both safeties deep), 1-High (one safety deep), Loaded Box (8+ defenders near the line).",
  "coverage shell": "Pre-snap safety alignment — 2-High (both safeties deep), 1-High (one safety deep), Loaded Box (8+ defenders near the line).",
  att: "Opportunities — targets for receivers, carries for rushers, dropbacks for quarterbacks.",
  wopr: "Weighted Opportunity Rating — combines target share and air-yards share into one usage score.",
  nickel: "Snap share in Nickel personnel (5 defensive backs).",
  dime: "Snap share in Dime personnel (6 defensive backs).",
  base: "Snap share in base personnel (4-3 or 3-4 — four defensive backs).",
  front: "Average DL-LB-DB counts this package is run from.",
  "matchup score": "Scheme fit vs this opponent: the player's production weighted by the defense's coverage-shell mix, relative to their own average. Above 1.0 = the schedule suits them.",
  score: "Scheme fit vs this opponent: the player's production weighted by the defense's coverage-shell mix, relative to their own average. Above 1.0 = the schedule suits them.",
  "2026 sched": "Schedule rating: how well this player's matchup splits line up with the defensive tendencies of their 2026 opponents.",
  rating: "Schedule rating derived from the matchup score: Smash > 1.1, Favorable > 1.0, Neutral > 0.9, Tough > 0.8, otherwise Avoid.",
  "proj yds/g": "Scheme-adjusted projected yards per game: 2025 per-shell production weighted by each opponent's coverage-shell mix.",
  "proj yds": "Scheme-adjusted projected total yards across the 2026 schedule.",
  "proj tds": "Scheme-adjusted projected touchdowns across the 2026 schedule.",
};

export function metricTip(label: unknown): string | null {
  if (typeof label !== "string") return null;
  return METRIC_TIPS[label.trim().toLowerCase()] ?? null;
}

/**
 * Small dark popup above the wrapped element. Hover on desktop; on touch the
 * first tap opens it and tapping anywhere else dismisses (the outside-tap
 * listener only exists while open).
 */
export default function Tooltip({
  text,
  children,
  side = "top",
}: {
  text: string;
  children: React.ReactNode;
  /** "top" floats above (stat cards); "bottom" floats below — required inside
      overflow-auto table containers, where an upward popup would be clipped. */
  side?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const dismiss = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  return (
    <span
      ref={ref}
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onTouchStart={() => setOpen(true)}
    >
      <span className="cursor-help underline decoration-dotted decoration-[#334155] underline-offset-2">
        {children}
      </span>
      {open && (
        <span
          role="tooltip"
          className={
            "tooltip-pop pointer-events-none absolute left-1/2 z-50 w-max max-w-[280px] " +
            "-translate-x-1/2 rounded-md bg-[#1e293b] px-3 py-2 text-left text-[11px] font-normal " +
            "normal-case leading-relaxed tracking-normal text-text shadow-lg shadow-black/40 " +
            (side === "top" ? "bottom-full mb-2" : "top-full mt-2")
          }
        >
          {text}
          {/* arrow */}
          <span
            className={
              "absolute left-1/2 -translate-x-1/2 border-4 border-transparent " +
              (side === "top"
                ? "top-full border-t-[#1e293b]"
                : "bottom-full border-b-[#1e293b]")
            }
          />
        </span>
      )}
    </span>
  );
}
