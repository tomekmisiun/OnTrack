import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { recipes as api, products as productsApi } from '../api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { fuzzySearch, productMatchesIngredient, pickBestMatchingProduct } from '../utils/search';
import { canonicalizeIngredient, canonicalDiffersFromRaw } from '../utils/ingredientCanonical';
import { fetchProductMacros } from '../utils/macroLookup';
import './Recipes.css';

const PROMPT_NAME_MARK = '{{name}}';

function recipePromptPlainText(t) {
  return t('recipe_prompt').split(PROMPT_NAME_MARK).join(t('recipe_name_lbl'));
}

function renderRecipePrompt(text, nameLabel) {
  const parts = text.split(PROMPT_NAME_MARK);
  return parts.map((part, i) => (
    <React.Fragment key={i}>
      {part}
      {i < parts.length - 1 && (
        <strong style={{ color: '#2dd4bf', fontWeight: 800 }}>{nameLabel}</strong>
      )}
    </React.Fragment>
  ));
}

function RecipeHelpModal({ open, onClose, t, promptCopied, onCopyPrompt, nameLabel }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="recipes-help-modal-backdrop" onClick={onClose}>
      <div className="recipes-help-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="recipe-help-title">
        <div className="recipes-help-modal-header">
          <h2 id="recipe-help-title" className="recipes-help-modal-title">{t('how_to_recipe')}</h2>
          <button type="button" className="recipes-help-modal-close" onClick={onClose} aria-label={t('cancel')}>×</button>
        </div>
        <div className="recipes-help-modal-body dark-scroll">
          <div className="recipes-prompt-box">
            <div className="recipes-prompt-intro">
              {t('use_ai_hint')}{' '}
              <a href="https://claude.ai/" target="_blank" rel="noreferrer">Claude</a>
              {' / '}
              <a href="https://gemini.google.com/app" target="_blank" rel="noreferrer">Gemini</a>
              {' / '}
              <a href="https://chatgpt.com/" target="_blank" rel="noreferrer">ChatGPT</a>
              {t('use_ai_hint2')}
            </div>
            <div className="recipes-prompt-scroll">
              <pre className="recipes-prompt-pre">{renderRecipePrompt(t('recipe_prompt'), nameLabel)}</pre>
              <button
                type="button"
                className={`recipes-prompt-copy${promptCopied ? ' recipes-prompt-copy--done' : ''}`}
                onClick={onCopyPrompt}
              >
                {promptCopied ? t('copied_label') : t('copy_prompt_btn')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Regex parser ────────────────────────────────────────────────────────────

const POLISH_UNITS = [
  { re: /szklank[iaę]|szklanek/i,    g: 250 },
  { re: /łyżk[iaę]|łyżek(?!czk)/i,  g: 15  },
  { re: /łyżeczk[iaę]|łyżeczek/i,   g: 5   },
  { re: /szczypt[aę]|szczypty/i,     g: 1   },
  { re: /garśc[i]?|garść/i,          g: 30  },
  { re: /pęczk[iaó]?|pęczków/i,      g: 50  },
  { re: /kostek?|kostki|kostkę/i,    g: 200 },
];
const ENGLISH_UNITS = [
  { re: /\bcups?\b|\bc\b(?!\w)/i,              ml: 240, g: 240 },
  { re: /tablespoons?|tbsp\.?/i,               g: 15 },
  { re: /teaspoons?|tsp\.?/i,                  g: 5 },
  { re: /(?:pounds?|lbs?\.?)/i,                g: 454 },
  { re: /(?:ounces?|oz\.?)/i,                  g: 28 },
];
const PIECE_WORDS = /jajk[ao]|jajek|jaja?(?=\s)|jaj\b|sztuk[ia]?|szt\.?|\beggs?\b|\bcloves?\b|\bonions?\b|\bpieces?\b|\bpcs\b/i;
const FRACTION_WORDS = { 'pół': 0.5, 'ćwierć': 0.25, 'half': 0.5, 'quarter': 0.25 };

function parseNum(s) {
  if (!s) return null;
  s = s.trim();
  for (const [w, v] of Object.entries(FRACTION_WORDS)) if (s.toLowerCase().startsWith(w)) return v;
  const f = /^(\d+)\s*\/\s*(\d+)/.exec(s);
  if (f) return parseInt(f[1]) / parseInt(f[2]);
  return parseFloat(s.replace(',', '.')) || null;
}

function parseWeight(text) {
  const stdRe = /(\d+(?:[.,]\d+)?)\s*(kg|litr(?:[óo]w|a)?|ml|g|l\b|lb|lbs|pound|pounds|oz|ounce|ounces)/gi;
  let first = null, m;
  while ((m = stdRe.exec(text)) !== null) { if (!first) first = m; }
  if (first) {
    let val = parseFloat(first[1].replace(',', '.'));
    const unit = first[2].toLowerCase();
    if (unit === 'kg') val *= 1000;
    if (unit.startsWith('litr') || unit === 'l') val *= 1000;
    if (unit === 'lb' || unit === 'lbs' || unit === 'pound' || unit === 'pounds') val *= 454;
    if (unit === 'oz' || unit === 'ounce' || unit === 'ounces') val *= 28;
    const isVol = unit === 'ml' || unit.startsWith('litr') || unit === 'l';
    return { weight: Math.min(99999, Math.round(val)), unit: isVol ? 'ml' : 'g', matchIndex: first.index, matchEnd: first.index + first[0].length };
  }
  for (const { re, g, ml } of ENGLISH_UNITS) {
    const unitM = re.exec(text);
    if (unitM) {
      const beforeUnit = text.slice(0, unitM.index).trim();
      const fracM = /(pół|half|quarter|ćwierć|\d+(?:[.,]\d+)?|\d+\/\d+)\s*$/i.exec(beforeUnit);
      const count = fracM ? (parseNum(fracM[1]) ?? 1) : 1;
      const perUnit = ml ?? g;
      const useMl = Boolean(ml);
      const nameBeforeUnit = beforeUnit.replace(/(pół|half|quarter|ćwierć|\d+(?:[.,]\d+)?|\d+\/\d+)\s*$/i, '').trim();
      const matchEnd = unitM.index + unitM[0].length;
      const afterUnit = text.slice(matchEnd).trim().split(/\s*[,(-]/)[0].trim();
      const forcedName = nameBeforeUnit.length < 2 ? afterUnit : undefined;
      return { weight: Math.min(99999, Math.round(count * perUnit)), unit: useMl ? 'ml' : 'g', matchIndex: fracM ? unitM.index - fracM[0].length : unitM.index, matchEnd, forcedName };
    }
  }
  for (const { re, g } of POLISH_UNITS) {
    const unitM = re.exec(text);
    if (unitM) {
      const beforeUnit = text.slice(0, unitM.index).trim();
      const fracM = /(pół|ćwierć|\d+(?:[.,]\d+)?|\d+\/\d+)\s*$/i.exec(beforeUnit);
      const count = fracM ? (parseNum(fracM[1]) ?? 1) : 1;
      const nameBeforeUnit = beforeUnit.replace(/(pół|ćwierć|\d+(?:[.,]\d+)?|\d+\/\d+)\s*$/i, '').trim();
      const matchEnd = unitM.index + unitM[0].length;
      const afterUnit = text.slice(matchEnd).trim().split(/\s*[,(-]/)[0].trim();
      const forcedName = nameBeforeUnit.length < 2 ? afterUnit : undefined;
      return { weight: Math.min(99999, Math.round(count * g)), unit: 'g', matchIndex: fracM ? unitM.index - fracM[0].length : unitM.index, matchEnd, forcedName };
    }
  }
  const pieceM = PIECE_WORDS.exec(text);
  if (pieceM) {
    const before = text.slice(0, pieceM.index);
    const numBefore = /(\d+)\s*$/.exec(before.trim());
    const after = text.slice(pieceM.index + pieceM[0].length);
    const numAfter = /^\s*(\d+)\s*(szt\w*)?/i.exec(after);
    const count = numBefore ? parseInt(numBefore[1], 10)
      : numAfter ? parseInt(numAfter[1], 10) : 1;
    return { weight: count, unit: 'szt', matchIndex: pieceM.index, matchEnd: pieceM.index + pieceM[0].length, forcedName: pieceM[0].toLowerCase() };
  }
  const bareM = /^(\d+)\s+/.exec(text);
  if (bareM) return { weight: parseInt(bareM[1]), unit: 'szt', matchIndex: 0, matchEnd: bareM[0].length, forcedName: null };
  return null;
}

const JUNK_PREFIX = /^[\d/.,\s]*(po\s+)?(pół|half|quarter|ćwierć|płask\w*|duż\w*|mał\w*|śwież\w*|ugotown\w*|młod\w*|klarowan\w*|słodk\w*|ostr\w*|fresh|grated|chopped|diced|minced|skinless|niepełn\w*|niepeln\w*|szczypt\w*|średni\w*|sredni\w*)?\s*/i;
const JUNK_SUFFIX = /\s*(duże?|małe?|świeże?|ugotowane?|na\s+twardo|można\s+pominąć|klarowanego?|optional|chopped|diced|minced|grated|skinless|fresh|i\s+\w.*)$/i;
const UNIT_WORDS = /\b(szklank\w+|łyżk\w+|łyżeczk\w+|pęczk\w+|garśc\w*|kostek?|kostki|kostkę|cups?|tablespoons?|teaspoons?|tbsp\.?|tsp\.?|pounds?|ounces?)\b\s*/gi;

function extractName(content, parsed) {
  if (parsed.forcedName) return parsed.forcedName;
  let before = content.substring(0, parsed.matchIndex).trim();
  const dashIdx = before.lastIndexOf(' - ');
  if (dashIdx > 0) before = before.substring(0, dashIdx).trim();
  before = before.replace(JUNK_PREFIX, '').replace(UNIT_WORDS, '').replace(JUNK_SUFFIX, '').trim();
  if (before.length >= 3) return before;
  return content.substring(parsed.matchEnd || parsed.matchIndex).trim()
    .replace(/\s*[-,(].*$/, '').replace(/\s+i\s+.*$/i, '')
    .replace(JUNK_PREFIX, '').replace(UNIT_WORDS, '').replace(JUNK_SUFFIX, '').trim();
}

function parseSegments(content) {
  const clean = content.replace(/^[^:]+:\s*/, '').trim();
  const results = [];
  const parsed = parseWeight(clean);
  if (!parsed) return results;
  const ingName = extractName(clean, parsed);
  if (ingName && ingName.length >= 2) results.push({ rawName: ingName, weight: parsed.weight, unit: parsed.unit });
  const afterUnit = clean.substring(parsed.matchEnd || parsed.matchIndex).trim();
  const andMatch = /\s+i\s+(\w+)/i.exec(afterUnit);
  if (andMatch && andMatch[1].length >= 3) results.push({ rawName: andMatch[1], weight: parsed.weight, unit: parsed.unit });
  return results;
}

function parseRecipeText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const name = lines[0].replace(/^#+\s*/, '').trim();
  const ingredients = [];
  for (const line of lines.slice(1)) {
    if (line.includes('http')) continue;
    const content = line.replace(/^[-•*]\s*/, '').trim();
    const segments = content.includes(',') ? content.split(/,\s+/) : [content];
    for (const seg of segments) for (const r of parseSegments(seg)) ingredients.push({ ...r, product_id: null });
  }
  return { name, ingredients };
}

function matchProducts(ingredients, products) {
  return ingredients.map(ing => enrichIngredient(ing, products));
}

function enrichIngredient(ing, products) {
  const canonicalName = ing.canonicalName || canonicalizeIngredient(ing.rawName);
  const ingUnit = ing.unit || 'g';
  const match = pickBestMatchingProduct(canonicalName, products, ingUnit);
  const product_id = ing.product_id
    ? resolveProductId(canonicalName, ing.product_id, products, ingUnit)
    : (match?.id ?? null);
  return {
    ...ing,
    canonicalName,
    unit: ingUnit,
    product_id: product_id ?? null,
  };
}

function resolveProductId(canonicalName, productId, products, ingUnit) {
  if (!productId) return null;
  const product = products.find(p => p.id === productId);
  return product && productMatchesIngredient(canonicalName, product, ingUnit) ? productId : null;
}

function buildParsedFromText(text, products, prev) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const result = parseRecipeText(trimmed);
  if (!result) return null;
  const ingredients = matchProducts(result.ingredients, products);
  const base = { name: result.name, ingredients, sourceText: trimmed };
  if (!prev) {
    return { ...base, servings: '', category: null };
  }
  const prevByName = Object.fromEntries(
    prev.ingredients.map(ing => [ing.rawName.toLowerCase(), ing])
  );
  return {
    ...base,
    category: prev.category,
    servings: prev.servings,
    ingredients: ingredients.map((ing, i) => {
      const old = prevByName[ing.rawName.toLowerCase()] || prev.ingredients[i];
      if (!old) return ing;
      const canonicalName = ing.canonicalName || canonicalizeIngredient(ing.rawName);
      const keptProductId = old.product_id
        ? resolveProductId(canonicalName, old.product_id, products, ing.unit || 'g')
        : null;
      return {
        ...ing,
        product_id: keptProductId ?? ing.product_id,
        weight: old.weight ?? ing.weight,
        unit: old.unit ?? ing.unit,
      };
    }),
  };
}

// ─── Categories ──────────────────────────────────────────────────────────────

const CAT_COLORS = { breakfast: '#f59e0b', lunch: '#10b981', dinner: '#6366f1', snack: '#0ea5e9', dessert: '#ec4899' };

// ─── Component ────────────────────────────────────────────────────────────────

export default function Recipes() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const displayUnit = u => u === 'szt' ? t('unit_pcs') : u;
  const CATEGORIES = [
    { value: 'breakfast', label: t('cat_breakfast'), color: CAT_COLORS.breakfast },
    { value: 'lunch',     label: t('cat_lunch'),     color: CAT_COLORS.lunch },
    { value: 'dinner',    label: t('cat_dinner'),    color: CAT_COLORS.dinner },
    { value: 'snack',     label: t('cat_snack'),     color: CAT_COLORS.snack },
    { value: 'dessert',   label: t('cat_dessert'),   color: CAT_COLORS.dessert },
  ];
  const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c]));
  const { showError, showSuccess, showConfirm } = useToast();
  const [recipeList, setRecipeList] = useState([]);
  const [productList, setProductList] = useState([]);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [expandedDetail, setExpandedDetail] = useState(null);
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [editingName, setEditingName] = useState(null);
  const [editingIngredients, setEditingIngredients] = useState(null);
  const [editingIngCell, setEditingIngCell] = useState(null); // { key, field: 'weight'|'macro'|'name', val/vals }
  const [addingIng, setAddingIng] = useState(null); // { recipeId, search, product, weight, showDrop }
  const [addingProductFor, setAddingProductFor] = useState(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const [quickForm, setQuickForm] = useState({ name: '', package_weight: '100', package_price: '', unit: 'g', sold_by_weight: false });
  const [listOpen, setListOpen] = useState(true);
  const [recipeHelpModalOpen, setRecipeHelpModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [visibleCount, setVisibleCount] = useState(50);
  const textareaRef = useRef(null);
  const sentinelRef = useRef(null);

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const exitSelection = () => { setSelectionMode(false); setSelectedIds(new Set()); };

  const handleDeleteSelected = () => {
    showConfirm({
      title: t('del_selected_recipes_title'),
      message: t('confirm_del_selected_recipes')(selectedIds.size),
      confirmLabel: t('delete'),
      onConfirm: async () => {
        try {
          await Promise.all([...selectedIds].map(id => api.delete(id)));
          showSuccess(t('recipes_deleted')(selectedIds.size));
          exitSelection();
          loadRecipes();
        } catch { showError(t('del_during_err')); }
      },
    });
  };

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  useEffect(() => { loadRecipes(); loadProducts(); }, [user?.lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pasteText.trim()) {
      setParsed(null);
      setAddingProductFor(null);
      return;
    }
    setParsed(prev => buildParsedFromText(pasteText, productList, prev));
  }, [pasteText, productList]);

  const filteredRecipes = useMemo(() => {
    const q = search.trim();
    let list = q ? recipeList.filter(r => fuzzySearch(q, r.name)) : recipeList;
    if (categoryFilter) list = list.filter(r => r.category === categoryFilter);
    return [...list].sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0));
  }, [recipeList, search, categoryFilter]);

  useEffect(() => { setVisibleCount(50); }, [search]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting)
        setVisibleCount(v => Math.min(v + 50, filteredRecipes.length));
    }, { rootMargin: '300px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [filteredRecipes.length]);

  const loadRecipes = async () => {
    try { setRecipeList((await api.getAll()).data); } catch { showError(t('err_load_recipes_list')); }
  };
  const loadExpandedDetail = async (id) => {
    try { setExpandedDetail((await api.get(id)).data); } catch {}
  };
  const loadProducts = async () => {
    try { setProductList((await productsApi.getAll()).data); } catch {}
  };

  const fetchMacro = async (name) => {
    const { macros } = await fetchProductMacros(name, lang);
    return macros;
  };

  const handleQuickAdd = async (ingIndex) => {
    if (!quickForm.name.trim() || !quickForm.package_price) { showError(t('err_fill_fields')); return; }
    const sbw = !!quickForm.sold_by_weight;
    let unit = sbw ? 'g' : quickForm.unit;
    let pkgW = sbw ? 1000 : (parseFloat(quickForm.package_weight) || 100);
    if (!sbw && unit === 'kg') { unit = 'g';  pkgW = Math.min(99999, pkgW * 1000); }
    if (!sbw && unit === 'l')  { unit = 'ml'; pkgW = Math.min(99999, pkgW * 1000); }
    const pkgPrice = parseFloat(quickForm.package_price) || 0;
    const unitPrice = unit === 'szt' ? pkgPrice / pkgW : (pkgPrice / pkgW) * 100;
    const name = quickForm.name.trim();
    const duplicate = productList.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (duplicate) { showError(t('product_exists_err')(duplicate.name)); return; }
    try {
      const res = await productsApi.create({ name, package_weight: pkgW, price: unitPrice, unit, sold_by_weight: sbw });
      const newId = res.data.id;
      updateIngredient(ingIndex, 'product_id', newId);
      setAddingProductFor(null);
      showSuccess(t('product_adding')(name));
      const macro = await fetchMacro(name);
      if (macro) await productsApi.update(newId, macro);
      await loadProducts();
      showSuccess(t('product_added_macro')(name, !!macro));
    } catch { showError(t('err_fill_fields')); }
  };

  const updateIngredient = (i, field, val) => {
    setParsed(prev => {
      if (!prev) return prev;
      const u = [...prev.ingredients];
      u[i] = { ...u[i], [field]: val };
      return { ...prev, ingredients: u };
    });
  };
  const removeIngredient = (i) => {
    setParsed(prev => prev ? { ...prev, ingredients: prev.ingredients.filter((_, idx) => idx !== i) } : prev);
  };

  const handleSave = async () => {
    if (!parsed?.name) { showError(t('err_no_name')); return; }
    if (!parsed?.category) { showError(t('select_meal_type')); return; }
    const servings = parseInt(parsed.servings, 10);
    if (!servings || servings < 1 || servings > 999) { showError(t('err_no_servings')); return; }
    const valid = parsed.ingredients.filter(i => i.product_id && i.weight > 0);
    if (!valid.length) { showError(t('err_no_ingredients')); return; }
    try {
      const res = await api.create({
        name: parsed.name,
        category: parsed.category || null,
        servings,
        ingredients: valid.map(i => ({ product_id: parseInt(i.product_id), weight: i.weight })),
      });
      const newId = res.data.id;
      setParsed(null);
      setPasteText('');
      setAddingProductFor(null);
      showSuccess(t('recipe_saved'));
      loadRecipes();
      api.fetchImage(newId).then(() => loadRecipes()).catch(() => {});
    } catch (e) { showError(e.response?.data?.error || t('err_save_recipe')); }
  };

  const saveCategory = async (id, category) => {
    try {
      await api.updateCategory(id, category);
      setRecipeList(list => list.map(r => r.id === id ? { ...r, category } : r));
    } catch { showError(t('category_error')); }
    setEditingCategory(null);
  };

  const handleSaveName = async (id) => {
    const name = editingName.text.trim();
    if (!name) return;
    if (name.length > 200) { showError(t('recipe_name_max')); return; }
    try {
      await api.update(id, { name });
      setEditingName(null); showSuccess(t('name_saved_label')); loadRecipes();
    } catch (e) { showError(e.response?.data?.error || t('save_error_label')); }
  };

  const handleSaveIngredients = async (id) => {
    const { rows } = editingIngredients;
    for (const row of rows) {
      if (!row.product_id) { showError(t('each_ing_has_product')); return; }
      if (!row.weight || row.weight <= 0 || row.weight > 99999) { showError(t('weight_range_error')); return; }
    }
    try {
      await api.update(id, { ingredients: rows.map(r => ({ product_id: parseInt(r.product_id), weight: parseFloat(r.weight) })) });
      setEditingIngredients(null); showSuccess(t('save_changes_label')); loadRecipes();
    } catch (e) { showError(e.response?.data?.error || t('save_error_label')); }
  };

  return (
    <div className="recipes-page">
      <div className="card recipes-add-card">
        <h2>{t('add_recipe_title')}</h2>

        <div className="recipes-add-layout">
            <section className="recipes-inspire-band">
              <div className="recipes-section-label">
                <Icon icon="heroicons:light-bulb" width={15} />
                {t('search_inspiration')}
              </div>
              <div className="recipes-inspire-grid">
                {(lang === 'en' ? [
                  { href: 'https://mealpreponfleek.com/', domain: 'mealpreponfleek.com', label: 'mealpreponfleek.com' },
                  { href: 'https://www.allrecipes.com/', domain: 'allrecipes.com', label: 'allrecipes.com' },
                  { href: 'https://www.bbc.co.uk/food/recipes', domain: 'bbc.co.uk', label: 'bbc.co.uk/food' },
                ] : [
                  { href: 'https://aniagotuje.pl/', domain: 'aniagotuje.pl', label: 'aniagotuje.pl' },
                  { href: 'https://www.przepisy.pl/', domain: 'przepisy.pl', label: 'przepisy.pl' },
                  { href: 'https://www.kwestiasmaku.com/', domain: 'kwestiasmaku.com', label: 'kwestiasmaku.com' },
                ]).map(({ href, domain, label }) => (
                  <a
                    key={domain}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="recipes-inspire-link"
                  >
                    <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" />
                    <span>{label}</span>
                  </a>
                ))}
              </div>
            </section>

            <div className="recipes-add-columns">
              <div className="recipes-editor">
                <section className="recipes-format">
                  <div className="recipes-section-label">
                    <Icon icon="heroicons:document-text" width={15} />
                    {t('format_title')}
                  </div>
                  <ol className="recipes-format-steps">
                    <li>
                      <span className="recipes-format-num">1</span>
                      <span><strong>{t('recipe_name_lbl')}</strong> {t('fmt_1_rest')}</span>
                    </li>
                    <li>
                      <span className="recipes-format-num">2</span>
                      <span>{t('fmt_2')}</span>
                    </li>
                    <li>
                      <span className="recipes-format-num">3</span>
                      <span>{t('fmt_3')}</span>
                    </li>
                    <li>
                      <span className="recipes-format-num">4</span>
                      <span>{t('fmt_4')}</span>
                    </li>
                  </ol>
                </section>

                <section className="recipes-compose">
                  <div className="recipes-textarea-wrap">
                    <textarea
                      ref={textareaRef}
                      className="recipes-textarea"
                      value={pasteText}
                      onChange={e => { setPasteText(e.target.value.slice(0, 5000)); resizeTextarea(); }}
                      maxLength={5000}
                      placeholder={t('recipe_ph')}
                    />
                  </div>
                  <div className="recipes-compose-footer">
                    <button
                      type="button"
                      className="pill-help-btn"
                      onClick={() => setRecipeHelpModalOpen(true)}
                      aria-label={t('how_to_recipe')}
                      title={t('how_to_recipe')}
                    >
                      <Icon icon="heroicons:light-bulb" width={15} />
                      <span>{t('how_to_recipe')}</span>
                    </button>
                    <div className={`recipes-char-count${pasteText.length > 4500 ? ' recipes-char-count--warn' : ''}`}>
                      {pasteText.length} / 5000
                    </div>
                  </div>
                </section>
              </div>

              <div className="recipes-live-form">
                <div className="recipes-live-form-head">
                  <Icon icon="heroicons:clipboard-document-list" width={18} />
                  {t('recipe_live_preview_title')}
                </div>

                {!parsed ? (
                  <div className="recipes-live-empty">
                    <Icon icon="heroicons:arrow-left" width={20} className="recipes-live-empty-icon" />
                    <p>{t('recipe_live_preview_empty')}</p>
                  </div>
                ) : (
                  <div className="recipes-live-form-body">
                    <div className="recipes-live-field">
                      <label>{t('recipe_name_lbl')}</label>
                      <input value={parsed.name} onChange={e => setParsed(p => ({ ...p, name: e.target.value }))} />
                    </div>

                    <div className={`recipes-live-block${parsed.category ? '' : ' recipes-live-block--warn'}`}>
                      <span className="recipes-live-block-label">{t('meal_type_label')}</span>
                      <div className="recipes-live-chips">
                        {CATEGORIES.map(cat => (
                          <button
                            key={cat.value}
                            type="button"
                            className={`recipes-live-chip${parsed.category === cat.value ? ' active' : ''}`}
                            onClick={() => setParsed(p => ({ ...p, category: p.category === cat.value ? null : cat.value }))}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                      {!parsed.category && <span className="recipes-live-hint-warn">{t('select_meal_type')}</span>}
                    </div>

                    <div className={`recipes-live-block${parsed.servings && parseInt(parsed.servings, 10) >= 1 ? '' : ' recipes-live-block--warn'}`}>
                      <label className="recipes-live-block-label">{t('recipe_servings_label')} *</label>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        step="1"
                        value={parsed.servings ?? ''}
                        onChange={e => setParsed(p => ({ ...p, servings: e.target.value }))}
                        placeholder="4"
                        className="recipes-live-servings"
                      />
                      <p className="recipes-live-hint">{t('recipe_servings_hint')}</p>
                    </div>

                    <div className="recipes-live-ing-head">
                      {t('ingredients_lbl')(parsed.ingredients.filter(i => i.product_id).length, parsed.ingredients.length)}
                    </div>

                    {parsed.ingredients.length > 0 && (
                      <div className="recipes-live-ing-columns" aria-hidden="true">
                        <span className="recipes-live-ing-col-amt">{t('col_amount')}</span>
                        <span className="recipes-live-ing-col-prod">{t('matched_product_col')}</span>
                      </div>
                    )}

                    <div className="recipes-live-ing-list">
                      {parsed.ingredients.length === 0 ? (
                        <p className="recipes-live-hint">{t('recipe_live_no_ingredients')}</p>
                      ) : parsed.ingredients.map((ing, i) => (
                        <React.Fragment key={`${ing.rawName}-${i}`}>
                          <div className={`recipes-live-ing-row${ing.product_id ? ' matched' : ''}${addingProductFor === i ? ' expanding' : ''}`}>
                            <div className="recipes-live-ing-name" title={ing.rawName}>
                              <span>{ing.rawName}</span>
                              {canonicalDiffersFromRaw(ing.rawName, ing.canonicalName) && (
                                <small title={ing.canonicalName}>{t('canonical_match_hint')(ing.canonicalName)}</small>
                              )}
                            </div>
                            <div className="recipes-live-ing-controls">
                              <input
                                type="number"
                                className="recipes-live-ing-weight"
                                value={ing.weight}
                                min="0"
                                max="99999"
                                onChange={e => updateIngredient(i, 'weight', Math.min(99999, parseFloat(e.target.value) || 0))}
                                aria-label={t('col_amount')}
                              />
                              <select
                                className="recipes-live-ing-unit"
                                value={ing.unit || 'g'}
                                onChange={e => updateIngredient(i, 'unit', e.target.value)}
                                title={t('unit_lbl')}
                                aria-label={t('unit_lbl')}
                              >
                                <option value="g">g</option>
                                <option value="ml">ml</option>
                                <option value="szt">{t('unit_pcs')}</option>
                              </select>
                              <select
                                className="recipes-live-ing-product"
                                value={ing.product_id || ''}
                                onChange={e => {
                                  const pid = e.target.value || null;
                                  const prod = productList.find(p => String(p.id) === String(pid));
                                  setParsed(p => {
                                    if (!p) return p;
                                    const u = [...p.ingredients];
                                    u[i] = { ...u[i], product_id: pid, unit: prod?.unit || u[i].unit || 'g' };
                                    return { ...p, ingredients: u };
                                  });
                                }}
                                title={ing.product_id ? productList.find(p => String(p.id) === String(ing.product_id))?.name : t('no_match_opt')}
                              >
                                <option value="">{t('no_match_opt')}</option>
                                {productList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                              {!ing.product_id ? (
                                <button
                                  type="button"
                                  className={`recipes-live-ing-add${addingProductFor === i ? ' active' : ''}`}
                                  title={t('add_to_products_btn')}
                                  aria-label={t('add_to_products_btn')}
                                  onClick={() => {
                                    if (addingProductFor === i) { setAddingProductFor(null); return; }
                                    setAddingProductFor(i);
                                    setQuickForm({ name: ing.canonicalName || ing.rawName, package_weight: '100', package_price: '', unit: 'g', sold_by_weight: false });
                                  }}
                                >
                                  <Icon icon="heroicons:plus-circle" width={18} />
                                </button>
                              ) : (
                                <span className="recipes-live-ing-add-placeholder" aria-hidden="true" />
                              )}
                              <button type="button" className="recipes-live-ing-del" onClick={() => removeIngredient(i)} aria-label={t('delete')}>
                                <Icon icon="heroicons:x-mark" width={14} />
                              </button>
                            </div>
                          </div>
                          {addingProductFor === i && (
                            <div className="recipes-live-quick-add">
                              <div className="recipes-live-quick-add-title">{t('add_ing_new_product')}</div>

                              <div className="recipes-live-quick-add-field">
                                <label htmlFor={`quick-name-${i}`}>{t('product_name_lbl')}</label>
                                <input
                                  id={`quick-name-${i}`}
                                  value={quickForm.name}
                                  maxLength={50}
                                  onChange={e => setQuickForm(f => ({ ...f, name: e.target.value.slice(0, 50) }))}
                                  placeholder={t('product_name_ph')}
                                />
                              </div>

                              <div className="recipes-live-quick-add-price-row">
                                <div className="recipes-live-quick-add-field recipes-live-quick-add-field--compact">
                                  <label htmlFor={`quick-price-${i}`}>
                                    {quickForm.sold_by_weight ? t('price_per_kg_lbl') : t('price_per_opak_lbl')}
                                  </label>
                                  <input
                                    id={`quick-price-${i}`}
                                    type="number"
                                    className="no-spin"
                                    min="0"
                                    max="99999"
                                    step="0.01"
                                    value={quickForm.package_price}
                                    onChange={e => setQuickForm(f => ({ ...f, package_price: e.target.value === '' ? '' : String(Math.min(99999, parseFloat(e.target.value) || 0)) }))}
                                    placeholder={t('pkg_price_ph')}
                                  />
                                </div>
                                <div className="recipes-live-quick-add-field">
                                  <div className="recipes-live-quick-add-toggle-btns">
                                    <button
                                      type="button"
                                      className={!quickForm.sold_by_weight ? 'active' : ''}
                                      onClick={() => setQuickForm(f => ({ ...f, sold_by_weight: false }))}
                                    >
                                      {t('pkg_in_packaging')}
                                    </button>
                                    <button
                                      type="button"
                                      className={quickForm.sold_by_weight ? 'active' : ''}
                                      onClick={() => setQuickForm(f => ({ ...f, sold_by_weight: true, unit: 'g', package_weight: '' }))}
                                    >
                                      {t('pkg_by_weight')}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {!quickForm.sold_by_weight && (
                                <div className="recipes-live-quick-add-field">
                                  <label htmlFor={`quick-qty-${i}`}>{t('pkg_qty_lbl')}</label>
                                  <input
                                    id={`quick-qty-${i}`}
                                    type="number"
                                    className="no-spin recipes-live-quick-add-qty-input"
                                    min="0"
                                    max="99999"
                                    value={quickForm.package_weight}
                                    onChange={e => setQuickForm(f => ({ ...f, package_weight: e.target.value === '' ? '' : String(Math.min(99999, parseFloat(e.target.value) || 0)) }))}
                                    placeholder={t('pkg_qty_ph')}
                                  />
                                  <div className="recipes-live-quick-add-units">
                                    {['g', 'kg', 'ml', 'l', 'szt'].map(u => (
                                      <button
                                        key={u}
                                        type="button"
                                        className={quickForm.unit === u ? 'active' : ''}
                                        onClick={() => setQuickForm(f => ({ ...f, unit: u }))}
                                      >
                                        {displayUnit(u)}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="recipes-live-quick-add-actions">
                                <button type="button" className="btn btn-primary" onClick={() => handleQuickAdd(i)}>{t('add_product_btn')}</button>
                                <button type="button" className="btn recipes-live-quick-add-cancel" onClick={() => setAddingProductFor(null)}>{t('cancel')}</button>
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>

                    {parsed.ingredients.some(i => !i.product_id) && (
                      <div className="recipes-live-match-hint">
                        <div className="recipes-live-match-hint-head">
                          <span className="recipes-live-match-hint-swatch" aria-hidden="true" />
                          {t('missing_product_hint_title')}
                        </div>
                        <ol className="recipes-live-match-hint-steps">
                          <li>{t('missing_product_hint_step1')}</li>
                          <li>
                            {t('missing_product_hint_step2_before')}{' '}
                            <span className="recipes-live-hint-btn-demo" title={t('add_to_products_btn')} aria-hidden="true">
                              <Icon icon="heroicons:plus-circle" width={15} />
                            </span>{' '}
                            {t('missing_product_hint_step2_after')}
                          </li>
                        </ol>
                      </div>
                    )}

                    <div className="recipes-live-actions">
                      <button type="button" className="btn btn-primary" onClick={handleSave}>{t('save_recipe')}</button>
                      <button type="button" className="btn recipes-live-clear" onClick={() => { setPasteText(''); setParsed(null); setAddingProductFor(null); }}>{t('clear')}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
      </div>

      <RecipeHelpModal
        open={recipeHelpModalOpen}
        onClose={() => setRecipeHelpModalOpen(false)}
        t={t}
        nameLabel={t('recipe_name_lbl')}
        promptCopied={promptCopied}
        onCopyPrompt={() => {
          navigator.clipboard.writeText(recipePromptPlainText(t));
          setPromptCopied(true);
          setTimeout(() => setPromptCopied(false), 2000);
        }}
      />

      <div className="card recipes-list-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="recipes-list-header">
          <button type="button" className="list-section-toggle" onClick={() => setListOpen(o => !o)}>
            <span className="card-section-title">{t('recipe_list_title')}</span>
          </button>

          <button
            onClick={() => selectionMode ? exitSelection() : (setSelectionMode(true), setExpanded(null))}
            style={{ padding: '5px 11px', background: selectionMode ? '#1e3a3a' : 'transparent', border: `1px solid ${selectionMode ? '#0d9488' : '#374151'}`, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: selectionMode ? '#2dd4bf' : '#6b7280', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
          >
            {selectionMode ? t('deselect_label') : t('select_label')}
          </button>

          <button
            onClick={() => {
              if (selectionMode) {
                if (selectedIds.size > 0) handleDeleteSelected();
              } else {
                showConfirm({
                  title: t('del_all_recipes_title'),
                  message: t('confirm_del_all_recipes')(recipeList.length),
                  confirmLabel: t('del_all_recipes'),
                  onConfirm: async () => {
                    try { await api.deleteAll(); showSuccess(t('all_recipes_deleted')); loadRecipes(); }
                    catch { showError(t('err_load_recipes_list')); }
                  },
                });
              }
            }}
            disabled={selectionMode && selectedIds.size === 0}
            style={{ padding: '5px 11px', background: 'transparent', border: '1px solid #374151', borderRadius: 6, cursor: selectionMode && selectedIds.size === 0 ? 'default' : 'pointer', fontSize: 12, color: selectionMode && selectedIds.size === 0 ? '#374151' : '#6b7280', transition: 'all 0.15s', whiteSpace: 'nowrap', opacity: selectionMode && selectedIds.size === 0 ? 0.4 : 1 }}
            onMouseEnter={e => { if (!(selectionMode && selectedIds.size === 0)) { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#374151'; e.currentTarget.style.color = selectionMode && selectedIds.size === 0 ? '#374151' : '#6b7280'; }}
          >
            {selectionMode && selectedIds.size > 0 ? t('del_selected_recipes')(selectedIds.size) : t('del_all_recipes')}
          </button>

          <button onClick={() => setListOpen(o => !o)}
            style={{ padding: '5px 4px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Icon icon="heroicons:chevron-down" style={{ width: 20, height: 20, transition: 'transform 0.25s', transform: listOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: '#0d9488' }} />
          </button>
        </div>
        {listOpen && <div className="recipes-list-body">
        <div style={{ margin: '12px 0 8px', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('search_recipe_ph')}
            style={{ flex: 1, padding: '7px 12px', border: '1px solid #374151', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
            onFocus={e => e.target.style.borderColor = '#0d9488'}
            onBlur={e => e.target.style.borderColor = '#374151'}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setCategoryFilter(null)}
            style={{ padding: '4px 12px', border: `1.5px solid ${!categoryFilter ? '#9ca3af' : '#374151'}`, borderRadius: 20, fontSize: 12, cursor: 'pointer', background: !categoryFilter ? '#374151' : 'transparent', color: !categoryFilter ? '#f1f5f9' : '#6b7280', fontWeight: !categoryFilter ? 700 : 400, transition: 'all 0.15s' }}>
            {t('cat_all')}
          </button>
          {CATEGORIES.map(cat => (
            <button key={cat.value} onClick={() => setCategoryFilter(f => f === cat.value ? null : cat.value)}
              style={{ padding: '4px 12px', border: `1.5px solid ${categoryFilter === cat.value ? '#0d9488' : '#374151'}`, borderRadius: 20, fontSize: 12, cursor: 'pointer', background: categoryFilter === cat.value ? '#0d948822' : 'transparent', color: categoryFilter === cat.value ? '#2dd4bf' : '#6b7280', fontWeight: categoryFilter === cat.value ? 700 : 400, transition: 'all 0.15s' }}>
              {t(`cat_${cat.value === 'dessert' ? 'dessert' : cat.value}`)}
            </button>
          ))}
        </div>
        {recipeList.length === 0 && <p style={{ textAlign: 'center', color: '#6b7280' }}>{t('no_recipes_add')}</p>}
        {recipeList.length > 0 && search.trim() && filteredRecipes.length === 0 && (
          <p style={{ textAlign: 'center', color: '#6b7280', fontStyle: 'italic' }}>{t('recipe_not_found')(search)}</p>
        )}
        <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: '0 4px', width: '100%', minWidth: 600 }}>
          <thead>
            <tr>
              <th colSpan={2} style={{ width: '40%' }}>{t('recipe_col_name')}</th>
              <th style={{ textAlign: 'center' }}>{t('recipe_col_kcalmacro')}</th>
              <th style={{ textAlign: 'center', width: 90 }}>{t('recipe_col_meal')}</th>
              <th style={{ textAlign: 'right' }}>{t('recipe_col_price')}</th>
              <th style={{ textAlign: 'center', width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
        {filteredRecipes.slice(0, visibleCount).map(r => (
          <>
          <tr key={r.id}
            className={`recipe-row${selectedIds.has(r.id) ? ' recipe-row-checked' : ''}`}
            onClick={() => {
              if (selectionMode) { toggleSelect(r.id); return; }
              const next = expanded === r.id ? null : r.id;
              setExpanded(next);
              setEditingIngredients(null);
              if (next) loadExpandedDetail(next);
              else setExpandedDetail(null);
            }}
            style={{ cursor: 'pointer' }}>
            <td colSpan={2} style={!selectionMode && expanded === r.id ? { background: '#0d948818', borderLeft: '3px solid #0d9488', borderTop: '1px solid #0d948860', borderBottom: '1px solid #0d948860' } : {}}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {selectionMode && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${selectedIds.has(r.id) ? '#6366f1' : '#374151'}`, background: selectedIds.has(r.id) ? '#6366f1' : 'transparent', flexShrink: 0, transition: 'all 0.12s' }}>
                    {selectedIds.has(r.id) && <Icon icon="heroicons:check" style={{ width: 10, height: 10, color: '#fff' }} />}
                  </span>
                )}
                <button
                  onClick={async (e) => { e.stopPropagation(); await api.toggleFavorite(r.id); loadRecipes(); }}
                  title={r.is_favorite ? t('fav_remove') : t('fav_add')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 0', color: r.is_favorite ? '#facc15' : 'transparent', WebkitTextStroke: r.is_favorite ? '0' : '1.5px #6b7280', flexShrink: 0 }}>
                  ★
                </button>
                {editingName?.id === r.id ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      value={editingName.text}
                      maxLength={200}
                      autoFocus
                      onChange={e => setEditingName({ ...editingName, text: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveName(r.id); if (e.key === 'Escape') setEditingName(null); }}
                      style={{ padding: '3px 8px', fontSize: 14, fontWeight: 600, border: '1px solid #0d9488', borderRadius: 5, background: '#111827', color: '#f1f5f9', width: 220 }}
                    />
                    <button className="btn btn-primary" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => handleSaveName(r.id)}>✓</button>
                    <button className="btn" style={{ padding: '3px 8px', fontSize: 12, background: '#374151', color: '#9ca3af' }} onClick={() => setEditingName(null)}>✗</button>
                  </div>
                ) : (
                  <strong style={{ cursor: 'pointer' }} title={t('click_to_edit')}
                    onDoubleClick={() => setEditingName({ id: r.id, text: r.name })}>
                    {r.name}
                  </strong>
                )}
              </div>
            </td>
            <td style={{ whiteSpace: 'nowrap', textAlign: 'center', ...(expanded === r.id ? { background: '#0d948818', borderTop: '1px solid #0d948860', borderBottom: '1px solid #0d948860' } : {}) }}>
              {r.total_kcal > 0 ? (
                <span style={{ fontSize: 12, color: '#9ca3af' }}>
                  <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{r.total_kcal}</span> kcal · {t('macro_p')}{r.total_protein} {t('macro_f')}{r.total_fat} {t('macro_c')}{r.total_carbs}
                </span>
              ) : <span style={{ fontSize: 11, color: '#374151' }}>—</span>}
            </td>
            {/* Kategoria — badge + dropdown do edycji */}
            <td style={{ textAlign: 'center', ...(expanded === r.id ? { background: '#0d948818', borderTop: '1px solid #0d948860', borderBottom: '1px solid #0d948860' } : {}) }}
                onClick={e => { e.stopPropagation(); setEditingCategory(ec => ec?.id === r.id ? null : { id: r.id, value: r.category || '' }); }}>
              {editingCategory?.id === r.id ? (
                <div style={{ position: 'relative', display: 'inline-block' }} onClick={e => e.stopPropagation()}>
                  <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', background: '#1f2937', border: '1px solid #374151', borderRadius: 8, zIndex: 300, minWidth: 110, boxShadow: '0 4px 16px rgba(0,0,0,0.4)', padding: 4 }}>
                    <div onClick={() => saveCategory(r.id, null)}
                      style={{ padding: '5px 10px', fontSize: 12, color: '#6b7280', cursor: 'pointer', borderRadius: 4 }}
                      onMouseEnter={e => e.currentTarget.style.background = '#374151'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      — brak —
                    </div>
                    {CATEGORIES.map(cat => (
                      <div key={cat.value} onClick={() => saveCategory(r.id, cat.value)}
                        style={{ padding: '5px 10px', fontSize: 12, color: '#2dd4bf', cursor: 'pointer', borderRadius: 4, fontWeight: 600 }}
                        onMouseEnter={e => e.currentTarget.style.background = '#374151'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        {cat.label}
                      </div>
                    ))}
                  </div>
                  <span style={{ fontSize: 11, color: r.category ? '#2dd4bf' : '#374151', fontWeight: 600, cursor: 'pointer' }}>
                    {r.category ? CAT_MAP[r.category]?.label : t('no_type')}
                  </span>
                </div>
              ) : (
                <span style={{ fontSize: 11, color: r.category ? '#2dd4bf' : '#374151', fontWeight: r.category ? 600 : 400, cursor: 'pointer' }}
                      title={t('click_change_meal')}>
                  {r.category ? CAT_MAP[r.category]?.label : t('no_type')}
                </span>
              )}
            </td>
            <td style={{ whiteSpace: 'nowrap', textAlign: 'right', ...(expanded === r.id ? { background: '#0d948818', borderTop: '1px solid #0d948860', borderBottom: '1px solid #0d948860' } : {}) }}>
              <span style={{ color: '#0d9488', fontWeight: 600 }}>{r.total_cost.toFixed(2)} {t('currency')}</span>
              {r.source_url && (
                <div style={{ marginTop: 2 }}>
                  <a href={r.source_url} target="_blank" rel="noreferrer"
                     style={{ fontSize: 11, color: '#e2e8f0', textDecoration: 'none', fontWeight: 600 }}
                     onClick={e => e.stopPropagation()}>
                    {t('see_recipe')}
                  </a>
                </div>
              )}
            </td>
            <td style={{ textAlign: 'right', ...(expanded === r.id ? { background: '#0d948818', borderTop: '1px solid #0d948860', borderBottom: '1px solid #0d948860', borderRight: '1px solid #0d948860' } : {}) }} onClick={e => e.stopPropagation()}>
              <button className="btn btn-danger" onClick={(e) => { e.stopPropagation(); showConfirm({
                  title: t('confirm_del_recipe'),
                  message: t('delete_confirm_recipe')(r.name),
                  confirmLabel: t('btn_delete'),
                  onConfirm: async () => { try { await api.delete(r.id); showSuccess(t('recipe_deleted')); loadRecipes(); } catch { showError(t('err_save_recipe')); } },
                }); }}>{t('delete')}</button>
            </td>
          </tr>
          {expanded === r.id && (() => {
            const ingStyle = { background: '#0d94880d', borderLeft: '1px solid #0d948860', borderRight: '1px solid #0d948860' };
            const blStyle  = { borderLeft: '3px solid #0d9488' };
            const inpS     = { width: 38, padding: '1px 3px', fontSize: 11, background: '#1f2937', border: '1px solid #0d9488', borderRadius: 4, color: '#e2e8f0', textAlign: 'center', minWidth: 0 };

            const ings = expandedDetail?.id === r.id ? (expandedDetail.ingredients || []) : null;
            const saveIngMacro = async (ing, vals) => {
              const toN = v => v === '' ? null : parseFloat(v) || 0;
              try { await productsApi.update(ing.product_id, { kcal: toN(vals.kcal), protein: toN(vals.protein), fat: toN(vals.fat), carbs: toN(vals.carbs) }); await loadExpandedDetail(r.id); }
              catch { showError(t('err_save_notes')); }
              setEditingIngCell(null);
            };
            const saveIngWeight = async (ing, weight) => {
              if (!weight || isNaN(parseFloat(weight))) { setEditingIngCell(null); return; }
              try { await api.update(r.id, { ingredients: ings.map(x => ({ product_id: x.product_id, weight: x.id === ing.id ? parseFloat(weight) : x.weight })) }); await loadExpandedDetail(r.id); }
              catch { showError(t('err_save_recipe')); }
              setEditingIngCell(null);
            };
            const saveIngName = async (ing, name) => {
              if (!name.trim()) { setEditingIngCell(null); return; }
              try { await productsApi.update(ing.product_id, { name: name.trim() }); await loadExpandedDetail(r.id); }
              catch { showError(t('err_save_notes')); }
              setEditingIngCell(null);
            };
            const deleteIng = async (ing) => {
              try { await api.update(r.id, { ingredients: ings.filter(x => x.id !== ing.id).map(x => ({ product_id: x.product_id, weight: x.weight })) }); await loadExpandedDetail(r.id); }
              catch { showError(t('err_save_recipe')); }
            };
            const initAdding = () => setAddingIng({ recipeId: r.id, search: '', product: null, weight: '', showDrop: false, kcal: '', protein: '', fat: '', carbs: '', unit: 'g', soldByWeight: false, priceOpak: '', pkgWeight: '', priceKg: '', priceSzt: '' });

            const confirmAddIng = async () => {
              const a = addingIng;
              if (!a || !a.weight || isNaN(parseFloat(a.weight))) return;
              let pid = a.product?.id;
              try {
                if (!pid) {
                  const toN = v => v === '' ? null : parseFloat(v) || 0;
                  let price = 0;
                  const pkgW = parseFloat(a.pkgWeight) || 100;
                  if (a.unit === 'szt') price = parseFloat(a.priceSzt) || 0;
                  else if (a.soldByWeight) price = (parseFloat(a.priceKg) || 0) / 10;
                  else price = pkgW > 0 ? (parseFloat(a.priceOpak) || 0) / (pkgW / 100) : 0;
                  const res = await productsApi.create({ name: a.search.trim(), package_weight: pkgW, price, unit: a.unit, sold_by_weight: a.soldByWeight, kcal: toN(a.kcal), protein: toN(a.protein), fat: toN(a.fat), carbs: toN(a.carbs) });
                  pid = res.data.id;
                } else if (a.kcal !== '' || a.protein !== '' || a.fat !== '' || a.carbs !== '') {
                  const toN = v => v === '' ? null : parseFloat(v) || 0;
                  await productsApi.update(pid, { kcal: toN(a.kcal), protein: toN(a.protein), fat: toN(a.fat), carbs: toN(a.carbs) });
                }
                await api.update(r.id, { ingredients: [...ings.map(x => ({ product_id: x.product_id, weight: x.weight })), { product_id: pid, weight: parseFloat(a.weight) }] });
                await loadExpandedDetail(r.id);
                setAddingIng(null);
              } catch { showError(t('err_save_recipe')); }
            };

            const isAdding = addingIng?.recipeId === r.id;
            const dropResults = isAdding && addingIng.search.length >= 2
              ? productList.filter(p => p.name.toLowerCase().includes(addingIng.search.toLowerCase())).slice(0, 8)
              : [];
            const exactMatch = isAdding && productList.find(p => p.name.toLowerCase() === addingIng.search.toLowerCase());
            const addUnit = addingIng?.product?.unit || addingIng?.unit || 'g';

            return (<>
              {ings === null && (
                <tr style={ingStyle}><td colSpan={6} style={{ textAlign: 'center', padding: 12, color: '#6b7280', fontSize: 13 }}>{t('loading_ing')}</td></tr>
              )}
              {ings !== null && <>
              <tr style={ingStyle}>
                <th style={{ ...blStyle, fontSize: 11, color: '#6b7280', fontWeight: 700, letterSpacing: '0.5px', padding: '6px 8px' }}>{t('col_product')}</th>
                <th style={{ textAlign: 'left', fontSize: 11, color: '#6b7280', fontWeight: 700, letterSpacing: '0.5px', width: 100 }}>{t('col_weight')}</th>
                <th colSpan={2} style={{ textAlign: 'center', fontSize: 11, color: '#6b7280', fontWeight: 700, letterSpacing: '0.5px' }}>{t('col_macro')}</th>
                <th style={{ textAlign: 'right', fontSize: 11, color: '#6b7280', fontWeight: 700, letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{t('col_cost')}</th>
                <th style={{ textAlign: 'center', fontSize: 11, color: '#6b7280', fontWeight: 700, letterSpacing: '0.5px', width: 60 }}>{t('delete')}</th>
              </tr>
              {ings.map(ing => {
                const factor  = ing.unit === 'szt' ? ing.weight : ing.weight / 100;
                const kcal    = ing.kcal    != null ? Math.round(ing.kcal    * factor) : null;
                const protein = ing.protein != null ? Math.round(ing.protein * factor * 10) / 10 : null;
                const fat     = ing.fat     != null ? Math.round(ing.fat     * factor * 10) / 10 : null;
                const carbs   = ing.carbs   != null ? Math.round(ing.carbs   * factor * 10) / 10 : null;
                const cellKey = `${r.id}-${ing.id}`;
                const isEditN = editingIngCell?.key === cellKey && editingIngCell.field === 'name';
                const isEditW = editingIngCell?.key === cellKey && editingIngCell.field === 'weight';
                const isEditM = editingIngCell?.key === cellKey && editingIngCell.field === 'macro';
                const noEdit  = !isEditN && !isEditW && !isEditM;
                return (
                  <tr key={ing.id} style={ingStyle}>
                    {/* Nazwa — klik = edycja */}
                    <td style={{ ...blStyle, cursor: 'pointer' }} onClick={() => noEdit && setEditingIngCell({ key: cellKey, field: 'name', val: ing.product_name })}>
                      {isEditN ? (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}
                             onKeyDown={e => { if (e.key === 'Enter') saveIngName(ing, editingIngCell.val); if (e.key === 'Escape') setEditingIngCell(null); }}>
                          <input autoFocus value={editingIngCell.val} onChange={e => setEditingIngCell(c => ({ ...c, val: e.target.value }))}
                            style={{ flex: 1, padding: '2px 6px', fontSize: 13, background: '#1f2937', border: '1px solid #0d9488', borderRadius: 4, color: '#e2e8f0' }} />
                          <button onClick={() => saveIngName(ing, editingIngCell.val)} style={{ padding: '1px 5px', fontSize: 11, background: '#0d9488', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}>✓</button>
                          <button onClick={() => setEditingIngCell(null)} style={{ padding: '1px 5px', fontSize: 11, background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 3, cursor: 'pointer' }}>✕</button>
                        </div>
                      ) : ing.product_name}
                    </td>
                    {/* Potrzebuje — klik = edycja wagi */}
                    <td style={{ textAlign: 'left', cursor: 'pointer', width: 100 }} onClick={() => noEdit && setEditingIngCell({ key: cellKey, field: 'weight', val: String(ing.weight) })}>
                      {isEditW ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
                             onKeyDown={e => { if (e.key === 'Enter') saveIngWeight(ing, editingIngCell.val); if (e.key === 'Escape') setEditingIngCell(null); }}>
                          <input autoFocus style={{ ...inpS, width: 55 }} value={editingIngCell.val}
                            onChange={e => setEditingIngCell(c => ({ ...c, val: e.target.value }))} />
                          <span style={{ fontSize: 11, color: '#6b7280' }}>{ing.unit}</span>
                          <button onClick={() => saveIngWeight(ing, editingIngCell.val)} style={{ padding: '1px 5px', fontSize: 11, background: '#0d9488', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}>✓</button>
                          <button onClick={() => setEditingIngCell(null)} style={{ padding: '1px 5px', fontSize: 11, background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 3, cursor: 'pointer' }}>✕</button>
                        </div>
                      ) : <span style={{ fontSize: 12, color: '#e2e8f0' }}>{ing.weight} {ing.unit}</span>}
                    </td>
                    {/* Kcal/Makro — klik = edycja makro */}
                    <td colSpan={2} style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => noEdit && setEditingIngCell({ key: cellKey, field: 'macro', vals: { kcal: ing.kcal != null ? String(ing.kcal) : '', protein: ing.protein != null ? String(ing.protein) : '', fat: ing.fat != null ? String(ing.fat) : '', carbs: ing.carbs != null ? String(ing.carbs) : '' } })}>
                      {isEditM ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}
                             onKeyDown={e => { if (e.key === 'Enter') saveIngMacro(ing, editingIngCell.vals); if (e.key === 'Escape') setEditingIngCell(null); }}>
                          <span style={{ fontSize: 10, color: '#6b7280' }}>kcal</span>
                          <input autoFocus style={inpS} value={editingIngCell.vals.kcal}    onChange={e => setEditingIngCell(c => ({ ...c, vals: { ...c.vals, kcal:    e.target.value } }))} placeholder="—" />
                          <span style={{ fontSize: 10, color: '#6b7280' }}>{t('macro_p')}</span>
                          <input style={inpS} value={editingIngCell.vals.protein} onChange={e => setEditingIngCell(c => ({ ...c, vals: { ...c.vals, protein: e.target.value } }))} placeholder="—" />
                          <span style={{ fontSize: 10, color: '#6b7280' }}>{t('macro_f')}</span>
                          <input style={inpS} value={editingIngCell.vals.fat}     onChange={e => setEditingIngCell(c => ({ ...c, vals: { ...c.vals, fat:     e.target.value } }))} placeholder="—" />
                          <span style={{ fontSize: 10, color: '#6b7280' }}>{t('macro_c')}</span>
                          <input style={inpS} value={editingIngCell.vals.carbs}   onChange={e => setEditingIngCell(c => ({ ...c, vals: { ...c.vals, carbs:   e.target.value } }))} placeholder="—" />
                          <button onClick={() => saveIngMacro(ing, editingIngCell.vals)} style={{ padding: '1px 5px', fontSize: 11, background: '#0d9488', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', marginLeft: 2 }}>✓</button>
                          <button onClick={() => setEditingIngCell(null)} style={{ padding: '1px 5px', fontSize: 11, background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 3, cursor: 'pointer' }}>✕</button>
                        </div>
                      ) : kcal != null
                        ? <span style={{ fontSize: 11, color: '#9ca3af' }}>{kcal} kcal · {t('macro_p')}{protein} {t('macro_f')}{fat} {t('macro_c')}{carbs}</span>
                        : <span style={{ fontSize: 11, color: '#9ca3af' }}>+ {t('col_macro').toLowerCase()}</span>}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{ing.cost.toFixed(2)} {t('currency')}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => showConfirm({ title: t('del_ing_title'), message: t('del_ing_confirm')(ing.product_name), confirmLabel: t('btn_delete'), onConfirm: () => deleteIng(ing) })}
                        style={{ background: '#2d1515', border: '1px solid #4b1515', color: '#f87171', borderRadius: 4, cursor: 'pointer', padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{t('btn_delete')}</button>
                    </td>
                  </tr>
                );
              })}

              {/* Dodaj składnik */}
              {isAdding ? (
                <tr style={{ ...ingStyle, borderBottom: '1px solid #0d948840' }}>
                  {/* Nazwa: wyszukiwarka */}
                  <td style={blStyle}>
                    <div style={{ position: 'relative' }}>
                      <input autoFocus placeholder={t('search_product_ph')} value={addingIng.search} maxLength={200}
                        onChange={e => setAddingIng(a => ({ ...a, search: e.target.value, product: null, showDrop: true, kcal: '', protein: '', fat: '', carbs: '' }))}
                        onKeyDown={e => { if (e.key === 'Escape') setAddingIng(null); }}
                        style={{ width: '100%', maxWidth: 320, boxSizing: 'border-box', padding: '3px 7px', fontSize: 12, background: '#111827', border: '1px solid #0d9488', borderRadius: 5, color: '#f1f5f9' }} />
                      {addingIng.showDrop && dropResults.length > 0 && (
                        <div className="dark-scroll" style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1f2937', border: '1px solid #374151', borderRadius: 6, zIndex: 200, maxHeight: 180, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                          {dropResults.map(p => (
                            <div key={p.id} onClick={() => setAddingIng(a => ({ ...a, search: p.name, product: p, showDrop: false, unit: p.unit, kcal: p.kcal != null ? String(p.kcal) : '', protein: p.protein != null ? String(p.protein) : '', fat: p.fat != null ? String(p.fat) : '', carbs: p.carbs != null ? String(p.carbs) : '' }))}
                              style={{ padding: '5px 10px', fontSize: 12, color: '#e2e8f0', cursor: 'pointer' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#374151'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              {p.name} <span style={{ color: '#6b7280', fontSize: 11 }}>({p.unit})</span>
                            </div>
                          ))}
                          {!exactMatch && addingIng.search.trim().length >= 2 && (
                            <div onClick={() => setAddingIng(a => ({ ...a, product: null, showDrop: false }))}
                              style={{ padding: '5px 10px', fontSize: 12, color: '#0d9488', cursor: 'pointer', borderTop: '1px solid #374151' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#374151'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              {t('create_new_option')(addingIng.search.trim())}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  {/* Potrzebuje */}
                  <td style={{ textAlign: 'left', width: 100 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <input type="number" className="no-spin" min="0.1" max="99999" placeholder={t('quantity_ph')} value={addingIng.weight}
                        onChange={e => setAddingIng(a => ({ ...a, weight: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') confirmAddIng(); if (e.key === 'Escape') setAddingIng(null); }}
                        style={{ width: 55, padding: '3px 4px', fontSize: 12, background: '#111827', border: '1px solid #374151', borderRadius: 4, color: '#f1f5f9', textAlign: 'center' }} />
                      <span style={{ fontSize: 11, color: '#6b7280' }}>{addUnit}</span>
                    </div>
                  </td>
                  {/* Kcal/Makro — auto-fill z produktu lub puste */}
                  <td colSpan={2} style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontSize: 10, color: '#6b7280' }}>kcal</span>
                      <input style={inpS} value={addingIng.kcal}    onChange={e => setAddingIng(a => ({ ...a, kcal:    e.target.value }))} placeholder="—" />
                      <span style={{ fontSize: 10, color: '#6b7280' }}>{t('macro_p')}</span>
                      <input style={inpS} value={addingIng.protein} onChange={e => setAddingIng(a => ({ ...a, protein: e.target.value }))} placeholder="—" />
                      <span style={{ fontSize: 10, color: '#6b7280' }}>{t('macro_f')}</span>
                      <input style={inpS} value={addingIng.fat}     onChange={e => setAddingIng(a => ({ ...a, fat:     e.target.value }))} placeholder="—" />
                      <span style={{ fontSize: 10, color: '#6b7280' }}>{t('macro_c')}</span>
                      <input style={inpS} value={addingIng.carbs}   onChange={e => setAddingIng(a => ({ ...a, carbs:   e.target.value }))} placeholder="—" />
                    </div>
                  </td>
                  {/* Cena — dla nowego produktu: pola ceny; dla istniejącego: info */}
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {addingIng.product ? (
                      <span style={{ fontSize: 11, color: '#6b7280' }}>{t('existing_product')}</span>
                    ) : (() => {
                      const btnRow = (
                        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                          {['g','ml','szt'].map(u => (
                            <button key={u} onClick={() => setAddingIng(a => ({ ...a, unit: u, soldByWeight: false }))}
                              style={{ padding: '1px 6px', fontSize: 11, borderRadius: 3, cursor: 'pointer', border: '1px solid', fontWeight: addingIng.unit === u ? 700 : 400,
                                background: addingIng.unit === u ? '#0d9488' : '#1f2937', color: addingIng.unit === u ? '#fff' : '#9ca3af', borderColor: addingIng.unit === u ? '#0d9488' : '#374151' }}>
                              {displayUnit(u)}
                            </button>
                          ))}
                          {addingIng.unit !== 'szt' && (
                            <button onClick={() => setAddingIng(a => ({ ...a, soldByWeight: !a.soldByWeight }))}
                              style={{ padding: '1px 6px', fontSize: 11, borderRadius: 3, cursor: 'pointer', border: '1px solid', fontWeight: addingIng.soldByWeight ? 700 : 400,
                                background: addingIng.soldByWeight ? '#6366f1' : '#1f2937', color: addingIng.soldByWeight ? '#fff' : '#9ca3af', borderColor: addingIng.soldByWeight ? '#6366f1' : '#374151' }}>
                              {t('weight_btn')}
                            </button>
                          )}
                        </div>
                      );
                      const priceRow = addingIng.unit === 'szt' ? (
                        <div style={{ display: 'flex', gap: 3, alignItems: 'center', justifyContent: 'flex-end' }}>
                          <input placeholder={t('price_input_ph')} type="number" className="no-spin" min="0" max="99999" value={addingIng.priceSzt} onChange={e => setAddingIng(a => ({ ...a, priceSzt: e.target.value }))}
                            style={{ flex: 1, minWidth: 0, padding: '2px 4px', fontSize: 11, background: '#111827', border: '1px solid #374151', borderRadius: 3, color: '#e2e8f0' }} />
                          <span style={{ fontSize: 10, color: '#6b7280', flexShrink: 0 }}>{t('currency')}/{t('unit_pcs')}</span>
                        </div>
                      ) : addingIng.soldByWeight ? (
                        <div style={{ display: 'flex', gap: 3, alignItems: 'center', justifyContent: 'flex-end' }}>
                          <input placeholder={t('price_input_ph')} type="number" className="no-spin" min="0" max="99999" value={addingIng.priceKg} onChange={e => setAddingIng(a => ({ ...a, priceKg: e.target.value }))}
                            style={{ flex: 1, minWidth: 0, padding: '2px 4px', fontSize: 11, background: '#111827', border: '1px solid #374151', borderRadius: 3, color: '#e2e8f0' }} />
                          <span style={{ fontSize: 10, color: '#6b7280', flexShrink: 0 }}>{t('currency')}/kg</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 3, alignItems: 'center', justifyContent: 'flex-end' }}>
                          <input placeholder={t('price_input_ph')} type="number" className="no-spin" min="0" max="99999" value={addingIng.priceOpak} onChange={e => setAddingIng(a => ({ ...a, priceOpak: e.target.value }))}
                            style={{ flex: 1, minWidth: 0, padding: '2px 4px', fontSize: 11, background: '#111827', border: '1px solid #374151', borderRadius: 3, color: '#e2e8f0' }} />
                          <span style={{ fontSize: 10, color: '#6b7280', flexShrink: 0 }}>{t('currency')} /</span>
                          <input placeholder={t('pkg_input_ph')} type="number" className="no-spin" min="0" max="99999" value={addingIng.pkgWeight} onChange={e => setAddingIng(a => ({ ...a, pkgWeight: e.target.value }))}
                            style={{ flex: 1, minWidth: 0, padding: '2px 4px', fontSize: 11, background: '#111827', border: '1px solid #374151', borderRadius: 3, color: '#e2e8f0' }} />
                          <span style={{ fontSize: 10, color: '#6b7280', flexShrink: 0 }}>{addingIng.unit === 'szt' ? t('unit_pcs') : addingIng.unit}</span>
                        </div>
                      );
                      return (
                        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 3, alignItems: 'stretch' }}>
                          {btnRow}
                          {priceRow}
                        </div>
                      );
                    })()}
                  </td>
                  {/* Przyciski */}
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap', width: 60 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
                      <button onClick={confirmAddIng} disabled={!addingIng.search.trim() || !addingIng.weight}
                        style={{ padding: '3px 8px', fontSize: 12, background: '#0d9488', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>{t('add_btn')}</button>
                      <button onClick={() => setAddingIng(null)}
                        style={{ padding: '3px 8px', fontSize: 12, background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 5, cursor: 'pointer' }}>{t('cancel')}</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr style={{ ...ingStyle, cursor: 'pointer' }} onClick={() => { initAdding(); setEditingIngCell(null); }}>
                  <td style={blStyle} colSpan={6}>
                    <span style={{ color: '#0d9488', fontSize: 12, fontWeight: 600 }}>+ {t('add_ing_label').replace('+', '').trim()}</span>
                  </td>
                </tr>
              )}
            </>}
            </>);
          })()}
          </>
        ))}
        {visibleCount < filteredRecipes.length && (
          <tr ref={sentinelRef}>
            <td colSpan={6} style={{ textAlign: 'center', color: '#4b5563', padding: '10px 0', fontSize: 12 }}>
              {t('shown_recipes')(visibleCount, filteredRecipes.length)}
            </td>
          </tr>
        )}
          </tbody>
        </table>
        </div>
        </div>}
      </div>
    </div>
  );
}
