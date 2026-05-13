import React, { useState, useEffect } from 'react';
import { recipes as api, products as productsApi } from '../api';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

export default function Recipes() {
  const [recipeList, setRecipeList] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const [productList, setProductList] = useState([]);

  useEffect(() => {
    loadRecipes();
    productsApi.getAll().then(r => setProductList(r.data)).catch(() => {});
  }, []);

  const loadRecipes = async () => {
    try { setRecipeList((await api.getAll()).data); }
    catch { setError('Błąd ładowania przepisów'); }
  };

  const handleParse = async () => {
    if (!pasteText.trim()) return;
    setParsing(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API_URL}/api/recipes/parse-text`,
        { text: pasteText },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = res.data;
      setRemaining(data.remaining_today);
      // Przekształć na format widoku (ingredient_text jako rawName, product_id już dopasowany)
      setParsed({
        name: data.recipe_name,
        ingredients: data.ingredients.map(ing => ({
          rawName: ing.ingredient_text,
          weight: ing.weight,
          unit: ing.unit,
          product_id: ing.product_id,
        })),
      });
    } catch (e) {
      setError(e.response?.data?.error || 'Błąd parsowania przepisu');
    } finally {
      setParsing(false);
    }
  };

  const updateIngredient = (i, field, val) => {
    const updated = [...parsed.ingredients];
    updated[i] = { ...updated[i], [field]: val };
    setParsed({ ...parsed, ingredients: updated });
  };

  const removeIngredient = (i) => {
    setParsed({ ...parsed, ingredients: parsed.ingredients.filter((_, idx) => idx !== i) });
  };

  const handleSave = async () => {
    if (!parsed?.name) { setError('Brak nazwy przepisu'); return; }
    const valid = parsed.ingredients.filter(i => i.product_id && i.weight > 0);
    if (!valid.length) { setError('Żaden składnik nie ma dopasowanego produktu'); return; }
    try {
      await api.create({
        name: parsed.name,
        ingredients: valid.map(i => ({ product_id: parseInt(i.product_id), weight: i.weight })),
      });
      setParsed(null);
      setPasteText('');
      setError('');
      loadRecipes();
    } catch (e) { setError(e.response?.data?.error || 'Błąd zapisywania przepisu'); }
  };

  return (
    <div>
      <div className="card">
        <h2>Dodaj przepis</h2>
        {error && <p style={{ color: '#c00', marginBottom: 12, fontSize: 13 }}>{error}</p>}

        {!parsed ? (
          <div>
            {/* Instrukcja */}
            <div style={{ background: '#f8f9ff', border: '1px solid #e0e4ff', borderRadius: 8, padding: '14px 16px', marginBottom: 16, fontSize: 13, lineHeight: 1.8 }}>
              <div style={{ fontWeight: 700, color: '#667eea', marginBottom: 8 }}>Jak dodać przepis?</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <ol style={{ margin: 0, paddingLeft: 18, color: '#555' }}>
                    <li><b>Pierwsza linia</b> — nazwa przepisu</li>
                    <li>Wpisz lub wklej składniki w dowolnym formacie</li>
                    <li>Claude AI automatycznie wyciągnie składniki i dopasuje do Twoich produktów</li>
                    <li>Sprawdź dopasowania i kliknij <b>Zapisz przepis</b></li>
                  </ol>
                </div>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4, color: '#444' }}>Przykład:</div>
                  <pre style={{ margin: 0, background: '#fff', border: '1px solid #e0e4ff', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#333', lineHeight: 1.7 }}>
{`Owsianka
płatki owsiane 50 g
mleko 200 ml
banan 120 g
masło orzechowe 15 g`}
                  </pre>
                </div>
              </div>
              <div style={{ marginTop: 10, padding: '6px 10px', background: '#fff3cd', borderRadius: 6, color: '#856404', fontSize: 12 }}>
                ⚠️ <b>Limit dzienny: {2} parsowania na dobę.</b>
                {remaining !== null && <span> Pozostało dziś: <b>{remaining}</b>.</span>}
              </div>
            </div>

            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={'Wklej lub wpisz przepis...\n\nNazwa przepisu\nSkładnik 1 - ilość\nSkładnik 2 - ilość'}
              style={{
                width: '100%', minHeight: 200, padding: 12,
                border: '2px solid #e0e0e0', borderRadius: 8,
                fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6,
                resize: 'vertical', outline: 'none', marginBottom: 12,
                boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = '#667eea'}
              onBlur={e => e.target.style.borderColor = '#e0e0e0'}
            />
            <button
              className="btn btn-primary"
              onClick={handleParse}
              disabled={!pasteText.trim() || parsing}
              style={{ minWidth: 160 }}
            >
              {parsing ? '⏳ Claude analizuje...' : '✨ Parsuj przez AI →'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Nazwa przepisu</label>
              <input value={parsed.name} onChange={e => setParsed({ ...parsed, name: e.target.value })} style={{ width: '100%' }} />
            </div>

            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 8 }}>
              Składniki — {parsed.ingredients.filter(i => i.product_id).length}/{parsed.ingredients.length} dopasowanych przez AI
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {parsed.ingredients.map((ing, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1fr 80px 1fr 36px',
                  gap: 8, alignItems: 'center', padding: '8px 10px',
                  background: ing.product_id ? '#f6fff6' : '#fff9f0',
                  border: `1px solid ${ing.product_id ? '#c3e6cb' : '#ffd9a0'}`,
                  borderRadius: 8,
                }}>
                  <div style={{ fontSize: 13, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ing.rawName}>
                    {ing.rawName}
                  </div>
                  <input
                    type="number" value={ing.weight}
                    onChange={e => updateIngredient(i, 'weight', parseFloat(e.target.value))}
                    style={{ padding: '6px 8px', fontSize: 13 }}
                  />
                  <select
                    value={ing.product_id || ''}
                    onChange={e => updateIngredient(i, 'product_id', e.target.value || null)}
                    style={{ padding: '6px 8px', fontSize: 13 }}
                  >
                    <option value="">— brak dopasowania —</option>
                    {productList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button onClick={() => removeIngredient(i)}
                    style={{ background: '#ff4757', border: 'none', color: 'white', borderRadius: 6, cursor: 'pointer', fontSize: 14, height: 34 }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" onClick={handleSave}>Zapisz przepis</button>
              <button className="btn" style={{ background: '#eee', color: '#555' }}
                onClick={() => { setParsed(null); setError(''); }}>
                ← Wróć
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lista przepisów */}
      <div className="card">
        <h2>Lista przepisów</h2>
        {recipeList.length === 0 && <p style={{ textAlign: 'center', color: '#999' }}>Brak przepisów — dodaj pierwszy!</p>}
        {recipeList.map(r => (
          <div key={r.id} style={{ borderBottom: '1px solid #f0f0f0', padding: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{r.name}</strong>
                <span style={{ marginLeft: 12, color: '#667eea' }}>{r.total_cost.toFixed(2)} zł</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  {expanded === r.id ? 'Zwiń' : 'Składniki'}
                </button>
                <button className="btn btn-danger" onClick={async () => {
                  if (window.confirm('Usunąć przepis?')) { await api.delete(r.id); loadRecipes(); }
                }}>Usuń</button>
              </div>
            </div>
            {expanded === r.id && (
              <table style={{ marginTop: 12 }}>
                <thead><tr><th>Produkt</th><th>Gramatura</th><th>Koszt</th></tr></thead>
                <tbody>
                  {r.ingredients.map(ing => (
                    <tr key={ing.id}>
                      <td>{ing.product_name}</td>
                      <td>{ing.weight} {ing.unit || 'g'}</td>
                      <td>{ing.cost.toFixed(2)} zł</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
