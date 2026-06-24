"use client";

import { Fragment } from "react";
import { ImportHelpModal } from "@/components/products/ImportHelpModal";
import {
  EMPTY_FORM,
  isImageFile,
  isTextFile,
  useProductsPage,
} from "@/hooks/useProductsPage";
import { displayPrice } from "@/lib/products/pricing";
import { tFormat, tFormat2, tFormatN, tString } from "@/lib/i18n/translate";
import type { ImportItem, Product } from "@/types/product";

function MacroDisplay({ p, t }: { p: Product; t: ReturnType<typeof useProductsPage>["t"] }) {
  if (!p.protein && !p.fat && !p.carbs) {
    return <span className="text-slate-600">-</span>;
  }
  return (
    <div className="text-[13px] text-slate-400">
      {p.protein != null && (
        <span className="mr-1.5">
          {tString(t, "macro_p")}: {p.protein}g
        </span>
      )}
      {p.fat != null && (
        <span className="mr-1.5">
          {tString(t, "macro_f")}: {p.fat}g
        </span>
      )}
      {p.carbs != null && (
        <span>
          {tString(t, "macro_c")}: {p.carbs}g
        </span>
      )}
    </div>
  );
}

export function ProductsScreen() {
  const page = useProductsPage();
  const {
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
    shopLinks,
    numClamp,
  } = page;

  const inputClass =
    "rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-teal-600";

  const btnPrimary =
    "cursor-pointer rounded-md border-none bg-teal-600 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-teal-500 disabled:opacity-50";

  const btnSecondary =
    "cursor-pointer rounded-md border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-400 hover:bg-slate-600";

  const toggleBtn = (active: boolean) =>
    `cursor-pointer border-none px-3 py-1.5 text-xs font-semibold ${
      active
        ? "bg-teal-600 text-slate-900"
        : "bg-slate-700 text-slate-400 hover:bg-slate-600"
    }`;

  const updateImportItem = (
    items: ImportItem[],
    index: number,
    patch: Partial<ImportItem>,
  ) => {
    const next = [...items];
    const current = next[index];
    if (!current) return items;
    next[index] = { ...current, ...patch };
    return next;
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 md:p-6">
        <h2 className="mb-4 text-lg font-bold text-slate-100">
          {tString(t, "add_product_title")}
        </h2>

        <section className="mb-5 rounded-lg border border-slate-700/60 bg-slate-900/30 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-teal-500">
            <span aria-hidden>🏪</span>
            {tString(t, "search_products_hint")}
          </div>
          <div className="flex flex-wrap gap-3">
            {shopLinks.map(({ domain, url, label }) => (
              <a
                key={label}
                href={url}
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
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-300">
              <span aria-hidden>📋</span>
              {tString(t, "product_paste_title")}
            </div>
            <textarea
              className={`${inputClass} min-h-[180px] w-full resize-y`}
              value={pasteText}
              maxLength={500}
              onChange={(e) => handlePasteChange(e.target.value)}
              placeholder={tString(t, "product_paste_ph")}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-300">
              <span aria-hidden>✓</span>
              {tString(t, "check_data_label")}
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[10px] uppercase text-slate-500">
                  {tString(t, "product_name_lbl")}
                </label>
                <input
                  className={`${inputClass} w-full`}
                  value={form.name}
                  maxLength={50}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value.slice(0, 50) })
                  }
                />
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[120px] flex-1">
                  <label className="mb-1 block text-[10px] uppercase text-slate-500">
                    {tString(t, "price_per_kg_lbl")}
                  </label>
                  <input
                    type="number"
                    className={`${inputClass} w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                    step="0.01"
                    min="0"
                    max="9999"
                    value={form.package_price}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        package_price: String(numClamp(e.target.value, 9999)),
                      })
                    }
                    placeholder={tString(t, "price_ph")}
                  />
                </div>
                <div className="flex overflow-hidden rounded-md border border-slate-600">
                  <button
                    type="button"
                    className={toggleBtn(!form.sold_by_weight)}
                    onClick={() =>
                      setForm((f) => ({ ...f, sold_by_weight: false }))
                    }
                  >
                    {tString(t, "pkg_btn")}
                  </button>
                  <button
                    type="button"
                    className={toggleBtn(form.sold_by_weight)}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        sold_by_weight: true,
                        unit: "g",
                        package_weight: "",
                      }))
                    }
                  >
                    {tString(t, "weight_btn")}
                  </button>
                </div>
              </div>

              {!form.sold_by_weight && (
                <div>
                  <label className="mb-1 block text-[10px] uppercase text-slate-500">
                    {tString(t, "pkg_capacity_lbl")}
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      className={`${inputClass} w-24 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                      min="0"
                      max="99999"
                      value={form.package_weight}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          package_weight: String(numClamp(e.target.value)),
                        })
                      }
                      placeholder={tString(t, "pkg_ph")}
                    />
                    <div className="flex overflow-hidden rounded-md border border-slate-600">
                      {(["g", "kg", "ml", "l", "szt"] as const).map((u) => (
                        <button
                          key={u}
                          type="button"
                          className={toggleBtn(form.unit === u)}
                          onClick={() => setForm((f) => ({ ...f, unit: u }))}
                        >
                          {displayUnit(u)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button type="button" className={btnPrimary} onClick={handleSubmit}>
                  {tString(t, "save_btn")}
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    handlePasteChange("");
                    setForm(EMPTY_FORM);
                  }}
                >
                  {tString(t, "cancel")}
                </button>
              </div>
            </div>
          </div>
        </div>

        {importItems ? (
          <section className="mt-6 border-t border-slate-700 pt-6">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-teal-500">
              {tString(t, "import_review_title")}
            </h2>
            <p className="mb-4 text-sm text-slate-400">
              {tString(t, "import_review_hint_pre")}{" "}
              <strong>{tString(t, "weight_btn")}</strong>{" "}
              {tString(t, "import_review_hint_suf")}
            </p>
            <div className="mb-4 flex flex-col gap-2">
              {importItems.map((item, i) => {
                const sbw = !!item.sold_by_weight;
                const isNew = !item.matched_product;
                return (
                  <div
                    key={i}
                    className={`rounded-lg border border-slate-600 bg-slate-800/80 p-3 transition-opacity ${
                      item.selected ? "opacity-100" : "opacity-50"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setImportItems(
                            updateImportItem(importItems, i, {
                              selected: !item.selected,
                            }),
                          )
                        }
                        className={`flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border text-sm font-bold ${
                          item.selected
                            ? "border-teal-700 bg-teal-900/40 text-teal-400"
                            : "border-slate-600 bg-transparent text-slate-600"
                        }`}
                      >
                        ✓
                      </button>
                      <span className="shrink-0 text-sm font-semibold text-slate-200">
                        {item.receipt_name}
                      </span>
                      <span className="shrink-0 text-slate-600">→</span>
                      <select
                        value={String(item.matched_product?.id || "")}
                        onChange={(e) => {
                          const p =
                            productList.find(
                              (row) => String(row.id) === e.target.value,
                            ) || null;
                          setImportItems(
                            updateImportItem(importItems, i, {
                              matched_product: p,
                              selected: item.selected || !!p,
                            }),
                          );
                        }}
                        className={`${inputClass} min-w-[120px] flex-1`}
                      >
                        <option value="">{tString(t, "create_new_product_opt")}</option>
                        {productList.map((p) => (
                          <option key={p.id} value={String(p.id)}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <div className="flex overflow-hidden rounded-md border border-slate-600">
                        {(
                          [
                            [tString(t, "pkg_btn"), false],
                            [tString(t, "weight_btn"), true],
                          ] as const
                        ).map(([label, val]) => (
                          <button
                            key={label}
                            type="button"
                            className={toggleBtn(sbw === val)}
                            onClick={() =>
                              setImportItems(
                                updateImportItem(importItems, i, {
                                  sold_by_weight: val,
                                }),
                              )
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {!sbw && (
                        <>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="99999"
                            value={item.weight}
                            onChange={(e) =>
                              setImportItems(
                                updateImportItem(importItems, i, {
                                  weight: String(
                                    Math.min(
                                      99999,
                                      parseFloat(e.target.value) || 0,
                                    ),
                                  ),
                                }),
                              )
                            }
                            className={`${inputClass} w-11 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                            placeholder="500"
                          />
                          <div className="flex overflow-hidden rounded-md border border-slate-600">
                            {(["g", "ml", "szt"] as const).map((u) => (
                              <button
                                key={u}
                                type="button"
                                className={toggleBtn(item.unit === u)}
                                onClick={() =>
                                  setImportItems(
                                    updateImportItem(importItems, i, { unit: u }),
                                  )
                                }
                              >
                                {displayUnit(u)}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="99999"
                        value={item.price}
                        onChange={(e) =>
                          setImportItems(
                            updateImportItem(importItems, i, {
                              price: String(
                                Math.min(99999, parseFloat(e.target.value) || 0),
                              ),
                            }),
                          )
                        }
                        className={`${inputClass} w-12 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                      />
                      <span
                        className={`shrink-0 whitespace-nowrap text-[11px] ${
                          sbw ? "text-teal-400" : "text-slate-500"
                        }`}
                      >
                        {sbw
                          ? `${tString(t, "currency")} / kg`
                          : `${tString(t, "currency")} ${tString(t, "price_per_pkg_suffix")}`}
                      </span>
                    </div>
                    {isNew && (
                      <div className="mt-1 text-[10px] text-slate-500">
                        {tString(t, "no_assignment_hint")}{" "}
                        <span className="text-teal-400">
                          {tString(t, "create_new_product_label")}
                        </span>
                        {tString(t, "import_new_product_hint_suf")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className={btnPrimary}
                onClick={handleApplyImport}
              >
                {tString(t, "apply_changes")}
              </button>
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setImportItems(null)}
              >
                {tString(t, "cancel")}
              </button>
            </div>
          </section>
        ) : (
          <div className="mt-6 grid gap-4 border-t border-slate-700 pt-6 lg:grid-cols-[1fr_auto]">
            <section>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold uppercase tracking-wide text-teal-500">
                  {tString(t, "import_title")}
                </span>
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-1 rounded-full border border-slate-600 px-2 py-1 text-xs text-slate-400 hover:border-teal-600 hover:text-teal-400"
                  onClick={() => setImportHelpModalOpen(true)}
                  aria-label={tString(t, "import_how_to")}
                  title={tString(t, "import_how_to")}
                >
                  <span aria-hidden>💡</span>
                  <span>{tString(t, "import_help_btn")}</span>
                </button>
              </div>
              <div
                className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                  dragOver
                    ? "border-teal-500 bg-teal-900/20"
                    : selectedFile
                      ? "border-teal-700 bg-teal-900/10"
                      : "border-slate-600 bg-slate-900/30 hover:border-slate-500"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFileSelect(e.dataTransfer.files[0] ?? null);
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.txt,.csv"
                  className="hidden"
                  onChange={(e) =>
                    handleFileSelect(e.target.files?.[0] ?? null)
                  }
                />
                {selectedFile ? (
                  <>
                    <div className="font-semibold text-teal-400">
                      {isImageFile(selectedFile)
                        ? `${tString(t, "opt1_short")} `
                        : `${tString(t, "opt2_short")} `}
                      {selectedFile.name}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {tString(t, "click_change")}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-3xl">📂</div>
                    <div className="mt-2 font-semibold text-slate-300">
                      {tString(t, "click_drag_file")}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {tString(t, "file_types_hint")}
                    </div>
                  </>
                )}
              </div>
              {selectedFile && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {isImageFile(selectedFile) && (
                    <button
                      type="button"
                      className={btnPrimary}
                      onClick={handleParseAI}
                      disabled={importing}
                    >
                      {importing
                        ? tString(t, "analyzing")
                        : tString(t, "apply_ai_btn")}
                    </button>
                  )}
                  {isTextFile(selectedFile) && (
                    <button
                      type="button"
                      className={btnPrimary}
                      onClick={handleParseFree}
                      disabled={importing}
                    >
                      {importing
                        ? tString(t, "processing")
                        : tString(t, "apply_file_btn")}
                    </button>
                  )}
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => setSelectedFile(null)}
                  >
                    {tString(t, "cancel")}
                  </button>
                </div>
              )}
            </section>

            <aside className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 text-sm text-slate-400 lg:max-w-xs">
              <div className="mb-1 font-semibold text-slate-300">
                {tString(t, "macro_auto_title")}
              </div>
              {tString(t, "macro_auto_desc")}
              <div className="mt-2 text-xs text-slate-500">
                {tString(t, "macro_edit_hint")}
              </div>
            </aside>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="cursor-pointer text-sm font-bold uppercase tracking-wide text-teal-500"
            onClick={() => setListOpen((o) => !o)}
          >
            {tString(t, "product_list_title")}
          </button>

          <button
            type="button"
            onClick={() =>
              selectionMode
                ? exitSelection()
                : (setSelectionMode(true), setEditId(null))
            }
            className={`cursor-pointer rounded-md border px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
              selectionMode
                ? "border-teal-700 bg-teal-900/30 text-teal-400"
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
              if (selectionMode) {
                if (selectedIds.size > 0) handleDeleteSelected();
              } else {
                handleDeleteAll();
              }
            }}
            disabled={selectionMode && selectedIds.size === 0}
            className={`cursor-pointer rounded-md border border-slate-600 px-3 py-1 text-xs whitespace-nowrap transition-colors hover:border-red-500 hover:text-red-400 disabled:cursor-default disabled:opacity-40 ${
              selectionMode && selectedIds.size === 0
                ? "text-slate-700"
                : "text-slate-500"
            }`}
          >
            {selectionMode && selectedIds.size > 0
              ? tFormatN(t, "del_selected_products", selectedIds.size)
              : tString(t, "del_all_products")}
          </button>

          <button
            type="button"
            onClick={() => setListOpen((o) => !o)}
            className="ml-auto cursor-pointer border-none bg-transparent p-1 text-teal-500"
            aria-label={listOpen ? "Collapse" : "Expand"}
          >
            <span
              className="inline-block text-xl transition-transform"
              style={{ transform: listOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            >
              ▼
            </span>
          </button>
        </div>

        {listOpen && (
          <div>
            <div className="mb-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tString(t, "search_product_ph")}
                className={`${inputClass} w-full max-w-md`}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-y-0.5">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500">
                    <th className="px-2 py-1">{tString(t, "col_name")}</th>
                    <th className="px-2 py-1">{tString(t, "col_kcal")}</th>
                    <th className="px-2 py-1">{tString(t, "col_macro")}</th>
                    <th className="px-2 py-1">{tString(t, "col_pkg_capacity")}</th>
                    <th className="px-2 py-1">{tString(t, "col_price_opak_kg")}</th>
                    <th className="px-2 py-1" />
                  </tr>
                </thead>
                <tbody>
                  {productList.map((p) => {
                    const isEditing = editId === p.id;
                    const canSelect = !selectionMode || p.is_editable;
                    return (
                      <Fragment key={p.id}>
                        <tr
                          className={`rounded-lg transition-colors ${
                            isEditing
                              ? "bg-teal-900/20"
                              : selectionMode && selectedIds.has(p.id)
                                ? "bg-indigo-900/20"
                                : "hover:bg-slate-800/60"
                          } ${canSelect || !selectionMode ? "cursor-pointer" : ""}`}
                          onClick={() => {
                            if (selectionMode) {
                              if (p.is_editable) toggleSelect(p.id);
                              return;
                            }
                            if (isEditing) setEditId(null);
                            else startEdit(p);
                          }}
                        >
                          <td className="px-2 py-2 text-[13px] text-slate-200">
                            {selectionMode && p.is_editable && (
                              <span
                                className={`mr-2 inline-flex h-4 w-4 items-center justify-center rounded border align-middle text-[10px] ${
                                  selectedIds.has(p.id)
                                    ? "border-indigo-500 bg-indigo-500 text-white"
                                    : "border-slate-600 bg-transparent"
                                }`}
                              >
                                {selectedIds.has(p.id) ? "✓" : ""}
                              </span>
                            )}
                            {p.name}
                            {p.is_system && (
                              <span className="ml-2 text-[10px] uppercase text-slate-500">
                                {tString(t, "catalog_system_badge")}
                              </span>
                            )}
                          </td>
                          <td
                            className={`px-2 py-2 text-[13px] ${
                              p.kcal ? "text-slate-400" : "text-slate-600"
                            }`}
                          >
                            {p.kcal != null ? `${p.kcal} kcal` : "-"}
                          </td>
                          <td className="px-2 py-2">
                            <MacroDisplay p={p} t={t} />
                          </td>
                          <td className="px-2 py-2 text-[13px] text-slate-400">
                            {p.sold_by_weight
                              ? tString(t, "weight_btn")
                              : p.package_weight
                                ? `${p.package_weight} ${p.unit || "g"}`
                                : "-"}
                          </td>
                          <td
                            className={`px-2 py-2 text-[13px] ${
                              p.price > 0 ? "text-slate-400" : "text-slate-600"
                            }`}
                          >
                            {displayPrice(p, tString(t, "currency"))}
                          </td>
                          <td
                            className="px-2 py-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {p.is_editable && (
                              <button
                                type="button"
                                className="cursor-pointer rounded-md bg-red-600/80 px-3 py-1 text-[13px] font-semibold text-white hover:bg-red-500"
                                onClick={() => handleDelete(p.id, p.name)}
                              >
                                {tString(t, "del_btn")}
                              </button>
                            )}
                          </td>
                        </tr>
                        {isEditing && (
                          <tr className="bg-slate-900/50">
                            <td
                              className="border-l-[3px] border-teal-600 px-3 py-2 align-top"
                            >
                              <div className="mb-1 text-[10px] text-slate-500">
                                {tString(t, "col_name")}
                              </div>
                              <input
                                value={editForm.name}
                                maxLength={50}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    name: e.target.value.slice(0, 50),
                                  })
                                }
                                className={`${inputClass} w-full`}
                              />
                            </td>
                            <td className="px-2 py-2 align-top">
                              <div className="mb-1 text-[10px] text-slate-500">
                                Kcal/100g
                              </div>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="9999"
                                value={editForm.kcal}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    kcal: numClamp(e.target.value, 9999),
                                  })
                                }
                                className={`${inputClass} w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                              />
                            </td>
                            <td className="px-2 py-2 align-top">
                              <div className="mb-1 flex gap-1">
                                {(
                                  [
                                    ["macro_p", "protein"],
                                    ["macro_f", "fat"],
                                    ["macro_c", "carbs"],
                                  ] as const
                                ).map(([labelKey, field]) => (
                                  <div key={field}>
                                    <div className="mb-1 text-[10px] text-slate-500">
                                      {tString(t, labelKey)}
                                    </div>
                                    <input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      max="100"
                                      value={editForm[field]}
                                      onChange={(e) =>
                                        setEditForm({
                                          ...editForm,
                                          [field]: numClamp(e.target.value, 100),
                                        })
                                      }
                                      className={`${inputClass} w-[52px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                                    />
                                  </div>
                                ))}
                              </div>
                              <button
                                type="button"
                                onClick={handleAutoFill}
                                disabled={lookingUp === editId}
                                className="cursor-pointer rounded bg-teal-600 px-2 py-0.5 text-[10px] font-semibold text-slate-900 disabled:opacity-50"
                              >
                                {lookingUp === editId
                                  ? "⏳..."
                                  : tString(t, "fetch_macro_btn")}
                              </button>
                            </td>
                            <td className="px-2 py-2 align-top">
                              <div className="mb-1 flex w-fit overflow-hidden rounded border border-slate-600">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditForm((f) => ({
                                      ...f,
                                      sold_by_weight: false,
                                    }))
                                  }
                                  className={toggleBtn(!editForm.sold_by_weight)}
                                >
                                  {tString(t, "pkg_op_btn")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditForm((f) => ({
                                      ...f,
                                      sold_by_weight: true,
                                      unit: "g",
                                      package_weight: "1000",
                                    }))
                                  }
                                  className={toggleBtn(!!editForm.sold_by_weight)}
                                >
                                  {tString(t, "weight_btn")}
                                </button>
                              </div>
                              {!editForm.sold_by_weight && (
                                <div className="mt-1 flex gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="99999"
                                    value={editForm.package_weight}
                                    onChange={(e) =>
                                      setEditForm({
                                        ...editForm,
                                        package_weight: String(
                                          numClamp(e.target.value),
                                        ),
                                      })
                                    }
                                    className={`${inputClass} w-[60px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                                    placeholder="500"
                                  />
                                  <select
                                    value={editForm.unit}
                                    onChange={(e) =>
                                      setEditForm({
                                        ...editForm,
                                        unit: e.target.value,
                                      })
                                    }
                                    className={`${inputClass} w-10 px-1`}
                                  >
                                    <option value="g">g</option>
                                    <option value="ml">ml</option>
                                    <option value="szt">
                                      {displayUnit("szt")}
                                    </option>
                                  </select>
                                </div>
                              )}
                            </td>
                            <td className="px-2 py-2 align-top">
                              <div className="mb-1 text-[10px] text-slate-500">
                                {editForm.sold_by_weight
                                  ? tString(t, "price_per_kg_lbl")
                                  : tString(t, "price_per_opak_lbl")}
                              </div>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="9999"
                                value={editForm.package_price}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    package_price: String(
                                      numClamp(e.target.value, 9999),
                                    ),
                                  })
                                }
                                className={`${inputClass} w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                              />
                            </td>
                            <td className="border-b border-teal-600/40 px-2 py-2 align-middle">
                              <div className="flex flex-col gap-1.5">
                                <button
                                  type="button"
                                  className={`${btnPrimary} px-2.5 py-1 text-xs`}
                                  onClick={handleSaveEdit}
                                >
                                  {tString(t, "save_btn")}
                                </button>
                                <button
                                  type="button"
                                  className={`${btnSecondary} px-2.5 py-1 text-xs`}
                                  onClick={() => setEditId(null)}
                                >
                                  {tString(t, "cancel")}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {!listLoading && productList.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className={`px-2 py-6 text-center text-slate-500 ${
                          search.trim() ? "italic" : ""
                        }`}
                      >
                        {search.trim()
                          ? tFormat(t, "product_not_found", search)
                          : tString(t, "no_products")}
                      </td>
                    </tr>
                  )}
                  {productList.length < productTotal && (
                    <tr ref={sentinelRef}>
                      <td
                        colSpan={6}
                        className="px-2 py-2 text-center text-xs text-slate-600"
                      >
                        {listLoading
                          ? "…"
                          : tFormat2(
                              t,
                              "shown_products",
                              productList.length,
                              productTotal,
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

      <ImportHelpModal
        open={importHelpModalOpen}
        onClose={() => setImportHelpModalOpen(false)}
        t={t}
        lang={lang}
        remainingImports={remainingImports}
        promptCopied={promptCopied}
        onCopyPrompt={handleCopyPrompt}
      />
    </div>
  );
}
