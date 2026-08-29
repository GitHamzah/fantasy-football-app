"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  FormationBreakdownRow,
  FormationRoster,
  LeagueFormationRow,
  LeagueFormations,
  TeamFormations,
  getFormationRoster,
  getFormations,
  getLeagueFormations,
  tryGet,
} from "@/lib/api";
import FormationField from "@/components/FormationField";
import SeasonSelect from "@/components/SeasonSelect";
import SortableTable, { TableSkeleton } from "@/components/SortableTable";
import TeamLogo from "@/components/TeamLogo";
import { useQueryState } from "@/components/useQueryState";
import { ChevronDown } from "lucide-react";

const TEAMS = [
  "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE",
  "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAX", "KC",
  "LA", "LAC", "LV", "MIA", "MIN", "NE", "NO", "NYG",
  "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WAS",
];

// Formation data starts in 2021; no 2026 rows exist yet.
const SEASONS = [2025, 2024, 2023, 2022, 2021];

function TeamSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Team</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-md border border-border bg-surface py-1.5 pl-3 pr-8 text-sm text-text outline-none transition-colors hover:border-accent focus:border-accent"
      >
        {TEAMS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 text-muted"
      />
    </label>
  );
}

function FormationCardSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-4">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton mt-3 h-7 w-16" />
          <div className="skeleton mt-2 h-2.5 w-20" />
        </div>
      ))}
    </div>
  );
}

function FormationsInner() {
  const [seasonStr, setSeason] = useQueryState("season", "2025");
  const [team, setTeam] = useQueryState("team", "KC");
  const season = Number(seasonStr) || 2025;

  const [data, setData] = useState<TeamFormations | null>(null);
  const [roster, setRoster] = useState<FormationRoster | null>(null);
  const [league, setLeague] = useState<LeagueFormations | null>(null);
  const [error, setError] = useState<string | null>(null);

  // null = "use the team's most-run option"; set by clicking a card / pill.
  const [formationSel, setFormationSel] = useState<string | null>(null);
  const [groupingSel, setGroupingSel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setRoster(null);
    setError(null);
    setFormationSel(null);
    setGroupingSel(null);

    (async () => {
      const [d, r] = await Promise.all([
        tryGet(getFormations(season, team)),
        tryGet(getFormationRoster(team, season)),
      ]);
      if (cancelled) return;
      if (!d) setError(`No formation data for ${team} in ${season}.`);
      setData(d);
      setRoster(r);
    })();

    return () => {
      cancelled = true;
    };
  }, [season, team]);

  useEffect(() => {
    let cancelled = false;
    setLeague(null);
    (async () => {
      const l = await tryGet(getLeagueFormations(season));
      if (!cancelled) setLeague(l);
    })();
    return () => {
      cancelled = true;
    };
  }, [season]);

  const activeFormation =
    formationSel ?? data?.formations[0]?.formation ?? "SHOTGUN";

  // Personnel pills for the active formation, most-run first.
  const groupings = useMemo(
    () =>
      (data?.breakdown ?? []).filter(
        (b) => b.formation === activeFormation && b.grouping !== null,
      ),
    [data, activeFormation],
  );
  const activeGrouping = groupingSel ?? groupings[0]?.grouping ?? "11";

  const breakdownCols = useMemo<ColumnDef<FormationBreakdownRow, unknown>[]>(
    () => [
      {
        accessorKey: "formation",
        header: "Formation",
        meta: { align: "left" },
        cell: (c) => (
          <span className="font-medium">{c.getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "grouping",
        header: "Personnel",
        meta: { align: "left" },
        cell: (c) => {
          const row = c.row.original;
          return row.grouping ? (
            <span>
              <span className="font-semibold tabular-nums">{row.grouping}</span>
              <span className="ml-2 text-faint">{row.label}</span>
            </span>
          ) : (
            <span className="text-faint">unparsed</span>
          );
        },
      },
      { accessorKey: "play_count", header: "Plays" },
      {
        accessorKey: "pct",
        header: "Pct",
        cell: (c) => `${c.getValue<number>().toFixed(1)}%`,
      },
      {
        accessorKey: "avg_box",
        header: "Avg Box",
        cell: (c) => c.getValue<number | null>()?.toFixed(1) ?? "--",
      },
    ],
    [],
  );

  const leagueCols = useMemo<ColumnDef<LeagueFormationRow, unknown>[]>(
    () => [
      {
        accessorKey: "team",
        header: "Team",
        meta: { align: "left" },
        cell: (c) => (
          <button
            className="hover:text-accent"
            onClick={() => setTeam(c.getValue<string>())}
            title="View this team's formations"
          >
            <TeamLogo team={c.getValue<string>()} />
          </button>
        ),
      },
      { accessorKey: "total_plays", header: "Plays" },
      {
        accessorKey: "shotgun_pct",
        header: "Shotgun",
        cell: (c) => `${c.getValue<number>().toFixed(1)}%`,
      },
      {
        accessorKey: "under_center_pct",
        header: "Under Center",
        cell: (c) => `${c.getValue<number>().toFixed(1)}%`,
      },
      {
        accessorKey: "pistol_pct",
        header: "Pistol",
        cell: (c) => `${c.getValue<number>().toFixed(1)}%`,
      },
      {
        accessorKey: "top_personnel",
        header: "Top Personnel",
        meta: { align: "left" },
        cell: (c) => {
          const row = c.row.original;
          return row.top_personnel ? (
            <span>
              <span className="font-semibold tabular-nums">
                {row.top_personnel}
              </span>
              <span className="ml-2 text-faint">{row.top_personnel_label}</span>
            </span>
          ) : (
            "--"
          );
        },
      },
    ],
    [setTeam],
  );

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight">
          Team Formations{" "}
          <span className="font-light text-muted">— {season}</span>
        </h1>
        <div className="flex items-center gap-2">
          <TeamSelect value={team} onChange={setTeam} />
          <SeasonSelect value={season} onChange={(s) => setSeason(String(s))} seasons={SEASONS} />
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-muted">
          {error}
        </div>
      )}

      {/* Formation split cards */}
      {!data && !error ? (
        <FormationCardSkeleton />
      ) : data ? (
        <div
          className={`grid gap-3 sm:grid-cols-3 ${
            data.formations.length > 3 ? "lg:grid-cols-4" : ""
          }`}
        >
          {data.formations.map((f) => {
            const active = f.formation === activeFormation;
            return (
              <button
                key={f.formation}
                onClick={() => {
                  setFormationSel(f.formation);
                  setGroupingSel(null);
                }}
                aria-pressed={active}
                className={
                  "rounded-lg border bg-surface p-4 text-left transition-colors " +
                  (active
                    ? "border-accent shadow-[0_0_0_1px_var(--color-accent)]"
                    : "border-border hover:border-faint")
                }
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {f.formation}
                </div>
                <div className="mt-1.5 text-2xl font-bold tabular-nums">
                  {f.pct.toFixed(1)}%
                </div>
                <div className="mt-0.5 text-xs text-faint">
                  {f.play_count.toLocaleString()} plays
                  {f.avg_box !== null && ` · ${f.avg_box.toFixed(1)} in box`}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Field */}
      {data && (
        <section className="mt-5 rounded-lg border border-border bg-surface p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider">
              {activeFormation}
              <span className="ml-2 font-medium normal-case text-muted">
                — {activeGrouping} Personnel
              </span>
            </h2>
            <span className="text-xs text-faint">
              hover a player for the full name
            </span>
          </div>

          <div className="flex justify-center">
            <FormationField
              formation={activeFormation}
              personnel={roster?.players ?? {}}
              personnelGrouping={activeGrouping}
            />
          </div>

          {/* Personnel pills for this formation */}
          {groupings.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {groupings.map((g) => {
                const active = g.grouping === activeGrouping;
                return (
                  <button
                    key={g.grouping}
                    onClick={() => setGroupingSel(g.grouping)}
                    aria-pressed={active}
                    title={g.label ?? undefined}
                    className={
                      "rounded-full border px-3 py-1 text-xs font-medium tabular-nums transition-colors " +
                      (active
                        ? "border-accent bg-accent/15 text-text"
                        : "border-border bg-surface-2 text-muted hover:border-faint hover:text-text")
                    }
                  >
                    {g.grouping} ({g.pct.toFixed(0)}%)
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Breakdown table */}
      <section className="mt-6">
        <h2 className="mb-2.5 text-sm font-bold uppercase tracking-wider text-muted">
          Formation × Personnel Breakdown
        </h2>
        {!data && !error ? (
          <TableSkeleton rows={8} cols={5} />
        ) : data ? (
          <SortableTable
            data={data.breakdown}
            columns={breakdownCols}
            initialSort={[{ id: "play_count", desc: true }]}
            emptyMessage="No breakdown rows."
          />
        ) : null}
      </section>

      {/* League comparison */}
      <section className="mt-8">
        <h2 className="mb-2.5 text-sm font-bold uppercase tracking-wider text-muted">
          League Formation Tendencies — {season}
        </h2>
        {season <= 2022 && (
          <p className="mb-2.5 text-xs text-faint">
            2021–22 uses the legacy formation vocabulary (SINGLEBACK, I-FORM,
            EMPTY, …), so shotgun / under-center / pistol splits cover only part
            of those teams&apos; snaps.
          </p>
        )}
        {league === null ? (
          <TableSkeleton rows={16} cols={6} />
        ) : (
          <SortableTable
            data={league.teams}
            columns={leagueCols}
            initialSort={[{ id: "shotgun_pct", desc: true }]}
            emptyMessage={`No league data for ${season}.`}
          />
        )}
      </section>
    </div>
  );
}

export default function FormationsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={16} cols={5} />}>
      <FormationsInner />
    </Suspense>
  );
}
