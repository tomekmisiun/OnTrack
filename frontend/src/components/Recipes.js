import React, { useState, useEffect } from 'react';
import { recipes as api, products as productsApi } from '../api';

// ---- Parser ----

function parseWeight(text) {
  // matches: 234 g, 100 ml, 1 litr, 1 l, 200 g, 1.5 kg
  const regex = /(\d+(?:[.,]\d+)?)\s*(kg|litr(?:[óo]w|a)?|ml|g|l\b)/gi;
  let match;
  let first = null;
  while ((match = regex.exec(text)) !== null) {
    if (!first) first = match;
  }
  if (!first) return null;
  let val = parseFloat(first[1].replace(',', '.'));
  const unit = first[2].toLowerCase();
  if (unit === 'kg') val *= 1000;
  if (unit.startsWith('litr') || unit === 'l') val *= 1000;
  return { weight: Math.round(val), unit: (unit === 'ml' || unit.startsWith('litr') || unit === 'l') ? 'ml' : 'g', matchIndex: first.index };
}

function extractIngredientName(raw, weightIndex) {
  let before = raw.substring(0, weightIndex).trim();
  // Remove trailing description after last " - "
  const dashIdx = before.lastIndexOf(' - ');
  if (dashIdx > 0) before = before.substring(0, dashIdx).trim();
  return before.trim();
}

function parseRecipeText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  const name = lines[0].replace(/^#+\s*/, '').trim();
  const ingredients = [];

  for (const line of lines.slice(1)) {
    if (!line.match(/^[-•*]/)) continue;
    if (line.includes('http')) continue;

    const content = line.replace(/^[-•*]\s*/, '').trim();
    const parsed = parseWeight(content);
    if (!parsed) continue;

    const ingName = extractIngredientName(content, parsed.matchIndex);
    if (!ingName) continue;

    ingredients.push({ rawName: ingName, weight: parsed.weight, unit: parsed.unit, product_id: null });
  }

  return { name, ingredients };
}

function matchProducts(ingredients, products) {
  return ingredients.map(ing => {
    const lower = ing.rawName.toLowerCase();
    const match = products.find(p =>
      lower.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(lower.split(' ')[0])
    );
    return { ...ing, product_id: match ? match.id : null };
  });
}

// ---- Components ----

function TabButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 20px',
        border: 'none',
        borderBottom: active ? '2px solid #667eea' : '2px solid transparent',
        background: 'none',
        cursor: 'pointer',
        fontWeight: active ? 700 : 400,
        color: active ? '#667eea' : '#999',
        fontSize: 14,
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}

// ---- Main Component ----

export default function Recipes() {
  const [recipeList, setRecipeList] = useState([]);
  const [productList, setProductList] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('manual'); // 'manual' | 'paste'

  // Manual form
  const [form, setForm] = useState({ name: '', ingredients: [] });
  const [ingredient, setIngredient] = useState({ product_id: '', weight: '' });

  // Paste form
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState(null); // { name, ingredients[] }

  useEffect(() => {
    loadRecipes();
    loadProducts();
  }, []);

  const loadRecipes = async () => {
    try { setRecipeList((await api.getAll()).data); }
    catch { setError('Błąd ładowania przepisów'); }
  };

  const loadProducts = async () => {
    try { setProductList((await productsApi.getAll()).data); }
    catch { setError('Błąd ładowania produktów'); }
  };

  // --- Manual tab ---

  const addIngredient = () => {
    if (!ingredient.product_id || !ingredient.weight) { setError('Wybierz produkt i podaj gramaturę'); return; }
    const product = productList.find(p => p.id === parseInt(ingredient.product_id));
    setForm({ ...form, ingredients: [...form.ingredients, { product_id: parseInt(ingredient.product_id), product_name: product.name, weight: parseFloat(ingredient.weight) }] });
    setIngredient({ product_id: '', weight: '' });
    setError('');
  };

  const handleManualSubmit = async () => {
    if (!form.name) { setError('Podaj nazwę przepisu'); return; }
    if (!form.ingredients.length) { setError('Dodaj przynajmniej jeden składnik'); return; }
    try {
      await api.create({ name: form.name, ingredients: form.ingredients.map(i => ({ product_id: i.product_id, weight: i.weight })) });
      setForm({ name: '', ingredients: [] });
      setError('');
      loadRecipes();
    } catch (e) { setError(e.response?.data?.error || 'Błąd dodawania przepisu'); }
  };

  // --- Paste tab ---

  const handleParse = () => {
    setError('');
    const result = parseRecipeText(pasteText);
    if (!result || !result.ingredients.length) { setError('Nie udało się wyłapać składników — sprawdź format tekstu'); return; }
    result.ingredients = matchProducts(result.ingredients, productList);
    setParsed(result);
  };

  const updateParsedIngredient = (i, field, val) => {
    const updated = [...parsed.ingredients];
    updated[i] = { ...updated[i], [field]: val };
    setParsed({ ...parsed, ingredients: updated });
  };

  const removeParsedIngredient = (i) => {
    setParsed({ ...parsed, ingredients: parsed.ingredients.filter((_, idx) => idx !== i) });
  };

  const handlePasteSubmit = async () => {
    if (!parsed?.name) { setError('Brak nazwy przepisu'); return; }
    const valid = parsed.ingredients.filter(i => i.product_id && i.weight > 0);
    if (!valid.length) { setError('Żaden składnik nie ma dopasowanego produktu'); return; }
    try {
      await api.create({ name: parsed.name, ingredients: valid.map(i => ({ product_id: parseInt(i.product_id), weight: i.weight })) });
      setParsed(null);
      setPasteText('');
      setError('');
      loadRecipes();
    } catch (e) { setError(e.response?.data?.error || 'Błąd dodawania przepisu'); }
  };

  // --- Render ---

  return (
    <div>
      <div className="card">
        <h2>Dodaj przepis</h2>

        <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', marginBottom: 20 }}>
          <TabButton label="Ręcznie" active={tab === 'manual'} onClick={() => { setTab('manual'); setError(''); }} />
          <TabButton label="Wklej tekst" active={tab === 'paste'} onClick={() => { setTab('paste'); setError(''); }} />
        </div>

        {error && <p style={{ color: '#c00', marginBottom: 12, fontSize: 13 }}>{error}</p>}

        {/* ---- Manual tab ---- */}
        {tab === 'manual' && (
          <div>
            <div className="form-row">
              <input placeholder="Nazwa przepisu" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-row">
              <select value={ingredient.product_id} onChange={e => setIngredient({ ...ingredient, product_id: e.target.value })}>
                <option value="">Wybierz produkt</option>
                {productList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input placeholder="Gramatura (g)" type="number" value={ingredient.weight} onChange={e => setIngredient({ ...ingredient, weight: e.target.value })} />
              <button className="btn btn-success" onClick={addIngredient}>+ Składnik</button>
            </div>
            {form.ingredients.length > 0 && (
              <table style={{ marginBottom: 16 }}>
                <thead><tr><th>Produkt</th><th>Gramatura</th><th></th></tr></thead>
                <tbody>
                  {form.ingredients.map((ing, i) => (
                    <tr key={i}>
                      <td>{ing.product_name}</td>
                      <td>{ing.weight}g</td>
                      <td><button className="btn btn-danger" onClick={() => setForm({ ...form, ingredients: form.ingredients.filter((_, j) => j !== i) })}>Usuń</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button className="btn btn-primary" onClick={handleManualSubmit}>Zapisz przepis</button>
          </div>
        )}

        {/* ---- Paste tab ---- */}
        {tab === 'paste' && (
          <div>
            {!parsed ? (
              <div>
                <textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder={`Wklej tekst przepisu, np.:\n\nOwsianka\n- płatki owsiane 50 g\n- mleko 200 ml\n- banan 120 g`}
                  style={{
                    width: '100%',
                    minHeight: 220,
                    padding: 12,
                    border: '2px solid #e0e0e0',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontSize: 13,
                    lineHeight: 1.6,
                    resize: 'vertical',
                    outline: 'none',
                    marginBottom: 12,
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.style.borderColor = '#667eea'}
                  onBlur={e => e.target.style.borderColor = '#e0e0e0'}
                />
                <button className="btn btn-primary" onClick={handleParse} disabled={!pasteText.trim()}>
                  Parsuj przepis
                </button>
              </div>
            ) : (
              <div>
                {/* Recipe name */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Nazwa przepisu</label>
                  <input value={parsed.name} onChange={e => setParsed({ ...parsed, name: e.target.value })} style={{ width: '100%' }} />
                </div>

                {/* Parsed ingredients */}
                <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 8 }}>
                  Składniki — dopasuj produkt z bazy ({parsed.ingredients.filter(i => i.product_id).length}/{parsed.ingredients.length} dopasowanych)
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {parsed.ingredients.map((ing, i) => (
                    <div key={i} style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 90px 1fr 36px',
                      gap: 8,
                      alignItems: 'center',
                      padding: '8px 10px',
                      background: ing.product_id ? '#f6fff6' : '#fff9f0',
                      border: `1px solid ${ing.product_id ? '#c3e6cb' : '#ffd9a0'}`,
                      borderRadius: 8,
                    }}>
                      <div style={{ fontSize: 13, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ing.rawName}>
                        {ing.rawName}
                      </div>
                      <input
                        type="number"
                        value={ing.weight}
                        onChange={e => updateParsedIngredient(i, 'weight', parseFloat(e.target.value))}
                        style={{ padding: '6px 8px', fontSize: 13 }}
                      />
                      <select
                        value={ing.product_id || ''}
                        onChange={e => updateParsedIngredient(i, 'product_id', e.target.value || null)}
                        style={{ padding: '6px 8px', fontSize: 13 }}
                      >
                        <option value="">— brak dopasowania —</option>
                        {productList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <button
                        onClick={() => removeParsedIngredient(i)}
                        style={{ background: '#ff4757', border: 'none', color: 'white', borderRadius: 6, cursor: 'pointer', fontSize: 14, height: 34 }}
                      >✕</button>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary" onClick={handlePasteSubmit}>Zapisz przepis</button>
                  <button className="btn" style={{ background: '#eee', color: '#555' }} onClick={() => { setParsed(null); setError(''); }}>
                    ← Wróć
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recipe list */}
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
                <button className="btn btn-danger" onClick={async () => { if (window.confirm('Usunąć przepis?')) { await api.delete(r.id); loadRecipes(); } }}>
                  Usuń
                </button>
              </div>
            </div>
            {expanded === r.id && (
              <table style={{ marginTop: 12 }}>
                <thead><tr><th>Produkt</th><th>Gramatura</th><th>Koszt</th></tr></thead>
                <tbody>
                  {r.ingredients.map(ing => (
                    <tr key={ing.id}>
                      <td>{ing.product_name}</td>
                      <td>{ing.weight}g</td>
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
