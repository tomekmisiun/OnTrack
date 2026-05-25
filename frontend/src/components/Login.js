import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import PrivacyPolicy from './PrivacyPolicy';
import DishCompare from './DishCompare';
import { SEED_STATS } from '../data/seedStats';
import './Login.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const SHOWCASE_SECTIONS = [
  { id: 'macro', icon: 'heroicons:calculator', titleKey: 'showcase_macro_title', descKey: 'showcase_macro_desc', media: 'macro' },
  { id: 'calendar', icon: 'heroicons:calendar-days', titleKey: 'showcase_calendar_title', descKey: 'showcase_calendar_desc', media: 'calendar' },
  { id: 'schedule', icon: 'heroicons:clock', titleKey: 'showcase_schedule_title', descKey: 'showcase_schedule_desc', media: 'schedule' },
  { id: 'recipes', icon: 'heroicons:book-open', titleKey: 'showcase_recipes_title', descKey: 'showcase_recipes_desc', media: 'recipes' },
  { id: 'products', icon: 'heroicons:shopping-cart', titleKey: 'showcase_products_title', descKey: 'showcase_products_desc', media: 'products' },
  { id: 'summary', icon: 'heroicons:banknotes', titleKey: 'showcase_summary_title', descKey: 'showcase_summary_desc', media: 'summary' },
  { id: 'export', icon: 'heroicons:arrow-down-tray', titleKey: 'showcase_export_title', descKey: 'showcase_export_desc', media: 'export' },
];

function OntrackLogo({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M8.5 15.5 L11.8 11.8 L15.5 8.5 L12.2 12.2 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function DemoFrame({ children }) {
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

function ShowcaseMedia({ name }) {
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

function FeatureDescription({ descKey, t }) {
  const desc = t(descKey);
  if (typeof desc !== 'string') {
    return <p className="feature-desc">{desc}</p>;
  }

  const parts = desc.split('\n\n').filter(Boolean);
  if (parts.length <= 1) {
    return <p className="feature-desc">{desc}</p>;
  }

  return (
    <div className="feature-desc-stack">
      <p className="feature-desc feature-desc--lead">{parts[0]}</p>
      {parts.slice(1).map((part) => (
        <p key={part} className="feature-desc">{part}</p>
      ))}
    </div>
  );
}

function ShowcaseSection({ section, index, t }) {
  const isHero = index === 0;

  return (
    <section
      className={`feature-block${isHero ? ' feature-block--hero' : ''}`}
      id={`feature-${section.id}`}
    >
      <div className="feature-row">
        <div className="feature-copy">
          <div className="feature-heading">
            <span className="feature-icon" aria-hidden="true">
              <Icon icon={section.icon} width={22} />
            </span>
            <h2 className="feature-title">{t(section.titleKey)}</h2>
          </div>
          <FeatureDescription descKey={section.descKey} t={t} />
        </div>
        <div className="feature-demo">
          <ShowcaseMedia name={section.media} />
        </div>
      </div>
    </section>
  );
}

function LoginForm({
  t, uiLang, switchLang, mode, setAuthMode, error, username, setUsername,
  password, setPassword, busy, handleCredentials, setShowPrivacy,
}) {
  return (
    <div className="login-panel-inner">
      <div className="login-lang-toggle">
        <button
          type="button"
          className={`login-lang-btn${uiLang === 'pl' ? ' active' : ''}`}
          onClick={() => switchLang('pl')}
        >
          PL
        </button>
        <button
          type="button"
          className={`login-lang-btn${uiLang === 'en' ? ' active' : ''}`}
          onClick={() => switchLang('en')}
        >
          EN
        </button>
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
            className={`login-tab${mode === 'login' ? ' active' : ''}`}
            onClick={() => setAuthMode('login')}
          >
            {t('login_tab_login')}
          </button>
          <button
            type="button"
            className={`login-tab${mode === 'register' ? ' active' : ''}`}
            onClick={() => setAuthMode('register')}
          >
            {t('login_tab_register')}
          </button>
        </div>

        <p className="login-subtitle">
          {mode === 'login' ? t('subtitle_login') : t('subtitle_register')}
        </p>

        {error && <div className="login-error">{error}</div>}

        <form className="login-form" onSubmit={handleCredentials}>
          <div className="login-field">
            <label className="login-label" htmlFor="login-username">
              {t('login_username_lbl')}
            </label>
            <input
              id="login-username"
              type="text"
              className="login-input"
              autoComplete="username"
              required
              maxLength={80}
              placeholder={t('login_username_ph')}
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>
          <div className="login-field">
            <label className="login-label" htmlFor="login-password">
              {t('login_password_lbl')}
            </label>
            <input
              id="login-password"
              type="password"
              className="login-input"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              placeholder={t('login_password_ph')}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="login-submit" disabled={busy}>
            {busy && <span className="login-spinner" />}
            {busy
              ? (mode === 'login' ? t('login_busy_login') : t('login_busy_register'))
              : (mode === 'login' ? t('login_submit') : t('login_register_submit'))}
          </button>
        </form>

        <div className="login-divider">
          <div className="login-divider-line" />
          <span className="login-divider-text">{t('login_or')}</span>
          <div className="login-divider-line" />
        </div>

        <button
          type="button"
          className="login-google"
          onClick={() => {
            localStorage.setItem('pending_lang', uiLang);
            window.location.href = `${API_URL}/api/auth/google?lang=${uiLang}`;
          }}
        >
          <GoogleIcon />
          {t('google_btn')}
        </button>

        <p className="login-privacy">
          {t('login_privacy_prefix')}
          <button type="button" className="login-privacy-link" onClick={() => setShowPrivacy(true)}>
            {t('login_privacy_link')}
          </button>
          {t('login_privacy_suffix')}
        </p>
      </div>
    </div>
  );
}

export default function Login() {
  const { t, lang: uiLang, switchLang } = useLanguage();
  const seedStats = SEED_STATS[uiLang] || SEED_STATS.pl;
  const { loginWithPassword, registerAccount } = useAuth();
  const [error, setError] = useState('');
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('auth_error');
    if (authError) {
      setError(authError);
      params.delete('auth_error');
      const qs = params.toString();
      window.history.replaceState({}, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    }
  }, []);

  const handleCredentials = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    localStorage.setItem('pending_lang', uiLang);
    try {
      if (mode === 'login') {
        await loginWithPassword(username.trim(), password);
      } else {
        await registerAccount({
          username: username.trim(),
          password,
          lang: uiLang,
        });
      }
    } catch (err) {
      const msg = err.response?.data?.error;
      setError(msg || (mode === 'login' ? t('err_login_failed') : t('err_register_failed')));
    } finally {
      setBusy(false);
    }
  };

  const setAuthMode = (next) => {
    setMode(next);
    setError('');
  };

  const formProps = {
    t,
    uiLang,
    switchLang,
    mode,
    setAuthMode,
    error,
    username,
    setUsername,
    password,
    setPassword,
    busy,
    handleCredentials,
    setShowPrivacy,
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
                <span className="login-hero-headline-line">{t('login_tagline_line1')}</span>
                <span className="login-hero-headline-line login-hero-headline-line--accent">{t('login_tagline_line2')}</span>
              </h1>
              <p className="login-hero-lead">{t('login_tagline_desc')}</p>
              <div className="login-hero-chips" aria-label={t('login_seed_chip_note')}>
                <span className="login-hero-chip">
                  {typeof t('login_seed_chip_products') === 'function'
                    ? t('login_seed_chip_products')(seedStats.products)
                    : seedStats.products}
                </span>
                <span className="login-hero-chip">
                  {typeof t('login_seed_chip_recipes') === 'function'
                    ? t('login_seed_chip_recipes')(seedStats.recipes)
                    : seedStats.recipes}
                </span>
                <span className="login-hero-chip login-hero-chip--muted">{t('login_seed_chip_note')}</span>
              </div>
            </header>

            <section className="dish-compare-section" aria-labelledby="dish-compare-section-title">
              <div className="dish-compare-section-head">
                <h2 id="dish-compare-section-title" className="dish-compare-section-title">
                  <span className="dish-compare-section-title-line">{t('compare_headline_1')}</span>
                  <span className="dish-compare-section-title-line dish-compare-section-title-line--accent">{t('compare_headline_2')}</span>
                </h2>
                <p className="dish-compare-section-quote">{t('compare_quote')}</p>
              </div>
              <DishCompare />
            </section>
          </div>

          <a href="#feature-macro" className="dish-compare-cta" aria-label={t('compare_cta_aria')}>
            <div className="dish-compare-cta-glow" aria-hidden="true" />
            <div className="dish-compare-cta-grid" aria-hidden="true" />
            <div className="dish-compare-cta-inner">
              <div className="dish-compare-cta-mark">
                <OntrackLogo className="dish-compare-cta-logo" />
                <span className="dish-compare-cta-eyebrow">{t('compare_cta_eyebrow')}</span>
              </div>
              <h3 className="dish-compare-cta-headline">
                <span className="dish-compare-cta-line">{t('compare_cta_line1')}</span>
                <span className="dish-compare-cta-line dish-compare-cta-line--accent">{t('compare_cta_line2')}</span>
                <span className="dish-compare-cta-line">{t('compare_cta_line3')}</span>
                <span className="dish-compare-cta-line dish-compare-cta-line--brand">
                  {t('compare_cta_line4')} <em>ONTRACK</em>
                </span>
              </h3>
              <div className="dish-compare-cta-action">
                <span className="dish-compare-cta-action-label">{t('compare_cta_scroll')}</span>
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
          <span className="features-head-label">{t('showcase_features_label')}</span>
          <span className="features-head-line" />
        </div>

        <div className="features-list">
          {SHOWCASE_SECTIONS.map((section, index) => (
            <ShowcaseSection
              key={section.id}
              section={section}
              index={index}
              t={t}
            />
          ))}
        </div>
      </main>

      <aside className="login-panel">
        <LoginForm {...formProps} />
      </aside>
      </div>

      <p className="login-copyright">
        {typeof t('login_copyright') === 'function'
          ? t('login_copyright')(new Date().getFullYear())
          : t('login_copyright')}
      </p>

      {showPrivacy && <PrivacyPolicy lang={uiLang} onClose={() => setShowPrivacy(false)} />}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
