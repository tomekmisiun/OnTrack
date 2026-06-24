import { normalizeProductPage, PRODUCT_PAGE_SIZE } from './productPage';

describe('normalizeProductPage', () => {
  it('unwraps paginated API envelope', () => {
    const page = normalizeProductPage({ items: [{ id: 1 }], total: 10, limit: 20, offset: 0 });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(10);
    expect(page.limit).toBe(20);
  });

  it('supports legacy array responses', () => {
    const page = normalizeProductPage([{ id: 1 }, { id: 2 }]);
    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(2);
  });

  it('defaults missing fields', () => {
    const page = normalizeProductPage({});
    expect(page.items).toEqual([]);
    expect(page.limit).toBe(PRODUCT_PAGE_SIZE);
  });
});

describe('product permissions flags', () => {
  const system = { id: 1, name: 'Milk', is_system: true, is_editable: false };
  const own = { id: 2, name: 'Mine', is_system: false, is_editable: true };

  it('system rows are not deletable in UI logic', () => {
    expect(system.is_editable).toBe(false);
    expect(own.is_editable).toBe(true);
  });
});
