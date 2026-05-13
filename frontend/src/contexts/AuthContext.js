import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001',
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Obsługa tokenu z OAuth redirect (?token=...)
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
        .then(r => setUser(r.data))
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
    setUser(user);
  };

  const register = async (email, password) => {
    const res = await API.post('/api/auth/register', { email, password });
    const { access_token, user } = res.data;
    localStorage.setItem('token', access_token);
    API.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    setUser(user);
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

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
