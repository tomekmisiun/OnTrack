import React from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import './Welcome.css';

const TILES = [
  { id: 'macro',    icon: 'heroicons:calculator' },
  { id: 'calendar', icon: 'heroicons:calendar-days' },
  { id: 'schedule', icon: 'heroicons:clock' },
  { id: 'recipes',  icon: 'heroicons:book-open' },
  { id: 'products', icon: 'heroicons:shopping-cart' },
  { id: 'summary',  icon: 'heroicons:banknotes' },
  { id: 'export',   icon: 'heroicons:arrow-down-tray' },
];

const TAB_LABEL_KEYS = {
  macro: 'tab_macro',
  calendar: 'tab_calendar',
  schedule: 'tab_schedule',
  recipes: 'tab_recipes',
  products: 'tab_products',
  summary: 'tab_summary',
  export: 'tab_export',
};

export default function Welcome({ onGoToTab, onAccount, onLogout }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const displayName = user?.username || user?.email || '';

  return (
    <div className="welcome">
      <header className="welcome-header">
        <h1 className="welcome-title">
          {t('welcome_greeting')}{displayName ? (
            <>, <span className="welcome-name">{displayName}</span></>
          ) : null}
        </h1>
        <p className="welcome-subtitle">{t('welcome_subtitle')}</p>
      </header>

      <div className="welcome-grid">
        {TILES.map(({ id, icon }) => (
          <button
            key={id}
            type="button"
            className="welcome-tile"
            onClick={() => onGoToTab(id)}
          >
            <span className="welcome-tile-icon" aria-hidden="true">
              <Icon icon={icon} width={28} />
            </span>
            <span className="welcome-tile-label">{t(TAB_LABEL_KEYS[id])}</span>
          </button>
        ))}
      </div>

      <footer className="welcome-footer">
        <button type="button" className="welcome-footer-btn welcome-footer-btn--account" onClick={onAccount}>
          <Icon icon="heroicons:cog-6-tooth" width={18} />
          {t('account')}
        </button>
        <button type="button" className="welcome-footer-btn welcome-footer-btn--logout" onClick={onLogout}>
          <Icon icon="heroicons:arrow-left-start-on-rectangle" width={18} />
          {t('logout')}
        </button>
      </footer>
    </div>
  );
}
