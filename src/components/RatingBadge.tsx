"use client";

/** Color treatment per schedule/matchup rating bucket. */
const STYLES: Record<string, { bg: string; color: string; bold?: boolean }> = {
  Smash: { bg: "rgba(46,204,113,0.25)", color: "#2ecc71", bold: true },
  Favorable: { bg: "rgba(46,204,113,0.12)", color: "#82e0aa" },
  Neutral: { bg: "rgba(148,163,184,0.12)", color: "#94a3b8" },
  Tough: { bg: "rgba(241,196,15,0.14)", color: "#f1c40f" },
  Avoid: { bg: "rgba(231,76,60,0.16)", color: "#e74c3c", bold: true },
};

export default function RatingBadge({ rating }: { rating: string | null }) {
  if (!rating || rating === "Unknown") {
    return <span className="text-faint">—</span>;
  }
  const s = STYLES[rating] ?? STYLES.Neutral;
  return (
    <span
      className={
        "whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider " +
        (s.bold ? "font-bold" : "font-semibold")
      }
      style={{ background: s.bg, color: s.color }}
    >
      {rating}
    </span>
  );
}
