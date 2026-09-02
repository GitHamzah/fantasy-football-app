"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  ConsistencyEntry,
  Projection,
  ScheduleAdjustedPlayer,
  Scoring,
  VorEntry,
  getConsistency,
  getProjections,
  getScheduleAdjustedProjections,
  getVOR,
  tryGet,
} from "@/lib/api";
import RatingBadge from "@/components/RatingBadge";
import GradeBar from "@/components/GradeBar";
import PlayerCard from "@/components/PlayerCard";
import PositionTabs from "@/components/PositionTabs";
import SeasonSelect from "@/components/SeasonSelect";
import SortableTable, {
  ColumnMeta,
  TableSkeleton,
} from "@/components/SortableTable";
import { useQueryState } from "@/components/useQueryState";

/** One row of the rankings table: a projection enriched from other endpoints. */
type Row = Projection & {
  vor_ppg: number | null;
  consistency_score: number | null;
  boom_pct: number | null;
};

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isNaN(n) ? null : n;
}

function ScheduleAdjustedTable({
  position,
  scoring,
}: {
  position: string;
  scoring: string;
}) {
  const [rows, setRows] = useState<ScheduleAdjustedPlayer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    (async () => {
      const d = await tryGet(
        getScheduleAdjustedProjections(
          2026,
          position === "ALL" ? undefined : position,
          400,
        ),
      );
      if (cancelled) return;
      if (!d) setError("Schedule-adjusted projections are unavailable right now.");
      setRows(d?.players ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [position]);

  const columns = useMemo<ColumnDef<ScheduleAdjustedPlayer, unknown>[]>(
    () => [
      {
        id: "rank",
        header: "#",
        cell: (c) => <span className="text-faint">{c.row.index + 1}</span>,
        meta: { align: "left", width: 44 },
        enableSorting: false,
      },
      {
        id: "player",
        header: "Player",
        accessorFn: (r) => r.player_name,
        meta: { align: "left", width: 230 },
        cell: (c) => {
          const r = c.row.original;
          return (
            <PlayerCard
              playerId={r.player_id}
              name={r.player_name}
              position={r.position}
              team={r.team}
              scoring={scoring}
            />
          );
        },
      },
      {
        id: "yds_g",
        header: "Proj Yds/G",
        accessorFn: (r) => r.avg_projected_yards,
        cell: (c) => c.getValue<number | null>()?.toFixed(1) ?? "--",
      },
      {
        id: "yds",
        header: "Proj Yds",
        accessorFn: (r) => r.total_projected_yards,
        cell: (c) => c.getValue<number | null>()?.toFixed(0) ?? "--",
      },
      {
        id: "tds",
        header: "Proj TDs",
        accessorFn: (r) => r.total_projected_tds,
        cell: (c) => c.getValue<number | null>()?.toFixed(1) ?? "--",
      },
      {
        id: "rating",
        header: "Rating",
        accessorFn: (r) => r.avg_matchup_score,
        meta: { align: "left" },
        cell: (c) => <RatingBadge rating={c.row.original.schedule_rating} />,
      },
      {
        id: "score",
        header: "Matchup Score",
        accessorFn: (r) => r.avg_matchup_score,
        cell: (c) => c.getValue<number | null>()?.toFixed(3) ?? "--",
      },
      {
        id: "ppg25",
        header: "2025 PPG",
        accessorFn: (r) => r.ppg_2025,
        cell: (c) => c.getValue<number | null>()?.toFixed(1) ?? "--",
      },
    ],
    [scoring],
  );

  if (error) {
    return (
      <p className="rounded-lg border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
        {error}
      </p>
    );
  }
  if (rows === null) return <TableSkeleton rows={14} cols={8} />;
  return (
    <>
      <SortableTable
        data={rows}
        columns={columns}
        initialSort={[{ id: "yds", desc: true }]}
        emptyMessage={`No schedule-adjusted projections${position !== "ALL" ? ` for ${position}` : ""}.`}
        maxHeight={760}
      />
      <p className="mt-2 text-xs text-faint">
        {rows.length} players · 2025 per-shell production weighted by each 2026
        opponent&apos;s coverage-shell tendencies · min 8 games in 2025
      </p>
    </>
  );
}

function RankingsInner() {
  const [seasonStr, setSeason] = useQueryState("season", "2026");
  const [position, setPosition] = useQueryState("position", "ALL");
  const [scoringStr] = useQueryState("scoring", "ppr");
  const [mode, setMode] = useQueryState("mode", "standard");

  const season = Number(seasonStr) || 2026;
  const scoring = scoringStr as Scoring;

  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    setDegraded([]);

    // Context columns come from the most recent completed season.
    const priorSeason = season - 1;

    (async () => {
      try {
        const projections = await getProjections(season, undefined, scoring, 300);

        // These two enrich the table but must not be able to break it: the
        // consistency endpoint currently 500s on the deployed Postgres backend.
        const [vor, consistency] = await Promise.all([
          tryGet<VorEntry[]>(getVOR(priorSeason, scoring, 300)),
          tryGet<ConsistencyEntry[]>(
            getConsistency(priorSeason, undefined, scoring, 300),
          ),
        ]);

        if (cancelled) return;

        const missing: string[] = [];
        if (!vor) missing.push("VOR");
        if (!consistency) missing.push("Consistency and boom rate");
        setDegraded(missing);

        const vorById = new Map((vor ?? []).map((v) => [v.player_id, v]));
        const conById = new Map((consistency ?? []).map((c) => [c.player_id, c]));

        setRows(
          projections.map((p) => {
            const v = vorById.get(p.player_id);
            const c = conById.get(p.player_id);
            return {
              ...p,
              projected_ppg: num(p.projected_ppg) ?? 0,
              projected_total: num(p.projected_total) ?? 0,
              last_season_ppg: num(p.last_season_ppg),
              vor_ppg: v ? num(v.vor_ppg) : null,
              consistency_score: c ? num(c.consistency_score) : null,
              boom_pct: c ? num(c.boom_pct) : null,
            };
          }),
        );
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load rankings");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [season, scoring]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    return position === "ALL" ? rows : rows.filter((r) => r.position === position);
  }, [rows, position]);

  const columns = useMemo<ColumnDef<Row, unknown>[]>(() => {
    const meta = (m: ColumnMeta) => m;
    return [
      {
        id: "rank",
        header: "#",
        accessorFn: (r) => (position === "ALL" ? r.overall_rank : r.pos_rank),
        cell: (c) => <span className="text-faint">{String(c.getValue())}</span>,
        meta: meta({ align: "left", width: 44 }),
      },
      {
        id: "player",
        header: "Player",
        accessorFn: (r) => r.player_name,
        cell: (c) => {
          const r = c.row.original;
          return (
            <PlayerCard
              playerId={r.player_id}
              name={r.player_name}
              position={r.position}
              team={r.team}
              scoring={scoring}
            />
          );
        },
        meta: meta({ align: "left", sticky: true, width: 250 }),
      },
      {
        id: "projected_ppg",
        header: "PPG",
        accessorFn: (r) => r.projected_ppg,
        cell: (c) => <GradeBar value={c.getValue() as number} min={4} max={22} />,
        meta: meta({ group: "PROJECTION" }),
      },
      {
        id: "projected_total",
        header: "Total",
        accessorFn: (r) => r.projected_total,
        cell: (c) => (
          <span className="tabular-nums">
            {(c.getValue() as number).toFixed(0)}
          </span>
        ),
        meta: meta({ group: "PROJECTION" }),
      },
      {
        id: "projected_games",
        header: "G",
        accessorFn: (r) => r.projected_games,
        meta: meta({ group: "PROJECTION" }),
      },
      {
        id: "age",
        header: "Age",
        accessorFn: (r) => r.age ?? null,
        cell: (c) => {
          const v = c.getValue() as number | null;
          return v ? v : <span className="text-faint">--</span>;
        },
        sortUndefined: "last",
        meta: meta({ group: "PROFILE" }),
      },
      {
        id: "vor_ppg",
        header: "VOR",
        accessorFn: (r) => r.vor_ppg,
        cell: (c) => (
          <GradeBar
            value={c.getValue() as number | null}
            min={-4}
            max={10}
            signed
            showBar={false}
          />
        ),
        sortUndefined: "last",
        meta: meta({ group: "PROFILE" }),
      },
      {
        id: "last_season_ppg",
        header: `${season - 1} PPG`,
        accessorFn: (r) => r.last_season_ppg,
        cell: (c) => {
          const v = c.getValue() as number | null;
          return v === null ? (
            <span className="text-faint">--</span>
          ) : (
            <span className="tabular-nums text-muted">{v.toFixed(1)}</span>
          );
        },
        sortUndefined: "last",
        meta: meta({ group: "PROFILE" }),
      },
      {
        id: "consistency_score",
        header: "Score",
        accessorFn: (r) => r.consistency_score,
        cell: (c) => (
          <GradeBar
            value={c.getValue() as number | null}
            min={0.6}
            max={2.4}
            decimals={2}
            showBar={false}
          />
        ),
        sortUndefined: "last",
        meta: meta({ group: "CONSISTENCY" }),
      },
      {
        id: "boom_pct",
        header: "Boom %",
        accessorFn: (r) => r.boom_pct,
        cell: (c) => {
          const v = c.getValue() as number | null;
          return v === null ? (
            <span className="text-faint">--</span>
          ) : (
            <span className="tabular-nums">{v.toFixed(0)}%</span>
          );
        },
        sortUndefined: "last",
        meta: meta({ group: "CONSISTENCY" }),
      },
      {
        id: "method",
        header: "Model",
        accessorFn: (r) => r.method,
        cell: (c) => {
          const v = String(c.getValue());
          const ml = v === "ml";
          return (
            <span
              className={
                "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide " +
                (ml ? "bg-accent/15 text-accent" : "bg-border text-muted")
              }
            >
              {ml ? "ML" : "AVG"}
            </span>
          );
        },
        meta: meta({ group: "CONSISTENCY" }),
      },
    ];
  }, [position, scoring, season]);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Fantasy Rankings
            <span className="ml-2 font-light text-muted">{season}</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            Projected points per game, ranked. Click any column to sort, or a
            player to open their profile.
          </p>
        </div>
        <SeasonSelect value={season} onChange={(s) => setSeason(String(s))} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PositionTabs value={position} onChange={setPosition} />
        <div className="flex items-center rounded-md border border-border bg-surface p-0.5">
          {[
            { v: "standard", label: "Standard Projections" },
            { v: "schedule", label: "Schedule-Adjusted" },
          ].map((m) => {
            const active = mode === m.v;
            return (
              <button
                key={m.v}
                onClick={() => setMode(m.v)}
                aria-pressed={active}
                className={
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors " +
                  (active ? "bg-accent text-white" : "text-muted hover:text-text")
                }
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {mode === "schedule" ? (
        <ScheduleAdjustedTable position={position} scoring={scoringStr} />
      ) : (
        <>
      {degraded.length > 0 && (
        <p className="mb-3 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted">
          {degraded.join(" and ")} unavailable from the API right now — those
          columns show as dashes. Everything else is live.
        </p>
      )}

      {error ? (
        <div className="rounded-lg border border-border bg-surface px-4 py-10 text-center">
          <p className="text-sm text-grade-bad">{error}</p>
          <p className="mt-1 text-xs text-muted">
            The API sleeps when idle and can take ~30s to wake. Try reloading.
          </p>
        </div>
      ) : !filtered ? (
        <TableSkeleton rows={14} cols={10} />
      ) : (
        <>
          <SortableTable
            data={filtered}
            columns={columns}
            initialSort={[{ id: "projected_ppg", desc: true }]}
            emptyMessage={`No ${position === "ALL" ? "" : position + " "}projections for ${season}.`}
            maxHeight={760}
          />
          <p className="mt-2 text-xs text-faint">
            {filtered.length} players
            {position !== "ALL" ? ` at ${position}` : ""} · VOR and consistency
            from {season - 1}
          </p>
        </>
      )}
        </>
      )}
    </>
  );
}

export default function RankingsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={14} cols={10} />}>
      <RankingsInner />
    </Suspense>
  );
}
