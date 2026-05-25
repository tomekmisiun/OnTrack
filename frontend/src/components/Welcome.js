import React from 'react';
import { Icon } from '@iconify/react';
import { useLanguage } from '../contexts/LanguageContext';
import { useWelcomeStats } from '../hooks/useWelcomeStats';
import WelcomeMembers from './WelcomeMembers';
import './Welcome.css';

const TILES = [
  { id: 'macro',    icon: 'heroicons:calculator',      descKey: 'welcome_tile_macro',    insight: 'macro' },
  { id: 'calendar', icon: 'heroicons:calendar-days',   descKey: 'welcome_tile_calendar', insight: 'meals' },
  { id: 'schedule', icon: 'heroicons:clock',           descKey: 'welcome_tile_schedule', insight: 'schedule' },
  { id: 'recipes',  icon: 'heroicons:book-open',       descKey: 'welcome_tile_recipes',  insight: 'recipes' },
  { id: 'products', icon: 'heroicons:shopping-cart',   descKey: 'welcome_tile_products', insight: 'products' },
  { id: 'summary',  icon: 'heroicons:banknotes',       descKey: 'welcome_tile_summary',  insight: 'expenses' },
  { id: 'export',   icon: 'heroicons:arrow-down-tray', descKey: 'welcome_tile_export' },
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

function countLabel(t, oneKey, manyKey, n) {
  if (n === 1) return t(oneKey);
  return t(manyKey)(n);
}

function getInsight(tileId, insightType, stats, loading, t) {
  if (!insightType) return null;

  if (loading) {
    return { text: t('welcome_insight_loading'), tone: 'muted' };
  }

  switch (insightType) {
    case 'macro':
      if (stats.macroGoalLabel) {
        return { text: stats.macroGoalLabel, tone: 'active' };
      }
      return { text: t('welcome_insight_macro_none'), tone: 'empty' };

    case 'meals':
      if (stats.mealsToday > 0) {
        return {
          text: countLabel(t, 'welcome_insight_meals_one', 'welcome_insight_meals_many', stats.mealsToday),
          tone: 'active',
        };
      }
      return { text: t('welcome_insight_meals_none'), tone: 'empty' };

    case 'schedule':
      if (stats.scheduleToday > 0) {
        return {
          text: countLabel(t, 'welcome_insight_schedule_one', 'welcome_insight_schedule_many', stats.scheduleToday),
          tone: 'active',
        };
      }
      return { text: t('welcome_insight_schedule_none'), tone: 'empty' };

    case 'recipes':
      if (stats.ownRecipes > 0) {
        return {
          text: countLabel(t, 'welcome_insight_recipes_one', 'welcome_insight_recipes_many', stats.ownRecipes),
          tone: 'active',
        };
      }
      return { text: t('welcome_insight_recipes_none'), tone: 'empty' };

    case 'products':
      if (stats.ownProducts > 0) {
        return {
          text: countLabel(t, 'welcome_insight_products_one', 'welcome_insight_products_many', stats.ownProducts),
          tone: 'active',
        };
      }
      return { text: t('welcome_insight_products_none'), tone: 'empty' };

    case 'expenses':
      if (stats.monthTotalCost > 0) {
        return {
          text: t('welcome_insight_expenses')(stats.monthTotalCost, t('currency')),
          tone: 'active',
        };
      }
      return { text: t('welcome_insight_expenses_none'), tone: 'empty' };

    default:
      return null;
  }
}

export default function Welcome({ onGoToTab, onAccount, onLogout }) {
  const { t } = useLanguage();
  const { stats, loading } = useWelcomeStats();

  return (
    <div className="welcome-page">
      <div className="welcome-bg" aria-hidden="true">
        <div className="welcome-bg-glow welcome-bg-glow--tl" />
        <div className="welcome-bg-glow welcome-bg-glow--br" />
        <div className="welcome-bg-grid" />
      </div>

      <div className="welcome">
        <div className="welcome-brand">
          <svg className="welcome-brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9.5"/>
            <path d="M8.5 15.5 L11.8 11.8 L15.5 8.5 L12.2 12.2 Z" fill="currentColor" stroke="none"/>
          </svg>
          <div className="welcome-brand-text">
            <span className="welcome-brand-name">ONTRACK</span>
            <span className="welcome-brand-sub">BE IN CONTROL</span>
          </div>
        </div>

        <header className="welcome-header">
          <h1 className="welcome-title">{t('welcome_greeting')}</h1>
          <p className="welcome-subtitle">{t('welcome_subtitle')}</p>
        </header>

        <div className="welcome-grid">
          {TILES.map(({ id, icon, descKey, insight }) => {
            const insightData = getInsight(id, insight, stats, loading, t);
            return (
              <button
                key={id}
                type="button"
                className="welcome-tile-stack"
                onClick={() => onGoToTab(id)}
              >
                {insightData && (
                  <div className={`welcome-insight welcome-insight--${insightData.tone}`}>
                    {insightData.text}
                  </div>
                )}
                <div className="welcome-tile">
                  <span className="welcome-tile-icon" aria-hidden="true">
                    <Icon icon={icon} width={26} />
                  </span>
                  <span className="welcome-tile-body">
                    <span className="welcome-tile-label">{t(TAB_LABEL_KEYS[id])}</span>
                    <span className="welcome-tile-desc">{t(descKey)}</span>
                  </span>
                  <Icon icon="heroicons:chevron-right" className="welcome-tile-arrow" width={18} aria-hidden="true" />
                </div>
              </button>
            );
          })}
        </div>

        <WelcomeMembers />

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
    </div>
  );
}
