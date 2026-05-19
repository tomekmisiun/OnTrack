import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { auth as authApi } from '../api';

export default function Profile({ onClose, onStartTour }) {
  const { user, logout, deleteAccount, updateUserLang } = useAuth();
  const { t, lang, switchLang } = useLanguage();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [showLangWarning, setShowLangWarning] = useState(false);
  const [pendingLang, setPendingLang] = useState(null);
  const [changingLang, setChangingLang] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(t('delete_confirm'))) return;
    setDeleting(true);
    setError('');
    try {
      await deleteAccount();
      logout();
    } catch (e) {
      setError(e.response?.data?.error || 'Error');
      setDeleting(false);
    }
  };

  const requestLangChange = (newLang) => {
    if (newLang === user.lang) return;
    setPendingLang(newLang);
    setShowLangWarning(true);
  };

  const confirmLangChange = async () => {
    setChangingLang(true);
    setError('');
    try {
      await authApi.changeLanguage(pendingLang);
      updateUserLang(pendingLang);
      switchLang(pendingLang);
      setShowLangWarning(false);
      setPendingLang(null);
    } catch (e) {
      setError(e.response?.data?.error || 'Error');
    } finally {
      setChangingLang(false);
    }
  };

  const langName = (code) => code === 'pl' ? '🇵🇱 Polski' : '🇬🇧 English';

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#1f2937', borderRadius: 16, padding: '32px 28px', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, color: '#f1f5f9', margin: 0 }}>{t('my_profile')}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#6b7280' }}>✕</button>
        </div>

        {error && (
          <div style={{ background: '#ffe0e0', color: '#c00', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Email */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: '#0d9488', fontWeight: 700, letterSpacing: '0.5px', marginBottom: 6 }}>EMAIL</div>
          <div style={{ fontSize: 15, color: '#f1f5f9', padding: '10px 14px', background: '#1c3534', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            {user.email}
          </div>
        </div>

        {/* Language */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: '#0d9488', fontWeight: 700, letterSpacing: '0.5px', marginBottom: 10 }}>
            {t('password_lbl') === 'HASŁO' ? 'JĘZYK KONTA' : 'ACCOUNT LANGUAGE'}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {['pl', 'en'].map(code => (
              <button
                key={code}
                onClick={() => requestLangChange(code)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer',
                  border: `2px solid ${user.lang === code ? '#0d9488' : '#374151'}`,
                  background: user.lang === code ? '#1c3534' : '#1f2937',
                  color: user.lang === code ? '#0d9488' : '#555',
                  fontWeight: user.lang === code ? 700 : 400,
                  fontSize: 14, transition: 'all 0.15s',
                }}
              >
                {langName(code)}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>
            {lang === 'en'
              ? `Current account language: ${langName(user.lang)}. This determines the language of default products and recipes.`
              : `Obecny język konta: ${langName(user.lang)}. Określa język domyślnych produktów i przepisów.`}
          </div>
        </div>

        {/* Delete */}
        <div style={{ borderTop: '1px solid #374151', paddingTop: 20 }}>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              width: '100%', padding: '11px', border: 'none', borderRadius: 8,
              background: deleting ? '#ffb3b3' : '#ff4757', color: '#1f2937',
              cursor: deleting ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, marginBottom: 10,
            }}
          >
            {deleting ? t('deleting') : t('delete_account')}
          </button>
          {onStartTour && (
            <button onClick={onStartTour} style={{ width: '100%', padding: '10px', border: '1px solid #0d9488', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 14, color: '#0d9488', fontWeight: 600, marginBottom: 8 }}>
              ▶ Pokaż samouczek
            </button>
          )}
          <button onClick={onClose} style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 14, color: '#9ca3af' }}>
            {t('close')}
          </button>
        </div>
      </div>

      {/* Language change warning modal */}
      {showLangWarning && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 }}
          onClick={() => setShowLangWarning(false)}>
          <div style={{ background: '#1f2937', borderRadius: 14, padding: '28px 24px', maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>⚠️</div>
            <h3 style={{ fontSize: 16, color: '#f1f5f9', marginBottom: 12, textAlign: 'center' }}>
              {lang === 'en' ? 'Change account language?' : 'Zmienić język konta?'}
            </h3>
            <div style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.7, marginBottom: 20, background: '#fff9f0', border: '1px solid #ffd9a0', borderRadius: 8, padding: '12px 14px' }}>
              {lang === 'en' ? (
                <>
                  <b>Important:</b> The data you have in <b>{langName(user.lang)}</b> (products, recipes, meal plan) <b>will not be available</b> after switching to <b>{langName(pendingLang)}</b>.<br /><br />
                  Your existing data won't be deleted — but it was created in the other language version and won't match the new defaults.
                </>
              ) : (
                <>
                  <b>Uwaga:</b> Dane które masz w wersji <b>{langName(user.lang)}</b> (produkty, przepisy, plan posiłków) <b>nie będą dostępne</b> po przełączeniu na <b>{langName(pendingLang)}</b>.<br /><br />
                  Twoje istniejące dane nie zostaną usunięte — ale zostały stworzone w innej wersji językowej i nie będą pasować do nowych domyślnych.
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={confirmLangChange}
                disabled={changingLang}
                style={{ flex: 1, padding: '11px', border: 'none', borderRadius: 8, background: '#0d9488', color: '#1f2937', fontWeight: 600, fontSize: 14, cursor: changingLang ? 'not-allowed' : 'pointer' }}
              >
                {changingLang ? '...' : (lang === 'en' ? 'Change anyway' : 'Zmień mimo to')}
              </button>
              <button
                onClick={() => { setShowLangWarning(false); setPendingLang(null); }}
                style={{ flex: 1, padding: '11px', border: '1px solid #e0e0e0', borderRadius: 8, background: 'none', color: '#9ca3af', fontSize: 14, cursor: 'pointer' }}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
