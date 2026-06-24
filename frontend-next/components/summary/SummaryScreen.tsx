"use client";

import { useEffect, useMemo, useState } from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import { pl } from "date-fns/locale/pl";
import "react-datepicker/dist/react-datepicker.css";
import { Icon } from "@iconify/react";
import DrinksCard from "@/components/summary/DrinksCard";
import { SummaryPieChart } from "@/components/summary/SummaryPieChart";
import {
  SummaryProductTable,
  type SummaryProductItem,
} from "@/components/summary/SummaryProductTable";
import { OTHER_TYPES } from "@/lib/summary/expenseDefaults";
import { expenseI18nKey } from "@/lib/i18n/expenseKeys";
import { toEU } from "@/lib/dates";
import type { MealPlanSummary } from "@/lib/api/mealPlan";
import type { ExpenseLineItem } from "@/lib/summary/expenseItems";
import type { PieSlice } from "@/components/summary/SummaryPieChart";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { tArray, tFormatN, tString } from "@/lib/i18n/translate";
import { useSummaryPage } from "@/hooks/useSummaryPage";
import "@/components/calendar/calendar.css";
import "@/components/summary/summary.css";

registerLocale("pl", pl);

const COLORS = [
  "#6366f1",
  "#0d9488",
  "#f59e0b",
  "#ec4899",
  "#22c55e",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#06b6d4",
];

type PeriodContentProps = {
  range: { start: string; end: string } | null;
  summary: MealPlanSummary | null;
  loading: boolean;
  scrollToWeek?: boolean;
  onGoToTab: (tab: string) => void;
  drinkItems?: ExpenseLineItem[];
  onCategoriesUpdate?: (categories: PieSlice[]) => void;
  hideHeader?: boolean;
};

function PeriodContent({
  range,
  summary,
  loading,
  scrollToWeek,
  onGoToTab,
  drinkItems = [],
  onCategoriesUpdate,
  hideHeader = false,
}: PeriodContentProps) {
  const { t } = useLanguage();
  const txt = (key: TranslationKey) => tString(t, key);
  const tKey = (key: string) => tString(t, key as TranslationKey);
  const [productsOpen, setProductsOpen] = useState(false);
  const [adjustedTotal, setAdjustedTotal] = useState<number | null>(null);

  const categories = useMemo(() => {
    if (!summary) return [];
    const foodTotal = adjustedTotal !== null ? adjustedTotal : summary.total_cost;
    const drinkKeys = new Set(["kawa", "herbata", "napoje", "woda", "sodaStream"]);
    const napojTotal = drinkItems
      .filter((d) => drinkKeys.has(d._dk))
      .reduce((s, i) => s + i.total, 0);
    const otherGroups = OTHER_TYPES.flatMap((ot, i) => {
      if (ot.key === "lekarze") {
        return drinkItems
          .filter((d) => d._dk === "lekarze")
          .map((d) =>
            d.total > 0
              ? {
                  label: d._tkey ? tKey(d._tkey) : (d.name ?? ot.key),
                  value: d.total,
                  color: COLORS[(i + 3) % COLORS.length]!,
                }
              : null,
          )
          .filter((x): x is PieSlice => x !== null);
      }
      const val = drinkItems.filter((d) => d._dk === ot.key).reduce((s, d) => s + d.total, 0);
      return val > 0
        ? [
            {
              label: tKey(expenseI18nKey(ot.key)),
              value: val,
              color: COLORS[(i + 3) % COLORS.length]!,
            },
          ]
        : [];
    });
    return [
      { label: txt("food_label"), value: foodTotal, color: COLORS[0]! },
      ...(napojTotal > 0
        ? [{ label: txt("drinks_label"), value: napojTotal, color: COLORS[1]! }]
        : []),
      ...otherGroups,
    ];
  }, [summary, adjustedTotal, drinkItems, t]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onCategoriesUpdate?.(categories);
  }, [categories, onCategoriesUpdate]);

  return (
    <div>
      {!hideHeader && (
        <div
          style={{
            padding: "16px 20px 12px",
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div style={{ flexShrink: 0 }}>
            {range && (
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
                {toEU(range.start)} – {toEU(range.end)}
              </div>
            )}
            <button
              onClick={() => {
                onGoToTab("calendar");
                if (scrollToWeek) {
                  setTimeout(
                    () =>
                      document
                        .getElementById("calendar-today")
                        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
                    200,
                  );
                }
              }}
              style={{
                background: "#0d948820",
                border: "1px solid #0d9488",
                borderRadius: 6,
                padding: "3px 10px",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
                color: "#2dd4bf",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              {txt("btn_go_calendar")}
            </button>
          </div>
        </div>
      )}

      {!loading && summary && (
        <div style={{ borderTop: "1px solid #374151" }}>
          <button
            onClick={() => setProductsOpen((o) => !o)}
            style={{
              width: "100%",
              padding: "10px 20px",
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ textAlign: "left" }}>
              <div style={{ marginBottom: 2 }}>
                <span className="card-section-title">{txt("food_expenses_label")}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0d9488" }}>
                {productsOpen ? txt("hide_product_list") : txt("show_product_list")}
              </div>
            </div>
            <Icon
              icon="heroicons:chevron-down"
              style={{
                width: 20,
                height: 20,
                transition: "transform 0.25s",
                transform: productsOpen ? "rotate(180deg)" : "rotate(0deg)",
                color: "#0d9488",
              }}
            />
          </button>
          {productsOpen && summary.items.length > 0 && (
            <div style={{ padding: "0 16px 16px" }}>
              <SummaryProductTable
                items={summary.items as SummaryProductItem[]}
                onTotalChange={setAdjustedTotal}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SummaryScreen() {
  const {
    week,
    month,
    weekSummary,
    monthSummary,
    weekLoading,
    monthLoading,
    activePeriod,
    setActivePeriod,
    customRange,
    setCustomRange,
    customSummary,
    customLoading,
    handleCustomLoad,
    expandedTpl,
    setExpandedTpl,
    deleteTemplate,
    productList,
    drinkItems,
    setDrinkItems,
    pieCategories,
    setPieCategories,
    productsOpenCustom,
    setProductsOpenCustom,
    drinksDays,
    drinksPeriodLabel,
    goToTab,
    tplData,
  } = useSummaryPage();

  const { t } = useLanguage();
  const txt = (key: TranslationKey) => tString(t, key);
  const DAY_NAMES = tArray(t, "day_short");

  return (
    <div>
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #374151" }}>
          {(
            [
              { id: "month" as const, label: txt("this_month") },
              { id: "week" as const, label: txt("this_week") },
              { id: "custom" as const, label: txt("custom_period") },
            ] as const
          ).map(({ id, label }, idx, arr) => (
            <button
              key={id}
              onClick={() => setActivePeriod(id)}
              style={{
                flex: 1,
                padding: "10px 8px",
                cursor: "pointer",
                border: "none",
                borderRight: idx < arr.length - 1 ? "1px solid #374151" : "none",
                borderBottom:
                  activePeriod === id ? "3px solid #0d9488" : "3px solid transparent",
                background: activePeriod === id ? "#0d948818" : "#111827",
                color: activePeriod === id ? "#2dd4bf" : "#e2e8f0",
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: activePeriod === id ? "0.2px" : 0,
                transition: "all 0.15s",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "stretch" }}>
          <div style={{ flex: 2, minWidth: 0, borderRight: "1px solid #374151" }}>
            <div style={{ borderBottom: "1px solid #374151" }}>
              {activePeriod === "week" && (
                <PeriodContent
                  range={week}
                  summary={weekSummary}
                  loading={weekLoading}
                  scrollToWeek
                  onGoToTab={goToTab}
                  drinkItems={drinkItems}
                  onCategoriesUpdate={setPieCategories}
                  hideHeader
                />
              )}
              {activePeriod === "month" && (
                <PeriodContent
                  range={month}
                  summary={monthSummary}
                  loading={monthLoading}
                  onGoToTab={goToTab}
                  drinkItems={drinkItems}
                  onCategoriesUpdate={setPieCategories}
                  hideHeader
                />
              )}
              {activePeriod === "custom" &&
                customSummary &&
                customSummary.items.length > 0 && (
                  <div>
                    <button
                      onClick={() => setProductsOpenCustom((o) => !o)}
                      style={{
                        width: "100%",
                        padding: "10px 20px",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ textAlign: "left" }}>
                        <div style={{ marginBottom: 2 }}>
                          <span className="card-section-title">{txt("food_expenses_label")}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0d9488" }}>
                          {productsOpenCustom ? txt("hide_product_list") : txt("show_product_list")}
                        </div>
                      </div>
                      <Icon
                        icon="heroicons:chevron-down"
                        style={{
                          width: 20,
                          height: 20,
                          transition: "transform 0.25s",
                          transform: productsOpenCustom ? "rotate(180deg)" : "rotate(0deg)",
                          color: "#0d9488",
                        }}
                      />
                    </button>
                    {productsOpenCustom && (
                      <div style={{ padding: "0 16px 16px" }}>
                        <SummaryProductTable
                          items={customSummary.items as SummaryProductItem[]}
                        />
                      </div>
                    )}
                  </div>
                )}
            </div>
            <div style={{ padding: "16px 20px" }}>
              <DrinksCard
                days={drinksDays}
                periodLabel={drinksPeriodLabel}
                productList={productList}
                onUpdate={setDrinkItems}
                pieCategories={pieCategories}
              />
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              borderLeft: "1px solid #374151",
            }}
          >
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                padding: "16px",
                gap: 12,
                overflowY: "auto",
              }}
            >
              {pieCategories.length > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <SummaryPieChart slices={pieCategories} size={190} interactive />
                  </div>
                  <div style={{ width: "100%" }}>
                    {pieCategories.map((cat, i) => (
                      <div
                        key={i}
                        style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            background: cat.color,
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 11,
                            color: "#9ca3af",
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {cat.label}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#e2e8f0",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {cat.value.toFixed(2)} {txt("currency")}
                        </span>
                      </div>
                    ))}
                    <div
                      style={{
                        borderTop: "1px solid #374151",
                        paddingTop: 10,
                        marginTop: 4,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                      }}
                    >
                      <span style={{ fontSize: 13, color: "#9ca3af", fontWeight: 700 }}>
                        {txt("expenses_total")}
                      </span>
                      <span style={{ fontSize: 22, fontWeight: 800, color: "#0d9488" }}>
                        {pieCategories.reduce((s, c) => s + c.value, 0).toFixed(2)} {txt("currency")}
                      </span>
                    </div>
                  </div>
                </>
              )}
              {pieCategories.length === 0 && (
                <div style={{ color: "#4b5563", fontSize: 12, textAlign: "center", marginTop: 40 }}>
                  {txt("no_data_label")}
                </div>
              )}

              <div style={{ borderTop: "1px solid #374151", paddingTop: 12, marginTop: 4 }}>
                {activePeriod === "custom" ? (
                  <>
                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>
                          {txt("date_from")}
                        </div>
                        <DatePicker
                          locale="pl"
                          dateFormat="dd.MM.yyyy"
                          selected={customRange.start ? new Date(customRange.start) : null}
                          onChange={(d: Date | null) =>
                            setCustomRange((r) => ({
                              ...r,
                              start: d ? d.toISOString().slice(0, 10) : "",
                            }))
                          }
                          placeholderText="dd.mm.yyyy"
                          className="dp-input"
                          popperPlacement="top-start"
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>
                          {txt("date_to")}
                        </div>
                        <DatePicker
                          locale="pl"
                          dateFormat="dd.MM.yyyy"
                          selected={customRange.end ? new Date(customRange.end) : null}
                          onChange={(d: Date | null) =>
                            setCustomRange((r) => ({
                              ...r,
                              end: d ? d.toISOString().slice(0, 10) : "",
                            }))
                          }
                          placeholderText="dd.mm.yyyy"
                          className="dp-input"
                          popperPlacement="top-end"
                          minDate={customRange.start ? new Date(customRange.start) : undefined}
                        />
                      </div>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={() => void handleCustomLoad()}
                      disabled={customLoading}
                      style={{ fontSize: 11, width: "100%", marginTop: 8 }}
                    >
                      {customLoading ? "..." : txt("generate")}
                    </button>
                  </>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>
                        {txt("date_from")}
                      </div>
                      <div
                        style={{
                          padding: "7px 10px",
                          border: "1px solid #374151",
                          borderRadius: 6,
                          fontSize: 12,
                          color: "#9ca3af",
                          background: "#111827",
                          textAlign: "center",
                        }}
                      >
                        {activePeriod === "month" && month
                          ? toEU(month.start)
                          : activePeriod === "week" && week
                            ? toEU(week.start)
                            : "—"}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>
                        {txt("date_to")}
                      </div>
                      <div
                        style={{
                          padding: "7px 10px",
                          border: "1px solid #374151",
                          borderRadius: 6,
                          fontSize: 12,
                          color: "#9ca3af",
                          background: "#111827",
                          textAlign: "center",
                        }}
                      >
                        {activePeriod === "month" && month
                          ? toEU(month.end)
                          : activePeriod === "week" && week
                            ? toEU(week.end)
                            : "—"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "16px 20px" }}>
          <h2 className="card-section-title">{txt("week_templates_sum")}</h2>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button
              onClick={() => {
                goToTab("calendar");
                setTimeout(() => window.dispatchEvent(new Event("open-template")), 250);
              }}
              style={{
                background: "#0d948820",
                border: "1px solid #0d9488",
                borderRadius: 6,
                padding: "3px 10px",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
                color: "#2dd4bf",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              {txt("btn_create_template")}
            </button>
            <button
              onClick={() => goToTab("calendar")}
              style={{
                background: "#0d948820",
                border: "1px solid #0d9488",
                borderRadius: 6,
                padding: "3px 10px",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
                color: "#2dd4bf",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              {txt("btn_go_calendar")}
            </button>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #374151" }}>
          {tplData.map((tpl, i) => {
            const isOpen = expandedTpl === i;
            const byDay = Array.from({ length: 7 }, (_, d) =>
              tpl.meals.filter((m) => m.dayOffset === d).sort((a, b) => a.position - b.position),
            );
            const activeDays = byDay
              .map((meals, d) => ({ d, meals }))
              .filter((x) => x.meals.length > 0);

            return (
              <div
                key={i}
                style={{ borderBottom: i < tplData.length - 1 ? "1px solid #2d3748" : "none" }}
              >
                <div
                  className="template-row"
                  style={{
                    padding: "12px 20px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                  onClick={() => setExpandedTpl(isOpen ? null : i)}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{tpl.name}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                      {tFormatN(t, "meals_n", tpl.meals.length)}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>{txt("est_weekly_cost")}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#0d9488" }}>
                        ~{tpl.estimatedCost.toFixed(2)} {txt("currency")}
                      </div>
                    </div>
                    <button
                      className="btn btn-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTemplate(i);
                      }}
                    >
                      {txt("delete")}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ padding: "0 20px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {activeDays.map(({ d, meals }) => (
                      <div
                        key={d}
                        style={{
                          background: "#111827",
                          borderRadius: 8,
                          padding: "8px 12px",
                          minWidth: 110,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#0d9488",
                            marginBottom: 6,
                          }}
                        >
                          {DAY_NAMES[d]}
                        </div>
                        {meals.map((m, mi) => (
                          <div
                            key={mi}
                            style={{
                              fontSize: 12,
                              color: "#e2e8f0",
                              marginBottom: 3,
                              display: "flex",
                              gap: 6,
                              alignItems: "flex-start",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 10,
                                color: "#6b7280",
                                minWidth: 14,
                                paddingTop: 1,
                              }}
                            >
                              {m.position}.
                            </span>
                            <span>{m.recipe_name}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
