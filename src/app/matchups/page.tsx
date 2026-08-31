"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  DefenseRow,
  Scoring,
  TeamDefenseRow,
  TeamMatchup,
  TopPerformer,
  TopPerformers,
  getDefensiveRankings,
  getTeamDefense,
  getTeamMatchup,
  getTopPerformers,
  tryGet,
} from "@/lib/api";
import PlayerCard from "@/components/PlayerCard";
import TeamSelect, { InsightCard, epaBg, epaColor } from "@/components/TeamSelect";
import Tooltip, { metricTip } from "@/components/Tooltip";
import PositionTabs from "@/components/PositionTabs";
import SeasonSelect from "@/components/SeasonSelect";
import TeamLogo from "@/components/TeamLogo";
import SortableTable, { TableSkeleton } from "@/components/SortableTable";
import { useQueryState } from "@/components/useQueryState";
import { positionColor } from "@/components/PositionBadge";

const POSITIONS = ["QB", "RB", "WR", "TE"];

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isNaN(n) || v === null || v === undefined ? 0 : n;
}

/** Green = the defense concedes more than average, so a good matchup to attack. */
function heatColor(value: number, mean: number, spread: number): string {
  if (!spread) return "transparent";
  const z = Math.max(-1.6, Math.min(1.6, (value - mean) / spread));
  const t = (z + 1.6) / 3.2; // 0 = stingy, 1 = generous
  const alpha = 0.09 + Math.abs(z / 1.6) * 0.32;
  return t >= 0.5
    ? `rgba(46, 204, 113, ${alpha.toFixed(3)})`
    : `rgba(231, 76, 60, ${alpha.toFixed(3)})`;
}

function MCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="text-xl font-bold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-faint">
        {metricTip(label) ? (
          <Tooltip text={metricTip(label)!}>{label}</Tooltip>
        ) : (
          label
        )}
      </div>
    </div>
  );
}

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

/* ------------------------------------------------------------------ */
/* Team vs team, by defensive scheme                                   */
/* ------------------------------------------------------------------ */

function TeamVsTeamSection({ season }: { season: number }) {
  const [offense, setOffense] = useQueryState("off", "DAL");
  const [defense, setDefense] = useQueryState("def", "PHI");
  const [data, setData] = useState<TeamMatchup | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setMissing(false);
    (async () => {
      const d = await tryGet(getTeamMatchup(offense, defense, season));
      if (cancelled) return;
      if (!d) setMissing(true);
      setData(d);
    })();
    return () => {
      cancelled = true;
    };
  }, [offense, defense, season]);

  type PkgRow = TeamMatchup["by_package"][number];
  type ShellRow = TeamMatchup["by_shell"][number];

  const pkgCols = useMemo<ColumnDef<PkgRow, unknown>[]>(
    () => [
      { accessorKey: "def_package", header: "Package", meta: { align: "left" } },
      { accessorKey: "plays", header: "Plays" },
      {
        accessorKey: "pass_rate",
        header: "Pass%",
        cell: (c) => `${c.getValue<number>().toFixed(0)}%`,
      },
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
      {
        accessorKey: "success_rate",
        header: "Success%",
        cell: (c) => `${c.getValue<number>().toFixed(0)}%`,
      },
      { accessorKey: "touchdowns", header: "TDs" },
    ],
    [],
  );

  const shellCols = useMemo<ColumnDef<ShellRow, unknown>[]>(
    () => [
      { accessorKey: "coverage_shell", header: "Shell", meta: { align: "left" } },
      { accessorKey: "plays", header: "Plays" },
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
      {
        accessorKey: "success_rate",
        header: "Success%",
        cell: (c) => `${c.getValue<number>().toFixed(0)}%`,
      },
    ],
    [],
  );

  // Best and worst defensive look for this offense, among meaningful samples.
  const insight = useMemo(() => {
    const pkgs = (data?.by_package ?? []).filter(
      (r) => r.plays >= 10 && r.avg_yards !== null,
    );
    if (pkgs.length < 2) return null;
    const best = pkgs.reduce((x, y) => (y.avg_yards! > x.avg_yards! ? y : x));
    const worst = pkgs.reduce((x, y) => (y.avg_yards! < x.avg_yards! ? y : x));
    if (best === worst) return null;
    return (
      `${data!.offense} averaged ${best.avg_yards!.toFixed(1)} yds against ` +
      `${data!.defense}'s ${best.def_package} (${best.plays} plays) but only ` +
      `${worst.avg_yards!.toFixed(1)} yds against their ${worst.def_package} ` +
      `(${worst.plays} plays).`
    );
  }, [data]);

  return (
    <section className="mb-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Team vs Team Matchup
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <TeamSelect label="Offense" value={offense} onChange={setOffense} />
          <TeamSelect label="Defense" value={defense} onChange={setDefense} />
        </div>
      </div>

      {missing ? (
        <p className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-muted">
          No matchup data for {offense} vs {defense} in {season} — they may not
          have played.
        </p>
      ) : !data ? (
        <TableSkeleton rows={5} cols={6} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MCard
              label="Avg yards / play"
              value={data.overall.avg_yards?.toFixed(1) ?? "--"}
            />
            <MCard
              label="Success rate"
              value={`${data.overall.success_rate.toFixed(1)}%`}
            />
            <MCard
              label="Pass rate"
              value={`${data.overall.pass_rate.toFixed(1)}%`}
            />
            <MCard
              label="EPA / play"
              value={
                data.overall.avg_epa !== null
                  ? data.overall.avg_epa.toFixed(3)
                  : "--"
              }
              color={epaColor(data.overall.avg_epa)}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="min-w-0">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
                By defensive package
              </h3>
              <SortableTable
                data={data.by_package}
                columns={pkgCols}
                initialSort={[{ id: "plays", desc: true }]}
                emptyMessage="No package rows."
              />
            </div>
            <div className="min-w-0">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
                By coverage shell
              </h3>
              <SortableTable
                data={data.by_shell}
                columns={shellCols}
                initialSort={[{ id: "plays", desc: true }]}
                emptyMessage="No shell rows."
              />
            </div>
          </div>

          <InsightCard text={insight} />
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Top performers vs a defensive look                                  */
/* ------------------------------------------------------------------ */

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

function TopPerformersSection({
  season,
  scoring,
}: {
  season: number;
  scoring: string;
}) {
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
          d ?? {
            def_package: null,
            coverage_shell: null,
            season,
            position: null,
            players: [],
          },
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
        cell: (c) => (
          <span className="text-faint tabular-nums">{c.row.index + 1}</span>
        ),
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
      {
        id: "att",
        header: "Att",
        accessorFn: (r) => r.plays,
        cell: (c) => c.getValue<number>(),
      },
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
    <section className="mb-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Who thrives against this look?
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
    </section>
  );
}

function MatchupsInner() {
  const [seasonStr, setSeason] = useQueryState("season", "2025");
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
      if (!d) {
        setError(`Could not load defensive rankings for ${season}.`);
      }
      setDefense(d ?? []);
      setTeamDef(td ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [season, scoring]);

  // Pivot into team x position, and compute per-position mean/spread for coloring.
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
      const mean = vals.length
        ? vals.reduce((a, b) => a + b, 0) / vals.length
        : 0;
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
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Matchups
            <span className="ml-2 font-light text-muted">{season}</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            Fantasy points allowed per game by each defense. Green means the
            defense gives up more than average, so attack it.
          </p>
        </div>
        <SeasonSelect
          value={season}
          onChange={(s) => setSeason(String(s))}
          seasons={[2025, 2024, 2023, 2022, 2021]}
        />
      </div>

      <TeamVsTeamSection season={season} />

      <TopPerformersSection season={season} scoring={scoringStr} />

      <h2 className="mb-3 border-b border-border pb-2 text-sm font-semibold uppercase tracking-wider text-muted">
        Defense heat map
      </h2>
      <div className="mb-4">
        <PositionTabs value={position} onChange={setPosition} />
      </div>

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
                <tr
                  key={t}
                  onClick={() => setSelectedTeam(t)}
                  className="cursor-pointer"
                >
                  <td className="lft stick">
                    <TeamLogo team={t} size={18} />
                  </td>
                  {shownPositions.map((p) => {
                    const v = grid.get(t)?.[p] ?? 0;
                    return (
                      <td
                        key={p}
                        style={{
                          background: heatColor(
                            v,
                            stats[p]?.mean ?? 0,
                            stats[p]?.spread ?? 1,
                          ),
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

      {/* Team defense detail */}
      <section className="mt-8">
        <h2 className="mb-3 border-b border-border pb-2 text-sm font-semibold uppercase tracking-wider text-muted">
          Team defense profile
        </h2>

        {!teamDef?.length ? (
          <p className="text-sm text-muted">
            Team defense metrics are unavailable for {season}.
          </p>
        ) : !selected ? (
          <p className="text-sm text-muted">
            Select a defense from the table above.
          </p>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2">
              <TeamLogo team={selected.team} size={26} showAbbr={false} />
              <span className="text-lg font-semibold">{selected.team}</span>
              <span className="text-sm text-muted">
                {selected.games} games
              </span>
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
                <div
                  key={String(label)}
                  className="rounded-lg border border-border bg-surface px-3 py-2.5"
                >
                  <div className="text-lg font-bold tabular-nums">
                    {num(value).toFixed(1)}
                  </div>
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

export default function MatchupsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={16} cols={5} />}>
      <MatchupsInner />
    </Suspense>
  );
}
