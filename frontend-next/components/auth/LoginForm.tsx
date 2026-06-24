"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { isAuthApiError, useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { googleAuthUrl } from "@/lib/api/auth";
import { setPendingLang } from "@/lib/auth/storage";
import type { LangCode } from "@/lib/i18n/translations";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

type AuthMode = "login" | "register";

export function LoginForm() {
  const router = useRouter();
  const { t, lang: uiLang, switchLang } = useLanguage();
  const { loginWithPassword, registerAccount } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (authError) {
      setError(authError);
      params.delete("auth_error");
      const qs = params.toString();
      window.history.replaceState(
        {},
        "",
        qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
      );
    }
  }, []);

  const handleCredentials = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    setPendingLang(uiLang);
    try {
      if (mode === "login") {
        await loginWithPassword(username.trim(), password);
      } else {
        await registerAccount({
          username: username.trim(),
          password,
          lang: uiLang,
        });
      }
      router.replace("/");
    } catch (err) {
      const msg = isAuthApiError(err) ? err.message : null;
      setError(
        msg ??
          String(
            mode === "login" ? t("err_login_failed") : t("err_register_failed"),
          ),
      );
    } finally {
      setBusy(false);
    }
  };

  const setAuthMode = (next: AuthMode) => {
    setMode(next);
    setError("");
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-4 flex justify-end gap-1">
        {(["pl", "en"] as LangCode[]).map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => switchLang(code)}
            className={`cursor-pointer rounded-md px-3 py-1 text-xs font-semibold ${
              uiLang === code
                ? "bg-teal-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl">
        <div className="mb-6 text-center">
          <div className="text-lg font-bold tracking-wide text-slate-100">
            ONTRACK
          </div>
          <div className="text-[10px] tracking-[0.2em] text-teal-500">
            BE IN CONTROL
          </div>
        </div>

        <div className="mb-4 flex rounded-lg border border-slate-700 p-1">
          <button
            type="button"
            onClick={() => setAuthMode("login")}
            className={`flex-1 cursor-pointer rounded-md py-2 text-sm font-semibold ${
              mode === "login"
                ? "bg-slate-700 text-white"
                : "text-slate-400"
            }`}
          >
            {String(t("login_tab_login"))}
          </button>
          <button
            type="button"
            onClick={() => setAuthMode("register")}
            className={`flex-1 cursor-pointer rounded-md py-2 text-sm font-semibold ${
              mode === "register"
                ? "bg-slate-700 text-white"
                : "text-slate-400"
            }`}
          >
            {String(t("login_tab_register"))}
          </button>
        </div>

        <p className="mb-4 text-center text-sm text-slate-400">
          {String(
            mode === "login" ? t("subtitle_login") : t("subtitle_register"),
          )}
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/15 px-3 py-2 text-center text-sm text-red-300">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleCredentials}>
          <div>
            <label
              htmlFor="login-username"
              className="mb-1 block text-xs font-semibold tracking-wide text-slate-400"
            >
              {String(t("login_username_lbl"))}
            </label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              required
              maxLength={80}
              placeholder={String(t("login_username_ph"))}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label
              htmlFor="login-password"
              className="mb-1 block text-xs font-semibold tracking-wide text-slate-400"
            >
              {String(t("login_password_lbl"))}
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              minLength={8}
              placeholder={String(t("login_password_ph"))}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full cursor-pointer rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy
              ? String(
                  mode === "login"
                    ? t("login_busy_login")
                    : t("login_busy_register"),
                )
              : String(
                  mode === "login" ? t("login_submit") : t("login_register_submit"),
                )}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-700" />
          <span className="text-xs text-slate-500">{String(t("login_or"))}</span>
          <div className="h-px flex-1 bg-slate-700" />
        </div>

        <button
          type="button"
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800 py-2.5 text-sm font-semibold text-slate-100"
          onClick={() => {
            setPendingLang(uiLang);
            window.location.href = googleAuthUrl(uiLang);
          }}
        >
          <GoogleIcon />
          {String(t("google_btn"))}
        </button>
      </div>
    </div>
  );
}
