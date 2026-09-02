"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { ChevronDown, Lightbulb } from "lucide-react";
import {
  LeagueMatchups,
  LeagueRoster,
  LeagueRosterPlayer,
  ScheduleAdjustedPlayer,
  getScheduleAdjustedProjections,
  LeagueStandingRow,
  LeagueStandings,
  MyLeague,
  getLeagueMatchups,
  getLeagueRoster,
  getLeagueStandings,
  getMyLeagues,
  tryGet,
} from "@/lib/api";
import { StatusBadge, hasPlayed } from "@/components/LeagueBits";
import RatingBadge from "@/components/RatingBadge";
import PositionBadge from "@/components/PositionBadge";
import SortableTable, { TableSkeleton } from "@/components/SortableTable";
import TeamLogo from "@/components/TeamLogo";
import { useQueryState } from "@/components/useQueryState";

const TABS = ["roster", "standings", "matchups"] as const;

/** DEF rows come back with an empty player_name; the team abbr is the name. */
function displayName(p: LeagueRosterPlayer): string {
  if (p.player_name?.trim()) return p.player_name;
  if (p.position === "DEF") return `${p.team ?? "??"} DEF`;
  return p.sleeper_id;
}

function PlayerName({ p }: { p: LeagueRosterPlayer }) {
  const name = displayName(p);
  if (!p.gsis_id) return <span className="font-medium">{name}</span>;
  return (
    <Link
      href={`/players/${encodeURIComponent(p.gsis_id)}`}
      className="font-medium text-text underline-offset-2 hover:text-accent hover:underline"
    >
      {name}
    </Link>
  );
}

function ShellChip({
  split,
  good,
}: {
  split: { shell: string; avg_yards: number | null } | null;
  good: boolean;
}) {
  if (!split) return <span className="text-faint">—</span>;
  const color = good ? "#2ecc71" : "#e74c3c";
  const bg = good ? "rgba(46,204,113,0.12)" : "rgba(231,76,60,0.12)";
  return (
    <span
      className="whitespace-nowrap rounded px-1.5 py-0.5 text-xs tabular-nums"
      style={{ color, background: bg }}
    >
      {split.shell} · {split.avg_yards?.toFixed(1) ?? "—"}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Roster tab                                                          */
/* ------------------------------------------------------------------ */

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

function rosterInsights(players: LeagueRosterPlayer[]): string[] {
  const withBest = players.filter(
    (p) => p.best_matchup?.avg_yards != null && (p.ppg_2025 ?? 0) >= 8,
  );
  const withWorst = players.filter(
    (p) => p.worst_matchup?.avg_yards != null && (p.ppg_2025 ?? 0) >= 8,
  );
  const out: string[] = [];

  const best = [...withBest].sort(
    (a, b) => b.best_matchup!.avg_yards! - a.best_matchup!.avg_yards!,
  );
  if (best.length) {
    const parts = best
      .slice(0, 2)
      .map(
        (p) =>
          `${lastName(displayName(p))} thrives vs ${p.best_matchup!.shell} ` +
          `(${p.best_matchup!.avg_yards!.toFixed(1)} yds)`,
      );
    out.push(`Your best matchup exploits: ${parts.join(", ")}.`);
  }

  const worst = [...withWorst].sort(
    (a, b) => a.worst_matchup!.avg_yards! - b.worst_matchup!.avg_yards!,
  );
  if (worst.length) {
    const w = worst[0];
    out.push(
      `Watch out: ${lastName(displayName(w))} struggles vs ` +
        `${w.worst_matchup!.shell} (${w.worst_matchup!.avg_yards!.toFixed(1)} yds).`,
    );
  }
  return out;
}

function RosterGroup({
  title,
  players,
  schedByPlayer,
}: {
  title: string;
  players: LeagueRosterPlayer[];
  schedByPlayer: Map<string, ScheduleAdjustedPlayer>;
}) {
  if (!players.length) return null;
  return (
    <div className="mt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
        {title}
      </h3>
      <div className="overflow-auto rounded-lg border border-border">
        <table className="tbl">
          <thead>
            <tr className="cols">
              <th className="lft">Player</th>
              <th>2025 PPG</th>
              <th>G</th>
              <th className="lft">Best look</th>
              <th className="lft">Worst look</th>
              <th className="lft">2026 sched</th>
              <th className="lft"></th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const hasStats = p.ppg_2025 !== null;
              return (
                <tr key={p.sleeper_id}>
                  <td className="lft">
                    <span className="flex items-center gap-2">
                      <PositionBadge position={p.position} />
                      <PlayerName p={p} />
                      <TeamLogo team={p.team} size={16} showAbbr={false} />
                    </span>
                  </td>
                  <td className="tabular-nums">
                    {p.ppg_2025?.toFixed(1) ?? "—"}
                  </td>
                  <td className="tabular-nums">{p.games_2025 ?? "—"}</td>
                  <td className="lft">
                    <ShellChip split={hasStats ? p.best_matchup : null} good />
                  </td>
                  <td className="lft">
                    <ShellChip
                      split={hasStats ? p.worst_matchup : null}
                      good={false}
                    />
                  </td>
                  <td className="lft">
                    <RatingBadge
                      rating={
                        (p.gsis_id && schedByPlayer.get(p.gsis_id)?.schedule_rating) ||
                        null
                      }
                    />
                  </td>
                  <td className="lft">
                    {p.gsis_id && hasStats && (
                      <Link
                        href={`/players/${encodeURIComponent(p.gsis_id)}`}
                        className="whitespace-nowrap text-xs text-accent hover:underline"
                      >
                        matchup splits →
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RosterTab({ leagueId, status }: { leagueId: string; status: string }) {
  const [data, setData] = useState<LeagueRoster | null>(null);
  const [missing, setMissing] = useState(false);
  const [sched, setSched] = useState<ScheduleAdjustedPlayer[]>([]);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setMissing(false);
    (async () => {
      const [d, sp] = await Promise.all([
        tryGet(getLeagueRoster(leagueId)),
        tryGet(getScheduleAdjustedProjections(2026, undefined, 400)),
      ]);
      if (cancelled) return;
      if (!d) setMissing(true);
      setData(d);
      setSched(sp?.players ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  if (missing || (status === "pre_draft" && !data)) {
    return (
      <p className="rounded-lg border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
        Draft hasn&apos;t started yet — no roster to show.
      </p>
    );
  }
  if (!data) return <TableSkeleton rows={8} cols={5} />;

  const starters = data.players.filter((p) => p.is_starter);
  const bench = data.players.filter((p) => !p.is_starter);
  const schedByPlayer = new Map(sched.map((s) => [s.player_id, s]));
  const insights = rosterInsights(data.players);

  return (
    <>
      {insights.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-accent/30 bg-surface-2 px-3.5 py-3">
          <Lightbulb size={15} className="mt-0.5 shrink-0 text-accent" />
          <div className="text-xs leading-relaxed text-muted">
            <span className="mb-0.5 block font-semibold uppercase tracking-wider text-faint">
              Roster insights
            </span>
            {insights.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </div>
        </div>
      )}
      <RosterGroup
        title={`Starters (${starters.length})`}
        players={starters}
        schedByPlayer={schedByPlayer}
      />
      <RosterGroup
        title={`Bench (${bench.length})`}
        players={bench}
        schedByPlayer={schedByPlayer}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Standings tab                                                       */
/* ------------------------------------------------------------------ */

function StandingsTab({ leagueId }: { leagueId: string }) {
  const [data, setData] = useState<LeagueStandings | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    (async () => {
      const d = await tryGet(getLeagueStandings(leagueId));
      if (!cancelled) setData(d);
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  const cols = useMemo<ColumnDef<LeagueStandingRow, unknown>[]>(
    () => [
      { accessorKey: "rank", header: "Rank", meta: { align: "left" } },
      {
        accessorKey: "manager",
        header: "Manager",
        meta: { align: "left" },
        cell: (c) => {
          const r = c.row.original;
          return (
            <span
              className={
                r.is_me
                  ? "border-l-2 border-accent pl-2 font-bold text-accent"
                  : undefined
              }
            >
              {r.manager}
              {r.is_me && <span className="ml-1.5 text-[10px] text-faint">(me)</span>}
            </span>
          );
        },
      },
      {
        id: "record",
        header: "Record",
        accessorFn: (r) => r.wins,
        cell: (c) => {
          const r = c.row.original;
          return `${r.wins}-${r.losses}${r.ties ? `-${r.ties}` : ""}`;
        },
      },
      {
        accessorKey: "points",
        header: "PF",
        cell: (c) => c.getValue<number | null>()?.toFixed(1) ?? "—",
      },
      {
        accessorKey: "points_against",
        header: "PA",
        cell: (c) => c.getValue<number | null>()?.toFixed(1) ?? "—",
      },
    ],
    [],
  );

  if (!data) return <TableSkeleton rows={10} cols={5} />;
  return (
    <SortableTable
      data={data.standings}
      columns={cols}
      initialSort={[{ id: "rank", desc: false }]}
      emptyMessage="No standings yet."
    />
  );
}

/* ------------------------------------------------------------------ */
/* Matchups tab                                                        */
/* ------------------------------------------------------------------ */

function MatchupCard({
  game,
  emphasized,
}: {
  game: LeagueMatchups["matchups"][number];
  emphasized: boolean;
}) {
  const played = game.teams.some((t) => (t.points ?? 0) > 0);
  const maxPts = Math.max(...game.teams.map((t) => t.points ?? 0));
  return (
    <div
      className={
        "rounded-lg border bg-surface p-4 " +
        (emphasized
          ? "border-accent shadow-[0_0_0_1px_var(--color-accent)] sm:col-span-2"
          : "border-border")
      }
    >
      {emphasized && (
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-accent">
          My matchup
        </div>
      )}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {game.teams.map((t, i) => {
          const winner = played && (t.points ?? 0) === maxPts;
          return (
            <div
              key={t.roster_id}
              className={i === 0 ? "text-right" : "text-left"}
              style={{ gridColumn: i === 0 ? 1 : 3 }}
            >
              <div
                className={
                  "truncate text-sm " +
                  (t.is_me ? "font-bold text-accent" : "font-medium")
                }
              >
                {t.manager ?? "—"}
              </div>
              <div
                className={
                  "text-2xl font-bold tabular-nums " +
                  (played
                    ? winner
                      ? "text-grade-elite"
                      : "text-grade-bad"
                    : "text-faint")
                }
              >
                {played ? (t.points ?? 0).toFixed(1) : "—"}
              </div>
            </div>
          );
        })}
        <div
          className="text-xs font-semibold uppercase text-faint"
          style={{ gridColumn: 2, gridRow: 1 }}
        >
          vs
        </div>
      </div>
    </div>
  );
}

function MatchupsTab({ leagueId }: { leagueId: string }) {
  const [week, setWeek] = useState(1);
  const [data, setData] = useState<LeagueMatchups | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setMissing(false);
    (async () => {
      const d = await tryGet(getLeagueMatchups(leagueId, week));
      if (cancelled) return;
      if (!d) setMissing(true);
      setData(d);
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueId, week]);

  const games = data?.matchups ?? [];
  // My matchup first, then by matchup id.
  const ordered = [...games].sort((a, b) => {
    const aMe = a.teams.some((t) => t.is_me) ? 0 : 1;
    const bMe = b.teams.some((t) => t.is_me) ? 0 : 1;
    return aMe - bMe || (a.matchup_id ?? 99) - (b.matchup_id ?? 99);
  });
  const anyPlayed = games.some((g) => g.teams.some((t) => (t.points ?? 0) > 0));

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <label className="relative inline-flex items-center">
          <span className="sr-only">Week</span>
          <select
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
            className="appearance-none rounded-md border border-border bg-surface py-1.5 pl-3 pr-8 text-sm text-text outline-none transition-colors hover:border-accent focus:border-accent"
          >
            {Array.from({ length: 17 }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2.5 text-muted"
          />
        </label>
        {data && !anyPlayed && (
          <span className="text-xs text-faint">
            Week {week} hasn&apos;t been played yet.
          </span>
        )}
      </div>

      {missing ? (
        <p className="rounded-lg border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
          No matchups for week {week}.
        </p>
      ) : !data ? (
        <TableSkeleton rows={5} cols={3} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {ordered.map((g, i) => (
            <MatchupCard
              key={g.matchup_id ?? i}
              game={g}
              emphasized={g.teams.some((t) => t.is_me)}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function LeagueDetailInner() {
  const params = useParams<{ id: string }>();
  const leagueId = decodeURIComponent(params.id);
  const [tab, setTab] = useQueryState("tab", "roster");

  const [league, setLeague] = useState<MyLeague | null>(null);

  // League header data comes from the season list; try 2026 then walk back.
  useEffect(() => {
    let cancelled = false;
    setLeague(null);
    (async () => {
      for (const season of [2026, 2025, 2024, 2023]) {
        const d = await tryGet(getMyLeagues(season));
        const hit = d?.leagues.find((l) => l.league_id === leagueId);
        if (hit) {
          if (!cancelled) setLeague(hit);
          return;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 sm:px-6">
      <div className="mb-1 text-xs text-faint">
        <Link href="/my-leagues" className="hover:text-accent">
          My Leagues
        </Link>{" "}
        /
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            {league?.name ?? "League"}
          </h1>
          {league && <StatusBadge status={league.status} />}
        </div>
        {league && (
          <div className="text-sm text-muted">
            <span className="font-bold text-text">{league.my_record}</span>
            {" · "}
            {league.my_points?.toFixed(1) ?? "--"} pts
            {hasPlayed(league) && ` · #${league.my_standing} of ${league.total_rosters}`}
          </div>
        )}
      </div>

      <div className="mb-5 flex items-center gap-1 border-b border-border">
        {TABS.map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-pressed={active}
              className={
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors " +
                (active
                  ? "border-accent text-text"
                  : "border-transparent text-muted hover:text-text")
              }
            >
              {t === "roster" ? "My Roster" : t}
            </button>
          );
        })}
      </div>

      {tab === "standings" ? (
        <StandingsTab leagueId={leagueId} />
      ) : tab === "matchups" ? (
        <MatchupsTab leagueId={leagueId} />
      ) : (
        <RosterTab leagueId={leagueId} status={league?.status ?? ""} />
      )}
    </div>
  );
}

export default function LeagueDetailPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={10} cols={5} />}>
      <LeagueDetailInner />
    </Suspense>
  );
}
