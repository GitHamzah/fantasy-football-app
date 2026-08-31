"use client";

import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import Tooltip, { metricTip } from "./Tooltip";

/**
 * The core data table. Sorting cycles asc -> desc -> none on header click.
 *
 * Column grouping is expressed by giving columns a `meta.group` label; adjacent
 * columns sharing a label render under one spanning header, matching the
 * FORMULA | CONTEXT style of the reference site.
 */
export type ColumnMeta = {
  group?: string;
  align?: "left" | "right";
  sticky?: boolean;
  width?: number;
};

// Numeric compare that coerces values (so "10.4" sorts as a number, never
// alphabetically) and treats null/undefined/NaN as -Infinity, which lands
// them last under the descending sort every stat column starts with.
function numericSort<T>(
  rowA: { getValue: (id: string) => unknown },
  rowB: { getValue: (id: string) => unknown },
  columnId: string,
): number {
  const coerce = (v: unknown) => {
    const n = typeof v === "string" ? Number(v) : (v as number);
    return v === null || v === undefined || Number.isNaN(n) ? -Infinity : n;
  };
  const a = coerce(rowA.getValue(columnId));
  const b = coerce(rowB.getValue(columnId));
  return a === b ? 0 : a > b ? 1 : -1;
}

export default function SortableTable<T>({
  data,
  columns,
  initialSort,
  emptyMessage = "No rows.",
  maxHeight = 600,
}: {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  initialSort?: SortingState;
  emptyMessage?: string;
  /** Tables taller than this scroll inside their container. Default 600px. */
  maxHeight?: number;
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSort ?? []);

  // Right-aligned columns are numeric by this app's convention; force the
  // coercing numeric sort on any of them that has no explicit sortingFn.
  const numericColumns = useMemo(
    () =>
      columns.map((c) => {
        const align = (c.meta as ColumnMeta | undefined)?.align;
        if (align === "left" || c.sortingFn) return c;
        return { ...c, sortingFn: numericSort<T> };
      }),
    [columns],
  );

  const table = useReactTable({
    data,
    columns: numericColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const leafColumns = table.getVisibleLeafColumns();
  const hasGroups = leafColumns.some(
    (c) => (c.columnDef.meta as ColumnMeta | undefined)?.group,
  );

  // Collapse adjacent columns with the same group label into spans.
  const groupSpans: { label: string; span: number }[] = [];
  if (hasGroups) {
    for (const col of leafColumns) {
      const label = (col.columnDef.meta as ColumnMeta | undefined)?.group ?? "";
      const last = groupSpans[groupSpans.length - 1];
      if (last && last.label === label) last.span += 1;
      else groupSpans.push({ label, span: 1 });
    }
  }

  if (!data.length) {
    return (
      <div className="rounded-lg border border-border bg-surface px-4 py-10 text-center text-sm text-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className="overflow-auto rounded-lg border border-border"
      style={{ maxHeight }}
    >
      <table className="tbl">
        <thead>
          {hasGroups && (
            <tr className="grp">
              {groupSpans.map((g, i) => (
                <th
                  key={`${g.label}-${i}`}
                  colSpan={g.span}
                  className={i > 0 && g.label ? "grp-start" : undefined}
                  style={{ textAlign: i === 0 ? "left" : "center" }}
                >
                  {g.label}
                </th>
              ))}
            </tr>
          )}
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="cols">
              {hg.headers.map((header, idx) => {
                const meta = header.column.columnDef.meta as
                  | ColumnMeta
                  | undefined;
                const sortable = header.column.getCanSort();
                const dir = header.column.getIsSorted();
                const prevGroup =
                  idx > 0
                    ? (hg.headers[idx - 1].column.columnDef.meta as
                        | ColumnMeta
                        | undefined)?.group
                    : undefined;
                const startsGroup =
                  hasGroups && idx > 0 && meta?.group !== prevGroup;

                const cls = [
                  sortable ? "sortable" : "",
                  meta?.align === "left" ? "lft" : "",
                  meta?.sticky ? "stick" : "",
                  startsGroup ? "grp-start" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <th
                    key={header.id}
                    className={cls || undefined}
                    style={meta?.width ? { minWidth: meta.width } : undefined}
                    onClick={
                      sortable
                        ? header.column.getToggleSortingHandler()
                        : undefined
                    }
                    title={sortable ? "Click to sort" : undefined}
                  >
                    <span
                      className={
                        "inline-flex items-center gap-1 " +
                        (meta?.align === "left" ? "" : "justify-end")
                      }
                    >
                      {(() => {
                        const rendered = flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        );
                        const tip = metricTip(header.column.columnDef.header);
                        return tip ? (
                          <Tooltip text={tip} side="bottom">{rendered}</Tooltip>
                        ) : (
                          rendered
                        );
                      })()}
                      {sortable && (
                        <span className="text-faint">
                          {dir === "asc" ? (
                            <ChevronUp size={12} className="text-accent" />
                          ) : dir === "desc" ? (
                            <ChevronDown size={12} className="text-accent" />
                          ) : (
                            <ChevronsUpDown size={11} className="opacity-40" />
                          )}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell, idx) => {
                const meta = cell.column.columnDef.meta as
                  | ColumnMeta
                  | undefined;
                const prevGroup =
                  idx > 0
                    ? (row.getVisibleCells()[idx - 1].column.columnDef.meta as
                        | ColumnMeta
                        | undefined)?.group
                    : undefined;
                const startsGroup =
                  hasGroups && idx > 0 && meta?.group !== prevGroup;
                const cls = [
                  meta?.align === "left" ? "lft" : "",
                  meta?.sticky ? "stick" : "",
                  startsGroup ? "grp-start" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <td key={cell.id} className={cls || undefined}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Loading placeholder shaped like a table, so layout does not jump. */
export function TableSkeleton({
  rows = 12,
  cols = 8,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex gap-3 border-b border-border bg-[#0d1320] px-3 py-2.5">
        {Array.from({ length: cols }).map((_, i) => (
          <div
            key={i}
            className="skeleton h-2.5"
            style={{ width: i === 0 ? 130 : 58 }}
          />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex gap-3 border-b border-border-soft px-3 py-2.5"
        >
          {Array.from({ length: cols }).map((_, i) => (
            <div
              key={i}
              className="skeleton h-3"
              style={{
                width: i === 0 ? 130 : 58,
                animationDelay: `${(r * cols + i) * 18}ms`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
