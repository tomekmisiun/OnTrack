import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { products as api, importPrices } from '../api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { fuzzySearch } from '../utils/search';
import { fetchProductMacros } from '../utils/macroLookup';
import './Products.css';

const toUnitPrice = (packagePrice, packageWeight, unit) => {
  const pkg = parseFloat(packageWeight) || 1;
  const price = parseFloat(packagePrice) || 0;
  return unit === 'szt' ? price / pkg : (price / pkg) * 100;
};

const toPackagePrice = (unitPrice, packageWeight, unit) => {
  const pkg = parseFloat(packageWeight) || 1;
  return unit === 'szt' ? unitPrice * pkg : unitPrice * pkg / 100;
};

const displayPrice = (p, currency) => {
  if (!p.price) return '-';
  if (p.sold_by_weight) return `${toPackagePrice(p.price, 1000, 'g').toFixed(2)} ${currency}/kg`;
  return `${toPackagePrice(p.price, p.package_weight, p.unit || 'g').toFixed(2)} ${currency}`;
};

const EMPTY_FORM = { name: '', package_weight: '', package_price: '', unit: 'g', sold_by_weight: false };

function ImportHelpContent({ t, lang, remainingImports, promptCopied, onCopyPrompt }) {
  return (
    <>
      <div className="products-help-options">
        <div>
          <div className="products-help-option-title">{t('opt1_title')}</div>
          <ol className="products-help-steps">
            <li>{t('opt1_s1')}</li>
            <li>
              {t('opt1_s2_pre')}{' '}
              <span className="products-help-badge">{t('apply_ai_label')}</span>
              {' '}-{' '}
              <a href="https://gemini.google.com/app" target="_blank" rel="noreferrer">Gemini</a>
              {' '}{t('opt1_s2_suf')}
            </li>
            <li>
              {t('opt1_s3_pre')}{' '}
              <span className="products-help-badge">{t('apply_changes_label')}</span>
            </li>
          </ol>
          <div className="products-help-limit">
            {t('ai_daily_lim')}{remainingImports !== null && <span>{t('ai_rem')(remainingImports)}</span>}
          </div>
          <div className="products-help-note">{t('lost_receipt_hint')}</div>
        </div>
        <div>
          <div className="products-help-option-title">{t('opt2_title')}</div>
          <ol className="products-help-steps">
            <li>
              {t('opt2_required_fmt')}{' '}
              <code>{t('csv_format_full')}</code>
              <br />
              {t('opt2_or')}{' '}
              <code>{t('csv_format_short')}</code>
              {' '}<span style={{ color: '#6b7280', fontSize: 11 }}>({t('opt2_manually')})</span>
            </li>
            <li>
              {t('opt2_upload_pre')}{' '}
              <span className="products-help-badge">{t('apply_file_label')}</span>
            </li>
          </ol>
          <div className="products-help-free">{t('no_lim')}</div>
        </div>
      </div>
      <div className="products-prompt-box">
        <div className="products-prompt-intro">{t('quick_update_hint')}</div>
        <div className="products-prompt-intro">
          <strong>1.</strong> {t('go_to_ai_pre')}{' '}
          <a href="https://claude.ai/" target="_blank" rel="noreferrer">Claude</a>
          {' / '}
          <a href="https://gemini.google.com/app" target="_blank" rel="noreferrer">Gemini</a>
          {' / '}
          <a href="https://chatgpt.com/" target="_blank" rel="noreferrer">ChatGPT</a>
          {' '}{t('go_to_ai_suf')}
        </div>
        <div className="products-prompt-scroll">
          <pre className="products-prompt-pre">{t('products_prompt')}</pre>
          <button
            type="button"
            className={`products-prompt-copy${promptCopied ? ' products-prompt-copy--done' : ''}`}
            onClick={onCopyPrompt}
          >
            {promptCopied ? t('btn_copied') : t('copy_prompt_btn')}
          </button>
        </div>
        <div className="products-prompt-step"><strong>2.</strong> {t('paste_products_step')}</div>
        <div className="products-prompt-step"><strong>3.</strong> {t('create_doc_step')}</div>
        <div className="products-prompt-step"><strong>4.</strong> {t('copy_response_step')}</div>
        <div className="products-prompt-step"><strong>5.</strong> {t('save_doc_step_pre')} <code>{lang === 'en' ? 'yourname.txt' : 'twojanazwa.txt'}</code></div>
        <div className="products-prompt-step"><strong>6.</strong> {t('drag_doc_step')} <strong>{t('click_drag_file')}</strong></div>
      </div>
    </>
  );
}

function ImportHelpModal({ open, onClose, t, lang, remainingImports, promptCopied, onCopyPrompt }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="products-import-modal-backdrop" onClick={onClose}>
      <div className="products-import-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="import-help-title">
        <div className="products-import-modal-header">
          <h2 id="import-help-title" className="products-import-modal-title">{t('import_how_to')}</h2>
          <button type="button" className="products-import-modal-close" onClick={onClose} aria-label={t('cancel')}>×</button>
        </div>
        <div className="products-import-modal-body dark-scroll">
          <ImportHelpContent
            t={t}
            lang={lang}
            remainingImports={remainingImports}
            promptCopied={promptCopied}
            onCopyPrompt={onCopyPrompt}
          />
        </div>
      </div>
    </div>
  );
}

const MacroDisplay = ({ p }) => {
  const { t } = useLanguage();
  if (!p.protein && !p.fat && !p.carbs) return <span style={{ color: '#4b5563' }}>-</span>;
  return (
    <div style={{ fontSize: 13, color: '#9ca3af' }}>
      {p.protein != null && <span style={{ marginRight: 6 }}>{t('macro_p')}: {p.protein}g</span>}
      {p.fat     != null && <span style={{ marginRight: 6 }}>{t('macro_f')}: {p.fat}g</span>}
      {p.carbs   != null && <span>{t('macro_c')}: {p.carbs}g</span>}
    </div>
  );
};

export default function Products() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
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
  const [importHelpModalOpen, setImportHelpModalOpen] = useState(false);
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
      title: t('del_sel_products_title'),
      message: t('confirm_del_selected_products')(selectedIds.size),
      confirmLabel: t('btn_delete'),
      onConfirm: async () => {
        try {
          await Promise.all([...selectedIds].map(id => api.delete(id)));
          showSuccess(t('products_deleted')(selectedIds.size));
          exitSelection();
          loadProducts();
        } catch { showError(t('del_during_err')); }
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

  useEffect(() => { loadProducts(); }, [user?.lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredProducts = useMemo(() => {
    const q = search.trim();
    return q ? productList.filter(p => fuzzySearch(q, p.name)) : productList;
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
      const productName = form.name;
      showSuccess(t('product_adding')(productName));
      const { macros } = await fetchProductMacros(productName, lang);
      if (macros) {
        await api.update(created.data.id, macros);
        showSuccess(t('product_added_macro')(productName, true));
      } else {
        showError(t('err_macro_not_found')(productName));
      }
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
      setEditId(null); showSuccess(t('save_changes_label')); loadProducts();
    } catch (e) { showError(e.response?.data?.error || t('save_btn')); }
  };

  const handleAutoFill = async () => {
    if (!editForm.name) return;
    setLookingUp(editId);
    try {
      const { macros } = await fetchProductMacros(editForm.name, lang);
      if (macros) {
        setEditForm(f => ({
          ...f,
          kcal: macros.kcal,
          protein: macros.protein,
          fat: macros.fat,
          carbs: macros.carbs,
        }));
      } else {
        showError(t('err_macro_not_found')(editForm.name));
      }
    } catch {
      showError(t('err_macro_lookup'));
    } finally {
      setLookingUp(null);
    }
  };

  const handleDelete = (id, name) => {
    showConfirm({
      title: t('confirm_del_product'),
      message: t('delete_confirm_product')(name),
      confirmLabel: t('btn_delete'),
      onConfirm: async () => {
        try { await api.delete(id); showSuccess(t('product_deleted')); loadProducts(); }
        catch { showError(t('del_btn')); }
      },
    });
  };

  const applyMacros = async (productId, productName) => {
    const { macros } = await fetchProductMacros(productName, lang);
    if (macros) await api.update(productId, macros);
    return macros;
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
    if (invalid.length) { showError(t('valid_price_err')); return; }
    const overPrice = selected.filter(i => parseFloat(i.price) > 99999);
    if (overPrice.length) { showError(t('price_max_err')); return; }
    const overWeight = selected.filter(i => parseFloat(i.weight) > 99999);
    if (overWeight.length) { showError(t('weight_max_err')); return; }
    const longName = selected.filter(i => (i.receipt_name || '').trim().length > 200);
    if (longName.length) { showError(t('name_max_err')); return; }
    const emptyName = selected.filter(i => !i.matched_product && !(i.receipt_name || '').trim());
    if (emptyName.length) { showError(t('fill_name_err')); return; }

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
        await applyMacros(created.data.id, item.receipt_name.trim());
      }

      setImportItems(null);
      globalToast(t('fetching_macro'), '#eab308', 999999);
      for (const item of toUpdate) {
        await applyMacros(item.matched_product.id, item.matched_product.name);
      }

      const msg = [
        toUpdate.length && t('import_updated_n')(toUpdate.length),
        toCreate.length && t('import_added_n')(toCreate.length),
      ].filter(Boolean).join(', ') + (toUpdate.length || toCreate.length ? ` ${t('import_done_suffix')}` : '');
      showSuccess(msg);
      loadProducts();
    } catch { showError(t('save_products_err'));  }
  };


  const s = { padding: '5px 8px', fontSize: 13 };
  const fl = { fontSize: 10, color: '#6b7280', marginBottom: 3 };
  const sec = { fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, marginTop: 4 };

  const displayUnit = u => u === 'szt' ? t('unit_pcs') : u;

  const UnitSelect = ({ value, onChange, style }) => (
    <select value={value} onChange={onChange} style={style}>
      <option value="g">g</option>
      <option value="ml">ml</option>
      <option value="szt">{t('unit_pcs')}</option>
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
      const allPrices = [...text.matchAll(/(\d+[,.]?\d*)\s*zł(?!\/|\s*\/)/gi)];
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
      const wm = text.match(/(\d+(?:[,.]?\d+)?)\s*(kg|g|ml|l)\b/i);
      if (wm) { const r = toG(wm[1], wm[2].toLowerCase()); weight = String(r.w); unit = r.unit; }
      // Cena z "zł" lub "£" lub samotna liczba na końcu (po wadze)
      const mZl = text.match(/(\d+[,.]?\d*)\s*(zł|£|GBP)(?!\/)/i);
      if (mZl) {
        price = String(num(mZl[1]).toFixed(2));
      } else {
        // Ostatnia samotna liczba w linii = cena (jeśli waga już znaleziona)
        const mBare = text.replace(/(\d+(?:[,.]?\d+)?)\s*(kg|g|ml|l)\b/i, '').match(/(\d+[,.]?\d*)(?:\s*)$/);
        if (mBare && weight) price = String(num(mBare[1]).toFixed(2));
      }
    }
    const name = stripWeight((lines[0] || '').replace(/na\s+wagę/gi, '').replace(/kiść/gi, ''));
    return { name, package_price: price, package_weight: weight, unit, sold_by_weight: isByWeight };
  };

  const shopLinks = lang === 'en' ? [
    { domain: 'www.tesco.com', url: 'https://www.tesco.com/', label: 'Tesco' },
    { domain: 'www.aldi.co.uk', url: 'https://www.aldi.co.uk/', label: 'Aldi' },
    { domain: 'groceries.asda.com', url: 'https://groceries.asda.com/', label: 'Asda' },
  ] : [
    { domain: 'zakupy.auchan.pl', url: 'https://zakupy.auchan.pl/', label: 'Auchan' },
    { domain: 'zakupy.biedronka.pl', url: 'https://zakupy.biedronka.pl/', label: 'Biedronka' },
    { domain: 'carrefour.pl', url: 'https://www.carrefour.pl/', label: 'Carrefour' },
  ];

  return (
    <div className="products-page">
      <div className="card products-add-card">
        <h2>{t('add_product_title')}</h2>

        <div className="products-add-layout">
          <section className="products-inspire-band">
            <div className="products-section-label">
              <Icon icon="heroicons:building-storefront" width={15} />
              {t('search_products_hint')}
            </div>
            <div className="products-inspire-grid">
              {shopLinks.map(({ domain, url, label }) => (
                <a key={label} href={url} target="_blank" rel="noreferrer" className="products-inspire-link">
                  <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" />
                  <span>{label}</span>
                </a>
              ))}
            </div>
          </section>

          <div className="products-add-columns">
            <div className="products-editor">
              <div className="products-editor-head">
                <Icon icon="heroicons:clipboard-document" width={18} />
                {t('product_paste_title')}
              </div>
              <div className="products-textarea-wrap">
                <textarea
                  className="products-textarea"
                  value={pasteText}
                  maxLength={500}
                  onChange={e => {
                    const txt = e.target.value.slice(0, 500);
                    setPasteText(txt);
                    const parsed = parseProductText(txt);
                    if (parsed) setForm(f => ({ ...f, ...parsed }));
                    else if (!txt.trim()) setForm(EMPTY_FORM);
                  }}
                  placeholder={t('product_paste_ph')}
                />
              </div>
            </div>

            <div className="products-form-panel">
              <div className="products-form-head">
                <Icon icon="heroicons:check-badge" width={18} />
                {t('check_data_label')}
              </div>
              <div className="products-form-field">
                <label className="products-form-label">{t('product_name_lbl')}</label>
                <input value={form.name} maxLength={50} onChange={e => setForm({ ...form, name: e.target.value.slice(0, 50) })} />
              </div>
              <div className="products-price-row">
                <div className="products-form-field">
                  <label className="products-form-label">{t('price_per_kg_lbl')}</label>
                  <input type="number" className="no-spin" step="0.01" min="0" max="9999" value={form.package_price}
                    onChange={e => setForm({ ...form, package_price: numClamp(e.target.value, 9999) })}
                    placeholder={t('price_ph')} />
                </div>
                <div className="products-toggle-group">
                  <button type="button" className={!form.sold_by_weight ? 'active' : ''} onClick={() => setForm(f => ({ ...f, sold_by_weight: false }))}>
                    {t('pkg_btn')}
                  </button>
                  <button type="button" className={form.sold_by_weight ? 'active' : ''} onClick={() => setForm(f => ({ ...f, sold_by_weight: true, unit: 'g', package_weight: '' }))}>
                    {t('weight_btn')}
                  </button>
                </div>
              </div>
              {!form.sold_by_weight && (
                <div className="products-form-field">
                  <label className="products-form-label">{t('pkg_capacity_lbl')}</label>
                  <div className="products-unit-row">
                    <input type="number" className="no-spin" min="0" max="99999" value={form.package_weight}
                      onChange={e => setForm({ ...form, package_weight: numClamp(e.target.value) })}
                      placeholder={t('pkg_ph')} />
                    <div className="products-unit-btns">
                      {['g', 'kg', 'ml', 'l', 'szt'].map(u => (
                        <button key={u} type="button" className={form.unit === u ? 'active' : ''} onClick={() => setForm(f => ({ ...f, unit: u }))}>
                          {displayUnit(u)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="products-form-actions">
                <button type="button" className="btn btn-primary" onClick={handleSubmit}>{t('save_btn')}</button>
                <button type="button" className="btn" style={{ background: '#374151', color: '#9ca3af' }} onClick={() => { setPasteText(''); setForm(EMPTY_FORM); }}>
                  {t('cancel')}
                </button>
              </div>
            </div>
          </div>

          {importItems ? (
            <section className="products-import-review">
              <h2 className="card-section-title" style={{ marginBottom: 12 }}>{t('import_review_title')}</h2>
              <p className="products-import-review-hint">
                {t('import_review_hint_pre')}{' '}
                <strong>{t('weight_btn')}</strong>{' '}
                {t('import_review_hint_suf')}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => upd({ selected: !item.selected })}
                          style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 6, border: '1px solid #374151', cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                            background: item.selected ? '#1e3a3a' : 'transparent',
                            color: item.selected ? '#2dd4bf' : '#4b5563' }}>
                          ✓
                        </button>
                        <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, flexShrink: 0 }}>{item.receipt_name}</span>
                        <span style={{ color: '#4b5563', flexShrink: 0 }}>→</span>
                        <div style={{ flex: 1, minWidth: 80 }}>
                          <select
                            value={String(item.matched_product?.id || '')}
                            onChange={e => {
                              const p = productList.find(p => String(p.id) === e.target.value) || null;
                              upd({ matched_product: p, selected: item.selected || !!p });
                            }}
                            style={{ ...inputSt, width: '100%' }}
                          >
                            <option value="">{t('create_new_product_opt')}</option>
                            {productList.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                          </select>
                        </div>
                        <div className="products-toggle-group">
                          {[[t('pkg_btn'), false], [t('weight_btn'), true]].map(([label, val]) => (
                            <button key={label} type="button" className={sbw === val ? 'active' : ''} onClick={() => upd({ sold_by_weight: val })}>
                              {label}
                            </button>
                          ))}
                        </div>
                        {!sbw && <>
                          <input type="number" step="1" min="0" max="99999" value={item.weight}
                            onChange={e => upd({ weight: Math.min(99999, parseFloat(e.target.value) || 0) })}
                            className="no-spin" style={{ ...inputSt, width: 44, flex: '0 0 44px', boxSizing: 'border-box' }} placeholder="500" />
                          <div className="products-toggle-group">
                            {['g', 'ml', 'szt'].map((u) => (
                              <button key={u} type="button" className={item.unit === u ? 'active' : ''} onClick={() => upd({ unit: u })}>
                                {displayUnit(u)}
                              </button>
                            ))}
                          </div>
                        </>}
                        <input type="number" step="0.01" min="0" max="99999" value={item.price}
                          onChange={e => upd({ price: Math.min(99999, parseFloat(e.target.value) || 0) })}
                          className="no-spin" style={{ ...inputSt, width: 50, flex: '0 0 50px', boxSizing: 'border-box' }} />
                        <span style={{ fontSize: 11, color: sbw ? '#2dd4bf' : '#6b7280', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {sbw ? `${t('currency')} / kg` : `${t('currency')} ${t('price_per_pkg_suffix')}`}
                        </span>
                      </div>
                      {isNew && (
                        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 5 }}>
                          {t('no_assignment_hint')}{' '}
                          <span style={{ color: '#2dd4bf' }}>{t('create_new_product_label')}</span>
                          {t('import_new_product_hint_suf')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-primary" onClick={handleApplyImport}>{t('apply_changes')}</button>
                <button type="button" className="btn" style={{ background: '#374151', color: '#9ca3af' }} onClick={() => setImportItems(null)}>{t('cancel')}</button>
              </div>
            </section>
          ) : (
            <div className="products-bottom-sections">
              <section className="products-import-section">
                <div className="products-import-title-row">
                  <span className="card-section-title">{t('import_title')}</span>
                  <button
                    type="button"
                    className="pill-help-btn"
                    onClick={() => setImportHelpModalOpen(true)}
                    aria-label={t('import_how_to')}
                    title={t('import_how_to')}
                  >
                    <Icon icon="heroicons:light-bulb" width={15} />
                    <span>{t('import_help_btn')}</span>
                  </button>
                </div>
                <div
                  className={`products-dropzone${dragOver ? ' products-dropzone--drag' : ''}${selectedFile ? ' products-dropzone--selected' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0]); }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.txt,.csv" style={{ display: 'none' }} onChange={e => handleFileSelect(e.target.files[0])} />
                  {selectedFile ? (
                    <>
                      <div className={`products-dropzone-title${selectedFile ? ' products-dropzone-title--selected' : ''}`}>
                        {isImageFile(selectedFile) ? t('opt1_short') + ' ' : t('opt2_short') + ' '}{selectedFile.name}
                      </div>
                      <div className="products-dropzone-hint">{t('click_change')}</div>
                    </>
                  ) : (
                    <>
                      <div className="products-dropzone-icon">📂</div>
                      <div className="products-dropzone-title">{t('click_drag_file')}</div>
                      <div className="products-dropzone-hint">{t('file_types_hint')}</div>
                    </>
                  )}
                </div>
                {selectedFile && (
                  <div className="products-import-actions">
                    {isImageFile(selectedFile) && (
                      <button type="button" className="btn btn-primary" onClick={handleParseAI} disabled={importing}>
                        {importing ? t('analyzing') : t('apply_ai_btn')}
                      </button>
                    )}
                    {isTextFile(selectedFile) && (
                      <button type="button" className="btn btn-primary" onClick={handleParseFree} disabled={importing}>
                        {importing ? t('processing') : t('apply_file_btn')}
                      </button>
                    )}
                    <button type="button" className="btn" style={{ background: '#374151', color: '#9ca3af' }} onClick={() => setSelectedFile(null)}>
                      {t('cancel')}
                    </button>
                  </div>
                )}
              </section>

              <div className="products-macro-callout">
                <div className="products-macro-callout-title">{t('macro_auto_title')}</div>
                {t('macro_auto_desc')}
                <div className="products-macro-callout-hint">{t('macro_edit_hint')}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Product list — collapsible */}
      <div className="card products-list-card">
        <div className="products-list-header">
          <button type="button" className="list-section-toggle" onClick={() => setListOpen(o => !o)}>
            <span className="card-section-title">{t('product_list_title')}</span>
          </button>

          {/* Zaznacz / Odznacz */}
          <button
            onClick={() => selectionMode ? exitSelection() : (setSelectionMode(true), setEditId(null))}
            style={{ padding: '5px 11px', background: selectionMode ? '#1e3a3a' : 'transparent', border: `1px solid ${selectionMode ? '#0d9488' : '#374151'}`, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: selectionMode ? '#2dd4bf' : '#6b7280', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
          >
            {selectionMode ? t('deselect_label') : t('select_label')}
          </button>

          {/* Usuń wszystkie / Usuń wybrane */}
          <button
            onClick={() => {
              if (selectionMode) {
                if (selectedIds.size > 0) handleDeleteSelected();
              } else {
                showConfirm({
                  title: t('del_all_products_title'),
                  message: t('confirm_del_all_products')(productList.length),
                  confirmLabel: t('del_all_products'),
                  onConfirm: async () => {
                    try { await api.deleteAll(); showSuccess(t('all_products_deleted')); loadProducts(); }
                    catch { showError(t('del_during_err')); }
                  },
                });
              }
            }}
            disabled={selectionMode && selectedIds.size === 0}
            style={{ padding: '5px 11px', background: 'transparent', border: '1px solid #374151', borderRadius: 6, cursor: selectionMode && selectedIds.size === 0 ? 'default' : 'pointer', fontSize: 12, color: selectionMode && selectedIds.size === 0 ? '#374151' : '#6b7280', transition: 'all 0.15s', whiteSpace: 'nowrap', opacity: selectionMode && selectedIds.size === 0 ? 0.4 : 1 }}
            onMouseEnter={e => { if (!(selectionMode && selectedIds.size === 0)) { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#374151'; e.currentTarget.style.color = selectionMode && selectedIds.size === 0 ? '#374151' : '#6b7280'; }}
          >
            {selectionMode && selectedIds.size > 0 ? t('del_selected_products')(selectedIds.size) : t('del_all_products')}
          </button>

          {/* Chevron */}
          <button onClick={() => setListOpen(o => !o)}
            style={{ padding: '5px 4px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Icon icon="heroicons:chevron-down" style={{ width: 20, height: 20, transition: 'transform 0.25s', transform: listOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: '#0d9488' }} />
          </button>
        </div>
        {listOpen && <div className="products-list-body">
        <div className="products-list-search">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('search_product_ph')}
          />
        </div>
        <table style={{ borderCollapse: 'separate', borderSpacing: '0 3px' }}>
          <thead>
            <tr><th>{t('col_name')}</th><th>{t('col_kcal')}</th><th>{t('col_macro')}</th><th>{t('col_pkg_capacity')}</th><th>{t('col_price_opak_kg')}</th><th></th></tr>
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
                      {p.sold_by_weight ? t('weight_btn') : p.package_weight ? `${p.package_weight} ${p.unit || 'g'}` : '-'}
                    </td>
                    <td style={{ fontSize: 13, color: p.price > 0 ? '#9ca3af' : '#4b5563' }}>{displayPrice(p, t('currency'))}</td>
                    <td style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                      <button className="btn btn-danger" style={{ padding: '5px 12px', fontSize: 13 }} onClick={() => handleDelete(p.id, p.name)}>{t('del_btn')}</button>
                    </td>
                  </tr>
                  {isEditing && (
                    <tr className="edit-body-row">
                      {/* Nazwa */}
                      <td style={{ verticalAlign: 'top', padding: '8px 6px 8px 12px', borderLeft: '3px solid #0d9488' }}>
                        <div style={fl}>{t('col_name')}</div>
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
                            <div style={fl}>{t('macro_p')}</div>
                            <input type="number" className="no-spin" step="0.1" min="0" max="100" value={editForm.protein}
                              onChange={e => setEditForm({ ...editForm, protein: numClamp(e.target.value, 100) })}
                              style={{ ...s, width: 52 }} />
                          </div>
                          <div>
                            <div style={fl}>{t('macro_f')}</div>
                            <input type="number" className="no-spin" step="0.1" min="0" max="100" value={editForm.fat}
                              onChange={e => setEditForm({ ...editForm, fat: numClamp(e.target.value, 100) })}
                              style={{ ...s, width: 52 }} />
                          </div>
                          <div>
                            <div style={fl}>{t('macro_c')}</div>
                            <input type="number" className="no-spin" step="0.1" min="0" max="100" value={editForm.carbs}
                              onChange={e => setEditForm({ ...editForm, carbs: numClamp(e.target.value, 100) })}
                              style={{ ...s, width: 52 }} />
                          </div>
                        </div>
                        <button onClick={handleAutoFill} disabled={lookingUp === editId}
                          style={{ padding: '3px 7px', fontSize: 10, background: '#0d9488', color: '#1f2937', border: 'none', borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          {lookingUp === editId ? '⏳...' : t('fetch_macro_btn')}
                        </button>
                      </td>
                      {/* Pojemność / typ */}
                      <td style={{ verticalAlign: 'top', padding: '8px 6px' }}>
                        <div style={{ display: 'flex', borderRadius: 5, border: '1px solid #374151', overflow: 'hidden', marginBottom: 4, width: 'fit-content' }}>
                          <button type="button" onClick={() => setEditForm(f => ({ ...f, sold_by_weight: false }))}
                            style={{ padding: '4px 8px', border: 'none', borderRight: '1px solid #374151', cursor: 'pointer', fontSize: 10, fontWeight: 600,
                              background: !editForm.sold_by_weight ? '#0d9488' : '#2d3748', color: !editForm.sold_by_weight ? '#1f2937' : '#9ca3af' }}>
                            {t('pkg_op_btn')}
                          </button>
                          <button type="button" onClick={() => setEditForm(f => ({ ...f, sold_by_weight: true, unit: 'g', package_weight: 1000 }))}
                            style={{ padding: '4px 8px', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 600,
                              background: !!editForm.sold_by_weight ? '#0d9488' : '#2d3748', color: !!editForm.sold_by_weight ? '#1f2937' : '#9ca3af' }}>
                            {t('weight_btn')}
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
                        <div style={fl}>{editForm.sold_by_weight ? t('price_per_kg_lbl') : t('price_per_opak_lbl')}</div>
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
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#6b7280', fontStyle: 'italic' }}>{t('product_not_found')(search)}</td></tr>
            )}
            {visibleCount < filteredProducts.length && (
              <tr ref={sentinelRef}>
                <td colSpan={6} style={{ textAlign: 'center', color: '#4b5563', padding: '10px 0', fontSize: 12 }}>
                  {t('shown_products')(visibleCount, filteredProducts.length)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>}
      </div>

      <ImportHelpModal
        open={importHelpModalOpen}
        onClose={() => setImportHelpModalOpen(false)}
        t={t}
        lang={lang}
        remainingImports={remainingImports}
        promptCopied={promptCopied}
        onCopyPrompt={() => {
          navigator.clipboard.writeText(t('products_prompt'));
          setPromptCopied(true);
          setTimeout(() => setPromptCopied(false), 2000);
        }}
      />
    </div>
  );
}
