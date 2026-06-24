"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { syncSessionCookieFromStorage } from "@/lib/auth/session-cookie";

type RequireAuthProps = {
  children: React.ReactNode;
};

/**
 * Client auth gate — complements middleware (session cookie) and handles
 * bootstrap while JWT is read from localStorage.
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    syncSessionCookieFromStorage();
  }, [user, loading]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        …
      </div>
    );
  }

  return <>{children}</>;
}
