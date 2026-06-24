"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { AppFooter } from "@/components/layout/AppFooter";
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

  return (
    <div className="login-page">
      <div className="login-page-body">
        <main className="login-marketing flex min-h-screen flex-col items-center justify-center px-4 py-12">
          <LoginForm />
          <AppFooter className="app-site-footer--login" />
        </main>
      </div>
    </div>
  );
}
