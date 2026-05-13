import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

export default function Login() {
  const { login, register } = useAuth();
  const { t, lang: uiLang, switchLang } = useLanguage();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regLang, setRegLang] = useState('pl');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);

  useEffect(() => {
    axios.get(`${API_URL}/api/auth/providers`)
      .then(r => setGoogleAvailable(r.data.providers.includes('google')))
      .catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const authError = params.get('auth_error');
    if (authError) {
      setError(decodeURIComponent(authError));
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, regLang);
      }
    } catch (err) {
      setError(err.response?.data?.error || t('auth_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    window.location.href = `${API_URL}/api/auth/google`;
  };

  const flagBtn = (code, flag, label) => (
    <button
      type="button"
      onClick={() => setRegLang(code)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px', border: `2px solid ${regLang === code ? '#667eea' : '#e0e0e0'}`,
        borderRadius: 8, background: regLang === code ? '#f0f2ff' : 'white',
        cursor: 'pointer', fontSize: 14, fontWeight: regLang === code ? 600 : 400,
        color: regLang === code ? '#667eea' : '#555',
        flex: 1, justifyContent: 'center', transition: 'all 0.15s',
      }}
    >
      <span style={{ fontSize: 20 }}>{flag}</span>
      {label}
    </button>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'white', borderRadius: 16, padding: '40px 36px',
        width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🥗</div>
          <h1 style={{ fontSize: 22, color: '#1a1a2e', marginBottom: 4 }}>Meal Planner</h1>
          <p style={{ fontSize: 13, color: '#aaa' }}>
            {mode === 'login' ? t('subtitle_login') : t('subtitle_register')}
          </p>
        </div>

        {error && (
          <div style={{ background: '#ffe0e0', color: '#c00', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {googleAvailable && mode === 'login' && (
          <>
            <button
              onClick={handleGoogle}
              style={{
                width: '100%', padding: '11px', border: '2px solid #e0e0e0',
                borderRadius: 8, background: 'white', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, color: '#444',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                marginBottom: 20, transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#667eea'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e0e0e0'}
            >
              <GoogleIcon />
              {t('google_btn')}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
              <span style={{ fontSize: 12, color: '#bbb' }}>{t('or')}</span>
              <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit}>
          {/* Language picker — only shown at registration */}
          {mode === 'register' && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: '#667eea', fontWeight: 700, letterSpacing: '0.5px', marginBottom: 8 }}>
                {uiLang === 'en' ? 'CHOOSE LANGUAGE / WYBIERZ JĘZYK' : 'WYBIERZ JĘZYK / CHOOSE LANGUAGE'}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {flagBtn('pl', '🇵🇱', 'Polski')}
                {flagBtn('en', '🇬🇧', 'English')}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: '#aaa', lineHeight: 1.5 }}>
                {uiLang === 'en'
                  ? 'Default products and recipes will be in the chosen language.'
                  : 'Domyślna lista produktów i przepisów będzie w wybranym języku.'}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#667eea', fontWeight: 600, display: 'block', marginBottom: 5 }}>EMAIL</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder={t('email_ph')} required
              style={{ width: '100%', boxSizing: 'border-box' }} autoComplete="email"
            />
          </div>
          <div style={{ marginBottom: 22 }}>
            <label style={{ fontSize: 12, color: '#667eea', fontWeight: 600, display: 'block', marginBottom: 5 }}>{t('password_lbl')}</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'register' ? t('password_ph') : ''}
              required style={{ width: '100%', boxSizing: 'border-box' }}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '12px', fontSize: 15 }}>
            {loading ? '...' : mode === 'login' ? t('login_btn') : t('register_btn')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#888' }}>
          {mode === 'login' ? (
            <>{t('no_account')}{' '}
              <button onClick={() => { setMode('register'); setError(''); }} style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontWeight: 600 }}>
                {t('register_btn')}
              </button>
            </>
          ) : (
            <>{t('have_account')}{' '}
              <button onClick={() => { setMode('login'); setError(''); }} style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontWeight: 600 }}>
                {t('login_btn')}
              </button>
            </>
          )}
        </div>

        {/* UI language quick-switch */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button onClick={() => switchLang('pl')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, opacity: uiLang === 'pl' ? 1 : 0.4 }}>🇵🇱</button>
          <button onClick={() => switchLang('en')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, opacity: uiLang === 'en' ? 1 : 0.4 }}>🇬🇧</button>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}
