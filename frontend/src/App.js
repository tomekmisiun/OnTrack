import React, { useState } from 'react';
import Products from './components/Products';
import Recipes from './components/Recipes';
import Calendar from './components/Calendar';
import Summary from './components/Summary';
import Login from './components/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './App.css';

const tabs = [
  { id: 'calendar', label: '📅 Kalendarz' },
  { id: 'recipes', label: '🍽️ Przepisy' },
  { id: 'products', label: '🛒 Produkty' },
  { id: 'summary', label: '📊 Podsumowanie' },
];

function AppInner() {
  const { user, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('calendar');

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div style={{ color: 'white', fontSize: 18 }}>Ładowanie…</div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <div className="app">
      <header className="app-header">
        <h1>🥗 Meal Planner</h1>
        <nav className="tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{user.email}</span>
          <button
            onClick={logout}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13 }}
          >
            Wyloguj
          </button>
        </div>
      </header>
      <main className="app-main">
        {activeTab === 'calendar' && <Calendar />}
        {activeTab === 'recipes' && <Recipes />}
        {activeTab === 'products' && <Products />}
        {activeTab === 'summary' && <Summary />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
