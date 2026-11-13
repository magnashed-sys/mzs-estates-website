"use client";
import {useSearchParams} from 'next/navigation';

/** Keep client-side filters in this history entry without refetching the register. */
export function useRegisterFilter(key: string, fallback = '', allowed?: readonly string[]) {
  const params = useSearchParams();
  const raw = params.get(key);
  const value = raw !== null && (!allowed || allowed.includes(raw)) ? raw : fallback;
  const setValue = (next: string) => {
    const url = new URL(window.location.href);
    const valid = !allowed || allowed.includes(next) ? next : fallback;
    if (valid === fallback) url.searchParams.delete(key);
    else url.searchParams.set(key, valid);
    // Read the current URL for each update so a multi-filter reset is atomic in effect.
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  };
  return [value, setValue] as const;
}
