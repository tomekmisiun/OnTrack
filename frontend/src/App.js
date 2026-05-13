import React, { useState } from 'react';
import Products from './components/Products';
import Recipes from './components/Recipes';
import Calendar from './components/Calendar';
import Summary from './components/Summary';
import Login from './components/Login';
import Profile from './components/Profile';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import './App.css';

function AppInner() {
  const { user, loading, logout } = useAuth();
  const { lang, switchLang, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('calendar');
  const [showProfile, setShowProfile] = useState(false);

  const tabs = [
    { id: 'calendar', label: t('tab_calendar') },
    { id: 'recipes',  label: t('tab_recipes') },
    { id: 'products', label: t('tab_products') },
    { id: 'summary',  label: t('tab_summary') },
  ];

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div style={{ color: 'white', fontSize: 18 }}>{t('loading')}</div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <div className="app">
      <header className="app-header">
        <h1>Meal Planner</h1>
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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Language flags */}
          <button
            onClick={() => switchLang('pl')}
            title="Polski"
            style={{
              background: lang === 'pl' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
              border: lang === 'pl' ? '2px solid rgba(255,255,255,0.7)' : '2px solid transparent',
              borderRadius: 6, cursor: 'pointer', fontSize: 20, lineHeight: 1,
              padding: '3px 5px', transition: 'all 0.15s',
            }}
          >
            🇵🇱
          </button>
          <button
            onClick={() => switchLang('en')}
            title="English"
            style={{
              background: lang === 'en' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
              border: lang === 'en' ? '2px solid rgba(255,255,255,0.7)' : '2px solid transparent',
              borderRadius: 6, cursor: 'pointer', fontSize: 20, lineHeight: 1,
              padding: '3px 5px', transition: 'all 0.15s',
            }}
          >
            🇬🇧
          </button>

          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{user.email}</span>

          {/* Profile button */}
          <button
            onClick={() => setShowProfile(true)}
            style={{
              background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
              padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13,
            }}
          >
            {t('profile')}
          </button>

          <button
            onClick={logout}
            style={{
              background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
              padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13,
            }}
          >
            {t('logout')}
          </button>
        </div>
      </header>

      <main className="app-main">
        {activeTab === 'calendar'  && <Calendar />}
        {activeTab === 'recipes'   && <Recipes />}
        {activeTab === 'products'  && <Products />}
        {activeTab === 'summary'   && <Summary />}
      </main>

      {showProfile && <Profile onClose={() => setShowProfile(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </LanguageProvider>
  );
}
