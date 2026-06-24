import { HealthStatus } from "@/components/HealthStatus";
import { getApiBaseUrl } from "@/lib/config/env";

export default function HomePage() {
  const apiUrl = getApiBaseUrl();

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-12">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-teal-500">
          OnTrack · frontend-next
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100">
          Next.js foundation
        </h1>
        <p className="mt-3 text-slate-400">
          App Router, TypeScript strict, Tailwind CSS. FastAPI remains the domain
          backend at{" "}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-sm text-slate-200">
            {apiUrl}
          </code>
          . Legacy CRA app in <code className="text-slate-300">frontend/</code>{" "}
          is unchanged.
        </p>
      </header>

      <HealthStatus />

      <footer className="mt-auto border-t border-slate-800 pt-6 text-xs text-slate-500">
        Migration task 1 — no auth, routing, or business screens yet. See{" "}
        <code className="text-slate-400">docs/FRONTEND_NEXT_MIGRATION_PLAN.md</code>
        .
      </footer>
    </div>
  );
}
