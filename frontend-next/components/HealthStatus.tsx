"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/errors";
import { fetchHealth } from "@/lib/api/health";
import { getApiBaseUrl } from "@/lib/config/env";
import type { FetchState } from "@/types";

type HealthFetchState = FetchState<{ status: string }, string>;

export function HealthStatus() {
  const [state, setState] = useState<HealthFetchState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    fetchHealth()
      .then((data) => {
        if (!cancelled) {
          setState({ kind: "ok", data: { status: data.status ?? "ok" } });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError
            ? `${err.message} (HTTP ${err.status})`
            : err instanceof Error
              ? err.message
              : "Unknown error";
        setState({ kind: "error", error: message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const apiUrl = getApiBaseUrl();

  return (
    <section
      className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-sm"
      aria-live="polite"
    >
      <h2 className="mb-2 font-semibold text-teal-400">FastAPI connectivity</h2>
      <p className="mb-2 text-slate-400">
        API base: <code className="text-slate-200">{apiUrl}</code>
      </p>
      {state.kind === "loading" && (
        <p className="text-slate-300">Checking GET /health…</p>
      )}
      {state.kind === "ok" && (
        <p className="text-emerald-400">
          Connected — backend status: <strong>{state.data.status}</strong>
        </p>
      )}
      {state.kind === "error" && (
        <p className="text-amber-400">
          Could not reach backend: {state.error}
        </p>
      )}
    </section>
  );
}
