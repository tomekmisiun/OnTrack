import React, { useState, useEffect, useRef } from 'react';
import { products as api, importPrices } from '../api';
import { useLanguage } from '../contexts/LanguageContext';

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
  if (!p.kcal && !p.protein && !p.fat && !p.carbs) return <span style={{ color: '#ccc' }}>-</span>;
  return (
    <div style={{ fontSize: 11, lineHeight: 1.6 }}>
      {p.kcal    != null && <span style={{ marginRight: 6 }}><b>{p.kcal}</b> kcal</span>}
      {p.protein != null && <span style={{ marginRight: 6 }}>B: <b>{p.protein}g</b></span>}
      {p.fat     != null && <span style={{ marginRight: 6 }}>T: <b>{p.fat}g</b></span>}
      {p.carbs   != null && <span>W: <b>{p.carbs}g</b></span>}
    </div>
  );
};

export default function Products() {
  const { t } = useLanguage();
  const [productList, setProductList] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [error, setError] = useState('');
  const [lookingUp, setLookingUp] = useState(null);
  const [importItems, setImportItems] = useState(null);
  const [importing, setImporting] = useState(false);
  const [remainingImports, setRemainingImports] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [listOpen, setListOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef();

  const showToast = (msg, color = '#22c55e', ms = 4000) => {
    setToast({ msg, color });
    if (ms) setTimeout(() => setToast(null), ms);
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

  const loadProducts = async () => {
    try { setProductList((await api.getAll()).data); }
    catch { setError(t('err_load_products')); }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.package_price) { setError(t('err_fill_fields')); return; }
    if (!form.sold_by_weight && !form.package_weight) { setError(t('err_fill_fields')); return; }
    const sbw = !!form.sold_by_weight;
    const pkgW = sbw ? 1000 : parseFloat(form.package_weight);
    const unit = sbw ? 'g' : form.unit;
    try {
      const created = await api.create({
        name: form.name,
        package_weight: pkgW,
        price: toUnitPrice(form.package_price, pkgW, unit),
        unit,
        sold_by_weight: sbw,
      });
      setForm(EMPTY_FORM); setError('');
      const macro = await fetchMacroFromOFF(form.name);
      if (macro) await api.update(created.data.id, macro);
      loadProducts();
    } catch (e) { setError(e.response?.data?.error || t('err_fill_fields')); }
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
    const pkgW = sbw ? 1000 : parseFloat(editForm.package_weight);
    const unit = sbw ? 'g' : editForm.unit;
    try {
      await api.update(editId, {
        name: editForm.name,
        package_weight: pkgW,
        price: toUnitPrice(editForm.package_price, pkgW, unit),
        unit,
        sold_by_weight: sbw,
        kcal:    editForm.kcal    !== '' ? parseFloat(editForm.kcal)    : null,
        protein: editForm.protein !== '' ? parseFloat(editForm.protein) : null,
        fat:     editForm.fat     !== '' ? parseFloat(editForm.fat)     : null,
        carbs:   editForm.carbs   !== '' ? parseFloat(editForm.carbs)   : null,
      });
      setEditId(null); loadProducts();
    } catch (e) { setError(e.response?.data?.error || t('save_btn')); }
  };

  const handleAutoFill = async () => {
    if (!editForm.name) return;
    setLookingUp(editId); setError('');
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
      if (!found) setError(t('err_not_found_off')(editForm.name));
    } catch { setError(t('err_off')); }
    finally { setLookingUp(null); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('confirm_del_product'))) return;
    try { await api.delete(id); loadProducts(); }
    catch { setError(t('del_btn')); }
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

  const handleFileSelect = (file) => { if (!file) return; setSelectedFile(file); setError(''); };

  const handleParseAI = async () => {
    if (!selectedFile) return;
    setImporting(true); setError('');
    try {
      const res = await importPrices.parse(selectedFile);
      setRemainingImports(res.data.remaining_today);
      setImportItems(res.data.items.map(mapImportItem));
    } catch (e) { setError(e.response?.data?.error || t('analyzing')); }
    finally { setImporting(false); }
  };

  const handleParseFree = async () => {
    if (!selectedFile) return;
    setImporting(true); setError('');
    try {
      const res = await importPrices.parseFree(selectedFile);
      setImportItems(res.data.items.map(mapImportItem));
    } catch (e) { setError(e.response?.data?.error || t('processing')); }
    finally { setImporting(false); }
  };

  const handleApplyImport = async () => {
    const selected = importItems.filter(i => i.selected && i.price !== '' && i.price !== null);
    if (!selected.length) { setError(t('at_least_one')); return; }
    const invalid = selected.filter(i => isNaN(parseFloat(i.price)) || parseFloat(i.price) < 0);
    if (invalid.length) { setError('Wprowadź prawidłową cenę dla zaznaczonych produktów'); return; }

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
      setToast({ msg: t('fetching_macro'), color: '#d97706' });
      for (const item of toUpdate) {
        const macro = await fetchMacroFromOFF(item.matched_product.name);
        if (macro) await api.update(item.matched_product.id, macro);
      }

      const msg = [
        toUpdate.length && `Zaktualizowano ${toUpdate.length}`,
        toCreate.length && `Dodano ${toCreate.length}`,
      ].filter(Boolean).join(', ') + ' produktów · Makro zaktualizowane';
      showToast(msg);
      loadProducts();
    } catch { setError('Błąd przy zapisywaniu produktów'); setToast(null); }
  };


  const s = { padding: '5px 8px', fontSize: 13 };
  const fl = { fontSize: 10, color: '#888', marginBottom: 3 };
  const sec = { fontSize: 11, fontWeight: 700, color: '#667eea', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, marginTop: 4 };

  const UnitSelect = ({ value, onChange, style }) => (
    <select value={value} onChange={onChange} style={style}>
      <option value="g">g</option>
      <option value="ml">ml</option>
      <option value="szt">szt</option>
    </select>
  );

  return (
    <div>
      <div className="card">
        <h2>{t('add_product_title')}</h2>
        {error && <p style={{ color: 'red', marginBottom: 12 }}>{error}</p>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            {/* Rodzaj produktu */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              <label style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px',
                borderRadius: 6, cursor: 'pointer',
                background: !form.sold_by_weight ? '#e8ecff' : 'transparent',
                border: !form.sold_by_weight ? '1px solid #c0caff' : '1px solid #e8e8e8',
              }}>
                <input type="radio" name="add-pkg-type" checked={!form.sold_by_weight}
                  onChange={() => setForm(f => ({ ...f, sold_by_weight: false }))} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#444' }}>W opakowaniu</div>
                </div>
              </label>
              <label style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px',
                borderRadius: 6, cursor: 'pointer',
                background: !!form.sold_by_weight ? '#e8ecff' : 'transparent',
                border: !!form.sold_by_weight ? '1px solid #c0caff' : '1px solid #e8e8e8',
              }}>
                <input type="radio" name="add-pkg-type" checked={!!form.sold_by_weight}
                  onChange={() => setForm(f => ({ ...f, sold_by_weight: true, unit: 'g', package_weight: '' }))} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#667eea' }}>Na wagę</div>
                  <div style={{ fontSize: 10, color: '#999' }}>warzywa, mięso, owoce</div>
                </div>
              </label>
            </div>

            <div style={sec}>{t('basic_info')}</div>
            <div style={{ marginBottom: 12 }}>
              <div style={fl}>{t('product_name_lbl')}</div>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder={t('product_name_ph')} style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>

            {!form.sold_by_weight && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={fl}>{t('pkg_qty_lbl')}</div>
                  <input type="number" value={form.package_weight} onChange={e => setForm({ ...form, package_weight: e.target.value })}
                    placeholder="np. 1000" style={{ width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={fl}>{t('unit_lbl')}</div>
                  <UnitSelect value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} style={{ width: 76 }} />
                </div>
              </div>
            )}

            <div style={sec}>{t('price_section')}</div>
            <div style={{ marginBottom: 12 }}>
              <div style={fl}>Cena za opakowanie / kg (zł)</div>
              <input type="number" step="0.01" value={form.package_price} onChange={e => setForm({ ...form, package_price: e.target.value })}
                placeholder={t('pkg_price_ph')} style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: '#667eea', fontWeight: 600, marginBottom: 5 }}>Szukasz produktów?</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <a href="https://zakupy.auchan.pl/" target="_blank" rel="noreferrer"
                  style={{ fontSize: 11, fontWeight: 700, color: '#667eea', textDecoration: 'none', background: '#f0f2ff', padding: '3px 10px', borderRadius: 4, border: '1px solid #c0caff' }}>
                  Auchan
                </a>
              </div>
            </div>
            <div style={{ background: '#f8f9ff', border: '1px solid #e0e4ff', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#555', lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, color: '#667eea', marginBottom: 4 }}>{t('macro_auto_title')}</div>
              {t('macro_auto_desc')}
              <div style={{ marginTop: 8, color: '#999' }}>{t('macro_edit_hint')}</div>
            </div>
            <button className="btn btn-primary" onClick={handleSubmit} style={{ width: '100%', marginTop: 16 }}>
              {t('add_product_btn')}
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
          background: toast.color, color:'white', padding:'16px 28px', borderRadius:12,
          fontSize:15, fontWeight:600, boxShadow:'0 8px 32px rgba(0,0,0,0.25)',
          zIndex:9999, pointerEvents:'none', textAlign:'center', whiteSpace:'nowrap' }}>
          {toast.msg}
        </div>
      )}

      {/* Import section */}
      <div className="card">
        <h2>{t('import_title')}</h2>

        <div style={{ background: '#f8f9ff', border: '1px solid #e0e4ff', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, lineHeight: 1.7 }}>
          <div style={{ fontWeight: 600, color: '#667eea', marginBottom: 8 }}>{t('import_how_to')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4, color: '#444' }}>{t('opt1_title')}</div>
              <ol style={{ margin: 0, paddingLeft: 16, color: '#555', fontSize: 12 }}>
                <li>{t('opt1_s1')}</li>
                <li>{t('opt1_s2')}</li>
                <li>{t('opt1_s3')}</li>
              </ol>
              <div style={{ marginTop: 6, fontSize: 11, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 5, padding: '4px 8px' }}>
                Zgubiłeś paragon? Otwórz paragon w aplikacji sklepu, zrób screenshot i wgraj
              </div>
              <div style={{ marginTop: 5, fontSize: 11, color: '#856404' }}>
                {t('ai_daily_lim')}{remainingImports !== null && <span>{t('ai_rem')(remainingImports)}</span>}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4, color: '#444' }}>{t('opt2_title')}</div>
              <div style={{ color: '#555', fontSize: 12, lineHeight: 1.8 }}>
                <div>Wymagany format pliku:</div>
                <code style={{ background: '#eef', padding: '1px 4px', borderRadius: 3 }}>nazwa,gramatura,jednostka,cena</code>
                <div>lub: <code style={{ background: '#eef', padding: '1px 4px', borderRadius: 3 }}>nazwa,cena</code> <span style={{ color: '#999' }}>(ręcznie wprowadź gramaturę i jednostkę przed zapisaniem)</span></div>
                <div style={{ marginTop: 4 }}>Wgraj plik i kliknij <strong>Zastosuj plik</strong></div>
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: '#2a9d5c' }}>{t('no_lim')}</div>
            </div>
          </div>
        </div>

        {!importItems ? (
          <div>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0]); }}
              onClick={() => fileInputRef.current?.click()}
              style={{ border: `2px dashed ${dragOver ? '#667eea' : selectedFile ? '#2a9d5c' : '#ddd'}`, borderRadius: 10, padding: '24px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(102,126,234,0.05)' : '#fafafa', transition: 'all 0.15s', marginBottom: 12 }}
            >
              <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.txt,.csv" style={{ display: 'none' }} onChange={e => handleFileSelect(e.target.files[0])} />
              {selectedFile ? (
                <>
                  <div style={{ fontWeight: 600, color: '#2a9d5c', marginBottom: 2 }}>
                    {isImageFile(selectedFile) ? 'Opcja 1: ' : 'Opcja 2: '}{selectedFile.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#aaa' }}>{t('click_change')}</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                  <div style={{ fontWeight: 600, color: '#555', marginBottom: 4 }}>{t('click_drag_file')}</div>
                  <div style={{ fontSize: 12, color: '#aaa' }}>{t('file_types_hint')}</div>
                </>
              )}
            </div>
            {selectedFile && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {isImageFile(selectedFile) && (
                  <button className="btn btn-primary" onClick={handleParseAI} disabled={importing} style={{ minWidth: 200 }}>
                    {importing ? t('analyzing') : t('apply_ai_btn')}
                  </button>
                )}
                {isTextFile(selectedFile) && (
                  <button className="btn btn-primary" onClick={handleParseFree} disabled={importing}
                    style={{ minWidth: 200, background: 'linear-gradient(135deg, #2a9d5c, #1d7a45)' }}>
                    {importing ? t('processing') : t('apply_file_btn')}
                  </button>
                )}
                <button className="btn" style={{ background: '#eee', color: '#555' }}
                  onClick={() => { setSelectedFile(null); setError(''); }}>
                  {t('cancel')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>
              Sprawdź dopasowania i uzupełnij dane. Zaznacz <strong>Na wagę</strong> dla warzyw, owoców i mięsa - podaj wtedy cenę za kg.
            </p>
            <table style={{ marginBottom: 16 }}>
              <thead>
                <tr>
                  <th style={{ width: 30 }}></th>
                  <th>Z pliku</th>
                  <th>Dopasuj / utwórz</th>
                  <th>Rodzaj</th>
                  <th>Gramatura opak.</th>
                  <th>Jedn.</th>
                  <th>Cena</th>
                </tr>
              </thead>
              <tbody>
                {importItems.map((item, i) => {
                  const upd = u => { const a = [...importItems]; a[i] = { ...a[i], ...u }; setImportItems(a); };
                  const isNew = !item.matched_product;
                  const sbw = !!item.sold_by_weight;
                  return (
                    <tr key={i} style={{ opacity: item.selected ? 1 : 0.45, verticalAlign: 'top' }}>
                      <td style={{ paddingTop: 6 }}>
                        <input type="checkbox" checked={item.selected}
                          onChange={e => upd({ selected: e.target.checked })} />
                      </td>
                      <td style={{ fontSize: 12 }}>{item.receipt_name}</td>
                      <td>
                        <select
                          value={String(item.matched_product?.id || '')}
                          onChange={e => {
                            const p = productList.find(p => String(p.id) === e.target.value) || null;
                            upd({ matched_product: p, selected: item.selected || !!p });
                          }}
                          style={{ fontSize: 12, padding: '3px 6px', maxWidth: 180 }}
                        >
                          <option value="">➕ utwórz nowy</option>
                          {productList.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                        </select>
                        {isNew && <div style={{ fontSize: 10, color: '#667eea', marginTop: 2 }}>zostanie dodany do listy</div>}
                      </td>
                      {/* Rodzaj: w opakowaniu / na wagę */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 120 }}>
                          <label style={{
                            display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                            padding: '3px 6px', borderRadius: 5, cursor: 'pointer',
                            background: !sbw ? '#e8ecff' : 'transparent',
                            border: !sbw ? '1px solid #c0caff' : '1px solid #e8e8e8',
                          }}>
                            <input type="radio" checked={!sbw} onChange={() => upd({ sold_by_weight: false })} />
                            W opakowaniu
                          </label>
                          <label style={{
                            display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                            padding: '3px 6px', borderRadius: 5, cursor: 'pointer',
                            background: sbw ? '#e8ecff' : 'transparent',
                            border: sbw ? '1px solid #c0caff' : '1px solid #e8e8e8',
                          }}>
                            <input type="radio" checked={sbw} onChange={() => upd({ sold_by_weight: true })} />
                            Na wagę
                          </label>
                        </div>
                      </td>
                      {/* Gramatura */}
                      <td>
                        {sbw
                          ? <span style={{ fontSize: 11, color: '#aaa' }}>1000 g (1 kg)</span>
                          : <input type="number" step="1" min="0" value={item.weight}
                              onChange={e => upd({ weight: e.target.value })}
                              style={{ ...s, width: 65 }} placeholder="np. 500" />
                        }
                      </td>
                      {/* Jednostka */}
                      <td>
                        {sbw
                          ? <span style={{ fontSize: 11, color: '#aaa' }}>g</span>
                          : <UnitSelect value={item.unit} onChange={e => upd({ unit: e.target.value })} style={{ ...s, width: 55 }} />
                        }
                      </td>
                      {/* Cena */}
                      <td>
                        <input type="number" step="0.01" min="0" value={item.price}
                          onChange={e => upd({ price: e.target.value })}
                          style={{ ...s, width: 75 }} />
                        <div style={{ fontSize: 10, color: sbw ? '#667eea' : '#bbb', marginTop: 2 }}>
                          {sbw ? 'zł za kg' : 'zł/opak.'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" onClick={handleApplyImport}>{t('apply_changes')}</button>
              <button className="btn" style={{ background: '#eee', color: '#555' }}
                onClick={() => { setImportItems(null); setError(''); }}>{t('cancel')}</button>
            </div>
          </div>
        )}
      </div>

      {/* Product list — collapsible */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <button
          onClick={() => setListOpen(o => !o)}
          style={{ width: '100%', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, fontWeight: 600, color: '#667eea' }}
        >
          <span>
            {t('product_list_title')}
            <span style={{ fontSize: 12, fontWeight: 400, color: '#aaa', marginLeft: 8 }}>- tu możesz edytować swoje produkty</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#667eea', fontWeight: 400 }}>
            {listOpen ? 'Zwiń' : 'Rozwiń'}
            <span style={{ fontSize: 16, transition: 'transform 0.2s', transform: listOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
          </span>
        </button>
        {listOpen && <div style={{ padding: '0 20px 20px', borderTop: '1px solid #f0f0f0' }}>
        <div style={{ margin: '12px 0 10px' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj produktu..."
            style={{ width: '100%', padding: '7px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
            onFocus={e => e.target.style.borderColor = '#667eea'}
            onBlur={e => e.target.style.borderColor = '#ddd'}
          />
        </div>
        <table>
          {!editId && (
            <thead>
              <tr><th>{t('col_name')}</th><th>{t('col_kcal')}</th><th>{t('col_macro')}</th><th>Pojemność Opakowania</th><th>Cena (opak/kg)</th><th></th></tr>
            </thead>
          )}
          <tbody>
            {productList.filter(p => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase())).map(p => editId === p.id ? (
              <React.Fragment key={p.id}>
                <tr style={{ background: '#f8f9ff', verticalAlign: 'top' }}>
                  <td>
                    <div style={fl}>{t('product_name_lbl')}</div>
                    <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={s} />
                  </td>
                  <td>
                    <div style={fl}>{t('kcal_lbl')}</div>
                    <input type="number" step="0.1" value={editForm.kcal} onChange={e => setEditForm({ ...editForm, kcal: e.target.value })} style={{ ...s, width: 72 }} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div>
                        <div style={fl}>{t('protein_lbl')}</div>
                        <input type="number" step="0.1" value={editForm.protein} onChange={e => setEditForm({ ...editForm, protein: e.target.value })} style={{ ...s, width: 80 }} />
                      </div>
                      <div>
                        <div style={fl}>{t('fat_lbl')}</div>
                        <input type="number" step="0.1" value={editForm.fat} onChange={e => setEditForm({ ...editForm, fat: e.target.value })} style={{ ...s, width: 88 }} />
                      </div>
                      <div>
                        <div style={fl}>{t('carbs_lbl')}</div>
                        <input type="number" step="0.1" value={editForm.carbs} onChange={e => setEditForm({ ...editForm, carbs: e.target.value })} style={{ ...s, width: 100 }} />
                      </div>
                      <button onClick={handleAutoFill} disabled={lookingUp === editId}
                        style={{ padding: '4px 10px', fontSize: 11, background: '#667eea', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: 1 }}>
                        {lookingUp === editId ? '⏳...' : t('auto_fill')}
                      </button>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{
                        display: 'flex', alignItems: 'flex-start', gap: 7, padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                        background: !editForm.sold_by_weight ? '#e8ecff' : 'transparent',
                        border: !editForm.sold_by_weight ? '1px solid #c0caff' : '1px solid #e8e8e8',
                      }}>
                        <input type="radio" name={`pkgt-${editId}`} checked={!editForm.sold_by_weight}
                          onChange={() => setEditForm(f => ({ ...f, sold_by_weight: false }))} style={{ marginTop: 2 }} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#444' }}>Produkt w opakowaniu</div>
                          {!editForm.sold_by_weight && (
                            <div style={{ display: 'flex', gap: 4, marginTop: 5, alignItems: 'flex-end' }}>
                              <div>
                                <div style={fl}>Wielkość opakowania</div>
                                <input type="number" value={editForm.package_weight}
                                  onChange={e => setEditForm({ ...editForm, package_weight: e.target.value })}
                                  style={{ ...s, width: 70 }} placeholder="np. 500" />
                              </div>
                              <UnitSelect value={editForm.unit}
                                onChange={e => setEditForm({ ...editForm, unit: e.target.value })}
                                style={{ ...s, width: 58 }} />
                            </div>
                          )}
                        </div>
                      </label>
                      <label style={{
                        display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                        background: !!editForm.sold_by_weight ? '#e8ecff' : 'transparent',
                        border: !!editForm.sold_by_weight ? '1px solid #c0caff' : '1px solid #e8e8e8',
                      }}>
                        <input type="radio" name={`pkgt-${editId}`} checked={!!editForm.sold_by_weight}
                          onChange={() => setEditForm(f => ({ ...f, sold_by_weight: true, unit: 'g', package_weight: 1000 }))} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#667eea' }}>Na wagę</div>
                          <div style={{ fontSize: 10, color: '#999' }}>np. warzywa, mięso, owoce</div>
                        </div>
                      </label>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
                      <div>
                        <div style={fl}>{editForm.sold_by_weight ? 'Cena za kg (zł)' : t('pkg_price_lbl')}</div>
                        <input type="number" step="0.01" value={editForm.package_price} onChange={e => setEditForm({ ...editForm, package_price: e.target.value })} style={{ ...s, width: 86 }} />
                      </div>
                      {!editForm.sold_by_weight && (
                        <span style={{ fontSize: 11, color: '#667eea', whiteSpace: 'nowrap', paddingBottom: 7 }}>
                          {editForm.package_price && editForm.package_weight
                            ? `= ${toUnitPrice(editForm.package_price, editForm.package_weight, editForm.unit).toFixed(2)} ${priceLabel(editForm.unit)}`
                            : ''}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 13 }} onClick={handleSaveEdit}>{t('save_btn')}</button>
                    <button className="btn" style={{ padding: '5px 12px', fontSize: 13, background: '#eee', color: '#555' }} onClick={() => setEditId(null)}>{t('cancel')}</button>
                  </td>
                </tr>
                <tr style={{ background: '#f0f2ff' }}>
                  <td colSpan={6} style={{ padding: '5px 12px', fontSize: 11, color: '#667eea' }}>
                    {t('price_tip')(editForm.unit || 'g')}&nbsp;
                    {t('auto_fill_tip')}
                  </td>
                </tr>
              </React.Fragment>
            ) : (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td style={{ fontWeight: 600, color: p.kcal ? '#1a1a2e' : '#ccc' }}>{p.kcal != null ? `${p.kcal} kcal` : '-'}</td>
                <td><MacroDisplay p={p} /></td>
                <td style={{ fontSize: 12, color: p.sold_by_weight ? '#667eea' : '#444' }}>
                  {p.sold_by_weight ? 'Na wagę' : p.package_weight ? `${p.package_weight} ${p.unit || 'g'}` : '-'}
                </td>
                <td style={{ fontWeight: 600, color: p.price > 0 ? '#1a1a2e' : '#ccc' }}>{displayPrice(p)}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 13 }} onClick={() => startEdit(p)}>{t('edit_btn')}</button>
                  <button className="btn btn-danger" style={{ padding: '5px 12px', fontSize: 13 }} onClick={() => handleDelete(p.id)}>{t('del_btn')}</button>
                </td>
              </tr>
            ))}
            {productList.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#999' }}>{t('no_products')}</td></tr>
            )}
            {productList.length > 0 && search.trim() && !productList.some(p => p.name.toLowerCase().includes(search.trim().toLowerCase())) && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#999', fontStyle: 'italic' }}>Nie znaleziono produktu „{search}"</td></tr>
            )}
          </tbody>
        </table>
        </div>}
      </div>
    </div>
  );
}
