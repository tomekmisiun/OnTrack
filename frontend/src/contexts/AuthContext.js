import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001',
});

export function AuthProvider({ children, onLangChange }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyUser = (userData) => {
    setUser(userData);
    if (userData?.lang && onLangChange) onLangChange(userData.lang);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthToken = params.get('token');
    if (oauthToken) {
      localStorage.setItem('token', oauthToken);
      window.history.replaceState({}, '', '/');
    }

    const token = oauthToken || localStorage.getItem('token');
    if (token) {
      API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      API.get('/api/auth/me')
        .then(async r => {
          const pendingLang = localStorage.getItem('pending_lang');
          if (oauthToken && pendingLang && pendingLang !== r.data.lang) {
            localStorage.removeItem('pending_lang');
            try {
              await API.patch('/api/auth/language', { lang: pendingLang });
              applyUser({ ...r.data, lang: pendingLang });
            } catch { applyUser(r.data); }
          } else {
            if (pendingLang) localStorage.removeItem('pending_lang');
            applyUser(r.data);
          }
        })
        .catch(() => { localStorage.removeItem('token'); delete API.defaults.headers.common['Authorization']; })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await API.post('/api/auth/login', { email, password });
    const { access_token, user } = res.data;
    localStorage.setItem('token', access_token);
    API.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    applyUser(user);
  };

  const register = async (email, password, lang) => {
    const res = await API.post('/api/auth/register', { email, password, lang });
    const { access_token, user } = res.data;
    localStorage.setItem('token', access_token);
    API.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    applyUser(user);
  };

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
    <AuthContext.Provider value={{ user, loading, login, register, logout, deleteAccount, updateUserLang }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
