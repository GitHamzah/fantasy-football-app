"use client";

import { useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { ChevronDown } from "lucide-react";
import {
  MatchupStatBlock,
  PackageSplit,
  PlayerMatchups,
  PlayerVsTeam,
  ShellSplit,
  getPlayerMatchups,
  getPlayerVsTeam,
  tryGet,
} from "@/lib/api";
import SortableTable, { TableSkeleton } from "@/components/SortableTable";
import { InsightCard, NFL_TEAMS, epaBg, epaColor } from "@/components/TeamSelect";

/** What one opportunity is called, per role. */
const ATTEMPT_NOUN: Record<string, string> = {
  "WR/TE": "target",
  RB: "carry",
  QB: "dropback",
};

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

function attempts(b: MatchupStatBlock): number {
  return b.plays;
}
function completions(b: MatchupStatBlock): number | null {
  return b.receptions ?? b.completions ?? null;
}

/**
 * "Performance by defensive look" for the player detail page: package and
 * shell splits, a collapsible package x shell detail, and an optional
 * single-opponent filter. Renders nothing when the player has no matchup
 * data (kickers, defenders, pre-2021 seasons).
 */
export default function PlayerVsDefense({
  playerId,
  playerName,
  season,
}: {
  playerId: string;
  playerName: string;
  season: number;
}) {
  const [data, setData] = useState<PlayerMatchups | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [vsTeam, setVsTeam] = useState<string>("");
  const [vsData, setVsData] = useState<PlayerVsTeam | null>(null);
  const [vsMissing, setVsMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setLoaded(false);
    setVsTeam("");
    (async () => {
      const d = await tryGet(getPlayerMatchups(playerId, season));
      if (cancelled) return;
      setData(d);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [playerId, season]);

  useEffect(() => {
    if (!vsTeam) {
      setVsData(null);
      setVsMissing(false);
      return;
    }
    let cancelled = false;
    setVsData(null);
    setVsMissing(false);
    (async () => {
      const d = await tryGet(getPlayerVsTeam(playerId, vsTeam, season));
      if (cancelled) return;
      if (!d) setVsMissing(true);
      setVsData(d);
    })();
    return () => {
      cancelled = true;
    };
  }, [playerId, vsTeam, season]);

  const role = data?.role ?? "WR/TE";
  const noun = ATTEMPT_NOUN[role] ?? "play";
  const attHeader = noun === "target" ? "Targets" : noun === "carry" ? "Carries" : "Dropbacks";
  const hasComp = role !== "RB";

  const pkgCols = useMemo<ColumnDef<PackageSplit, unknown>[]>(() => {
    const cols: ColumnDef<PackageSplit, unknown>[] = [
      { accessorKey: "def_package", header: "Package", meta: { align: "left" } },
      { id: "att", header: attHeader, accessorFn: (r) => attempts(r) },
    ];
    if (hasComp) {
      cols.push({
        id: "comp",
        header: role === "QB" ? "Comp" : "Rec",
        accessorFn: (r) => completions(r),
        cell: (c) => c.getValue<number | null>() ?? "--",
      });
    }
    cols.push(
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
    );
    return cols;
  }, [attHeader, hasComp, role]);

  const shellCols = useMemo<ColumnDef<ShellSplit, unknown>[]>(
    () => [
      { accessorKey: "coverage_shell", header: "Shell", meta: { align: "left" } },
      { id: "att", header: attHeader, accessorFn: (r) => attempts(r) },
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
    [attHeader],
  );

  // Best and worst look, from the shell splits with a usable sample.
  const insight = useMemo(() => {
    const shells = (data?.by_shell ?? []).filter(
      (r) => r.plays >= 5 && r.avg_yards !== null,
    );
    if (shells.length < 2) return null;
    const best = shells.reduce((x, y) => (y.avg_yards! > x.avg_yards! ? y : x));
    const worst = shells.reduce((x, y) => (y.avg_yards! < x.avg_yards! ? y : x));
    if (best === worst) return null;
    return (
      `${playerName} averages ${best.avg_yards!.toFixed(1)} yds/${noun} against ` +
      `${best.coverage_shell} (${attempts(best)} ${noun}s, ${best.tds} TDs) but only ` +
      `${worst.avg_yards!.toFixed(1)} yds against ${worst.coverage_shell} ` +
      `(${attempts(worst)} ${noun}s).`
    );
  }, [data, playerName, noun]);

  if (loaded && !data) return null; // no matchup coverage for this player

  const activePkg = vsData ? vsData.by_package : data?.by_package ?? [];
  const activeShell = vsData ? vsData.by_shell : data?.by_shell ?? [];

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          vs Defense — {season}
        </h2>
        <label className="relative inline-flex items-center">
          <span className="sr-only">Filter to one defense</span>
          <select
            value={vsTeam}
            onChange={(e) => setVsTeam(e.target.value)}
            className="appearance-none rounded-md border border-border bg-surface py-1.5 pl-3 pr-8 text-sm text-text outline-none transition-colors hover:border-accent focus:border-accent"
          >
            <option value="">All defenses</option>
            {NFL_TEAMS.map((t) => (
              <option key={t} value={t}>
                vs {t}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2.5 text-muted"
          />
        </label>
      </div>

      {!loaded ? (
        <TableSkeleton rows={4} cols={6} />
      ) : vsTeam && vsMissing ? (
        <p className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-muted">
          No data vs {vsTeam} in {season} — they may not have met.
        </p>
      ) : vsTeam && !vsData ? (
        <TableSkeleton rows={4} cols={6} />
      ) : (
        <>
          {vsData && (
            <p className="mb-3 text-xs text-muted">
              vs {vsData.vs_team}: {attempts(vsData.total)} {noun}s,{" "}
              {vsData.total.yards?.toFixed(0) ?? 0} yards, {vsData.total.tds}{" "}
              TDs,{" "}
              <span style={{ color: epaColor(vsData.total.avg_epa) }}>
                {vsData.total.avg_epa?.toFixed(3) ?? "--"} EPA
              </span>{" "}
              per {noun}
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="min-w-0">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
                By package
              </h3>
              <SortableTable
                data={activePkg}
                columns={pkgCols}
                initialSort={[{ id: "att", desc: true }]}
                emptyMessage="No package splits."
              />
            </div>
            <div className="min-w-0">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
                By coverage shell
              </h3>
              <SortableTable
                data={activeShell}
                columns={shellCols}
                initialSort={[{ id: "att", desc: true }]}
                emptyMessage="No shell splits."
              />
            </div>
          </div>

          {!vsTeam && <InsightCard text={insight} />}

          {!vsTeam && (data?.by_package_and_shell.length ?? 0) > 0 && (
            <details className="mt-4 rounded-lg border border-border bg-surface px-4 py-3">
              <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wider text-muted hover:text-text">
                Detailed splits — package × shell (
                {data!.by_package_and_shell.length} rows)
              </summary>
              <div className="mt-3 overflow-auto">
                <table className="tbl">
                  <thead>
                    <tr className="cols">
                      <th className="lft">Package</th>
                      <th className="lft">Shell</th>
                      <th>{attHeader}</th>
                      <th>Yards</th>
                      <th>TDs</th>
                      <th>Avg Yds</th>
                      <th>EPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.by_package_and_shell.map((r, i) => (
                      <tr key={i}>
                        <td className="lft">{r.def_package}</td>
                        <td className="lft">{r.coverage_shell}</td>
                        <td>{attempts(r)}</td>
                        <td>{r.yards?.toFixed(0) ?? "--"}</td>
                        <td>{r.tds}</td>
                        <td>{r.avg_yards?.toFixed(1) ?? "--"}</td>
                        <td>
                          <EpaCell value={r.avg_epa} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}
