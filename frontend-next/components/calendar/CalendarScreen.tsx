"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from "@dnd-kit/core";
import { Icon } from "@iconify/react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { CalendarHelpModal } from "@/components/calendar/CalendarHelpModal";
import "@/components/calendar/calendar.css";
import { useCalendarPage, pickRecipeMacros, toTplSlot } from "@/hooks/useCalendarPage";
import { getRecipe } from "@/lib/api/recipes";
import { updateProduct } from "@/lib/api/products";
import { getUpcomingMondays, toEU, dateToStr } from "@/lib/dates";
import type { TranslationKey } from "@/lib/i18n/translations";
import { tFormat, tFormatN, tString } from "@/lib/i18n/translate";
import { fuzzySearch } from "@/lib/recipes/search";
import {
  ingredientMacroFactor,
  resolveIngredientDisplayUnit,
} from "@/lib/recipes/ingredientUnits";
import { useToast } from "@/contexts/ToastContext";
import type {
  Meal,
  MealRecipeSnapshot,
  TplSlotRecipe,
  TplSlots,
  WeekTemplate,
} from "@/types/mealPlan";
import type { MacroGoals } from "@/types/member";
import type { Recipe, RecipeIngredient, RecipeSummary } from "@/types/recipe";

const COLORS = ["#4a6fa5", "#93c5fd", "#fcd34d", "#c2410c", "#6366f1"];
const getColor = (pos: number) => COLORS[(pos - 1) % 5]!;

const CARD_W = 138;
const PAGE = 20;

type TFn = (key: TranslationKey) => unknown;

function tArray(t: TFn, key: TranslationKey): string[] {
  const v = t(key);
  return Array.isArray(v) ? v.map(String) : [];
}

type DragData =
  | { type: "recipe"; recipe: RecipeSummary }
  | { type: "meal"; meal: Meal }
  | { type: "day"; dateStr: string; meals: Meal[] }
  | { type: "tpl-day"; dayIndex: number; slots: TplSlots };

function resolveMealSlot(drop: Record<string, unknown> | undefined) {
  if (!drop) return null;
  if (drop.type === "meal" && drop.meal && typeof drop.meal === "object") {
    const meal = drop.meal as Meal;
    return { targetDate: meal.date, targetPos: meal.position };
  }
  if (typeof drop.date === "string" && typeof drop.position === "number") {
    return { targetDate: drop.date, targetPos: drop.position };
  }
  return null;
}

const snapCenterToCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (!activatorEvent || !draggingNodeRect || !("clientX" in activatorEvent)) {
    return transform;
  }
  const ev = activatorEvent as PointerEvent;
  return {
    ...transform,
    x: transform.x + ev.clientX - (draggingNodeRect.left + draggingNodeRect.width / 2),
    y: transform.y + ev.clientY - (draggingNodeRect.top + draggingNodeRect.height / 2),
  };
};

function macroColor(actual: number, goal: number | undefined) {
  if (!goal || goal <= 0) return null;
  const pct = Math.abs((actual - goal) / goal * 100);
  return pct <= 10 ? "#22c55e" : pct <= 25 ? "#eab308" : "#ef4444";
}

function sumDayMacros(items: MealRecipeSnapshot[]) {
  return items.reduce(
    (s, r) => ({
      kcal: s.kcal + (r.total_kcal || 0),
      protein: s.protein + (r.total_protein || 0),
      fat: s.fat + (r.total_fat || 0),
      carbs: s.carbs + (r.total_carbs || 0),
      cost: s.cost + (r.total_cost || 0),
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0, cost: 0 },
  );
}

function resolveTplRecipe(
  slot: TplSlotRecipe | undefined,
  recipes: RecipeSummary[],
): TplSlotRecipe | null {
  if (!slot) return null;
  if (slot.total_kcal || slot.total_protein || slot.total_fat || slot.total_carbs) {
    return slot;
  }
  const full = recipes.find((r) => r.id === slot.id);
  return full ? { ...slot, ...pickRecipeMacros(full) } : slot;
}

function RecipePreviewModal({
  recipe,
  onClose,
  t,
}: {
  recipe: RecipeSummary | null;
  onClose: () => void;
  t: TFn;
}) {
  const { showError } = useToast();
  const [fullRecipe, setFullRecipe] = useState<Recipe | null>(null);
  const [localIngredients, setLocalIngredients] = useState<RecipeIngredient[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editVals, setEditVals] = useState({
    kcal: "",
    protein: "",
    fat: "",
    carbs: "",
  });

  useEffect(() => {
    if (!recipe) {
      setFullRecipe(null);
      setLocalIngredients([]);
      return;
    }
    setFullRecipe(null);
    getRecipe(recipe.id)
      .then((res) => {
        setFullRecipe(res);
        setLocalIngredients(res.ingredients ?? []);
      })
      .catch(() => setLocalIngredients([]));
  }, [recipe?.id, recipe]);

  const startEdit = (i: number, ing: RecipeIngredient) => {
    setEditingIdx(i);
    setEditVals({
      kcal: ing.kcal != null ? String(ing.kcal) : "",
      protein: ing.protein != null ? String(ing.protein) : "",
      fat: ing.fat != null ? String(ing.fat) : "",
      carbs: ing.carbs != null ? String(ing.carbs) : "",
    });
  };

  const saveEdit = async (ing: RecipeIngredient) => {
    const toNum = (v: string) => (v === "" ? null : parseFloat(v) || 0);
    const payload = {
      kcal: toNum(editVals.kcal),
      protein: toNum(editVals.protein),
      fat: toNum(editVals.fat),
      carbs: toNum(editVals.carbs),
    };
    try {
      await updateProduct(ing.product_id, payload);
      setLocalIngredients((prev) =>
        prev.map((x, j) => (j === editingIdx ? { ...x, ...payload } : x)),
      );
    } catch {
      showError(tString(t, "err_save_notes"));
    }
    setEditingIdx(null);
  };

  if (!recipe) return null;

  const r = fullRecipe ?? recipe;
  const kcal = r.total_kcal > 0 ? r.total_kcal : r.kcal_100g;
  const per100 = r.total_kcal === 0 && r.kcal_100g != null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
        }}
      >
        <div
          style={{
            position: "relative",
            minHeight: 180,
            background: recipe.image_url
              ? `url(${recipe.image_url}) center/cover`
              : "linear-gradient(135deg,#0d9488,#0f766e)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: "16px 20px",
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
          <button
            type="button"
            onClick={onClose}
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              background: "rgba(0,0,0,0.5)",
              border: "none",
              borderRadius: "50%",
              width: 32,
              height: 32,
              cursor: "pointer",
              fontSize: 18,
              color: "#fff",
              zIndex: 1,
            }}
          >
            ×
          </button>
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 10 }}>
              {recipe.name}
            </div>
            {kcal != null && kcal > 0 && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ background: "rgba(0,0,0,0.55)", borderRadius: 8, padding: "4px 12px" }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>
                    {Math.round(kcal)}
                  </span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", marginLeft: 3 }}>
                    kcal{per100 ? "/100g" : ""}
                  </span>
                </div>
                {[
                  [tString(t, "macro_protein"), per100 ? r.protein_100g : r.total_protein],
                  [tString(t, "macro_fat"), per100 ? r.fat_100g : r.total_fat],
                  [tString(t, "macro_carbs"), per100 ? r.carbs_100g : r.total_carbs],
                ].map(([lbl, val]) =>
                  val != null ? (
                    <div key={lbl} style={{ background: "rgba(0,0,0,0.55)", borderRadius: 8, padding: "4px 10px", textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", marginBottom: 1 }}>{lbl}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{Math.round(Number(val))}g</div>
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </div>
        </div>
        <div className="dark-scroll" style={{ background: "#1c2433", overflowY: "auto", padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#0d9488", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {tString(t, "show_ingredients")}
            </div>
            <div style={{ fontSize: 10, color: "#9ca3af", textAlign: "right" }}>
              {tString(t, "edit_notes")}
            </div>
          </div>
          {!fullRecipe && (
            <div style={{ textAlign: "center", color: "#6b7280", fontSize: 12, padding: "12px 0" }}>
              {tString(t, "loading")}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {localIngredients.map((ing, i) => {
              const factor = ingredientMacroFactor(ing);
              const displayUnit = resolveIngredientDisplayUnit(ing);
              const ikcal = ing.kcal != null ? Math.round(ing.kcal * factor) : null;
              const iprotein = ing.protein != null ? Math.round(ing.protein * factor * 10) / 10 : null;
              const ifat = ing.fat != null ? Math.round(ing.fat * factor * 10) / 10 : null;
              const icarbs = ing.carbs != null ? Math.round(ing.carbs * factor * 10) / 10 : null;
              const isEditing = editingIdx === i;
              const inpStyle: CSSProperties = {
                width: 36,
                padding: "1px 3px",
                fontSize: 11,
                background: "#1f2937",
                border: "1px solid #0d9488",
                borderRadius: 4,
                color: "#e2e8f0",
                textAlign: "center",
              };
              return (
                <div
                  key={ing.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 10px",
                    background: "#111827",
                    borderRadius: 7,
                  }}
                >
                  <span style={{ fontSize: 12, color: "#9ca3af", minWidth: 50, textAlign: "right" }}>
                    {ing.weight}{" "}
                    {displayUnit === "szt" ? tString(t, "unit_pcs") : displayUnit}
                  </span>
                  <span style={{ fontSize: 13, color: "#e2e8f0", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ing.product_name}
                  </span>
                  {isEditing ? (
                    <div style={{ display: "flex", gap: 2, alignItems: "center", flexShrink: 0 }}
                      onKeyDown={(e) => { if (e.key === "Enter") void saveEdit(ing); if (e.key === "Escape") setEditingIdx(null); }}>
                      <span style={{ fontSize: 10, color: "#6b7280" }}>kcal</span>
                      <input autoFocus style={inpStyle} value={editVals.kcal} onChange={(e) => setEditVals((v) => ({ ...v, kcal: e.target.value }))} placeholder="—" />
                      <span style={{ fontSize: 10, color: "#6b7280" }}>{tString(t, "macro_p")}</span>
                      <input style={inpStyle} value={editVals.protein} onChange={(e) => setEditVals((v) => ({ ...v, protein: e.target.value }))} placeholder="—" />
                      <span style={{ fontSize: 10, color: "#6b7280" }}>{tString(t, "macro_f")}</span>
                      <input style={inpStyle} value={editVals.fat} onChange={(e) => setEditVals((v) => ({ ...v, fat: e.target.value }))} placeholder="—" />
                      <span style={{ fontSize: 10, color: "#6b7280" }}>{tString(t, "macro_c")}</span>
                      <input style={inpStyle} value={editVals.carbs} onChange={(e) => setEditVals((v) => ({ ...v, carbs: e.target.value }))} placeholder="—" />
                      <button type="button" onClick={() => void saveEdit(ing)} style={{ padding: "2px 5px", fontSize: 11, background: "#0d9488", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>✓</button>
                      <button type="button" onClick={() => setEditingIdx(null)} style={{ padding: "2px 5px", fontSize: 11, background: "#374151", color: "#9ca3af", border: "none", borderRadius: 4, cursor: "pointer" }}>✕</button>
                    </div>
                  ) : (
                    <span
                      onClick={() => startEdit(i, ing)}
                      title={tString(t, "click_edit_macro")}
                      style={{ fontSize: 11, color: ikcal != null ? "#6b7280" : "#9ca3af", flexShrink: 0, textAlign: "right", whiteSpace: "nowrap", cursor: "pointer", borderRadius: 4, padding: "1px 4px" }}
                    >
                      {ikcal != null
                        ? `${ikcal} kcal · ${tString(t, "macro_p")}${iprotein} ${tString(t, "macro_f")}${ifat} ${tString(t, "macro_c")}${icarbs}`
                        : tString(t, "plus_macro")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
            {tString(t, "recipe_cost_lbl")}:{" "}
            <span style={{ color: "#0d9488", fontWeight: 700 }}>
              {recipe.total_cost?.toFixed(2)} {tString(t, "currency")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const DraggableRecipe = memo(function DraggableRecipe({
  recipe,
  onToggleFavorite,
  onPreview,
  t,
}: {
  recipe: RecipeSummary;
  onToggleFavorite: (id: number) => void;
  onPreview: (recipe: RecipeSummary) => void;
  t: TFn;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `recipe-${recipe.id}`,
    data: { type: "recipe", recipe } satisfies DragData,
  });
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const displayKcal = recipe.total_kcal > 0 ? recipe.total_kcal : recipe.kcal_100g;
  const displayProtein = recipe.total_kcal > 0 ? recipe.total_protein : recipe.protein_100g;
  const displayFat = recipe.total_kcal > 0 ? recipe.total_fat : recipe.fat_100g;
  const displayCarbs = recipe.total_kcal > 0 ? recipe.total_carbs : recipe.carbs_100g;
  const isPer100g = recipe.total_kcal === 0 && recipe.kcal_100g != null;
  const hasKcal = displayKcal != null;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onPointerDown={(e) => {
        pointerStart.current = { x: e.clientX, y: e.clientY };
        listeners?.onPointerDown?.(e);
      }}
      onClick={(e) => {
        if (!pointerStart.current) return;
        const dx = e.clientX - pointerStart.current.x;
        const dy = e.clientY - pointerStart.current.y;
        if (Math.sqrt(dx * dx + dy * dy) < 8) onPreview(recipe);
      }}
      style={{
        flexShrink: 0,
        width: 128,
        height: 148,
        background: "linear-gradient(135deg, #0d9488, #0f766e)",
        borderRadius: 12,
        cursor: "grab",
        opacity: isDragging ? 0.3 : 1,
        userSelect: "none",
        touchAction: "none",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {recipe.image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- external recipe URLs
        <img
          src={recipe.image_url}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: 12,
            pointerEvents: "none",
          }}
        />
      )}
      {recipe.image_url && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", borderRadius: 12 }} />
      )}
      <div style={{ flex: 1, padding: "8px 11px 6px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 11.5, color: "#fff", flex: 1, overflow: "hidden" }}>
            {recipe.name}
          </div>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(recipe.id);
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: recipe.is_favorite ? "#facc15" : "transparent",
              WebkitTextStroke: recipe.is_favorite ? "0" : "1.2px rgba(255,255,255,0.5)",
            }}
          >
            ★
          </button>
        </div>
      </div>
      <div style={{ padding: "0 8px 7px", position: "relative", zIndex: 1 }}>
        {hasKcal ? (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>
              {Math.round(displayKcal!)}
              <span style={{ fontSize: 9 }}> kcal{isPer100g ? "/100g" : ""}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3 }}>
              {(recipe.lang === "en"
                ? [["P", displayProtein], ["F", displayFat], ["C", displayCarbs]]
                : [["B", displayProtein], ["T", displayFat], ["W", displayCarbs]]
              ).map(([lbl, val]) => (
                <div key={lbl} style={{ background: "rgba(0,0,0,0.45)", borderRadius: 5, padding: "3px 0", textAlign: "center" }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{lbl}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{Math.round(Number(val ?? 0))}g</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ height: 52 }} />
        )}
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.35)", padding: "4px 8px", position: "relative", zIndex: 1 }}>
        <span style={{ fontSize: 8.5, color: "rgba(255,255,255,0.5)" }}>{tString(t, "est_cost")}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.9)", float: "right" }}>
          {tString(t, "currency")}{recipe.total_cost.toFixed(2)}
        </span>
      </div>
    </div>
  );
});

function DraggableMeal({ meal, onDelete }: { meal: Meal; onDelete: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `meal-${meal.id}`,
    data: { type: "meal", meal } satisfies DragData,
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{
      background: getColor(meal.position), color: "#1f2937", borderRadius: 4,
      padding: "2px 5px", fontSize: 12, cursor: "grab", opacity: isDragging ? 0.35 : 1,
      display: "flex", alignItems: "center", gap: 3, width: "100%", minWidth: 0,
    }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{meal.recipe.name}</span>
      <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete(meal.id); }}
        style={{ background: "rgba(0,0,0,0.25)", border: "none", borderRadius: 2, cursor: "pointer", fontSize: 10 }}>✕</button>
    </div>
  );
}

function MealSlot({
  date,
  position,
  meal,
  onDelete,
  showLabel,
  slotLabels,
}: {
  date: string;
  position: number;
  meal?: Meal;
  onDelete: (id: number) => void;
  showLabel: boolean;
  slotLabels: string[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${date}-${position}`,
    data: { date, position },
  });
  return (
    <div ref={setNodeRef} style={{
      height: 40,
      borderBottom: position < 5 ? "1px solid #2d3748" : "none",
      background: isOver && !meal ? "rgba(45,212,191,0.1)" : "transparent",
      display: "flex",
      alignItems: "center",
      padding: "2px 4px",
    }}>
      {meal ? (
        <DraggableMeal meal={meal} onDelete={onDelete} />
      ) : showLabel ? (
        <span style={{ fontSize: 10, color: "#6b7280", width: "100%", textAlign: "center" }}>
          {slotLabels[position - 1]}
        </span>
      ) : null}
    </div>
  );
}

function DayMacroFooter({
  totals,
  hasMeals,
  macroGoals,
  emptyLabel,
  background = "transparent",
  t,
}: {
  totals: ReturnType<typeof sumDayMacros>;
  hasMeals: boolean;
  macroGoals: MacroGoals | null;
  emptyLabel?: string | null;
  background?: string;
  t: TFn;
}) {
  const hasAnyMacro =
    totals.kcal > 0 || totals.protein > 0 || totals.fat > 0 || totals.carbs > 0;
  return (
    <div style={{ borderTop: "1px solid #374151", background, padding: "3px 5px", height: 40, overflow: "hidden" }}>
      {emptyLabel && !hasMeals && (
        <span style={{ fontSize: 10, color: "#4b5563", display: "block", textAlign: "center", lineHeight: "34px" }}>
          {emptyLabel}
        </span>
      )}
      {hasMeals && hasAnyMacro && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, overflow: "hidden" }}>
            <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
              <span style={{ color: macroGoals ? macroColor(totals.kcal, macroGoals.kcal) ?? "#2dd4bf" : "#2dd4bf" }}>
                {totals.kcal}
              </span>
              {macroGoals && <span style={{ color: "#6b7280", fontWeight: 400 }}>/{macroGoals.kcal}</span>}
              <span style={{ color: "#6b7280", fontWeight: 400 }}> kcal</span>
            </div>
            {totals.cost > 0 && (
              <div style={{ flexShrink: 0, textAlign: "right" }}>
                <div style={{ color: "#6b7280", fontSize: 8, fontWeight: 500, lineHeight: 1 }}>{tString(t, "est_cost")}</div>
                <div style={{ color: "#0d9488", fontWeight: 700, fontSize: 11, lineHeight: 1.2 }}>{totals.cost.toFixed(2)} {tString(t, "currency")}</div>
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {[
              [tString(t, "macro_p"), Math.round(totals.protein), macroGoals?.protein],
              [tString(t, "macro_f"), Math.round(totals.fat), macroGoals?.fat],
              [tString(t, "macro_c"), Math.round(totals.carbs), macroGoals?.carbs],
            ].map(([lbl, val, tgt], i) => {
              const numVal = Number(val);
              return (
              <span key={lbl} style={{ marginLeft: i > 0 ? 4 : 0 }}>
                <span style={{ color: "#6b7280" }}>{lbl}:</span>
                <span style={{ color: typeof tgt === "number" ? macroColor(numVal, tgt) ?? "#9ca3af" : "#9ca3af" }}>{numVal}</span>
                {tgt != null && <span style={{ color: "#6b7280" }}>/{tgt}</span>}
                <span style={{ color: "#6b7280" }}>g</span>
              </span>
            );})}
          </div>
        </>
      )}
    </div>
  );
}

function DraggableDayHandle({ dateStr, meals, t }: { dateStr: string; meals: Meal[]; t: TFn }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `day-${dateStr}`,
    data: { type: "day", dateStr, meals } satisfies DragData,
  });
  return (
    <span ref={setNodeRef} {...listeners} {...attributes} title={tString(t, "drag_day_title")}
      style={{ cursor: "grab", opacity: isDragging ? 0.4 : 1, background: "#374151", borderRadius: 4, padding: "3px 8px", fontSize: 10, fontWeight: 700, color: "#9ca3af" }}>
      {tString(t, "btn_grab")}
    </span>
  );
}

function DroppableDayHeader({ dateStr, children }: { dateStr: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-header-${dateStr}`,
    data: { type: "day-target", dateStr },
  });
  return (
    <div ref={setNodeRef} style={{ background: isOver ? "rgba(13,148,136,0.18)" : "transparent" }}>
      {children}
    </div>
  );
}

function DayCell({
  date,
  dateStr,
  meals,
  isToday,
  isPast,
  isCurrentMonth,
  onDelete,
  onDeleteAll,
  onCopy,
  onPaste,
  copiedDay,
  macroGoals,
  t,
  slotLabels,
  dayShort,
}: {
  date: Date;
  dateStr: string;
  meals: Meal[];
  isToday: boolean;
  isPast: boolean;
  isCurrentMonth: boolean;
  onDelete: (id: number) => void;
  onDeleteAll: (ds: string) => void;
  onCopy: (ds: string) => void;
  onPaste: (ds: string) => void;
  copiedDay: string | null;
  macroGoals: MacroGoals | null;
  t: TFn;
  slotLabels: string[];
  dayShort: string[];
}) {
  const dayAbbr = dayShort[(date.getDay() + 6) % 7] ?? "";
  const mealsByPos: Record<number, Meal> = {};
  meals.forEach((m) => { mealsByPos[m.position] = m; });
  const hasMeals = meals.length > 0;
  const canPaste = copiedDay && copiedDay !== dateStr;
  const dayMacros = sumDayMacros(meals.map((m) => m.recipe));

  return (
    <div id={isToday ? "calendar-today" : undefined} style={{
      border: `1px solid ${isToday ? "#2dd4bf" : "#374151"}`,
      borderRadius: 4,
      overflow: "hidden",
      background: isPast ? "#161d2d" : isToday ? "#162626" : "#1f2937",
      opacity: !isCurrentMonth ? 0.45 : 1,
      scrollMarginTop: isToday ? 220 : undefined,
    }}>
      <DroppableDayHeader dateStr={dateStr}>
        <div style={{ padding: "7px", borderBottom: "1px solid #374151", display: "flex", justifyContent: "space-between", alignItems: "center", background: isToday ? "rgba(45,212,191,0.08)" : "transparent" }}>
          <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: isToday ? "#2dd4bf" : "#94a3b8" }}>
            {date.getDate()} <span style={{ color: "#4b5563" }}>{dayAbbr}</span>
          </span>
          <span style={{ display: "flex", gap: 3 }}>
            {hasMeals && <DraggableDayHandle dateStr={dateStr} meals={meals} t={t} />}
            {hasMeals && (
              <button type="button" onClick={() => onCopy(dateStr)} style={{
                background: copiedDay === dateStr ? "#0d9488" : "#1e3a3a",
                color: copiedDay === dateStr ? "white" : "#2dd4bf",
                border: "none", borderRadius: 4, fontSize: 10, fontWeight: 700, padding: "3px 7px", cursor: "pointer",
              }}>
                {copiedDay === dateStr ? tString(t, "btn_copied") : tString(t, "btn_copy")}
              </button>
            )}
            {canPaste && (
              <button type="button" onClick={() => onPaste(dateStr)} style={{
                background: "#0d9488", color: "#1f2937", border: "none", borderRadius: 4, fontSize: 10, fontWeight: 700, padding: "3px 7px", cursor: "pointer",
              }}>
                {tString(t, "btn_paste")}
              </button>
            )}
            {hasMeals && (
              <button type="button" onClick={() => onDeleteAll(dateStr)} style={{
                background: "#2d1515", color: "#f87171", border: "none", borderRadius: 4, fontSize: 10, fontWeight: 700, padding: "3px 7px", cursor: "pointer",
              }}>
                {tString(t, "btn_delete")}
              </button>
            )}
          </span>
        </div>
      </DroppableDayHeader>
      <div>
        {[1, 2, 3, 4, 5].map((pos) => (
          <MealSlot key={pos} date={dateStr} position={pos} meal={mealsByPos[pos]} onDelete={onDelete}
            showLabel={isToday} slotLabels={slotLabels} />
        ))}
      </div>
      <DayMacroFooter totals={dayMacros} hasMeals={hasMeals} macroGoals={macroGoals}
        emptyLabel={isToday ? tString(t, "macro_day_label") : null}
        background={isPast ? "#161d2d" : isToday ? "#162626" : "transparent"} t={t} />
    </div>
  );
}

function CarouselList({
  recipes,
  search,
  categoryFilter,
  visible,
  setVisible,
  scrollRef,
  onPreview,
  onToggleFavorite,
  t,
}: {
  recipes: RecipeSummary[];
  search: string;
  categoryFilter: string | null;
  visible: number;
  setVisible: (fn: (v: number) => number) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onPreview: (r: RecipeSummary) => void;
  onToggleFavorite: (id: number) => void;
  t: TFn;
}) {
  const filtered = useMemo(() => {
    const q = search.trim();
    let list = recipes;
    if (categoryFilter) list = list.filter((r) => r.category === categoryFilter);
    const sorted = [...list].sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0));
    return q ? sorted.filter((r) => fuzzySearch(q, r.name)) : sorted;
  }, [recipes, search, categoryFilter]);

  const prevKey = useRef("");
  const filterKey = `${search}|${categoryFilter ?? ""}`;
  if (prevKey.current !== filterKey) {
    prevKey.current = filterKey;
    setVisible(() => 12);
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }

  const slice = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  if (filtered.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "#4b5563", margin: 0 }}>
        {search.trim()
          ? tFormat(t, "cal_no_recipes_match", search)
          : tString(t, "no_recipes_cal")}
      </p>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="recipe-carousel"
      style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 10 }}
      onScroll={(e) => {
        const el = e.currentTarget;
        if (hasMore && el.scrollLeft + el.clientWidth >= el.scrollWidth - CARD_W * 3) {
          setVisible((v) => Math.min(v + PAGE, filtered.length));
        }
      }}
    >
      {slice.map((r) => (
        <DraggableRecipe key={r.id} recipe={r} onToggleFavorite={onToggleFavorite} onPreview={onPreview} t={t} />
      ))}
      {hasMore && (
        <div style={{ flexShrink: 0, width: CARD_W - 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#4b5563", fontSize: 11 }}>
          +{filtered.length - visible}
        </div>
      )}
    </div>
  );
}

function OverlayContent({ dragData, t }: { dragData: DragData | null; t: TFn }) {
  if (!dragData) return null;
  const isDay = dragData.type === "day";
  const isTplDay = dragData.type === "tpl-day";
  const label = isDay
    ? `${dragData.dateStr} (${dragData.meals?.length ?? 0})`
    : isTplDay
      ? tString(t, "drag_day_title")
      : dragData.type === "recipe"
        ? dragData.recipe.name
        : dragData.meal.recipe.name;
  const bg = isDay || isTplDay || dragData.type === "recipe"
    ? "linear-gradient(135deg,#0d9488,#0f766e)"
    : getColor(dragData.meal.position);
  return (
    <div style={{ background: bg, color: "#1f2937", padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.25)", whiteSpace: "nowrap" }}>
      {label}
    </div>
  );
}

function TemplateSlot({
  dayIndex,
  position,
  recipe,
  onRemove,
  slotLabels,
}: {
  dayIndex: number;
  position: number;
  recipe: TplSlotRecipe | null;
  onRemove: (dayIndex: number, position: number) => void;
  slotLabels: string[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `tpl-${dayIndex}-${position}`,
    data: { type: "tpl-slot", dayIndex, position },
  });
  return (
    <div ref={setNodeRef} style={{
      height: 40,
      borderBottom: position < 5 ? "1px solid #2d3748" : "none",
      background: isOver && !recipe ? "rgba(45,212,191,0.1)" : "transparent",
      display: "flex",
      alignItems: "center",
      padding: "2px 4px",
    }}>
      {recipe ? (
        <div style={{ background: getColor(position), color: "#1f2937", borderRadius: 4, padding: "2px 5px", fontSize: 12, display: "flex", width: "100%", minWidth: 0, gap: 3 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{recipe.name}</span>
          <button type="button" onClick={() => onRemove(dayIndex, position)}
            style={{ background: "rgba(0,0,0,0.25)", border: "none", borderRadius: 2, cursor: "pointer", fontSize: 10 }}>✕</button>
        </div>
      ) : (
        <span style={{ fontSize: 10, color: "#6b7280", width: "100%", textAlign: "center" }}>{slotLabels[position - 1]}</span>
      )}
    </div>
  );
}

function DraggableTplDayHandle({
  dayIndex,
  slots,
  t,
}: {
  dayIndex: number;
  slots: TplSlots;
  t: TFn;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tpl-day-${dayIndex}`,
    data: { type: "tpl-day", dayIndex, slots } satisfies DragData,
  });
  return (
    <span ref={setNodeRef} {...listeners} {...attributes}
      style={{ cursor: "grab", opacity: isDragging ? 0.4 : 1, background: "#374151", borderRadius: 4, padding: "3px 7px", fontSize: 10, fontWeight: 700, color: "#9ca3af" }}>
      {tString(t, "btn_grab")}
    </span>
  );
}

function DroppableTplDayHeader({ dayIndex, children }: { dayIndex: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `tpl-day-header-${dayIndex}`,
    data: { type: "tpl-day-target", dayIndex },
  });
  return (
    <div ref={setNodeRef} style={{ background: isOver ? "rgba(45,212,191,0.12)" : "transparent" }}>
      {children}
    </div>
  );
}

function TemplateSection({
  templates,
  tplSlots,
  setTplSlots,
  onSave,
  onApply,
  onDelete,
  open,
  setOpen,
  macroGoals,
  recipes,
  t,
}: {
  templates: WeekTemplate[];
  tplSlots: TplSlots;
  setTplSlots: React.Dispatch<React.SetStateAction<TplSlots>>;
  onSave: (name: string, meals: WeekTemplate["meals"]) => void;
  onApply: (template: WeekTemplate, targetMon: string) => void;
  onDelete: (i: number) => void;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  macroGoals: MacroGoals | null;
  recipes: RecipeSummary[];
  t: TFn;
}) {
  const [editName, setEditName] = useState("");
  const [applyWeek, setApplyWeek] = useState<Record<number, string>>({});
  const [copiedTplDay, setCopiedTplDay] = useState<number | null>(null);
  const [expandedTpls, setExpandedTpls] = useState<Set<number>>(new Set());
  const mondays = getUpcomingMondays(16);
  const dayShort = tArray(t, "day_short");
  const dayFull = tArray(t, "day_full");
  const slotLabels = tArray(t, "slot_labels");

  const filledCount = Object.keys(tplSlots).length;

  const handleRemove = (dayIndex: number, position: number) => {
    const k = `${dayIndex}-${position}`;
    setTplSlots((prev) => {
      const n = { ...prev };
      delete n[k];
      return n;
    });
  };

  const handleClearDay = (di: number) => {
    setTplSlots((prev) => {
      const n = { ...prev };
      [1, 2, 3, 4, 5].forEach((pos) => delete n[`${di}-${pos}`]);
      return n;
    });
  };

  const handlePasteTplDay = (di: number) => {
    if (copiedTplDay === null) return;
    setTplSlots((prev) => {
      const n = { ...prev };
      [1, 2, 3, 4, 5].forEach((pos) => {
        const src = prev[`${copiedTplDay}-${pos}`];
        if (src) n[`${di}-${pos}`] = src;
        else delete n[`${di}-${pos}`];
      });
      return n;
    });
  };

  const toggleTpl = (ti: number) => {
    setExpandedTpls((prev) => {
      const next = new Set(prev);
      if (next.has(ti)) next.delete(ti);
      else next.add(ti);
      return next;
    });
  };

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{ width: "100%", padding: "12px 18px", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", color: "#0d9488", fontWeight: 600 }}>
        <span>{tString(t, "tpl_title")}</span>
        <Icon icon="heroicons:chevron-down" style={{ width: 20, height: 20, transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>
      {open && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid #374151" }}>
          <div id="tpl-editor" style={{ marginTop: 14, marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>{tString(t, "tpl_drag_hint")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 10 }}>
              {dayFull.map((name, di) => {
                const dayHasContent = [1, 2, 3, 4, 5].some((pos) => tplSlots[`${di}-${pos}`]);
                return (
                  <div key={name} style={{ border: "1px solid #374151", borderRadius: 6, overflow: "hidden" }}>
                    <DroppableTplDayHeader dayIndex={di}>
                      <div style={{ background: "#1c3534", padding: 7, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #374151" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#2dd4bf" }}>{dayShort[di]}</span>
                        <span style={{ display: "flex", gap: 3 }}>
                          {dayHasContent && <DraggableTplDayHandle dayIndex={di} slots={tplSlots} t={t} />}
                          {dayHasContent && (
                            <button type="button" onClick={() => setCopiedTplDay(di)} style={{
                              background: copiedTplDay === di ? "#0d9488" : "#1e3a3a",
                              color: copiedTplDay === di ? "white" : "#2dd4bf",
                              border: "none", borderRadius: 4, fontSize: 10, fontWeight: 700, padding: "3px 7px", cursor: "pointer",
                            }}>
                              {copiedTplDay === di ? tString(t, "btn_copied") : tString(t, "btn_copy")}
                            </button>
                          )}
                          {copiedTplDay !== null && copiedTplDay !== di && (
                            <button type="button" onClick={() => handlePasteTplDay(di)} style={{
                              background: "#0d9488", color: "#1f2937", border: "none", borderRadius: 4, fontSize: 10, fontWeight: 700, padding: "3px 7px", cursor: "pointer",
                            }}>
                              {tString(t, "btn_paste")}
                            </button>
                          )}
                          {dayHasContent && (
                            <button type="button" onClick={() => handleClearDay(di)} style={{
                              background: "#2d1515", color: "#f87171", border: "none", borderRadius: 4, fontSize: 10, fontWeight: 700, padding: "3px 7px", cursor: "pointer",
                            }}>
                              {tString(t, "btn_delete")}
                            </button>
                          )}
                        </span>
                      </div>
                    </DroppableTplDayHeader>
                    {[1, 2, 3, 4, 5].map((pos) => (
                      <TemplateSlot key={pos} dayIndex={di} position={pos}
                        recipe={tplSlots[`${di}-${pos}`] ?? null}
                        onRemove={handleRemove} slotLabels={slotLabels} />
                    ))}
                    <DayMacroFooter
                      totals={sumDayMacros(
                        [1, 2, 3, 4, 5]
                          .map((pos) => resolveTplRecipe(tplSlots[`${di}-${pos}`], recipes))
                          .filter((x): x is TplSlotRecipe => x != null),
                      )}
                      hasMeals={dayHasContent}
                      macroGoals={macroGoals}
                      t={t}
                    />
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <input value={editName} onChange={(e) => setEditName(e.target.value.slice(0, 50))} maxLength={50}
                  placeholder={tString(t, "tpl_name_ph")} style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", border: "1px solid #374151", borderRadius: 6, fontSize: 13, background: "#111827", color: "#f1f5f9" }} />
                <div style={{ fontSize: 10, color: editName.length > 45 ? "#f87171" : "#6b7280", textAlign: "right", marginTop: 2 }}>
                  {editName.length} / 50
                </div>
              </div>
              <button type="button" className="btn btn-primary" disabled={!editName.trim() || !filledCount}
                onClick={() => {
                  if (!editName.trim() || !filledCount) return;
                  const meals = Object.entries(tplSlots).map(([k, r]) => {
                    const [di, pos] = k.split("-").map(Number);
                    return { dayOffset: di!, position: pos!, recipe_id: r.id, recipe_name: r.name };
                  });
                  onSave(editName.trim(), meals);
                  setTplSlots({});
                  setEditName("");
                }}>
                {tString(t, "save_tpl")}
              </button>
              {filledCount > 0 && (
                <button type="button" className="btn" style={{ padding: "7px 12px", fontSize: 13, background: "#374151", color: "#9ca3af" }}
                  onClick={() => setTplSlots({})}>
                  {tString(t, "clear")}
                </button>
              )}
            </div>
          </div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#0d9488", marginBottom: 10, paddingTop: 12, borderTop: "1px solid #374151" }}>{tString(t, "your_tpls")}</div>
          {templates.length === 0 ? (
            <p style={{ color: "#4b5563", fontSize: 13, textAlign: "center", margin: 0 }}>{tString(t, "no_tpls")}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {templates.map((tpl, ti) => {
                const byDay: Record<number, Record<number, WeekTemplate["meals"][number]>> = {};
                tpl.meals.forEach((m) => {
                  if (!byDay[m.dayOffset]) byDay[m.dayOffset] = {};
                  byDay[m.dayOffset]![m.position] = m;
                });
                const isExpanded = expandedTpls.has(ti);
                return (
                  <div key={`${tpl.name}-${ti}`} style={{ border: "1px solid #374151", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ background: "#1c3534", padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: isExpanded ? "1px solid #374151" : "none" }}>
                      <button type="button" onClick={() => toggleTpl(ti)} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0, flex: 1 }}>
                        <Icon icon="heroicons:chevron-right" style={{ width: 16, height: 16, color: "#0d9488", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }} />
                        <strong style={{ fontSize: 13, color: "#e2e8f0" }}>{tpl.name}</strong>
                      </button>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 12, color: "#9ca3af" }}>{tString(t, "apply_from_mon")}</span>
                        <select value={applyWeek[ti] ?? mondays[0]} onChange={(e) => setApplyWeek({ ...applyWeek, [ti]: e.target.value })}
                          style={{ padding: "4px 8px", border: "1px solid #374151", borderRadius: 6, fontSize: 12, background: "#111827", color: "#f1f5f9" }}>
                          {mondays.map((m) => <option key={m} value={m}>{toEU(m)}</option>)}
                        </select>
                        <button type="button" className="btn btn-primary" style={{ padding: "5px 12px", fontSize: 12 }}
                          onClick={() => onApply(tpl, applyWeek[ti] ?? mondays[0]!)}>
                          {tString(t, "apply")}
                        </button>
                        <button type="button" className="btn btn-primary" style={{ padding: "5px 12px", fontSize: 12, background: "#1c3534", color: "#0d9488", border: "1px solid #374151" }}
                          onClick={() => {
                            const slots: TplSlots = {};
                            tpl.meals.forEach((m) => {
                              const full = recipes.find((r) => r.id === m.recipe_id);
                              slots[`${m.dayOffset}-${m.position}`] = full
                                ? toTplSlot(full)
                                : { id: m.recipe_id, name: m.recipe_name, ...pickRecipeMacros({}) };
                            });
                            setTplSlots(slots);
                            setEditName(tpl.name);
                            onDelete(ti);
                            document.getElementById("tpl-editor")?.scrollIntoView({ behavior: "smooth" });
                          }}>
                          {tString(t, "edit_btn")}
                        </button>
                        <button type="button" className="btn btn-danger" style={{ padding: "5px 12px", fontSize: 12 }}
                          onClick={() => onDelete(ti)}>{tString(t, "btn_delete")}</button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, padding: 8 }}>
                        {[0, 1, 2, 3, 4, 5, 6].map((di) => (
                          <div key={di} style={{ border: "1px solid #374151", borderRadius: 6, overflow: "hidden" }}>
                            <div style={{ background: "#1c3534", padding: 7, fontSize: 13, fontWeight: 600, color: "#2dd4bf", textAlign: "center", borderBottom: "1px solid #374151" }}>
                              {dayShort[di]}
                            </div>
                            {[1, 2, 3, 4, 5].map((pos) => {
                              const meal = byDay[di]?.[pos];
                              return (
                                <div key={pos} style={{ height: 40, borderBottom: pos < 5 ? "1px solid #2d3748" : "none", display: "flex", alignItems: "center", padding: "2px 4px" }}>
                                  {meal ? (
                                    <div style={{ background: getColor(pos), color: "#1f2937", borderRadius: 4, padding: "2px 5px", fontSize: 12, width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {meal.recipe_name}
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: 10, color: "#6b7280", width: "100%", textAlign: "center" }}>{slotLabels[pos - 1]}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CalendarScreen() {
  const page = useCalendarPage();
  const {
    t,
    year,
    month,
    todayStr,
    todayMidnight,
    recipes,
    mealsByDate,
    copiedDay,
    copiedWeek,
    inlineToast,
    calendarHelpOpen,
    setCalendarHelpOpen,
    carouselOpen,
    setCarouselOpen,
    recipeSearch,
    setRecipeSearch,
    carouselCatFilter,
    setCarouselCatFilter,
    carouselVisible,
    setCarouselVisible,
    tplSlots,
    setTplSlots,
    tplOpen,
    setTplOpen,
    previewRecipe,
    setPreviewRecipe,
    templates,
    macroGoals,
    containerRef,
    carouselScrollRef,
    prevMonth,
    nextMonth,
    handleToggleFavorite,
    handleDelete,
    handleDeleteAll,
    handleCopyDay,
    handlePasteDay,
    handleDeleteWeek,
    handleCopyWeek,
    handlePasteWeek,
    saveTemplate,
    deleteTemplate,
    applyTemplate,
    handleDragEndRecipeDrop,
    handleDragEndMealMove,
    handleDragEndDayCopy,
    goToRecipes,
    openTemplateSection,
    weeks,
  } = page;

  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const monthNames = tArray(t, "month_names");
  const dayShort = tArray(t, "day_short");
  const slotLabels = tArray(t, "slot_labels");

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDrag((event.active.data.current as DragData) ?? null);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDrag(null);
      const { active, over } = event;
      if (!over) return;
      const drag = active.data.current as DragData | undefined;
      const drop = over.data.current as Record<string, unknown> | undefined;
      if (!drag || !drop) return;

      if (drag.type === "tpl-day") {
        const srcDi = drag.dayIndex;
        const tgtDi =
          drop.type === "tpl-day-target"
            ? (drop.dayIndex as number)
            : drop.type === "tpl-slot"
              ? (drop.dayIndex as number)
              : null;
        if (tgtDi === null || tgtDi === srcDi) return;
        setTplSlots((prev) => {
          const n = { ...prev };
          [1, 2, 3, 4, 5].forEach((pos) => {
            const src = prev[`${srcDi}-${pos}`];
            if (src) n[`${tgtDi}-${pos}`] = src;
            else delete n[`${tgtDi}-${pos}`];
          });
          return n;
        });
        return;
      }

      if (drop.type === "tpl-slot") {
        if (drag.type !== "recipe") return;
        const k = `${drop.dayIndex}-${drop.position}`;
        setTplSlots((prev) => ({ ...prev, [k]: toTplSlot(drag.recipe) }));
        return;
      }

      if (drag.type === "day") {
        if (drop.type !== "day-target") return;
        await handleDragEndDayCopy(drag.dateStr, drop.dateStr as string);
        return;
      }

      if (drop.type === "day-target") return;

      const slot = resolveMealSlot(drop);
      if (!slot) return;
      const { targetDate, targetPos } = slot;

      if (drag.type === "recipe") {
        await handleDragEndRecipeDrop(drag.recipe, targetDate, targetPos);
      } else if (drag.type === "meal") {
        await handleDragEndMealMove(drag.meal, targetDate, targetPos);
      }
    },
    [
      handleDragEndDayCopy,
      handleDragEndMealMove,
      handleDragEndRecipeDrop,
      setTplSlots,
    ],
  );

  const wBtn: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    width: "100%",
    flex: 1,
    padding: 4,
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1.3,
    whiteSpace: "nowrap",
    border: "1px solid #374151",
  };

  return (
    <div ref={containerRef}>
      <DndContext
        sensors={sensors}
        modifiers={[snapCenterToCursor]}
        onDragStart={handleDragStart}
        onDragEnd={(e) => void handleDragEnd(e)}
        onDragCancel={() => setActiveDrag(null)}
      >
        {inlineToast && (
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            background: inlineToast.color, color: "#1f2937", padding: "16px 28px", borderRadius: 12,
            fontSize: 15, fontWeight: 600, zIndex: 9999, pointerEvents: "none", whiteSpace: "nowrap",
          }}>
            {inlineToast.msg}
            {copiedDay && <div style={{ fontSize: 12, fontWeight: 400, marginTop: 4 }}>{tString(t, "paste_day_hint")}</div>}
            {copiedWeek && !copiedDay && <div style={{ fontSize: 12, fontWeight: 400, marginTop: 4 }}>{tString(t, "paste_week_hint")}</div>}
          </div>
        )}

        <div className="carousel-sticky">
          <div id="recipe-carousel" className="card carousel-card">
            <div className="carousel-header">
              <button type="button" className="carousel-header-toggle" onClick={() => setCarouselOpen((o) => !o)}>
                <span className="card-section-title">{tString(t, "carousel_title")}</span>
                {!carouselOpen && (
                  <span className="carousel-header-count">{tFormatN(t, "recipes_count", recipes.length)}</span>
                )}
              </button>
              <button type="button" className="carousel-header-chevron" onClick={() => setCarouselOpen((o) => !o)}>
                <Icon icon="heroicons:chevron-down" style={{ width: 20, height: 20, transform: carouselOpen ? "rotate(180deg)" : "rotate(0deg)", color: "#0d9488" }} />
              </button>
            </div>
            {carouselOpen && (
              <div className="carousel-body">
                <div className="carousel-toolbar">
                  <input className="carousel-search" value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)}
                    placeholder={tString(t, "search_recipe_ph")} />
                  <div className="carousel-filters">
                    {[
                      { value: null, label: tString(t, "cat_all") },
                      { value: "breakfast", label: tString(t, "cat_breakfast") },
                      { value: "lunch", label: tString(t, "cat_lunch") },
                      { value: "dinner", label: tString(t, "cat_dinner") },
                      { value: "snack", label: tString(t, "cat_snack") },
                      { value: "dessert", label: tString(t, "cat_dessert") },
                    ].map((cat) => (
                      <button key={cat.value ?? "all"} type="button"
                        className={`carousel-filter-chip${carouselCatFilter === cat.value ? " carousel-filter-chip--active" : ""}`}
                        onClick={() => setCarouselCatFilter(cat.value)}>
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  <div className="carousel-toolbar-actions">
                    <button type="button" className="carousel-action-btn" onClick={goToRecipes}>
                      {tString(t, "btn_create_recipe")}
                    </button>
                    <button type="button" className="carousel-action-btn" onClick={openTemplateSection}>
                      {tString(t, "btn_create_template")}
                    </button>
                  </div>
                </div>
                <CarouselList
                  recipes={recipes}
                  search={recipeSearch}
                  categoryFilter={carouselCatFilter}
                  visible={carouselVisible}
                  setVisible={setCarouselVisible}
                  scrollRef={carouselScrollRef}
                  onPreview={setPreviewRecipe}
                  onToggleFavorite={(id) => void handleToggleFavorite(id)}
                  t={t}
                />
              </div>
            )}
          </div>
        </div>

        <RecipePreviewModal recipe={previewRecipe} onClose={() => setPreviewRecipe(null)} t={t} />

        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button type="button" className="btn btn-primary" onClick={prevMonth} style={{ padding: "5px 14px" }}>‹</button>
            <h2 style={{ margin: 0, fontSize: 17 }}>{monthNames[month]} {year}</h2>
            <button type="button" className="btn btn-primary" onClick={nextMonth} style={{ padding: "5px 14px" }}>›</button>
          </div>

          {weeks.map((weekDays, wi) => {
            const mondayStr = dateToStr(weekDays[0]!);
            const isCopied = copiedWeek === mondayStr;
            const weekHasMeals = weekDays.some((d) => (mealsByDate[dateToStr(d)] ?? []).length > 0);
            return (
              <div key={wi} style={{ display: "grid", gridTemplateColumns: "72px repeat(7,1fr)", gap: 3, marginBottom: 3 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, alignSelf: "stretch" }}>
                  {weekHasMeals && (
                    <button
                      type="button"
                      onClick={() => handleCopyWeek(mondayStr)}
                      title={tString(t, "copy_week_title")}
                      style={{
                        ...wBtn,
                        background: isCopied ? "#0d9488" : "#1e3a3a",
                        color: isCopied ? "white" : "#2dd4bf",
                      }}
                    >
                      {isCopied ? tString(t, "btn_copied") : tString(t, "btn_copy")}
                    </button>
                  )}
                  {copiedWeek && copiedWeek !== mondayStr && (
                    <button
                      type="button"
                      onClick={() => void handlePasteWeek(mondayStr)}
                      title={tString(t, "paste_week_title")}
                      style={{ ...wBtn, background: "#1e3358", color: "#93c5fd" }}
                    >
                      {tString(t, "btn_paste")}
                    </button>
                  )}
                  {weekHasMeals && (
                    <button
                      type="button"
                      onClick={() => handleDeleteWeek(mondayStr)}
                      title={tString(t, "del_week_title")}
                      style={{
                        ...wBtn,
                        background: "#2d1515",
                        color: "#f87171",
                        border: "1px solid #4b1515",
                      }}
                    >
                      {tString(t, "btn_delete")}
                    </button>
                  )}
                </div>
                {weekDays.map((date) => {
                  const ds = dateToStr(date);
                  return (
                    <DayCell
                      key={ds}
                      date={date}
                      dateStr={ds}
                      meals={mealsByDate[ds] ?? []}
                      isToday={ds === todayStr}
                      isPast={date < todayMidnight}
                      isCurrentMonth={date.getMonth() === month}
                      onDelete={(id) => void handleDelete(id)}
                      onDeleteAll={handleDeleteAll}
                      onCopy={handleCopyDay}
                      onPaste={(d) => void handlePasteDay(d)}
                      copiedDay={copiedDay}
                      macroGoals={macroGoals}
                      t={t}
                      slotLabels={slotLabels}
                      dayShort={dayShort}
                    />
                  );
                })}
              </div>
            );
          })}

          <div className="calendar-help-footer">
            <button
              type="button"
              className="pill-help-btn"
              onClick={() => setCalendarHelpOpen(true)}
              aria-label={tString(t, "how_to_title")}
              title={tString(t, "how_to_title")}
            >
              <Icon icon="heroicons:light-bulb" width={15} />
              <span>{tString(t, "import_help_btn")}</span>
            </button>
          </div>
        </div>

        <CalendarHelpModal open={calendarHelpOpen} onClose={() => setCalendarHelpOpen(false)} t={t} />

        <div id="template-section" />
        <TemplateSection
          templates={templates}
          tplSlots={tplSlots}
          setTplSlots={setTplSlots}
          onSave={saveTemplate}
          onApply={(tpl, mon) => void applyTemplate(tpl, mon)}
          onDelete={deleteTemplate}
          open={tplOpen}
          setOpen={setTplOpen}
          macroGoals={macroGoals}
          recipes={recipes}
          t={t}
        />

        <DragOverlay dropAnimation={null}>
          {activeDrag && <OverlayContent dragData={activeDrag} t={t} />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
