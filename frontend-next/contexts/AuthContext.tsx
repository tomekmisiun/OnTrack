"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  changeLanguage,
  deleteAccountApi,
  exchangeCode,
  fetchMeRaw,
  login,
  logoutSession,
  refreshAccessToken,
  register,
  setUnauthorizedHandler,
} from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { isBffEnabled } from "@/lib/bff/config";
import {
  clearAuthQueryParams,
  clearPendingLang,
  clearStoredToken,
  getPendingLang,
  getStoredToken,
  setStoredToken,
} from "@/lib/auth/storage";
import { clearMemberStorage } from "@/lib/members/storage";
import { setSessionCookie } from "@/lib/auth/session-cookie";
import type { LangCode } from "@/lib/i18n/translations";
import type { MarketCode } from "@/lib/domain/market";
import { parseAuthUser, type AuthUser } from "@/types/auth";

export type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  logout: () => void;
  deleteAccount: () => Promise<void>;
  updateUserLang: (lang: LangCode) => void;
  updateUserMarket: (marketCode: MarketCode) => void;
  loginWithPassword: (username: string, password: string) => Promise<void>;
  registerAccount: (input: {
    username: string;
    password: string;
    lang: LangCode;
  }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
  onLangChange?: (lang: LangCode) => void;
};

export function AuthProvider({ children, onLangChange }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const applyUser = useCallback(
    (userData: AuthUser) => {
      setUser(userData);
      if (userData.ui_locale && onLangChange) {
        onLangChange(userData.ui_locale);
      }
    },
    [onLangChange],
  );

  const logout = useCallback(() => {
    if (isBffEnabled()) {
      void logoutSession();
    } else {
      clearStoredToken();
    }
    clearMemberStorage();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(undefined);
  }, [logout]);

  const finishAuth = useCallback(
    async (token: string | null, pendingLang: string | null) => {
      if (!isBffEnabled() && token) {
        setStoredToken(token);
      }
      const raw = await fetchMeRaw();
      const me = parseAuthUser(raw);
      if (!me) {
        throw new Error("Invalid /api/auth/me response");
      }

      if (pendingLang && pendingLang !== me.ui_locale) {
        try {
          await changeLanguage(pendingLang);
          applyUser({
            ...me,
            lang: pendingLang as LangCode,
            ui_locale: pendingLang as LangCode,
          });
        } catch {
          applyUser(me);
        }
      } else {
        applyUser(me);
      }
      clearPendingLang();
    },
    [applyUser],
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const params = new URLSearchParams(window.location.search);
      const authCode = params.get("code");

      if (authCode) {
        try {
          const { token } = await exchangeCode(authCode);
          if (cancelled) return;
          if (!isBffEnabled() && token) {
            setStoredToken(token);
          }
          clearAuthQueryParams();
        } catch {
          if (cancelled) return;
          const url = new URL(window.location.href);
          url.searchParams.delete("code");
          url.searchParams.set("auth_error", "Login error");
          window.history.replaceState({}, "", `${url.pathname}?${url.search}`);
          setLoading(false);
          return;
        }
      }

      if (isBffEnabled()) {
        try {
          const raw = await fetchMeRaw();
          if (cancelled) return;
          const me = parseAuthUser(raw);
          if (!me) {
            throw new Error("Invalid user");
          }
          const pendingLang = getPendingLang();
          if (authCode && pendingLang && pendingLang !== me.ui_locale) {
            try {
              await changeLanguage(pendingLang);
              if (cancelled) return;
              applyUser({
                ...me,
                lang: pendingLang as LangCode,
                ui_locale: pendingLang as LangCode,
              });
            } catch {
              applyUser(me);
            }
          } else {
            if (pendingLang) clearPendingLang();
            applyUser(me);
          }
        } catch {
          if (cancelled) return;
          setUser(null);
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      const token = getStoredToken();
      if (!token) {
        setLoading(false);
        return;
      }

      setSessionCookie();

      try {
        const raw = await fetchMeRaw();
        if (cancelled) return;
        const me = parseAuthUser(raw);
        if (!me) {
          throw new Error("Invalid user");
        }

        const pendingLang = getPendingLang();
        if (authCode && pendingLang && pendingLang !== me.ui_locale) {
          try {
            await changeLanguage(pendingLang);
            if (cancelled) return;
            applyUser({
              ...me,
              lang: pendingLang as LangCode,
              ui_locale: pendingLang as LangCode,
            });
          } catch {
            applyUser(me);
          }
        } else {
          if (pendingLang) clearPendingLang();
          applyUser(me);
        }
        try {
          const { token: refreshed } = await refreshAccessToken();
          if (!cancelled && refreshed) {
            setStoredToken(refreshed);
          }
        } catch {
          // keep existing token when refresh is unavailable
        }
      } catch {
        if (cancelled) return;
        clearStoredToken();
        setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [applyUser]);

  const loginWithPassword = useCallback(
    async (username: string, password: string) => {
      const { token } = await login(username, password);
      const pendingLang = getPendingLang();
      await finishAuth(token, pendingLang);
    },
    [finishAuth],
  );

  const registerAccount = useCallback(
    async (input: { username: string; password: string; lang: LangCode }) => {
      const { token } = await register({
        username: input.username,
        password: input.password,
        lang: input.lang,
      });
      await finishAuth(token, input.lang);
    },
    [finishAuth],
  );

  const deleteAccount = useCallback(async () => {
    await deleteAccountApi();
    logout();
  }, [logout]);

  const updateUserLang = useCallback((lang: LangCode) => {
    setUser((current) =>
      current ? { ...current, lang, ui_locale: lang } : current,
    );
  }, []);

  const updateUserMarket = useCallback((marketCode: MarketCode) => {
    setUser((current) =>
      current ? { ...current, market_code: marketCode } : current,
    );
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      logout,
      deleteAccount,
      updateUserLang,
      updateUserMarket,
      loginWithPassword,
      registerAccount,
    }),
    [
      user,
      loading,
      logout,
      deleteAccount,
      updateUserLang,
      updateUserMarket,
      loginWithPassword,
      registerAccount,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function isAuthApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
