import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { products as api, importPrices } from '../api';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';

const toUnitPrice = (packagePrice, packageWeight, unit) => {
  const pkg = parseFloat(packageWeight) || 1;
  const price = parseFloat(packagePrice) || 0;
  return unit === 'szt' ? price / pkg : (price / pkg) * 100;
};

const toPackagePrice = (unitPrice, packageWeight, unit) => {
  const pkg = parseFloat(packageWeight) || 1;
  return unit === 'szt' ? unitPrice * pkg : unitPrice * pkg / 100;
};

const priceLabel = (unit) =>
  unit === 'szt' ? 'zł/szt' : unit === 'ml' ? 'zł/100ml' : 'zł/100g';

const displayPrice = (p) => {
  if (!p.price) return '-';
  if (p.sold_by_weight) return `${toPackagePrice(p.price, 1000, 'g').toFixed(2)} zł/kg`;
  return `${toPackagePrice(p.price, p.package_weight, p.unit || 'g').toFixed(2)} zł`;
};

const EMPTY_FORM = { name: '', package_weight: '', package_price: '', unit: 'g', sold_by_weight: false };

const MacroDisplay = ({ p }) => {
  if (!p.protein && !p.fat && !p.carbs) return <span style={{ color: '#4b5563' }}>-</span>;
  return (
    <div style={{ fontSize: 13, color: '#9ca3af' }}>
      {p.protein != null && <span style={{ marginRight: 6 }}>B: {p.protein}g</span>}
      {p.fat     != null && <span style={{ marginRight: 6 }}>T: {p.fat}g</span>}
      {p.carbs   != null && <span>W: {p.carbs}g</span>}
    </div>
  );
};

export default function Products() {
  const { t } = useLanguage();
  const { showError, showSuccess, showToast: globalToast, showConfirm } = useToast();
  const [productList, setProductList] = useState([]);
  const [pasteText, setPasteText] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [lookingUp, setLookingUp] = useState(null);
  const [importItems, setImportItems] = useState(null);
  const [importing, setImporting] = useState(false);
  const [remainingImports, setRemainingImports] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [listOpen, setListOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [visibleCount, setVisibleCount] = useState(50);
  const fileInputRef = useRef();
  const sentinelRef = useRef(null);

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const exitSelection = () => { setSelectionMode(false); setSelectedIds(new Set()); };

  const handleDeleteSelected = () => {
    showConfirm({
      title: 'Usuń zaznaczone produkty',
      message: `Czy na pewno chcesz usunąć ${selectedIds.size} zaznaczonych produktów?`,
      confirmLabel: 'Usuń',
      onConfirm: async () => {
        try {
          await Promise.all([...selectedIds].map(id => api.delete(id)));
          showSuccess(`Usunięto ${selectedIds.size} produktów`);
          exitSelection();
          loadProducts();
        } catch { showError('Błąd podczas usuwania'); }
      },
    });
  };

  const mapImportItem = item => ({
    ...item,
    selected: !!item.matched_product,
    price: item.receipt_price != null ? String(item.receipt_price) : '',
    weight: item.receipt_quantity != null ? String(item.receipt_quantity) : '',
    unit: item.receipt_unit || 'g',
    _unitPrice: item.suggested_price,
    sold_by_weight: false,
  });

  const isImageFile = (file) => file && /\.(jpe?g|png|webp)$/i.test(file.name);
  const isTextFile  = (file) => file && /\.(txt|csv)$/i.test(file.name);

  useEffect(() => { loadProducts(); }, []);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? productList.filter(p => p.name.toLowerCase().includes(q)) : productList;
  }, [productList, search]);

  useEffect(() => { setVisibleCount(50); }, [search]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting)
        setVisibleCount(v => Math.min(v + 50, filteredProducts.length));
    }, { rootMargin: '300px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [filteredProducts.length]);

  const loadProducts = async () => {
    try { setProductList((await api.getAll()).data); }
    catch { showError(t('err_load_products')); }
  };

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, parseFloat(v) || 0));
  const numClamp = (v, hi = 99999, lo = 0) => {
    if (v === '') return '';
    const n = parseFloat(v);
    return isNaN(n) ? v : String(Math.min(hi, Math.max(lo, n)));
  };

  const handleSubmit = async () => {
    if (!form.name || !form.package_price) { showError(t('err_fill_fields')); return; }
    if (!form.sold_by_weight && !form.package_weight) { showError(t('err_fill_fields')); return; }
    const sbw = !!form.sold_by_weight;
    let unit = sbw ? 'g' : form.unit;
    let pkgW = sbw ? 1000 : clamp(form.package_weight, 0.001, 99999);
    if (unit === 'kg') { unit = 'g';  pkgW = Math.min(99999, pkgW * 1000); }
    if (unit === 'l')  { unit = 'ml'; pkgW = Math.min(99999, pkgW * 1000); }
    const pkgPrice = clamp(form.package_price, 0, 99999);
    try {
      const created = await api.create({
        name: form.name,
        package_weight: pkgW,
        price: Math.min(99999, toUnitPrice(pkgPrice, pkgW, unit)),
        unit,
        sold_by_weight: sbw,
      });
      setForm(EMPTY_FORM);
      setPasteText('');
      showSuccess('Produkt dodany');
      const macro = await fetchMacroFromOFF(form.name);
      if (macro) await api.update(created.data.id, macro);
      loadProducts();
    } catch (e) { showError(e.response?.data?.error || t('err_fill_fields')); }
  };

  const startEdit = (p) => {
    setEditId(p.id);
    setEditForm({
      name: p.name,
      package_weight: p.package_weight,
      package_price: toPackagePrice(p.price, p.package_weight, p.unit || 'g').toFixed(2),
      unit: p.unit || 'g',
      sold_by_weight: !!p.sold_by_weight,
      kcal:    p.kcal    ?? '',
      protein: p.protein ?? '',
      fat:     p.fat     ?? '',
      carbs:   p.carbs   ?? '',
    });
  };

  const handleSaveEdit = async () => {
    const sbw = !!editForm.sold_by_weight;
    let unit = sbw ? 'g' : editForm.unit;
    let pkgW = sbw ? 1000 : clamp(editForm.package_weight, 0.001, 99999);
    if (unit === 'kg') { unit = 'g';  pkgW = Math.min(99999, pkgW * 1000); }
    if (unit === 'l')  { unit = 'ml'; pkgW = Math.min(99999, pkgW * 1000); }
    const pkgPrice = clamp(editForm.package_price, 0, 99999);
    try {
      await api.update(editId, {
        name: editForm.name,
        package_weight: pkgW,
        price: Math.min(99999, toUnitPrice(pkgPrice, pkgW, unit)),
        unit,
        sold_by_weight: sbw,
        kcal:    editForm.kcal    !== '' ? parseFloat(editForm.kcal)    : null,
        protein: editForm.protein !== '' ? parseFloat(editForm.protein) : null,
        fat:     editForm.fat     !== '' ? parseFloat(editForm.fat)     : null,
        carbs:   editForm.carbs   !== '' ? parseFloat(editForm.carbs)   : null,
      });
      setEditId(null); showSuccess('Zapisano zmiany'); loadProducts();
    } catch (e) { showError(e.response?.data?.error || t('save_btn')); }
  };

  const handleAutoFill = async () => {
    if (!editForm.name) return;
    setLookingUp(editId); 
    try {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(editForm.name)}&search_simple=1&action=process&json=1&page_size=5&fields=product_name,nutriments`;
      const res = await fetch(url);
      const data = await res.json();
      let found = false;
      for (const p of (data.products || [])) {
        const n = p.nutriments || {};
        let kcal = n['energy-kcal_100g'] ?? n['energy-kcal'] ?? null;
        if (!kcal && n['energy_100g']) kcal = Math.round(n['energy_100g'] / 4.184 * 10) / 10;
        if (kcal) {
          setEditForm(f => ({ ...f, kcal: Math.round(kcal * 10) / 10, protein: Math.round((n['proteins_100g'] ?? 0) * 10) / 10, fat: Math.round((n['fat_100g'] ?? 0) * 10) / 10, carbs: Math.round((n['carbohydrates_100g'] ?? 0) * 10) / 10 }));
          found = true; break;
        }
      }
      if (!found) showError(t('err_not_found_off')(editForm.name));
    } catch { showError(t('err_off')); }
    finally { setLookingUp(null); }
  };

  const handleDelete = (id, name) => {
    showConfirm({
      title: 'Usuń produkt',
      message: `Czy na pewno chcesz usunąć „${name}"? Tej operacji nie można cofnąć.`,
      confirmLabel: 'Usuń',
      onConfirm: async () => {
        try { await api.delete(id); showSuccess('Produkt usunięty'); loadProducts(); }
        catch { showError(t('del_btn')); }
      },
    });
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

  const handleFileSelect = (file) => { if (!file) return; setSelectedFile(file);  };

  const handleParseAI = async () => {
    if (!selectedFile) return;
    setImporting(true); 
    try {
      const res = await importPrices.parse(selectedFile);
      setRemainingImports(res.data.remaining_today);
      setImportItems(res.data.items.map(mapImportItem));
    } catch (e) { showError(e.response?.data?.error || t('analyzing')); }
    finally { setImporting(false); }
  };

  const handleParseFree = async () => {
    if (!selectedFile) return;
    setImporting(true); 
    try {
      const res = await importPrices.parseFree(selectedFile);
      setImportItems(res.data.items.map(mapImportItem));
    } catch (e) { showError(e.response?.data?.error || t('processing')); }
    finally { setImporting(false); }
  };

  const handleApplyImport = async () => {
    const selected = importItems.filter(i => i.selected && i.price !== '' && i.price !== null);
    if (!selected.length) { showError(t('at_least_one')); return; }
    const invalid = selected.filter(i => isNaN(parseFloat(i.price)) || parseFloat(i.price) < 0);
    if (invalid.length) { showError('Wprowadź prawidłową cenę dla zaznaczonych produktów'); return; }
    const overPrice = selected.filter(i => parseFloat(i.price) > 99999);
    if (overPrice.length) { showError('Cena nie może przekraczać 99999 zł'); return; }
    const overWeight = selected.filter(i => parseFloat(i.weight) > 99999);
    if (overWeight.length) { showError('Gramatura nie może przekraczać 99999'); return; }
    const longName = selected.filter(i => (i.receipt_name || '').trim().length > 200);
    if (longName.length) { showError('Nazwa produktu max 200 znaków'); return; }
    const emptyName = selected.filter(i => !i.matched_product && !(i.receipt_name || '').trim());
    if (emptyName.length) { showError('Uzupełnij nazwę dla nowych produktów'); return; }

    const toUpdate = selected.filter(i => i.matched_product);
    const toCreate = selected.filter(i => !i.matched_product && i.receipt_name?.trim());

    try {
      const calcUnitPrice = (item) => {
        const sbw = !!item.sold_by_weight;
        const pkg = sbw ? 1000 : (parseFloat(item.weight) || (item.unit === 'szt' ? 1 : 1000));
        const unit = sbw ? 'g' : (item.unit || 'g');
        return parseFloat(toUnitPrice(parseFloat(item.price), pkg, unit).toFixed(4));
      };

      if (toUpdate.length) {
        await importPrices.apply(toUpdate.map(i => ({
          product_id: parseInt(i.matched_product.id, 10),
          price: calcUnitPrice(i),
        })));
        for (const item of toUpdate) {
          if (item.sold_by_weight !== undefined)
            await api.update(item.matched_product.id, { sold_by_weight: !!item.sold_by_weight });
        }
      }

      for (const item of toCreate) {
        const sbw = !!item.sold_by_weight;
        const pkg = sbw ? 1000 : (parseFloat(item.weight) || (item.unit === 'szt' ? 1 : 1000));
        const unit = sbw ? 'g' : (item.unit || 'g');
        const created = await api.create({
          name: item.receipt_name.trim(),
          package_weight: pkg,
          price: calcUnitPrice(item),
          unit,
          sold_by_weight: sbw,
        });
        const macro = await fetchMacroFromOFF(item.receipt_name);
        if (macro) await api.update(created.data.id, macro);
      }

      setImportItems(null);
      globalToast(t('fetching_macro'), '#eab308', 999999);
      for (const item of toUpdate) {
        const macro = await fetchMacroFromOFF(item.matched_product.name);
        if (macro) await api.update(item.matched_product.id, macro);
      }

      const msg = [
        toUpdate.length && `Zaktualizowano ${toUpdate.length}`,
        toCreate.length && `Dodano ${toCreate.length}`,
      ].filter(Boolean).join(', ') + ' produktów · Makro zaktualizowane';
      showSuccess(msg);
      loadProducts();
    } catch { showError('Błąd przy zapisywaniu produktów');  }
  };


  const s = { padding: '5px 8px', fontSize: 13 };
  const fl = { fontSize: 10, color: '#6b7280', marginBottom: 3 };
  const sec = { fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, marginTop: 4 };

  const UnitSelect = ({ value, onChange, style }) => (
    <select value={value} onChange={onChange} style={style}>
      <option value="g">g</option>
      <option value="ml">ml</option>
      <option value="szt">szt</option>
    </select>
  );

  const parseProductText = (text) => {
    if (!text.trim()) return null;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return null;

    const toG = (val, u) => {
      const v = parseFloat(String(val).replace(',', '.'));
      if (u === 'kg') return { w: Math.round(v * 1000), unit: 'g' };
      if (u === 'l')  return { w: Math.round(v * 1000), unit: 'ml' };
      return { w: Math.round(v), unit: u };
    };
    const stripWeight = (s) => s.replace(/\d+(?:[,.]?\d+)?\s*(kg|g|ml|l|szt)\b/gi, '').replace(/\s+/g, ' ').trim().slice(0, 50);
    const num = (s) => parseFloat(String(s).replace(',', '.'));

    // ── Auchan ────────────────────────────────────────────────────
    if (/sprzedawcą jest auchan/i.test(text)) {
      const firstLine = lines[0];
      const byWeight = /na\s+wagę/i.test(firstLine);
      const wm = firstLine.match(/(\d+(?:[,.]?\d+)?)\s*(kg|g|ml|l)\s*$/i);
      let weight = '', unit = 'g', sold_by_weight = byWeight;
      if (wm) {
        const { w, unit: u } = toG(wm[1], wm[2].toLowerCase());
        weight = String(w); unit = u;
        if (wm[2].toLowerCase() === 'kg' && !byWeight) sold_by_weight = false;
      }
      const name = stripWeight(firstLine.replace(/na\s+wagę/gi, ''));
      // Ostatnia samodzielna cena w zł (nie zł/kg)
      const allPrices = [...text.matchAll(/(\d+[,.]?\d+)\s*zł(?!\/|\s*\/)/gi)];
      const price = allPrices.length ? String(num(allPrices[allPrices.length - 1][1]).toFixed(2)) : '';
      return { name, package_price: price, package_weight: weight, unit, sold_by_weight };
    }

    // ── Carrefour (nazwa powtórzona w 2 pierwszych liniach) ───────
    if (lines.length >= 2 && lines[0] === lines[1]) {
      const firstLine = lines[0];
      const wm = firstLine.match(/(\d+(?:[,.]?\d+)?)\s*(kg|g|ml|l)\s*$/i);
      let weight = '', unit = 'g';
      if (wm) { const r = toG(wm[1], wm[2].toLowerCase()); weight = String(r.w); unit = r.unit; }
      const name = stripWeight(firstLine);
      // Cena z fragmentów "7\n65\nzł" LUB obliczona z zł/kg
      let price = '';
      const pkgKgM = text.match(/(\d+[,.]?\d+)\s*zł\/1?\s*kg/i);
      if (pkgKgM && weight) {
        price = (num(pkgKgM[1]) * parseFloat(weight) / 1000).toFixed(2);
      } else {
        const zlIdx = lines.findIndex(l => /^zł$/i.test(l));
        if (zlIdx >= 2 && /^\d+$/.test(lines[zlIdx - 2]) && /^\d+$/.test(lines[zlIdx - 1])) {
          price = `${lines[zlIdx - 2]}.${lines[zlIdx - 1]}`;
        }
      }
      return { name, package_price: price, package_weight: weight, unit, sold_by_weight: false };
    }

    // ── Biedronka (Nazwa Weight\nWeight - Price zł / kg) ─────────
    {
      const firstLine = lines[0];
      const wm = firstLine.match(/(\d+(?:[,.]?\d+)?)\s*(kg|g|ml|l)\s*$/i);
      const pkgKgM = text.match(/(\d+[,.]?\d+)\s*zł\s*\/\s*kg/i);
      if (wm && pkgKgM) {
        const { w, unit } = toG(wm[1], wm[2].toLowerCase());
        const pricePerKg = num(pkgKgM[1]);
        const price = (pricePerKg * w / 1000).toFixed(2);
        const name = stripWeight(firstLine);
        return { name, package_price: price, package_weight: String(w), unit, sold_by_weight: false };
      }
    }

    // ── Fallback ──────────────────────────────────────────────────
    const isByWeight = /na\s+wagę/i.test(text) || /zł\/kg/i.test(text);
    let price = '', weight = '', unit = 'g';
    if (isByWeight) {
      const m = text.match(/(\d+[,.]?\d*)\s*zł\/kg/i);
      if (m) price = String(num(m[1]).toFixed(2));
    } else {
      const m = text.match(/(\d+[,.]?\d+)\s*zł(?!\/)/i);
      if (m) price = String(num(m[1]).toFixed(2));
      const wm = text.match(/(\d+(?:[,.]?\d+)?)\s*(kg|g|ml|l)\b/i);
      if (wm) { const r = toG(wm[1], wm[2].toLowerCase()); weight = String(r.w); unit = r.unit; }
    }
    const name = stripWeight((lines[0] || '').replace(/na\s+wagę/gi, '').replace(/kiść/gi, ''));
    return { name, package_price: price, package_weight: weight, unit, sold_by_weight: isByWeight };
  };

  return (
    <div>
      <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, marginBottom: 20, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px' }}>
        <h2>{t('add_product_title')}</h2>

        {/* Szukasz produktów */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8 }}>Szukasz produktów?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { domain: 'zakupy.auchan.pl',    url: 'https://zakupy.auchan.pl/',    label: 'Auchan' },
              { domain: 'zakupy.biedronka.pl', url: 'https://zakupy.biedronka.pl/', label: 'Biedronka' },
              { domain: 'carrefour.pl',        url: 'https://www.carrefour.pl/',    label: 'Carrefour' },
            ].map(({ domain, url, label }) => (
              <a key={label} href={url} target="_blank" rel="noreferrer"
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none', background: '#111827', border: '1px solid #374151', borderRadius: 8, padding: '10px 8px', transition: 'border-color 0.15s', minWidth: 0 }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#0d9488'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#374151'}>
                <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" style={{ width: 22, height: 22, borderRadius: 4 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', textAlign: 'center' }}>{label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Textarea + formularz obok siebie */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <textarea
            value={pasteText}
            maxLength={500}
            onChange={e => {
              const txt = e.target.value.slice(0, 500);
              setPasteText(txt);
              const parsed = parseProductText(txt);
              if (parsed) setForm(f => ({ ...f, ...parsed }));
              else if (!txt.trim()) setForm(EMPTY_FORM);
            }}
            placeholder={'Wklej produkt ze strony sklepu lub sam wpisz np:\n\nBanany Premium Owoce Auchan na wagę kiść 4-6 szt ok. 1 kg\nSprzedawcą jest Auchan Polska Sp. z o.o.\n1kg ~szacunkowa porcja 6,98 zł/kg\n1kg\n~szacunkowa porcja\n(6,98 zł/kg)\n6,98 zł\n~szacunkowa porcja\n\nBanan 1kg 7zł'}
            style={{ width: '100%', boxSizing: 'border-box', minHeight: 250, padding: '8px 10px', fontSize: 12, fontFamily: 'inherit', lineHeight: 1.6, resize: 'none', background: '#111827', border: '1px solid #374151', color: '#e2e8f0', borderRadius: 7, outline: 'none' }}
            onFocus={e => e.target.style.borderColor = '#0d9488'}
            onBlur={e => e.target.style.borderColor = '#374151'}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>Sprawdź czy dane są poprawne:</div>
              <div>
                <div style={fl}>Nazwa produktu</div>
                <input value={form.name} maxLength={50} onChange={e => setForm({ ...form, name: e.target.value.slice(0, 50) })}
                  style={{ width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'end' }}>
                <div>
                  <div style={fl}>Cena / kg (zł)</div>
                  <input type="number" className="no-spin" step="0.01" min="0" max="9999" value={form.package_price}
                    onChange={e => setForm({ ...form, package_price: numClamp(e.target.value, 9999) })}
                    placeholder="np. 3.49" style={{ width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', borderRadius: 7, overflow: 'hidden', border: '1px solid #374151' }}>
                  <button type="button" onClick={() => setForm(f => ({ ...f, sold_by_weight: false }))}
                    style={{ padding: '9px 10px', border: 'none', borderRight: '1px solid #374151', cursor: 'pointer', fontSize: 11, fontWeight: 600, transition: 'all 0.15s', whiteSpace: 'nowrap',
                      background: !form.sold_by_weight ? '#1e3a3a' : 'transparent', color: !form.sold_by_weight ? '#2dd4bf' : '#6b7280' }}>
                    W opak.
                  </button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, sold_by_weight: true, unit: 'g', package_weight: '' }))}
                    style={{ padding: '9px 10px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, transition: 'all 0.15s', whiteSpace: 'nowrap',
                      background: !!form.sold_by_weight ? '#1e3a3a' : 'transparent', color: !!form.sold_by_weight ? '#2dd4bf' : '#6b7280' }}>
                    Na wagę
                  </button>
                </div>
              </div>
              {!form.sold_by_weight && (
                <div>
                  <div style={fl}>Pojemność opakowania</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'stretch' }}>
                    <input type="number" className="no-spin" min="0" max="99999" value={form.package_weight}
                      onChange={e => setForm({ ...form, package_weight: numClamp(e.target.value) })}
                      placeholder="np. 1000" style={{ width: '100%', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
                      {['g', 'kg', 'ml', 'l', 'szt'].map(u => (
                        <button key={u} type="button" onClick={() => setForm(f => ({ ...f, unit: u }))}
                          style={{ padding: '0 7px', border: '1px solid #374151', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                            background: form.unit === u ? '#1e3a3a' : '#111827',
                            color: form.unit === u ? '#2dd4bf' : '#6b7280' }}>
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                <button className="btn btn-primary" onClick={handleSubmit} style={{ flex: 1 }}>Zapisz</button>
                <button className="btn" onClick={() => { setPasteText(''); setForm(EMPTY_FORM); }}
                  style={{ background: '#374151', color: '#9ca3af' }}>Anuluj</button>
              </div>
            </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Drop zone + import */}
          <div style={{ borderTop: '1px solid #374151', marginTop: 16, paddingTop: 16 }}>
            <h2 style={{ margin: '0 0 10px' }}>{t('import_title')}</h2>
            {!importItems ? (
              <>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0]); }}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ border: `2px dashed ${dragOver ? '#0d9488' : selectedFile ? '#22c55e' : '#374151'}`, borderRadius: 10, padding: '20px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(13,148,136,0.05)' : '#111827', transition: 'all 0.15s', marginBottom: 10 }}
                >
                  <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.txt,.csv" style={{ display: 'none' }} onChange={e => handleFileSelect(e.target.files[0])} />
                  {selectedFile ? (
                    <>
                      <div style={{ fontWeight: 600, color: '#2dd4bf', marginBottom: 2 }}>
                        {isImageFile(selectedFile) ? 'Opcja 1: ' : 'Opcja 2: '}{selectedFile.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{t('click_change')}</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 28, marginBottom: 6 }}>📂</div>
                      <div style={{ fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>{t('click_drag_file')}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{t('file_types_hint')}</div>
                    </>
                  )}
                </div>
                {selectedFile && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {isImageFile(selectedFile) && (
                      <button className="btn btn-primary" onClick={handleParseAI} disabled={importing}>
                        {importing ? t('analyzing') : t('apply_ai_btn')}
                      </button>
                    )}
                    {isTextFile(selectedFile) && (
                      <button className="btn btn-primary" onClick={handleParseFree} disabled={importing}>
                        {importing ? t('processing') : t('apply_file_btn')}
                      </button>
                    )}
                    <button className="btn" style={{ background: '#374151', color: '#9ca3af' }} onClick={() => setSelectedFile(null)}>
                      {t('cancel')}
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>

          <div style={{ background: '#1c3534', border: '1px solid #374151', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0d9488', marginBottom: 4 }}>{t('macro_auto_title')}</div>
            Po dodaniu produktu wartości Kcal, Białka, Tłuszczów i Węglowodanów automatycznie zostaną pobrane z bazy{' '}
            <a href="https://world.openfoodfacts.org/" target="_blank" rel="noreferrer"
              style={{ color: '#2dd4bf', textDecoration: 'underline', cursor: 'pointer' }}>Open Food Facts</a>.
            <div style={{ marginTop: 6, color: '#6b7280' }}>
              Chcesz je zmienić? Kliknij w produkt na liście poniżej, żeby otworzyć edycję.
            </div>
          </div>
        </div>
      </div>

      {/* Import section — how-to only */}
      {!importItems && <div style={{ padding: '20px 24px' }}>

        <div style={{ background: '#1c3534', border: '1px solid #374151', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, lineHeight: 1.7 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0d9488', marginBottom: 8 }}>{t('import_how_to')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Opcja 1 */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#e2e8f0', marginBottom: 8 }}>{t('opt1_title')}</div>
              <ol style={{ margin: '0 0 8px', paddingLeft: 18, color: '#9ca3af', fontSize: 12, lineHeight: 1.8 }}>
                <li>{t('opt1_s1')}</li>
                <li>Kliknij{' '}
                  <span style={{ display:'inline-flex', alignItems:'center', background:'#1e3a3a', color:'#2dd4bf', border:'1px solid #374151', borderRadius:4, padding:'2px 7px', fontSize:11, fontWeight:700, verticalAlign:'middle', margin:'0 2px' }}>Zastosuj przez AI</span>
                  {' '}-{' '}
                  <a href="https://gemini.google.com/app" target="_blank" rel="noreferrer" style={{ color:'#2dd4bf', textDecoration:'underline' }}>Gemini</a>
                  {' '}wyciągnie produkty i ceny
                </li>
                <li>Sprawdź dopasowania i kliknij{' '}
                  <span style={{ display:'inline-flex', alignItems:'center', background:'#1e3a3a', color:'#2dd4bf', border:'1px solid #374151', borderRadius:4, padding:'2px 7px', fontSize:11, fontWeight:700, verticalAlign:'middle', margin:'0 2px' }}>Zastosuj zmiany</span>
                </li>
              </ol>
              <div style={{ fontSize: 11, color: '#ca8a04', marginBottom: 6 }}>
                {t('ai_daily_lim')}{remainingImports !== null && <span>{t('ai_rem')(remainingImports)}</span>}
              </div>
              <div style={{ fontSize: 11, color: '#2dd4bf', background: '#111827', border: '1px solid #374151', borderRadius: 5, padding: '6px 10px' }}>
                Zgubiłeś paragon? Otwórz paragon w aplikacji sklepu, zrób screenshot i wgraj
              </div>
            </div>

            {/* Opcja 2 */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#e2e8f0', marginBottom: 8 }}>{t('opt2_title')}</div>
              <ol style={{ margin: '0 0 8px', paddingLeft: 18, color: '#9ca3af', fontSize: 12, lineHeight: 1.8 }}>
                <li>
                  Wymagany format:{' '}
                  <code style={{ background: '#1e293b', color: '#2dd4bf', padding: '1px 6px', borderRadius: 3, fontFamily: 'monospace' }}>nazwa,gramatura,jednostka,cena</code>
                  <br />
                  lub:{' '}
                  <code style={{ background: '#1e293b', color: '#2dd4bf', padding: '1px 6px', borderRadius: 3, fontFamily: 'monospace' }}>nazwa,cena</code>
                  {' '}<span style={{ color: '#6b7280', fontSize: 11 }}>(ręcznie wprowadź gramaturę i jednostkę)</span>
                </li>
                <li>Wgraj plik i kliknij{' '}
                  <span style={{ display:'inline-flex', alignItems:'center', background:'#1e3a3a', color:'#2dd4bf', border:'1px solid #374151', borderRadius:4, padding:'2px 7px', fontSize:11, fontWeight:700, verticalAlign:'middle', margin:'0 2px' }}>Zastosuj plik</span>
                </li>
              </ol>
              <div style={{ fontSize: 11, color: '#2dd4bf' }}>{t('no_lim')}</div>
            </div>

          </div>

          {/* Prompt box — pełna szerokość pod oboma opcjami */}
          <div style={{ marginTop: 12, fontSize: 11, color: '#2dd4bf', background: '#111827', border: '1px solid #374151', borderRadius: 5, padding: '10px 12px' }}>
            <div style={{ marginBottom: 8, color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>
              Chcesz szybko uzupełnić / zaktualizować listę produktów?
            </div>
            <div style={{ marginBottom: 6, color: '#9ca3af', fontSize: 12 }}>
              <strong style={{ color: '#e2e8f0' }}>1.</strong> Przejdź na{' '}
              <a href="https://claude.ai/" target="_blank" rel="noreferrer" style={{ color: '#2dd4bf', textDecoration: 'underline' }}>Claude</a>
              {' / '}
              <a href="https://gemini.google.com/app" target="_blank" rel="noreferrer" style={{ color: '#2dd4bf', textDecoration: 'underline' }}>Gemini</a>
              {' / '}
              <a href="https://chatgpt.com/" target="_blank" rel="noreferrer" style={{ color: '#2dd4bf', textDecoration: 'underline' }}>ChatGPT</a>
              {' '}i wklej następujący prompt:
            </div>
            <div style={{ position: 'relative' }}>
              <pre style={{ background: '#1e293b', color: '#e2e8f0', borderRadius: 5, padding: '8px 10px', paddingBottom: 32, fontSize: 10, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{`Jesteś asystentem do formatowania list produktów. Gdy wkleję Ci listę produktów w dowolnym formacie, zwróć TYLKO gotowy CSV w formacie:
nazwa,gramatura,jednostka,cena
Zasady:
- Pierwsza linia to zawsze nagłówek: nazwa,gramatura,jednostka,cena
- gramatura = liczba (np. 1, 0.5, 200)
- jednostka = kg / g / l / ml / szt
- cena = liczba z kropką (np. 4.50)
- Jeśli czegoś brakuje: gramatura = 1, jednostka = szt, cena = 0.00
- Żadnego komentarza -- tylko sam CSV

Czekam na moją listę.`}</pre>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`Jesteś asystentem do formatowania list produktów. Gdy wkleję Ci listę produktów w dowolnym formacie, zwróć TYLKO gotowy CSV w formacie:\nnazwa,gramatura,jednostka,cena\nZasady:\n- Pierwsza linia to zawsze nagłówek: nazwa,gramatura,jednostka,cena\n- gramatura = liczba (np. 1, 0.5, 200)\n- jednostka = kg / g / l / ml / szt\n- cena = liczba z kropką (np. 4.50)\n- Jeśli czegoś brakuje: gramatura = 1, jednostka = szt, cena = 0.00\n- Żadnego komentarza -- tylko sam CSV\n\nCzekam na moją listę.`);
                  setPromptCopied(true);
                  setTimeout(() => setPromptCopied(false), 2000);
                }}
                style={{ position: 'absolute', bottom: 6, right: 6, padding: '3px 10px', fontSize: 10, fontWeight: 600, background: promptCopied ? '#0d9488' : '#374151', color: promptCopied ? '#1f2937' : '#9ca3af', border: 'none', borderRadius: 4, cursor: 'pointer', transition: 'all 0.2s' }}
              >
                {promptCopied ? '✓ Skopiowano!' : 'Kopiuj prompt'}
              </button>
            </div>
            <div style={{ marginTop: 6, color: '#9ca3af', fontSize: 12 }}><strong style={{ color: '#e2e8f0' }}>2.</strong> Wklej listę produktów / podaj produkty</div>
            <div style={{ marginTop: 4, color: '#9ca3af', fontSize: 12 }}><strong style={{ color: '#e2e8f0' }}>3.</strong> Utwórz nowy dokument tekstowy</div>
            <div style={{ marginTop: 4, color: '#9ca3af', fontSize: 12 }}><strong style={{ color: '#e2e8f0' }}>4.</strong> Skopiuj odpowiedź z Claude / Gemini / ChatGPT do dokumentu</div>
            <div style={{ marginTop: 4, color: '#9ca3af', fontSize: 12 }}><strong style={{ color: '#e2e8f0' }}>5.</strong> Zapisz dokument z odpowiedzią jako <code style={{ background: '#1e293b', color: '#2dd4bf', padding: '1px 5px', borderRadius: 3 }}>twojanazwa.txt</code></div>
            <div style={{ marginTop: 4, color: '#9ca3af', fontSize: 12 }}><strong style={{ color: '#e2e8f0' }}>6.</strong> Zapisany dokument następnie przeciągnij w okno <strong>Kliknij lub przeciągnij plik</strong></div>
          </div>
        </div>
      </div>}

      {importItems && (
          <div style={{ padding: '20px 24px' }}>
            <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 12 }}>
              Sprawdź dopasowania i uzupełnij dane. Zaznacz{' '}
              <strong style={{ color: '#e2e8f0' }}>Na wagę</strong> dla warzyw, owoców i mięsa, podaj wtedy cenę za kg.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {importItems.map((item, i) => {
                const upd = u => { const a = [...importItems]; a[i] = { ...a[i], ...u }; setImportItems(a); };
                const isNew = !item.matched_product;
                const sbw = !!item.sold_by_weight;
                const inputSt = { padding: '5px 8px', fontSize: 12, background: '#111827', border: '1px solid #374151', color: '#e2e8f0', borderRadius: 6 };
                return (
                  <div key={i} style={{
                    background: '#1f2937', border: '1px solid #374151', borderRadius: 10,
                    padding: '10px 14px', opacity: item.selected ? 1 : 0.5,
                    transition: 'opacity 0.15s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* Toggle ✓ */}
                      <button type="button" onClick={() => upd({ selected: !item.selected })}
                        style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 6, border: '1px solid #374151', cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                          background: item.selected ? '#1e3a3a' : 'transparent',
                          color: item.selected ? '#2dd4bf' : '#4b5563' }}>
                        ✓
                      </button>
                      {/* Nazwa z pliku */}
                      <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, flexShrink: 0 }}>{item.receipt_name}</span>
                      <span style={{ color: '#4b5563', flexShrink: 0 }}>→</span>
                      {/* Dopasowanie */}
                      <div style={{ flex: 1, minWidth: 80 }}>
                        <select
                          value={String(item.matched_product?.id || '')}
                          onChange={e => {
                            const p = productList.find(p => String(p.id) === e.target.value) || null;
                            upd({ matched_product: p, selected: item.selected || !!p });
                          }}
                          style={{ ...inputSt, width: '100%' }}
                        >
                          <option value="">➕ Utwórz nowy produkt</option>
                          {productList.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                        </select>
                      </div>
                      {/* W opak. / Na wagę */}
                      <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #374151', flexShrink: 0 }}>
                        {[['W opak.', false], ['Na wagę', true]].map(([label, val]) => (
                          <button key={label} type="button" onClick={() => upd({ sold_by_weight: val })}
                            style={{ padding: '4px 10px', border: 'none', borderRight: !val ? '1px solid #374151' : 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s',
                              background: sbw === val ? '#1e3a3a' : 'transparent',
                              color: sbw === val ? '#2dd4bf' : '#6b7280' }}>
                            {label}
                          </button>
                        ))}
                      </div>
                      {/* Pojemność + jednostka (tylko W opak.) */}
                      {!sbw && <>
                        <input type="number" step="1" min="0" max="99999" value={item.weight}
                          onChange={e => upd({ weight: Math.min(99999, parseFloat(e.target.value) || 0) })}
                          className="no-spin" style={{ ...inputSt, width: 44, flex: '0 0 44px', boxSizing: 'border-box' }} placeholder="500" />
                        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #374151', flexShrink: 0 }}>
                          {['g', 'ml', 'szt'].map((u, idx) => (
                            <button key={u} type="button" onClick={() => upd({ unit: u })}
                              style={{ padding: '4px 8px', border: 'none', borderRight: idx < 2 ? '1px solid #374151' : 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, transition: 'all 0.15s',
                                background: item.unit === u ? '#1e3a3a' : 'transparent',
                                color: item.unit === u ? '#2dd4bf' : '#6b7280' }}>
                              {u}
                            </button>
                          ))}
                        </div>
                      </>}
                      {/* Cena */}
                      <input type="number" step="0.01" min="0" max="99999" value={item.price}
                        onChange={e => upd({ price: Math.min(99999, parseFloat(e.target.value) || 0) })}
                        className="no-spin" style={{ ...inputSt, width: 50, flex: '0 0 50px', boxSizing: 'border-box' }} />
                      <span style={{ fontSize: 11, color: sbw ? '#2dd4bf' : '#6b7280', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {sbw ? 'zł / kg' : 'zł / opak.'}
                      </span>
                    </div>
                    {isNew && <div style={{ fontSize: 10, color: '#6b7280', marginTop: 5 }}>Brak przypisania — przypisz do podobnego produktu lub zostaw <span style={{ color: '#2dd4bf' }}>Utwórz nowy produkt</span>, a zostanie on dodany do listy Produkty.</div>}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" onClick={handleApplyImport}>{t('apply_changes')}</button>
              <button className="btn" style={{ background: '#374151', color: '#9ca3af' }}
                onClick={() => { setImportItems(null); }}>{t('cancel')}</button>
            </div>
          </div>
        )}
      </div>

      {/* Product list — collapsible */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px 0 20px', gap: 6 }}>
          {/* Tytuł — klik zwija/rozwija */}
          <button onClick={() => setListOpen(o => !o)}
            style={{ flex: 1, padding: '14px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600, color: '#0d9488' }}>
            {t('product_list_title')}
          </button>

          {/* Zaznacz / Odznacz */}
          <button
            onClick={() => selectionMode ? exitSelection() : (setSelectionMode(true), setEditId(null))}
            style={{ padding: '5px 11px', background: selectionMode ? '#1e3a3a' : 'transparent', border: `1px solid ${selectionMode ? '#0d9488' : '#374151'}`, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: selectionMode ? '#2dd4bf' : '#6b7280', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
          >
            {selectionMode ? 'Odznacz' : 'Zaznacz'}
          </button>

          {/* Usuń wszystkie / Usuń wybrane */}
          <button
            onClick={() => {
              if (selectionMode) {
                if (selectedIds.size > 0) handleDeleteSelected();
              } else {
                showConfirm({
                  title: 'Usuń wszystkie produkty',
                  message: `Czy na pewno chcesz usunąć wszystkie ${productList.length} produktów? Tej operacji nie można cofnąć.`,
                  confirmLabel: 'Usuń wszystkie',
                  onConfirm: async () => {
                    try { await api.deleteAll(); showSuccess('Wszystkie produkty usunięte'); loadProducts(); }
                    catch { showError('Błąd podczas usuwania produktów'); }
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

          {/* Chevron */}
          <button onClick={() => setListOpen(o => !o)}
            style={{ padding: '5px 4px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Icon icon="heroicons:chevron-down" style={{ width: 20, height: 20, transition: 'transform 0.25s', transform: listOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: '#0d9488' }} />
          </button>
        </div>
        {listOpen && <div style={{ padding: '0 20px 20px', borderTop: '1px solid #374151' }}>
        <div style={{ margin: '12px 0 10px' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj produktu..."
            style={{ width: '100%', padding: '7px 12px', border: '1px solid #374151', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
            onFocus={e => e.target.style.borderColor = '#0d9488'}
            onBlur={e => e.target.style.borderColor = '#374151'}
          />
        </div>
        <table style={{ borderCollapse: 'separate', borderSpacing: '0 3px' }}>
          <thead>
            <tr><th>{t('col_name')}</th><th>{t('col_kcal')}</th><th>{t('col_macro')}</th><th>Pojemność Opakowania</th><th>Cena (opak/kg)</th><th></th></tr>
          </thead>
          <tbody>
            {filteredProducts.slice(0, visibleCount).map(p => {
              const isEditing = editId === p.id;
              return (
                <React.Fragment key={p.id}>
                  <tr
                    className={`product-row${isEditing ? ' product-row-selected' : ''}${selectionMode && selectedIds.has(p.id) ? ' product-row-checked' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (selectionMode) { toggleSelect(p.id); return; }
                      isEditing ? setEditId(null) : startEdit(p);
                    }}
                  >
                    <td style={{ fontSize: 13 }}>
                      {selectionMode && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${selectedIds.has(p.id) ? '#6366f1' : '#374151'}`, background: selectedIds.has(p.id) ? '#6366f1' : 'transparent', marginRight: 8, flexShrink: 0, verticalAlign: 'middle', transition: 'all 0.12s' }}>
                          {selectedIds.has(p.id) && <Icon icon="heroicons:check" style={{ width: 10, height: 10, color: '#fff' }} />}
                        </span>
                      )}
                      {p.name}
                    </td>
                    <td style={{ fontSize: 13, color: p.kcal ? '#9ca3af' : '#4b5563' }}>{p.kcal != null ? `${p.kcal} kcal` : '-'}</td>
                    <td><MacroDisplay p={p} /></td>
                    <td style={{ fontSize: 13, color: '#9ca3af' }}>
                      {p.sold_by_weight ? 'Na wagę' : p.package_weight ? `${p.package_weight} ${p.unit || 'g'}` : '-'}
                    </td>
                    <td style={{ fontSize: 13, color: p.price > 0 ? '#9ca3af' : '#4b5563' }}>{displayPrice(p)}</td>
                    <td style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                      <button className="btn btn-danger" style={{ padding: '5px 12px', fontSize: 13 }} onClick={() => handleDelete(p.id, p.name)}>{t('del_btn')}</button>
                    </td>
                  </tr>
                  {isEditing && (
                    <tr className="edit-body-row">
                      {/* Nazwa */}
                      <td style={{ verticalAlign: 'top', padding: '8px 6px 8px 12px', borderLeft: '3px solid #0d9488' }}>
                        <div style={fl}>Nazwa</div>
                        <input value={editForm.name} maxLength={50}
                          onChange={e => setEditForm({ ...editForm, name: e.target.value.slice(0, 50) })}
                          style={{ width: '100%', boxSizing: 'border-box', ...s }} />
                      </td>
                      {/* Kcal */}
                      <td style={{ verticalAlign: 'top', padding: '8px 6px' }}>
                        <div style={fl}>Kcal/100g</div>
                        <input type="number" className="no-spin" step="0.1" min="0" max="9999" value={editForm.kcal}
                          onChange={e => setEditForm({ ...editForm, kcal: numClamp(e.target.value, 9999) })}
                          style={{ ...s, width: '100%', boxSizing: 'border-box' }} />
                      </td>
                      {/* Makro B/T/W */}
                      <td style={{ verticalAlign: 'top', padding: '8px 6px' }}>
                        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                          <div>
                            <div style={fl}>B</div>
                            <input type="number" className="no-spin" step="0.1" min="0" max="100" value={editForm.protein}
                              onChange={e => setEditForm({ ...editForm, protein: numClamp(e.target.value, 100) })}
                              style={{ ...s, width: 52 }} />
                          </div>
                          <div>
                            <div style={fl}>T</div>
                            <input type="number" className="no-spin" step="0.1" min="0" max="100" value={editForm.fat}
                              onChange={e => setEditForm({ ...editForm, fat: numClamp(e.target.value, 100) })}
                              style={{ ...s, width: 52 }} />
                          </div>
                          <div>
                            <div style={fl}>W</div>
                            <input type="number" className="no-spin" step="0.1" min="0" max="100" value={editForm.carbs}
                              onChange={e => setEditForm({ ...editForm, carbs: numClamp(e.target.value, 100) })}
                              style={{ ...s, width: 52 }} />
                          </div>
                        </div>
                        <button onClick={handleAutoFill} disabled={lookingUp === editId}
                          style={{ padding: '3px 7px', fontSize: 10, background: '#0d9488', color: '#1f2937', border: 'none', borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          {lookingUp === editId ? '⏳...' : 'Pobierz makra'}
                        </button>
                      </td>
                      {/* Pojemność / typ */}
                      <td style={{ verticalAlign: 'top', padding: '8px 6px' }}>
                        <div style={{ display: 'flex', borderRadius: 5, border: '1px solid #374151', overflow: 'hidden', marginBottom: 4, width: 'fit-content' }}>
                          <button type="button" onClick={() => setEditForm(f => ({ ...f, sold_by_weight: false }))}
                            style={{ padding: '4px 8px', border: 'none', borderRight: '1px solid #374151', cursor: 'pointer', fontSize: 10, fontWeight: 600,
                              background: !editForm.sold_by_weight ? '#0d9488' : '#2d3748', color: !editForm.sold_by_weight ? '#1f2937' : '#9ca3af' }}>
                            W op.
                          </button>
                          <button type="button" onClick={() => setEditForm(f => ({ ...f, sold_by_weight: true, unit: 'g', package_weight: 1000 }))}
                            style={{ padding: '4px 8px', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 600,
                              background: !!editForm.sold_by_weight ? '#0d9488' : '#2d3748', color: !!editForm.sold_by_weight ? '#1f2937' : '#9ca3af' }}>
                            Na wagę
                          </button>
                        </div>
                        {!editForm.sold_by_weight && (
                          <div style={{ display: 'flex', gap: 3 }}>
                            <input type="number" className="no-spin" min="0" max="99999" value={editForm.package_weight}
                              onChange={e => setEditForm({ ...editForm, package_weight: numClamp(e.target.value) })}
                              style={{ ...s, width: 60 }} placeholder="500" />
                            <UnitSelect value={editForm.unit} onChange={e => setEditForm({ ...editForm, unit: e.target.value })} style={{ ...s, width: 40, padding: '3px 2px' }} />
                          </div>
                        )}
                      </td>
                      {/* Cena */}
                      <td style={{ verticalAlign: 'top', padding: '8px 6px' }}>
                        <div style={fl}>{editForm.sold_by_weight ? 'Cena/kg' : 'Cena/op.'}</div>
                        <input type="number" className="no-spin" step="0.01" min="0" max="9999" value={editForm.package_price}
                          onChange={e => setEditForm({ ...editForm, package_price: numClamp(e.target.value, 9999) })}
                          style={{ ...s, width: '100%', boxSizing: 'border-box' }} />
                      </td>
                      {/* Zapisz / Anuluj */}
                      <td style={{ verticalAlign: 'middle', padding: '8px 6px', borderBottom: '1px solid #0d948860' }}>
                        <div style={{ display: 'flex', gap: 6, flexDirection: 'column' }}>
                          <button className="btn btn-primary" style={{ padding: '5px 10px', fontSize: 12 }} onClick={handleSaveEdit}>{t('save_btn')}</button>
                          <button className="btn" style={{ padding: '5px 10px', fontSize: 12, background: '#374151', color: '#9ca3af' }} onClick={() => setEditId(null)}>{t('cancel')}</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {productList.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#6b7280' }}>{t('no_products')}</td></tr>
            )}
            {filteredProducts.length === 0 && search.trim() && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#6b7280', fontStyle: 'italic' }}>Nie znaleziono produktu „{search}"</td></tr>
            )}
            {visibleCount < filteredProducts.length && (
              <tr ref={sentinelRef}>
                <td colSpan={6} style={{ textAlign: 'center', color: '#4b5563', padding: '10px 0', fontSize: 12 }}>
                  Pokazano {visibleCount} z {filteredProducts.length} produktów…
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>}
      </div>
    </div>
  );
}
