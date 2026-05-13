import React, { useState, useEffect } from 'react';
import { recipes as api, products as productsApi } from '../api';

// ---- Parser ----

const POLISH_UNITS = [
  { re: /szklank[iaę]|szklanek/i,   g: 250 },
  { re: /łyżk[iaę]|łyżek(?!czk)/i, g: 15  },
  { re: /łyżeczk[iaę]|łyżeczek/i,  g: 5   },
  { re: /szczyp[tę]|szczypty/i,     g: 1   },
  { re: /garśc[i]?|garść/i,         g: 30  },
];

const PIECE_WORDS = /jajk[ao]|jajek|jaj(?=\s)|sztuk[ia]?|szt\.?/i;

function parseWeight(text) {
  // 1. Standardowe jednostki wagowe
  const stdRe = /(\d+(?:[.,]\d+)?)\s*(kg|litr(?:[óo]w|a)?|ml|g|l\b)/gi;
  let first = null, m;
  while ((m = stdRe.exec(text)) !== null) { if (!first) first = m; }
  if (first) {
    let val = parseFloat(first[1].replace(',', '.'));
    const unit = first[2].toLowerCase();
    if (unit === 'kg') val *= 1000;
    if (unit.startsWith('litr') || unit === 'l') val *= 1000;
    return { weight: Math.round(val), unit: (unit === 'ml' || unit.startsWith('litr') || unit === 'l') ? 'ml' : 'g', matchIndex: first.index };
  }

  // 2. Polskie jednostki kulinarne (łyżeczka, łyżka, szklanka, szczypta…)
  for (const { re, g } of POLISH_UNITS) {
    const unitM = re.exec(text);
    if (unitM) {
      const beforeUnit = text.slice(0, unitM.index);
      const numM = /(\d+(?:[.,]\d+)?)\s*$/.exec(beforeUnit);
      const count = numM ? parseFloat(numM[1].replace(',', '.')) : 1;
      return { weight: Math.round(count * g), unit: 'g', matchIndex: numM ? numM.index : unitM.index };
    }
  }

  // 3. Sztuki — jajko, szt itp.
  const pieceM = PIECE_WORDS.exec(text);
  if (pieceM) {
    const beforePiece = text.slice(0, pieceM.index);
    const numM = /(\d+)/.exec(beforePiece);
    const count = numM ? parseInt(numM[1]) : 1;
    // forcedName: użyj samego słowa "jajko" zamiast wszystkiego przed nim
    return { weight: count, unit: 'szt', matchIndex: pieceM.index, forcedName: pieceM[0].toLowerCase() };
  }

  return null;
}

function extractIngredientName(raw, weightIndex) {
  let before = raw.substring(0, weightIndex).trim();
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
    if (line.includes('http')) continue;
    // Usuń opcjonalny prefiks - lub •
    const content = line.replace(/^[-•*]\s*/, '').trim();
    const parsed = parseWeight(content);
    if (!parsed) continue; // linia bez ilości = nagłówek sekcji, pomijamy
    const ingName = parsed.forcedName || extractIngredientName(content, parsed.matchIndex);
    if (!ingName) continue;
    ingredients.push({ rawName: ingName, weight: parsed.weight, unit: parsed.unit, product_id: null });
  }
  return { name, ingredients };
}

function matchProducts(ingredients, products) {
  return ingredients.map(ing => {
    const lower = ing.rawName.toLowerCase();
    const firstWord = lower.split(' ')[0];
    const validFirstWord = firstWord.length >= 3 && !/^\d/.test(firstWord);
    const match = products.find(p => {
      const pName = p.name.toLowerCase();
      return lower.includes(pName) || (validFirstWord && pName.includes(firstWord));
    });
    return { ...ing, product_id: match ? match.id : null };
  });
}

// ---- Main Component ----

export default function Recipes() {
  const [recipeList, setRecipeList] = useState([]);
  const [productList, setProductList] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState(null);

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

  const handleParse = () => {
    setError('');
    const result = parseRecipeText(pasteText);
    if (!result || !result.ingredients.length) {
      setError('Nie udało się wyłapać składników — sprawdź format tekstu');
      return;
    }
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
                  <div style={{ fontWeight: 600, marginBottom: 4, color: '#444' }}>Format tekstu:</div>
                  <ol style={{ margin: 0, paddingLeft: 18, color: '#555' }}>
                    <li><b>Pierwsza linia</b> — nazwa przepisu</li>
                    <li>Każdy składnik w osobnej linii</li>
                    <li>Podaj <b>nazwę składnika</b> i <b>ilość z jednostką</b> (g, ml, kg, l)</li>
                    <li>Możesz wkleić tekst prosto ze strony z przepisem</li>
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
                  <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>
                    System automatycznie dopasuje składniki do Twoich produktów.
                  </div>
                </div>
              </div>
            </div>

            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={`Wklej lub wpisz przepis...\n\nNazwa przepisu\nskładnik 1  100 g\nskładnik 2  200 ml`}
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
            <button className="btn btn-primary" onClick={handleParse} disabled={!pasteText.trim()}>
              Parsuj przepis →
            </button>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Nazwa przepisu</label>
              <input value={parsed.name} onChange={e => setParsed({ ...parsed, name: e.target.value })} style={{ width: '100%' }} />
            </div>

            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 8 }}>
              Składniki — dopasuj produkt z bazy ({parsed.ingredients.filter(i => i.product_id).length}/{parsed.ingredients.length} dopasowanych)
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {parsed.ingredients.map((ing, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1fr 90px 1fr 36px',
                  gap: 8, alignItems: 'center', padding: '8px 10px',
                  background: ing.product_id ? '#f6fff6' : '#fff9f0',
                  border: `1px solid ${ing.product_id ? '#c3e6cb' : '#ffd9a0'}`,
                  borderRadius: 8,
                }}>
                  <div style={{ fontSize: 13, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ing.rawName}>
                    {ing.rawName}
                  </div>
                  <input type="number" value={ing.weight}
                    onChange={e => updateParsedIngredient(i, 'weight', parseFloat(e.target.value))}
                    style={{ padding: '6px 8px', fontSize: 13 }} />
                  <select value={ing.product_id || ''} onChange={e => updateParsedIngredient(i, 'product_id', e.target.value || null)}
                    style={{ padding: '6px 8px', fontSize: 13 }}>
                    <option value="">— brak dopasowania —</option>
                    {productList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button onClick={() => removeParsedIngredient(i)}
                    style={{ background: '#ff4757', border: 'none', color: 'white', borderRadius: 6, cursor: 'pointer', fontSize: 14, height: 34 }}>✕</button>
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
                      <td>{ing.weight}{ing.unit || 'g'}</td>
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
