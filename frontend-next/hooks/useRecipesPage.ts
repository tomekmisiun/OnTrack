"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/contexts/ToastContext";
import { ApiError } from "@/lib/api/errors";
import { listProducts, createProduct, updateProduct } from "@/lib/api/products";
import {
  createRecipe,
  deleteAllRecipes,
  deleteRecipe,
  fetchRecipeImage,
  getRecipe,
  listRecipes,
  toggleFavorite,
  updateCategory,
  updateRecipe,
} from "@/lib/api/recipes";
import type { TranslationKey } from "@/lib/i18n/translations";
import { tFormat, tFormatArgs, tFormatN, tString } from "@/lib/i18n/translate";
import { buildParsedFromText } from "@/lib/recipes/parseRecipeText";
import { fuzzySearch } from "@/lib/recipes/search";
import { fetchProductMacros } from "@/lib/products/macroLookup";
import { apiErrorMessage } from "@/lib/products/productPage";
import type {
  AddingIngredientState,
  EditingIngCell,
  ParsedRecipe,
  QuickProductForm,
  Recipe,
  RecipeCategory,
  RecipeSummary,
} from "@/types/recipe";
import { CAT_COLORS } from "@/types/recipe";
import type { Product } from "@/types/product";

export const EMPTY_QUICK_FORM: QuickProductForm = {
  name: "",
  package_weight: "100",
  package_price: "",
  unit: "g",
  sold_by_weight: false,
};

export const PROMPT_NAME_MARK = "{{name}}";

export function recipePromptPlainText(
  t: (key: TranslationKey) => unknown,
): string {
  return tString(t, "recipe_prompt").split(PROMPT_NAME_MARK).join(
    tString(t, "recipe_name_lbl"),
  );
}

export function useRecipesPage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { showError, showSuccess, showConfirm } = useToast();

  const [recipeList, setRecipeList] = useState<RecipeSummary[]>([]);
  const [productList, setProductList] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<Recipe | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null);
  const [editingName, setEditingName] = useState<{ id: number; text: string } | null>(null);
  const [editingIngCell, setEditingIngCell] = useState<EditingIngCell | null>(null);
  const [addingIng, setAddingIng] = useState<AddingIngredientState | null>(null);
  const [addingProductFor, setAddingProductFor] = useState<number | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const [quickForm, setQuickForm] = useState<QuickProductForm>(EMPTY_QUICK_FORM);
  const [listOpen, setListOpen] = useState(true);
  const [recipeHelpModalOpen, setRecipeHelpModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<{ id: number; value: string } | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [visibleCount, setVisibleCount] = useState(50);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sentinelRef = useRef<HTMLTableRowElement>(null);

  const displayUnit = useCallback(
    (u: string) => (u === "szt" ? tString(t, "unit_pcs") : u),
    [t],
  );

  const categories = useMemo(
    () =>
      (
        [
          "breakfast",
          "lunch",
          "dinner",
          "snack",
          "dessert",
        ] as RecipeCategory[]
      ).map((value) => ({
        value,
        label: tString(t, `cat_${value}` as never),
        color: CAT_COLORS[value] ?? "#6b7280",
      })),
    [t],
  );

  const catMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.value, c])),
    [categories],
  );

  const inspireLinks =
    lang === "en"
      ? [
          {
            href: "https://mealpreponfleek.com/",
            domain: "mealpreponfleek.com",
            label: "mealpreponfleek.com",
          },
          {
            href: "https://www.allrecipes.com/",
            domain: "allrecipes.com",
            label: "allrecipes.com",
          },
          {
            href: "https://www.bbc.co.uk/food/recipes",
            domain: "bbc.co.uk",
            label: "bbc.co.uk/food",
          },
        ]
      : [
          {
            href: "https://aniagotuje.pl/",
            domain: "aniagotuje.pl",
            label: "aniagotuje.pl",
          },
          {
            href: "https://www.przepisy.pl/",
            domain: "przepisy.pl",
            label: "przepisy.pl",
          },
          {
            href: "https://www.kwestiasmaku.com/",
            domain: "kwestiasmaku.com",
            label: "kwestiasmaku.com",
          },
        ];

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const loadRecipes = useCallback(async () => {
    try {
      setRecipeList(await listRecipes());
    } catch {
      showError(tString(t, "err_load_recipes_list"));
    }
  }, [showError, t]);

  const loadExpandedDetail = useCallback(async (id: number) => {
    try {
      setExpandedDetail(await getRecipe(id));
    } catch {
      /* ignore */
    }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const page = await listProducts({ limit: 100 });
      setProductList(page.items);
    } catch {
      /* ignore */
    }
  }, []);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    void loadRecipes();
    void loadProducts();
  }, [user?.lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pasteText.trim()) {
      setParsed(null);
      setAddingProductFor(null);
      return;
    }
    setParsed((prev) => buildParsedFromText(pasteText, productList, prev));
  }, [pasteText, productList]);

  const filteredRecipes = useMemo(() => {
    const q = search.trim();
    let list = q
      ? recipeList.filter((r) => fuzzySearch(q, r.name))
      : recipeList;
    if (categoryFilter) {
      list = list.filter((r) => r.category === categoryFilter);
    }
    return [...list].sort(
      (a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0),
    );
  }, [recipeList, search, categoryFilter]);

  useEffect(() => {
    setVisibleCount(50);
  }, [search]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((v) => Math.min(v + 50, filteredRecipes.length));
        }
      },
      { rootMargin: "300px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [filteredRecipes.length]);

  const updateIngredient = useCallback(
    (i: number, field: keyof ParsedRecipe["ingredients"][0], val: unknown) => {
      setParsed((prev) => {
        if (!prev) return prev;
        const u = [...prev.ingredients];
        const current = u[i];
        if (!current) return prev;
        u[i] = { ...current, [field]: val };
        return { ...prev, ingredients: u };
      });
    },
    [],
  );

  const removeIngredient = useCallback((i: number) => {
    setParsed((prev) =>
      prev
        ? { ...prev, ingredients: prev.ingredients.filter((_, idx) => idx !== i) }
        : prev,
    );
  }, []);

  const handleQuickAdd = useCallback(
    async (ingIndex: number) => {
      if (!quickForm.name.trim() || !quickForm.package_price) {
        showError(tString(t, "err_fill_fields"));
        return;
      }
      const sbw = !!quickForm.sold_by_weight;
      let unit = sbw ? "g" : quickForm.unit;
      let pkgW = sbw ? 1000 : parseFloat(quickForm.package_weight) || 100;
      if (!sbw && unit === "kg") {
        unit = "g";
        pkgW = Math.min(99999, pkgW * 1000);
      }
      if (!sbw && unit === "l") {
        unit = "ml";
        pkgW = Math.min(99999, pkgW * 1000);
      }
      const pkgPrice = parseFloat(quickForm.package_price) || 0;
      const unitPrice =
        unit === "szt" ? pkgPrice / pkgW : (pkgPrice / pkgW) * 100;
      const name = quickForm.name.trim();
      const duplicate = productList.find(
        (p) => p.name.toLowerCase() === name.toLowerCase(),
      );
      if (duplicate) {
        showError(tFormat(t, "product_exists_err", duplicate.name));
        return;
      }
      try {
        const newProduct = await createProduct({
          name,
          package_weight: pkgW,
          price: unitPrice,
          unit,
          sold_by_weight: sbw,
        });
        updateIngredient(ingIndex, "product_id", newProduct.id);
        setAddingProductFor(null);
        showSuccess(tFormat(t, "product_adding", name));
        const { macros } = await fetchProductMacros(name, lang);
        if (macros) await updateProduct(newProduct.id, macros);
        await loadProducts();
        showSuccess(tFormatArgs(t, "product_added_macro", name, !!macros));
      } catch {
        showError(tString(t, "err_fill_fields"));
      }
    },
    [
      quickForm,
      productList,
      showError,
      t,
      updateIngredient,
      showSuccess,
      lang,
      loadProducts,
    ],
  );

  const handleSave = useCallback(async () => {
    if (!parsed?.name) {
      showError(tString(t, "err_no_name"));
      return;
    }
    if (!parsed.category) {
      showError(tString(t, "select_meal_type"));
      return;
    }
    const servings = parseInt(parsed.servings, 10);
    if (!servings || servings < 1 || servings > 999) {
      showError(tString(t, "err_no_servings"));
      return;
    }
    const valid = parsed.ingredients.filter((i) => i.product_id && i.weight > 0);
    if (!valid.length) {
      showError(tString(t, "err_no_ingredients"));
      return;
    }
    try {
      const created = await createRecipe({
        name: parsed.name,
        category: parsed.category || null,
        servings,
        ingredients: valid.map((i) => ({
          product_id: parseInt(String(i.product_id), 10),
          weight: i.weight,
        })),
      });
      setParsed(null);
      setPasteText("");
      setAddingProductFor(null);
      showSuccess(tString(t, "recipe_saved"));
      void loadRecipes();
      void fetchRecipeImage(created.id)
        .then(() => loadRecipes())
        .catch(() => {});
    } catch (e) {
      showError(
        e instanceof ApiError
          ? apiErrorMessage(e, tString(t, "err_save_recipe"))
          : tString(t, "err_save_recipe"),
      );
    }
  }, [parsed, showError, t, showSuccess, loadRecipes]);

  const saveCategory = useCallback(
    async (id: number, category: string | null) => {
      try {
        await updateCategory(id, category);
        setRecipeList((list) =>
          list.map((r) => (r.id === id ? { ...r, category } : r)),
        );
      } catch {
        showError(tString(t, "category_error"));
      }
      setEditingCategory(null);
    },
    [showError, t],
  );

  const handleSaveName = useCallback(
    async (id: number) => {
      const name = editingName?.text.trim();
      if (!name) return;
      if (name.length > 200) {
        showError(tString(t, "recipe_name_max"));
        return;
      }
      try {
        await updateRecipe(id, { name });
        setEditingName(null);
        showSuccess(tString(t, "name_saved_label"));
        void loadRecipes();
      } catch (e) {
        showError(
          e instanceof ApiError
            ? apiErrorMessage(e, tString(t, "save_error_label"))
            : tString(t, "save_error_label"),
        );
      }
    },
    [editingName, showError, t, showSuccess, loadRecipes],
  );

  const handleDeleteSelected = useCallback(() => {
    showConfirm({
      title: tString(t, "del_selected_recipes_title"),
      message: tFormatN(t, "confirm_del_selected_recipes", selectedIds.size),
      confirmLabel: tString(t, "delete"),
      onConfirm: async () => {
        try {
          await Promise.all([...selectedIds].map((id) => deleteRecipe(id)));
          showSuccess(tFormatN(t, "recipes_deleted", selectedIds.size));
          exitSelection();
          void loadRecipes();
        } catch {
          showError(tString(t, "del_during_err"));
        }
      },
    });
  }, [
    showConfirm,
    t,
    selectedIds,
    showSuccess,
    exitSelection,
    loadRecipes,
    showError,
  ]);

  const handleDeleteAll = useCallback(() => {
    showConfirm({
      title: tString(t, "del_all_recipes_title"),
      message: tFormatN(t, "confirm_del_all_recipes", recipeList.length),
      confirmLabel: tString(t, "del_all_recipes"),
      onConfirm: async () => {
        try {
          await deleteAllRecipes();
          showSuccess(tString(t, "all_recipes_deleted"));
          void loadRecipes();
        } catch {
          showError(tString(t, "err_load_recipes_list"));
        }
      },
    });
  }, [showConfirm, t, recipeList.length, showSuccess, loadRecipes, showError]);

  const handleDeleteRecipe = useCallback(
    (r: RecipeSummary) => {
      showConfirm({
        title: tString(t, "confirm_del_recipe"),
        message: tFormat(t, "delete_confirm_recipe", r.name),
        confirmLabel: tString(t, "btn_delete"),
        onConfirm: async () => {
          try {
            await deleteRecipe(r.id);
            showSuccess(tString(t, "recipe_deleted"));
            void loadRecipes();
          } catch {
            showError(tString(t, "err_save_recipe"));
          }
        },
      });
    },
    [showConfirm, t, showSuccess, loadRecipes, showError],
  );

  const handleToggleFavorite = useCallback(
    async (id: number, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await toggleFavorite(id);
        void loadRecipes();
      } catch {
        showError(tString(t, "err_load_recipes_list"));
      }
    },
    [loadRecipes, showError, t],
  );

  const handleExpandRow = useCallback(
    (id: number) => {
      if (selectionMode) {
        toggleSelect(id);
        return;
      }
      const next = expanded === id ? null : id;
      setExpanded(next);
      if (next) void loadExpandedDetail(next);
      else setExpandedDetail(null);
    },
    [selectionMode, expanded, toggleSelect, loadExpandedDetail],
  );

  const handlePasteChange = useCallback(
    (value: string) => {
      setPasteText(value.slice(0, 5000));
      resizeTextarea();
    },
    [resizeTextarea],
  );

  const handleClearPaste = useCallback(() => {
    setPasteText("");
    setParsed(null);
    setAddingProductFor(null);
  }, []);

  const handleCopyPrompt = useCallback(() => {
    void navigator.clipboard.writeText(recipePromptPlainText(t));
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  }, [t]);

  const openQuickAdd = useCallback(
    (i: number, ing: ParsedRecipe["ingredients"][0]) => {
      if (addingProductFor === i) {
        setAddingProductFor(null);
        return;
      }
      setAddingProductFor(i);
      setQuickForm({
        name: ing.canonicalName || ing.rawName,
        package_weight: "100",
        package_price: "",
        unit: "g",
        sold_by_weight: false,
      });
    },
    [addingProductFor],
  );

  const saveIngMacro = useCallback(
    async (recipeId: number, ing: Recipe["ingredients"][0], vals: NonNullable<EditingIngCell["vals"]>) => {
      const toN = (v: string) => (v === "" ? null : parseFloat(v) || 0);
      try {
        await updateProduct(ing.product_id, {
          kcal: toN(vals.kcal),
          protein: toN(vals.protein),
          fat: toN(vals.fat),
          carbs: toN(vals.carbs),
        });
        await loadExpandedDetail(recipeId);
      } catch {
        showError(tString(t, "err_save_notes"));
      }
      setEditingIngCell(null);
    },
    [loadExpandedDetail, showError, t],
  );

  const saveIngWeight = useCallback(
    async (
      recipeId: number,
      ings: Recipe["ingredients"],
      ing: Recipe["ingredients"][0],
      weight: string,
    ) => {
      if (!weight || Number.isNaN(parseFloat(weight))) {
        setEditingIngCell(null);
        return;
      }
      try {
        await updateRecipe(recipeId, {
          ingredients: ings.map((x) => ({
            product_id: x.product_id,
            weight: x.id === ing.id ? parseFloat(weight) : x.weight,
          })),
        });
        await loadExpandedDetail(recipeId);
      } catch {
        showError(tString(t, "err_save_recipe"));
      }
      setEditingIngCell(null);
    },
    [loadExpandedDetail, showError, t],
  );

  const saveIngName = useCallback(
    async (recipeId: number, ing: Recipe["ingredients"][0], name: string) => {
      if (!name.trim()) {
        setEditingIngCell(null);
        return;
      }
      try {
        await updateProduct(ing.product_id, { name: name.trim() });
        await loadExpandedDetail(recipeId);
      } catch {
        showError(tString(t, "err_save_notes"));
      }
      setEditingIngCell(null);
    },
    [loadExpandedDetail, showError, t],
  );

  const deleteIng = useCallback(
    async (recipeId: number, ings: Recipe["ingredients"], ing: Recipe["ingredients"][0]) => {
      try {
        await updateRecipe(recipeId, {
          ingredients: ings
            .filter((x) => x.id !== ing.id)
            .map((x) => ({ product_id: x.product_id, weight: x.weight })),
        });
        await loadExpandedDetail(recipeId);
      } catch {
        showError(tString(t, "err_save_recipe"));
      }
    },
    [loadExpandedDetail, showError, t],
  );

  const initAdding = useCallback((recipeId: number) => {
    setAddingIng({
      recipeId,
      search: "",
      product: null,
      weight: "",
      showDrop: false,
      kcal: "",
      protein: "",
      fat: "",
      carbs: "",
      unit: "g",
      soldByWeight: false,
      priceOpak: "",
      pkgWeight: "",
      priceKg: "",
      priceSzt: "",
    });
  }, []);

  const confirmAddIng = useCallback(async () => {
    const a = addingIng;
    if (!a || !a.weight || Number.isNaN(parseFloat(a.weight))) return;
    const ings = expandedDetail?.ingredients;
    if (!expandedDetail || !ings) return;
    let pid = a.product?.id;
    try {
      if (!pid) {
        const toN = (v: string) => (v === "" ? null : parseFloat(v) || 0);
        let price = 0;
        const pkgW = parseFloat(a.pkgWeight) || 100;
        if (a.unit === "szt") price = parseFloat(a.priceSzt) || 0;
        else if (a.soldByWeight) price = (parseFloat(a.priceKg) || 0) / 10;
        else price = pkgW > 0 ? (parseFloat(a.priceOpak) || 0) / (pkgW / 100) : 0;
        const newProduct = await createProduct({
          name: a.search.trim(),
          package_weight: pkgW,
          price,
          unit: a.unit,
          sold_by_weight: a.soldByWeight,
          kcal: toN(a.kcal),
          protein: toN(a.protein),
          fat: toN(a.fat),
          carbs: toN(a.carbs),
        });
        pid = newProduct.id;
      } else if (
        a.kcal !== "" ||
        a.protein !== "" ||
        a.fat !== "" ||
        a.carbs !== ""
      ) {
        const toN = (v: string) => (v === "" ? null : parseFloat(v) || 0);
        await updateProduct(pid, {
          kcal: toN(a.kcal),
          protein: toN(a.protein),
          fat: toN(a.fat),
          carbs: toN(a.carbs),
        });
      }
      await updateRecipe(a.recipeId, {
        ingredients: [
          ...ings.map((x) => ({ product_id: x.product_id, weight: x.weight })),
          { product_id: pid, weight: parseFloat(a.weight) },
        ],
      });
      await loadExpandedDetail(a.recipeId);
      setAddingIng(null);
      void loadProducts();
    } catch {
      showError(tString(t, "err_save_recipe"));
    }
  }, [addingIng, expandedDetail, loadExpandedDetail, loadProducts, showError, t]);

  return {
    t,
    lang,
    recipeList,
    productList,
    search,
    setSearch,
    expanded,
    setExpanded,
    expandedDetail,
    pasteText,
    parsed,
    setParsed,
    editingName,
    setEditingName,
    editingIngCell,
    setEditingIngCell,
    addingIng,
    setAddingIng,
    addingProductFor,
    setAddingProductFor,
    promptCopied,
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
    categories,
    catMap,
    inspireLinks,
    textareaRef,
    sentinelRef,
    displayUnit,
    toggleSelect,
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
    saveIngMacro,
    saveIngWeight,
    saveIngName,
    deleteIng,
    initAdding,
    confirmAddIng,
    showConfirm,
  };
}
