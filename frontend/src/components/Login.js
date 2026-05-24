import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import PrivacyPolicy from './PrivacyPolicy';
import './Login.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const FEATURE_ICONS = [
  'heroicons:calendar-days',
  'heroicons:book-open',
  'heroicons:banknotes',
];

function OntrackLogo({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M8.5 15.5 L11.8 11.8 L15.5 8.5 L12.2 12.2 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function Login() {
  const { t, lang: uiLang, switchLang } = useLanguage();
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

  const features = [
    t('login_feature_calendar'),
    t('login_feature_recipes'),
    t('login_feature_budget'),
  ];

  return (
    <div className="login-page">
      <aside className="login-brand">
        <div className="login-brand-inner">
          <div className="login-brand-logo">
            <OntrackLogo className="login-brand-logo-icon" />
            <div>
              <div className="login-brand-logo-name">ONTRACK</div>
              <div className="login-brand-logo-sub">BE IN CONTROL</div>
            </div>
          </div>
          <h2 className="login-brand-tagline">{t('login_tagline')}</h2>
          <p className="login-brand-desc">{t('login_tagline_desc')}</p>
          <ul className="login-features">
            {features.map((text, i) => (
              <li key={i} className="login-feature">
                <span className="login-feature-icon">
                  <Icon icon={FEATURE_ICONS[i]} width={20} />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <div className="login-value-prop">
            <span className="login-value-prop-dot" />
            {t('login_value_prop')}
          </div>
        </div>
      </aside>

      <div className="login-panel">
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
          <div className="login-mobile-brand">
            <OntrackLogo className="login-mobile-brand-icon" />
            <span className="login-mobile-brand-name">ONTRACK</span>
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
