"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { DishCompare } from "@/components/dish-compare/DishCompare";
import { AppFooter } from "@/components/layout/AppFooter";
import { OntrackLogo } from "@/components/layout/nav-icons";
import { PrivacyPolicyModal } from "@/components/privacy/PrivacyPolicyModal";
import { isAuthApiError, useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { googleAuthUrl, forgotPassword } from "@/lib/api/auth";
import { setPendingLang } from "@/lib/auth/storage";
import { CATALOG_STATS } from "@/lib/data/catalogStats";
import type { LangCode, TranslationKey } from "@/lib/i18n/translations";
import { tFormatN, tString } from "@/lib/i18n/translate";
import "@/components/auth/login.css";

const SHOWCASE_SECTIONS = [
  {
    id: "macro",
    icon: "heroicons:calculator",
    titleKey: "showcase_macro_title" as TranslationKey,
    descKey: "showcase_macro_desc" as TranslationKey,
    media: "macro",
  },
  {
    id: "calendar",
    icon: "heroicons:calendar-days",
    titleKey: "showcase_calendar_title" as TranslationKey,
    descKey: "showcase_calendar_desc" as TranslationKey,
    media: "calendar",
  },
  {
    id: "schedule",
    icon: "heroicons:clock",
    titleKey: "showcase_schedule_title" as TranslationKey,
    descKey: "showcase_schedule_desc" as TranslationKey,
    media: "schedule",
  },
  {
    id: "recipes",
    icon: "heroicons:book-open",
    titleKey: "showcase_recipes_title" as TranslationKey,
    descKey: "showcase_recipes_desc" as TranslationKey,
    media: "recipes",
  },
  {
    id: "products",
    icon: "heroicons:shopping-cart",
    titleKey: "showcase_products_title" as TranslationKey,
    descKey: "showcase_products_desc" as TranslationKey,
    media: "products",
  },
  {
    id: "summary",
    icon: "heroicons:banknotes",
    titleKey: "showcase_summary_title" as TranslationKey,
    descKey: "showcase_summary_desc" as TranslationKey,
    media: "summary",
  },
  {
    id: "export",
    icon: "heroicons:arrow-down-tray",
    titleKey: "showcase_export_title" as TranslationKey,
    descKey: "showcase_export_desc" as TranslationKey,
    media: "export",
  },
] as const;

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

function DemoFrame({ children }: { children: ReactNode }) {
  return (
    <div className="demo-frame">
      <div className="demo-frame-border" aria-hidden="true" />
      <div className="demo-frame-glow demo-frame-glow--tl" aria-hidden="true" />
      <div className="demo-frame-glow demo-frame-glow--br" aria-hidden="true" />
      <div className="demo-frame-grid" aria-hidden="true" />
      <div className="demo-frame-inner">{children}</div>
      <div className="demo-frame-vignette" aria-hidden="true" />
    </div>
  );
}

function ShowcaseMedia({ name }: { name: string }) {
  const { lang } = useLanguage();
  const [failed, setFailed] = useState(false);
  const src = `/demos/${name}.${lang}.webm`;

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const content = failed ? (
    <div className="showcase-media showcase-media--placeholder" aria-hidden="true" />
  ) : (
    <video
      key={src}
      className="showcase-media"
      autoPlay
      loop
      muted
      playsInline
      onError={() => setFailed(true)}
    >
      <source src={src} type="video/webm" />
    </video>
  );

  return <DemoFrame>{content}</DemoFrame>;
}

function FeatureDescription({
  descKey,
}: {
  descKey: TranslationKey;
}) {
  const { t } = useLanguage();
  const desc = t(descKey);
  if (typeof desc !== "string") {
    return <p className="feature-desc">{String(desc)}</p>;
  }

  const parts = desc.split("\n\n").filter(Boolean);
  if (parts.length <= 1) {
    return <p className="feature-desc">{desc}</p>;
  }

  return (
    <div className="feature-desc-stack">
      <p className="feature-desc feature-desc--lead">{parts[0]}</p>
      {parts.slice(1).map((part) => (
        <p key={part} className="feature-desc">
          {part}
        </p>
      ))}
    </div>
  );
}

function ShowcaseSection({
  section,
  index,
}: {
  section: (typeof SHOWCASE_SECTIONS)[number];
  index: number;
}) {
  const { t } = useLanguage();
  const isHero = index === 0;

  return (
    <section
      className={`feature-block${isHero ? " feature-block--hero" : ""}`}
      id={`feature-${section.id}`}
    >
      <div className="feature-row">
        <div className="feature-copy">
          <div className="feature-heading">
            <span className="feature-icon" aria-hidden="true">
              <Icon icon={section.icon} width={22} />
            </span>
            <h2 className="feature-title">{tString(t, section.titleKey)}</h2>
          </div>
          <FeatureDescription descKey={section.descKey} />
        </div>
        <div className="feature-demo">
          <ShowcaseMedia name={section.media} />
        </div>
      </div>
    </section>
  );
}

type AuthMode = "login" | "register";
type PanelFlow = "auth" | "forgot" | "reset";

type LoginPanelProps = {
  uiLang: LangCode;
  switchLang: (lang: LangCode) => void;
  mode: AuthMode;
  setAuthMode: (mode: AuthMode) => void;
  error: string;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  busy: boolean;
  handleCredentials: (e: FormEvent) => void;
  setShowPrivacy: (open: boolean) => void;
  onForgotClick?: () => void;
};

function LoginPanel({
  uiLang,
  switchLang,
  mode,
  setAuthMode,
  error,
  email,
  setEmail,
  password,
  setPassword,
  busy,
  handleCredentials,
  setShowPrivacy,
  onForgotClick,
}: LoginPanelProps) {
  const { t } = useLanguage();

  return (
    <div className="login-panel-inner">
      <div className="login-lang-toggle">
        {(["pl", "en"] as LangCode[]).map((code) => (
          <button
            key={code}
            type="button"
            className={`login-lang-btn${uiLang === code ? " active" : ""}`}
            onClick={() => switchLang(code)}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="login-card">
        <div className="login-panel-brand">
          <OntrackLogo className="login-panel-brand-icon" />
          <div>
            <div className="login-panel-brand-name">ONTRACK</div>
            <div className="login-panel-brand-sub">BE IN CONTROL</div>
          </div>
        </div>

        <div className="login-tabs">
          <button
            type="button"
            className={`login-tab${mode === "login" ? " active" : ""}`}
            onClick={() => setAuthMode("login")}
          >
            {tString(t, "login_tab_login")}
          </button>
          <button
            type="button"
            className={`login-tab${mode === "register" ? " active" : ""}`}
            onClick={() => setAuthMode("register")}
          >
            {tString(t, "login_tab_register")}
          </button>
        </div>

        <p className="login-subtitle">
          {tString(t, mode === "login" ? "subtitle_login" : "subtitle_register")}
        </p>

        {error ? <div className="login-error">{error}</div> : null}

        <form className="login-form" onSubmit={handleCredentials}>
          <div className="login-field">
            <label className="login-label" htmlFor="login-email">
              {tString(t, "login_email_lbl")}
            </label>
            <input
              id="login-email"
              type={mode === "register" ? "email" : "text"}
              className="login-input"
              autoComplete="email"
              required
              maxLength={255}
              placeholder={tString(t, "login_email_ph")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="login-field">
            <label className="login-label" htmlFor="login-password">
              {tString(t, "login_password_lbl")}
            </label>
            <input
              id="login-password"
              type="password"
              className="login-input"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={8}
              placeholder={tString(t, "login_password_ph")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {mode === "login" && onForgotClick ? (
            <button
              type="button"
              className="login-forgot-link"
              onClick={onForgotClick}
            >
              {tString(t, "login_forgot_link")}
            </button>
          ) : null}
          <button type="submit" className="login-submit" disabled={busy}>
            {busy ? <span className="login-spinner" /> : null}
            {busy
              ? tString(
                  t,
                  mode === "login" ? "login_busy_login" : "login_busy_register",
                )
              : tString(
                  t,
                  mode === "login" ? "login_submit" : "login_register_submit",
                )}
          </button>
        </form>

        <div className="login-divider">
          <div className="login-divider-line" />
          <span className="login-divider-text">{tString(t, "login_or")}</span>
          <div className="login-divider-line" />
        </div>

        <button
          type="button"
          className="login-google"
          onClick={() => {
            setPendingLang(uiLang);
            window.location.href = googleAuthUrl(uiLang);
          }}
        >
          <GoogleIcon />
          {tString(t, "google_btn")}
        </button>

        <p className="login-privacy">
          {tString(t, "login_privacy_prefix")}
          <button
            type="button"
            className="login-privacy-link"
            onClick={() => setShowPrivacy(true)}
          >
            {tString(t, "login_privacy_link")}
          </button>
          {tString(t, "login_privacy_suffix")}
        </p>
      </div>
    </div>
  );
}

function AlternateAuthPanel({
  uiLang,
  switchLang,
  titleKey,
  subtitleKey,
  error,
  info,
  busy,
  onBack,
  children,
}: {
  uiLang: LangCode;
  switchLang: (lang: LangCode) => void;
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  error: string;
  info: string;
  busy: boolean;
  onBack: () => void;
  children: ReactNode;
}) {
  const { t } = useLanguage();

  return (
    <div className="login-panel-inner">
      <div className="login-lang-toggle">
        {(["pl", "en"] as LangCode[]).map((code) => (
          <button
            key={code}
            type="button"
            className={`login-lang-btn${uiLang === code ? " active" : ""}`}
            onClick={() => switchLang(code)}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="login-card">
        <div className="login-panel-brand">
          <OntrackLogo className="login-panel-brand-icon" />
          <div>
            <div className="login-panel-brand-name">ONTRACK</div>
            <div className="login-panel-brand-sub">BE IN CONTROL</div>
          </div>
        </div>

        <p className="login-subtitle login-subtitle--strong">{tString(t, titleKey)}</p>
        <p className="login-subtitle">{tString(t, subtitleKey)}</p>

        {error ? <div className="login-error">{error}</div> : null}
        {info ? <div className="login-info">{info}</div> : null}

        {children}

        <button
          type="button"
          className="login-forgot-link login-forgot-link--block"
          onClick={onBack}
          disabled={busy}
        >
          {tString(t, "login_forgot_back")}
        </button>
      </div>
    </div>
  );
}

export function LoginScreen() {
  const router = useRouter();
  const { t, lang: uiLang, switchLang } = useLanguage();
  const catalogStats = CATALOG_STATS[uiLang] ?? CATALOG_STATS.pl;
  const { loginWithPassword, registerAccount, completePasswordReset } = useAuth();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [flow, setFlow] = useState<PanelFlow>("auth");
  const [resetToken, setResetToken] = useState("");
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    const token = params.get("reset_token");
    if (token) {
      setResetToken(token);
      setFlow("reset");
      params.delete("reset_token");
    }
    if (authError) {
      const oauthKey = `err_${authError}` as keyof typeof t;
      const message =
        oauthKey in t && typeof t[oauthKey] === "string"
          ? (t[oauthKey] as string)
          : authError;
      setError(message);
      params.delete("auth_error");
      const qs = params.toString();
      window.history.replaceState(
        {},
        "",
        qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
      );
    }
  }, [t]);

  const handleCredentials = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    setPendingLang(uiLang);
    try {
      if (mode === "login") {
        await loginWithPassword(email.trim(), password);
      } else {
        await registerAccount({
          email: email.trim(),
          password,
          lang: uiLang,
        });
      }
      router.replace(
        new URLSearchParams(window.location.search).get("next") ?? "/",
      );
    } catch (err) {
      const msg = isAuthApiError(err) ? err.message : null;
      setError(
        msg ??
          tString(
            t,
            mode === "login" ? "err_login_failed" : "err_register_failed",
          ),
      );
    } finally {
      setBusy(false);
    }
  };

  const setAuthMode = (next: AuthMode) => {
    setMode(next);
    setError("");
    setInfo("");
  };

  const returnToAuth = () => {
    setFlow("auth");
    setError("");
    setInfo("");
    setPassword("");
  };

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      await forgotPassword(email.trim());
      setInfo(tString(t, "login_forgot_success"));
    } catch (err) {
      const msg = isAuthApiError(err) ? err.message : null;
      setError(msg ?? tString(t, "err_forgot_failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    setPendingLang(uiLang);
    try {
      await completePasswordReset(resetToken, password);
      router.replace(
        new URLSearchParams(window.location.search).get("next") ?? "/",
      );
    } catch (err) {
      const msg = isAuthApiError(err) ? err.message : null;
      setError(msg ?? tString(t, "err_reset_failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-page-body">
        <main className="login-marketing">
          <div className="login-marketing-columns">
            <div className="login-marketing-primary">
              <header className="login-hero">
                <div className="login-hero-logo">
                  <OntrackLogo className="login-hero-logo-icon" />
                  <div>
                    <div className="login-hero-logo-name">ONTRACK</div>
                    <div className="login-hero-logo-sub">BE IN CONTROL</div>
                  </div>
                </div>
                <h1 className="login-hero-headline">
                  <span className="login-hero-headline-line">
                    {tString(t, "login_tagline_line1")}
                  </span>
                  <span className="login-hero-headline-line login-hero-headline-line--accent">
                    {tString(t, "login_tagline_line2")}
                  </span>
                </h1>
                <p className="login-hero-lead">{tString(t, "login_tagline_desc")}</p>
                <div
                  className="login-hero-chips"
                  aria-label={tString(t, "login_seed_chip_note")}
                >
                  <span className="login-hero-chip">
                    {tFormatN(t, "login_seed_chip_products", catalogStats.products)}
                  </span>
                  <span className="login-hero-chip">
                    {tFormatN(t, "login_seed_chip_recipes", catalogStats.recipes)}
                  </span>
                  <span className="login-hero-chip login-hero-chip--muted">
                    {tString(t, "login_seed_chip_note")}
                  </span>
                </div>
              </header>

              <section
                className="dish-compare-section"
                aria-labelledby="dish-compare-section-title"
              >
                <div className="dish-compare-section-head">
                  <h2 id="dish-compare-section-title" className="dish-compare-section-title">
                    <span className="dish-compare-section-title-line">
                      {tString(t, "compare_headline_1")}
                    </span>
                    <span className="dish-compare-section-title-line dish-compare-section-title-line--accent">
                      {tString(t, "compare_headline_2")}
                    </span>
                  </h2>
                  <p className="dish-compare-section-quote">
                    {tString(t, "compare_quote")}
                  </p>
                </div>
                <DishCompare />
              </section>
            </div>

            <a
              href="#feature-macro"
              className="dish-compare-cta"
              aria-label={tString(t, "compare_cta_aria")}
            >
              <div className="dish-compare-cta-glow" aria-hidden="true" />
              <div className="dish-compare-cta-grid" aria-hidden="true" />
              <div className="dish-compare-cta-inner">
                <div className="dish-compare-cta-mark">
                  <OntrackLogo className="dish-compare-cta-logo" />
                  <span className="dish-compare-cta-eyebrow">
                    {tString(t, "compare_cta_eyebrow")}
                  </span>
                </div>
                <h3 className="dish-compare-cta-headline">
                  <span className="dish-compare-cta-line">
                    {tString(t, "compare_cta_line1")}
                  </span>
                  <span className="dish-compare-cta-line dish-compare-cta-line--accent">
                    {tString(t, "compare_cta_line2")}
                  </span>
                  <span className="dish-compare-cta-line">
                    {tString(t, "compare_cta_line3")}
                  </span>
                  <span className="dish-compare-cta-line dish-compare-cta-line--brand">
                    {tString(t, "compare_cta_line4")} <em>ONTRACK</em>
                  </span>
                </h3>
                <div className="dish-compare-cta-action">
                  <span className="dish-compare-cta-action-label">
                    {tString(t, "compare_cta_scroll")}
                  </span>
                  <span className="dish-compare-cta-arrow">
                    <span className="dish-compare-cta-arrow-ring" />
                    <Icon icon="heroicons:arrow-down" width={22} />
                  </span>
                </div>
              </div>
            </a>
          </div>

          <div className="features-head">
            <span className="features-head-line" />
            <span className="features-head-label">
              {tString(t, "showcase_features_label")}
            </span>
            <span className="features-head-line" />
          </div>

          <div className="features-list">
            {SHOWCASE_SECTIONS.map((section, index) => (
              <ShowcaseSection key={section.id} section={section} index={index} />
            ))}
          </div>

          <AppFooter className="app-site-footer--login" />
        </main>

        <aside className="login-panel">
          {flow === "auth" ? (
            <LoginPanel
              uiLang={uiLang}
              switchLang={switchLang}
              mode={mode}
              setAuthMode={setAuthMode}
              error={error}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              busy={busy}
              handleCredentials={handleCredentials}
              setShowPrivacy={setShowPrivacy}
              onForgotClick={() => {
                setFlow("forgot");
                setError("");
                setInfo("");
              }}
            />
          ) : flow === "forgot" ? (
            <AlternateAuthPanel
              uiLang={uiLang}
              switchLang={switchLang}
              titleKey="login_forgot_title"
              subtitleKey="login_forgot_desc"
              error={error}
              info={info}
              busy={busy}
              onBack={returnToAuth}
            >
              <form className="login-form" onSubmit={handleForgot}>
                <div className="login-field">
                  <label className="login-label" htmlFor="forgot-email">
                    {tString(t, "login_email_lbl")}
                  </label>
                  <input
                    id="forgot-email"
                    type="text"
                    className="login-input"
                    autoComplete="email"
                    required
                    maxLength={255}
                    placeholder={tString(t, "login_email_ph")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <button type="submit" className="login-submit" disabled={busy}>
                  {busy ? <span className="login-spinner" /> : null}
                  {busy
                    ? tString(t, "login_forgot_busy")
                    : tString(t, "login_forgot_submit")}
                </button>
              </form>
            </AlternateAuthPanel>
          ) : (
            <AlternateAuthPanel
              uiLang={uiLang}
              switchLang={switchLang}
              titleKey="login_reset_title"
              subtitleKey="login_reset_desc"
              error={error}
              info={info}
              busy={busy}
              onBack={returnToAuth}
            >
              <form className="login-form" onSubmit={handleReset}>
                <div className="login-field">
                  <label className="login-label" htmlFor="reset-password">
                    {tString(t, "login_password_lbl")}
                  </label>
                  <input
                    id="reset-password"
                    type="password"
                    className="login-input"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    placeholder={tString(t, "login_password_ph")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <button type="submit" className="login-submit" disabled={busy}>
                  {busy ? <span className="login-spinner" /> : null}
                  {busy
                    ? tString(t, "login_reset_busy")
                    : tString(t, "login_reset_submit")}
                </button>
              </form>
            </AlternateAuthPanel>
          )}
        </aside>
      </div>

      {showPrivacy ? (
        <PrivacyPolicyModal lang={uiLang} onClose={() => setShowPrivacy(false)} />
      ) : null}
    </div>
  );
}
