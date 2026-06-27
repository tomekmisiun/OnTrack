"use client";

import { Fragment, type CSSProperties } from "react";
import { Icon } from "@iconify/react";
import { RecipeHelpModal } from "@/components/recipes/RecipeHelpModal";
import { useRecipesPage } from "@/hooks/useRecipesPage";
import { canonicalDiffersFromRaw } from "@/lib/recipes/ingredientCanonical";
import {
  ingredientMacroFactor,
  resolveIngredientDisplayUnit,
} from "@/lib/recipes/ingredientUnits";
import { tFormat, tFormat2, tFormatN, tString } from "@/lib/i18n/translate";
import type { RecipeIngredient, RecipeSummary } from "@/types/recipe";
import "./recipes.css";

const ingStyle: CSSProperties = {
  background: "#0d94880d",
  borderLeft: "1px solid #0d948860",
  borderRight: "1px solid #0d948860",
};
const blStyle: CSSProperties = { borderLeft: "3px solid #0d9488" };
const inpS: CSSProperties = {
  width: 38,
  padding: "1px 3px",
  fontSize: 11,
  background: "#1f2937",
  border: "1px solid #0d9488",
  borderRadius: 4,
  color: "#e2e8f0",
  textAlign: "center",
  minWidth: 0,
};

const expandedCellStyle: CSSProperties = {
  background: "#0d948818",
  borderTop: "1px solid #0d948860",
  borderBottom: "1px solid #0d948860",
};

function IngredientMacros({
  ing,
  t,
}: {
  ing: RecipeIngredient;
  t: ReturnType<typeof useRecipesPage>["t"];
}) {
  const factor = ingredientMacroFactor(ing);
  const kcal =
    ing.kcal != null ? Math.round(ing.kcal * factor) : null;
  const protein =
    ing.protein != null
      ? Math.round(ing.protein * factor * 10) / 10
      : null;
  const fat =
    ing.fat != null ? Math.round(ing.fat * factor * 10) / 10 : null;
  const carbs =
    ing.carbs != null ? Math.round(ing.carbs * factor * 10) / 10 : null;

  if (kcal == null) {
    return (
      <span style={{ fontSize: 11, color: "#9ca3af" }}>
        + {tString(t, "col_macro").toLowerCase()}
      </span>
    );
  }

  return (
    <span style={{ fontSize: 11, color: "#9ca3af" }}>
      {kcal} kcal · {tString(t, "macro_p")}
      {protein} {tString(t, "macro_f")}
      {fat} {tString(t, "macro_c")}
      {carbs}
    </span>
  );
}

function ExpandedRecipeDetail({
  recipe,
  page,
}: {
  recipe: RecipeSummary;
  page: ReturnType<typeof useRecipesPage>;
}) {
  const {
    t,
    expandedDetail,
    editingIngCell,
    setEditingIngCell,
    addingIng,
    setAddingIng,
    productList,
    displayUnit,
    saveIngMacro,
    saveIngWeight,
    saveIngName,
    deleteIng,
    initAdding,
    confirmAddIng,
    showConfirm,
  } = page;

  const ings =
    expandedDetail?.id === recipe.id ? expandedDetail.ingredients : null;
  const isAdding = addingIng?.recipeId === recipe.id;
  const dropResults =
    isAdding && addingIng.search.length >= 2
      ? productList
          .filter((p) =>
            p.name.toLowerCase().includes(addingIng.search.toLowerCase()),
          )
          .slice(0, 8)
      : [];
  const exactMatch =
    isAdding &&
    productList.find(
      (p) => p.name.toLowerCase() === addingIng.search.toLowerCase(),
    );
  const addUnit = addingIng?.product?.unit || addingIng?.unit || "g";

  if (ings === null) {
    return (
      <tr style={ingStyle}>
        <td
          colSpan={6}
          style={{ textAlign: "center", padding: 12, color: "#6b7280", fontSize: 13 }}
        >
          {tString(t, "loading_ing")}
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr style={ingStyle}>
        <th
          style={{
            ...blStyle,
            fontSize: 11,
            color: "#6b7280",
            fontWeight: 700,
            letterSpacing: "0.5px",
            padding: "6px 8px",
          }}
        >
          {tString(t, "col_product")}
        </th>
        <th
          style={{
            textAlign: "left",
            fontSize: 11,
            color: "#6b7280",
            fontWeight: 700,
            letterSpacing: "0.5px",
            width: 100,
          }}
        >
          {tString(t, "col_weight")}
        </th>
        <th
          colSpan={2}
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "#6b7280",
            fontWeight: 700,
            letterSpacing: "0.5px",
          }}
        >
          {tString(t, "col_macro")}
        </th>
        <th
          style={{
            textAlign: "right",
            fontSize: 11,
            color: "#6b7280",
            fontWeight: 700,
            letterSpacing: "0.5px",
            whiteSpace: "nowrap",
          }}
        >
          {tString(t, "col_cost")}
        </th>
        <th
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "#6b7280",
            fontWeight: 700,
            letterSpacing: "0.5px",
            width: 60,
          }}
        >
          {tString(t, "delete")}
        </th>
      </tr>

      {ings.map((ing) => {
        const cellKey = `${recipe.id}-${ing.id}`;
        const isEditN =
          editingIngCell?.key === cellKey && editingIngCell.field === "name";
        const isEditW =
          editingIngCell?.key === cellKey && editingIngCell.field === "weight";
        const isEditM =
          editingIngCell?.key === cellKey && editingIngCell.field === "macro";
        const noEdit = !isEditN && !isEditW && !isEditM;

        return (
          <tr key={ing.id} style={ingStyle}>
            <td
              style={{ ...blStyle, cursor: "pointer" }}
              onClick={() =>
                noEdit &&
                setEditingIngCell({
                  key: cellKey,
                  field: "name",
                  val: ing.product_name,
                })
              }
            >
              {isEditN && editingIngCell.val != null ? (
                <div
                  style={{ display: "flex", gap: 4, alignItems: "center" }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      void saveIngName(recipe.id, ing, editingIngCell.val ?? "");
                    if (e.key === "Escape") setEditingIngCell(null);
                  }}
                >
                  <input
                    autoFocus
                    value={editingIngCell.val}
                    onChange={(e) =>
                      setEditingIngCell((c) =>
                        c ? { ...c, val: e.target.value } : c,
                      )
                    }
                    style={{
                      flex: 1,
                      padding: "2px 6px",
                      fontSize: 13,
                      background: "#1f2937",
                      border: "1px solid #0d9488",
                      borderRadius: 4,
                      color: "#e2e8f0",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void saveIngName(recipe.id, ing, editingIngCell.val ?? "")
                    }
                    style={{
                      padding: "1px 5px",
                      fontSize: 11,
                      background: "#0d9488",
                      color: "#fff",
                      border: "none",
                      borderRadius: 3,
                      cursor: "pointer",
                    }}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingIngCell(null)}
                    style={{
                      padding: "1px 5px",
                      fontSize: 11,
                      background: "#374151",
                      color: "#9ca3af",
                      border: "none",
                      borderRadius: 3,
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                ing.product_name
              )}
            </td>
            <td
              style={{ textAlign: "left", cursor: "pointer", width: 100 }}
              onClick={() =>
                noEdit &&
                setEditingIngCell({
                  key: cellKey,
                  field: "weight",
                  val: String(ing.weight),
                })
              }
            >
              {isEditW && editingIngCell.val != null ? (
                <div
                  style={{ display: "inline-flex", alignItems: "center", gap: 3 }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      void saveIngWeight(
                        recipe.id,
                        ings,
                        ing,
                        editingIngCell.val ?? "",
                      );
                    if (e.key === "Escape") setEditingIngCell(null);
                  }}
                >
                  <input
                    autoFocus
                    style={{ ...inpS, width: 55 }}
                    value={editingIngCell.val}
                    onChange={(e) =>
                      setEditingIngCell((c) =>
                        c ? { ...c, val: e.target.value } : c,
                      )
                    }
                  />
                  <span style={{ fontSize: 11, color: "#6b7280" }}>
                    {displayUnit(resolveIngredientDisplayUnit(ing))}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void saveIngWeight(
                        recipe.id,
                        ings,
                        ing,
                        editingIngCell.val ?? "",
                      )
                    }
                    style={{
                      padding: "1px 5px",
                      fontSize: 11,
                      background: "#0d9488",
                      color: "#fff",
                      border: "none",
                      borderRadius: 3,
                      cursor: "pointer",
                    }}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingIngCell(null)}
                    style={{
                      padding: "1px 5px",
                      fontSize: 11,
                      background: "#374151",
                      color: "#9ca3af",
                      border: "none",
                      borderRadius: 3,
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <span style={{ fontSize: 12, color: "#e2e8f0" }}>
                  {ing.weight} {displayUnit(resolveIngredientDisplayUnit(ing))}
                </span>
              )}
            </td>
            <td
              colSpan={2}
              style={{ textAlign: "center", cursor: "pointer" }}
              onClick={() =>
                noEdit &&
                setEditingIngCell({
                  key: cellKey,
                  field: "macro",
                  vals: {
                    kcal: ing.kcal != null ? String(ing.kcal) : "",
                    protein: ing.protein != null ? String(ing.protein) : "",
                    fat: ing.fat != null ? String(ing.fat) : "",
                    carbs: ing.carbs != null ? String(ing.carbs) : "",
                  },
                })
              }
            >
              {isEditM && editingIngCell.vals ? (
                <div
                  style={{ display: "inline-flex", alignItems: "center", gap: 2 }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      void saveIngMacro(recipe.id, ing, editingIngCell.vals!);
                    if (e.key === "Escape") setEditingIngCell(null);
                  }}
                >
                  <span style={{ fontSize: 10, color: "#6b7280" }}>kcal</span>
                  <input
                    autoFocus
                    style={inpS}
                    value={editingIngCell.vals.kcal}
                    onChange={(e) =>
                      setEditingIngCell((c) =>
                        c?.vals
                          ? { ...c, vals: { ...c.vals, kcal: e.target.value } }
                          : c,
                      )
                    }
                    placeholder="—"
                  />
                  <span style={{ fontSize: 10, color: "#6b7280" }}>
                    {tString(t, "macro_p")}
                  </span>
                  <input
                    style={inpS}
                    value={editingIngCell.vals.protein}
                    onChange={(e) =>
                      setEditingIngCell((c) =>
                        c?.vals
                          ? {
                              ...c,
                              vals: { ...c.vals, protein: e.target.value },
                            }
                          : c,
                      )
                    }
                    placeholder="—"
                  />
                  <span style={{ fontSize: 10, color: "#6b7280" }}>
                    {tString(t, "macro_f")}
                  </span>
                  <input
                    style={inpS}
                    value={editingIngCell.vals.fat}
                    onChange={(e) =>
                      setEditingIngCell((c) =>
                        c?.vals
                          ? { ...c, vals: { ...c.vals, fat: e.target.value } }
                          : c,
                      )
                    }
                    placeholder="—"
                  />
                  <span style={{ fontSize: 10, color: "#6b7280" }}>
                    {tString(t, "macro_c")}
                  </span>
                  <input
                    style={inpS}
                    value={editingIngCell.vals.carbs}
                    onChange={(e) =>
                      setEditingIngCell((c) =>
                        c?.vals
                          ? { ...c, vals: { ...c.vals, carbs: e.target.value } }
                          : c,
                      )
                    }
                    placeholder="—"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void saveIngMacro(recipe.id, ing, editingIngCell.vals!)
                    }
                    style={{
                      padding: "1px 5px",
                      fontSize: 11,
                      background: "#0d9488",
                      color: "#fff",
                      border: "none",
                      borderRadius: 3,
                      cursor: "pointer",
                      marginLeft: 2,
                    }}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingIngCell(null)}
                    style={{
                      padding: "1px 5px",
                      fontSize: 11,
                      background: "#374151",
                      color: "#9ca3af",
                      border: "none",
                      borderRadius: 3,
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <IngredientMacros ing={ing} t={t} />
              )}
            </td>
            <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
              {ing.cost.toFixed(2)} {tString(t, "currency")}
            </td>
            <td style={{ textAlign: "center" }}>
              <button
                type="button"
                onClick={() =>
                  showConfirm({
                    title: tString(t, "del_ing_title"),
                    message: tFormat(t, "del_ing_confirm", ing.product_name),
                    confirmLabel: tString(t, "btn_delete"),
                    onConfirm: () => void deleteIng(recipe.id, ings, ing),
                  })
                }
                style={{
                  background: "#2d1515",
                  border: "1px solid #4b1515",
                  color: "#f87171",
                  borderRadius: 4,
                  cursor: "pointer",
                  padding: "2px 8px",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {tString(t, "btn_delete")}
              </button>
            </td>
          </tr>
        );
      })}

      {isAdding && addingIng ? (
        <tr style={{ ...ingStyle, borderBottom: "1px solid #0d948840" }}>
          <td style={blStyle}>
            <div style={{ position: "relative" }}>
              <input
                autoFocus
                placeholder={tString(t, "search_product_ph")}
                value={addingIng.search}
                maxLength={200}
                onChange={(e) =>
                  setAddingIng((a) =>
                    a
                      ? {
                          ...a,
                          search: e.target.value,
                          product: null,
                          showDrop: true,
                          kcal: "",
                          protein: "",
                          fat: "",
                          carbs: "",
                        }
                      : a,
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Escape") setAddingIng(null);
                }}
                style={{
                  width: "100%",
                  maxWidth: 320,
                  boxSizing: "border-box",
                  padding: "3px 7px",
                  fontSize: 12,
                  background: "#111827",
                  border: "1px solid #0d9488",
                  borderRadius: 5,
                  color: "#f1f5f9",
                }}
              />
              {addingIng.showDrop && dropResults.length > 0 && (
                <div
                  className="dark-scroll"
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    background: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: 6,
                    zIndex: 200,
                    maxHeight: 180,
                    overflowY: "auto",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                  }}
                >
                  {dropResults.map((p) => (
                    <div
                      key={p.id}
                      onClick={() =>
                        setAddingIng((a) =>
                          a
                            ? {
                                ...a,
                                search: p.name,
                                product: p,
                                showDrop: false,
                                unit:
                                  p.unit === "szt" ? "g" : p.unit,
                                kcal: p.kcal != null ? String(p.kcal) : "",
                                protein:
                                  p.protein != null ? String(p.protein) : "",
                                fat: p.fat != null ? String(p.fat) : "",
                                carbs: p.carbs != null ? String(p.carbs) : "",
                              }
                            : a,
                        )
                      }
                      style={{
                        padding: "5px 10px",
                        fontSize: 12,
                        color: "#e2e8f0",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#374151";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {p.name}{" "}
                      <span style={{ color: "#6b7280", fontSize: 11 }}>
                        ({p.unit})
                      </span>
                    </div>
                  ))}
                  {!exactMatch && addingIng.search.trim().length >= 2 && (
                    <div
                      onClick={() =>
                        setAddingIng((a) =>
                          a ? { ...a, product: null, showDrop: false } : a,
                        )
                      }
                      style={{
                        padding: "5px 10px",
                        fontSize: 12,
                        color: "#0d9488",
                        cursor: "pointer",
                        borderTop: "1px solid #374151",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#374151";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {tFormat(t, "create_new_option", addingIng.search.trim())}
                    </div>
                  )}
                </div>
              )}
            </div>
          </td>
          <td style={{ textAlign: "left", width: 100 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              <input
                type="number"
                className="no-spin"
                min="0.1"
                max="99999"
                placeholder={tString(t, "quantity_ph")}
                value={addingIng.weight}
                onChange={(e) =>
                  setAddingIng((a) => (a ? { ...a, weight: e.target.value } : a))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") void confirmAddIng();
                  if (e.key === "Escape") setAddingIng(null);
                }}
                style={{
                  width: 55,
                  padding: "3px 4px",
                  fontSize: 12,
                  background: "#111827",
                  border: "1px solid #374151",
                  borderRadius: 4,
                  color: "#f1f5f9",
                  textAlign: "center",
                }}
              />
              <span style={{ fontSize: 11, color: "#6b7280" }}>{addUnit}</span>
            </div>
          </td>
          <td colSpan={2} style={{ textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
              <span style={{ fontSize: 10, color: "#6b7280" }}>kcal</span>
              <input
                className="no-spin"
                style={inpS}
                value={addingIng.kcal}
                onChange={(e) =>
                  setAddingIng((a) => (a ? { ...a, kcal: e.target.value } : a))
                }
                placeholder="—"
              />
              <span style={{ fontSize: 10, color: "#6b7280" }}>
                {tString(t, "macro_p")}
              </span>
              <input
                className="no-spin"
                style={inpS}
                value={addingIng.protein}
                onChange={(e) =>
                  setAddingIng((a) =>
                    a ? { ...a, protein: e.target.value } : a,
                  )
                }
                placeholder="—"
              />
              <span style={{ fontSize: 10, color: "#6b7280" }}>
                {tString(t, "macro_f")}
              </span>
              <input
                className="no-spin"
                style={inpS}
                value={addingIng.fat}
                onChange={(e) =>
                  setAddingIng((a) => (a ? { ...a, fat: e.target.value } : a))
                }
                placeholder="—"
              />
              <span style={{ fontSize: 10, color: "#6b7280" }}>
                {tString(t, "macro_c")}
              </span>
              <input
                className="no-spin"
                style={inpS}
                value={addingIng.carbs}
                onChange={(e) =>
                  setAddingIng((a) => (a ? { ...a, carbs: e.target.value } : a))
                }
                placeholder="—"
              />
            </div>
          </td>
          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
            {addingIng.product ? (
              <span style={{ fontSize: 11, color: "#6b7280" }}>
                {tString(t, "existing_product")}
              </span>
            ) : (
              <div
                style={{
                  display: "inline-flex",
                  flexDirection: "column",
                  gap: 3,
                  alignItems: "stretch",
                }}
              >
                <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                  {(["g", "ml", "szt"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() =>
                        setAddingIng((a) =>
                          a ? { ...a, unit: u, soldByWeight: false } : a,
                        )
                      }
                      style={{
                        padding: "1px 6px",
                        fontSize: 11,
                        borderRadius: 3,
                        cursor: "pointer",
                        border: "1px solid",
                        fontWeight: addingIng.unit === u ? 700 : 400,
                        background: addingIng.unit === u ? "#0d9488" : "#1f2937",
                        color: addingIng.unit === u ? "#fff" : "#9ca3af",
                        borderColor:
                          addingIng.unit === u ? "#0d9488" : "#374151",
                      }}
                    >
                      {displayUnit(u)}
                    </button>
                  ))}
                  {addingIng.unit !== "szt" && (
                    <button
                      type="button"
                      onClick={() =>
                        setAddingIng((a) =>
                          a ? { ...a, soldByWeight: !a.soldByWeight } : a,
                        )
                      }
                      style={{
                        padding: "1px 6px",
                        fontSize: 11,
                        borderRadius: 3,
                        cursor: "pointer",
                        border: "1px solid",
                        fontWeight: addingIng.soldByWeight ? 700 : 400,
                        background: addingIng.soldByWeight
                          ? "#6366f1"
                          : "#1f2937",
                        color: addingIng.soldByWeight ? "#fff" : "#9ca3af",
                        borderColor: addingIng.soldByWeight
                          ? "#6366f1"
                          : "#374151",
                      }}
                    >
                      {tString(t, "weight_btn")}
                    </button>
                  )}
                </div>
                {addingIng.unit === "szt" ? (
                  <div
                    style={{
                      display: "flex",
                      gap: 3,
                      alignItems: "center",
                      justifyContent: "flex-end",
                    }}
                  >
                    <input
                      placeholder={tString(t, "price_input_ph")}
                      type="number"
                      className="no-spin"
                      min="0"
                      max="99999"
                      value={addingIng.priceSzt}
                      onChange={(e) =>
                        setAddingIng((a) =>
                          a ? { ...a, priceSzt: e.target.value } : a,
                        )
                      }
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: "2px 4px",
                        fontSize: 11,
                        background: "#111827",
                        border: "1px solid #374151",
                        borderRadius: 3,
                        color: "#e2e8f0",
                      }}
                    />
                    <span style={{ fontSize: 10, color: "#6b7280", flexShrink: 0 }}>
                      {tString(t, "currency")}/{tString(t, "unit_pcs")}
                    </span>
                  </div>
                ) : addingIng.soldByWeight ? (
                  <div
                    style={{
                      display: "flex",
                      gap: 3,
                      alignItems: "center",
                      justifyContent: "flex-end",
                    }}
                  >
                    <input
                      placeholder={tString(t, "price_input_ph")}
                      type="number"
                      className="no-spin"
                      min="0"
                      max="99999"
                      value={addingIng.priceKg}
                      onChange={(e) =>
                        setAddingIng((a) =>
                          a ? { ...a, priceKg: e.target.value } : a,
                        )
                      }
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: "2px 4px",
                        fontSize: 11,
                        background: "#111827",
                        border: "1px solid #374151",
                        borderRadius: 3,
                        color: "#e2e8f0",
                      }}
                    />
                    <span style={{ fontSize: 10, color: "#6b7280", flexShrink: 0 }}>
                      {tString(t, "currency")}/kg
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      gap: 3,
                      alignItems: "center",
                      justifyContent: "flex-end",
                    }}
                  >
                    <input
                      placeholder={tString(t, "price_input_ph")}
                      type="number"
                      className="no-spin"
                      min="0"
                      max="99999"
                      value={addingIng.priceOpak}
                      onChange={(e) =>
                        setAddingIng((a) =>
                          a ? { ...a, priceOpak: e.target.value } : a,
                        )
                      }
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: "2px 4px",
                        fontSize: 11,
                        background: "#111827",
                        border: "1px solid #374151",
                        borderRadius: 3,
                        color: "#e2e8f0",
                      }}
                    />
                    <span style={{ fontSize: 10, color: "#6b7280", flexShrink: 0 }}>
                      {tString(t, "currency")} /
                    </span>
                    <input
                      placeholder={tString(t, "pkg_input_ph")}
                      type="number"
                      className="no-spin"
                      min="0"
                      max="99999"
                      value={addingIng.pkgWeight}
                      onChange={(e) =>
                        setAddingIng((a) =>
                          a ? { ...a, pkgWeight: e.target.value } : a,
                        )
                      }
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: "2px 4px",
                        fontSize: 11,
                        background: "#111827",
                        border: "1px solid #374151",
                        borderRadius: 3,
                        color: "#e2e8f0",
                      }}
                    />
                    <span style={{ fontSize: 10, color: "#6b7280", flexShrink: 0 }}>
                      {addingIng.unit === "szt"
                        ? tString(t, "unit_pcs")
                        : addingIng.unit}
                    </span>
                  </div>
                )}
              </div>
            )}
          </td>
          <td style={{ textAlign: "center", whiteSpace: "nowrap", width: 60 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 3,
                alignItems: "center",
              }}
            >
              <button
                type="button"
                onClick={() => void confirmAddIng()}
                disabled={!addingIng.search.trim() || !addingIng.weight}
                style={{
                  padding: "3px 8px",
                  fontSize: 12,
                  background: "#0d9488",
                  color: "#fff",
                  border: "none",
                  borderRadius: 5,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {tString(t, "add_btn")}
              </button>
              <button
                type="button"
                onClick={() => setAddingIng(null)}
                style={{
                  padding: "3px 8px",
                  fontSize: 12,
                  background: "#374151",
                  color: "#9ca3af",
                  border: "none",
                  borderRadius: 5,
                  cursor: "pointer",
                }}
              >
                {tString(t, "cancel")}
              </button>
            </div>
          </td>
        </tr>
      ) : (
        <tr
          style={{ ...ingStyle, cursor: "pointer" }}
          onClick={() => {
            initAdding(recipe.id);
            setEditingIngCell(null);
          }}
        >
          <td style={blStyle} colSpan={6}>
            <span style={{ color: "#0d9488", fontSize: 12, fontWeight: 600 }}>
              + {tString(t, "add_ing_label").replace("+", "").trim()}
            </span>
          </td>
        </tr>
      )}
    </>
  );
}

export function RecipesScreen() {
  const page = useRecipesPage();
  const {
    t,
    search,
    setSearch,
    pasteText,
    parsed,
    setParsed,
    editingName,
    setEditingName,
    addingProductFor,
    quickForm,
    setQuickForm,
    listOpen,
    setListOpen,
    recipeHelpModalOpen,
    setRecipeHelpModalOpen,
    categoryFilter,
    setCategoryFilter,
    editingCategory,
    setEditingCategory,
    selectionMode,
    setSelectionMode,
    selectedIds,
    visibleCount,
    filteredRecipes,
    recipeList,
    productList,
    categories,
    catMap,
    inspireLinks,
    textareaRef,
    sentinelRef,
    expanded,
    setExpanded,
    displayUnit,
    exitSelection,
    updateIngredient,
    removeIngredient,
    handleQuickAdd,
    handleSave,
    saveCategory,
    handleSaveName,
    handleDeleteSelected,
    handleDeleteAll,
    handleDeleteRecipe,
    handleToggleFavorite,
    handleExpandRow,
    handlePasteChange,
    handleClearPaste,
    handleCopyPrompt,
    openQuickAdd,
    promptCopied,
    setAddingProductFor,
  } = page;

  const expandedFirstCell = {
    ...expandedCellStyle,
    borderLeft: "3px solid #0d9488",
  };
  const expandedLastCell = {
    ...expandedCellStyle,
    borderRight: "1px solid #0d948860",
  };

  return (
    <div className="recipes-page">
      <div className="card recipes-add-card">
        <h2>{tString(t, "add_recipe_title")}</h2>

        <div className="recipes-add-layout">
          <section className="recipes-inspire-band">
            <div className="recipes-section-label">
              <Icon icon="heroicons:light-bulb" width={15} />
              {tString(t, "search_inspiration")}
            </div>
            <div className="recipes-inspire-grid">
              {inspireLinks.map(({ href, domain, label }) => (
                <a
                  key={domain}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="recipes-inspire-link"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                    alt=""
                  />
                  <span>{label}</span>
                </a>
              ))}
            </div>
          </section>

          <div className="recipes-add-columns">
            <div className="recipes-editor">
              <section className="recipes-format">
                <div className="recipes-section-label">
                  <Icon icon="heroicons:document-text" width={15} />
                  {tString(t, "format_title")}
                </div>
                <ol className="recipes-format-steps">
                  <li>
                    <span className="recipes-format-num">1</span>
                    <span>
                      <strong>{tString(t, "recipe_name_lbl")}</strong>{" "}
                      {tString(t, "fmt_1_rest")}
                    </span>
                  </li>
                  <li>
                    <span className="recipes-format-num">2</span>
                    <span>{tString(t, "fmt_2")}</span>
                  </li>
                  <li>
                    <span className="recipes-format-num">3</span>
                    <span>{tString(t, "fmt_3")}</span>
                  </li>
                  <li>
                    <span className="recipes-format-num">4</span>
                    <span>{tString(t, "fmt_4")}</span>
                  </li>
                </ol>
              </section>

              <section className="recipes-compose">
                <div className="recipes-textarea-wrap">
                  <textarea
                    ref={textareaRef}
                    className="recipes-textarea"
                    value={pasteText}
                    onChange={(e) => handlePasteChange(e.target.value)}
                    maxLength={5000}
                    placeholder={tString(t, "recipe_ph")}
                  />
                </div>
                <div className="recipes-compose-footer">
                  <button
                    type="button"
                    className="pill-help-btn"
                    onClick={() => setRecipeHelpModalOpen(true)}
                    aria-label={tString(t, "how_to_recipe")}
                    title={tString(t, "how_to_recipe")}
                  >
                    <Icon icon="heroicons:light-bulb" width={15} />
                    <span>{tString(t, "how_to_recipe")}</span>
                  </button>
                  <div
                    className={`recipes-char-count${pasteText.length > 4500 ? " recipes-char-count--warn" : ""}`}
                  >
                    {pasteText.length} / 5000
                  </div>
                </div>
              </section>
            </div>

            <div className="recipes-live-form">
              <div className="recipes-live-form-head">
                <Icon icon="heroicons:clipboard-document-list" width={18} />
                {tString(t, "recipe_live_preview_title")}
              </div>

              {!parsed ? (
                <div className="recipes-live-empty">
                  <Icon
                    icon="heroicons:arrow-left"
                    width={20}
                    className="recipes-live-empty-icon"
                  />
                  <p>{tString(t, "recipe_live_preview_empty")}</p>
                </div>
              ) : (
                <div className="recipes-live-form-body">
                  <div className="recipes-live-field">
                    <label>{tString(t, "recipe_name_lbl")}</label>
                    <input
                      value={parsed.name}
                      onChange={(e) =>
                        setParsed((p) => (p ? { ...p, name: e.target.value } : p))
                      }
                    />
                  </div>

                  <div
                    className={`recipes-live-block${parsed.category ? "" : " recipes-live-block--warn"}`}
                  >
                    <span className="recipes-live-block-label">
                      {tString(t, "meal_type_label")}
                    </span>
                    <div className="recipes-live-chips">
                      {categories.map((cat) => (
                        <button
                          key={cat.value}
                          type="button"
                          className={`recipes-live-chip${parsed.category === cat.value ? " active" : ""}`}
                          onClick={() =>
                            setParsed((p) =>
                              p
                                ? {
                                    ...p,
                                    category:
                                      p.category === cat.value
                                        ? null
                                        : cat.value,
                                  }
                                : p,
                            )
                          }
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                    {!parsed.category && (
                      <span className="recipes-live-hint-warn">
                        {tString(t, "select_meal_type")}
                      </span>
                    )}
                  </div>

                  <div
                    className={`recipes-live-block${parsed.servings && parseInt(parsed.servings, 10) >= 1 ? "" : " recipes-live-block--warn"}`}
                  >
                    <label className="recipes-live-block-label">
                      {tString(t, "recipe_servings_label")} *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      step="1"
                      value={parsed.servings}
                      onChange={(e) =>
                        setParsed((p) =>
                          p ? { ...p, servings: e.target.value } : p,
                        )
                      }
                      placeholder="4"
                      className="recipes-live-servings"
                    />
                    <p className="recipes-live-hint">
                      {tString(t, "recipe_servings_hint")}
                    </p>
                  </div>

                  <div className="recipes-live-ing-head">
                    {tFormat2(
                      t,
                      "ingredients_lbl",
                      parsed.ingredients.filter((i) => i.product_id).length,
                      parsed.ingredients.length,
                    )}
                  </div>

                  {parsed.ingredients.length > 0 && (
                    <div className="recipes-live-ing-columns" aria-hidden="true">
                      <span className="recipes-live-ing-col-amt">
                        {tString(t, "col_amount")}
                      </span>
                      <span className="recipes-live-ing-col-prod">
                        {tString(t, "matched_product_col")}
                      </span>
                    </div>
                  )}

                  <div className="recipes-live-ing-list">
                    {parsed.ingredients.length === 0 ? (
                      <p className="recipes-live-hint">
                        {tString(t, "recipe_live_no_ingredients")}
                      </p>
                    ) : (
                      parsed.ingredients.map((ing, i) => (
                        <Fragment key={`${ing.rawName}-${i}`}>
                          <div
                            className={`recipes-live-ing-row${ing.product_id ? " matched" : ""}${addingProductFor === i ? " expanding" : ""}`}
                          >
                            <div
                              className="recipes-live-ing-name"
                              title={ing.rawName}
                            >
                              <span>{ing.rawName}</span>
                              {canonicalDiffersFromRaw(
                                ing.rawName,
                                ing.canonicalName,
                              ) && (
                                <small title={ing.canonicalName}>
                                  {tFormat(
                                    t,
                                    "canonical_match_hint",
                                    ing.canonicalName ?? "",
                                  )}
                                </small>
                              )}
                            </div>
                            <div className="recipes-live-ing-controls">
                              <input
                                type="number"
                                className="recipes-live-ing-weight no-spin"
                                value={ing.weight}
                                min="0"
                                max="99999"
                                onChange={(e) =>
                                  updateIngredient(
                                    i,
                                    "weight",
                                    Math.min(
                                      99999,
                                      parseFloat(e.target.value) || 0,
                                    ),
                                  )
                                }
                                aria-label={tString(t, "col_amount")}
                              />
                              <select
                                className="recipes-live-ing-unit"
                                value={ing.unit || "g"}
                                onChange={(e) =>
                                  updateIngredient(i, "unit", e.target.value)
                                }
                                title={tString(t, "unit_lbl")}
                                aria-label={tString(t, "unit_lbl")}
                              >
                                <option value="g">g</option>
                                <option value="ml">ml</option>
                                <option value="szt">
                                  {tString(t, "unit_pcs")}
                                </option>
                              </select>
                              <select
                                className="recipes-live-ing-product"
                                value={ing.product_id || ""}
                                onChange={(e) => {
                                  const pid = e.target.value || null;
                                  const prod = productList.find(
                                    (p) => String(p.id) === String(pid),
                                  );
                                  setParsed((p) => {
                                    if (!p) return p;
                                    const u = [...p.ingredients];
                                    const cur = u[i];
                                    if (!cur) return p;
                                    u[i] = {
                                      ...cur,
                                      product_id: pid
                                        ? parseInt(String(pid), 10)
                                        : null,
                                      unit: prod?.unit || cur.unit || "g",
                                    };
                                    return { ...p, ingredients: u };
                                  });
                                }}
                                title={
                                  ing.product_id
                                    ? productList.find(
                                        (p) =>
                                          String(p.id) ===
                                          String(ing.product_id),
                                      )?.name
                                    : tString(t, "no_match_opt")
                                }
                              >
                                <option value="">
                                  {tString(t, "no_match_opt")}
                                </option>
                                {productList.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                              {!ing.product_id ? (
                                <button
                                  type="button"
                                  className={`recipes-live-ing-add${addingProductFor === i ? " active" : ""}`}
                                  title={tString(t, "add_to_products_btn")}
                                  aria-label={tString(t, "add_to_products_btn")}
                                  onClick={() => openQuickAdd(i, ing)}
                                >
                                  <Icon icon="heroicons:plus-circle" width={18} />
                                </button>
                              ) : (
                                <span
                                  className="recipes-live-ing-add-placeholder"
                                  aria-hidden="true"
                                />
                              )}
                              <button
                                type="button"
                                className="recipes-live-ing-del"
                                onClick={() => removeIngredient(i)}
                                aria-label={tString(t, "delete")}
                              >
                                <Icon icon="heroicons:x-mark" width={14} />
                              </button>
                            </div>
                          </div>
                          {addingProductFor === i && (
                            <div className="recipes-live-quick-add">
                              <div className="recipes-live-quick-add-title">
                                {tString(t, "add_ing_new_product")}
                              </div>

                              <div className="recipes-live-quick-add-field">
                                <label htmlFor={`quick-name-${i}`}>
                                  {tString(t, "product_name_lbl")}
                                </label>
                                <input
                                  id={`quick-name-${i}`}
                                  value={quickForm.name}
                                  maxLength={50}
                                  onChange={(e) =>
                                    setQuickForm((f) => ({
                                      ...f,
                                      name: e.target.value.slice(0, 50),
                                    }))
                                  }
                                  placeholder={tString(t, "product_name_ph")}
                                />
                              </div>

                              <div className="recipes-live-quick-add-price-row">
                                <div className="recipes-live-quick-add-field recipes-live-quick-add-field--compact">
                                  <label htmlFor={`quick-price-${i}`}>
                                    {quickForm.sold_by_weight
                                      ? tString(t, "price_per_kg_lbl")
                                      : tString(t, "price_per_opak_lbl")}
                                  </label>
                                  <input
                                    id={`quick-price-${i}`}
                                    type="number"
                                    className="no-spin"
                                    min="0"
                                    max="99999"
                                    step="0.01"
                                    value={quickForm.package_price}
                                    onChange={(e) =>
                                      setQuickForm((f) => ({
                                        ...f,
                                        package_price:
                                          e.target.value === ""
                                            ? ""
                                            : String(
                                                Math.min(
                                                  99999,
                                                  parseFloat(e.target.value) ||
                                                    0,
                                                ),
                                              ),
                                      }))
                                    }
                                    placeholder={tString(t, "pkg_price_ph")}
                                  />
                                </div>
                                <div className="recipes-live-quick-add-field">
                                  <div className="recipes-live-quick-add-toggle-btns">
                                    <button
                                      type="button"
                                      className={
                                        !quickForm.sold_by_weight ? "active" : ""
                                      }
                                      onClick={() =>
                                        setQuickForm((f) => ({
                                          ...f,
                                          sold_by_weight: false,
                                        }))
                                      }
                                    >
                                      {tString(t, "pkg_in_packaging")}
                                    </button>
                                    <button
                                      type="button"
                                      className={
                                        quickForm.sold_by_weight ? "active" : ""
                                      }
                                      onClick={() =>
                                        setQuickForm((f) => ({
                                          ...f,
                                          sold_by_weight: true,
                                          unit: "g",
                                          package_weight: "",
                                        }))
                                      }
                                    >
                                      {tString(t, "pkg_by_weight")}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {!quickForm.sold_by_weight && (
                                <div className="recipes-live-quick-add-field">
                                  <label htmlFor={`quick-qty-${i}`}>
                                    {tString(t, "pkg_qty_lbl")}
                                  </label>
                                  <input
                                    id={`quick-qty-${i}`}
                                    type="number"
                                    className="no-spin recipes-live-quick-add-qty-input"
                                    min="0"
                                    max="99999"
                                    value={quickForm.package_weight}
                                    onChange={(e) =>
                                      setQuickForm((f) => ({
                                        ...f,
                                        package_weight:
                                          e.target.value === ""
                                            ? ""
                                            : String(
                                                Math.min(
                                                  99999,
                                                  parseFloat(e.target.value) ||
                                                    0,
                                                ),
                                              ),
                                      }))
                                    }
                                    placeholder={tString(t, "pkg_qty_ph")}
                                  />
                                  <div className="recipes-live-quick-add-units">
                                    {(["g", "kg", "ml", "l", "szt"] as const).map(
                                      (u) => (
                                        <button
                                          key={u}
                                          type="button"
                                          className={
                                            quickForm.unit === u ? "active" : ""
                                          }
                                          onClick={() =>
                                            setQuickForm((f) => ({
                                              ...f,
                                              unit: u,
                                            }))
                                          }
                                        >
                                          {displayUnit(u)}
                                        </button>
                                      ),
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="recipes-live-quick-add-actions">
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  onClick={() => void handleQuickAdd(i)}
                                >
                                  {tString(t, "add_product_btn")}
                                </button>
                                <button
                                  type="button"
                                  className="btn recipes-live-quick-add-cancel"
                                  onClick={() => setAddingProductFor(null)}
                                >
                                  {tString(t, "cancel")}
                                </button>
                              </div>
                            </div>
                          )}
                        </Fragment>
                      ))
                    )}
                  </div>

                  {parsed.ingredients.some((i) => !i.product_id) && (
                    <div className="recipes-live-match-hint">
                      <div className="recipes-live-match-hint-head">
                        <span
                          className="recipes-live-match-hint-swatch"
                          aria-hidden="true"
                        />
                        {tString(t, "missing_product_hint_title")}
                      </div>
                      <ol className="recipes-live-match-hint-steps">
                        <li>{tString(t, "missing_product_hint_step1")}</li>
                        <li>
                          {tString(t, "missing_product_hint_step2_before")}{" "}
                          <span
                            className="recipes-live-hint-btn-demo"
                            title={tString(t, "add_to_products_btn")}
                            aria-hidden="true"
                          >
                            <Icon icon="heroicons:plus-circle" width={15} />
                          </span>{" "}
                          {tString(t, "missing_product_hint_step2_after")}
                        </li>
                      </ol>
                    </div>
                  )}

                  <div className="recipes-live-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void handleSave()}
                    >
                      {tString(t, "save_recipe")}
                    </button>
                    <button
                      type="button"
                      className="btn recipes-live-clear"
                      onClick={handleClearPaste}
                    >
                      {tString(t, "clear")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <RecipeHelpModal
        open={recipeHelpModalOpen}
        onClose={() => setRecipeHelpModalOpen(false)}
        t={t}
        nameLabel={tString(t, "recipe_name_lbl")}
        promptCopied={promptCopied}
        onCopyPrompt={handleCopyPrompt}
      />

      <div
        className="card recipes-list-card"
        style={{ padding: 0, overflow: "hidden" }}
      >
        <div className="recipes-list-header">
          <button
            type="button"
            className="list-section-toggle"
            onClick={() => setListOpen((o) => !o)}
          >
            <span className="card-section-title">
              {tString(t, "recipe_list_title")}
            </span>
          </button>

          <button
            type="button"
            className={`list-header-btn${selectionMode ? " list-header-btn--active" : ""}`}
            onClick={() =>
              selectionMode
                ? exitSelection()
                : (setSelectionMode(true), setExpanded(null))
            }
          >
            {selectionMode
              ? tString(t, "deselect_label")
              : tString(t, "select_label")}
          </button>

          <button
            type="button"
            className="list-header-btn list-header-btn--danger"
            onClick={() => {
              if (selectionMode && selectedIds.size > 0) {
                handleDeleteSelected();
              } else if (!selectionMode) {
                handleDeleteAll();
              }
            }}
            disabled={selectionMode && selectedIds.size === 0}
          >
            {selectionMode && selectedIds.size > 0
              ? tFormatN(t, "del_selected_recipes", selectedIds.size)
              : tString(t, "del_all_recipes")}
          </button>

          <button
            type="button"
            className="list-header-chevron"
            onClick={() => setListOpen((o) => !o)}
          >
            <Icon
              icon="heroicons:chevron-down"
              style={{
                width: 20,
                height: 20,
                transition: "transform 0.25s",
                transform: listOpen ? "rotate(180deg)" : "rotate(0deg)",
                color: "#0d9488",
              }}
            />
          </button>
        </div>

        {listOpen && (
          <div className="recipes-list-body">
            <div
              style={{
                margin: "12px 0 8px",
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tString(t, "search_recipe_ph")}
                style={{
                  flex: 1,
                  padding: "7px 12px",
                  border: "1px solid #374151",
                  borderRadius: 6,
                  fontSize: 13,
                  boxSizing: "border-box",
                  outline: "none",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#0d9488";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#374151";
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                gap: 6,
                marginBottom: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => setCategoryFilter(null)}
                style={{
                  padding: "4px 12px",
                  border: `1.5px solid ${!categoryFilter ? "#9ca3af" : "#374151"}`,
                  borderRadius: 20,
                  fontSize: 12,
                  cursor: "pointer",
                  background: !categoryFilter ? "#374151" : "transparent",
                  color: !categoryFilter ? "#f1f5f9" : "#6b7280",
                  fontWeight: !categoryFilter ? 700 : 400,
                  transition: "all 0.15s",
                }}
              >
                {tString(t, "cat_all")}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() =>
                    setCategoryFilter((f) =>
                      f === cat.value ? null : cat.value,
                    )
                  }
                  style={{
                    padding: "4px 12px",
                    border: `1.5px solid ${categoryFilter === cat.value ? "#0d9488" : "#374151"}`,
                    borderRadius: 20,
                    fontSize: 12,
                    cursor: "pointer",
                    background:
                      categoryFilter === cat.value ? "#0d948822" : "transparent",
                    color:
                      categoryFilter === cat.value ? "#2dd4bf" : "#6b7280",
                    fontWeight: categoryFilter === cat.value ? 700 : 400,
                    transition: "all 0.15s",
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            {recipeList.length === 0 && (
              <p style={{ textAlign: "center", color: "#6b7280" }}>
                {tString(t, "no_recipes_add")}
              </p>
            )}
            {recipeList.length > 0 &&
              search.trim() &&
              filteredRecipes.length === 0 && (
                <p
                  style={{
                    textAlign: "center",
                    color: "#6b7280",
                    fontStyle: "italic",
                  }}
                >
                  {tFormat(t, "recipe_not_found", search)}
                </p>
              )}
            <div className="table-scroll">
              <table className="recipes-table">
                <thead>
                  <tr>
                    <th colSpan={2} style={{ width: "40%" }}>
                      {tString(t, "recipe_col_name")}
                    </th>
                    <th>{tString(t, "recipe_col_kcalmacro")}</th>
                    <th style={{ width: 90 }}>{tString(t, "recipe_col_meal")}</th>
                    <th>{tString(t, "recipe_col_price")}</th>
                    <th style={{ width: 60 }} />
                  </tr>
                </thead>
                <tbody>
                  {filteredRecipes.slice(0, visibleCount).map((r) => {
                    const isExpanded = expanded === r.id;
                    return (
                      <Fragment key={r.id}>
                        <tr
                          className={`recipe-row${selectedIds.has(r.id) ? " recipe-row-checked" : ""}`}
                          onClick={() => handleExpandRow(r.id)}
                          style={{ cursor: "pointer" }}
                        >
                          <td
                            colSpan={2}
                            style={
                              !selectionMode && isExpanded
                                ? expandedFirstCell
                                : undefined
                            }
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              {selectionMode && (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: 16,
                                    height: 16,
                                    borderRadius: 4,
                                    border: `1.5px solid ${selectedIds.has(r.id) ? "#6366f1" : "#374151"}`,
                                    background: selectedIds.has(r.id)
                                      ? "#6366f1"
                                      : "transparent",
                                    flexShrink: 0,
                                    transition: "all 0.12s",
                                  }}
                                >
                                  {selectedIds.has(r.id) && (
                                    <Icon
                                      icon="heroicons:check"
                                      style={{ width: 10, height: 10, color: "#fff" }}
                                    />
                                  )}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => handleToggleFavorite(r.id, e)}
                                title={
                                  r.is_favorite
                                    ? tString(t, "fav_remove")
                                    : tString(t, "fav_add")
                                }
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: 20,
                                  lineHeight: 1,
                                  padding: "2px 0",
                                  color: r.is_favorite ? "#facc15" : "transparent",
                                  WebkitTextStroke: r.is_favorite
                                    ? "0"
                                    : "1.5px #6b7280",
                                  flexShrink: 0,
                                }}
                              >
                                ★
                              </button>
                              {editingName?.id === r.id ? (
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 6,
                                    alignItems: "center",
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    value={editingName.text}
                                    maxLength={200}
                                    autoFocus
                                    onChange={(e) =>
                                      setEditingName({
                                        ...editingName,
                                        text: e.target.value,
                                      })
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter")
                                        void handleSaveName(r.id);
                                      if (e.key === "Escape")
                                        setEditingName(null);
                                    }}
                                    style={{
                                      padding: "3px 8px",
                                      fontSize: 14,
                                      fontWeight: 600,
                                      border: "1px solid #0d9488",
                                      borderRadius: 5,
                                      background: "#111827",
                                      color: "#f1f5f9",
                                      width: 220,
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className="btn btn-primary"
                                    style={{ padding: "3px 10px", fontSize: 12 }}
                                    onClick={() => void handleSaveName(r.id)}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    type="button"
                                    className="btn"
                                    style={{
                                      padding: "3px 8px",
                                      fontSize: 12,
                                      background: "#374151",
                                      color: "#9ca3af",
                                    }}
                                    onClick={() => setEditingName(null)}
                                  >
                                    ✗
                                  </button>
                                </div>
                              ) : (
                                <span
                                  className="recipe-name"
                                  title={tString(t, "click_to_edit")}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setEditingName({ id: r.id, text: r.name });
                                  }}
                                >
                                  {r.name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td
                            style={{
                              whiteSpace: "nowrap",
                              ...(isExpanded ? expandedCellStyle : {}),
                            }}
                          >
                            {r.total_kcal > 0 ? (
                              <span className="recipe-kcal">
                                <strong>{r.total_kcal}</strong> kcal ·{" "}
                                {tString(t, "macro_p")}
                                {r.total_protein} {tString(t, "macro_f")}
                                {r.total_fat} {tString(t, "macro_c")}
                                {r.total_carbs}
                              </span>
                            ) : (
                              <span className="recipe-kcal recipe-kcal--empty">
                                —
                              </span>
                            )}
                          </td>
                          <td
                            style={isExpanded ? expandedCellStyle : undefined}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCategory((ec) =>
                                ec?.id === r.id
                                  ? null
                                  : { id: r.id, value: r.category || "" },
                              );
                            }}
                          >
                            {editingCategory?.id === r.id ? (
                              <div
                                style={{
                                  position: "relative",
                                  display: "inline-block",
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div
                                  style={{
                                    position: "absolute",
                                    top: "100%",
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    background: "#1f2937",
                                    border: "1px solid #374151",
                                    borderRadius: 8,
                                    zIndex: 300,
                                    minWidth: 110,
                                    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                                    padding: 4,
                                  }}
                                >
                                  <div
                                    onClick={() => saveCategory(r.id, null)}
                                    style={{
                                      padding: "5px 10px",
                                      fontSize: 12,
                                      color: "#6b7280",
                                      cursor: "pointer",
                                      borderRadius: 4,
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background =
                                        "#374151";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background =
                                        "transparent";
                                    }}
                                  >
                                    {tString(t, "no_type_label")}
                                  </div>
                                  {categories.map((cat) => (
                                    <div
                                      key={cat.value}
                                      onClick={() =>
                                        saveCategory(r.id, cat.value)
                                      }
                                      style={{
                                        padding: "5px 10px",
                                        fontSize: 12,
                                        color: "#2dd4bf",
                                        cursor: "pointer",
                                        borderRadius: 4,
                                        fontWeight: 600,
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background =
                                          "#374151";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background =
                                          "transparent";
                                      }}
                                    >
                                      {cat.label}
                                    </div>
                                  ))}
                                </div>
                                <span
                                  className={`recipe-category${r.category ? " recipe-category--set" : " recipe-category--empty"}`}
                                >
                                  {r.category
                                    ? catMap[r.category]?.label
                                    : tString(t, "no_type")}
                                </span>
                              </div>
                            ) : (
                              <span
                                className={`recipe-category${r.category ? " recipe-category--set" : " recipe-category--empty"}`}
                                title={tString(t, "click_change_meal")}
                              >
                                {r.category
                                  ? catMap[r.category]?.label
                                  : tString(t, "no_type")}
                              </span>
                            )}
                          </td>
                          <td
                            style={{
                              whiteSpace: "nowrap",
                              ...(isExpanded ? expandedCellStyle : {}),
                            }}
                          >
                            <span className="recipe-price">
                              {r.total_cost.toFixed(2)} {tString(t, "currency")}
                            </span>
                            {r.source_url && (
                              <div>
                                <a
                                  href={r.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="recipe-source-link"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {tString(t, "see_recipe")}
                                </a>
                              </div>
                            )}
                          </td>
                          <td
                            style={isExpanded ? expandedLastCell : undefined}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => handleDeleteRecipe(r)}
                            >
                              {tString(t, "delete")}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <ExpandedRecipeDetail recipe={r} page={page} />
                        )}
                      </Fragment>
                    );
                  })}
                  {visibleCount < filteredRecipes.length && (
                    <tr ref={sentinelRef}>
                      <td
                        colSpan={6}
                        style={{
                          textAlign: "center",
                          color: "#4b5563",
                          padding: "10px 0",
                          fontSize: 12,
                        }}
                      >
                        {tFormat2(
                          t,
                          "shown_recipes",
                          visibleCount,
                          filteredRecipes.length,
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
