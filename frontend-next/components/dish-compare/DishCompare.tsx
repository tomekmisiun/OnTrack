"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getDishCompare,
  type DishCompareResponse,
} from "@/lib/api/public";
import { tFormatArgs, tString } from "@/lib/i18n/translate";
import "./dish-compare.css";

const AUTO_INTERVAL_MS = 8250;
const MANUAL_PAUSE_MS = 12000;

const DISH_ICONS: Record<string, string> = {
  pizza_margherita: "mdi:pizza",
  pepperoni_pizza: "mdi:pizza",
  chicken_chow_mein: "mdi:noodles",
  sweet_and_sour_chicken: "mdi:food-drumstick",
  chicken_tikka_masala: "mdi:bowl-mix",
  spaghetti_bolognese: "mdi:noodles",
};

function formatMoney(value: number | string, currency: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return `0.00 ${currency}`;
  return `${n.toFixed(2)} ${currency}`;
}

export function DishCompare() {
  const { lang, t } = useLanguage();
  const currency = tString(t, "currency");

  const [data, setData] = useState<DishCompareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [autoPaused, setAutoPaused] = useState(false);
  const pauseUntilRef = useRef(0);
  const showIngredientsRef = useRef(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabsListRef = useRef<HTMLDivElement | null>(null);

  const dishes = data?.dishes || [];
  const mealPrep = data?.meal_prep || {};
  const activeDish = dishes[activeIndex] || null;

  showIngredientsRef.current = showIngredients;

  const goToIndex = useCallback((index: number, manual = false) => {
    if (!dishes.length) return;
    const next = ((index % dishes.length) + dishes.length) % dishes.length;
    setActiveIndex(next);
    setAnimKey((k) => k + 1);
    setShowIngredients(false);
    if (manual) {
      setAutoPaused(true);
      pauseUntilRef.current = Date.now() + MANUAL_PAUSE_MS;
    }
  }, [dishes.length]);

  const goNext = useCallback((manual = true) => goToIndex(activeIndex + 1, manual), [activeIndex, goToIndex]);
  const goPrev = useCallback((manual = true) => goToIndex(activeIndex - 1, manual), [activeIndex, goToIndex]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    getDishCompare(lang)
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setActiveIndex(0);
        setAnimKey((k) => k + 1);
        setShowIngredients(false);
        setAutoPaused(false);
        tabRefs.current = [];
        if (tabsListRef.current) tabsListRef.current.scrollLeft = 0;
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [lang]);

  useEffect(() => {
    if (!dishes.length || loading) return undefined;

    const tick = setInterval(() => {
      if (showIngredientsRef.current) return;
      if (Date.now() < pauseUntilRef.current) return;
      setAutoPaused(false);
      setActiveIndex((i) => (i + 1) % dishes.length);
      setAnimKey((k) => k + 1);
      setShowIngredients(false);
    }, AUTO_INTERVAL_MS);

    return () => clearInterval(tick);
  }, [dishes.length, loading]);

  useEffect(() => {
    const list = tabsListRef.current;
    const tab = tabRefs.current[activeIndex];
    if (!list || !tab) return;

    const listWidth = list.clientWidth;
    const maxScroll = Math.max(0, list.scrollWidth - listWidth);

    if (activeIndex === 0) {
      list.scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }
    if (activeIndex === dishes.length - 1) {
      list.scrollTo({ left: maxScroll, behavior: 'smooth' });
      return;
    }

    const tabLeft = tab.offsetLeft;
    const tabWidth = tab.offsetWidth;
    const targetScroll = tabLeft - (listWidth - tabWidth) / 2;
    list.scrollTo({
      left: Math.max(0, Math.min(targetScroll, maxScroll)),
      behavior: 'smooth',
    });
  }, [activeIndex, dishes.length]);

  const dishNum = activeDish?.defaults?.avg_restaurant_price ?? 0;
  const deliveryNum = data?.default_delivery_price ?? 0;
  const orderTotal = Math.round((dishNum + deliveryNum) * 100) / 100;
  const diyCost = activeDish?.diy_cost ?? 0;
  const savings = Math.round((orderTotal - diyCost) * 100) / 100;
  const savingsPct = orderTotal > 0 ? Math.max(0, Math.round((savings / orderTotal) * 100)) : 0;
  const diyBarPct = orderTotal > 0 ? Math.min(100, Math.round((diyCost / orderTotal) * 100)) : 0;
  const avgHourlyWage = mealPrep.avg_hourly_wage ?? (lang === 'en' ? 13.5 : 33.7);
  const workHoursSaved = avgHourlyWage > 0 ? Math.round((savings / avgHourlyWage) * 10) / 10 : 0;

  if (loading) {
    return (
      <section className="dish-compare dish-compare--loading" aria-label={tString(t, "compare_headline_1")}>
        <div className="dish-compare-skeleton" />
      </section>
    );
  }

  if (error || !dishes.length || !activeDish) {
    return null;
  }

  const dishIcon = DISH_ICONS[activeDish.id] || 'mdi:silverware-fork-knife';

  return (
    <section className="dish-compare" aria-label={tString(t, "compare_headline_1")}>
      <div className="dish-compare-widget">
        <div className="dish-compare-nav">
        <button type="button" className="dish-compare-arrow" onClick={() => goPrev(true)} aria-label={tString(t, "compare_prev")}>
          <Icon icon="heroicons:chevron-left" width={20} />
        </button>

        <div className="dish-compare-tabs" role="tablist" ref={tabsListRef}>
          {dishes.map((dish, index) => (
            <button
              key={dish.id}
              type="button"
              role="tab"
              ref={(el) => { tabRefs.current[index] = el; }}
              aria-selected={index === activeIndex}
              className={`dish-compare-tab${index === activeIndex ? ' dish-compare-tab--active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => goToIndex(index, true)}
            >
              <Icon icon={DISH_ICONS[dish.id] || 'mdi:silverware-fork-knife'} width={18} />
              {dish.name}
            </button>
          ))}
        </div>

        <button type="button" className="dish-compare-arrow" onClick={() => goNext(true)} aria-label={tString(t, "compare_next")}>
          <Icon icon="heroicons:chevron-right" width={20} />
        </button>
        </div>

        <div className="dish-compare-dots" aria-hidden="true">
        {dishes.map((dish, index) => (
          <button
            key={dish.id}
            type="button"
            className={`dish-compare-dot${index === activeIndex ? ' dish-compare-dot--active' : ''}${index === activeIndex && !autoPaused && !showIngredients ? ' dish-compare-dot--auto' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => goToIndex(index, true)}
            aria-label={dish.name}
          />
        ))}
      </div>

      <div className="dish-compare-shell">
        <div className="dish-compare-shell-glow" aria-hidden="true" />

        <div key={animKey} className="dish-compare-hero dish-compare-hero--animate">
          <p className="dish-compare-portion">
            <Icon icon={dishIcon} width={16} />
            {activeDish.portion_note}
          </p>

          <div className="dish-compare-duel">
            <div className="dish-compare-panel dish-compare-panel--order">
              <div className="dish-compare-panel-icon dish-compare-panel-icon--order">
                <Icon icon="heroicons:truck" width={22} />
              </div>
              <span className="dish-compare-panel-label">{tString(t, "compare_order_label")}</span>
              <span className="dish-compare-panel-price">{formatMoney(orderTotal, currency)}</span>
              <div className="dish-compare-panel-breakdown">
                <span>{tString(t, "compare_menu")} {formatMoney(dishNum, currency)}</span>
                <span>{tString(t, "compare_delivery_fee")} {formatMoney(deliveryNum, currency)}</span>
              </div>
            </div>

            <div className="dish-compare-vs" aria-hidden="true">
              <span>VS</span>
            </div>

            <div className="dish-compare-panel dish-compare-panel--diy">
              <div className="dish-compare-panel-icon dish-compare-panel-icon--diy">
                <Icon icon="heroicons:home-modern" width={22} />
              </div>
              <span className="dish-compare-panel-label">{tString(t, "compare_diy_label")}</span>
              <span className="dish-compare-panel-price dish-compare-panel-price--diy">
                {formatMoney(diyCost, currency)}
              </span>
              <span className="dish-compare-panel-tag">{tString(t, "compare_diy_tag")}</span>
            </div>
          </div>

          <div className="dish-compare-bars" aria-hidden="true">
            <div className="dish-compare-bar-row">
              <span className="dish-compare-bar-label dish-compare-bar-label--order">{tString(t, "compare_order_label")}</span>
              <div className="dish-compare-bar-track">
                <div className="dish-compare-bar dish-compare-bar--order" style={{ width: '100%' }} />
              </div>
            </div>
            <div className="dish-compare-bar-row">
              <span className="dish-compare-bar-label dish-compare-bar-label--diy">{tString(t, "compare_diy_label")}</span>
              <div className="dish-compare-bar-track">
                <div className="dish-compare-bar dish-compare-bar--diy" style={{ width: `${diyBarPct}%` }} />
              </div>
            </div>
          </div>

          {savings > 0 && (
            <div className="dish-compare-savings-banner">
              <div className="dish-compare-savings-icon">
                <Icon icon="heroicons:banknotes" width={26} />
              </div>
              <div className="dish-compare-savings-copy">
                <span className="dish-compare-savings-headline">
                  {tFormatArgs(
                    t,
                    "compare_savings_headline",
                    formatMoney(savings, currency),
                  )}
                </span>
                <p className="dish-compare-savings-detail">
                  {tFormatArgs(
                    t,
                    "compare_savings_detail",
                    workHoursSaved,
                    formatMoney(avgHourlyWage, currency),
                  )}
                </p>
              </div>
              <span className="dish-compare-savings-pct">{savingsPct}%</span>
            </div>
          )}

          {activeDish.defaults?.price_note && (
            <p className="dish-compare-note">{activeDish.defaults.price_note}</p>
          )}
        </div>

        <button
          type="button"
          className="dish-compare-ingredients-toggle"
          onClick={() => setShowIngredients((v) => !v)}
          aria-expanded={showIngredients}
        >
          <Icon icon={showIngredients ? 'heroicons:chevron-up' : 'heroicons:chevron-down'} width={16} />
          {tString(t, "compare_ingredients")}
        </button>

        {showIngredients && (
          <ul className="dish-compare-ingredients">
            {activeDish.ingredients.map((ing) => (
              <li key={`${ing.product_name}-${ing.weight}`}>
                <span className="dish-compare-ing-name">
                  {ing.product_name}
                  <em>
                    {ing.weight}
                    {ing.unit === 'szt' ? ` ${tString(t, "unit_pcs")}` : (ing.unit === 'ml' ? ' ml' : ' g')}
                  </em>
                </span>
                <span className="dish-compare-ing-cost">{formatMoney(ing.cost, currency)}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="dish-compare-disclaimer">{tString(t, "compare_disclaimer")}</p>
      </div>
      </div>
    </section>
  );
}


