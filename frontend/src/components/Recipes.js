import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { recipes as api, products as productsApi } from '../api';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

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
const PIECE_WORDS = /jajk[ao]|jajek|jaja?(?=\s)|jaj\b|sztuk[ia]?|szt\.?/i;
const FRACTION_WORDS = { 'pół': 0.5, 'ćwierć': 0.25 };

function parseNum(s) {
  if (!s) return null;
  s = s.trim();
  for (const [w, v] of Object.entries(FRACTION_WORDS)) if (s.toLowerCase().startsWith(w)) return v;
  const f = /^(\d+)\s*\/\s*(\d+)/.exec(s);
  if (f) return parseInt(f[1]) / parseInt(f[2]);
  return parseFloat(s.replace(',', '.')) || null;
}

function parseWeight(text) {
  const stdRe = /(\d+(?:[.,]\d+)?)\s*(kg|litr(?:[óo]w|a)?|ml|g|l\b)/gi;
  let first = null, m;
  while ((m = stdRe.exec(text)) !== null) { if (!first) first = m; }
  if (first) {
    let val = parseFloat(first[1].replace(',', '.'));
    const unit = first[2].toLowerCase();
    if (unit === 'kg') val *= 1000;
    if (unit.startsWith('litr') || unit === 'l') val *= 1000;
    return { weight: Math.min(99999, Math.round(val)), unit: (unit === 'ml' || unit.startsWith('litr') || unit === 'l') ? 'ml' : 'g', matchIndex: first.index, matchEnd: first.index + first[0].length };
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
    const numM = /(\d+)/.exec(text.slice(0, pieceM.index));
    return { weight: numM ? parseInt(numM[1]) : 1, unit: 'szt', matchIndex: pieceM.index, matchEnd: pieceM.index + pieceM[0].length, forcedName: pieceM[0].toLowerCase() };
  }
  const bareM = /^(\d+)\s+/.exec(text);
  if (bareM) return { weight: parseInt(bareM[1]), unit: 'szt', matchIndex: 0, matchEnd: bareM[0].length, forcedName: null };
  return null;
}

const JUNK_PREFIX = /^[\d/.,\s]*(po\s+)?(pół|ćwierć|płask\w*|duż\w*|mał\w*|śwież\w*|ugotown\w*|młod\w*|klarowan\w*|słodk\w*|ostr\w*)?\s*/i;
const JUNK_SUFFIX = /\s*(duże?|małe?|świeże?|ugotowane?|na\s+twardo|można\s+pominąć|klarowanego?|i\s+\w.*)$/i;
const UNIT_WORDS = /\b(szklank\w+|łyżk\w+|łyżeczk\w+|pęczk\w+|garśc\w*|kostek?|kostki|kostkę)\b\s*/gi;

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

function norm(s) {
  return s.toLowerCase().replace(/ą/g,'a').replace(/ę/g,'e').replace(/ó/g,'o').replace(/ś/g,'s').replace(/ź/g,'z').replace(/ż/g,'z').replace(/ć/g,'c').replace(/ł/g,'l').replace(/ń/g,'n');
}
const STOP_WORDS = new Set(['oraz','lub','albo','duze','male','duzy','maly','okolo','bardzo','swieze','ugotowane','posiekane','uniwersalnej','naturalna','naturalny','pelne']);

function wordsSimilar(a, b) {
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const minLen = Math.min(a.length, b.length);
  if (minLen < 3) return false;
  let p = 0; while (p < minLen && a[p] === b[p]) p++;
  return p >= Math.max(3, Math.ceil(minLen * 0.6));
}

function matchProducts(ingredients, products) {
  return ingredients.map(ing => {
    const words = norm(ing.rawName).split(/[\s,.()-]+/).filter(w => w.length >= 3 && !/^\d/.test(w) && !STOP_WORDS.has(w));
    if (!words.length) return { ...ing, product_id: null };
    let bestMatch = null, bestScore = 0;
    for (const p of products) {
      const prodWords = norm(p.name).split(/\s+/).filter(w => w.length >= 2);
      let score = 0;
      for (const iw of words) for (const pw of prodWords) if (wordsSimilar(iw, pw)) score += Math.min(iw.length, pw.length);
      if (score > bestScore) { bestScore = score; bestMatch = p; }
    }
    return { ...ing, product_id: bestScore >= 3 ? bestMatch.id : null };
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Recipes() {
  const { t } = useLanguage();
  const { showError, showSuccess, showConfirm } = useToast();
  const [recipeList, setRecipeList] = useState([]);
  const [productList, setProductList] = useState([]);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [expandedDetail, setExpandedDetail] = useState(null);
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const [editingName, setEditingName] = useState(null);
  const [editingIngredients, setEditingIngredients] = useState(null);
  const [editingIngCell, setEditingIngCell] = useState(null); // { key, field: 'weight'|'macro'|'name', val/vals }
  const [addingIng, setAddingIng] = useState(null); // { recipeId, search, product, weight, showDrop }
  const [promptCopied, setPromptCopied] = useState(false);
  const [addingProductFor, setAddingProductFor] = useState(null);
  const [quickForm, setQuickForm] = useState({ name: '', package_weight: '100', package_price: '', unit: 'g', sold_by_weight: false });
  const [listOpen, setListOpen] = useState(true);
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
      title: 'Usuń zaznaczone przepisy',
      message: `Czy na pewno chcesz usunąć ${selectedIds.size} zaznaczonych przepisów?`,
      confirmLabel: 'Usuń',
      onConfirm: async () => {
        try {
          await Promise.all([...selectedIds].map(id => api.delete(id)));
          showSuccess(`Usunięto ${selectedIds.size} przepisów`);
          exitSelection();
          loadRecipes();
        } catch { showError('Błąd podczas usuwania'); }
      },
    });
  };

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  useEffect(() => { loadRecipes(); loadProducts(); loadParseLimit(); }, []);

  const filteredRecipes = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? recipeList.filter(r => r.name.toLowerCase().includes(q)) : recipeList;
    return [...list].sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0));
  }, [recipeList, search]);

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
  const loadParseLimit = async () => {
    try { setRemaining((await api.getParseLimit()).data.remaining_today); } catch {}
  };

  const fetchMacroFromOFF = async (name) => {
    try {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(name)}&search_simple=1&action=process&json=1&page_size=5&fields=product_name,nutriments`;
      const r = await fetch(url);
      const data = await r.json();
      for (const p of (data.products || [])) {
        const n = p.nutriments || {};
        let kcal = n['energy-kcal_100g'] ?? n['energy-kcal'] ?? null;
        if (!kcal && n['energy_100g']) kcal = Math.round(n['energy_100g'] / 4.184 * 10) / 10;
        if (kcal) return { kcal: Math.round(kcal * 10) / 10, protein: Math.round((n['proteins_100g'] ?? 0) * 10) / 10, fat: Math.round((n['fat_100g'] ?? 0) * 10) / 10, carbs: Math.round((n['carbohydrates_100g'] ?? 0) * 10) / 10 };
      }
    } catch {}
    return null;
  };

  const handleQuickAdd = async (ingIndex) => {
    if (!quickForm.name.trim() || !quickForm.package_price) { showError('Podaj nazwę i cenę produktu'); return; }
    const sbw = !!quickForm.sold_by_weight;
    let unit = sbw ? 'g' : quickForm.unit;
    let pkgW = sbw ? 1000 : (parseFloat(quickForm.package_weight) || 100);
    if (!sbw && unit === 'kg') { unit = 'g';  pkgW = Math.min(99999, pkgW * 1000); }
    if (!sbw && unit === 'l')  { unit = 'ml'; pkgW = Math.min(99999, pkgW * 1000); }
    const pkgPrice = parseFloat(quickForm.package_price) || 0;
    const unitPrice = unit === 'szt' ? pkgPrice / pkgW : (pkgPrice / pkgW) * 100;
    const name = quickForm.name.trim();
    const duplicate = productList.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (duplicate) { showError(`Produkt „${duplicate.name}" już istnieje na liście`); return; }
    try {
      const res = await productsApi.create({ name, package_weight: pkgW, price: unitPrice, unit, sold_by_weight: sbw });
      const newId = res.data.id;
      updateIngredient(ingIndex, 'product_id', newId);
      setAddingProductFor(null);
      showSuccess(`Produkt „${name}" dodany — pobieram makro...`);
      const macro = await fetchMacroFromOFF(name);
      if (macro) await productsApi.update(newId, macro);
      await loadProducts();
      showSuccess(`Produkt „${name}" dodany${macro ? ' z makro' : ''}`);
    } catch { showError('Błąd przy dodawaniu produktu'); }
  };

  const handleParseAI = async () => {
    if (!pasteText.trim()) return;
    setParsing('ai'); 
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/api/recipes/parse-text`, { text: pasteText }, { headers: { Authorization: `Bearer ${token}` } });
      setRemaining(res.data.remaining_today);
      setParsed({ name: res.data.recipe_name, ingredients: res.data.ingredients.map(i => ({ rawName: i.ingredient_text, weight: i.weight, unit: i.unit, product_id: i.product_id })) });
    } catch (e) { showError(e.response?.data?.error || t('err_save_recipe')); }
    finally { setParsing(false); }
  };

  const handleParseRegex = () => {
    if (!pasteText.trim()) return;
    
    const result = parseRecipeText(pasteText);
    if (!result || !result.ingredients.length) { showError(t('err_parse_regex')); return; }
    result.ingredients = matchProducts(result.ingredients, productList);
    result.sourceText = pasteText;
    setParsed(result);
  };

  const updateIngredient = (i, field, val) => { const u = [...parsed.ingredients]; u[i] = { ...u[i], [field]: val }; setParsed({ ...parsed, ingredients: u }); };
  const removeIngredient = (i) => setParsed({ ...parsed, ingredients: parsed.ingredients.filter((_, idx) => idx !== i) });

  const handleSave = async () => {
    if (!parsed?.name) { showError(t('err_no_name')); return; }
    const valid = parsed.ingredients.filter(i => i.product_id && i.weight > 0);
    if (!valid.length) { showError(t('err_no_ingredients')); return; }
    try {
      const res = await api.create({
        name: parsed.name,
        ingredients: valid.map(i => ({ product_id: parseInt(i.product_id), weight: i.weight })),
      });
      const newId = res.data.id;
      setParsed(null); setPasteText(''); showSuccess('Przepis dodany'); loadRecipes();
      api.fetchImage(newId).then(() => loadRecipes()).catch(() => {});
    } catch (e) { showError(e.response?.data?.error || t('err_save_recipe')); }
  };

  const handleSaveName = async (id) => {
    const name = editingName.text.trim();
    if (!name) return;
    if (name.length > 200) { showError('Nazwa przepisu max 200 znaków'); return; }
    try {
      await api.update(id, { name });
      setEditingName(null); showSuccess('Nazwa zapisana'); loadRecipes();
    } catch (e) { showError(e.response?.data?.error || 'Błąd zapisu nazwy'); }
  };

  const handleSaveIngredients = async (id) => {
    const { rows } = editingIngredients;
    for (const row of rows) {
      if (!row.product_id) { showError('Wybierz produkt dla każdego składnika'); return; }
      if (!row.weight || row.weight <= 0 || row.weight > 99999) { showError('Gramatura musi być między 1 a 99999'); return; }
    }
    try {
      await api.update(id, { ingredients: rows.map(r => ({ product_id: parseInt(r.product_id), weight: parseFloat(r.weight) })) });
      setEditingIngredients(null); showSuccess('Zmiany zapisane'); loadRecipes();
    } catch (e) { showError(e.response?.data?.error || 'Błąd zapisu'); }
  };

  return (
    <div>
      <div className="card">
        <h2>{t('add_recipe_title')}</h2>

        {!parsed ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'stretch' }}>
            {/* Prawa: instrukcja */}
            <div style={{ background: '#1c3534', border: '1px solid #374151', borderRadius: 8, padding: '14px 16px', fontSize: 13, lineHeight: 1.7, order: 2 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0d9488', marginBottom: 10 }}>{t('how_to_recipe')}</div>

              <div style={{ padding: '8px 12px', background: '#111827', border: '1px solid #374151', borderRadius: 6, fontSize: 12, color: '#9ca3af', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>
                  <span style={{ display:'inline-flex', alignItems:'center', background:'#1e3a3a', color:'#2dd4bf', border:'1px solid #374151', borderRadius:5, padding:'2px 8px', fontSize:11, fontWeight:700, verticalAlign:'middle', marginRight:5 }}>Dodaj z AI</span>
                  - AI wyciągnie składniki za Ciebie i dopasuje do produktów w bazie, rozumiejąc kontekst i niestandardowe formaty.
                </div>
                <div>
                  <span style={{ display:'inline-flex', alignItems:'center', background:'#1e3a3a', color:'#2dd4bf', border:'1px solid #374151', borderRadius:5, padding:'2px 8px', fontSize:11, fontWeight:600, verticalAlign:'middle', marginRight:5 }}>Dodaj</span>
                  - Nie wymaga działania przy standardowych formatach. Przy nietypowych wymaga sprawdzenia i poprawienia dopasowań.
                </div>
              </div>

              <div style={{ padding: '8px 12px', background: '#111827', border: '1px solid #374151', borderRadius: 6, fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>
                <div style={{ marginBottom: 6 }}>
                  Możesz też wejść na{' '}
                  <a href="https://claude.ai/" target="_blank" rel="noreferrer" style={{ color: '#2dd4bf', textDecoration: 'underline' }}>Claude</a>
                  {' / '}
                  <a href="https://gemini.google.com/app" target="_blank" rel="noreferrer" style={{ color: '#2dd4bf', textDecoration: 'underline' }}>Gemini</a>
                  {' / '}
                  <a href="https://chatgpt.com/" target="_blank" rel="noreferrer" style={{ color: '#2dd4bf', textDecoration: 'underline' }}>ChatGPT</a>
                  , użyć prompta poniżej i tam wkleić swój przepis, a następnie odpowiedź wkleić do okna po lewej i użyć{' '}
                  <span style={{ display:'inline-flex', alignItems:'center', background:'#1e3a3a', color:'#2dd4bf', border:'1px solid #374151', borderRadius:5, padding:'1px 6px', fontSize:11, fontWeight:600, verticalAlign:'middle' }}>Dodaj</span>
                </div>
                <div style={{ position: 'relative' }}>
                  <pre style={{ background: '#1e293b', color: '#e2e8f0', borderRadius: 5, padding: '8px 10px', fontSize: 10, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, paddingBottom: 32 }}>{`Jesteś asystentem do wyodrębniania składników z przepisów. Gdy wkleję przepis, zwróć:

Nazwę przepisu w pierwszej linii
Następnie TYLKO CSV składników w formacie: nazwa,ilosc,jednostka

Zasady:
- Nagłówek CSV zawsze: nazwa,ilosc,jednostka
- ilosc = liczba z kropką (np. 0.5, 200, 1)
- jednostka = kg / g / l / ml / szt / łyżka / łyżeczka / szklanka
- Przeliczaj opisy na liczby: "pół" → 0.5, "trzy" → 3, "szczypta" → 1 (jednostka: szczypta)
- Żadnych komentarzy -- tylko nazwa przepisu w pierwszej linii i sam CSV`}</pre>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`Jesteś asystentem do wyodrębniania składników z przepisów. Gdy wkleję przepis, zwróć:\n\nNazwę przepisu w pierwszej linii\nNastępnie TYLKO CSV składników w formacie: nazwa,ilosc,jednostka\n\nZasady:\n- Nagłówek CSV zawsze: nazwa,ilosc,jednostka\n- ilosc = liczba z kropką (np. 0.5, 200, 1)\n- jednostka = kg / g / l / ml / szt / łyżka / łyżeczka / szklanka\n- Przeliczaj opisy na liczby: "pół" → 0.5, "trzy" → 3, "szczypta" → 1 (jednostka: szczypta)\n- Żadnych komentarzy -- tylko nazwa przepisu w pierwszej linii i sam CSV`);
                      setPromptCopied(true);
                      setTimeout(() => setPromptCopied(false), 2000);
                    }}
                    style={{ position: 'absolute', bottom: 6, right: 6, padding: '3px 10px', fontSize: 10, fontWeight: 600, background: promptCopied ? '#0d9488' : '#374151', color: promptCopied ? '#1f2937' : '#9ca3af', border: 'none', borderRadius: 4, cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    {promptCopied ? '✓ Skopiowano!' : 'Kopiuj prompt'}
                  </button>
                </div>
              </div>

            </div>

            {/* Lewa: inspiracje + textarea + przyciski */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, order: 1 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8 }}>Szukasz inspiracji?</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { href: 'https://aniagotuje.pl/', domain: 'aniagotuje.pl', label: 'aniagotuje.pl' },
                    { href: 'https://www.przepisy.pl/', domain: 'przepisy.pl', label: 'przepisy.pl' },
                    { href: 'https://www.kwestiasmaku.com/', domain: 'kwestiasmaku.com', label: 'kwestiasmaku.com' },
                  ].map(({ href, domain, label }) => (
                    <a key={domain} href={href} target="_blank" rel="noreferrer"
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none', background: '#111827', border: '1px solid #374151', borderRadius: 8, padding: '10px 8px', transition: 'border-color 0.15s', minWidth: 0 }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#0d9488'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#374151'}>
                      <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" style={{ width: 22, height: 22, borderRadius: 4 }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', textAlign: 'center' }}>{label}</span>
                    </a>
                  ))}
                </div>
              </div>
              <textarea
                ref={textareaRef}
                value={pasteText}
                onChange={e => { setPasteText(e.target.value.slice(0, 5000)); resizeTextarea(); }}
                maxLength={5000}
                placeholder={"wpisz lub wklej przepis...\n\nFormat tekstu:\nPierwsza linia - nazwa przepisu\nKażdy składnik w osobnej linii\nPodaj nazwę składnika i ilość z jednostką (g, ml, kg, l, łyżka, łyżeczka, szklanka…)\nMożesz wkleić tekst ze strony z przepisem\n\nPrzykład:\nOwsianka\npłatki owsiane 50 g\nmleko 200 ml\nbanan 120 g\nłyżka masła orzechowego"}
                style={{ width: '100%', minHeight: 330, padding: 12, border: '1.5px solid #374151', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, resize: 'none', overflowY: 'hidden', outline: 'none', boxSizing: 'border-box', background: '#111827', color: '#e2e8f0' }}
                onFocus={e => e.target.style.borderColor = '#0d9488'}
                onBlur={e => e.target.style.borderColor = '#374151'}
              />
              <div style={{ fontSize: 10, color: pasteText.length > 4500 ? '#f87171' : '#6b7280', textAlign: 'right', marginTop: -8 }}>
                {pasteText.length} / 5000
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <button className="btn btn-primary" onClick={handleParseAI} disabled={!pasteText.trim() || parsing === 'ai'} style={{ width: '100%' }}>
                    {parsing === 'ai' ? t('parsing_ai') : t('parse_ai_btn')}
                  </button>
                  <div style={{ fontSize: 11, marginTop: 4, color: remaining === 0 ? '#f87171' : '#ca8a04' }}>
                    Limit: 2 dziennie.{remaining !== null && ` Pozostało: ${remaining}`}
                  </div>
                </div>
                <div>
                  <button className="btn btn-primary" onClick={handleParseRegex} disabled={!pasteText.trim() || parsing === 'ai'}
                    style={{ width: '100%' }}>
                    {t('parse_regex_btn')}
                  </button>
                  <div style={{ fontSize: 11, marginTop: 4, color: '#2dd4bf' }}>
                    Bez limitu
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>{t('recipe_name_lbl')}</label>
              <input value={parsed.name} onChange={e => setParsed({ ...parsed, name: e.target.value })} style={{ width: '100%' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 80px 1fr 36px', gap: 8, padding: '0 10px', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t('ingredients_lbl')(parsed.ingredients.filter(i => i.product_id).length, parsed.ingredients.length)}
              </span>
              <span></span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.5px' }}>g / ml / szt</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dopasowany produkt</span>
              <span></span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {parsed.ingredients.map((ing, i) => (
                <React.Fragment key={i}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 80px 1fr 36px', gap: 8, alignItems: 'center', padding: '8px 10px', background: ing.product_id ? '#162616' : '#2d1f0f', border: `1px solid ${addingProductFor === i ? '#0d9488' : ing.product_id ? '#1a4a1a' : '#4a3010'}`, borderRadius: addingProductFor === i ? '8px 8px 0 0' : 8 }}>
                    <div style={{ fontSize: 13, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ing.rawName}>{ing.rawName}</div>
                    <button
                      onClick={() => {
                        if (addingProductFor === i) { setAddingProductFor(null); return; }
                        setAddingProductFor(i);
                        setQuickForm({ name: ing.rawName, package_weight: '100', package_price: '', unit: 'g', sold_by_weight: false });
                      }}
                      className="btn btn-primary"
                      style={{ padding: '5px 10px', fontSize: 11, whiteSpace: 'nowrap', ...(addingProductFor === i ? { background: '#0d9488', color: '#fff', borderColor: '#0d9488' } : {}) }}>
                      Dodaj do listy Produkty
                    </button>
                    <input type="number" value={ing.weight} min="0" max="99999" onChange={e => updateIngredient(i, 'weight', Math.min(99999, parseFloat(e.target.value) || 0))} style={{ padding: '6px 8px', fontSize: 13 }} />
                    <select value={ing.product_id || ''} onChange={e => updateIngredient(i, 'product_id', e.target.value || null)} style={{ padding: '6px 8px', fontSize: 13, width: '100%', minWidth: 0 }}>
                      <option value="">{t('no_match_opt')}</option>
                      {productList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button onClick={() => removeIngredient(i)} style={{ background: '#ef4444', border: 'none', color: '#1f2937', borderRadius: 6, cursor: 'pointer', fontSize: 14, height: 34 }}>✕</button>
                  </div>
                  {addingProductFor === i && (
                    <div style={{ background: '#111827', border: '1px solid #0d9488', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dodaj nowy produkt</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                        <div style={{ flex: 2, minWidth: 0 }}>
                          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3 }}>Nazwa produktu</div>
                          <input value={quickForm.name} maxLength={50} onChange={e => setQuickForm(f => ({ ...f, name: e.target.value.slice(0, 50) }))}
                            placeholder="np. Brokuły" style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', fontSize: 13 }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3 }}>Cena za opakowanie / kg (zł)</div>
                          <input type="number" className="no-spin" min="0" max="99999" step="0.01" value={quickForm.package_price}
                            onChange={e => setQuickForm(f => ({ ...f, package_price: e.target.value === '' ? '' : String(Math.min(99999, parseFloat(e.target.value) || 0)) }))}
                            placeholder="np. 4.99" style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', fontSize: 13 }} />
                        </div>
                        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #374151', flexShrink: 0 }}>
                          <button type="button" onClick={() => setQuickForm(f => ({ ...f, sold_by_weight: false }))}
                            style={{ padding: '6px 10px', border: 'none', borderRight: '1px solid #374151', cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s',
                              background: !quickForm.sold_by_weight ? '#0d9488' : '#2d3748', color: !quickForm.sold_by_weight ? 'white' : '#9ca3af' }}>
                            W opakowaniu
                          </button>
                          <button type="button" onClick={() => setQuickForm(f => ({ ...f, sold_by_weight: true, unit: 'g', package_weight: '' }))}
                            style={{ padding: '6px 10px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s',
                              background: quickForm.sold_by_weight ? '#0d9488' : '#2d3748', color: quickForm.sold_by_weight ? 'white' : '#9ca3af' }}>
                            Na wagę
                          </button>
                        </div>
                      </div>
                      {!quickForm.sold_by_weight && (
                        <div>
                          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3 }}>Ilość w opakowaniu</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, alignItems: 'stretch' }}>
                            <input type="number" className="no-spin" min="0" max="99999" value={quickForm.package_weight}
                              onChange={e => setQuickForm(f => ({ ...f, package_weight: e.target.value === '' ? '' : String(Math.min(99999, parseFloat(e.target.value) || 0)) }))}
                              placeholder="np. 100" style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', fontSize: 13 }} />
                            <div style={{ display: 'flex', gap: 3, alignItems: 'stretch' }}>
                              {['g', 'kg', 'ml', 'l', 'szt'].map(u => (
                                <button key={u} type="button" onClick={() => setQuickForm(f => ({ ...f, unit: u }))}
                                  style={{ padding: '0 7px', border: '1px solid', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                                    background: quickForm.unit === u ? '#0d9488' : '#1c3534',
                                    borderColor: quickForm.unit === u ? '#0d9488' : '#374151',
                                    color: quickForm.unit === u ? '#fff' : '#6b7280' }}>
                                  {u}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: 13, whiteSpace: 'nowrap' }} onClick={() => handleQuickAdd(i)}>
                          Dodaj produkt
                        </button>
                        <button className="btn" style={{ padding: '6px 10px', fontSize: 13, background: '#374151', color: '#9ca3af' }} onClick={() => setAddingProductFor(null)}>
                          Anuluj
                        </button>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
            <div style={{ background: '#1c2433', border: '1px solid #374151', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
              Brakuje produktu na liście lub dopasowanie jest błędne? Kliknij{' '}
              <span style={{ display: 'inline', background: '#1e3a3a', color: '#2dd4bf', border: '1px solid #374151', borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 600 }}>Dodaj do listy Produkty</span>
              {' '}przy danym składniku, wypełnij pola i kliknij{' '}
              <span style={{ display: 'inline-flex', alignItems: 'center', background: '#1e3a3a', color: '#2dd4bf', border: '1px solid #374151', borderRadius: 4, padding: '1px 8px', fontSize: 11, fontWeight: 700, verticalAlign: 'middle' }}>Dodaj produkt</span>
              {' '}nie martw się, szczegóły możesz edytować później w zakładce{' '}
              <span style={{ color: '#0d9488', fontWeight: 600 }}>Produkty</span>.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" onClick={handleSave}>{t('save_recipe')}</button>
              <button className="btn" style={{ background: '#374151', color: '#9ca3af' }} onClick={() => { setParsed(null);  }}>{t('back')}</button>
            </div>

            {parsed.sourceText && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 600 }}>{t('original_text_lbl')}</div>
                <pre style={{ background: '#1c3534', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#e2e8f0', lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, maxHeight: 300, overflowY: 'auto' }}>
                  {parsed.sourceText}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px 0 20px', gap: 6 }}>
          <button onClick={() => setListOpen(o => !o)}
            style={{ flex: 1, padding: '14px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600, color: '#0d9488' }}>
            {t('recipe_list_title')}
          </button>

          <button
            onClick={() => selectionMode ? exitSelection() : (setSelectionMode(true), setExpanded(null))}
            style={{ padding: '5px 11px', background: selectionMode ? '#1e3a3a' : 'transparent', border: `1px solid ${selectionMode ? '#0d9488' : '#374151'}`, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: selectionMode ? '#2dd4bf' : '#6b7280', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
          >
            {selectionMode ? 'Odznacz' : 'Zaznacz'}
          </button>

          <button
            onClick={() => {
              if (selectionMode) {
                if (selectedIds.size > 0) handleDeleteSelected();
              } else {
                showConfirm({
                  title: 'Usuń wszystkie przepisy',
                  message: `Czy na pewno chcesz usunąć wszystkie ${recipeList.length} przepisów?`,
                  confirmLabel: 'Usuń wszystkie',
                  onConfirm: async () => {
                    try { await api.deleteAll(); showSuccess('Wszystkie przepisy usunięte'); loadRecipes(); }
                    catch { showError('Błąd podczas usuwania przepisów'); }
                  },
                });
              }
            }}
            disabled={selectionMode && selectedIds.size === 0}
            style={{ padding: '5px 11px', background: 'transparent', border: '1px solid #374151', borderRadius: 6, cursor: selectionMode && selectedIds.size === 0 ? 'default' : 'pointer', fontSize: 12, color: selectionMode && selectedIds.size === 0 ? '#374151' : '#6b7280', transition: 'all 0.15s', whiteSpace: 'nowrap', opacity: selectionMode && selectedIds.size === 0 ? 0.4 : 1 }}
            onMouseEnter={e => { if (!(selectionMode && selectedIds.size === 0)) { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#374151'; e.currentTarget.style.color = selectionMode && selectedIds.size === 0 ? '#374151' : '#6b7280'; }}
          >
            {selectionMode && selectedIds.size > 0 ? `Usuń wybrane (${selectedIds.size})` : 'Usuń wszystkie'}
          </button>

          <button onClick={() => setListOpen(o => !o)}
            style={{ padding: '5px 4px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Icon icon="heroicons:chevron-down" style={{ width: 20, height: 20, transition: 'transform 0.25s', transform: listOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: '#0d9488' }} />
          </button>
        </div>
        {listOpen && <div style={{ padding: '0 20px 16px', borderTop: '1px solid #374151' }}>
        <div style={{ margin: '12px 0 10px' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj przepisu..."
            style={{ width: '100%', padding: '7px 12px', border: '1px solid #374151', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
            onFocus={e => e.target.style.borderColor = '#0d9488'}
            onBlur={e => e.target.style.borderColor = '#374151'}
          />
        </div>
        {recipeList.length === 0 && <p style={{ textAlign: 'center', color: '#6b7280' }}>{t('no_recipes_add')}</p>}
        {recipeList.length > 0 && search.trim() && filteredRecipes.length === 0 && (
          <p style={{ textAlign: 'center', color: '#6b7280', fontStyle: 'italic' }}>Nie znaleziono przepisu „{search}"</p>
        )}
        <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: '0 4px', width: '100%', minWidth: 600 }}>
          <thead>
            <tr>
              <th colSpan={2} style={{ width: '40%' }}>Nazwa</th>
              <th style={{ textAlign: 'center' }}>Kcal / Makro</th>
              <th style={{ textAlign: 'right' }}>Cena</th>
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
                  title={r.is_favorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
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
                  <strong style={{ cursor: 'pointer' }} title="Kliknij dwukrotnie aby edytować"
                    onDoubleClick={() => setEditingName({ id: r.id, text: r.name })}>
                    {r.name}
                  </strong>
                )}
              </div>
            </td>
            <td style={{ whiteSpace: 'nowrap', textAlign: 'center', ...(expanded === r.id ? { background: '#0d948818', borderTop: '1px solid #0d948860', borderBottom: '1px solid #0d948860' } : {}) }}>
              {r.total_kcal > 0 ? (
                <span style={{ fontSize: 12, color: '#9ca3af' }}>
                  <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{r.total_kcal}</span> kcal · B{r.total_protein} T{r.total_fat} W{r.total_carbs}
                </span>
              ) : <span style={{ fontSize: 11, color: '#374151' }}>—</span>}
            </td>
            <td style={{ whiteSpace: 'nowrap', textAlign: 'right', ...(expanded === r.id ? { background: '#0d948818', borderTop: '1px solid #0d948860', borderBottom: '1px solid #0d948860' } : {}) }}>
              <span style={{ color: '#0d9488', fontWeight: 600 }}>{r.total_cost.toFixed(2)} zł</span>
              {r.source_url && (
                <div style={{ marginTop: 2 }}>
                  <a href={r.source_url} target="_blank" rel="noreferrer"
                     style={{ fontSize: 11, color: '#e2e8f0', textDecoration: 'none', fontWeight: 600 }}
                     onClick={e => e.stopPropagation()}>
                    Zobacz przepis ↗
                  </a>
                </div>
              )}
            </td>
            <td style={{ textAlign: 'right', ...(expanded === r.id ? { background: '#0d948818', borderTop: '1px solid #0d948860', borderBottom: '1px solid #0d948860', borderRight: '1px solid #0d948860' } : {}) }} onClick={e => e.stopPropagation()}>
              <button className="btn btn-danger" onClick={(e) => { e.stopPropagation(); showConfirm({
                  title: 'Usuń przepis',
                  message: `Czy na pewno chcesz usunąć „${r.name}"?`,
                  confirmLabel: 'Usuń',
                  onConfirm: async () => { try { await api.delete(r.id); showSuccess('Przepis usunięty'); loadRecipes(); } catch { showError(t('err_save_recipe')); } },
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
              catch { showError('Błąd zapisu makro'); }
              setEditingIngCell(null);
            };
            const saveIngWeight = async (ing, weight) => {
              if (!weight || isNaN(parseFloat(weight))) { setEditingIngCell(null); return; }
              try { await api.update(r.id, { ingredients: ings.map(x => ({ product_id: x.product_id, weight: x.id === ing.id ? parseFloat(weight) : x.weight })) }); await loadExpandedDetail(r.id); }
              catch { showError('Błąd zapisu'); }
              setEditingIngCell(null);
            };
            const saveIngName = async (ing, name) => {
              if (!name.trim()) { setEditingIngCell(null); return; }
              try { await productsApi.update(ing.product_id, { name: name.trim() }); await loadExpandedDetail(r.id); }
              catch { showError('Błąd zapisu nazwy'); }
              setEditingIngCell(null);
            };
            const deleteIng = async (ing) => {
              try { await api.update(r.id, { ingredients: ings.filter(x => x.id !== ing.id).map(x => ({ product_id: x.product_id, weight: x.weight })) }); await loadExpandedDetail(r.id); }
              catch { showError('Błąd usuwania składnika'); }
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
              } catch { showError('Błąd dodawania składnika'); }
            };

            const isAdding = addingIng?.recipeId === r.id;
            const dropResults = isAdding && addingIng.search.length >= 2
              ? productList.filter(p => p.name.toLowerCase().includes(addingIng.search.toLowerCase())).slice(0, 8)
              : [];
            const exactMatch = isAdding && productList.find(p => p.name.toLowerCase() === addingIng.search.toLowerCase());
            const addUnit = addingIng?.product?.unit || addingIng?.unit || 'g';

            return (<>
              {ings === null && (
                <tr style={ingStyle}><td colSpan={5} style={{ textAlign: 'center', padding: 12, color: '#6b7280', fontSize: 13 }}>Ładowanie składników…</td></tr>
              )}
              {ings !== null && <>
              <tr style={ingStyle}>
                <th style={{ ...blStyle, fontSize: 11, color: '#6b7280', fontWeight: 700, letterSpacing: '0.5px', padding: '6px 8px' }}>Nazwa produktu</th>
                <th style={{ textAlign: 'left', fontSize: 11, color: '#6b7280', fontWeight: 700, letterSpacing: '0.5px', width: 100 }}>Potrzebuje</th>
                <th style={{ textAlign: 'center', fontSize: 11, color: '#6b7280', fontWeight: 700, letterSpacing: '0.5px' }}>Kcal / Makro</th>
                <th style={{ textAlign: 'right', fontSize: 11, color: '#6b7280', fontWeight: 700, letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>Koszt</th>
                <th style={{ textAlign: 'center', fontSize: 11, color: '#6b7280', fontWeight: 700, letterSpacing: '0.5px', width: 60 }}>Usuń</th>
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
                    <td style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => noEdit && setEditingIngCell({ key: cellKey, field: 'macro', vals: { kcal: ing.kcal != null ? String(ing.kcal) : '', protein: ing.protein != null ? String(ing.protein) : '', fat: ing.fat != null ? String(ing.fat) : '', carbs: ing.carbs != null ? String(ing.carbs) : '' } })}>
                      {isEditM ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}
                             onKeyDown={e => { if (e.key === 'Enter') saveIngMacro(ing, editingIngCell.vals); if (e.key === 'Escape') setEditingIngCell(null); }}>
                          <span style={{ fontSize: 10, color: '#6b7280' }}>kcal</span>
                          <input autoFocus style={inpS} value={editingIngCell.vals.kcal}    onChange={e => setEditingIngCell(c => ({ ...c, vals: { ...c.vals, kcal:    e.target.value } }))} placeholder="—" />
                          <span style={{ fontSize: 10, color: '#6b7280' }}>B</span>
                          <input style={inpS} value={editingIngCell.vals.protein} onChange={e => setEditingIngCell(c => ({ ...c, vals: { ...c.vals, protein: e.target.value } }))} placeholder="—" />
                          <span style={{ fontSize: 10, color: '#6b7280' }}>T</span>
                          <input style={inpS} value={editingIngCell.vals.fat}     onChange={e => setEditingIngCell(c => ({ ...c, vals: { ...c.vals, fat:     e.target.value } }))} placeholder="—" />
                          <span style={{ fontSize: 10, color: '#6b7280' }}>W</span>
                          <input style={inpS} value={editingIngCell.vals.carbs}   onChange={e => setEditingIngCell(c => ({ ...c, vals: { ...c.vals, carbs:   e.target.value } }))} placeholder="—" />
                          <button onClick={() => saveIngMacro(ing, editingIngCell.vals)} style={{ padding: '1px 5px', fontSize: 11, background: '#0d9488', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', marginLeft: 2 }}>✓</button>
                          <button onClick={() => setEditingIngCell(null)} style={{ padding: '1px 5px', fontSize: 11, background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 3, cursor: 'pointer' }}>✕</button>
                        </div>
                      ) : kcal != null
                        ? <span style={{ fontSize: 11, color: '#9ca3af' }}>{kcal} kcal · B{protein} T{fat} W{carbs}</span>
                        : <span style={{ fontSize: 11, color: '#9ca3af' }}>+ makro</span>}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{ing.cost.toFixed(2)} zł</td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => showConfirm({ title: 'Usuń składnik', message: `Usunąć „${ing.product_name}" z przepisu?`, confirmLabel: 'Usuń', onConfirm: () => deleteIng(ing) })}
                        style={{ background: '#2d1515', border: '1px solid #4b1515', color: '#f87171', borderRadius: 4, cursor: 'pointer', padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>Usuń</button>
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
                      <input autoFocus placeholder="Szukaj produktu..." value={addingIng.search} maxLength={200}
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
                              + Utwórz nowy: „{addingIng.search.trim()}"
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  {/* Potrzebuje */}
                  <td style={{ textAlign: 'left', width: 100 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <input type="number" className="no-spin" min="0.1" max="99999" placeholder="ilość" value={addingIng.weight}
                        onChange={e => setAddingIng(a => ({ ...a, weight: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') confirmAddIng(); if (e.key === 'Escape') setAddingIng(null); }}
                        style={{ width: 55, padding: '3px 4px', fontSize: 12, background: '#111827', border: '1px solid #374151', borderRadius: 4, color: '#f1f5f9', textAlign: 'center' }} />
                      <span style={{ fontSize: 11, color: '#6b7280' }}>{addUnit}</span>
                    </div>
                  </td>
                  {/* Kcal/Makro — auto-fill z produktu lub puste */}
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontSize: 10, color: '#6b7280' }}>kcal</span>
                      <input style={inpS} value={addingIng.kcal}    onChange={e => setAddingIng(a => ({ ...a, kcal:    e.target.value }))} placeholder="—" />
                      <span style={{ fontSize: 10, color: '#6b7280' }}>B</span>
                      <input style={inpS} value={addingIng.protein} onChange={e => setAddingIng(a => ({ ...a, protein: e.target.value }))} placeholder="—" />
                      <span style={{ fontSize: 10, color: '#6b7280' }}>T</span>
                      <input style={inpS} value={addingIng.fat}     onChange={e => setAddingIng(a => ({ ...a, fat:     e.target.value }))} placeholder="—" />
                      <span style={{ fontSize: 10, color: '#6b7280' }}>W</span>
                      <input style={inpS} value={addingIng.carbs}   onChange={e => setAddingIng(a => ({ ...a, carbs:   e.target.value }))} placeholder="—" />
                    </div>
                  </td>
                  {/* Cena — dla nowego produktu: pola ceny; dla istniejącego: info */}
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {addingIng.product ? (
                      <span style={{ fontSize: 11, color: '#6b7280' }}>istn. produkt</span>
                    ) : (() => {
                      const btnRow = (
                        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                          {['g','ml','szt'].map(u => (
                            <button key={u} onClick={() => setAddingIng(a => ({ ...a, unit: u, soldByWeight: false }))}
                              style={{ padding: '1px 6px', fontSize: 11, borderRadius: 3, cursor: 'pointer', border: '1px solid', fontWeight: addingIng.unit === u ? 700 : 400,
                                background: addingIng.unit === u ? '#0d9488' : '#1f2937', color: addingIng.unit === u ? '#fff' : '#9ca3af', borderColor: addingIng.unit === u ? '#0d9488' : '#374151' }}>
                              {u}
                            </button>
                          ))}
                          {addingIng.unit !== 'szt' && (
                            <button onClick={() => setAddingIng(a => ({ ...a, soldByWeight: !a.soldByWeight }))}
                              style={{ padding: '1px 6px', fontSize: 11, borderRadius: 3, cursor: 'pointer', border: '1px solid', fontWeight: addingIng.soldByWeight ? 700 : 400,
                                background: addingIng.soldByWeight ? '#6366f1' : '#1f2937', color: addingIng.soldByWeight ? '#fff' : '#9ca3af', borderColor: addingIng.soldByWeight ? '#6366f1' : '#374151' }}>
                              na wagę
                            </button>
                          )}
                        </div>
                      );
                      const priceRow = addingIng.unit === 'szt' ? (
                        <div style={{ display: 'flex', gap: 3, alignItems: 'center', justifyContent: 'flex-end' }}>
                          <input placeholder="cena" type="number" className="no-spin" min="0" max="99999" value={addingIng.priceSzt} onChange={e => setAddingIng(a => ({ ...a, priceSzt: e.target.value }))}
                            style={{ flex: 1, minWidth: 0, padding: '2px 4px', fontSize: 11, background: '#111827', border: '1px solid #374151', borderRadius: 3, color: '#e2e8f0' }} />
                          <span style={{ fontSize: 10, color: '#6b7280', flexShrink: 0 }}>zł/szt</span>
                        </div>
                      ) : addingIng.soldByWeight ? (
                        <div style={{ display: 'flex', gap: 3, alignItems: 'center', justifyContent: 'flex-end' }}>
                          <input placeholder="cena" type="number" className="no-spin" min="0" max="99999" value={addingIng.priceKg} onChange={e => setAddingIng(a => ({ ...a, priceKg: e.target.value }))}
                            style={{ flex: 1, minWidth: 0, padding: '2px 4px', fontSize: 11, background: '#111827', border: '1px solid #374151', borderRadius: 3, color: '#e2e8f0' }} />
                          <span style={{ fontSize: 10, color: '#6b7280', flexShrink: 0 }}>zł/kg</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 3, alignItems: 'center', justifyContent: 'flex-end' }}>
                          <input placeholder="cena" type="number" className="no-spin" min="0" max="99999" value={addingIng.priceOpak} onChange={e => setAddingIng(a => ({ ...a, priceOpak: e.target.value }))}
                            style={{ flex: 1, minWidth: 0, padding: '2px 4px', fontSize: 11, background: '#111827', border: '1px solid #374151', borderRadius: 3, color: '#e2e8f0' }} />
                          <span style={{ fontSize: 10, color: '#6b7280', flexShrink: 0 }}>zł /</span>
                          <input placeholder="opak." type="number" className="no-spin" min="0" max="99999" value={addingIng.pkgWeight} onChange={e => setAddingIng(a => ({ ...a, pkgWeight: e.target.value }))}
                            style={{ flex: 1, minWidth: 0, padding: '2px 4px', fontSize: 11, background: '#111827', border: '1px solid #374151', borderRadius: 3, color: '#e2e8f0' }} />
                          <span style={{ fontSize: 10, color: '#6b7280', flexShrink: 0 }}>{addingIng.unit}</span>
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
                        style={{ padding: '3px 8px', fontSize: 12, background: '#0d9488', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>Dodaj</button>
                      <button onClick={() => setAddingIng(null)}
                        style={{ padding: '3px 8px', fontSize: 12, background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 5, cursor: 'pointer' }}>Anuluj</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr style={{ ...ingStyle, cursor: 'pointer' }} onClick={() => { initAdding(); setEditingIngCell(null); }}>
                  <td style={blStyle} colSpan={5}>
                    <span style={{ color: '#0d9488', fontSize: 12, fontWeight: 600 }}>+ Dodaj składnik</span>
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
            <td colSpan={5} style={{ textAlign: 'center', color: '#4b5563', padding: '10px 0', fontSize: 12 }}>
              Pokazano {visibleCount} z {filteredRecipes.length} przepisów…
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
