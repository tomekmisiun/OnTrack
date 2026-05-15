import React, { useState, useEffect } from 'react';
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
    return { weight: Math.round(val), unit: (unit === 'ml' || unit.startsWith('litr') || unit === 'l') ? 'ml' : 'g', matchIndex: first.index, matchEnd: first.index + first[0].length };
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
      return { weight: Math.round(count * g), unit: 'g', matchIndex: fracM ? unitM.index - fracM[0].length : unitM.index, matchEnd, forcedName };
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
  const { showError } = useToast();
  const [recipeList, setRecipeList] = useState([]);
  const [productList, setProductList] = useState([]);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const [editingNotes, setEditingNotes] = useState(null);

  useEffect(() => { loadRecipes(); loadProducts(); }, []);

  const loadRecipes = async () => {
    try { setRecipeList((await api.getAll()).data); } catch { showError(t('err_load_recipes_list')); }
  };
  const loadProducts = async () => {
    try { setProductList((await productsApi.getAll()).data); } catch {}
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
      await api.create({
        name: parsed.name,
        notes: parsed.sourceText || null,
        ingredients: valid.map(i => ({ product_id: parseInt(i.product_id), weight: i.weight })),
      });
      setParsed(null); setPasteText('');  loadRecipes();
    } catch (e) { showError(e.response?.data?.error || t('err_save_recipe')); }
  };

  const handleSaveNotes = async (id) => {
    try {
      await api.updateNotes(id, editingNotes.text);
      setEditingNotes(null); loadRecipes();
    } catch { showError(t('err_save_notes')); }
  };

  return (
    <div>
      <div className="card">
        <h2>{t('add_recipe_title')}</h2>

        {!parsed ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'stretch' }}>
            {/* Lewa: instrukcja */}
            <div style={{ background: '#1c3534', border: '1px solid #374151', borderRadius: 8, padding: '14px 16px', fontSize: 13, lineHeight: 1.7 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0d9488', marginBottom: 10 }}>{t('how_to_recipe')}</div>

              <div style={{ fontWeight: 600, marginBottom: 4, color: '#e2e8f0' }}>{t('example')}</div>
              <pre style={{ margin: '0 0 14px', background: '#111827', border: '1px solid #374151', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#e2e8f0', lineHeight: 1.8 }}>
{`Owsianka
płatki owsiane 50 g
mleko 200 ml
banan 120 g
łyżka masła orzechowego`}
              </pre>

              <div style={{ fontWeight: 600, marginBottom: 4, color: '#e2e8f0' }}>{t('format_title')}</div>
              <ol style={{ margin: '0 0 12px', paddingLeft: 18, color: '#9ca3af' }}>
                <li><b>{t('fmt_1')}</b></li>
                <li>{t('fmt_2')}</li>
                <li>{t('fmt_3')}</li>
                <li>{t('fmt_4')}</li>
              </ol>

              <div style={{ padding: '8px 12px', background: '#111827', border: '1px solid #374151', borderRadius: 6, fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>
                {t('ai_tip')} <span style={{ color: '#ca8a04' }}>{t('daily_limit')}</span><br/>
                {t('regex_tip')}
              </div>

              <div style={{ fontSize: 17, fontWeight: 600, color: '#f1f5f9', marginBottom: 6 }}>Szukasz inspiracji?</div>
              <a href="https://aniagotuje.pl/" target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#2dd4bf', fontWeight: 600, textDecoration: 'none', background: '#111827', padding: '5px 10px', borderRadius: 6, border: '1px solid #374151' }}>
                <img src="https://www.google.com/s2/favicons?domain=aniagotuje.pl&sz=16" alt="" style={{ width: 16, height: 16, borderRadius: 3 }} />
                aniagotuje.pl →
              </a>
              {remaining !== null && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#ca8a04' }}>
                  {t('remaining_ai')(remaining)}
                </div>
              )}
            </div>

            {/* Prawa: textarea + przyciski */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <textarea
                value={pasteText} onChange={e => setPasteText(e.target.value)}
                placeholder={t('recipe_ph')}
                style={{ width: '100%', flex: 1, padding: 12, border: '1.5px solid #374151', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, resize: 'none', outline: 'none', boxSizing: 'border-box', background: '#111827', color: '#e2e8f0' }}
                onFocus={e => e.target.style.borderColor = '#0d9488'}
                onBlur={e => e.target.style.borderColor = '#374151'}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" onClick={handleParseAI} disabled={!pasteText.trim() || parsing === 'ai'} style={{ flex: 1 }}>
                  {parsing === 'ai' ? t('parsing_ai') : t('parse_ai_btn')}
                </button>
                <button className="btn" onClick={handleParseRegex} disabled={!pasteText.trim() || parsing === 'ai'}
                  style={{ flex: 1, background: '#1c3534', color: '#0d9488', border: '1px solid #374151', fontWeight: 600 }}>
                  {t('parse_regex_btn')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>{t('recipe_name_lbl')}</label>
              <input value={parsed.name} onChange={e => setParsed({ ...parsed, name: e.target.value })} style={{ width: '100%' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr 36px', gap: 8, padding: '0 10px', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t('ingredients_lbl')(parsed.ingredients.filter(i => i.product_id).length, parsed.ingredients.length)}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.5px' }}>g / ml / szt</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Dopasowany produkt</span>
              <span></span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {parsed.ingredients.map((ing, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr 36px', gap: 8, alignItems: 'center', padding: '8px 10px', background: ing.product_id ? '#162616' : '#2d1f0f', border: `1px solid ${ing.product_id ? '#1a4a1a' : '#4a3010'}`, borderRadius: 8 }}>
                  <div style={{ fontSize: 13, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ing.rawName}>{ing.rawName}</div>
                  <input type="number" value={ing.weight} onChange={e => updateIngredient(i, 'weight', parseFloat(e.target.value))} style={{ padding: '6px 8px', fontSize: 13 }} />
                  <select value={ing.product_id || ''} onChange={e => updateIngredient(i, 'product_id', e.target.value || null)} style={{ padding: '6px 8px', fontSize: 13 }}>
                    <option value="">{t('no_match_opt')}</option>
                    {productList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button onClick={() => removeIngredient(i)} style={{ background: '#ef4444', border: 'none', color: '#1f2937', borderRadius: 6, cursor: 'pointer', fontSize: 14, height: 34 }}>✕</button>
                </div>
              ))}
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

      <div className="card">
        <h2>{t('recipe_list_title')} <span style={{fontSize:12,fontWeight:400,color:'#6b7280'}}>- edytuj swoje przepisy</span></h2>
        <div style={{ margin: '10px 0' }}>
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
        {recipeList.length > 0 && search.trim() && !recipeList.some(r => r.name.toLowerCase().includes(search.trim().toLowerCase())) && (
          <p style={{ textAlign: 'center', color: '#6b7280', fontStyle: 'italic' }}>Nie znaleziono przepisu „{search}"</p>
        )}
        {recipeList.filter(r => !search.trim() || r.name.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0)).map(r => (
          <div key={r.id} style={{ borderBottom: '1px solid #374151', padding: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={async () => { await api.toggleFavorite(r.id); loadRecipes(); }}
                  title={r.is_favorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 0', color: r.is_favorite ? '#facc15' : 'transparent', WebkitTextStroke: r.is_favorite ? '0' : '1.5px #6b7280', flexShrink: 0 }}>
                  ★
                </button>
                <strong>{r.name}</strong>
                <span style={{ color: '#0d9488' }}>{r.total_cost.toFixed(2)} zł</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn btn-primary" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  {expanded === r.id ? t('hide_ingredients') : t('show_ingredients')}
                </button>
                <button className="btn btn-danger" onClick={async () => { if (window.confirm(t('confirm_del_recipe'))) { await api.delete(r.id); loadRecipes(); } }}>{t('delete')}</button>
              </div>
            </div>
            {expanded === r.id && (
              <div style={{ marginTop: 12 }}>
                <table style={{ marginBottom: r.notes || editingNotes?.id === r.id ? 16 : 0 }}>
                  <thead><tr><th>{t('col_product')}</th><th>{t('col_weight')}</th><th>{t('col_cost')}</th></tr></thead>
                  <tbody>
                    {r.ingredients.map(ing => (
                      <tr key={ing.id}><td>{ing.product_name}</td><td>{ing.weight} {ing.unit || 'g'}</td><td>{ing.cost.toFixed(2)} zł</td></tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ background: '#1c3534', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0d9488' }}>{t('info_section')}</span>
                    {editingNotes?.id !== r.id && (
                      <button onClick={() => setEditingNotes({ id: r.id, text: r.notes || '' })}
                        style={{ background: 'none', border: 'none', color: '#0d9488', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        {t('edit_notes')}
                      </button>
                    )}
                  </div>

                  {editingNotes?.id === r.id ? (
                    <div>
                      <textarea
                        value={editingNotes.text}
                        onChange={e => setEditingNotes({ ...editingNotes, text: e.target.value })}
                        style={{ width: '100%', minHeight: 160, padding: 10, border: '1px solid #99f6e4', borderRadius: 6, fontFamily: 'inherit', fontSize: 12, lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary" style={{ padding: '5px 14px', fontSize: 12 }} onClick={() => handleSaveNotes(r.id)}>{t('save_notes')}</button>
                        <button className="btn" style={{ padding: '5px 14px', fontSize: 12, background: '#374151', color: '#9ca3af' }} onClick={() => setEditingNotes(null)}>{t('cancel')}</button>
                      </div>
                    </div>
                  ) : r.notes ? (
                    <pre style={{ margin: 0, fontSize: 12, color: '#e2e8f0', lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {r.notes}
                    </pre>
                  ) : (
                    <p style={{ margin: 0, fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>{t('no_notes')}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
