export type Product = {
  id: number;
  catalog_key: string | null;
  name: string;
  package_weight: number | null;
  price: number | null;
  currency: string | null;
  has_price: boolean;
  unit: string | null;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  sold_by_weight: boolean;
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
  if (typeof row.sold_by_weight !== "boolean") return null;
  if (typeof row.is_system !== "boolean" || typeof row.is_editable !== "boolean") {
    return null;
  }

  const numOrNull = (v: unknown): number | null =>
    typeof v === "number" ? v : null;

  const price = numOrNull(row.price);
  const packageWeight = numOrNull(row.package_weight);
  const hasPrice = row.has_price === true || (row.has_price !== false && price != null);

  return {
    id: row.id,
    catalog_key: typeof row.catalog_key === "string" ? row.catalog_key : null,
    name: row.name,
    package_weight: packageWeight,
    price,
    currency: typeof row.currency === "string" ? row.currency : null,
    has_price: hasPrice,
    unit: typeof row.unit === "string" ? row.unit : null,
    kcal: numOrNull(row.kcal),
    protein: numOrNull(row.protein),
    fat: numOrNull(row.fat),
    carbs: numOrNull(row.carbs),
    sold_by_weight: row.sold_by_weight,
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
