import React, { useState, useEffect, useCallback } from 'react';
import { Joyride, STATUS, EVENTS } from 'react-joyride';
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
import { TOUR_STEPS, TOUR_LOCALE, TOUR_STYLES } from './tour-steps';
import './App.css';

const TAB_ICONS = {
  macro:    'heroicons:calculator',
  calendar: 'heroicons:calendar-days',
  recipes:  'heroicons:book-open',
  products: 'heroicons:shopping-cart',
  summary:  'heroicons:banknotes',
  export:   'heroicons:arrow-down-tray',
};

const TOUR_KEY = 'mealplanner_tour_done';

function AppInner({ onStartTour }) {
  const { user, loading, logout } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('calendar');
  const [showProfile, setShowProfile] = useState(false);

  const goToTab = useCallback((tab) => { setActiveTab(tab); window.scrollTo({ top: 0 }); }, []);

  useEffect(() => {
    const handler = (e) => goToTab(e.detail.tab);
    window.addEventListener('tour-goto-tab', handler);
    return () => window.removeEventListener('tour-goto-tab', handler);
  }, [goToTab]);

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
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <Icon icon="heroicons:sparkles" className="sidebar-logo-icon" />
          <span className="sidebar-logo-text">Meal Planner</span>
        </div>

        <div className="sidebar-profile">
          <span className="sidebar-profile-label">Obecny profil</span>
          <MemberPicker />
        </div>

        <nav className="sidebar-nav">
          {tabs.map(tab => (
            <button
              key={tab.id}
              data-tour={`tab-${tab.id}`}
              className={`sidebar-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => goToTab(tab.id)}
            >
              <Icon icon={TAB_ICONS[tab.id]} className="sidebar-tab-icon" />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-btn" onClick={() => setShowProfile(true)}>
            <Icon icon="heroicons:cog-6-tooth" width={15} /> {t('account')}
          </button>
          <button className="sidebar-btn sidebar-btn-logout" onClick={logout}>
            <Icon icon="heroicons:arrow-left-start-on-rectangle" width={15} /> {t('logout')}
          </button>
        </div>
      </aside>

      <main className="app-main">
        {activeTab === 'macro'     && <MacroCalculator />}
        {activeTab === 'calendar'  && <Calendar onGoToTab={goToTab} />}
        {activeTab === 'recipes'   && <Recipes />}
        {activeTab === 'products'  && <Products />}
        {activeTab === 'summary'   && <Summary onGoToTab={goToTab} />}
        {activeTab === 'export'    && <Export onGoToTab={goToTab} />}
      </main>

      {showProfile && (
        <Profile
          onClose={() => setShowProfile(false)}
          onStartTour={() => { setShowProfile(false); onStartTour(); }}
        />
      )}
    </div>
  );
}

function AppWithTour() {
  const { switchLang } = useLanguage();
  const [tourRun, setTourRun] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) {
      const t = setTimeout(() => setTourRun(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const handleTourCallback = useCallback((data) => {
    const { status, type, index } = data;
    if (type === EVENTS.STEP_BEFORE) {
      const step = TOUR_STEPS[index];
      if (step?.gotoTab) {
        window.dispatchEvent(new CustomEvent('tour-goto-tab', { detail: { tab: step.gotoTab } }));
      }
    }
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      localStorage.setItem(TOUR_KEY, '1');
      setTourRun(false);
    }
  }, []);

  const startTour = useCallback(() => {
    setTourRun(false);
    setTimeout(() => setTourRun(true), 100);
  }, []);

  return (
    <AuthProvider onLangChange={switchLang}>
      <MemberProvider>
        <Joyride
          steps={TOUR_STEPS}
          run={tourRun}
          continuous
          showSkipButton
          showProgress
          scrollToFirstStep
          disableScrolling={false}
          locale={TOUR_LOCALE}
          styles={TOUR_STYLES}
          callback={handleTourCallback}
        />
        <AppInner onStartTour={startTour} />
      </MemberProvider>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ToastProvider>
        <AppWithTour />
      </ToastProvider>
    </LanguageProvider>
  );
}
