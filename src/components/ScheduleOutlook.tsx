"use client";

import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
import {
  WeeklyMatchupProjection,
  WeeklyMatchupWeek,
  getWeeklyMatchupProjection,
  tryGet,
} from "@/lib/api";
import RatingBadge from "@/components/RatingBadge";
import { TableSkeleton } from "@/components/SortableTable";

/**
 * "2026 Schedule Outlook" for the player detail page: matchup-score bars per
 * week, a compact weekly table with the best/worst weeks tinted, and a
 * generated summary line.
 *
 * The bars diverge from the 1.0 baseline rather than growing from zero:
 * matchup scores live in a tight band (roughly 0.9-1.1), so zero-anchored bars
 * would all look identical. Divergence is what makes the differences visible.
 */

const W = 720;
const H = 300;
const AXIS = "#1e293b";
const MUTED = "#94a3b8";

function shellText(t: Record<string, number>): string {
  const order = ["2-High", "1-High", "Loaded Box"];
  return order
    .filter((k) => t[k] !== undefined)
    .map((k) => `${t[k].toFixed(0)}% ${k}`)
    .join(", ");
}

function MatchupBars({ weeks }: { weeks: WeeklyMatchupWeek[] }) {
  const scores = weeks.map((w) => w.matchup_score ?? 1);
  const maxDev = Math.max(0.06, ...scores.map((s) => Math.abs(s - 1)));
  const padL = 46;
  const padR = 12;
  const padB = 30;
  const padT = 16;
  const plotH = H - padT - padB;
  const mid = padT + plotH / 2;
  const yAt = (s: number) => mid - ((s - 1) / maxDev) * (plotH / 2) * 0.9;
  const bw = (W - padL - padR) / weeks.length;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full max-w-[700px]"
      role="img"
      aria-label="Matchup score by week"
    >
      {[1 + maxDev, 1, 1 - maxDev].map((v) => (
        <g key={v}>
          <line
            x1={padL}
            x2={W - padR}
            y1={yAt(v)}
            y2={yAt(v)}
            stroke={AXIS}
            strokeWidth={v === 1 ? 1.5 : 1}
            strokeDasharray={v === 1 ? undefined : "4 4"}
          />
          <text
            x={padL - 6}
            y={yAt(v) + 4}
            fontSize={12}
            fill={MUTED}
            textAnchor="end"
          >
            {v.toFixed(2)}
          </text>
        </g>
      ))}

      {weeks.map((w, i) => {
        const s = w.matchup_score ?? 1;
        const x = padL + i * bw + bw * 0.18;
        const width = bw * 0.64;
        const y0 = yAt(1);
        const y1 = yAt(s);
        const top = Math.min(y0, y1);
        const h = Math.max(2, Math.abs(y1 - y0));
        const fill = s >= 1 ? "#2ecc71" : "#e74c3c";
        return (
          <g key={w.week}>
            <rect x={x} y={top} width={width} height={h} fill={fill} rx={2}>
              <title>
                {`Week ${w.week} vs ${w.opponent} — Matchup Score: ${
                  w.matchup_score?.toFixed(3) ?? "—"
                } (${w.matchup_rating})\n${shellText(w.opponent_shell_tendencies)}`}
              </title>
            </rect>
            <text
              x={x + width / 2}
              y={H - 8}
              fontSize={10}
              fill={MUTED}
              textAnchor="middle"
            >
              {w.opponent}
            </text>
            <text
              x={x + width / 2}
              y={padT - 4}
              fontSize={9}
              fill="#64748b"
              textAnchor="middle"
            >
              {w.week}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function summarize(d: WeeklyMatchupProjection): string | null {
  if (!d.weeks.length) return null;
  const avgYds =
    d.weeks.reduce((a, w) => a + (w.projected_yards ?? 0), 0) / d.weeks.length;
  const name = d.player_name?.split(/\s+/).pop() ?? d.player_name;
  const best = d.best_weeks
    .slice(0, 2)
    .map((b) => {
      const wk = d.weeks.find((w) => w.week === b.week);
      return `Week ${b.week} vs ${b.opponent} (${wk?.matchup_rating ?? ""})`;
    })
    .join(", ");
  const worst = d.worst_weeks[0];
  return (
    `${name}'s 2026 outlook: schedule-adjusted ${avgYds.toFixed(1)} yds/game ` +
    `across ${d.weeks.length} games. Best spots: ${best}. ` +
    `Toughest: Week ${worst.week} vs ${worst.opponent}.`
  );
}

export default function ScheduleOutlook({ playerId }: { playerId: string }) {
  const [data, setData] = useState<WeeklyMatchupProjection | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setLoaded(false);
    (async () => {
      const d = await tryGet(getWeeklyMatchupProjection(playerId, 2026));
      if (cancelled) return;
      setData(d);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  if (loaded && !data) return null; // no scheme projection for this player

  const bestSet = new Set(data?.best_weeks.map((w) => w.week) ?? []);
  const worstSet = new Set(data?.worst_weeks.map((w) => w.week) ?? []);
  const summary = data ? summarize(data) : null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 border-b border-border pb-2 text-sm font-semibold uppercase tracking-wider text-muted">
        2026 Schedule Outlook
      </h2>

      {!loaded ? (
        <TableSkeleton rows={4} cols={6} />
      ) : (
        <>
          {summary && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-accent/30 bg-surface-2 px-3.5 py-2.5">
              <Lightbulb size={15} className="mt-0.5 shrink-0 text-accent" />
              <p className="text-xs leading-relaxed text-muted">{summary}</p>
            </div>
          )}

          <div className="flex justify-center rounded-lg border border-border bg-surface p-3">
            <MatchupBars weeks={data!.weeks} />
          </div>
          <p className="mt-1 text-xs text-faint">
            Bars diverge from the 1.0 baseline — green weeks suit this
            player&apos;s splits, red weeks fight them. Hover a bar for the
            opponent&apos;s coverage-shell mix.
          </p>

          <div className="mt-4 max-h-[420px] overflow-auto rounded-lg border border-border">
            <table className="tbl">
              <thead>
                <tr className="cols">
                  <th className="lft">Week</th>
                  <th className="lft">Opponent</th>
                  <th>Proj Yds</th>
                  <th>Proj TDs</th>
                  <th>Score</th>
                  <th className="lft">Rating</th>
                </tr>
              </thead>
              <tbody>
                {data!.weeks.map((w) => {
                  const tint = bestSet.has(w.week)
                    ? "rgba(46,204,113,0.07)"
                    : worstSet.has(w.week)
                      ? "rgba(231,76,60,0.07)"
                      : undefined;
                  return (
                    <tr key={w.week} style={tint ? { background: tint } : undefined}>
                      <td className="lft">{w.week}</td>
                      <td className="lft">{w.opponent}</td>
                      <td className="tabular-nums">
                        {w.projected_yards?.toFixed(1) ?? "—"}
                      </td>
                      <td className="tabular-nums">
                        {w.projected_tds?.toFixed(2) ?? "—"}
                      </td>
                      <td className="tabular-nums">
                        {w.matchup_score?.toFixed(3) ?? "—"}
                      </td>
                      <td className="lft">
                        <RatingBadge rating={w.matchup_rating} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
