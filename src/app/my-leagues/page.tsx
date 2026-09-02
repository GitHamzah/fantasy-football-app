"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { MyLeague, MyLeagues, getMyLeagues, tryGet } from "@/lib/api";
import { StatusBadge, hasPlayed } from "@/components/LeagueBits";
import SeasonSelect from "@/components/SeasonSelect";
import { TableSkeleton } from "@/components/SortableTable";
import { useQueryState } from "@/components/useQueryState";

/** Order leagues by how much there is to look at. */
const STATUS_ORDER: Record<string, number> = {
  in_season: 0,
  drafting: 1,
  pre_draft: 2,
  complete: 3,
};

function LeagueCard({ lg }: { lg: MyLeague }) {
  return (
    <Link
      href={`/my-leagues/${lg.league_id}`}
      className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-base font-bold">{lg.name}</span>
        <StatusBadge status={lg.status} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>{lg.total_rosters} teams</span>
        <span className="uppercase">{lg.scoring_type}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-4 border-t border-border-soft pt-3">
        <div>
          <div className="text-lg font-bold tabular-nums">{lg.my_record}</div>
          <div className="text-[10px] uppercase tracking-wider text-faint">
            My record
          </div>
        </div>
        <div>
          <div className="text-lg font-bold tabular-nums">
            {lg.my_points?.toFixed(1) ?? "--"}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-faint">
            Points
          </div>
        </div>
        <div>
          <div className="text-lg font-bold tabular-nums">
            {hasPlayed(lg) ? `#${lg.my_standing} of ${lg.total_rosters}` : "—"}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-faint">
            Standing
          </div>
        </div>
      </div>
    </Link>
  );
}

function MyLeaguesInner() {
  const [seasonStr, setSeason] = useQueryState("season", "2026");
  const season = Number(seasonStr) || 2026;
  const [data, setData] = useState<MyLeagues | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    (async () => {
      const d = await tryGet(getMyLeagues(season));
      if (cancelled) return;
      if (!d) setError(`No leagues found for ${season}.`);
      setData(d);
    })();
    return () => {
      cancelled = true;
    };
  }, [season]);

  const sorted = [...(data?.leagues ?? [])].sort(
    (a, b) =>
      (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) ||
      a.name.localeCompare(b.name),
  );

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          My Leagues <span className="font-light text-muted">— {season}</span>
        </h1>
        <SeasonSelect
          value={season}
          onChange={(s) => setSeason(String(s))}
          seasons={[2026, 2025, 2024, 2023]}
        />
      </div>

      {error ? (
        <p className="rounded-lg border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
          {error}
        </p>
      ) : data === null ? (
        <TableSkeleton rows={6} cols={3} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sorted.map((lg) => (
            <LeagueCard key={lg.league_id} lg={lg} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MyLeaguesPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={6} cols={3} />}>
      <MyLeaguesInner />
    </Suspense>
  );
}
