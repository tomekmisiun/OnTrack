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
  macroInsights: [],
  mealsToday: null,
  scheduleInsights: [],
  ownRecipes: null,
  ownProducts: null,
  monthTotalCost: null,
};

function resolveMemberMacroLabel(member, t) {
  if (!member?.macro_goals?.kcal && !member?.goal) return null;
  const i18nKey = GOAL_I18N[member.goal];
  if (i18nKey) return t(i18nKey);
  return member.macro_goals?.goalLabel || member.goal || null;
}

export function useWelcomeStats() {
  const { user } = useAuth();
  const { activeMember, includedMemberIds, members } = useMember();
  const { lang, t } = useLanguage();
  const [stats, setStats] = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  const includedKey = includedMemberIds.join(',');
  const activeId = activeMember?.id;

  useEffect(() => {
    if (!user?.id) {
      setStats(EMPTY);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const includedMids = includedMemberIds.length
      ? includedMemberIds
      : (activeId ? [activeId] : []);
    const today = dateToStr(new Date());
    const weekStart = getCurrentWeek().start;
    const month = getCurrentMonth();
    const todayDow = (new Date().getDay() + 6) % 7;
    const seed = SEED_STATS[lang] || SEED_STATS.pl;

    async function load() {
      setLoading(true);
      try {
        const [mealsResults, scheduleResults, monthRes, productsRes, recipesRes] = await Promise.all([
          includedMids.length
            ? Promise.all(includedMids.map(id => mealPlan.getDay(today, id)))
            : Promise.resolve([]),
          includedMids.length
            ? Promise.all(includedMids.map(id => daySchedule.getAll(id, weekStart)))
            : Promise.resolve([]),
          includedMids.length
            ? mealPlan.getSummary(month.start, month.end, includedMids)
            : Promise.resolve({ data: { total_cost: 0 } }),
          productsApi.getAll(),
          recipesApi.getAll(),
        ]);

        if (cancelled) return;

        const productList = productsRes.data || [];
        const foodCost = monthRes.data?.total_cost ?? 0;
        const enabledExtras = sumEnabledExpenses(SUMMARY_MONTH_DAYS, productList, includedMids.length);
        const monthTotalCost = foodCost + enabledExtras;

        const mealsToday = mealsResults.reduce((sum, res) => sum + (res.data || []).length, 0);
        const scheduleInsights = includedMids.map((mid, i) => {
          const member = members.find(m => m.id === mid);
          const blocks = scheduleResults[i]?.data || [];
          return {
            id: mid,
            name: member?.name || '?',
            count: blocks.filter(b => b.day === todayDow).length,
          };
        });

        const macroInsights = includedMids.map(mid => {
          const member = members.find(m => m.id === mid);
          return {
            id: mid,
            name: member?.name || '?',
            label: member ? resolveMemberMacroLabel(member, t) : null,
          };
        });

        setStats({
          macroInsights,
          mealsToday,
          scheduleInsights,
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
  }, [user?.id, user?.lang, members, lang, t, includedKey]); // eslint-disable-line

  return { stats, loading };
}
