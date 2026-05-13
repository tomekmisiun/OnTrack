import React, { useState, useEffect, useRef } from 'react';
import { products as api, importPrices } from '../api';

export default function Products() {
  const [productList, setProductList] = useState([]);
  const [form, setForm] = useState({ name: '', package_weight: '', price: '', unit: 'g' });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [error, setError] = useState('');

  // Import section
  const [importItems, setImportItems] = useState(null); // null = hidden, [] = review mode
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
    if (!form.name || !form.package_weight || !form.price) { setError('Wypełnij wszystkie pola'); return; }
    try {
      await api.create({ name: form.name, package_weight: parseFloat(form.package_weight), price: parseFloat(form.price), unit: form.unit });
      setForm({ name: '', package_weight: '', price: '', unit: 'g' });
      setError('');
      loadProducts();
    } catch (e) { setError(e.response?.data?.error || 'Błąd dodawania produktu'); }
  };

  const startEdit = (p) => {
    setEditId(p.id);
    setEditForm({ name: p.name, package_weight: p.package_weight, price: p.price, unit: p.unit || 'g' });
  };

  const handleSaveEdit = async () => {
    try {
      await api.update(editId, { name: editForm.name, package_weight: parseFloat(editForm.package_weight), price: parseFloat(editForm.price), unit: editForm.unit });
      setEditId(null);
      loadProducts();
    } catch (e) { setError(e.response?.data?.error || 'Błąd zapisu'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Usunąć produkt?')) return;
    try { await api.delete(id); loadProducts(); }
    catch { setError('Błąd usuwania produktu'); }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setImporting(true);
    setError('');
    setImportSuccess('');
    try {
      const res = await importPrices.parse(file);
      setImportItems(res.data.items.map(item => ({ ...item, selected: !!item.matched_product, price: item.suggested_price ?? '' })));
    } catch (e) {
      setError(e.response?.data?.error || 'Błąd parsowania pliku');
    } finally {
      setImporting(false);
    }
  };

  const handleApplyImport = async () => {
    const updates = importItems
      .filter(i => i.selected && i.matched_product && i.price !== '' && i.price !== null)
      .map(i => ({ product_id: i.matched_product.id, price: parseFloat(i.price) }));
    if (!updates.length) { setError('Zaznacz przynajmniej jeden produkt do aktualizacji'); return; }
    try {
      const res = await importPrices.apply(updates);
      setImportSuccess(res.data.message);
      setImportItems(null);
      loadProducts();
    } catch { setError('Błąd aktualizacji cen'); }
  };

  const inputStyle = { padding: '5px 8px', fontSize: 13 };

  return (
    <div>
      <div className="card">
        <h2>Dodaj produkt</h2>
        {error && <p style={{ color: 'red', marginBottom: 12 }}>{error}</p>}
        <div className="form-row">
          <input placeholder="Nazwa produktu" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Ilość w opakowaniu" type="number" value={form.package_weight} onChange={e => setForm({ ...form, package_weight: e.target.value })} style={{ maxWidth: 160 }} />
          <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} style={{ maxWidth: 80 }}>
            <option value="g">g</option>
            <option value="ml">ml</option>
            <option value="szt">szt</option>
          </select>
          <input placeholder="Cena (zł)" type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} style={{ maxWidth: 120 }} />
          <button className="btn btn-primary" onClick={handleSubmit}>Dodaj</button>
        </div>
      </div>

      {importSuccess && (
        <div style={{ background: '#e0ffe0', color: '#060', padding: 12, borderRadius: 8, marginBottom: 16 }}>{importSuccess}</div>
      )}

      {/* Import section */}
      <div className="card">
        <h2>Importuj ceny z paragonu</h2>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>
          Wgraj zdjęcie paragonu (JPG, PNG, WEBP) lub plik tekstowy/CSV. Claude wyciągnie produkty i zaproponuje aktualizację cen.
        </p>

        {!importItems ? (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFileUpload(e.dataTransfer.files[0]); }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#667eea' : '#ddd'}`,
              borderRadius: 10,
              padding: '32px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragOver ? 'rgba(102,126,234,0.05)' : '#fafafa',
              transition: 'all 0.15s',
            }}
          >
            <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.txt,.csv" style={{ display: 'none' }} onChange={e => handleFileUpload(e.target.files[0])} />
            {importing ? (
              <div style={{ color: '#667eea', fontWeight: 600 }}>Przetwarzam plik przez Claude AI…</div>
            ) : (
              <>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                <div style={{ fontWeight: 600, color: '#555', marginBottom: 4 }}>Kliknij lub przeciągnij plik</div>
                <div style={{ fontSize: 12, color: '#aaa' }}>JPG, PNG, WEBP, TXT, CSV</div>
              </>
            )}
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>
              Zaznacz produkty do aktualizacji, popraw ceny jeśli trzeba, kliknij <strong>Zastosuj</strong>.
            </p>
            <table style={{ marginBottom: 16 }}>
              <thead>
                <tr>
                  <th style={{ width: 36 }}></th>
                  <th>Z paragonu</th>
                  <th>Ilość na paragonie</th>
                  <th>Cena na paragonie</th>
                  <th>Dopasowany produkt</th>
                  <th>Nowa cena opakowania</th>
                </tr>
              </thead>
              <tbody>
                {importItems.map((item, i) => (
                  <tr key={i} style={{ opacity: item.selected ? 1 : 0.5 }}>
                    <td>
                      <input type="checkbox" checked={item.selected} onChange={e => {
                        const updated = [...importItems];
                        updated[i] = { ...updated[i], selected: e.target.checked };
                        setImportItems(updated);
                      }} />
                    </td>
                    <td style={{ fontSize: 13 }}>{item.receipt_name}</td>
                    <td style={{ fontSize: 13 }}>
                      {item.receipt_quantity ? `${item.receipt_quantity} ${item.receipt_unit}` : '—'}
                    </td>
                    <td style={{ fontSize: 13 }}>{item.receipt_price != null ? `${item.receipt_price.toFixed(2)} zł` : '—'}</td>
                    <td style={{ fontSize: 13 }}>
                      {item.matched_product ? (
                        <span style={{ color: '#2a9d5c', fontWeight: 600 }}>{item.matched_product.name}<br />
                          <span style={{ fontWeight: 400, color: '#888', fontSize: 11 }}>opak. {item.matched_product.package_weight} {item.matched_product.unit}</span>
                        </span>
                      ) : <span style={{ color: '#e07b00' }}>Brak dopasowania</span>}
                    </td>
                    <td>
                      {item.matched_product ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="number" step="0.01"
                            value={item.price}
                            onChange={e => { const u = [...importItems]; u[i] = { ...u[i], price: e.target.value }; setImportItems(u); }}
                            style={{ ...inputStyle, width: 80 }}
                          />
                          <span style={{ fontSize: 12, color: '#888' }}>zł</span>
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" onClick={handleApplyImport}>Zastosuj zmiany</button>
              <button className="btn" style={{ background: '#eee', color: '#555' }} onClick={() => { setImportItems(null); setError(''); }}>Anuluj</button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Lista produktów</h2>
        <table>
          <thead>
            <tr><th>Nazwa</th><th>Opakowanie</th><th>Cena</th><th></th></tr>
          </thead>
          <tbody>
            {productList.map(p => editId === p.id ? (
              <tr key={p.id} style={{ background: '#f8f9ff' }}>
                <td><input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={inputStyle} /></td>
                <td style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input type="number" value={editForm.package_weight} onChange={e => setEditForm({ ...editForm, package_weight: e.target.value })} style={{ ...inputStyle, width: 80 }} />
                  <select value={editForm.unit} onChange={e => setEditForm({ ...editForm, unit: e.target.value })} style={{ ...inputStyle, width: 60 }}>
                    <option value="g">g</option>
                    <option value="ml">ml</option>
                  </select>
                </td>
                <td><input type="number" step="0.01" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: e.target.value })} style={{ ...inputStyle, width: 90 }} /></td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 13 }} onClick={handleSaveEdit}>Zapisz</button>
                  <button className="btn" style={{ padding: '5px 12px', fontSize: 13, background: '#eee', color: '#555' }} onClick={() => setEditId(null)}>Anuluj</button>
                </td>
              </tr>
            ) : (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.package_weight} {p.unit || 'g'}</td>
                <td>{p.price.toFixed(2)} zł</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 13 }} onClick={() => startEdit(p)}>Edytuj</button>
                  <button className="btn btn-danger" style={{ padding: '5px 12px', fontSize: 13 }} onClick={() => handleDelete(p.id)}>Usuń</button>
                </td>
              </tr>
            ))}
            {productList.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: '#999' }}>Brak produktów — dodaj pierwszy!</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
