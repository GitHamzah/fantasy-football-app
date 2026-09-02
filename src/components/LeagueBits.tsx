"use client";

import { MyLeague } from "@/lib/api";

/** Status pill for Sleeper league lifecycle states. */
export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    in_season: "bg-grade-elite/15 text-grade-elite border-grade-elite/40",
    drafting: "bg-grade-mid/15 text-grade-mid border-grade-mid/40",
    pre_draft: "bg-grade-mid/15 text-grade-mid border-grade-mid/40",
    complete: "bg-border/40 text-muted border-border",
  };
  const labels: Record<string, string> = {
    in_season: "In Season",
    drafting: "Drafting",
    pre_draft: "Pre-Draft",
    complete: "Complete",
  };
  return (
    <span
      className={
        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
        (styles[status] ?? styles.complete)
      }
    >
      {labels[status] ?? status}
    </span>
  );
}

/** 0-0 with no points means nothing has happened yet — a standing is noise. */
export function hasPlayed(lg: MyLeague): boolean {
  return lg.my_record !== "0-0" || (lg.my_points ?? 0) > 0;
}
