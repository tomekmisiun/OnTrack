import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import PrivacyPolicy from './PrivacyPolicy';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

export default function Login() {
  const { t, lang: uiLang, switchLang } = useLanguage();
  const [error, setError] = useState('');
  const [showPrivacy, setShowPrivacy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('auth_error');
    if (authError) {
      setError(decodeURIComponent(authError));
      window.history.replaceState({}, '', '/');
    }
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#1f2937', borderRadius: 16, padding: '40px 36px',
        width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ width: 56, height: 56, margin: '0 auto 12px' }}>
            <circle cx="12" cy="12" r="9.5"/>
            <path d="M8.5 15.5 L11.8 11.8 L15.5 8.5 L12.2 12.2 Z" fill="#2dd4bf" stroke="none"/>
          </svg>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#2dd4bf', letterSpacing: 4, margin: '0 0 4px' }}>ONTRACK</h1>
          <p style={{ fontSize: 9, fontWeight: 600, color: '#6b7280', letterSpacing: 3, marginBottom: 12 }}>BE IN CONTROL</p>
          <p style={{ fontSize: 13, color: '#6b7280' }}>{t('subtitle_login')}</p>
        </div>

        {error && (
          <div style={{ background: '#ffe0e0', color: '#c00', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 20 }}>
            {error}
          </div>
        )}

        <button
          onClick={() => { localStorage.setItem('pending_lang', uiLang); window.location.href = `${API_URL}/api/auth/google`; }}
          style={{
            width: '100%', padding: '12px', border: '2px solid #374151',
            borderRadius: 8, background: '#1f2937', cursor: 'pointer',
            fontSize: 14, fontWeight: 600, color: '#d1d5db',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#0d9488'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#374151'}
        >
          <GoogleIcon />
          {t('google_btn')}
        </button>

        <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
          {uiLang === 'pl' ? 'Zakładając konto akceptujesz ' : 'By creating an account you agree to the '}
          <button
            onClick={() => setShowPrivacy(true)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#2dd4bf', fontSize: 11, textDecoration: 'underline' }}
          >
            {uiLang === 'pl' ? 'Politykę Prywatności' : 'Privacy Policy'}
          </button>
          {uiLang === 'pl' ? ' Ontrack.' : ' of Ontrack.'}
        </p>
        {showPrivacy && <PrivacyPolicy lang={uiLang} onClose={() => setShowPrivacy(false)} />}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 28 }}>
          <button onClick={() => switchLang('en')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, opacity: uiLang === 'en' ? 1 : 0.4 }}>🇬🇧</button>
          <button onClick={() => switchLang('pl')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, opacity: uiLang === 'pl' ? 1 : 0.4 }}>🇵🇱</button>
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
