"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/contexts/ToastContext";
import {
  applyImportPrices,
  parseImportAI,
  parseImportFree,
} from "@/lib/api/import";
import { ApiError } from "@/lib/api/errors";
import {
  createProduct,
  customizeProduct,
  deleteAllProducts,
  deleteProduct,
  listProducts,
  updateProduct,
} from "@/lib/api/products";
import { fetchProductMacros } from "@/lib/products/macroLookup";
import { parseProductText } from "@/lib/products/parseProductText";
import {
  apiErrorMessage,
  PRODUCT_PAGE_SIZE,
} from "@/lib/products/productPage";
import {
  clamp,
  numClamp,
  toPackagePrice,
  toUnitPrice,
} from "@/lib/products/pricing";
import { tFormat, tFormatArgs, tFormatN, tString } from "@/lib/i18n/translate";
import {
  parseProduct,
  type ImportItem,
  type ImportRawItem,
  type Product,
  type ProductEditForm,
  type ProductForm,
} from "@/types/product";

export const EMPTY_FORM: ProductForm = {
  name: "",
  package_weight: "",
  package_price: "",
  unit: "g",
  sold_by_weight: false,
};

function mapImportItem(item: ImportRawItem): ImportItem {
  return {
    ...item,
    selected: !!item.matched_product,
    price: item.receipt_price != null ? String(item.receipt_price) : "",
    weight: item.receipt_quantity != null ? String(item.receipt_quantity) : "",
    unit: item.receipt_unit || "g",
    _unitPrice: item.suggested_price,
    sold_by_weight: false,
  };
}

function parseImportRawItem(data: unknown): ImportRawItem | null {
  if (typeof data !== "object" || data === null) return null;
  const row = data as Record<string, unknown>;
  if (typeof row.receipt_name !== "string") return null;

  let matched: Product | null = null;
  if (row.matched_product !== null && row.matched_product !== undefined) {
    matched = parseProduct(row.matched_product);
  }

  return {
    receipt_name: row.receipt_name,
    receipt_price:
      typeof row.receipt_price === "number" ? row.receipt_price : null,
    receipt_quantity:
      typeof row.receipt_quantity === "number" ? row.receipt_quantity : null,
    receipt_unit:
      typeof row.receipt_unit === "string" ? row.receipt_unit : undefined,
    matched_product: matched,
    suggested_price:
      typeof row.suggested_price === "number" ? row.suggested_price : null,
  };
}

export function isImageFile(file: File | null): boolean {
  return !!file && /\.(jpe?g|png|webp)$/i.test(file.name);
}

export function isTextFile(file: File | null): boolean {
  return !!file && /\.(txt|csv)$/i.test(file.name);
}

export function useProductsPage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { showError, showSuccess, showToast: globalToast, showConfirm } =
    useToast();

  const [productList, setProductList] = useState<Product[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [editSourceId, setEditSourceId] = useState<number | null>(null);
  const [editIsSystem, setEditIsSystem] = useState(false);
  const [editForm, setEditForm] = useState<ProductEditForm>({
    ...EMPTY_FORM,
    kcal: "",
    protein: "",
    fat: "",
    carbs: "",
  });
  const [lookingUp, setLookingUp] = useState<number | null>(null);
  const [importItems, setImportItems] = useState<ImportItem[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [remainingImports, setRemainingImports] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const [importHelpModalOpen, setImportHelpModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [promptCopied, setPromptCopied] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLTableRowElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const productListRef = useRef(productList);
  productListRef.current = productList;

  const loadProducts = useCallback(
    async ({ reset = true, q = search }: { reset?: boolean; q?: string } = {}) => {
      const offset = reset ? 0 : productListRef.current.length;
      setListLoading(true);
      try {
        const trimmed = (q || "").trim();
        const page = await listProducts({
          q: trimmed || undefined,
          limit: PRODUCT_PAGE_SIZE,
          offset,
        });
        setProductTotal(page.total);
        setProductList((prev) =>
          reset ? page.items : [...prev, ...page.items],
        );
      } catch {
        showError(tString(t, "err_load_products"));
      } finally {
        setListLoading(false);
      }
    },
    [search, showError, t],
  );

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

  const handleDeleteSelected = useCallback(() => {
    const editableIds = [...selectedIds].filter((id) => {
      const p = productList.find((row) => row.id === id);
      return p?.is_editable;
    });
    if (!editableIds.length) return;
    showConfirm({
      title: tString(t, "del_sel_products_title"),
      message: tFormatN(t, "confirm_del_selected_products", editableIds.length),
      confirmLabel: tString(t, "btn_delete"),
      onConfirm: async () => {
        try {
          await Promise.all(editableIds.map((id) => deleteProduct(id)));
          showSuccess(tFormatN(t, "products_deleted", editableIds.length));
          exitSelection();
          void loadProducts({ reset: true });
        } catch (e) {
          showError(apiErrorMessage(e, tString(t, "del_during_err")));
        }
      },
    });
  }, [
    selectedIds,
    productList,
    showConfirm,
    t,
    showSuccess,
    exitSelection,
    loadProducts,
    showError,
  ]);

  useEffect(() => {
    void loadProducts({ reset: true });
  }, [user?.lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(
      () => void loadProducts({ reset: true, q: search }),
      300,
    );
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          !listLoading &&
          productList.length < productTotal
        ) {
          void loadProducts({ reset: false });
        }
      },
      { rootMargin: "300px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [productList.length, productTotal, listLoading, search, loadProducts]);

  const handlePasteChange = useCallback((txt: string) => {
    const sliced = txt.slice(0, 500);
    setPasteText(sliced);
    const parsed = parseProductText(sliced);
    if (parsed) setForm((f) => ({ ...f, ...parsed }));
    else if (!sliced.trim()) setForm(EMPTY_FORM);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.name || !form.package_price) {
      showError(tString(t, "err_fill_fields"));
      return;
    }
    if (!form.sold_by_weight && !form.package_weight) {
      showError(tString(t, "err_fill_fields"));
      return;
    }
    const sbw = !!form.sold_by_weight;
    let unit = sbw ? "g" : form.unit;
    let pkgW = sbw ? 1000 : clamp(form.package_weight, 0.001, 99999);
    if (unit === "kg") {
      unit = "g";
      pkgW = Math.min(99999, pkgW * 1000);
    }
    if (unit === "l") {
      unit = "ml";
      pkgW = Math.min(99999, pkgW * 1000);
    }
    const pkgPrice = clamp(form.package_price, 0, 99999);
    const productName = form.name;
    try {
      const created = await createProduct({
        name: form.name,
        package_weight: pkgW,
        price: Math.min(99999, toUnitPrice(pkgPrice, pkgW, unit)),
        unit,
        sold_by_weight: sbw,
      });
      setForm(EMPTY_FORM);
      setPasteText("");
      showSuccess(tFormat(t, "product_adding", productName));
      const { macros } = await fetchProductMacros(productName, lang);
      if (macros) {
        await updateProduct(created.id, macros);
        showSuccess(tFormatArgs(t, "product_added_macro", productName, true));
      } else {
        showError(tFormat(t, "err_macro_not_found", productName));
      }
      void loadProducts({ reset: true });
    } catch (e) {
      if (e instanceof ApiError) {
        showError(apiErrorMessage(e, tString(t, "err_fill_fields")));
      } else {
        showError(tString(t, "err_fill_fields"));
      }
    }
  }, [form, showError, t, showSuccess, lang, loadProducts]);

  const startEdit = useCallback((p: Product) => {
    if (!p.is_editable && !p.is_system) return;
    setEditId(p.id);
    setEditSourceId(p.is_system ? p.id : p.id);
    setEditIsSystem(!!p.is_system);
    setEditForm({
      name: p.name,
      package_weight: String(p.package_weight),
      package_price: toPackagePrice(
        p.price,
        p.package_weight,
        p.unit || "g",
      ).toFixed(2),
      unit: p.unit || "g",
      sold_by_weight: !!p.sold_by_weight,
      kcal: p.kcal ?? "",
      protein: p.protein ?? "",
      fat: p.fat ?? "",
      carbs: p.carbs ?? "",
    });
  }, []);

  const handleSaveEdit = useCallback(async () => {
    const sbw = !!editForm.sold_by_weight;
    let unit = sbw ? "g" : editForm.unit;
    let pkgW = sbw ? 1000 : clamp(editForm.package_weight, 0.001, 99999);
    if (unit === "kg") {
      unit = "g";
      pkgW = Math.min(99999, pkgW * 1000);
    }
    if (unit === "l") {
      unit = "ml";
      pkgW = Math.min(99999, pkgW * 1000);
    }
    const pkgPrice = clamp(editForm.package_price, 0, 99999);
    try {
      const payload = {
        name: editForm.name,
        package_weight: pkgW,
        price: Math.min(99999, toUnitPrice(pkgPrice, pkgW, unit)),
        unit,
        sold_by_weight: sbw,
        kcal: editForm.kcal !== "" ? parseFloat(String(editForm.kcal)) : null,
        protein:
          editForm.protein !== "" ? parseFloat(String(editForm.protein)) : null,
        fat: editForm.fat !== "" ? parseFloat(String(editForm.fat)) : null,
        carbs:
          editForm.carbs !== "" ? parseFloat(String(editForm.carbs)) : null,
      };
      if (editIsSystem && editSourceId != null) {
        await customizeProduct(editSourceId, payload);
        showSuccess(tString(t, "product_customized"));
      } else if (editId != null) {
        await updateProduct(editId, payload);
        showSuccess(tString(t, "save_changes_label"));
      }
      setEditId(null);
      setEditIsSystem(false);
      void loadProducts({ reset: true });
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        showError(tString(t, "err_cannot_modify_system"));
      } else {
        showError(apiErrorMessage(e, tString(t, "save_btn")));
      }
    }
  }, [
    editForm,
    editIsSystem,
    editSourceId,
    editId,
    showSuccess,
    t,
    loadProducts,
    showError,
  ]);

  const handleAutoFill = useCallback(async () => {
    if (!editForm.name) return;
    setLookingUp(editId);
    try {
      const { macros } = await fetchProductMacros(editForm.name, lang);
      if (macros) {
        setEditForm((f) => ({
          ...f,
          kcal: macros.kcal,
          protein: macros.protein,
          fat: macros.fat,
          carbs: macros.carbs,
        }));
      } else {
        showError(tFormat(t, "err_macro_not_found", editForm.name));
      }
    } catch {
      showError(tString(t, "err_macro_lookup"));
    } finally {
      setLookingUp(null);
    }
  }, [editForm.name, editId, lang, showError, t]);

  const handleDelete = useCallback(
    (id: number, name: string) => {
      showConfirm({
        title: tString(t, "confirm_del_product"),
        message: tFormat(t, "delete_confirm_product", name),
        confirmLabel: tString(t, "btn_delete"),
        onConfirm: async () => {
          try {
            await deleteProduct(id);
            showSuccess(tString(t, "product_deleted"));
            void loadProducts({ reset: true });
          } catch (e) {
            if (e instanceof ApiError) {
              if (e.status === 409) {
                showError(tString(t, "err_product_in_recipes"));
              } else if (e.status === 403) {
                showError(tString(t, "err_cannot_modify_system"));
              } else {
                showError(apiErrorMessage(e, tString(t, "del_btn")));
              }
            } else {
              showError(tString(t, "del_btn"));
            }
          }
        },
      });
    },
    [showConfirm, t, showSuccess, loadProducts, showError],
  );

  const applyMacros = useCallback(
    async (productId: number, productName: string) => {
      const { macros } = await fetchProductMacros(productName, lang);
      if (macros) await updateProduct(productId, macros);
      return macros;
    },
    [lang],
  );

  const handleFileSelect = useCallback((file: File | null) => {
    if (!file) return;
    setSelectedFile(file);
  }, []);

  const handleParseAI = useCallback(async () => {
    if (!selectedFile) return;
    setImporting(true);
    try {
      const res = await parseImportAI(selectedFile);
      setRemainingImports(
        typeof res.remaining_today === "number" ? res.remaining_today : null,
      );
      const items = Array.isArray(res.items)
        ? res.items
            .map(parseImportRawItem)
            .filter((i): i is ImportRawItem => i !== null)
            .map(mapImportItem)
        : [];
      setImportItems(items);
    } catch (e) {
      showError(
        e instanceof ApiError
          ? apiErrorMessage(e, tString(t, "analyzing"))
          : tString(t, "analyzing"),
      );
    } finally {
      setImporting(false);
    }
  }, [selectedFile, showError, t]);

  const handleParseFree = useCallback(async () => {
    if (!selectedFile) return;
    setImporting(true);
    try {
      const res = await parseImportFree(selectedFile);
      const items = Array.isArray(res.items)
        ? res.items
            .map(parseImportRawItem)
            .filter((i): i is ImportRawItem => i !== null)
            .map(mapImportItem)
        : [];
      setImportItems(items);
    } catch (e) {
      showError(
        e instanceof ApiError
          ? apiErrorMessage(e, tString(t, "processing"))
          : tString(t, "processing"),
      );
    } finally {
      setImporting(false);
    }
  }, [selectedFile, showError, t]);

  const handleApplyImport = useCallback(async () => {
    if (!importItems) return;
    const selected = importItems.filter(
      (i) => i.selected && i.price !== "" && i.price !== null,
    );
    if (!selected.length) {
      showError(tString(t, "at_least_one"));
      return;
    }
    const invalid = selected.filter(
      (i) => Number.isNaN(parseFloat(i.price)) || parseFloat(i.price) < 0,
    );
    if (invalid.length) {
      showError(tString(t, "valid_price_err"));
      return;
    }
    const overPrice = selected.filter((i) => parseFloat(i.price) > 99999);
    if (overPrice.length) {
      showError(tString(t, "price_max_err"));
      return;
    }
    const overWeight = selected.filter((i) => parseFloat(i.weight) > 99999);
    if (overWeight.length) {
      showError(tString(t, "weight_max_err"));
      return;
    }
    const longName = selected.filter(
      (i) => (i.receipt_name || "").trim().length > 200,
    );
    if (longName.length) {
      showError(tString(t, "name_max_err"));
      return;
    }
    const emptyName = selected.filter(
      (i) => !i.matched_product && !(i.receipt_name || "").trim(),
    );
    if (emptyName.length) {
      showError(tString(t, "fill_name_err"));
      return;
    }

    const toUpdate = selected.filter((i) => i.matched_product);
    const toCreate = selected.filter(
      (i) => !i.matched_product && i.receipt_name?.trim(),
    );

    try {
      const calcUnitPrice = (item: ImportItem) => {
        const sbw = !!item.sold_by_weight;
        const pkg = sbw
          ? 1000
          : parseFloat(item.weight) || (item.unit === "szt" ? 1 : 1000);
        const unit = sbw ? "g" : item.unit || "g";
        return parseFloat(
          toUnitPrice(parseFloat(item.price), pkg, unit).toFixed(4),
        );
      };

      if (toUpdate.length) {
        await applyImportPrices(
          toUpdate.map((i) => ({
            product_id: i.matched_product!.id,
            price: calcUnitPrice(i),
          })),
        );
        for (const item of toUpdate) {
          if (item.sold_by_weight !== undefined && item.matched_product) {
            await updateProduct(item.matched_product.id, {
              sold_by_weight: !!item.sold_by_weight,
            });
          }
        }
      }

      for (const item of toCreate) {
        const sbw = !!item.sold_by_weight;
        const pkg = sbw
          ? 1000
          : parseFloat(item.weight) || (item.unit === "szt" ? 1 : 1000);
        const unit = sbw ? "g" : item.unit || "g";
        const created = await createProduct({
          name: item.receipt_name.trim(),
          package_weight: pkg,
          price: calcUnitPrice(item),
          unit,
          sold_by_weight: sbw,
        });
        await applyMacros(created.id, item.receipt_name.trim());
      }

      setImportItems(null);
      globalToast(tString(t, "fetching_macro"), "#eab308", 999999);
      for (const item of toUpdate) {
        if (item.matched_product) {
          await applyMacros(item.matched_product.id, item.matched_product.name);
        }
      }

      const msg = [
        toUpdate.length && tFormatN(t, "import_updated_n", toUpdate.length),
        toCreate.length && tFormatN(t, "import_added_n", toCreate.length),
      ]
        .filter(Boolean)
        .join(", ") +
        (toUpdate.length || toCreate.length
          ? ` ${tString(t, "import_done_suffix")}`
          : "");
      showSuccess(msg);
      void loadProducts({ reset: true });
    } catch {
      showError(tString(t, "save_products_err"));
    }
  }, [
    importItems,
    showError,
    t,
    applyMacros,
    globalToast,
    showSuccess,
    loadProducts,
  ]);

  const handleDeleteAll = useCallback(() => {
    const editablePrivateCount = productList.filter((p) => p.is_editable).length;
    showConfirm({
      title: tString(t, "del_all_products_title"),
      message: tFormatN(t, "confirm_del_all_products", editablePrivateCount),
      confirmLabel: tString(t, "del_all_products"),
      onConfirm: async () => {
        try {
          await deleteAllProducts();
          showSuccess(tString(t, "all_products_deleted"));
          void loadProducts({ reset: true });
        } catch {
          showError(tString(t, "del_during_err"));
        }
      },
    });
  }, [productList, showConfirm, t, showSuccess, loadProducts, showError]);

  const handleCopyPrompt = useCallback(() => {
    void navigator.clipboard.writeText(tString(t, "products_prompt"));
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  }, [t]);

  const displayUnit = useCallback(
    (u: string) => (u === "szt" ? tString(t, "unit_pcs") : u),
    [t],
  );

  const editablePrivateCount = productList.filter((p) => p.is_editable).length;

  const shopLinks =
    user?.market_code === "GB"
      ? [
          {
            domain: "www.tesco.com",
            url: "https://www.tesco.com/",
            label: "Tesco",
          },
          {
            domain: "www.aldi.co.uk",
            url: "https://www.aldi.co.uk/",
            label: "Aldi",
          },
          {
            domain: "groceries.asda.com",
            url: "https://groceries.asda.com/",
            label: "Asda",
          },
        ]
      : [
          {
            domain: "zakupy.auchan.pl",
            url: "https://zakupy.auchan.pl/",
            label: "Auchan",
          },
          {
            domain: "zakupy.biedronka.pl",
            url: "https://zakupy.biedronka.pl/",
            label: "Biedronka",
          },
          {
            domain: "carrefour.pl",
            url: "https://www.carrefour.pl/",
            label: "Carrefour",
          },
        ];

  return {
    t,
    lang,
    productList,
    productTotal,
    listLoading,
    pasteText,
    form,
    setForm,
    editId,
    setEditId,
    editForm,
    setEditForm,
    lookingUp,
    importItems,
    setImportItems,
    importing,
    remainingImports,
    dragOver,
    setDragOver,
    selectedFile,
    setSelectedFile,
    listOpen,
    setListOpen,
    importHelpModalOpen,
    setImportHelpModalOpen,
    search,
    setSearch,
    promptCopied,
    selectionMode,
    setSelectionMode,
    selectedIds,
    fileInputRef,
    sentinelRef,
    toggleSelect,
    exitSelection,
    handleDeleteSelected,
    handlePasteChange,
    handleSubmit,
    startEdit,
    handleSaveEdit,
    handleAutoFill,
    handleDelete,
    handleFileSelect,
    handleParseAI,
    handleParseFree,
    handleApplyImport,
    handleDeleteAll,
    handleCopyPrompt,
    displayUnit,
    editablePrivateCount,
    shopLinks,
    numClamp,
  };
}
