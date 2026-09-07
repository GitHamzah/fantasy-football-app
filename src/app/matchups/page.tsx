"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { ChevronDown, ChevronRight, ArrowLeftRight, X } from "lucide-react";
import {
  DefenseRow,
  GameMatchupResponse,
  GameWeekGame,
  MatchupDefPlayer,
  MatchupOffPlayer,
  PositionMatchupGroup,
  Scoring,
  TeamDefenseRow,
  TopPerformer,
  TopPerformers,
  getDefFormations,
  getDefensiveRankings,
  getGameMatchup,
  getGamesWeek,
  getTeamDefense,
  getTopPerformers,
  tryGet,
} from "@/lib/api";
import {
  GradedDefense,
  GradedDefenseField,
  GradedOffense,
  GradedOffenseField,
  tierColor,
} from "@/components/GradedFields";
import PlayerCard from "@/components/PlayerCard";
import PositionTabs from "@/components/PositionTabs";
import SeasonSelect from "@/components/SeasonSelect";
import SortableTable, { TableSkeleton } from "@/components/SortableTable";
import TeamLogo from "@/components/TeamLogo";
import { epaBg, epaColor } from "@/components/TeamSelect";
import { useQueryState } from "@/components/useQueryState";
import { positionColor } from "@/components/PositionBadge";

const POSITIONS = ["QB", "RB", "WR", "TE"];

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isNaN(n) || v === null || v === undefined ? 0 : n;
}

/* ================================================================== */
/* TAB 1: Game matchups                                                */
/* ================================================================== */

const DEF_BUCKET: Record<string, "DL" | "LB" | "CB" | "S"> = {
  DE: "DL", DT: "DL", NT: "DL", DL: "DL",
  LB: "LB", MLB: "LB", ILB: "LB", OLB: "LB", SLB: "LB", WLB: "LB",
  CB: "CB",
  FS: "S", SS: "S", SAF: "S", S: "S", DB: "S",
};

const PKG_FRONTS: Record<string, { dl: number; lb: number; db: number }> = {
  Nickel: { dl: 4, lb: 2, db: 5 },
  Dime: { dl: 4, lb: 1, db: 6 },
  "4-3 Base": { dl: 4, lb: 3, db: 4 },
  "3-4 Base": { dl: 3, lb: 4, db: 4 },
  Quarter: { dl: 3, lb: 1, db: 7 },
  "Goal Line": { dl: 5, lb: 3, db: 3 },
};

/** Shell-adjusted display grade: shift by how the player's production in the
    selected shell compares to their own overall average (±6 pts per yard). */
function shellAdjustedGrade(p: MatchupOffPlayer, shell: string | null): number | null {
  if (p.grade == null || !shell) return p.grade;
  const shells = p.vs_defense_shell ?? {};
  const entries = Object.values(shells).filter((s) => s.avg_yards != null);
  const tot = entries.reduce((a, s) => a + s.attempts, 0);
  if (!tot) return p.grade;
  const overall = entries.reduce((a, s) => a + s.avg_yards! * s.attempts, 0) / tot;
  const sh = shells[shell];
  if (!sh || sh.avg_yards == null) return p.grade;
  return Math.max(0, Math.min(100, Math.round(p.grade + (sh.avg_yards - overall) * 6)));
}

function GradeBig({ grade, label }: { grade: number | null; label: string }) {
  return (
    <div className="text-center">
      <div className="text-4xl font-bold tabular-nums" style={{ color: tierColor(grade) }}>
        {grade ?? "—"}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-faint">{label}</div>
    </div>
  );
}

function EdgePill({ edge }: { edge: number | null }) {
  if (edge === null) return null;
  const off = edge > 0;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-bold tabular-nums"
      style={{
        color: off ? "#2ecc71" : "#e74c3c",
        background: off ? "rgba(46,204,113,0.12)" : "rgba(231,76,60,0.12)",
      }}
    >
      {edge > 0 ? "▲" : "▼"} {edge > 0 ? "+" : ""}
      {edge.toFixed(1)} {off ? "Offense" : "Defense"}
    </span>
  );
}

/* ---- slide-out player panel ---- */

function PlayerPanel({
  player,
  side,
  onClose,
}: {
  player:
    | { kind: "off"; p: MatchupOffPlayer; pos: string }
    | { kind: "def"; p: MatchupDefPlayer }
    | null;
  side: string;
  onClose: () => void;
}) {
  if (!player) return null;
  const p = player.p;
  const shells =
    player.kind === "off" ? (player.p.vs_defense_shell ?? {}) : {};
  const maxAvg = Math.max(
    1,
    ...Object.values(shells).map((s) => s.avg_yards ?? 0),
  );
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-sm overflow-y-auto border-l border-border bg-surface p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-bold">{p.name}</div>
            <div className="text-xs text-muted">
              {player.kind === "off" ? player.pos : (p as MatchupDefPlayer).position} · {side}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted hover:bg-surface-2 hover:text-text"
            aria-label="Close panel"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white"
            style={{ background: tierColor(p.grade) }}
          >
            {p.grade != null ? Math.round(p.grade) : "—"}
          </div>
          <div>
            <div className="text-sm font-semibold">{p.grade_label ?? "—"}</div>
            {"confidence" in p && p.confidence === "low" && (
              <div className="text-xs text-faint">low-confidence grade</div>
            )}
          </div>
        </div>

        {player.kind === "off" && (
          <>
            {player.p.ppg != null && (
              <p className="mb-3 text-sm text-muted">
                2025: <span className="font-semibold text-text">{player.p.ppg.toFixed(1)} PPG</span>
              </p>
            )}
            {player.p.vs_this_defense && (
              <div className="mb-4 rounded-lg border border-border bg-surface-2 p-3 text-sm">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-faint">
                  vs this defense (2025)
                </div>
                {player.p.vs_this_defense.attempts} att ·{" "}
                {player.p.vs_this_defense.yards ?? 0} yds ·{" "}
                {player.p.vs_this_defense.tds} TD ·{" "}
                {player.p.vs_this_defense.avg_yards ?? "—"} avg
              </div>
            )}
            {Object.keys(shells).length > 0 && (
              <div className="mb-4">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-faint">
                  By coverage shell (yds/att)
                </div>
                {Object.entries(shells).map(([shell, s]) => (
                  <div key={shell} className="mb-1.5 flex items-center gap-2 text-xs">
                    <span className="w-20 shrink-0 text-muted">{shell}</span>
                    <div className="h-3 flex-1 rounded bg-border-soft">
                      <div
                        className="h-3 rounded bg-accent"
                        style={{
                          width: `${(100 * (s.avg_yards ?? 0)) / maxAvg}%`,
                        }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right tabular-nums">
                      {s.avg_yards?.toFixed(1) ?? "—"} ({s.attempts})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {player.kind === "def" && player.p.pfr && (
          <div className="mb-4 rounded-lg border border-border bg-surface-2 p-3 text-sm">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-faint">
              2025 PFR profile ({player.p.pfr.games} games)
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {player.p.pfr.comp_pct_allowed != null && (
                <span>Comp allowed: <b>{player.p.pfr.comp_pct_allowed}%</b></span>
              )}
              {player.p.pfr.yards_per_tgt != null && (
                <span>Yds/tgt: <b>{player.p.pfr.yards_per_tgt}</b></span>
              )}
              {player.p.pfr.passer_rating != null && (
                <span>Rating allowed: <b>{player.p.pfr.passer_rating}</b></span>
              )}
              <span>INTs: <b>{player.p.pfr.ints}</b></span>
              <span>Sacks: <b>{player.p.pfr.sacks}</b></span>
              <span>Pressures/g: <b>{player.p.pfr.pressures_pg}</b></span>
              {player.p.pfr.missed_tackle_pct != null && (
                <span>Missed tkl: <b>{player.p.pfr.missed_tackle_pct}%</b></span>
              )}
              <span>Tackles/g: <b>{player.p.pfr.tackles_pg}</b></span>
            </div>
          </div>
        )}

        {p.gsis_id && (
          <Link
            href={`/players/${encodeURIComponent(p.gsis_id)}`}
            className="text-sm font-medium text-accent hover:underline"
          >
            View full profile →
          </Link>
        )}
      </aside>
    </>
  );
}

/* ---- position group cards ---- */

function GroupCard({
  g,
  expanded,
  onToggle,
}: {
  g: PositionMatchupGroup;
  expanded: boolean;
  onToggle: () => void;
}) {
  const off = (g.edge ?? 0) > 0;
  const skill = g.offense_players.filter((p) => p.grade != null);
  const pairs = Array.from(
    { length: Math.max(skill.length, g.defense_players.length) },
    (_, i) => [skill[i], g.defense_players[i]] as const,
  );
  return (
    <div
      className="min-w-[250px] flex-1 rounded-lg border bg-surface p-3"
      style={{
        borderColor:
          g.edge === null
            ? "var(--color-border)"
            : off
              ? "rgba(46,204,113,0.45)"
              : "rgba(231,76,60,0.45)",
      }}
    >
      <button className="w-full text-left" onClick={onToggle} aria-expanded={expanded}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider">{g.group}</span>
          <ChevronRight
            size={13}
            className={"text-faint transition-transform " + (expanded ? "rotate-90" : "")}
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-2xl font-bold tabular-nums" style={{ color: tierColor(g.offense_grade) }}>
            {g.offense_grade ?? "—"}
          </span>
          <span className="text-[10px] uppercase text-faint">vs</span>
          <span className="text-2xl font-bold tabular-nums" style={{ color: tierColor(g.defense_grade) }}>
            {g.defense_grade ?? "—"}
          </span>
        </div>
        <div className="mt-1.5">
          <EdgePill edge={g.edge} />
        </div>
        <p className="mt-2 text-[11px] leading-snug text-muted">{g.insight}</p>
      </button>

      {expanded && pairs.length > 0 && (
        <table className="mt-3 w-full text-[11px]">
          <tbody>
            {pairs.map(([o, d], i) => (
              <tr key={i} className="border-t border-border-soft">
                <td className="max-w-[90px] truncate py-1 pr-1">{o?.name ?? "—"}</td>
                <td
                  className="py-1 pr-2 text-right font-bold tabular-nums"
                  style={{ color: tierColor(o?.grade ?? null) }}
                >
                  {o?.grade != null ? Math.round(o.grade) : "—"}
                </td>
                <td className="py-1 text-center text-faint">vs</td>
                <td className="max-w-[90px] truncate py-1 pl-2">{d?.name ?? "—"}</td>
                <td
                  className="py-1 text-right font-bold tabular-nums"
                  style={{ color: tierColor(d?.grade ?? null) }}
                >
                  {d?.grade != null ? Math.round(d.grade) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ---- matchup detail ---- */

function MatchupDetail({
  home,
  away,
  season,
}: {
  home: string;
  away: string;
  season: number;
}) {
  const [data, setData] = useState<GameMatchupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flip, setFlip] = useState(false); // false = away offense (default)
  const [pkg, setPkg] = useState<string | null>(null);
  const [shell, setShell] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [panel, setPanel] = useState<
    | { kind: "off"; p: MatchupOffPlayer; pos: string }
    | { kind: "def"; p: MatchupDefPlayer }
    | null
  >(null);
  const [pkgSplits, setPkgSplits] = useState<Record<string, { grouping: string; pct: number }[]>>({});

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    setFlip(false);
    setPkg(null);
    setShell(null);
    setExpanded(null);
    setPanel(null);
    (async () => {
      const d = await tryGet(getGameMatchup(home, away, season));
      if (cancelled) return;
      if (!d) setError(`No matchup data for ${away} @ ${home}.`);
      setData(d);
      // Defensive package splits (2025) for the look selector, both teams.
      const [h, a] = await Promise.all([
        tryGet(getDefFormations(2025, home)),
        tryGet(getDefFormations(2025, away)),
      ]);
      if (cancelled) return;
      setPkgSplits({
        [home]: (h?.personnel ?? []).map((x) => ({ grouping: x.grouping, pct: x.pct })),
        [away]: (a?.personnel ?? []).map((x) => ({ grouping: x.grouping, pct: x.pct })),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [home, away, season]);

  const view = useMemo(() => {
    if (!data) return null;
    const offTeam = flip ? home : away;
    const defTeam = flip ? away : home;
    const groups = data.position_matchups.filter((g) => g.offense_team === offTeam);
    const byGroup = (name: string) => groups.find((g) => g.group === name);

    const offense: GradedOffense = {
      QB: byGroup("QB vs Pass Rush")?.offense_players ?? [],
      RB: byGroup("RB vs Front 7")?.offense_players ?? [],
      WR: byGroup("WR vs CB")?.offense_players ?? [],
      TE: byGroup("TE vs LB/S")?.offense_players ?? [],
      OL: byGroup("OL vs DL")?.offense_players ?? [],
    };
    const dedupe = (ps: MatchupDefPlayer[]) => {
      const seen = new Set<string>();
      return ps.filter((p) => !seen.has(p.gsis_id) && seen.add(p.gsis_id));
    };
    const front7 = byGroup("RB vs Front 7")?.defense_players ?? [];
    const coverage = byGroup("QB vs Coverage")?.defense_players ?? [];
    const defense: GradedDefense = {
      DL: dedupe(byGroup("QB vs Pass Rush")?.defense_players ?? []),
      LB: dedupe(front7.filter((p) => DEF_BUCKET[p.position] === "LB")),
      CB: dedupe(byGroup("WR vs CB")?.defense_players ?? []),
      S: dedupe(coverage.filter((p) => DEF_BUCKET[p.position] === "S")),
    };

    const fc = data.formation_context;
    const offCtx = offTeam === home ? fc.home_offense : fc.away_offense;
    const defCtx = defTeam === home ? fc.home_defense : fc.away_defense;
    const s = data.matchup_summary;
    const offGrade = offTeam === home ? s.home_offense_grade : s.away_offense_grade;
    const offLabel = offTeam === home ? s.home_offense_label : s.away_offense_label;
    const defGrade = defTeam === home ? s.home_defense_grade : s.away_defense_grade;
    const defLabel = defTeam === home ? s.home_defense_label : s.away_defense_label;
    const edge = offTeam === home ? s.home_edge : s.away_edge;

    return { offTeam, defTeam, groups, offense, defense, offCtx, defCtx,
             offGrade, offLabel, defGrade, defLabel, edge };
  }, [data, flip, home, away]);

  if (error) {
    return (
      <p className="mt-4 rounded-lg border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
        {error}
      </p>
    );
  }
  if (!data || !view) {
    return (
      <div className="mt-4 space-y-3">
        <div className="skeleton h-24 rounded-lg" />
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="skeleton h-[380px] rounded-lg" />
          <div className="skeleton h-[380px] rounded-lg" />
        </div>
        <TableSkeleton rows={3} cols={6} />
      </div>
    );
  }

  const { offTeam, defTeam, groups, offense, defense, offCtx, defCtx } = view;
  const activePkg = pkg ?? defCtx.top_package ?? "Nickel";
  const front = PKG_FRONTS[activePkg] ?? { dl: 4, lb: 2, db: 5 };
  const shellPcts = defCtx.shells ?? {};

  return (
    <div className="mt-4">
      {/* summary bar */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div className="flex min-w-0 items-center justify-center gap-3 sm:justify-end">
            <div className="text-right">
              <div className="text-base font-bold">{offTeam}</div>
              <div className="text-[10px] uppercase tracking-wider text-faint">Offense</div>
            </div>
            <TeamLogo team={offTeam} size={38} showAbbr={false} />
            <GradeBig grade={view.offGrade} label={view.offLabel} />
          </div>
          <div className="text-center">
            <div className="text-xs font-semibold uppercase text-faint">vs</div>
            <EdgePill edge={view.edge} />
          </div>
          <div className="flex min-w-0 items-center justify-center gap-3 sm:justify-start">
            <GradeBig grade={view.defGrade} label={view.defLabel} />
            <TeamLogo team={defTeam} size={38} showAbbr={false} />
            <div>
              <div className="text-base font-bold">{defTeam}</div>
              <div className="text-[10px] uppercase tracking-wider text-faint">Defense</div>
            </div>
          </div>
        </div>
        <p className="mt-3 border-t border-border-soft pt-2 text-center text-xs text-muted">
          {data.matchup_summary.headline}
        </p>
      </div>

      {/* flip toggle */}
      <div className="mt-3 flex justify-center">
        <button
          onClick={() => {
            setFlip(!flip);
            setExpanded(null);
          }}
          className="flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-1.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-text"
        >
          <ArrowLeftRight size={14} className="text-accent" />
          {offTeam} Offense vs {defTeam} Defense — flip
        </button>
      </div>

      {/* look selector */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {(pkgSplits[defTeam] ?? []).slice(0, 4).map((k) => {
          const active = activePkg === k.grouping;
          return (
            <button
              key={k.grouping}
              onClick={() => setPkg(k.grouping)}
              aria-pressed={active}
              className={
                "rounded-full border px-3 py-1 text-xs font-medium tabular-nums transition-colors " +
                (active
                  ? "border-accent bg-accent/15 text-text"
                  : "border-border bg-surface-2 text-muted hover:text-text")
              }
            >
              {k.grouping} ({k.pct.toFixed(0)}%)
            </button>
          );
        })}
        <span className="mx-1 text-faint">·</span>
        {Object.entries(shellPcts).map(([sh, pct]) => {
          const active = shell === sh;
          return (
            <button
              key={sh}
              onClick={() => setShell(active ? null : sh)}
              aria-pressed={active}
              className={
                "rounded-full border px-3 py-1 text-xs font-medium tabular-nums transition-colors " +
                (active
                  ? "border-accent bg-accent/15 text-text"
                  : "border-border bg-surface-2 text-muted hover:text-text")
              }
            >
              {sh} ({pct.toFixed(0)}%)
            </button>
          );
        })}
      </div>
      {shell && (
        <p className="mt-1 text-center text-[11px] text-faint">
          Offensive grades adjusted for production vs {shell} (approximate).
        </p>
      )}

      {/* dual fields */}
      <div className="mt-4 grid items-start gap-3 lg:grid-cols-[1fr_auto_1fr]">
        <div className="min-w-0">
          <h3 className="mb-1.5 text-center text-xs font-semibold uppercase tracking-wider text-muted">
            {offTeam} offense · {offCtx.top_formation ?? "SHOTGUN"} / {offCtx.top_personnel ?? "11"}
          </h3>
          <GradedOffenseField
            formation={offCtx.top_formation ?? "SHOTGUN"}
            personnelGrouping={offCtx.top_personnel ?? "11"}
            players={offense}
            displayGrade={(p) => shellAdjustedGrade(p, shell)}
            onSelect={(p, pos) => setPanel({ kind: "off", p, pos })}
          />
        </div>
        <div className="hidden items-center self-center lg:flex">
          <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-bold uppercase text-faint">
            vs
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="mb-1.5 text-center text-xs font-semibold uppercase tracking-wider text-muted">
            {defTeam} defense · {activePkg}
            {shell ? ` / ${shell}` : ""}
          </h3>
          <GradedDefenseField
            front={front}
            shell={shell}
            players={defense}
            onSelect={(p) => setPanel({ kind: "def", p })}
          />
        </div>
      </div>
      <p className="mt-1 text-center text-[11px] text-faint">
        Circle numbers are 0-100 matchup grades · hover for the stat card ·
        click a player for the full breakdown
      </p>

      {/* position group cards */}
      <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
        {groups.map((g) => (
          <GroupCard
            key={g.group}
            g={g}
            expanded={expanded === g.group}
            onToggle={() => setExpanded(expanded === g.group ? null : g.group)}
          />
        ))}
      </div>

      {/* head to head */}
      <details className="mt-4 rounded-lg border border-border bg-surface px-4 py-3">
        <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wider text-muted hover:text-text">
          2025 head-to-head
          {data.head_to_head.games_played_2025
            ? ` — ${data.head_to_head.games_played_2025} meeting${data.head_to_head.games_played_2025 > 1 ? "s" : ""}`
            : " — no prior meetings"}
        </summary>
        {data.head_to_head.games_played_2025 > 0 && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {(
              [
                [`${home} offense vs ${away}`, data.head_to_head.home_off_vs_away_def],
                [`${away} offense vs ${home}`, data.head_to_head.away_off_vs_home_def],
              ] as const
            ).map(([label, sideData]) =>
              sideData ? (
                <div key={label}>
                  <div className="mb-1.5 text-xs font-semibold text-muted">{label}</div>
                  <div className="text-sm">
                    {sideData.plays} plays · {sideData.avg_yards} yds/play ·{" "}
                    <span style={{ color: epaColor(sideData.avg_epa) }}>
                      {sideData.avg_epa > 0 ? "+" : ""}
                      {sideData.avg_epa} EPA
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {sideData.by_shell.map((s) => (
                      <div key={s.shell} className="flex items-center gap-2 text-xs">
                        <span className="w-20 shrink-0 text-faint">{s.shell}</span>
                        <div className="h-2.5 flex-1 rounded bg-border-soft">
                          <div
                            className="h-2.5 rounded"
                            style={{
                              width: `${Math.min(100, (s.avg_yards ?? 0) * 9)}%`,
                              background: epaBg(s.avg_epa),
                              minWidth: 4,
                            }}
                          />
                        </div>
                        <span className="w-24 shrink-0 text-right tabular-nums text-muted">
                          {s.avg_yards ?? "—"} yds · {s.plays} plays
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null,
            )}
          </div>
        )}
      </details>

      <PlayerPanel player={panel} side={panel?.kind === "off" ? offTeam : defTeam} onClose={() => setPanel(null)} />
    </div>
  );
}

/* ---- tab shell: week bar + game cards + detail ---- */

function GameMatchupsTab() {
  const [seasonStr, setSeason] = useQueryState("season", "2026");
  const [weekStr, setWeek] = useQueryState("week", "1");
  const [game, setGame] = useQueryState("game", "");
  const season = Number(seasonStr) || 2026;
  const week = Number(weekStr) || 1;

  const [games, setGames] = useState<GameWeekGame[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setGames(null);
    setError(null);
    (async () => {
      const d = await tryGet(getGamesWeek(season, week));
      if (cancelled) return;
      if (!d) setError(`No games for ${season} week ${week}.`);
      setGames(d?.games ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [season, week]);

  // Auto-select the first game of the week when nothing is chosen.
  const parsed = game.includes("@") ? game.split("@") : null;
  const valid =
    parsed && games?.some((g) => g.away_team === parsed[0] && g.home_team === parsed[1]);
  const active = valid
    ? { away: parsed![0], home: parsed![1] }
    : games?.length
      ? { away: games[0].away_team, home: games[0].home_team }
      : null;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <SeasonSelect
          value={season}
          onChange={(s) => {
            setSeason(String(s));
            setGame("");
          }}
          seasons={[2026]}
        />
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-md border border-border bg-surface p-1">
          {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
            <button
              key={w}
              onClick={() => {
                setWeek(String(w));
                setGame("");
              }}
              aria-pressed={w === week}
              className={
                "shrink-0 rounded px-2.5 py-1 text-xs font-medium tabular-nums transition-colors " +
                (w === week ? "bg-accent text-white" : "text-muted hover:text-text")
              }
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
          {error}
        </p>
      ) : games === null ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {games.map((g) => {
            const isActive =
              active && g.home_team === active.home && g.away_team === active.away;
            return (
              <button
                key={g.game_id}
                onClick={() => setGame(`${g.away_team}@${g.home_team}`)}
                aria-pressed={!!isActive}
                className={
                  "rounded-lg border bg-surface px-3 py-2.5 text-left transition-colors " +
                  (isActive
                    ? "border-accent shadow-[0_0_0_1px_var(--color-accent)]"
                    : "border-border hover:border-faint")
                }
              >
                <div className="flex items-center justify-center gap-2">
                  <TeamLogo team={g.away_team} size={22} />
                  <span className="text-xs text-faint">@</span>
                  <TeamLogo team={g.home_team} size={22} />
                </div>
                <div className="mt-1 text-center text-[10px] text-faint">
                  {g.weekday ?? ""} {g.gametime ?? ""}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {active && (
        <MatchupDetail home={active.home} away={active.away} season={season} />
      )}
    </>
  );
}

/* ================================================================== */
/* TAB 2: Defense heat map (ported unchanged)                          */
/* ================================================================== */

function heatColor(value: number, mean: number, spread: number): string {
  if (!spread) return "transparent";
  const z = Math.max(-1.6, Math.min(1.6, (value - mean) / spread));
  const t = (z + 1.6) / 3.2;
  const alpha = 0.09 + Math.abs(z / 1.6) * 0.32;
  return t >= 0.5
    ? `rgba(46, 204, 113, ${alpha.toFixed(3)})`
    : `rgba(231, 76, 60, ${alpha.toFixed(3)})`;
}

function HeatMapTab() {
  const [seasonStr, setSeason] = useQueryState("hseason", "2025");
  const [position, setPosition] = useQueryState("position", "ALL");
  const [scoringStr] = useQueryState("scoring", "ppr");
  const season = Number(seasonStr) || 2025;
  const scoring = scoringStr as Scoring;

  const [defense, setDefense] = useState<DefenseRow[] | null>(null);
  const [teamDef, setTeamDef] = useState<TeamDefenseRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDefense(null);
    setTeamDef(null);
    setError(null);
    (async () => {
      const [d, td] = await Promise.all([
        tryGet(getDefensiveRankings(season, scoring)),
        tryGet(getTeamDefense(season)),
      ]);
      if (cancelled) return;
      if (!d) setError(`Could not load defensive rankings for ${season}.`);
      setDefense(d ?? []);
      setTeamDef(td ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [season, scoring]);

  const { teams, grid, stats } = useMemo(() => {
    const g = new Map<string, Record<string, number>>();
    for (const r of defense ?? []) {
      const row = g.get(r.defense) ?? {};
      row[r.position] = num(r.avg_pts_allowed);
      g.set(r.defense, row);
    }
    const st: Record<string, { mean: number; spread: number }> = {};
    for (const p of POSITIONS) {
      const vals = [...g.values()].map((r) => r[p]).filter((v) => v > 0);
      const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      const variance = vals.length
        ? vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length
        : 0;
      st[p] = { mean, spread: Math.sqrt(variance) || 1 };
    }
    const shown = position === "ALL" ? POSITIONS : [position];
    const sortKey = shown[0];
    const sorted = [...g.keys()].sort(
      (a, b) => (g.get(b)?.[sortKey] ?? 0) - (g.get(a)?.[sortKey] ?? 0),
    );
    return { teams: sorted, grid: g, stats: st };
  }, [defense, position]);

  const shownPositions = position === "ALL" ? POSITIONS : [position];
  const selected = teamDef?.find((t) => t.team === selectedTeam) ?? null;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PositionTabs value={position} onChange={setPosition} />
        <SeasonSelect
          value={season}
          onChange={(s) => setSeason(String(s))}
          seasons={[2025, 2024, 2023, 2022, 2021]}
        />
      </div>
      <p className="mb-3 text-sm text-muted">
        Fantasy points allowed per game by each defense. Green means the defense
        gives up more than average, so attack it.
      </p>

      {error && (
        <p className="mb-3 rounded-md border border-border bg-surface px-3 py-2 text-xs text-grade-bad">
          {error}
        </p>
      )}

      {defense === null ? (
        <TableSkeleton rows={16} cols={5} />
      ) : teams.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface px-4 py-10 text-center text-sm text-muted">
          No defensive data for {season}.
        </div>
      ) : (
        <div className="max-h-[600px] overflow-auto rounded-lg border border-border">
          <table className="tbl">
            <thead>
              <tr className="cols">
                <th className="lft stick">Defense</th>
                {shownPositions.map((p) => (
                  <th key={p} style={{ color: positionColor(p) }}>
                    vs {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t} onClick={() => setSelectedTeam(t)} className="cursor-pointer">
                  <td className="lft stick">
                    <TeamLogo team={t} size={18} />
                  </td>
                  {shownPositions.map((p) => {
                    const v = grid.get(t)?.[p] ?? 0;
                    return (
                      <td
                        key={p}
                        style={{
                          background: heatColor(v, stats[p]?.mean ?? 0, stats[p]?.spread ?? 1),
                        }}
                      >
                        {v ? v.toFixed(1) : "--"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-2 text-xs text-faint">
        {teams.length} defenses · click a row to see that unit&apos;s pressure and
        coverage profile
      </p>

      <section className="mt-8">
        <h2 className="mb-3 border-b border-border pb-2 text-sm font-semibold uppercase tracking-wider text-muted">
          Team defense profile
        </h2>
        {!teamDef?.length ? (
          <p className="text-sm text-muted">
            Team defense metrics are unavailable for {season}.
          </p>
        ) : !selected ? (
          <p className="text-sm text-muted">Select a defense from the table above.</p>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2">
              <TeamLogo team={selected.team} size={26} showAbbr={false} />
              <span className="text-lg font-semibold">{selected.team}</span>
              <span className="text-sm text-muted">{selected.games} games</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ["Sacks / g", selected.sacks_pg],
                ["QB hits / g", selected.qb_hits_pg],
                ["INT / g", selected.interceptions_pg],
                ["Pass def / g", selected.pass_defended_pg],
                ["Forced FUM / g", selected.fumbles_forced_pg],
                ["Pressure / g", selected.pressure_pg],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border border-border bg-surface px-3 py-2.5">
                  <div className="text-lg font-bold tabular-nums">{num(value).toFixed(1)}</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wider text-faint">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}

/* ================================================================== */
/* TAB 3: Top performers (ported unchanged)                            */
/* ================================================================== */

function EpaCell({ value }: { value: number | null | undefined }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 tabular-nums"
      style={{ background: epaBg(value), color: epaColor(value) }}
    >
      {value !== null && value !== undefined ? value.toFixed(3) : "--"}
    </span>
  );
}

const PKG_OPTIONS = ["All", "Nickel", "4-3 Base", "3-4 Base", "Dime", "Quarter"];
const SHELL_OPTIONS = ["All", "2-High", "1-High", "Loaded Box"];
const POS_OPTIONS = ["All", "QB", "RB", "WR", "TE"];

function FilterPills({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center rounded-md border border-border bg-surface p-0.5">
      {options.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            onClick={() => onChange(o)}
            aria-pressed={active}
            className={
              "rounded px-2.5 py-1 text-xs font-medium transition-colors " +
              (active ? "bg-accent text-white" : "text-muted hover:text-text")
            }
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function TopPerformersTab() {
  const [scoringStr] = useQueryState("scoring", "ppr");
  const season = 2025;
  const scoring = scoringStr;
  const [pkg, setPkg] = useState("Nickel");
  const [shell, setShell] = useState("All");
  const [pos, setPos] = useState("WR");
  const [data, setData] = useState<TopPerformers | null>(null);

  const noLook = pkg === "All" && shell === "All";

  useEffect(() => {
    if (noLook) return;
    let cancelled = false;
    setData(null);
    (async () => {
      const d = await tryGet(
        getTopPerformers({
          season,
          def_package: pkg === "All" ? undefined : pkg,
          coverage_shell: shell === "All" ? undefined : shell,
          position: pos === "All" ? undefined : pos,
          limit: 20,
        }),
      );
      if (!cancelled)
        setData(
          d ?? { def_package: null, coverage_shell: null, season, position: null, players: [] },
        );
    })();
    return () => {
      cancelled = true;
    };
  }, [season, pkg, shell, pos, noLook]);

  const cols = useMemo<ColumnDef<TopPerformer, unknown>[]>(
    () => [
      {
        id: "rank",
        header: "#",
        cell: (c) => <span className="text-faint tabular-nums">{c.row.index + 1}</span>,
        meta: { align: "left" },
        enableSorting: false,
      },
      {
        id: "player",
        header: "Player",
        accessorFn: (r) => r.player_name,
        meta: { align: "left" },
        cell: (c) => {
          const r = c.row.original;
          return (
            <PlayerCard
              playerId={r.player_id}
              name={r.player_name}
              position={pos !== "All" ? pos : r.role === "WR/TE" ? "WR" : r.role}
              team={r.team}
              scoring={scoring}
            />
          );
        },
      },
      { id: "att", header: "Att", accessorFn: (r) => r.plays, cell: (c) => c.getValue<number>() },
      {
        accessorKey: "yards",
        header: "Yards",
        cell: (c) => c.getValue<number | null>()?.toFixed(0) ?? "--",
      },
      { accessorKey: "tds", header: "TDs" },
      {
        accessorKey: "avg_yards",
        header: "Avg Yds",
        cell: (c) => c.getValue<number | null>()?.toFixed(1) ?? "--",
      },
      {
        accessorKey: "avg_epa",
        header: "EPA",
        cell: (c) => <EpaCell value={c.getValue<number | null>()} />,
      },
    ],
    [scoring, pos],
  );

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Who thrives against this look? — {season}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <FilterPills options={PKG_OPTIONS} value={pkg} onChange={setPkg} />
          <FilterPills options={SHELL_OPTIONS} value={shell} onChange={setShell} />
          <FilterPills options={POS_OPTIONS} value={pos} onChange={setPos} />
        </div>
      </div>

      {noLook ? (
        <p className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-muted">
          Pick a defensive package or coverage shell to rank against.
        </p>
      ) : data === null ? (
        <TableSkeleton rows={10} cols={7} />
      ) : (
        <>
          <SortableTable
            data={data.players}
            columns={cols}
            emptyMessage={`No qualifying players for this look in ${season}.`}
          />
          <p className="mt-2 text-xs text-faint">
            Minimum 20 opportunities against the selected look. Sorted by total
            yards; click headers to re-sort.
          </p>
        </>
      )}
    </>
  );
}

/* ================================================================== */
/* Page shell                                                          */
/* ================================================================== */

const TABS = [
  { id: "games", label: "Game Matchups" },
  { id: "heatmap", label: "Defense Heat Map" },
  { id: "performers", label: "Top Performers" },
];

function MatchupsInner() {
  const [tab, setTab] = useQueryState("tab", "games");

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Matchups</h1>
        <div className="flex items-center gap-1 border-b border-transparent">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-pressed={active}
                className={
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                  (active ? "bg-surface text-text" : "text-muted hover:text-text")
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "heatmap" ? (
        <HeatMapTab />
      ) : tab === "performers" ? (
        <TopPerformersTab />
      ) : (
        <GameMatchupsTab />
      )}
    </div>
  );
}

export default function MatchupsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={16} cols={5} />}>
      <MatchupsInner />
    </Suspense>
  );
}
