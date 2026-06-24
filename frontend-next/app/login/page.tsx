"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { useAuth } from "@/contexts/AuthContext";
import { useLayoutViewport } from "@/hooks/useLayoutViewport";
import { LAYOUT_WIDTH } from "@/lib/layout/constants";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useLayoutViewport(LAYOUT_WIDTH.login);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="login-page flex min-h-screen items-center justify-center text-slate-400">
        …
      </div>
    );
  }

  if (user) {
    return null;
  }

  return <LoginScreen />;
}
