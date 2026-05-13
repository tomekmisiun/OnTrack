import React, { useState, useEffect, useRef } from 'react';
import { products as api, importPrices } from '../api';

// price przechowywane jako: zł/100g, zł/100ml lub zł/szt
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

const displayPrice = (p) =>
  p.price > 0
    ? `${p.price.toFixed(2)} ${priceLabel(p.unit || 'g')}`
    : '—';

const EMPTY_FORM = { name: '', package_weight: '', package_price: '', unit: 'g', kcal: '', protein: '', fat: '', carbs: '' };

const MacroDisplay = ({ p }) => {
  if (!p.kcal && !p.protein && !p.fat && !p.carbs) return <span style={{ color: '#ccc' }}>—</span>;
  return (
    <div style={{ fontSize: 11, lineHeight: 1.6 }}>
      {p.kcal   != null && <span style={{ marginRight: 6 }}><b>{p.kcal}</b> kcal</span>}
      {p.protein != null && <span style={{ marginRight: 6 }}>B: <b>{p.protein}g</b></span>}
      {p.fat     != null && <span style={{ marginRight: 6 }}>T: <b>{p.fat}g</b></span>}
      {p.carbs   != null && <span>W: <b>{p.carbs}g</b></span>}
    </div>
  );
};

export default function Products() {
  const [productList, setProductList] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [error, setError] = useState('');
  const [lookingUp, setLookingUp] = useState(null); // id produktu którego szukamy
  const [importItems, setImportItems] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef();

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    try { setProductList((await api.getAll()).data); }
    catch { setError('Błąd ładowania produktów'); }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.package_weight || !form.package_price) {
      setError('Wypełnij wszystkie pola'); return;
    }
    try {
      await api.create({
        name: form.name,
        package_weight: parseFloat(form.package_weight),
        price: toUnitPrice(form.package_price, form.package_weight, form.unit),
        unit: form.unit,
        kcal:    form.kcal    !== '' ? parseFloat(form.kcal)    : null,
        protein: form.protein !== '' ? parseFloat(form.protein) : null,
        fat:     form.fat     !== '' ? parseFloat(form.fat)     : null,
        carbs:   form.carbs   !== '' ? parseFloat(form.carbs)   : null,
      });
      setForm(EMPTY_FORM);
      setError('');
      loadProducts();
    } catch (e) { setError(e.response?.data?.error || 'Błąd dodawania produktu'); }
  };

  const startEdit = (p) => {
    setEditId(p.id);
    setEditForm({
      name: p.name,
      package_weight: p.package_weight,
      package_price: toPackagePrice(p.price, p.package_weight, p.unit || 'g').toFixed(2),
      unit: p.unit || 'g',
      kcal:    p.kcal    ?? '',
      protein: p.protein ?? '',
      fat:     p.fat     ?? '',
      carbs:   p.carbs   ?? '',
    });
  };

  const handleSaveEdit = async () => {
    try {
      await api.update(editId, {
        name: editForm.name,
        package_weight: parseFloat(editForm.package_weight),
        price: toUnitPrice(editForm.package_price, editForm.package_weight, editForm.unit),
        unit: editForm.unit,
        kcal:    editForm.kcal    !== '' ? parseFloat(editForm.kcal)    : null,
        protein: editForm.protein !== '' ? parseFloat(editForm.protein) : null,
        fat:     editForm.fat     !== '' ? parseFloat(editForm.fat)     : null,
        carbs:   editForm.carbs   !== '' ? parseFloat(editForm.carbs)   : null,
      });
      setEditId(null);
      loadProducts();
    } catch (e) { setError(e.response?.data?.error || 'Błąd zapisu'); }
  };

  const handleAutoFill = async () => {
    if (!editForm.name) return;
    setLookingUp(editId);
    setError('');
    try {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(editForm.name)}&search_simple=1&action=process&json=1&page_size=5&fields=product_name,nutriments`;
      const res = await fetch(url);
      const data = await res.json();
      const products = data.products || [];
      let found = false;
      for (const p of products) {
        const n = p.nutriments || {};
        let kcal = n['energy-kcal_100g'] ?? n['energy-kcal'] ?? null;
        if (!kcal && n['energy_100g']) kcal = Math.round(n['energy_100g'] / 4.184 * 10) / 10;
        if (kcal) {
          setEditForm(f => ({
            ...f,
            kcal:    Math.round(kcal * 10) / 10,
            protein: Math.round((n['proteins_100g'] ?? 0) * 10) / 10,
            fat:     Math.round((n['fat_100g'] ?? 0) * 10) / 10,
            carbs:   Math.round((n['carbohydrates_100g'] ?? 0) * 10) / 10,
          }));
          found = true;
          break;
        }
      }
      if (!found) setError('Nie znaleziono danych dla "' + editForm.name + '" — uzupełnij ręcznie');
    } catch {
      setError('Błąd połączenia z Open Food Facts');
    } finally {
      setLookingUp(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Usunąć produkt?')) return;
    try { await api.delete(id); loadProducts(); }
    catch { setError('Błąd usuwania produktu'); }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setImporting(true); setError(''); setImportSuccess('');
    try {
      const res = await importPrices.parse(file);
      setImportItems(res.data.items.map(item => ({
        ...item, selected: !!item.matched_product, price: item.suggested_price ?? '',
      })));
    } catch (e) { setError(e.response?.data?.error || 'Błąd parsowania pliku'); }
    finally { setImporting(false); }
  };

  const handleApplyImport = async () => {
    const updates = importItems
      .filter(i => i.selected && i.matched_product && i.price !== '' && i.price !== null)
      .map(i => ({ product_id: i.matched_product.id, price: parseFloat(i.price) }));
    if (!updates.length) { setError('Zaznacz przynajmniej jeden produkt'); return; }
    try {
      const res = await importPrices.apply(updates);
      setImportSuccess(res.data.message);
      setImportItems(null);
      loadProducts();
    } catch { setError('Błąd aktualizacji cen'); }
  };

  const s = { padding: '5px 8px', fontSize: 13 };
  const fl = { fontSize: 10, color: '#888', marginBottom: 3 };

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
        <h2>Dodaj produkt</h2>
        {error && <p style={{ color: 'red', marginBottom: 12 }}>{error}</p>}
        <div className="form-row">
          <input placeholder="Nazwa produktu" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Ilość w opakowaniu" type="number" value={form.package_weight}
            onChange={e => setForm({ ...form, package_weight: e.target.value })} style={{ maxWidth: 150 }} />
          <UnitSelect value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} style={{ maxWidth: 80 }} />
          <input placeholder="Cena opakowania (zł)" type="number" step="0.01" value={form.package_price}
            onChange={e => setForm({ ...form, package_price: e.target.value })} style={{ maxWidth: 160 }} />
          {form.package_weight && form.package_price && (
            <span style={{ fontSize: 12, color: '#667eea', alignSelf: 'center', whiteSpace: 'nowrap' }}>
              = {toUnitPrice(form.package_price, form.package_weight, form.unit).toFixed(2)} {priceLabel(form.unit)}
            </span>
          )}
          <button className="btn btn-primary" onClick={handleSubmit}>Dodaj</button>
        </div>
        <div className="form-row" style={{ marginTop: 0 }}>
          <input placeholder="Kcal/100g" type="number" step="0.1" value={form.kcal}
            onChange={e => setForm({ ...form, kcal: e.target.value })} style={{ maxWidth: 110 }} />
          <input placeholder="Białko (g)" type="number" step="0.1" value={form.protein}
            onChange={e => setForm({ ...form, protein: e.target.value })} style={{ maxWidth: 110 }} />
          <input placeholder="Tłuszcze (g)" type="number" step="0.1" value={form.fat}
            onChange={e => setForm({ ...form, fat: e.target.value })} style={{ maxWidth: 110 }} />
          <input placeholder="Węglowodany (g)" type="number" step="0.1" value={form.carbs}
            onChange={e => setForm({ ...form, carbs: e.target.value })} style={{ maxWidth: 130 }} />
          <span style={{ fontSize: 11, color: '#aaa', alignSelf: 'center' }}>opcjonalne — wartości na 100g</span>
        </div>
      </div>

      {importSuccess && (
        <div style={{ background: '#e0ffe0', color: '#060', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          {importSuccess}
        </div>
      )}

      {/* Import paragonów */}
      <div className="card">
        <h2>Importuj ceny z paragonu</h2>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>
          Wgraj zdjęcie paragonu (JPG, PNG, WEBP) lub plik CSV/TXT.
        </p>
        {!importItems ? (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFileUpload(e.dataTransfer.files[0]); }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#667eea' : '#ddd'}`, borderRadius: 10,
              padding: '32px 24px', textAlign: 'center', cursor: 'pointer',
              background: dragOver ? 'rgba(102,126,234,0.05)' : '#fafafa', transition: 'all 0.15s',
            }}
          >
            <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.txt,.csv"
              style={{ display: 'none' }} onChange={e => handleFileUpload(e.target.files[0])} />
            {importing
              ? <div style={{ color: '#667eea', fontWeight: 600 }}>Przetwarzam przez Claude AI…</div>
              : <>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                  <div style={{ fontWeight: 600, color: '#555', marginBottom: 4 }}>Kliknij lub przeciągnij plik</div>
                  <div style={{ fontSize: 12, color: '#aaa' }}>JPG, PNG, WEBP, TXT, CSV</div>
                </>
            }
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>
              Zaznacz produkty, sprawdź ceny i kliknij <strong>Zastosuj</strong>.
            </p>
            <table style={{ marginBottom: 16 }}>
              <thead>
                <tr>
                  <th style={{ width: 36 }}></th>
                  <th>Z paragonu</th>
                  <th>Ilość</th>
                  <th>Cena opak.</th>
                  <th>Dopasowany produkt</th>
                  <th>Nowa cena</th>
                </tr>
              </thead>
              <tbody>
                {importItems.map((item, i) => (
                  <tr key={i} style={{ opacity: item.selected ? 1 : 0.5 }}>
                    <td>
                      <input type="checkbox" checked={item.selected}
                        onChange={e => { const u = [...importItems]; u[i] = { ...u[i], selected: e.target.checked }; setImportItems(u); }} />
                    </td>
                    <td style={{ fontSize: 13 }}>{item.receipt_name}</td>
                    <td style={{ fontSize: 13 }}>{item.receipt_quantity ? `${item.receipt_quantity} ${item.receipt_unit}` : '—'}</td>
                    <td style={{ fontSize: 13 }}>{item.receipt_price != null ? `${item.receipt_price.toFixed(2)} zł` : '—'}</td>
                    <td style={{ fontSize: 13 }}>
                      {item.matched_product
                        ? <span style={{ color: '#2a9d5c', fontWeight: 600 }}>
                            {item.matched_product.name}
                            <br /><span style={{ fontWeight: 400, color: '#888', fontSize: 11 }}>
                              {item.matched_product.package_weight} {item.matched_product.unit}
                            </span>
                          </span>
                        : <span style={{ color: '#e07b00' }}>Brak dopasowania</span>}
                    </td>
                    <td>
                      {item.matched_product ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="number" step="0.01" value={item.price}
                            onChange={e => { const u = [...importItems]; u[i] = { ...u[i], price: e.target.value }; setImportItems(u); }}
                            style={{ ...s, width: 80 }} />
                          <span style={{ fontSize: 11, color: '#888' }}>
                            {priceLabel(item.matched_product.unit || 'g')}
                          </span>
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" onClick={handleApplyImport}>Zastosuj zmiany</button>
              <button className="btn" style={{ background: '#eee', color: '#555' }}
                onClick={() => { setImportItems(null); setError(''); }}>Anuluj</button>
            </div>
          </div>
        )}
      </div>

      {/* Lista produktów */}
      <div className="card">
        <h2>Lista produktów</h2>
        <table>
          {!editId && (
            <thead>
              <tr><th>Nazwa</th><th>Kcal/100g</th><th>Makro / 100g</th><th>Cena</th><th></th></tr>
            </thead>
          )}
          <tbody>
            {productList.map(p => editId === p.id ? (
              <React.Fragment key={p.id}>
                <tr style={{ background: '#f8f9ff', verticalAlign: 'top' }}>
                  <td>
                    <div style={fl}>Nazwa produktu</div>
                    <input value={editForm.name}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={s} />
                  </td>
                  <td>
                    <div style={fl}>Kalorie (kcal/100g)</div>
                    <input type="number" step="0.1" value={editForm.kcal}
                      onChange={e => setEditForm({ ...editForm, kcal: e.target.value })} style={{ ...s, width: 72 }} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div>
                        <div style={fl}>Białko (g/100g)</div>
                        <input type="number" step="0.1" value={editForm.protein}
                          onChange={e => setEditForm({ ...editForm, protein: e.target.value })} style={{ ...s, width: 80 }} />
                      </div>
                      <div>
                        <div style={fl}>Tłuszcze (g/100g)</div>
                        <input type="number" step="0.1" value={editForm.fat}
                          onChange={e => setEditForm({ ...editForm, fat: e.target.value })} style={{ ...s, width: 88 }} />
                      </div>
                      <div>
                        <div style={fl}>Węglowodany (g/100g)</div>
                        <input type="number" step="0.1" value={editForm.carbs}
                          onChange={e => setEditForm({ ...editForm, carbs: e.target.value })} style={{ ...s, width: 100 }} />
                      </div>
                      <button
                        onClick={handleAutoFill}
                        disabled={lookingUp === editId}
                        style={{ padding: '4px 10px', fontSize: 11, background: '#667eea', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: 1 }}
                      >
                        {lookingUp === editId ? '⏳...' : '✨ Auto Uzupełnij'}
                      </button>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div>
                        <div style={fl}>Ilość w opakowaniu</div>
                        <input type="number" value={editForm.package_weight}
                          onChange={e => setEditForm({ ...editForm, package_weight: e.target.value })}
                          style={{ ...s, width: 70 }} />
                      </div>
                      <div>
                        <div style={fl}>Jednostka</div>
                        <UnitSelect value={editForm.unit}
                          onChange={e => setEditForm({ ...editForm, unit: e.target.value })}
                          style={{ ...s, width: 58 }} />
                      </div>
                      <div>
                        <div style={fl}>Cena opakowania (zł)</div>
                        <input type="number" step="0.01" value={editForm.package_price}
                          onChange={e => setEditForm({ ...editForm, package_price: e.target.value })}
                          style={{ ...s, width: 86 }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#667eea', whiteSpace: 'nowrap', paddingBottom: 7 }}>
                        {editForm.package_price && editForm.package_weight
                          ? `= ${toUnitPrice(editForm.package_price, editForm.package_weight, editForm.unit).toFixed(2)} ${priceLabel(editForm.unit)}`
                          : ''}
                      </span>
                    </div>
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 13 }} onClick={handleSaveEdit}>Zapisz</button>
                    <button className="btn" style={{ padding: '5px 12px', fontSize: 13, background: '#eee', color: '#555' }} onClick={() => setEditId(null)}>Anuluj</button>
                  </td>
                </tr>
                <tr style={{ background: '#f0f2ff' }}>
                  <td colSpan={5} style={{ padding: '5px 12px', fontSize: 11, color: '#667eea' }}>
                    💡 <b>Cena:</b> wpisz ilość w opakowaniu i cenę za całe opakowanie — system przeliczy na {priceLabel(editForm.unit || 'g')}.&nbsp;
                    <b>✨ Auto Uzupełnij</b> — pobiera Kcal i Makro automatycznie z bazy Open Food Facts na podstawie nazwy produktu.
                  </td>
                </tr>
              </React.Fragment>
            ) : (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td style={{ fontWeight: 600, color: p.kcal ? '#1a1a2e' : '#ccc' }}>
                  {p.kcal != null ? `${p.kcal} kcal` : '—'}
                </td>
                <td><MacroDisplay p={p} /></td>
                <td style={{ fontWeight: 600, color: p.price > 0 ? '#1a1a2e' : '#ccc' }}>{displayPrice(p)}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 13 }} onClick={() => startEdit(p)}>Edytuj</button>
                  <button className="btn btn-danger" style={{ padding: '5px 12px', fontSize: 13 }} onClick={() => handleDelete(p.id)}>Usuń</button>
                </td>
              </tr>
            ))}
            {productList.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: '#999' }}>Brak produktów</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
