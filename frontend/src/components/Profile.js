import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function Profile({ onClose }) {
  const { user, logout, deleteAccount } = useAuth();
  const { t } = useLanguage();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white', borderRadius: 16, padding: '32px 28px',
          width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, color: '#1a1a2e', margin: 0 }}>{t('my_profile')}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa' }}>✕</button>
        </div>

        {error && (
          <div style={{ background: '#ffe0e0', color: '#c00', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: '#667eea', fontWeight: 700, letterSpacing: '0.5px', marginBottom: 6 }}>EMAIL</div>
          <div style={{ fontSize: 15, color: '#1a1a2e', padding: '10px 14px', background: '#f8f9ff', borderRadius: 8, border: '1px solid #e0e4ff' }}>
            {user.email}
          </div>
        </div>

        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 20 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 14, lineHeight: 1.6 }}>
            {t('delete_confirm')}
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              width: '100%', padding: '11px', border: 'none', borderRadius: 8,
              background: deleting ? '#ffb3b3' : '#ff4757',
              color: 'white', cursor: deleting ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 600, marginBottom: 10,
            }}
          >
            {deleting ? t('deleting') : t('delete_account')}
          </button>
          <button
            onClick={onClose}
            style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 14, color: '#666' }}
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
