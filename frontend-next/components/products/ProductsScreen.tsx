"use client";

import { Fragment, type ChangeEvent, type CSSProperties } from "react";
import { Icon } from "@iconify/react";
import { ImportHelpModal } from "@/components/products/ImportHelpModal";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  EMPTY_FORM,
  isImageFile,
  isTextFile,
  useProductsPage,
} from "@/hooks/useProductsPage";
import { displayPrice } from "@/lib/products/pricing";
import { tFormat, tFormat2, tFormatN, tString } from "@/lib/i18n/translate";
import type { ImportItem, Product } from "@/types/product";
import "./products.css";

function MacroDisplay({ p }: { p: Product }) {
  const { t } = useLanguage();
  if (!p.protein && !p.fat && !p.carbs) {
    return <span style={{ color: "#4b5563" }}>-</span>;
  }
  return (
    <div style={{ fontSize: 13, color: "#9ca3af" }} className="macro-cell">
      {p.protein != null && (
        <span style={{ marginRight: 6 }}>
          {tString(t, "macro_p")}: {p.protein}g
        </span>
      )}
      {p.fat != null && (
        <span style={{ marginRight: 6 }}>
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

  const s: CSSProperties = { padding: "5px 8px", fontSize: 13 };
  const fl: CSSProperties = { fontSize: 10, color: "#6b7280", marginBottom: 3 };

  const UnitSelect = ({
    value,
    onChange,
    style,
  }: {
    value: string;
    onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
    style?: CSSProperties;
  }) => (
    <select value={value} onChange={onChange} style={style}>
      <option value="g">g</option>
      <option value="ml">ml</option>
      <option value="szt">{displayUnit("szt")}</option>
    </select>
  );

  return (
    <div className="products-page">
      <div className="card products-add-card">
        <h2>{tString(t, "add_product_title")}</h2>

        <div className="products-add-layout">
          <section className="products-inspire-band">
            <div className="products-section-label">
              <Icon icon="heroicons:building-storefront" width={15} />
              {tString(t, "search_products_hint")}
            </div>
            <div className="products-inspire-grid">
              {shopLinks.map(({ domain, url, label }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="products-inspire-link"
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

          <div className="products-add-columns">
            <div className="products-editor">
              <div className="products-editor-head">
                <Icon icon="heroicons:clipboard-document" width={18} />
                {tString(t, "product_paste_title")}
              </div>
              <div className="products-textarea-wrap">
                <textarea
                  className="products-textarea"
                  value={pasteText}
                  maxLength={500}
                  onChange={(e) => handlePasteChange(e.target.value)}
                  placeholder={tString(t, "product_paste_ph")}
                />
              </div>
            </div>

            <div className="products-form-panel">
              <div className="products-form-head">
                <Icon icon="heroicons:check-badge" width={18} />
                {tString(t, "check_data_label")}
              </div>
              <div className="products-form-field">
                <label className="products-form-label">
                  {tString(t, "product_name_lbl")}
                </label>
                <input
                  value={form.name}
                  maxLength={50}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value.slice(0, 50) })
                  }
                />
              </div>
              <div className="products-price-row">
                <div className="products-form-field">
                  <label className="products-form-label">
                    {tString(t, "price_per_kg_lbl")}
                  </label>
                  <input
                    type="number"
                    className="no-spin"
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
                <div className="products-toggle-group">
                  <button
                    type="button"
                    className={!form.sold_by_weight ? "active" : ""}
                    onClick={() =>
                      setForm((f) => ({ ...f, sold_by_weight: false }))
                    }
                  >
                    {tString(t, "pkg_btn")}
                  </button>
                  <button
                    type="button"
                    className={form.sold_by_weight ? "active" : ""}
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
                <div className="products-form-field">
                  <label className="products-form-label">
                    {tString(t, "pkg_capacity_lbl")}
                  </label>
                  <div className="products-unit-row">
                    <input
                      type="number"
                      className="no-spin"
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
                    <div className="products-unit-btns">
                      {(["g", "kg", "ml", "l", "szt"] as const).map((u) => (
                        <button
                          key={u}
                          type="button"
                          className={form.unit === u ? "active" : ""}
                          onClick={() => setForm((f) => ({ ...f, unit: u }))}
                        >
                          {displayUnit(u)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="products-form-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSubmit}
                >
                  {tString(t, "save_btn")}
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ background: "#374151", color: "#9ca3af" }}
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

          {importItems ? (
            <section className="products-import-review">
              <h2 className="card-section-title" style={{ marginBottom: 12 }}>
                {tString(t, "import_review_title")}
              </h2>
              <p className="products-import-review-hint">
                {tString(t, "import_review_hint_pre")}{" "}
                <strong>{tString(t, "weight_btn")}</strong>{" "}
                {tString(t, "import_review_hint_suf")}
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                {importItems.map((item, i) => {
                  const upd = (u: Partial<ImportItem>) => {
                    const a = [...importItems];
                    a[i] = { ...a[i]!, ...u };
                    setImportItems(a);
                  };
                  const isNew = !item.matched_product;
                  const sbw = !!item.sold_by_weight;
                  const inputSt: CSSProperties = {
                    padding: "5px 8px",
                    fontSize: 12,
                    background: "#111827",
                    border: "1px solid #374151",
                    color: "#e2e8f0",
                    borderRadius: 6,
                  };
                  return (
                    <div
                      key={i}
                      style={{
                        background: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: 10,
                        padding: "10px 14px",
                        opacity: item.selected ? 1 : 0.5,
                        transition: "opacity 0.15s",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => upd({ selected: !item.selected })}
                          style={{
                            flexShrink: 0,
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            border: "1px solid #374151",
                            cursor: "pointer",
                            fontSize: 14,
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.15s",
                            background: item.selected ? "#1e3a3a" : "transparent",
                            color: item.selected ? "#2dd4bf" : "#4b5563",
                          }}
                        >
                          ✓
                        </button>
                        <span
                          style={{
                            fontSize: 13,
                            color: "#e2e8f0",
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {item.receipt_name}
                        </span>
                        <span style={{ color: "#4b5563", flexShrink: 0 }}>
                          →
                        </span>
                        <div style={{ flex: 1, minWidth: 80 }}>
                          <select
                            value={String(item.matched_product?.id || "")}
                            onChange={(e) => {
                              const p =
                                productList.find(
                                  (row) => String(row.id) === e.target.value,
                                ) || null;
                              upd({
                                matched_product: p,
                                selected: item.selected || !!p,
                              });
                            }}
                            style={{ ...inputSt, width: "100%" }}
                          >
                            <option value="">
                              {tString(t, "create_new_product_opt")}
                            </option>
                            {productList.map((p) => (
                              <option key={p.id} value={String(p.id)}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="products-toggle-group">
                          {(
                            [
                              [tString(t, "pkg_btn"), false],
                              [tString(t, "weight_btn"), true],
                            ] as const
                          ).map(([label, val]) => (
                            <button
                              key={label}
                              type="button"
                              className={sbw === val ? "active" : ""}
                              onClick={() => upd({ sold_by_weight: val })}
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
                                upd({
                                  weight: String(
                                    Math.min(
                                      99999,
                                      parseFloat(e.target.value) || 0,
                                    ),
                                  ),
                                })
                              }
                              className="no-spin"
                              style={{
                                ...inputSt,
                                width: 44,
                                flex: "0 0 44px",
                                boxSizing: "border-box",
                              }}
                              placeholder="500"
                            />
                            <div className="products-toggle-group">
                              {(["g", "ml", "szt"] as const).map((u) => (
                                <button
                                  key={u}
                                  type="button"
                                  className={item.unit === u ? "active" : ""}
                                  onClick={() => upd({ unit: u })}
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
                            upd({
                              price: String(
                                Math.min(
                                  99999,
                                  parseFloat(e.target.value) || 0,
                                ),
                              ),
                            })
                          }
                          className="no-spin"
                          style={{
                            ...inputSt,
                            width: 50,
                            flex: "0 0 50px",
                            boxSizing: "border-box",
                          }}
                        />
                        <span
                          style={{
                            fontSize: 11,
                            color: sbw ? "#2dd4bf" : "#6b7280",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}
                        >
                          {sbw
                            ? `${tString(t, "currency")} / kg`
                            : `${tString(t, "currency")} ${tString(t, "price_per_pkg_suffix")}`}
                        </span>
                      </div>
                      {isNew && (
                        <div
                          style={{
                            fontSize: 10,
                            color: "#6b7280",
                            marginTop: 5,
                          }}
                        >
                          {tString(t, "no_assignment_hint")}{" "}
                          <span style={{ color: "#2dd4bf" }}>
                            {tString(t, "create_new_product_label")}
                          </span>
                          {tString(t, "import_new_product_hint_suf")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleApplyImport}
                >
                  {tString(t, "apply_changes")}
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ background: "#374151", color: "#9ca3af" }}
                  onClick={() => setImportItems(null)}
                >
                  {tString(t, "cancel")}
                </button>
              </div>
            </section>
          ) : (
            <div className="products-bottom-sections">
              <section className="products-import-section">
                <div className="products-import-title-row">
                  <span className="card-section-title">
                    {tString(t, "import_title")}
                  </span>
                  <button
                    type="button"
                    className="pill-help-btn"
                    onClick={() => setImportHelpModalOpen(true)}
                    aria-label={tString(t, "import_how_to")}
                    title={tString(t, "import_how_to")}
                  >
                    <Icon icon="heroicons:light-bulb" width={15} />
                    <span>{tString(t, "import_help_btn")}</span>
                  </button>
                </div>
                <div
                  className={`products-dropzone${dragOver ? " products-dropzone--drag" : ""}${selectedFile ? " products-dropzone--selected" : ""}`}
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
                    style={{ display: "none" }}
                    onChange={(e) =>
                      handleFileSelect(e.target.files?.[0] ?? null)
                    }
                  />
                  {selectedFile ? (
                    <>
                      <div
                        className={`products-dropzone-title${selectedFile ? " products-dropzone-title--selected" : ""}`}
                      >
                        {isImageFile(selectedFile)
                          ? `${tString(t, "opt1_short")} `
                          : `${tString(t, "opt2_short")} `}
                        {selectedFile.name}
                      </div>
                      <div className="products-dropzone-hint">
                        {tString(t, "click_change")}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="products-dropzone-icon">📂</div>
                      <div className="products-dropzone-title">
                        {tString(t, "click_drag_file")}
                      </div>
                      <div className="products-dropzone-hint">
                        {tString(t, "file_types_hint")}
                      </div>
                    </>
                  )}
                </div>
                {selectedFile && (
                  <div className="products-import-actions">
                    {isImageFile(selectedFile) && (
                      <button
                        type="button"
                        className="btn btn-primary"
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
                        className="btn btn-primary"
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
                      className="btn"
                      style={{ background: "#374151", color: "#9ca3af" }}
                      onClick={() => setSelectedFile(null)}
                    >
                      {tString(t, "cancel")}
                    </button>
                  </div>
                )}
              </section>

              <div className="products-macro-callout">
                <div className="products-macro-callout-title">
                  {tString(t, "macro_auto_title")}
                </div>
                {tString(t, "macro_auto_desc")}
                <div className="products-macro-callout-hint">
                  {tString(t, "macro_edit_hint")}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card products-list-card">
        <div className="products-list-header">
          <button
            type="button"
            className="list-section-toggle"
            onClick={() => setListOpen((o) => !o)}
          >
            <span className="card-section-title">
              {tString(t, "product_list_title")}
            </span>
          </button>

          <button
            type="button"
            className={`list-header-btn${selectionMode ? " list-header-btn--active" : ""}`}
            onClick={() =>
              selectionMode
                ? exitSelection()
                : (setSelectionMode(true), setEditId(null))
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
              if (selectionMode) {
                if (selectedIds.size > 0) handleDeleteSelected();
              } else {
                handleDeleteAll();
              }
            }}
            disabled={selectionMode && selectedIds.size === 0}
          >
            {selectionMode && selectedIds.size > 0
              ? tFormatN(t, "del_selected_products", selectedIds.size)
              : tString(t, "del_all_products")}
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
          <div className="products-list-body">
            <div className="products-list-search">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tString(t, "search_product_ph")}
              />
            </div>
            <div className="table-scroll">
            <table className="products-table">
              <thead>
                <tr>
                  <th>{tString(t, "col_name")}</th>
                  <th>{tString(t, "col_kcal")}</th>
                  <th>{tString(t, "col_macro")}</th>
                  <th>{tString(t, "col_pkg_capacity")}</th>
                  <th>{tString(t, "col_price_opak_kg")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {productList.map((p) => {
                  const isEditing = editId === p.id;
                  const canSelect = !selectionMode || p.is_editable;
                  return (
                    <Fragment key={p.id}>
                      <tr
                        className={`product-row${isEditing ? " product-row-selected" : ""}${selectionMode && selectedIds.has(p.id) ? " product-row-checked" : ""}`}
                        style={{
                          cursor:
                            canSelect || !selectionMode ? "pointer" : "default",
                        }}
                        onClick={() => {
                          if (selectionMode) {
                            if (p.is_editable) toggleSelect(p.id);
                            return;
                          }
                          if (isEditing) setEditId(null);
                          else startEdit(p);
                        }}
                      >
                        <td>
                          {selectionMode && p.is_editable && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 16,
                                height: 16,
                                borderRadius: 4,
                                border: `1.5px solid ${selectedIds.has(p.id) ? "#6366f1" : "#374151"}`,
                                background: selectedIds.has(p.id)
                                  ? "#6366f1"
                                  : "transparent",
                                marginRight: 8,
                                flexShrink: 0,
                                verticalAlign: "middle",
                                transition: "all 0.12s",
                              }}
                            >
                              {selectedIds.has(p.id) && (
                                <Icon
                                  icon="heroicons:check"
                                  style={{
                                    width: 10,
                                    height: 10,
                                    color: "#fff",
                                  }}
                                />
                              )}
                            </span>
                          )}
                          {p.name}
                          {p.is_system && (
                            <span className="catalog-badge">
                              {tString(t, "catalog_system_badge")}
                            </span>
                          )}
                        </td>
                        <td className={p.kcal ? "cell-muted" : "cell-empty"}>
                          {p.kcal != null ? `${p.kcal} kcal` : "-"}
                        </td>
                        <td>
                          <MacroDisplay p={p} />
                        </td>
                        <td className="cell-muted">
                          {p.sold_by_weight
                            ? tString(t, "weight_btn")
                            : p.package_weight
                              ? `${p.package_weight} ${p.unit || "g"}`
                              : "-"}
                        </td>
                        <td className={p.price > 0 ? "cell-muted" : "cell-empty"}>
                          {displayPrice(p, tString(t, "currency"))}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="row-actions">
                          {p.is_editable && (
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => handleDelete(p.id, p.name)}
                            >
                              {tString(t, "del_btn")}
                            </button>
                          )}
                          </div>
                        </td>
                      </tr>
                      {isEditing && (
                        <tr className="edit-body-row">
                          <td
                            style={{
                              verticalAlign: "top",
                              padding: "8px 6px 8px 12px",
                              borderLeft: "3px solid #0d9488",
                            }}
                          >
                            <div style={fl}>{tString(t, "col_name")}</div>
                            <input
                              value={editForm.name}
                              maxLength={50}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  name: e.target.value.slice(0, 50),
                                })
                              }
                              style={{
                                width: "100%",
                                boxSizing: "border-box",
                                ...s,
                              }}
                            />
                          </td>
                          <td
                            style={{
                              verticalAlign: "top",
                              padding: "8px 6px",
                            }}
                          >
                            <div style={fl}>Kcal/100g</div>
                            <input
                              type="number"
                              className="no-spin"
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
                              style={{
                                ...s,
                                width: "100%",
                                boxSizing: "border-box",
                              }}
                            />
                          </td>
                          <td
                            style={{
                              verticalAlign: "top",
                              padding: "8px 6px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                gap: 4,
                                marginBottom: 4,
                              }}
                            >
                              <div>
                                <div style={fl}>
                                  {tString(t, "macro_p")}
                                </div>
                                <input
                                  type="number"
                                  className="no-spin"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  value={editForm.protein}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      protein: numClamp(e.target.value, 100),
                                    })
                                  }
                                  style={{ ...s, width: 52 }}
                                />
                              </div>
                              <div>
                                <div style={fl}>
                                  {tString(t, "macro_f")}
                                </div>
                                <input
                                  type="number"
                                  className="no-spin"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  value={editForm.fat}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      fat: numClamp(e.target.value, 100),
                                    })
                                  }
                                  style={{ ...s, width: 52 }}
                                />
                              </div>
                              <div>
                                <div style={fl}>
                                  {tString(t, "macro_c")}
                                </div>
                                <input
                                  type="number"
                                  className="no-spin"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  value={editForm.carbs}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      carbs: numClamp(e.target.value, 100),
                                    })
                                  }
                                  style={{ ...s, width: 52 }}
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={handleAutoFill}
                              disabled={lookingUp === editId}
                              style={{
                                padding: "3px 7px",
                                fontSize: 10,
                                background: "#0d9488",
                                color: "#1f2937",
                                border: "none",
                                borderRadius: 5,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {lookingUp === editId
                                ? "⏳..."
                                : tString(t, "fetch_macro_btn")}
                            </button>
                          </td>
                          <td
                            style={{
                              verticalAlign: "top",
                              padding: "8px 6px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                borderRadius: 5,
                                border: "1px solid #374151",
                                overflow: "hidden",
                                marginBottom: 4,
                                width: "fit-content",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setEditForm((f) => ({
                                    ...f,
                                    sold_by_weight: false,
                                  }))
                                }
                                style={{
                                  padding: "4px 8px",
                                  border: "none",
                                  borderRight: "1px solid #374151",
                                  cursor: "pointer",
                                  fontSize: 10,
                                  fontWeight: 600,
                                  background: !editForm.sold_by_weight
                                    ? "#0d9488"
                                    : "#2d3748",
                                  color: !editForm.sold_by_weight
                                    ? "#1f2937"
                                    : "#9ca3af",
                                }}
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
                                style={{
                                  padding: "4px 8px",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: 10,
                                  fontWeight: 600,
                                  background: editForm.sold_by_weight
                                    ? "#0d9488"
                                    : "#2d3748",
                                  color: editForm.sold_by_weight
                                    ? "#1f2937"
                                    : "#9ca3af",
                                }}
                              >
                                {tString(t, "weight_btn")}
                              </button>
                            </div>
                            {!editForm.sold_by_weight && (
                              <div style={{ display: "flex", gap: 3 }}>
                                <input
                                  type="number"
                                  className="no-spin"
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
                                  style={{ ...s, width: 60 }}
                                  placeholder="500"
                                />
                                <UnitSelect
                                  value={editForm.unit}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      unit: e.target.value,
                                    })
                                  }
                                  style={{
                                    ...s,
                                    width: 40,
                                    padding: "3px 2px",
                                  }}
                                />
                              </div>
                            )}
                          </td>
                          <td
                            style={{
                              verticalAlign: "top",
                              padding: "8px 6px",
                            }}
                          >
                            <div style={fl}>
                              {editForm.sold_by_weight
                                ? tString(t, "price_per_kg_lbl")
                                : tString(t, "price_per_opak_lbl")}
                            </div>
                            <input
                              type="number"
                              className="no-spin"
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
                              style={{
                                ...s,
                                width: "100%",
                                boxSizing: "border-box",
                              }}
                            />
                          </td>
                          <td
                            style={{
                              verticalAlign: "middle",
                              padding: "8px 6px",
                              borderBottom: "1px solid #0d948860",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                flexDirection: "column",
                              }}
                            >
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ padding: "5px 10px", fontSize: 12 }}
                                onClick={handleSaveEdit}
                              >
                                {tString(t, "save_btn")}
                              </button>
                              <button
                                type="button"
                                className="btn"
                                style={{
                                  padding: "5px 10px",
                                  fontSize: 12,
                                  background: "#374151",
                                  color: "#9ca3af",
                                }}
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
                      style={{
                        textAlign: "center",
                        color: "#6b7280",
                        fontStyle: search.trim() ? "italic" : "normal",
                      }}
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
                      style={{
                        textAlign: "center",
                        color: "#4b5563",
                        padding: "10px 0",
                        fontSize: 12,
                      }}
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
