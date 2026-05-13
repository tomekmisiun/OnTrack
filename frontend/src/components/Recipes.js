import React, { useState, useEffect } from 'react';
import { recipes as api, products as productsApi } from '../api';

// ---- Parser ----

const POLISH_UNITS = [
  { re: /szklank[iaę]|szklanek/i,       g: 250 },
  { re: /łyżk[iaę]|łyżek(?!czk)/i,     g: 15  },
  { re: /łyżeczk[iaę]|łyżeczek/i,      g: 5   },
  { re: /szczypt[aę]|szczypty/i,        g: 1   },
  { re: /garśc[i]?|garść/i,            g: 30  },
  { re: /pęczk[iaó]?|pęczków/i,        g: 50  },
];

const PIECE_WORDS = /jajk[ao]|jajek|jaja?(?=\s)|jaj\b|sztuk[ia]?|szt\.?/i;

// Ułamki słowne
const FRACTION_WORDS = { 'pół': 0.5, 'ćwierć': 0.25, 'trzy czwarte': 0.75 };

function parseNum(s) {
  if (!s) return null;
  s = s.trim();
  // ułamki słowne
  for (const [word, val] of Object.entries(FRACTION_WORDS)) {
    if (s.toLowerCase().startsWith(word)) return val;
  }
  // ułamki liczbowe 1/4, 1/2, 3/4
  const fracM = /^(\d+)\s*\/\s*(\d+)/.exec(s);
  if (fracM) return parseInt(fracM[1]) / parseInt(fracM[2]);
  return parseFloat(s.replace(',', '.')) || null;
}

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
    return { weight: Math.round(val), unit: (unit === 'ml' || unit.startsWith('litr') || unit === 'l') ? 'ml' : 'g', matchIndex: first.index, matchEnd: first.index + first[0].length };
  }

  // 2. Polskie jednostki kulinarne
  for (const { re, g } of POLISH_UNITS) {
    const unitM = re.exec(text);
    if (unitM) {
      const beforeUnit = text.slice(0, unitM.index).trim();
      // pół łyżeczki → obsługa ułamka słownego
      const fracM = /(pół|ćwierć|\d+(?:[.,]\d+)?|\d+\/\d+)\s*$/.exec(beforeUnit);
      const count = fracM ? (parseNum(fracM[1]) ?? 1) : 1;
      const nameBeforeUnit = beforeUnit.replace(/(pół|ćwierć|\d+(?:[.,]\d+)?|\d+\/\d+)\s*$/, '').trim();
      const matchEnd = unitM.index + unitM[0].length;
      const afterUnit = text.slice(matchEnd).trim().split(/\s*[,(-]/)[0].trim();
      const forcedName = nameBeforeUnit.length < 2 ? afterUnit : undefined;
      return { weight: Math.round(count * g), unit: 'g', matchIndex: fracM ? unitM.index - fracM[0].length : unitM.index, matchEnd, forcedName };
    }
  }

  // 3. Sztuki — jajko, jaja, szt itp.
  const pieceM = PIECE_WORDS.exec(text);
  if (pieceM) {
    const beforePiece = text.slice(0, pieceM.index);
    const numM = /(\d+)/.exec(beforePiece);
    const count = numM ? parseInt(numM[1]) : 1;
    return { weight: count, unit: 'szt', matchIndex: pieceM.index, matchEnd: pieceM.index + pieceM[0].length, forcedName: pieceM[0].toLowerCase() };
  }

  // 4. Sama liczba na początku (np. "3 marchewki") — traktuj jako sztuki
  const bareM = /^(\d+)\s+/.exec(text);
  if (bareM) {
    const count = parseInt(bareM[1]);
    return { weight: count, unit: 'szt', matchIndex: 0, matchEnd: bareM[0].length, forcedName: null };
  }

  return null;
}

const JUNK_PREFIX = /^[\d/.,\s]*(po\s+)?(pół|ćwierć|płask\w*|duż\w*|mał\w*|śwież\w*|ugotown\w*|młod\w*|klarowan\w*|słodk\w*|ostr\w*)?\s*/i;
const JUNK_SUFFIX = /\s*(duże?|małe?|duży|mały|świeże?|ugotowane?|na\s+twardo|można\s+pominąć|klarowanego?|i\s+\w.*)$/i;
// Słowa-jednostki do usunięcia z nazwy
const UNIT_WORDS = /\b(szklank\w+|łyżk\w+|łyżeczk\w+|pęczk\w+|garśc\w*)\b\s*/gi;

function extractName(content, parsed) {
  if (parsed.forcedName) return parsed.forcedName;
  const { matchIndex, matchEnd } = parsed;

  // Tekst przed ilością
  let before = content.substring(0, matchIndex).trim();
  const dashIdx = before.lastIndexOf(' - ');
  if (dashIdx > 0) before = before.substring(0, dashIdx).trim();
  before = before.replace(JUNK_PREFIX, '').replace(UNIT_WORDS, '').replace(JUNK_SUFFIX, '').trim();
  if (before.length >= 3) return before;

  // Nic przed — bierz zza ilości, zatrzymaj się na " i " (spójnik)
  const after = content.substring(matchEnd || matchIndex).trim()
    .replace(/\s*[-,(].*$/, '')
    .replace(/\s+i\s+.*$/i, '')   // zatrzymaj na spójniku "i"
    .replace(JUNK_PREFIX, '')
    .replace(UNIT_WORDS, '')
    .replace(JUNK_SUFFIX, '')
    .trim();
  return after;
}

function parseSegments(content) {
  // Usuwa prefix "słowo:" (np. "przyprawy:")
  const clean = content.replace(/^[^:]+:\s*/, '').trim();
  const results = [];

  // Parsuj główny segment
  const parsed = parseWeight(clean);
  if (!parsed) return results;

  const ingName = extractName(clean, parsed);
  if (ingName && ingName.length >= 2) {
    results.push({ rawName: ingName, weight: parsed.weight, unit: parsed.unit });
  }

  // Spróbuj wyłapać dodatkowy składnik po " i " (np. "soli i pieprzu")
  const afterUnit = clean.substring(parsed.matchEnd || parsed.matchIndex).trim();
  const andMatch = /\s+i\s+(\w+)/i.exec(afterUnit);
  if (andMatch) {
    const extra = andMatch[1];
    if (extra.length >= 3) {
      results.push({ rawName: extra, weight: parsed.weight, unit: parsed.unit });
    }
  }

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

    // Podziel po przecinkach
    const segments = content.includes(',') ? content.split(/,\s+/) : [content];

    for (const seg of segments) {
      for (const result of parseSegments(seg)) {
        ingredients.push({ ...result, product_id: null });
      }
    }
  }
  return { name, ingredients };
}

// Normalizacja polskich znaków do ASCII (dla porównań)
function norm(s) {
  return s.toLowerCase()
    .replace(/ą/g,'a').replace(/ę/g,'e').replace(/ó/g,'o')
    .replace(/ś/g,'s').replace(/ź/g,'z').replace(/ż/g,'z')
    .replace(/ć/g,'c').replace(/ł/g,'l').replace(/ń/g,'n');
}

const STOP_WORDS = new Set(['oraz','lub','albo','duze','male','duzy','maly','okolo','bardzo','swieze','ugotowane','posiekane','uniwersalnej','naturalna','naturalny','pelne','pełne']);

// Czy dwa słowa są podobne (obsługuje polskie odmiany przez prefix)
function wordsSimilar(a, b) {
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const minLen = Math.min(a.length, b.length);
  if (minLen < 3) return a === b;
  let p = 0;
  while (p < minLen && a[p] === b[p]) p++;
  return p >= Math.max(3, Math.ceil(minLen * 0.6));
}

function matchProducts(ingredients, products) {
  return ingredients.map(ing => {
    const rawNorm = norm(ing.rawName);

    // Wyodrębnij sensowne słowa (≥3 znaki, nie cyfry, nie stop words)
    const ingWords = rawNorm.split(/[\s,.()-]+/)
      .filter(w => w.length >= 3 && !/^\d/.test(w) && !STOP_WORDS.has(w)); // eslint-disable-line no-useless-escape

    if (!ingWords.length) return { ...ing, product_id: null };

    let bestMatch = null;
    let bestScore = 0;

    for (const p of products) {
      const prodWords = norm(p.name).split(/\s+/).filter(w => w.length >= 2);
      let score = 0;
      for (const iw of ingWords) {
        for (const pw of prodWords) {
          if (wordsSimilar(iw, pw)) score += Math.min(iw.length, pw.length);
        }
      }
      if (score > bestScore) { bestScore = score; bestMatch = p; }
    }

    return { ...ing, product_id: bestScore >= 3 ? bestMatch.id : null };
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
