"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * Read and write a single URL search param, so filtered views stay shareable.
 * Writes replace history rather than pushing, so filter changes do not fill up
 * the back button.
 */
export function useQueryState(key: string, fallback: string) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get(key) ?? fallback;

  const setValue = useCallback(
    (next: string) => {
      const sp = new URLSearchParams(params.toString());
      if (next === fallback) sp.delete(key);
      else sp.set(key, next);
      const q = sp.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [key, fallback, params, pathname, router],
  );

  return [value, setValue] as const;
}

/**
 * Write several URL search params in one replace. Two useQueryState setters
 * called in the same event handler each build their URL from the same stale
 * params snapshot, so the second call silently drops the first one's change —
 * batch related updates through this instead. Pass null to delete a param.
 */
export function useQueryBatch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return useCallback(
    (updates: Record<string, string | null>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [key, next] of Object.entries(updates)) {
        if (next === null || next === "") sp.delete(key);
        else sp.set(key, next);
      }
      const q = sp.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
}
