export type Product = {
  id: number;
  name: string;
  package_weight: number;
  price: number;
  unit: string;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  sold_by_weight: boolean;
  lang: string;
  source: string;
  is_system: boolean;
  is_editable: boolean;
  base_product_id: number | null;
};

export type ProductForm = {
  name: string;
  package_weight: string;
  package_price: string;
  unit: string;
  sold_by_weight: boolean;
};

export type ProductEditForm = ProductForm & {
  kcal: string | number;
  protein: string | number;
  fat: string | number;
  carbs: string | number;
};

export type ParsedProductText = {
  name: string;
  package_price: string;
  package_weight: string;
  unit: string;
  sold_by_weight: boolean;
};

export type ImportRawItem = {
  receipt_name: string;
  receipt_price?: number | null;
  receipt_quantity?: number | null;
  receipt_unit?: string;
  matched_product: Product | null;
  suggested_price?: number | null;
};

export type ImportItem = ImportRawItem & {
  selected: boolean;
  price: string;
  weight: string;
  unit: string;
  _unitPrice?: number | null;
  sold_by_weight: boolean;
};

export function parseProduct(data: unknown): Product | null {
  if (typeof data !== "object" || data === null) return null;
  const row = data as Record<string, unknown>;
  if (typeof row.id !== "number" || typeof row.name !== "string") return null;
  if (typeof row.package_weight !== "number" || typeof row.price !== "number") {
    return null;
  }
  if (typeof row.unit !== "string") return null;
  if (typeof row.sold_by_weight !== "boolean") return null;
  if (typeof row.is_system !== "boolean" || typeof row.is_editable !== "boolean") {
    return null;
  }

  const numOrNull = (v: unknown): number | null =>
    typeof v === "number" ? v : null;

  return {
    id: row.id,
    name: row.name,
    package_weight: row.package_weight,
    price: row.price,
    unit: row.unit,
    kcal: numOrNull(row.kcal),
    protein: numOrNull(row.protein),
    fat: numOrNull(row.fat),
    carbs: numOrNull(row.carbs),
    sold_by_weight: row.sold_by_weight,
    lang: typeof row.lang === "string" ? row.lang : "pl",
    source: typeof row.source === "string" ? row.source : "user",
    is_system: row.is_system,
    is_editable: row.is_editable,
    base_product_id:
      typeof row.base_product_id === "number" ? row.base_product_id : null,
  };
}

export function parseProductList(data: unknown): Product[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => parseProduct(item))
    .filter((item): item is Product => item !== null);
}
