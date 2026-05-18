import React, { useState } from 'react';
import Products from './components/Products';
import Recipes from './components/Recipes';
import Calendar from './components/Calendar';
import Summary from './components/Summary';
import Export from './components/Export';
import MacroCalculator from './components/MacroCalculator';
import Login from './components/Login';
import Profile from './components/Profile';
import MemberPicker from './components/MemberPicker';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { ToastProvider } from './contexts/ToastContext';
import { MemberProvider } from './contexts/MemberContext';
import { Icon } from '@iconify/react';
import './App.css';

const TAB_ICONS = {
  macro:    'heroicons:calculator',
  calendar: 'heroicons:calendar-days',
  recipes:  'heroicons:book-open',
  products: 'heroicons:shopping-cart',
  summary:  'heroicons:banknotes',
  export:   'heroicons:arrow-down-tray',
};

function AppInner() {
  const { user, loading, logout } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('calendar');
  const [showProfile, setShowProfile] = useState(false);

  const goToTab = (tab) => { setActiveTab(tab); window.scrollTo({ top: 0 }); };

  const tabs = [
    { id: 'macro',    label: t('tab_macro') },
    { id: 'calendar', label: t('tab_calendar') },
    { id: 'recipes',  label: t('tab_recipes') },
    { id: 'products', label: t('tab_products') },
    { id: 'summary',  label: t('tab_summary') },
    { id: 'export',   label: t('tab_export') },
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
      {/* ── Lewa kolumna ── */}
      <aside className="app-sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <Icon icon="heroicons:sparkles" className="sidebar-logo-icon" />
          <span className="sidebar-logo-text">Meal Planner</span>
        </div>

        {/* Profil */}
        <div className="sidebar-profile">
          <span className="sidebar-profile-label">Obecny profil</span>
          <MemberPicker />
        </div>

        {/* Nawigacja */}
        <nav className="sidebar-nav">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`sidebar-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => goToTab(tab.id)}
            >
              <Icon icon={TAB_ICONS[tab.id]} className="sidebar-tab-icon" />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Dół — konto + wyloguj */}
        <div className="sidebar-footer">
          <button className="sidebar-btn" onClick={() => setShowProfile(true)}>
            <Icon icon="heroicons:cog-6-tooth" width={15} /> {t('account')}
          </button>
          <button className="sidebar-btn sidebar-btn-logout" onClick={logout}>
            <Icon icon="heroicons:arrow-left-start-on-rectangle" width={15} /> {t('logout')}
          </button>
        </div>
      </aside>

      {/* ── Treść główna ── */}
      <main className="app-main">
        {activeTab === 'macro'     && <MacroCalculator />}
        {activeTab === 'calendar'  && <Calendar onGoToTab={goToTab} />}
        {activeTab === 'recipes'   && <Recipes />}
        {activeTab === 'products'  && <Products />}
        {activeTab === 'summary'   && <Summary onGoToTab={goToTab} />}
        {activeTab === 'export'    && <Export onGoToTab={goToTab} />}
      </main>

      {showProfile && <Profile onClose={() => setShowProfile(false)} />}
    </div>
  );
}

function AppWithAuth() {
  const { switchLang } = useLanguage();
  return (
    <AuthProvider onLangChange={switchLang}>
      <MemberProvider>
        <AppInner />
      </MemberProvider>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ToastProvider>
        <AppWithAuth />
      </ToastProvider>
    </LanguageProvider>
  );
}
