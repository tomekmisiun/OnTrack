"use client";

import { useEffect, useState } from "react";
import { updateProduct } from "@/lib/api/products";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { tString } from "@/lib/i18n/translate";

export type SummaryProductItem = {
  product_id: number;
  product_name: string;
  total_weight: number;
  unit: string;
  package_weight: number;
  sold_by_weight: boolean;
  price_per_package: number;
  packages_exact: number;
  packages_rounded: number;
  actual_cost: number;
  total_cost: number;
  stockMode?: "all" | "part" | null;
  stockAmt?: string;
};

type SummaryProductTableProps = {
  items: SummaryProductItem[];
  onTotalChange?: (total: number) => void;
};

export function SummaryProductTable({ items, onTotalChange }: SummaryProductTableProps) {
  const { t } = useLanguage();
  const txt = (key: TranslationKey) => tString(t, key);
  const displayUnit = (u: string) => (u === "szt" ? txt("unit_pcs") : u || "g");
  const [localItems, setLocalItems] = useState(items);
  const [editPkgId, setEditPkgId] = useState<number | null>(null);
  const [editPkg, setEditPkg] = useState("");
  const [editSBW, setEditSBW] = useState(false);
  const [editPriceId, setEditPriceId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState("");

  useEffect(() => {
    setLocalItems((prev) => {
      const byId = Object.fromEntries(prev.map((i) => [i.product_id, i]));
      return items.map((item) => ({
        ...item,
        stockMode: byId[item.product_id]?.stockMode || null,
        stockAmt: byId[item.product_id]?.stockAmt || "",
      }));
    });
  }, [items]);

  const getAdjustedCostFor = (item: SummaryProductItem) => {
    if (item.stockMode === "all") return 0;
    if (item.stockMode === "part") {
      const stock = parseFloat(item.stockAmt || "") || 0;
      if (stock <= 0) return item.total_cost;
      const stockGrams = item.sold_by_weight ? stock : stock * item.package_weight;
      const remaining = Math.max(0, item.total_weight - stockGrams);
      if (remaining === 0) return 0;
      if (item.sold_by_weight) {
        return (remaining * item.price_per_package) / item.package_weight;
      }
      return Math.ceil(remaining / item.package_weight) * item.price_per_package;
    }
    return item.total_cost;
  };

  const updItem = (product_id: number, patch: Partial<SummaryProductItem>) =>
    setLocalItems((prev) => {
      const next = prev.map((i) => (i.product_id === product_id ? { ...i, ...patch } : i));
      if (onTotalChange) {
        const total = next.reduce((s, i) => s + getAdjustedCostFor(i), 0);
        onTotalChange(total);
      }
      return next;
    });

  const recalcPkg = (item: SummaryProductItem, newPkg: number, sbw: boolean) => {
    const pricePerUnit =
      item.unit === "szt"
        ? item.price_per_package / item.package_weight
        : (item.price_per_package * 100) / item.package_weight;
    const newPkgPrice =
      item.unit === "szt" ? pricePerUnit * newPkg : (pricePerUnit * newPkg) / 100;
    const pkgsExact = item.total_weight / newPkg;
    const pkgsRounded = sbw ? pkgsExact : Math.ceil(pkgsExact);
    return {
      ...item,
      package_weight: newPkg,
      sold_by_weight: sbw,
      price_per_package: newPkgPrice,
      packages_exact: pkgsExact,
      packages_rounded: pkgsRounded,
      actual_cost: pkgsExact * newPkgPrice,
      total_cost: pkgsRounded * newPkgPrice,
    };
  };

  const recalcPrice = (item: SummaryProductItem, newPkgPrice: number) => {
    const pkgsRounded = item.sold_by_weight
      ? item.packages_exact
      : Math.ceil(item.packages_exact);
    return {
      ...item,
      price_per_package: newPkgPrice,
      actual_cost: item.packages_exact * newPkgPrice,
      total_cost: pkgsRounded * newPkgPrice,
    };
  };

  const handleSavePkg = async (item: SummaryProductItem) => {
    const pkg = Math.min(99999, parseFloat(editPkg));
    if (!pkg || pkg <= 0) {
      setEditPkgId(null);
      return;
    }
    const updated = recalcPkg(item, pkg, editSBW);
    setLocalItems((prev) => prev.map((i) => (i.product_id === item.product_id ? updated : i)));
    setEditPkgId(null);
    try {
      await updateProduct(item.product_id, { package_weight: pkg, sold_by_weight: editSBW });
    } catch {
      /* ignore */
    }
  };

  const handleSavePrice = async (item: SummaryProductItem) => {
    const newPkgPrice = Math.min(99999, parseFloat(editPrice));
    if (isNaN(newPkgPrice) || newPkgPrice < 0) {
      setEditPriceId(null);
      return;
    }
    const updated = recalcPrice(item, newPkgPrice);
    setLocalItems((prev) => prev.map((i) => (i.product_id === item.product_id ? updated : i)));
    setEditPriceId(null);
    const unitPrice =
      item.unit === "szt"
        ? newPkgPrice / item.package_weight
        : (newPkgPrice * 100) / item.package_weight;
    try {
      await updateProduct(item.product_id, { price: parseFloat(unitPrice.toFixed(4)) });
    } catch {
      /* ignore */
    }
  };

  const inp = {
    padding: "2px 6px",
    fontSize: 12,
    width: 68,
    border: "1px solid #374151",
    borderRadius: 4,
    background: "#111827",
    color: "#e2e8f0",
  };
  const btn = (bg: string, color: string) => ({
    padding: "1px 6px",
    fontSize: 11,
    background: bg,
    color,
    border: "none",
    borderRadius: 3,
    cursor: "pointer",
  });
  const hintStyle = {
    fontSize: 9,
    fontWeight: 400,
    color: "#2dd4bf",
    display: "block",
    marginTop: 1,
  } as const;

  return (
    <table className="compact-table" style={{ marginTop: 4 }}>
      <thead>
        <tr>
          <th>{txt("col_product")}</th>
          <th>{txt("col_weight_used")}</th>
          <th>
            <span>{txt("col_pkg_size")}</span>
            <span style={hintStyle}>✎ {txt("click_to_edit_hint")}</span>
          </th>
          <th>{txt("col_pcs")}</th>
          <th>
            <span>{txt("col_price_per_pkg")}</span>
            <span style={hintStyle}>✎ {txt("click_to_edit_hint")}</span>
          </th>
          <th style={{ whiteSpace: "nowrap" }}>
            <span>{txt("col_in_stock")}</span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 400,
                color: "#2dd4bf",
                display: "block",
                marginTop: 1,
              }}
            >
              {txt("col_reduces_cost")}
            </span>
          </th>
          <th>{txt("col_shopping")}</th>
          <th>{txt("col_cost")}</th>
        </tr>
      </thead>
      <tbody>
        {localItems.map((item, i) => (
          <tr key={i}>
            <td style={{ fontSize: 13, color: "#e2e8f0" }}>{item.product_name}</td>
            <td style={{ fontSize: 13, color: "#9ca3af" }}>
              {item.total_weight} {displayUnit(item.unit)}
            </td>

            <td
              style={{ cursor: "pointer" }}
              onClick={() => {
                if (editPkgId === item.product_id) return;
                setEditPkgId(item.product_id);
                setEditPkg(String(item.package_weight));
                setEditSBW(!!item.sold_by_weight);
                setEditPriceId(null);
              }}
            >
              {editPkgId === item.product_id ? (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                    <input
                      type="number"
                      min="0"
                      max="99999"
                      value={editPkg}
                      onChange={(e) => setEditPkg(e.target.value)}
                      className="no-spin"
                      style={inp}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleSavePkg(item);
                        if (e.key === "Escape") setEditPkgId(null);
                      }}
                    />
                    <span style={{ fontSize: 11, color: "#6b7280" }}>{displayUnit(item.unit)}</span>
                  </div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={editSBW}
                      onChange={(e) => setEditSBW(e.target.checked)}
                    />
                    {txt("sold_by_weight_label")}
                  </label>
                  <div style={{ display: "flex", gap: 3 }}>
                    <button style={btn("#0d9488", "#1f2937")} onClick={() => void handleSavePkg(item)}>
                      ✓ {txt("save_btn")}
                    </button>
                    <button style={btn("#374151", "#9ca3af")} onClick={() => setEditPkgId(null)}>
                      ✗
                    </button>
                  </div>
                </div>
              ) : (
                <span style={{ fontSize: 13, color: "#9ca3af" }}>
                  {item.sold_by_weight
                    ? txt("weight_btn")
                    : `${item.package_weight} ${displayUnit(item.unit)}`}
                </span>
              )}
            </td>

            <td>
              {item.sold_by_weight ? (
                <span style={{ fontSize: 13, color: "#9ca3af" }}>{txt("by_weight_label")}</span>
              ) : (
                <span
                  style={{
                    background: "#0d9488",
                    color: "white",
                    padding: "2px 8px",
                    borderRadius: 10,
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  {item.packages_rounded} {txt("col_pcs")}
                </span>
              )}
            </td>

            <td
              style={{ cursor: "pointer" }}
              onClick={() => {
                if (editPriceId === item.product_id) return;
                setEditPriceId(item.product_id);
                setEditPrice(item.price_per_package.toFixed(2));
                setEditPkgId(null);
              }}
            >
              {editPriceId === item.product_id ? (
                <div
                  style={{ display: "flex", gap: 3, alignItems: "center" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="99999"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="no-spin"
                    style={{ ...inp, width: 72 }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleSavePrice(item);
                      if (e.key === "Escape") setEditPriceId(null);
                    }}
                  />
                  <span style={{ fontSize: 11, color: "#6b7280" }}>{txt("currency")}</span>
                  <button style={btn("#0d9488", "#1f2937")} onClick={() => void handleSavePrice(item)}>
                    ✓
                  </button>
                  <button style={btn("#374151", "#9ca3af")} onClick={() => setEditPriceId(null)}>
                    ✗
                  </button>
                </div>
              ) : (
                <span style={{ fontSize: 13, color: "#9ca3af" }}>
                  {item.price_per_package.toFixed(2)} {txt("currency")}
                </span>
              )}
            </td>

            <td>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <button
                  onClick={() =>
                    updItem(item.product_id, {
                      stockMode: item.stockMode === "all" ? null : "all",
                      stockAmt: "",
                    })
                  }
                  style={{
                    padding: "4px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "1px solid #374151",
                    borderRadius: 5,
                    transition: "all 0.15s",
                    background: item.stockMode === "all" ? "#0d9488" : "#2d3748",
                    color: item.stockMode === "all" ? "white" : "#9ca3af",
                  }}
                >
                  {txt("stock_full")}
                </button>
                <button
                  onClick={() =>
                    updItem(item.product_id, {
                      stockMode: item.stockMode === "part" ? null : "part",
                      stockAmt: "",
                    })
                  }
                  style={{
                    padding: "4px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "1px solid #374151",
                    borderRadius: 5,
                    transition: "all 0.15s",
                    background: item.stockMode === "part" ? "#0d9488" : "#2d3748",
                    color: item.stockMode === "part" ? "white" : "#9ca3af",
                  }}
                >
                  {txt("stock_part")}
                </button>
                {item.stockMode === "part" && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 3,
                      marginTop: 2,
                    }}
                  >
                    <span style={{ fontSize: 13, color: "#9ca3af", whiteSpace: "nowrap" }}>
                      {txt("enter_amount_label")}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="99999"
                      step={item.sold_by_weight ? 0.5 : 1}
                      value={item.stockAmt}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (parseFloat(v) > 99999) return;
                        updItem(item.product_id, { stockAmt: v });
                      }}
                      className="no-spin"
                      style={{
                        padding: "2px 4px",
                        fontSize: 13,
                        width: 44,
                        boxSizing: "border-box",
                        border: "1px solid #374151",
                        borderRadius: 4,
                        background: "#111827",
                        color: "#e2e8f0",
                      }}
                      placeholder="0"
                    />
                    <span style={{ fontSize: 13, color: "#9ca3af" }}>
                      {item.sold_by_weight ? displayUnit(item.unit) : txt("col_pcs")}
                    </span>
                  </div>
                )}
              </div>
            </td>

            <td>
              {(() => {
                const adj = getAdjustedCostFor(item);
                const reduced = item.stockMode && adj < item.total_cost;
                return (
                  <div>
                    <span style={{ fontSize: 13, color: item.stockMode ? "#22c55e" : "#9ca3af" }}>
                      {adj.toFixed(2)} {txt("currency")}
                    </span>
                    {reduced && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#4b5563",
                          textDecoration: "line-through",
                        }}
                      >
                        {item.total_cost.toFixed(2)} {txt("currency")}
                      </div>
                    )}
                  </div>
                );
              })()}
            </td>

            <td style={{ fontSize: 13, color: "#9ca3af" }}>
              {(() => {
                const cur = txt("currency");
                if (item.stockMode === "all") return `0.00 ${cur}`;
                if (item.stockMode === "part") {
                  const stock = parseFloat(item.stockAmt || "") || 0;
                  if (stock <= 0) return `${item.actual_cost.toFixed(2)} ${cur}`;
                  const remaining = Math.max(0, item.total_weight - stock);
                  if (remaining === 0) return `0.00 ${cur}`;
                  const adjActual = (remaining / item.total_weight) * item.actual_cost;
                  return `${adjActual.toFixed(2)} ${cur}`;
                }
                return `${item.actual_cost.toFixed(2)} ${cur}`;
              })()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
