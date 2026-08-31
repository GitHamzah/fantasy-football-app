"use client";

import { ChevronDown, Lightbulb } from "lucide-react";
import { espnLogoUrl } from "./TeamLogo";

export const NFL_TEAMS = [
  "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE",
  "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAX", "KC",
  "LA", "LAC", "LV", "MIA", "MIN", "NE", "NO", "NYG",
  "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WAS",
];

/** Team dropdown with the logo of the current pick beside it. */
export default function TeamSelect({
  value,
  onChange,
  label = "Team",
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
}) {
  const url = espnLogoUrl(value);
  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">
        {label}
      </span>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" width={20} height={20} style={{ objectFit: "contain" }} />
      )}
      <span className="relative inline-flex items-center">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none rounded-md border border-border bg-surface py-1.5 pl-3 pr-8 text-sm text-text outline-none transition-colors hover:border-accent focus:border-accent"
        >
          {NFL_TEAMS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-2.5 text-muted"
        />
      </span>
    </label>
  );
}

/** EPA readouts: green when the offense wins the snap, red when it loses. */
export function epaColor(epa: number | null | undefined): string {
  if (epa === null || epa === undefined) return "inherit";
  return epa >= 0 ? "#2ecc71" : "#e74c3c";
}

export function epaBg(epa: number | null | undefined): string {
  if (epa === null || epa === undefined) return "transparent";
  const a = Math.min(0.28, Math.abs(epa) * 0.6 + 0.05);
  return epa >= 0
    ? `rgba(46, 204, 113, ${a.toFixed(3)})`
    : `rgba(231, 76, 60, ${a.toFixed(3)})`;
}

/** One-line takeaway generated from the data, in a subtle callout card. */
export function InsightCard({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-border bg-surface-2 px-3.5 py-2.5">
      <Lightbulb size={15} className="mt-0.5 shrink-0 text-accent" />
      <p className="text-xs leading-relaxed text-muted">{text}</p>
    </div>
  );
}
