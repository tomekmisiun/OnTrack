import { nutrition } from '../api';

/** Fetch per-100g macros via backend (local DB → cache → DeepSeek). */
export async function fetchProductMacros(name, lang = 'pl') {
  try {
    const res = await nutrition.lookup(name, lang);
    const d = res.data;
    if (!d?.found) return { macros: null, source: null, error: d?.error };
    return {
      macros: {
        kcal: d.kcal,
        protein: d.protein,
        fat: d.fat,
        carbs: d.carbs,
      },
      source: d.source,
    };
  } catch (e) {
    const data = e.response?.data;
    if (data?.found === false) {
      return { macros: null, source: null, error: data.error || 'not_found' };
    }
    return {
      macros: null,
      source: null,
      error: data?.error || 'lookup_failed',
    };
  }
}
