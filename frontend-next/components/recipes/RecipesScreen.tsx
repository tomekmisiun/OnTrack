"use client";

import { Fragment } from "react";
import { RecipeHelpModal } from "@/components/recipes/RecipeHelpModal";
import { useRecipesPage } from "@/hooks/useRecipesPage";
import { canonicalDiffersFromRaw } from "@/lib/recipes/ingredientCanonical";
import { tFormat, tFormat2, tFormatN, tString } from "@/lib/i18n/translate";
import type { RecipeIngredient, RecipeSummary } from "@/types/recipe";

function IngredientMacros({
  ing,
  t,
}: {
  ing: RecipeIngredient;
  t: ReturnType<typeof useRecipesPage>["t"];
}) {
  const factor = ing.unit === "szt" ? ing.weight : ing.weight / 100;
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
      <span className="text-[11px] text-slate-400">
        + {tString(t, "col_macro").toLowerCase()}
      </span>
    );
  }

  return (
    <span className="text-[11px] text-slate-400">
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

  const ingStyle = "bg-teal-950/20";
  const blStyle = "border-l-[3px] border-l-teal-600";
  const inpS =
    "w-9 min-w-0 rounded border border-teal-600 bg-slate-800 px-1 py-0.5 text-center text-[11px] text-slate-200 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  if (ings === null) {
    return (
      <tr className={ingStyle}>
        <td colSpan={6} className="px-3 py-3 text-center text-sm text-slate-500">
          {tString(t, "loading_ing")}
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className={ingStyle}>
        <th
          className={`${blStyle} px-2 py-1.5 text-left text-[11px] font-bold tracking-wide text-slate-500`}
        >
          {tString(t, "col_product")}
        </th>
        <th className="w-[100px] px-2 py-1.5 text-left text-[11px] font-bold tracking-wide text-slate-500">
          {tString(t, "col_weight")}
        </th>
        <th
          colSpan={2}
          className="px-2 py-1.5 text-center text-[11px] font-bold tracking-wide text-slate-500"
        >
          {tString(t, "col_macro")}
        </th>
        <th className="whitespace-nowrap px-2 py-1.5 text-right text-[11px] font-bold tracking-wide text-slate-500">
          {tString(t, "col_cost")}
        </th>
        <th className="w-[60px] px-2 py-1.5 text-center text-[11px] font-bold tracking-wide text-slate-500">
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
          <tr key={ing.id} className={ingStyle}>
            <td
              className={`${blStyle} cursor-pointer px-2 py-1.5`}
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
                  className="flex items-center gap-1"
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
                    className="flex-1 rounded border border-teal-600 bg-slate-800 px-1.5 py-0.5 text-[13px] text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void saveIngName(recipe.id, ing, editingIngCell.val ?? "")
                    }
                    className="cursor-pointer rounded bg-teal-600 px-1.5 py-0.5 text-[11px] text-white"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingIngCell(null)}
                    className="cursor-pointer rounded bg-slate-600 px-1.5 py-0.5 text-[11px] text-slate-400"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                ing.product_name
              )}
            </td>
            <td
              className="w-[100px] cursor-pointer px-2 py-1.5 text-left"
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
                  className="inline-flex items-center gap-1"
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
                    className={`${inpS} !w-14`}
                    value={editingIngCell.val}
                    onChange={(e) =>
                      setEditingIngCell((c) =>
                        c ? { ...c, val: e.target.value } : c,
                      )
                    }
                  />
                  <span className="text-[11px] text-slate-500">{ing.unit}</span>
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
                    className="cursor-pointer rounded bg-teal-600 px-1.5 py-0.5 text-[11px] text-white"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingIngCell(null)}
                    className="cursor-pointer rounded bg-slate-600 px-1.5 py-0.5 text-[11px] text-slate-400"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-200">
                  {ing.weight} {ing.unit}
                </span>
              )}
            </td>
            <td
              colSpan={2}
              className="cursor-pointer px-2 py-1.5 text-center"
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
                  className="inline-flex flex-wrap items-center justify-center gap-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      void saveIngMacro(recipe.id, ing, editingIngCell.vals!);
                    if (e.key === "Escape") setEditingIngCell(null);
                  }}
                >
                  <span className="text-[10px] text-slate-500">kcal</span>
                  <input
                    autoFocus
                    className={inpS}
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
                  <span className="text-[10px] text-slate-500">
                    {tString(t, "macro_p")}
                  </span>
                  <input
                    className={inpS}
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
                  <span className="text-[10px] text-slate-500">
                    {tString(t, "macro_f")}
                  </span>
                  <input
                    className={inpS}
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
                  <span className="text-[10px] text-slate-500">
                    {tString(t, "macro_c")}
                  </span>
                  <input
                    className={inpS}
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
                    className="ml-0.5 cursor-pointer rounded bg-teal-600 px-1.5 py-0.5 text-[11px] text-white"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingIngCell(null)}
                    className="cursor-pointer rounded bg-slate-600 px-1.5 py-0.5 text-[11px] text-slate-400"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <IngredientMacros ing={ing} t={t} />
              )}
            </td>
            <td className="whitespace-nowrap px-2 py-1.5 text-right text-sm">
              {ing.cost.toFixed(2)} {tString(t, "currency")}
            </td>
            <td className="px-2 py-1.5 text-center">
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
                className="cursor-pointer rounded border border-red-900/60 bg-red-950/40 px-2 py-0.5 text-[11px] font-semibold text-red-400"
              >
                {tString(t, "btn_delete")}
              </button>
            </td>
          </tr>
        );
      })}

      {isAdding && addingIng ? (
        <tr className={`${ingStyle} border-b border-teal-600/25`}>
          <td className={blStyle}>
            <div className="relative">
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
                className="w-full max-w-xs rounded border border-teal-600 bg-slate-900 px-2 py-1 text-xs text-slate-100"
              />
              {addingIng.showDrop && dropResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-[200] max-h-44 overflow-y-auto rounded-md border border-slate-600 bg-slate-800 shadow-xl">
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
                                unit: p.unit,
                                kcal: p.kcal != null ? String(p.kcal) : "",
                                protein:
                                  p.protein != null ? String(p.protein) : "",
                                fat: p.fat != null ? String(p.fat) : "",
                                carbs: p.carbs != null ? String(p.carbs) : "",
                              }
                            : a,
                        )
                      }
                      className="cursor-pointer px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                    >
                      {p.name}{" "}
                      <span className="text-[11px] text-slate-500">
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
                      className="cursor-pointer border-t border-slate-600 px-2.5 py-1.5 text-xs text-teal-400 hover:bg-slate-700"
                    >
                      {tFormat(t, "create_new_option", addingIng.search.trim())}
                    </div>
                  )}
                </div>
              )}
            </div>
          </td>
          <td className="w-[100px] text-left">
            <div className="inline-flex items-center gap-1">
              <input
                type="number"
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
                className="w-14 rounded border border-slate-600 bg-slate-900 px-1 py-1 text-center text-xs text-slate-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-[11px] text-slate-500">{addUnit}</span>
            </div>
          </td>
          <td colSpan={2} className="text-center">
            <div className="inline-flex flex-wrap items-center justify-center gap-1">
              <span className="text-[10px] text-slate-500">kcal</span>
              <input
                className={inpS}
                value={addingIng.kcal}
                onChange={(e) =>
                  setAddingIng((a) => (a ? { ...a, kcal: e.target.value } : a))
                }
                placeholder="—"
              />
              <span className="text-[10px] text-slate-500">
                {tString(t, "macro_p")}
              </span>
              <input
                className={inpS}
                value={addingIng.protein}
                onChange={(e) =>
                  setAddingIng((a) =>
                    a ? { ...a, protein: e.target.value } : a,
                  )
                }
                placeholder="—"
              />
              <span className="text-[10px] text-slate-500">
                {tString(t, "macro_f")}
              </span>
              <input
                className={inpS}
                value={addingIng.fat}
                onChange={(e) =>
                  setAddingIng((a) => (a ? { ...a, fat: e.target.value } : a))
                }
                placeholder="—"
              />
              <span className="text-[10px] text-slate-500">
                {tString(t, "macro_c")}
              </span>
              <input
                className={inpS}
                value={addingIng.carbs}
                onChange={(e) =>
                  setAddingIng((a) => (a ? { ...a, carbs: e.target.value } : a))
                }
                placeholder="—"
              />
            </div>
          </td>
          <td className="whitespace-nowrap text-right">
            {addingIng.product ? (
              <span className="text-[11px] text-slate-500">
                {tString(t, "existing_product")}
              </span>
            ) : (
              <div className="inline-flex flex-col items-stretch gap-1">
                <div className="flex items-center gap-1">
                  {(["g", "ml", "szt"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() =>
                        setAddingIng((a) =>
                          a ? { ...a, unit: u, soldByWeight: false } : a,
                        )
                      }
                      className={`cursor-pointer rounded border px-1.5 py-0.5 text-[11px] ${
                        addingIng.unit === u
                          ? "border-teal-600 bg-teal-600 font-bold text-white"
                          : "border-slate-600 bg-slate-800 text-slate-400"
                      }`}
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
                      className={`cursor-pointer rounded border px-1.5 py-0.5 text-[11px] ${
                        addingIng.soldByWeight
                          ? "border-indigo-500 bg-indigo-500 font-bold text-white"
                          : "border-slate-600 bg-slate-800 text-slate-400"
                      }`}
                    >
                      {tString(t, "weight_btn")}
                    </button>
                  )}
                </div>
                {addingIng.unit === "szt" ? (
                  <div className="flex items-center justify-end gap-1">
                    <input
                      placeholder={tString(t, "price_input_ph")}
                      type="number"
                      min="0"
                      max="99999"
                      value={addingIng.priceSzt}
                      onChange={(e) =>
                        setAddingIng((a) =>
                          a ? { ...a, priceSzt: e.target.value } : a,
                        )
                      }
                      className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-[11px] text-slate-200 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="shrink-0 text-[10px] text-slate-500">
                      {tString(t, "currency")}/{tString(t, "unit_pcs")}
                    </span>
                  </div>
                ) : addingIng.soldByWeight ? (
                  <div className="flex items-center justify-end gap-1">
                    <input
                      placeholder={tString(t, "price_input_ph")}
                      type="number"
                      min="0"
                      max="99999"
                      value={addingIng.priceKg}
                      onChange={(e) =>
                        setAddingIng((a) =>
                          a ? { ...a, priceKg: e.target.value } : a,
                        )
                      }
                      className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-[11px] text-slate-200 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="shrink-0 text-[10px] text-slate-500">
                      {tString(t, "currency")}/kg
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-1">
                    <input
                      placeholder={tString(t, "price_input_ph")}
                      type="number"
                      min="0"
                      max="99999"
                      value={addingIng.priceOpak}
                      onChange={(e) =>
                        setAddingIng((a) =>
                          a ? { ...a, priceOpak: e.target.value } : a,
                        )
                      }
                      className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-[11px] text-slate-200 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="shrink-0 text-[10px] text-slate-500">
                      {tString(t, "currency")} /
                    </span>
                    <input
                      placeholder={tString(t, "pkg_input_ph")}
                      type="number"
                      min="0"
                      max="99999"
                      value={addingIng.pkgWeight}
                      onChange={(e) =>
                        setAddingIng((a) =>
                          a ? { ...a, pkgWeight: e.target.value } : a,
                        )
                      }
                      className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-[11px] text-slate-200 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="shrink-0 text-[10px] text-slate-500">
                      {addingIng.unit === "szt"
                        ? tString(t, "unit_pcs")
                        : addingIng.unit}
                    </span>
                  </div>
                )}
              </div>
            )}
          </td>
          <td className="w-[60px] whitespace-nowrap text-center">
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => void confirmAddIng()}
                disabled={!addingIng.search.trim() || !addingIng.weight}
                className="cursor-pointer rounded bg-teal-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
              >
                {tString(t, "add_btn")}
              </button>
              <button
                type="button"
                onClick={() => setAddingIng(null)}
                className="cursor-pointer rounded bg-slate-600 px-2 py-1 text-xs text-slate-400"
              >
                {tString(t, "cancel")}
              </button>
            </div>
          </td>
        </tr>
      ) : (
        <tr
          className={`${ingStyle} cursor-pointer`}
          onClick={() => {
            initAdding(recipe.id);
            setEditingIngCell(null);
          }}
        >
          <td className={blStyle} colSpan={6}>
            <span className="text-xs font-semibold text-teal-400">
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
    setAddingProductFor,
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
  } = page;

  const inputClass =
    "rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-teal-600";
  const btnPrimary =
    "cursor-pointer rounded-md border-none bg-teal-600 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-teal-500 disabled:opacity-50";
  const btnSecondary =
    "cursor-pointer rounded-md border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-400 hover:bg-slate-600";

  const expandedCell =
    "bg-teal-950/30 border-y border-teal-600/40";

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 md:p-6">
        <h2 className="mb-4 text-lg font-bold text-slate-100">
          {tString(t, "add_recipe_title")}
        </h2>

        <section className="mb-5 rounded-lg border border-slate-700/60 bg-slate-900/30 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-teal-500">
            <span aria-hidden>💡</span>
            {tString(t, "search_inspiration")}
          </div>
          <div className="flex flex-wrap gap-3">
            {inspireLinks.map(({ href, domain, label }) => (
              <a
                key={domain}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:border-teal-600/50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                  alt=""
                  className="h-4 w-4"
                />
                <span>{label}</span>
              </a>
            ))}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <section className="mb-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-teal-500">
                <span aria-hidden>📄</span>
                {tString(t, "format_title")}
              </div>
              <ol className="space-y-2 text-sm text-slate-400">
                {[
                  <>
                    <strong>{tString(t, "recipe_name_lbl")}</strong>{" "}
                    {tString(t, "fmt_1_rest")}
                  </>,
                  tString(t, "fmt_2"),
                  tString(t, "fmt_3"),
                  tString(t, "fmt_4"),
                ].map((text, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-900/50 text-xs font-bold text-teal-400">
                      {i + 1}
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <textarea
                ref={textareaRef}
                className={`${inputClass} min-h-[180px] w-full resize-y`}
                value={pasteText}
                onChange={(e) => handlePasteChange(e.target.value)}
                maxLength={5000}
                placeholder={tString(t, "recipe_ph")}
              />
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-teal-600/50"
                  onClick={() => setRecipeHelpModalOpen(true)}
                  aria-label={tString(t, "how_to_recipe")}
                  title={tString(t, "how_to_recipe")}
                >
                  <span aria-hidden>💡</span>
                  {tString(t, "how_to_recipe")}
                </button>
                <div
                  className={`text-xs ${
                    pasteText.length > 4500 ? "text-amber-400" : "text-slate-500"
                  }`}
                >
                  {pasteText.length} / 5000
                </div>
              </div>
            </section>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/40">
            <div className="flex items-center gap-2 border-b border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200">
              <span aria-hidden>📋</span>
              {tString(t, "recipe_live_preview_title")}
            </div>

            {!parsed ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center text-sm text-slate-500">
                <span className="text-xl text-slate-600" aria-hidden>
                  ←
                </span>
                <p>{tString(t, "recipe_live_preview_empty")}</p>
              </div>
            ) : (
              <div className="space-y-4 p-4">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">
                    {tString(t, "recipe_name_lbl")}
                  </label>
                  <input
                    className={`${inputClass} w-full`}
                    value={parsed.name}
                    onChange={(e) =>
                      setParsed((p) => (p ? { ...p, name: e.target.value } : p))
                    }
                  />
                </div>

                <div
                  className={`rounded-lg border p-3 ${
                    parsed.category
                      ? "border-slate-700"
                      : "border-amber-600/50 bg-amber-950/10"
                  }`}
                >
                  <span className="mb-2 block text-xs font-semibold uppercase text-slate-500">
                    {tString(t, "meal_type_label")}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          parsed.category === cat.value
                            ? "border-teal-500 bg-teal-600/20 text-teal-400"
                            : "border-slate-600 text-slate-400 hover:border-slate-500"
                        }`}
                        onClick={() =>
                          setParsed((p) =>
                            p
                              ? {
                                  ...p,
                                  category:
                                    p.category === cat.value ? null : cat.value,
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
                    <span className="mt-2 block text-xs text-amber-400">
                      {tString(t, "select_meal_type")}
                    </span>
                  )}
                </div>

                <div
                  className={`rounded-lg border p-3 ${
                    parsed.servings && parseInt(parsed.servings, 10) >= 1
                      ? "border-slate-700"
                      : "border-amber-600/50 bg-amber-950/10"
                  }`}
                >
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    {tString(t, "recipe_servings_label")} *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    step="1"
                    className={`${inputClass} w-24`}
                    value={parsed.servings}
                    onChange={(e) =>
                      setParsed((p) =>
                        p ? { ...p, servings: e.target.value } : p,
                      )
                    }
                    placeholder="4"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    {tString(t, "recipe_servings_hint")}
                  </p>
                </div>

                <div className="text-sm font-semibold text-slate-300">
                  {tFormat2(
                    t,
                    "ingredients_lbl",
                    parsed.ingredients.filter((i) => i.product_id).length,
                    parsed.ingredients.length,
                  )}
                </div>

                {parsed.ingredients.length > 0 && (
                  <div
                    className="grid grid-cols-[1fr_auto_auto] gap-2 text-[10px] uppercase text-slate-500 sm:grid-cols-[1fr_80px_80px_1fr_auto]"
                    aria-hidden
                  >
                    <span>{tString(t, "col_amount")}</span>
                    <span className="hidden sm:block" />
                    <span className="hidden sm:block" />
                    <span className="col-span-2 sm:col-span-1">
                      {tString(t, "matched_product_col")}
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  {parsed.ingredients.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      {tString(t, "recipe_live_no_ingredients")}
                    </p>
                  ) : (
                    parsed.ingredients.map((ing, i) => (
                      <Fragment key={`${ing.rawName}-${i}`}>
                        <div
                          className={`rounded-lg border p-2 ${
                            ing.product_id
                              ? "border-teal-600/30 bg-teal-950/10"
                              : "border-slate-700 bg-slate-900/30"
                          } ${addingProductFor === i ? "ring-1 ring-teal-500/50" : ""}`}
                        >
                          <div
                            className="mb-2 truncate text-sm text-slate-200"
                            title={ing.rawName}
                          >
                            {ing.rawName}
                            {canonicalDiffersFromRaw(
                              ing.rawName,
                              ing.canonicalName,
                            ) && (
                              <small
                                className="ml-1 text-[10px] text-slate-500"
                                title={ing.canonicalName}
                              >
                                {tFormat(
                                  t,
                                  "canonical_match_hint",
                                  ing.canonicalName ?? "",
                                )}
                              </small>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="number"
                              className={`${inputClass} w-16 text-center`}
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
                              className={`${inputClass} w-16`}
                              value={ing.unit || "g"}
                              onChange={(e) =>
                                updateIngredient(i, "unit", e.target.value)
                              }
                              aria-label={tString(t, "unit_lbl")}
                            >
                              <option value="g">g</option>
                              <option value="ml">ml</option>
                              <option value="szt">
                                {tString(t, "unit_pcs")}
                              </option>
                            </select>
                            <select
                              className={`${inputClass} min-w-0 flex-1`}
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
                                className={`cursor-pointer rounded-full p-1 text-lg leading-none ${
                                  addingProductFor === i
                                    ? "bg-teal-600/30 text-teal-400"
                                    : "text-teal-500 hover:bg-slate-700"
                                }`}
                                title={tString(t, "add_to_products_btn")}
                                aria-label={tString(t, "add_to_products_btn")}
                                onClick={() => openQuickAdd(i, ing)}
                              >
                                +
                              </button>
                            ) : (
                              <span className="w-6" aria-hidden />
                            )}
                            <button
                              type="button"
                              className="cursor-pointer rounded p-1 text-slate-500 hover:bg-slate-700 hover:text-red-400"
                              onClick={() => removeIngredient(i)}
                              aria-label={tString(t, "delete")}
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        {addingProductFor === i && (
                          <div className="rounded-lg border border-slate-600 bg-slate-900/50 p-3">
                            <div className="mb-2 text-xs font-semibold text-slate-300">
                              {tString(t, "add_ing_new_product")}
                            </div>
                            <div className="mb-2">
                              <label className="mb-1 block text-[10px] uppercase text-slate-500">
                                {tString(t, "product_name_lbl")}
                              </label>
                              <input
                                className={`${inputClass} w-full`}
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
                            <div className="mb-2 flex flex-wrap gap-3">
                              <div className="min-w-[120px] flex-1">
                                <label className="mb-1 block text-[10px] uppercase text-slate-500">
                                  {quickForm.sold_by_weight
                                    ? tString(t, "price_per_kg_lbl")
                                    : tString(t, "price_per_opak_lbl")}
                                </label>
                                <input
                                  type="number"
                                  className={`${inputClass} w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
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
                                                parseFloat(e.target.value) || 0,
                                              ),
                                            ),
                                    }))
                                  }
                                  placeholder={tString(t, "pkg_price_ph")}
                                />
                              </div>
                              <div className="flex gap-1 self-end">
                                <button
                                  type="button"
                                  className={`cursor-pointer rounded px-2 py-1 text-xs font-semibold ${
                                    !quickForm.sold_by_weight
                                      ? "bg-teal-600 text-white"
                                      : "bg-slate-700 text-slate-400"
                                  }`}
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
                                  className={`cursor-pointer rounded px-2 py-1 text-xs font-semibold ${
                                    quickForm.sold_by_weight
                                      ? "bg-teal-600 text-white"
                                      : "bg-slate-700 text-slate-400"
                                  }`}
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
                            {!quickForm.sold_by_weight && (
                              <div className="mb-3">
                                <label className="mb-1 block text-[10px] uppercase text-slate-500">
                                  {tString(t, "pkg_qty_lbl")}
                                </label>
                                <input
                                  type="number"
                                  className={`${inputClass} mb-2 w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
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
                                                parseFloat(e.target.value) || 0,
                                              ),
                                            ),
                                    }))
                                  }
                                  placeholder={tString(t, "pkg_qty_ph")}
                                />
                                <div className="flex flex-wrap gap-1">
                                  {(["g", "kg", "ml", "l", "szt"] as const).map(
                                    (u) => (
                                      <button
                                        key={u}
                                        type="button"
                                        className={`cursor-pointer rounded px-2 py-1 text-xs ${
                                          quickForm.unit === u
                                            ? "bg-teal-600 font-bold text-white"
                                            : "bg-slate-700 text-slate-400"
                                        }`}
                                        onClick={() =>
                                          setQuickForm((f) => ({ ...f, unit: u }))
                                        }
                                      >
                                        {displayUnit(u)}
                                      </button>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className={btnPrimary}
                                onClick={() => void handleQuickAdd(i)}
                              >
                                {tString(t, "add_product_btn")}
                              </button>
                              <button
                                type="button"
                                className={btnSecondary}
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
                  <div className="rounded-lg border border-amber-600/30 bg-amber-950/10 p-3 text-xs text-slate-400">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-amber-400">
                      <span
                        className="inline-block h-2 w-2 rounded-sm bg-amber-500"
                        aria-hidden
                      />
                      {tString(t, "missing_product_hint_title")}
                    </div>
                    <ol className="list-decimal space-y-1 pl-4">
                      <li>{tString(t, "missing_product_hint_step1")}</li>
                      <li>
                        {tString(t, "missing_product_hint_step2_before")}{" "}
                        <span
                          className="inline-flex rounded bg-slate-700 px-1 text-teal-400"
                          aria-hidden
                        >
                          +
                        </span>{" "}
                        {tString(t, "missing_product_hint_step2_after")}
                      </li>
                    </ol>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => void handleSave()}
                  >
                    {tString(t, "save_recipe")}
                  </button>
                  <button
                    type="button"
                    className={btnSecondary}
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

      <RecipeHelpModal
        open={recipeHelpModalOpen}
        onClose={() => setRecipeHelpModalOpen(false)}
        t={t}
        nameLabel={tString(t, "recipe_name_lbl")}
        promptCopied={promptCopied}
        onCopyPrompt={handleCopyPrompt}
      />

      <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/40">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-700 px-4 py-3">
          <button
            type="button"
            className="cursor-pointer text-left text-base font-bold text-slate-100"
            onClick={() => setListOpen((o) => !o)}
          >
            {tString(t, "recipe_list_title")}
          </button>

          <button
            type="button"
            onClick={() =>
              selectionMode
                ? exitSelection()
                : (setSelectionMode(true), setExpanded(null))
            }
            className={`cursor-pointer whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-semibold transition ${
              selectionMode
                ? "border-teal-600 bg-teal-950/40 text-teal-400"
                : "border-slate-600 text-slate-500 hover:border-slate-500"
            }`}
          >
            {selectionMode
              ? tString(t, "deselect_label")
              : tString(t, "select_label")}
          </button>

          <button
            type="button"
            onClick={() => {
              if (selectionMode && selectedIds.size > 0) {
                handleDeleteSelected();
              } else if (!selectionMode) {
                handleDeleteAll();
              }
            }}
            disabled={selectionMode && selectedIds.size === 0}
            className={`cursor-pointer whitespace-nowrap rounded-md border border-slate-600 px-2.5 py-1 text-xs text-slate-500 transition hover:border-red-500 hover:text-red-400 disabled:cursor-default disabled:opacity-40`}
          >
            {selectionMode && selectedIds.size > 0
              ? tFormatN(t, "del_selected_recipes", selectedIds.size)
              : tString(t, "del_all_recipes")}
          </button>

          <button
            type="button"
            onClick={() => setListOpen((o) => !o)}
            className="ml-auto cursor-pointer text-teal-500"
            aria-label={listOpen ? "Collapse" : "Expand"}
          >
            <span
              className={`inline-block transition-transform ${listOpen ? "rotate-180" : ""}`}
            >
              ▼
            </span>
          </button>
        </div>

        {listOpen && (
          <div className="px-4 pb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tString(t, "search_recipe_ph")}
              className={`${inputClass} mb-3 mt-3 w-full`}
            />

            <div className="mb-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCategoryFilter(null)}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition ${
                  !categoryFilter
                    ? "border-slate-400 bg-slate-600 font-bold text-slate-100"
                    : "border-slate-600 text-slate-500"
                }`}
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
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition ${
                    categoryFilter === cat.value
                      ? "border-teal-600 bg-teal-600/15 font-bold text-teal-400"
                      : "border-slate-600 text-slate-500"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {recipeList.length === 0 && (
              <p className="text-center text-slate-500">
                {tString(t, "no_recipes_add")}
              </p>
            )}
            {recipeList.length > 0 && search.trim() && filteredRecipes.length === 0 && (
              <p className="text-center italic text-slate-500">
                {tFormat(t, "recipe_not_found", search)}
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-separate border-spacing-y-1">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th colSpan={2} className="w-[40%] pb-1 font-semibold">
                      {tString(t, "recipe_col_name")}
                    </th>
                    <th className="pb-1 text-center font-semibold">
                      {tString(t, "recipe_col_kcalmacro")}
                    </th>
                    <th className="w-[90px] pb-1 text-center font-semibold">
                      {tString(t, "recipe_col_meal")}
                    </th>
                    <th className="pb-1 text-right font-semibold">
                      {tString(t, "recipe_col_price")}
                    </th>
                    <th className="w-[60px] pb-1 text-center font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {filteredRecipes.slice(0, visibleCount).map((r) => {
                    const isExpanded = expanded === r.id;
                    const rowHighlight = isExpanded
                      ? `${expandedCell} border-l-[3px] border-l-teal-600`
                      : selectedIds.has(r.id)
                        ? "bg-indigo-950/20"
                        : "";

                    return (
                      <Fragment key={r.id}>
                        <tr
                          className={`cursor-pointer ${rowHighlight}`}
                          onClick={() => handleExpandRow(r.id)}
                        >
                          <td colSpan={2} className="rounded-l-md px-2 py-2">
                            <div className="flex items-center gap-2">
                              {selectionMode && (
                                <span
                                  className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                    selectedIds.has(r.id)
                                      ? "border-indigo-500 bg-indigo-500 text-white"
                                      : "border-slate-600"
                                  }`}
                                >
                                  {selectedIds.has(r.id) && (
                                    <span className="text-[10px]">✓</span>
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
                                className={`cursor-pointer border-none bg-transparent p-0 text-xl leading-none ${
                                  r.is_favorite
                                    ? "text-yellow-400"
                                    : "text-transparent [-webkit-text-stroke:1.5px_#6b7280]"
                                }`}
                              >
                                ★
                              </button>
                              {editingName?.id === r.id ? (
                                <div
                                  className="flex items-center gap-1"
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
                                    className="w-52 rounded border border-teal-600 bg-slate-900 px-2 py-0.5 text-sm font-semibold text-slate-100"
                                  />
                                  <button
                                    type="button"
                                    className="cursor-pointer rounded bg-teal-600 px-2 py-0.5 text-xs text-white"
                                    onClick={() => void handleSaveName(r.id)}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    type="button"
                                    className="cursor-pointer rounded bg-slate-600 px-2 py-0.5 text-xs text-slate-400"
                                    onClick={() => setEditingName(null)}
                                  >
                                    ✗
                                  </button>
                                </div>
                              ) : (
                                <strong
                                  className="cursor-pointer text-sm text-slate-100"
                                  title={tString(t, "click_to_edit")}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setEditingName({ id: r.id, text: r.name });
                                  }}
                                >
                                  {r.name}
                                </strong>
                              )}
                            </div>
                          </td>
                          <td
                            className={`px-2 py-2 text-center text-xs whitespace-nowrap ${isExpanded ? expandedCell : ""}`}
                          >
                            {r.total_kcal > 0 ? (
                              <span className="text-slate-400">
                                <span className="font-semibold text-slate-200">
                                  {r.total_kcal}
                                </span>{" "}
                                kcal · {tString(t, "macro_p")}
                                {r.total_protein} {tString(t, "macro_f")}
                                {r.total_fat} {tString(t, "macro_c")}
                                {r.total_carbs}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td
                            className={`relative px-2 py-2 text-center ${isExpanded ? expandedCell : ""}`}
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
                                className="relative inline-block"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="absolute left-1/2 top-full z-[300] mt-1 min-w-[110px] -translate-x-1/2 rounded-lg border border-slate-600 bg-slate-800 py-1 shadow-xl">
                                  <div
                                    onClick={() => saveCategory(r.id, null)}
                                    className="cursor-pointer px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-700"
                                  >
                                    {tString(t, "no_type_label")}
                                  </div>
                                  {categories.map((cat) => (
                                    <div
                                      key={cat.value}
                                      onClick={() =>
                                        saveCategory(r.id, cat.value)
                                      }
                                      className="cursor-pointer px-2.5 py-1 text-xs font-semibold text-teal-400 hover:bg-slate-700"
                                    >
                                      {cat.label}
                                    </div>
                                  ))}
                                </div>
                                <span className="cursor-pointer text-[11px] font-semibold text-teal-400">
                                  {r.category
                                    ? catMap[r.category]?.label
                                    : tString(t, "no_type")}
                                </span>
                              </div>
                            ) : (
                              <span
                                className={`cursor-pointer text-[11px] ${
                                  r.category
                                    ? "font-semibold text-teal-400"
                                    : "text-slate-600"
                                }`}
                                title={tString(t, "click_change_meal")}
                              >
                                {r.category
                                  ? catMap[r.category]?.label
                                  : tString(t, "no_type")}
                              </span>
                            )}
                          </td>
                          <td
                            className={`px-2 py-2 text-right whitespace-nowrap ${isExpanded ? expandedCell : ""}`}
                          >
                            <span className="font-semibold text-teal-500">
                              {r.total_cost.toFixed(2)} {tString(t, "currency")}
                            </span>
                            {r.source_url && (
                              <div className="mt-0.5">
                                <a
                                  href={r.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] font-semibold text-slate-200 no-underline hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {tString(t, "see_recipe")}
                                </a>
                              </div>
                            )}
                          </td>
                          <td
                            className={`rounded-r-md px-2 py-2 text-right ${isExpanded ? `${expandedCell} border-r border-teal-600/40` : ""}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="cursor-pointer rounded border border-red-900/50 bg-red-950/30 px-2 py-1 text-xs font-semibold text-red-400 hover:bg-red-950/50"
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
                        className="py-2 text-center text-xs text-slate-600"
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
