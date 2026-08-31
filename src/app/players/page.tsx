"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Search } from "lucide-react";
import {
  LeaderEntry,
  PlayerSummary,
  Projection,
  Scoring,
  getProjections,
  getSeasonLeaders,
  searchPlayers,
  tryGet,
} from "@/lib/api";
import PlayerCard from "@/components/PlayerCard";
import PositionTabs from "@/components/PositionTabs";
import SortableTable, { TableSkeleton } from "@/components/SortableTable";
import { useQueryState } from "@/components/useQueryState";

const CURRENT_SEASON = 2025;
const TARGET_SEASON = 2026;

type Row = {
  player_id: string;
  player_name: string;
  position: string | null;
  team: string | null;
  games: number | null;
  ppg: number | null;
  proj_ppg: number | null;
};

function PlayersInner() {
  const [scoringStr] = useQueryState("scoring", "ppr");
  const scoring = scoringStr as Scoring;
  const [position, setPosition] = useQueryState("position", "ALL");
  const [query, setQuery] = useQueryState("q", "");
  const [typed, setTyped] = useState(query);

  const [leaders, setLeaders] = useState<LeaderEntry[] | null>(null);
  const [projections, setProjections] = useState<Projection[] | null>(null);
  const [found, setFound] = useState<PlayerSummary[] | null>(null);

  // Debounce typing into the URL-backed query state.
  useEffect(() => {
    const t = setTimeout(() => {
      if (typed !== query) setQuery(typed);
    }, 300);
    return () => clearTimeout(t);
  }, [typed, query, setQuery]);

  // Base data: 2025 production and 2026 projections, joined client-side.
  useEffect(() => {
    let cancelled = false;
    setLeaders(null);
    (async () => {
      const [l, p] = await Promise.all([
        tryGet(
          getSeasonLeaders(
            CURRENT_SEASON,
            position === "ALL" ? undefined : position,
            scoring,
            100,
          ),
        ),
        tryGet(getProjections(TARGET_SEASON, undefined, scoring, 300)),
      ]);
      if (cancelled) return;
      setLeaders(l ?? []);
      setProjections(p ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [scoring, position]);

  // Name search, position-aware.
  useEffect(() => {
    if (!query.trim()) {
      setFound(null);
      return;
    }
    let cancelled = false;
    setFound(null);
    (async () => {
      const r = await tryGet(
        searchPlayers(query.trim(), position === "ALL" ? undefined : position),
      );
      if (!cancelled) setFound(r ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [query, position]);

  const rows = useMemo<Row[] | null>(() => {
    if (leaders === null) return null;
    const projById = new Map(
      (projections ?? []).map((p) => [p.player_id, p.projected_ppg]),
    );
    const leaderById = new Map(leaders.map((l) => [l.player_id, l]));

    if (query.trim()) {
      if (found === null) return null;
      return found.map((p) => {
        const l = leaderById.get(p.player_id);
        return {
          player_id: p.player_id,
          player_name: p.player_name ?? p.player_id,
          position: p.position,
          team: p.current_team ?? l?.team ?? null,
          games: l?.games_played ?? null,
          ppg: l?.ppg ?? null,
          proj_ppg: projById.get(p.player_id) ?? null,
        };
      });
    }

    return leaders
      .filter((l) => position === "ALL" || l.position === position)
      .slice(0, 50)
      .map((l) => ({
        player_id: l.player_id,
        player_name: l.player_name,
        position: l.position,
        team: l.team,
        games: l.games_played,
        ppg: l.ppg,
        proj_ppg: projById.get(l.player_id) ?? null,
      }));
  }, [leaders, projections, found, query, position]);

  const cols = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        id: "player",
        header: "Player",
        accessorFn: (r) => r.player_name,
        meta: { align: "left", width: 240 },
        cell: (c) => {
          const r = c.row.original;
          return (
            <PlayerCard
              playerId={r.player_id}
              name={r.player_name}
              position={r.position}
              team={r.team}
              scoring={scoringStr}
            />
          );
        },
      },
      {
        id: "games",
        header: "G",
        accessorFn: (r) => r.games,
        cell: (c) => c.getValue<number | null>() ?? "--",
      },
      {
        id: "ppg",
        header: `${CURRENT_SEASON} PPG`,
        accessorFn: (r) => r.ppg,
        cell: (c) => c.getValue<number | null>()?.toFixed(1) ?? "--",
      },
      {
        id: "proj",
        header: `Proj ${TARGET_SEASON} PPG`,
        accessorFn: (r) => r.proj_ppg,
        cell: (c) => {
          const v = c.getValue<number | null>();
          return v !== null ? (
            <span className="font-semibold text-accent tabular-nums">
              {v.toFixed(1)}
            </span>
          ) : (
            "--"
          );
        },
      },
    ],
    [scoringStr],
  );

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Players</h1>
        <p className="mt-1 text-sm text-muted">
          Search any player, or browse the top 50 by {CURRENT_SEASON} points
          per game.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative flex-1 basis-64">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            type="search"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Search players…"
            className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text outline-none transition-colors placeholder:text-faint hover:border-accent focus:border-accent"
          />
        </label>
        <PositionTabs value={position} onChange={setPosition} />
      </div>

      {rows === null ? (
        <TableSkeleton rows={14} cols={4} />
      ) : (
        <SortableTable
          data={rows}
          columns={cols}
          initialSort={query.trim() ? [] : [{ id: "ppg", desc: true }]}
          emptyMessage={
            query.trim()
              ? `No players match "${query.trim()}".`
              : "No players found."
          }
        />
      )}
      {!query.trim() && rows !== null && (
        <p className="mt-2 text-xs text-faint">
          Top {rows.length} fantasy-relevant players by {CURRENT_SEASON} PPG.
          Projections shown for {TARGET_SEASON}.
        </p>
      )}
    </div>
  );
}

export default function PlayersBrowsePage() {
  return (
    <Suspense fallback={<TableSkeleton rows={14} cols={4} />}>
      <PlayersInner />
    </Suspense>
  );
}
