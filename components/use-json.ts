"use client";

import { useCallback, useEffect, useState } from "react";

export function useJson<T>(url: string | null, refreshMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [receivedAt, setReceivedAt] = useState(Date.now());

  const reload = useCallback(async () => {
    if (!url) return;
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.status === 401) {
        if (window.location.pathname !== "/login") {
          const next = `${window.location.pathname}${window.location.search}`;
          window.location.href = `/login?next=${encodeURIComponent(next)}`;
        }
        return;
      }
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
      setData(body as T);
      setReceivedAt(Date.now());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void reload();
    if (!refreshMs) return;
    const timer = setInterval(() => void reload(), refreshMs);
    return () => clearInterval(timer);
  }, [reload, refreshMs]);

  return { data, error, loading, reload, receivedAt };
}
