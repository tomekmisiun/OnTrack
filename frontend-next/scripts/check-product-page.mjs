import { strict as assert } from "node:assert";

const PRODUCT_PAGE_SIZE = 50;

function normalizeProductPage(data) {
  if (Array.isArray(data)) {
    return { items: data, total: data.length, limit: data.length, offset: 0 };
  }
  if (typeof data === "object" && data !== null) {
    return {
      items: Array.isArray(data.items) ? data.items : [],
      total: typeof data.total === "number" ? data.total : 0,
      limit: typeof data.limit === "number" ? data.limit : PRODUCT_PAGE_SIZE,
      offset: typeof data.offset === "number" ? data.offset : 0,
    };
  }
  return { items: [], total: 0, limit: PRODUCT_PAGE_SIZE, offset: 0 };
}

assert.deepEqual(
  normalizeProductPage({
    items: [{ id: 1 }],
    total: 10,
    limit: 20,
    offset: 0,
  }),
  { items: [{ id: 1 }], total: 10, limit: 20, offset: 0 },
);

const legacy = normalizeProductPage([{ id: 1 }, { id: 2 }]);
assert.equal(legacy.items.length, 2);
assert.equal(legacy.total, 2);

const empty = normalizeProductPage({});
assert.deepEqual(empty.items, []);
assert.equal(empty.limit, PRODUCT_PAGE_SIZE);

const system = { id: 1, name: "Milk", is_system: true, is_editable: false };
const own = { id: 2, name: "Mine", is_system: false, is_editable: true };
assert.equal(system.is_editable, false);
assert.equal(own.is_editable, true);

console.log("product page helpers: ok");
