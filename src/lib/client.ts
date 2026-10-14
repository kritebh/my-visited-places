"use client";

import { useCallback, useEffect, useState } from "react";
import { signOut } from "next-auth/react";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.json !== undefined ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

/** Minimal fetch-on-change hook. Pass null to skip. */
export function useApi<T>(url: string | null) {
  const [tick, setTick] = useState(0);
  // Previous data stays visible while a new url loads, so filters don't flash.
  const [state, setState] = useState<{ key?: string; data?: T; error?: string }>({});
  const key = url ? `${tick}:${url}` : undefined;

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    api<T>(url)
      .then((data) => !cancelled && setState({ key, data }))
      .catch((e: Error) => {
        // Session points at an account that no longer exists: sign in again
        if (e instanceof ApiError && e.status === 401) signOut({ redirect: false }).then(() => window.location.assign("/login"));
        if (!cancelled) setState((s) => ({ key, data: s.data, error: e.message }));
      });
    return () => {
      cancelled = true;
    };
  }, [url, key]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data: state.data, error: state.error, loading: !!key && state.key !== key, reload };
}

/** Builds an API url with the public slug and filters applied. */
export function apiUrl(path: string, params: Record<string, string | number | undefined | null>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

export function formatDate(iso?: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!iso) return "Undated";
  return new Date(iso).toLocaleString(undefined, opts);
}
