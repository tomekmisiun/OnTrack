import React, { useState, useEffect, useCallback } from 'react';
import { Joyride, STATUS, EVENTS, ACTIONS } from 'react-joyride';
import Products from './components/Products';
import Recipes from './components/Recipes';
import Calendar from './components/Calendar';
import DaySchedule from './components/DaySchedule';
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
import { getTourSteps, getTourLocale, TOUR_STYLES } from './tour-steps';
import './App.css';

const TAB_ICONS = {
  macro:    'heroicons:calculator',
  calendar: 'heroicons:calendar-days',
  schedule: 'heroicons:clock',
  recipes:  'heroicons:book-open',
  products: 'heroicons:shopping-cart',
  summary:  'heroicons:banknotes',
  export:   'heroicons:arrow-down-tray',
};

function tourStorageKey(userId) {
  return `mealplanner_tour_done_${userId}`;
}

function isTourDone(userId) {
  return Boolean(userId && localStorage.getItem(tourStorageKey(userId)) === '1');
}

function markTourDone(userId) {
  if (userId) localStorage.setItem(tourStorageKey(userId), '1');
}

function AppInner({ onStartTour }) {
  const { user, logout } = useAuth();
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
    { id: 'schedule', label: t('tab_schedule') },
    { id: 'recipes',  label: t('tab_recipes') },
    { id: 'products', label: t('tab_products') },
    { id: 'summary',  label: t('tab_summary') },
    { id: 'export',   label: t('tab_export') },
  ];

  if (!user) return <Login />;

  return (
    <div className="app">
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <svg className="sidebar-logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9.5"/>
            <path d="M8.5 15.5 L11.8 11.8 L15.5 8.5 L12.2 12.2 Z" fill="currentColor" stroke="none"/>
          </svg>
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-name">ONTRACK</span>
            <span className="sidebar-logo-sub">BE IN CONTROL</span>
          </div>
        </div>

        <div className="sidebar-profile">
          <span className="sidebar-profile-label">{t('current_profile')}</span>
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
        {activeTab === 'schedule'  && <DaySchedule />}
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

function TourHost() {
  const { user, loading } = useAuth();
  const { lang } = useLanguage();
  const [tourRun, setTourRun] = useState(false);

  useEffect(() => {
    if (!user) setTourRun(false);
  }, [user]);

  useEffect(() => {
    if (loading || !user?.id || isTourDone(user.id)) return undefined;
    const timer = setTimeout(() => setTourRun(true), 600);
    return () => clearTimeout(timer);
  }, [user?.id, loading]);

  const handleTourEvent = useCallback((data) => {
    const { status, type, action, index } = data;

    if (type === EVENTS.STEP_BEFORE) {
      const step = getTourSteps(lang)[index];
      if (step?.gotoTab) {
        window.dispatchEvent(new CustomEvent('tour-goto-tab', { detail: { tab: step.gotoTab } }));
      }
      return;
    }

    if (
      status === STATUS.FINISHED ||
      status === STATUS.SKIPPED ||
      action === ACTIONS.SKIP ||
      (action === ACTIONS.CLOSE && type === EVENTS.TOUR_END)
    ) {
      if (user?.id) markTourDone(user.id);
      setTourRun(false);
    }
  }, [lang, user?.id]);

  const startTour = useCallback(() => {
    setTourRun(false);
    setTimeout(() => setTourRun(true), 100);
  }, []);

  return (
    <>
      {user && (
        <Joyride
          steps={getTourSteps(lang)}
          run={tourRun}
          continuous
          scrollToFirstStep={false}
          locale={getTourLocale(lang)}
          styles={TOUR_STYLES}
          onEvent={handleTourEvent}
          options={{
            skipScroll: true,
            showProgress: true,
            buttons: ['back', 'close', 'skip', 'primary'],
            closeButtonAction: 'skip',
          }}
        />
      )}
      <AppInner onStartTour={startTour} />
    </>
  );
}

function AppWithTour() {
  const { switchLang } = useLanguage();

  return (
    <AuthProvider onLangChange={switchLang}>
      <MemberProvider>
        <TourHost />
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
