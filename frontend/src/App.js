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
  const { t } = useLanguage();
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)' }}>
        <div style={{ color: '#1f2937', fontSize: 18 }}>{t('loading')}</div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <div className="app">
      <header className="app-header">
        <h1>Meal Planner</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.email}
          </span>

          <button
            onClick={() => setShowProfile(true)}
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: '#1f2937', padding: '5px 13px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
          >
            {t('profile')}
          </button>

          <button
            onClick={logout}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.85)', padding: '5px 13px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#1f2937'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
          >
            {t('logout')}
          </button>
        </div>
      </header>

      <nav className="app-nav">
        <div className="tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="app-main">
        {activeTab === 'calendar'  && <Calendar onGoToTab={setActiveTab} />}
        {activeTab === 'recipes'   && <Recipes />}
        {activeTab === 'products'  && <Products />}
        {activeTab === 'summary'   && <Summary onGoToTab={setActiveTab} />}
      </main>

      {showProfile && <Profile onClose={() => setShowProfile(false)} />}
    </div>
  );
}

// Bridge: passes switchLang into AuthProvider so it can sync lang on login
function AppWithAuth() {
  const { switchLang } = useLanguage();
  return (
    <AuthProvider onLangChange={switchLang}>
      <AppInner />
    </AuthProvider>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppWithAuth />
    </LanguageProvider>
  );
}
