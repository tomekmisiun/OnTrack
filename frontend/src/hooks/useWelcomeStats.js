import { useState, useEffect } from 'react';
import { mealPlan, daySchedule, products as productsApi, recipes as recipesApi } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useMember } from '../contexts/MemberContext';
import { useLanguage } from '../contexts/LanguageContext';
import { dateToStr, getCurrentWeek, getCurrentMonth } from '../utils/dates';
import { SEED_STATS } from '../data/seedStats';
import { sumEnabledExpenses, SUMMARY_MONTH_DAYS } from '../utils/expenseItems';

const GOAL_I18N = {
  lose: 'macro_cut',
  maintain: 'macro_maintain',
  extreme: 'macro_aggr_cut',
  gain: 'macro_bulk',
};

const EMPTY = {
  macroGoalLabel: null,
  mealsToday: null,
  scheduleToday: null,
  ownRecipes: null,
  ownProducts: null,
  monthTotalCost: null,
};

function resolveMacroGoalLabel(activeMember, t) {
  if (!activeMember?.macro_goals?.kcal && !activeMember?.goal) return null;
  const i18nKey = GOAL_I18N[activeMember.goal];
  if (i18nKey) return t(i18nKey);
  return activeMember.macro_goals?.goalLabel || activeMember.goal || null;
}

export function useWelcomeStats() {
  const { user } = useAuth();
  const { activeMember } = useMember();
  const { lang, t } = useLanguage();
  const [stats, setStats] = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setStats(EMPTY);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const memberId = activeMember?.id;
    const today = dateToStr(new Date());
    const weekStart = getCurrentWeek().start;
    const month = getCurrentMonth();
    const todayDow = (new Date().getDay() + 6) % 7;
    const seed = SEED_STATS[lang] || SEED_STATS.pl;

    async function load() {
      setLoading(true);
      try {
        const mids = memberId ? [memberId] : [];
        const [mealsRes, scheduleRes, monthRes, productsRes, recipesRes] = await Promise.all([
          memberId ? mealPlan.getDay(today, memberId) : Promise.resolve({ data: [] }),
          memberId ? daySchedule.getAll(memberId, weekStart) : Promise.resolve({ data: [] }),
          mids.length ? mealPlan.getSummary(month.start, month.end, mids) : Promise.resolve({ data: { total_cost: 0 } }),
          productsApi.getAll(),
          recipesApi.getAll(),
        ]);

        if (cancelled) return;

        const productList = productsRes.data || [];
        const foodCost = monthRes.data?.total_cost ?? 0;
        const enabledExtras = sumEnabledExpenses(SUMMARY_MONTH_DAYS, productList);
        const monthTotalCost = foodCost + enabledExtras;

        setStats({
          macroGoalLabel: resolveMacroGoalLabel(activeMember, t),
          mealsToday: (mealsRes.data || []).length,
          scheduleToday: (scheduleRes.data || []).filter(b => b.day === todayDow).length,
          ownProducts: Math.max(0, productList.length - seed.products),
          ownRecipes: Math.max(0, (recipesRes.data || []).length - seed.recipes),
          monthTotalCost,
        });
      } catch {
        if (!cancelled) setStats(EMPTY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user?.id, user?.lang, activeMember?.id, activeMember?.goal, activeMember?.macro_goals, lang, t]);

  return { stats, loading };
}
