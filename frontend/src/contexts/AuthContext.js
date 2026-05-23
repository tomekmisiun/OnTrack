import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001',
});

function clearAuthQuery() {
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('auth_error');
  const qs = url.searchParams.toString();
  window.history.replaceState({}, '', qs ? `${url.pathname}?${qs}` : url.pathname);
}

export function AuthProvider({ children, onLangChange }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyUser = (userData) => {
    setUser(userData);
    if (userData?.lang && onLangChange) onLangChange(userData.lang);
  };

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const params = new URLSearchParams(window.location.search);
      const authCode = params.get('code');

      if (authCode) {
        try {
          const res = await API.post('/api/auth/exchange', { code: authCode });
          if (cancelled) return;
          localStorage.setItem('token', res.data.token);
          clearAuthQuery();
        } catch {
          if (cancelled) return;
          const url = new URL(window.location.href);
          url.searchParams.delete('code');
          url.searchParams.set('auth_error', 'Login error');
          window.history.replaceState({}, '', `${url.pathname}?${url.search}`);
          setLoading(false);
          return;
        }
      }

      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      try {
        const r = await API.get('/api/auth/me');
        if (cancelled) return;
        const pendingLang = localStorage.getItem('pending_lang');
        if (authCode && pendingLang && pendingLang !== r.data.lang) {
          localStorage.removeItem('pending_lang');
          try {
            await API.patch('/api/auth/language', { lang: pendingLang });
            applyUser({ ...r.data, lang: pendingLang });
          } catch {
            applyUser(r.data);
          }
        } else {
          if (pendingLang) localStorage.removeItem('pending_lang');
          applyUser(r.data);
        }
      } catch {
        if (cancelled) return;
        localStorage.removeItem('token');
        delete API.defaults.headers.common['Authorization'];
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();
    return () => { cancelled = true; };
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    delete API.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const deleteAccount = async () => {
    await API.delete('/api/auth/me');
    logout();
  };

  const updateUserLang = (lang) => {
    setUser(u => u ? { ...u, lang } : u);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, deleteAccount, updateUserLang }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
