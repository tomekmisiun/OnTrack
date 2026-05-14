import React, { useState, useEffect } from 'react';
import { mealPlan as api, recipes as recipesApi, products as productsApi } from '../api';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';

// ─── Date helpers ─────────────────────────────────────────────────────────────
function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function toEU(s) {
  const [y, m, d] = s.split('-');
  return `${d}.${m}.${y}`;
}
function getCurrentWeek() {
  const today = new Date(); today.setHours(0,0,0,0);
  const dow = (today.getDay() + 6) % 7;
  const monday = new Date(today); monday.setDate(today.getDate() - dow);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  return { start: dateToStr(monday), end: dateToStr(sunday) };
}
function getCurrentMonth() {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const last  = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { start: dateToStr(first), end: dateToStr(last) };
}

// ─── Reusable product table ───────────────────────────────────────────────────
function ProductTable({ items }) {
  const [localItems, setLocalItems] = useState(items);
  const [editPkgId,    setEditPkgId]    = useState(null);
  const [editPkg,      setEditPkg]      = useState('');
  const [editSBW,      setEditSBW]      = useState(false);
  const [editPriceId,  setEditPriceId]  = useState(null);
  const [editPrice,    setEditPrice]    = useState('');

  useEffect(() => {
    setLocalItems(prev => {
      const byId = Object.fromEntries(prev.map(i => [i.product_id, i]));
      return items.map(item => ({
        ...item,
        stockMode: byId[item.product_id]?.stockMode || null,
        stockAmt:  byId[item.product_id]?.stockAmt  || '',
      }));
    });
  }, [items]);

  const updItem = (product_id, patch) =>
    setLocalItems(prev => prev.map(i => i.product_id === product_id ? { ...i, ...patch } : i));

  const getAdjustedCost = (item) => {
    if (item.stockMode === 'all') return 0;
    if (item.stockMode === 'part') {
      const stock = parseFloat(item.stockAmt) || 0;
      if (stock <= 0) return item.total_cost;
      const remaining = Math.max(0, item.total_weight - stock);
      if (remaining === 0) return 0;
      if (item.sold_by_weight) return remaining * item.price_per_package / item.package_weight;
      return Math.ceil(remaining / item.package_weight) * item.price_per_package;
    }
    return item.total_cost;
  };

  const recalcPkg = (item, newPkg, sbw) => {
    const pricePerUnit = item.unit === 'szt'
      ? item.price_per_package / item.package_weight
      : item.price_per_package * 100 / item.package_weight;
    const newPkgPrice = item.unit === 'szt' ? pricePerUnit * newPkg : pricePerUnit * newPkg / 100;
    const pkgsExact   = item.total_weight / newPkg;
    const pkgsRounded = sbw ? pkgsExact : Math.ceil(pkgsExact);
    return {
      ...item, package_weight: newPkg, sold_by_weight: sbw,
      price_per_package: newPkgPrice, packages_exact: pkgsExact,
      packages_rounded: pkgsRounded,
      actual_cost: pkgsExact * newPkgPrice,
      total_cost: pkgsRounded * newPkgPrice,
    };
  };

  const recalcPrice = (item, newPkgPrice) => {
    const pkgsRounded = item.sold_by_weight ? item.packages_exact : Math.ceil(item.packages_exact);
    return {
      ...item, price_per_package: newPkgPrice,
      actual_cost: item.packages_exact * newPkgPrice,
      total_cost: pkgsRounded * newPkgPrice,
    };
  };

  const handleSavePkg = async (item) => {
    const pkg = parseFloat(editPkg);
    if (!pkg || pkg <= 0) { setEditPkgId(null); return; }
    const updated = recalcPkg(item, pkg, editSBW);
    setLocalItems(prev => prev.map(i => i.product_id === item.product_id ? updated : i));
    setEditPkgId(null);
    try { await productsApi.update(item.product_id, { package_weight: pkg, sold_by_weight: editSBW }); } catch {}
  };

  const handleSavePrice = async (item) => {
    const newPkgPrice = parseFloat(editPrice);
    if (isNaN(newPkgPrice) || newPkgPrice < 0) { setEditPriceId(null); return; }
    const updated = recalcPrice(item, newPkgPrice);
    setLocalItems(prev => prev.map(i => i.product_id === item.product_id ? updated : i));
    setEditPriceId(null);
    const unitPrice = item.unit === 'szt'
      ? newPkgPrice / item.package_weight
      : newPkgPrice * 100 / item.package_weight;
    try { await productsApi.update(item.product_id, { price: parseFloat(unitPrice.toFixed(4)) }); } catch {}
  };

  const inp = { padding: '2px 6px', fontSize: 12, width: 68, border: '1px solid #374151', borderRadius: 4, background: '#111827', color: '#e2e8f0' };
  const btn = (bg, color) => ({ padding:'1px 6px', fontSize:11, background:bg, color, border:'none', borderRadius:3, cursor:'pointer' });
  const hintStyle = { fontSize: 9, fontWeight: 400, color: '#2dd4bf', display: 'block', marginTop: 1 };

  return (
    <table className="compact-table" style={{ marginTop: 4 }}>
      <thead>
        <tr>
          <th>Produkt</th>
          <th>Gram. użyta</th>
          <th><span>Pojemność opak.</span><span style={hintStyle}>✎ kliknij aby edytować</span></th>
          <th>Szt.</th>
          <th><span>Cena/opak.</span><span style={hintStyle}>✎ kliknij aby edytować</span></th>
          <th style={{ whiteSpace:'nowrap' }}>
            <span>W zapasie</span>
            <span style={{ fontSize:9, fontWeight:400, color:'#2dd4bf', display:'block', marginTop:1 }}>zmniejsza koszt zakupy</span>
          </th>
          <th>zakupy</th>
          <th>koszt</th>
        </tr>
      </thead>
      <tbody>
        {localItems.map((item, i) => (
          <tr key={i}>
            <td style={{ fontSize:13, color:'#e2e8f0' }}>{item.product_name}</td>
            <td style={{ fontSize:13, color: '#9ca3af' }}>{item.total_weight} {item.unit || 'g'}</td>

            {/* Pojemność opak — editable */}
            <td style={{ cursor: 'pointer' }} onClick={() => {
              if (editPkgId === item.product_id) return;
              setEditPkgId(item.product_id); setEditPkg(String(item.package_weight));
              setEditSBW(!!item.sold_by_weight); setEditPriceId(null);
            }}>
              {editPkgId === item.product_id ? (
                <div style={{ display:'flex', flexDirection:'column', gap:4 }} onClick={e => e.stopPropagation()}>
                  <div style={{ display:'flex', gap:3, alignItems:'center' }}>
                    <input type="number" min="0" value={editPkg} onChange={e => setEditPkg(e.target.value)}
                      className="no-spin" style={inp} autoFocus onKeyDown={e => { if (e.key==='Enter') handleSavePkg(item); if (e.key==='Escape') setEditPkgId(null); }} />
                    <span style={{ fontSize:11, color:'#6b7280' }}>{item.unit}</span>
                  </div>
                  <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, cursor:'pointer' }}>
                    <input type="checkbox" checked={editSBW} onChange={e => setEditSBW(e.target.checked)} />
                    Produkt sprzedawany na wagę
                  </label>
                  <div style={{ display:'flex', gap:3 }}>
                    <button style={btn('#0d9488','#1f2937')} onClick={() => handleSavePkg(item)}>✓ Zapisz</button>
                    <button style={btn('#374151','#9ca3af')} onClick={() => setEditPkgId(null)}>✗</button>
                  </div>
                </div>
              ) : (
                <span style={{ fontSize:13, color: '#9ca3af' }}>
                  {item.sold_by_weight ? 'Na wagę' : `${item.package_weight} ${item.unit || 'g'}`}
                </span>
              )}
            </td>

            {/* Szt */}
            <td>
              {item.sold_by_weight
                ? <span style={{ fontSize:13, color:'#9ca3af' }}>wagowo</span>
                : <span style={{ background:'#0d9488', color:'white', padding:'2px 8px', borderRadius:10, fontWeight:600, fontSize:13 }}>
                    {item.packages_rounded} szt.
                  </span>}
            </td>

            {/* Cena/opak — editable */}
            <td style={{ cursor: 'pointer' }} onClick={() => {
              if (editPriceId === item.product_id) return;
              setEditPriceId(item.product_id); setEditPrice(item.price_per_package.toFixed(2));
              setEditPkgId(null);
            }}>
              {editPriceId === item.product_id ? (
                <div style={{ display:'flex', gap:3, alignItems:'center' }} onClick={e => e.stopPropagation()}>
                  <input type="number" step="0.01" min="0" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                    className="no-spin" style={{ ...inp, width:72 }} autoFocus onKeyDown={e => { if (e.key==='Enter') handleSavePrice(item); if (e.key==='Escape') setEditPriceId(null); }} />
                  <span style={{ fontSize:11, color:'#6b7280' }}>zł</span>
                  <button style={btn('#0d9488','#1f2937')} onClick={() => handleSavePrice(item)}>✓</button>
                  <button style={btn('#374151','#9ca3af')} onClick={() => setEditPriceId(null)}>✗</button>
                </div>
              ) : (
                <span style={{ fontSize:13, color:'#9ca3af' }}>{item.price_per_package.toFixed(2)} zł</span>
              )}
            </td>

            {/* W zapasie */}
            <td>
              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                {/* Całość */}
                <button
                  onClick={() => updItem(item.product_id, { stockMode: item.stockMode === 'all' ? null : 'all', stockAmt: '' })}
                  style={{
                    padding:'4px 8px', fontSize:11, fontWeight:600, cursor:'pointer',
                    border:'1px solid #374151', borderRadius:5, transition:'all 0.15s',
                    background: item.stockMode === 'all' ? '#0d9488' : '#2d3748',
                    color: item.stockMode === 'all' ? 'white' : '#9ca3af',
                  }}>
                  Całość
                </button>
                {/* Część + input */}
                <button
                  onClick={() => updItem(item.product_id, { stockMode: item.stockMode === 'part' ? null : 'part', stockAmt: '' })}
                  style={{
                    padding:'4px 8px', fontSize:11, fontWeight:600, cursor:'pointer',
                    border:'1px solid #374151', borderRadius:5, transition:'all 0.15s',
                    background: item.stockMode === 'part' ? '#0d9488' : '#2d3748',
                    color: item.stockMode === 'part' ? 'white' : '#9ca3af',
                  }}>
                  Część
                </button>
                {item.stockMode === 'part' && (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:3, marginTop:2 }}>
                    <span style={{ fontSize:10, color:'#6b7280', whiteSpace:'nowrap' }}>Podaj ile</span>
                    <input type="number" min="0" step={item.unit === 'szt' ? 1 : 0.5}
                      value={item.stockAmt}
                      onChange={e => updItem(item.product_id, { stockAmt: e.target.value })}
                      className="no-spin"
                      style={{ padding:'2px 4px', fontSize:11, width:44, boxSizing:'border-box', border:'1px solid #374151', borderRadius:4, background:'#111827', color:'#e2e8f0' }}
                      placeholder="0" />
                    <span style={{ fontSize:10, color:'#6b7280' }}>{item.unit || 'g'}</span>
                  </div>
                )}
              </div>
            </td>

            {/* Koszt zakupy */}
            <td>
              {(() => {
                const adj = getAdjustedCost(item);
                const reduced = item.stockMode && adj < item.total_cost;
                return (
                  <div>
                    <span style={{ fontSize:13, color: item.stockMode ? '#22c55e' : '#9ca3af' }}>{adj.toFixed(2)} zł</span>
                    {reduced && (
                      <div style={{ fontSize:11, color:'#4b5563', textDecoration:'line-through' }}>{item.total_cost.toFixed(2)} zł</div>
                    )}
                  </div>
                );
              })()}
            </td>

            <td style={{ fontSize:13, color: '#9ca3af' }}>
              {item.actual_cost.toFixed(2)} zł
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Period card (week / month / custom) ──────────────────────────────────────
function PeriodCard({ title, range, summary, loading, error, onGoToTab }) {
  const { t } = useLanguage();
  const [productsOpen, setProductsOpen] = useState(false);

  const toggleStyle = {
    width:'100%', padding:'10px 20px', background:'none', border:'none',
    cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center',
    fontSize:13, fontWeight:600, color:'#0d9488',
  };

  return (
    <div className="card" style={{ padding:0, overflow:'hidden', marginBottom:16 }}>
      {/* Always-visible header: title + total — klik rozwija listę produktów */}
      <div
        onClick={() => setProductsOpen(o => !o)}
        style={{ padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}
      >
        <div>
          <h2 style={{ margin:0, fontSize:17 }}>{title}</h2>
          {range && (
            <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>
              {toEU(range.start)} - {toEU(range.end)}
            </div>
          )}
          <button
            onClick={e => { e.stopPropagation(); onGoToTab?.('calendar'); }}
            style={{ background:'none', border:'none', padding:0, cursor:'pointer', fontSize:11, color:'#2dd4bf', marginTop:3, display:'block', textAlign:'left' }}
          >
            przejdź do kalendarza →
          </button>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:11, color:'#6b7280', marginBottom:2 }}>{t('total_cost_lbl2')}</div>
          {loading ? (
            <div style={{ fontSize:20, color:'#374151', fontWeight:700 }}>…</div>
          ) : summary ? (
            <>
              <div style={{ fontSize:28, fontWeight:800, color:'#0d9488', lineHeight:1 }}>
                {summary.total_cost.toFixed(2)}<span style={{ fontSize:16, marginLeft:3 }}>zł</span>
              </div>
              {summary.items.length > 0 && (
                <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{summary.items.length} produktów</div>
              )}
            </>
          ) : (
            <div style={{ fontSize:13, color:'#4b5563' }}>-</div>
          )}
        </div>
      </div>

      {error && <div style={{ padding:'0 20px 12px', fontSize:13, color:'#c00' }}>{error}</div>}

      {/* Collapsible product list */}
      {!loading && summary && summary.items.length > 0 && (
        <div style={{ borderTop:'1px solid #374151' }}>
          <button onClick={() => setProductsOpen(o => !o)} style={toggleStyle}>
            <span>{productsOpen ? t('hide_product_list') : t('show_product_list')}</span>
            <span style={{ display:'flex', alignItems:'center', gap:4, fontWeight:400, fontSize:12 }}>
              {productsOpen ? 'Zwiń' : 'Rozwiń'}
              <span style={{ fontSize:16, transition:'transform 0.2s', transform: productsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
            </span>
          </button>
          {productsOpen && (
            <div style={{ padding:'0 16px 16px' }}>
              <ProductTable items={summary.items} />
            </div>
          )}
        </div>
      )}

      {!loading && summary && summary.items.length === 0 && (
        <div style={{ padding:'0 20px 16px', fontSize:13, color:'#4b5563', fontStyle:'italic' }}>
          {t('no_meals_period')}
        </div>
      )}
    </div>
  );
}

// ─── Main Summary component ───────────────────────────────────────────────────
function Summary({ onGoToTab }) {
  const { t } = useLanguage();
  const { showError } = useToast();

  const week  = getCurrentWeek();
  const month = getCurrentMonth();

  const [weekSummary,  setWeekSummary]  = useState(null);
  const [monthSummary, setMonthSummary] = useState(null);
  const [weekLoading,  setWeekLoading]  = useState(true);
  const [monthLoading, setMonthLoading] = useState(true);

  // Custom period
  const [customOpen,    setCustomOpen]    = useState(false);
  const [customRange,   setCustomRange]   = useState({ start:'', end:'' });
  const [customSummary, setCustomSummary] = useState(null);
  const [customLoading, setCustomLoading] = useState(false);

  // Templates
  const [templates] = useState(() => {
    try { return JSON.parse(localStorage.getItem('weekTemplates') || '[]'); } catch { return []; }
  });
  const [recipeList, setRecipeList] = useState([]);

  useEffect(() => {
    Promise.all([
      api.getSummary(week.start, week.end),
      api.getSummary(month.start, month.end),
      recipesApi.getAll(),
    ]).then(([wRes, mRes, rRes]) => {
      setWeekSummary(wRes.data);
      setMonthSummary(mRes.data);
      setRecipeList(rRes.data);
    }).catch(() => showError(t('err_load_summary')))
      .finally(() => { setWeekLoading(false); setMonthLoading(false); });
  }, []);

  const handleCustomLoad = async () => {
    if (!customRange.start || !customRange.end) { showError(t('err_select_range')); return; }
    if (customRange.start > customRange.end)    { showError(t('err_date_order'));   return; }
    setCustomLoading(true); 
    try {
      const res = await api.getSummary(customRange.start, customRange.end);
      setCustomSummary(res.data);
    } catch { showError(t('err_load_summary')); }
    finally { setCustomLoading(false); }
  };

  // Compute template cost/kcal from recipe data
  const tplData = templates.map(tpl => {
    let cost = 0, kcal = 0;
    tpl.meals.forEach(m => {
      const r = recipeList.find(r => r.id === m.recipe_id);
      if (r) { cost += r.total_cost || 0; kcal += r.total_kcal || 0; }
    });
    return { ...tpl, estimatedCost: cost, estimatedKcal: Math.round(kcal) };
  });

  const toggleStyle = {
    width:'100%', padding:'10px 20px', background:'none', border:'none',
    cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center',
    fontSize:13, fontWeight:600, color:'#0d9488',
  };

  return (
    <div>

      {/* ─── Current week ─── */}
      <PeriodCard
        title={t('this_week')}
        range={week}
        summary={weekSummary}
        loading={weekLoading}
        onGoToTab={onGoToTab}
      />

      {/* ─── Current month ─── */}
      <PeriodCard
        title={t('this_month')}
        range={month}
        summary={monthSummary}
        loading={monthLoading}
        onGoToTab={onGoToTab}
      />

      {/* ─── Custom period (collapsible) ─── */}
      <div className="card" style={{ padding:0, overflow:'hidden', marginBottom:16 }}>
        <div
          onClick={() => setCustomOpen(o => !o)}
          style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}
        >
          <div style={{ padding:'10px 20px', flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#0d9488' }}>{t('custom_period')}</div>
            <button
              onClick={e => { e.stopPropagation(); onGoToTab?.('calendar'); }}
              style={{ background:'none', border:'none', padding:0, cursor:'pointer', fontSize:11, color:'#2dd4bf', marginTop:2, display:'block', textAlign:'left' }}
            >
              przejdź do kalendarza →
            </button>
          </div>
          <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#0d9488', fontWeight:400, padding:'10px 20px' }}>
            {customOpen ? 'Zwiń' : 'Rozwiń'}
            <span style={{ fontSize:16, transition:'transform 0.2s', transform: customOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
          </span>
        </div>
        {customOpen && (
          <div style={{ padding:'0 20px 20px', borderTop:'1px solid #374151' }}>
            
            <div className="form-row" style={{ marginTop:12 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                <label style={{ fontSize:13, color:'#6b7280' }}>{t('date_from')}</label>
                <input type="date" value={customRange.start}
                  onChange={e => setCustomRange({ ...customRange, start: e.target.value })} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                <label style={{ fontSize:13, color:'#6b7280' }}>{t('date_to')}</label>
                <input type="date" value={customRange.end}
                  onChange={e => setCustomRange({ ...customRange, end: e.target.value })} />
              </div>
              <button className="btn btn-primary" onClick={handleCustomLoad}
                disabled={customLoading} style={{ alignSelf:'flex-end' }}>
                {customLoading ? t('generating') : t('generate')}
              </button>
            </div>

            {customSummary && (
              <>
                <div style={{
                  marginTop:16, padding:'14px 16px',
                  background:'#0d9488', color:'#1f2937', borderRadius:10,
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                }}>
                  <div>
                    <div style={{ opacity:0.8, fontSize:12 }}>{toEU(customRange.start)} - {toEU(customRange.end)}</div>
                    <div style={{ opacity:0.8, fontSize:12, marginTop:2 }}>{customSummary.items.length} produktów</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ opacity:0.8, fontSize:12 }}>{t('total_cost_lbl')}</div>
                    <div style={{ fontSize:28, fontWeight:800 }}>
                      {customSummary.total_cost.toFixed(2)}<span style={{ fontSize:16, marginLeft:3 }}>zł</span>
                    </div>
                  </div>
                </div>
                {customSummary.items.length > 0 && (
                  <div style={{ marginTop:12 }}>
                    <ProductTable items={customSummary.items} />
                  </div>
                )}
                {customSummary.items.length === 0 && (
                  <p style={{ color:'#4b5563', fontSize:13, marginTop:12, fontStyle:'italic' }}>{t('no_meals_period')}</p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── Templates summary ─── */}
      <div className="card" style={{ padding:0, overflow:'hidden', marginBottom:16 }}>
        <div style={{ padding:'16px 20px' }}>
          <h2 style={{ margin:0, fontSize:17, color:'#0d9488' }}>{t('week_templates_sum')}</h2>
          <button
            onClick={() => onGoToTab?.('recipes')}
            style={{ background:'none', border:'none', padding:0, cursor:'pointer', fontSize:11, color:'#2dd4bf', marginTop:3, display:'block' }}
          >
            przejdź do Przepisów →
          </button>
        </div>

        {templates.length === 0 ? (
          <div style={{ padding:'0 20px 16px', fontSize:13, color:'#4b5563', fontStyle:'italic', borderTop:'1px solid #374151' }}>
            {t('no_tpl_summary')}
          </div>
        ) : (
          <div style={{ borderTop:'1px solid #374151' }}>
            {tplData.map((tpl, i) => (
              <div key={i} style={{
                padding:'12px 20px',
                borderBottom: i < tplData.length-1 ? '1px solid #2d3748' : 'none',
                display:'flex', justifyContent:'space-between', alignItems:'center',
              }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:14 }}>{tpl.name}</div>
                  <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
                    {t('meals_n')(tpl.meals.length)}
                    {tpl.estimatedKcal > 0 && <span> · ~{tpl.estimatedKcal} kcal/tydz.</span>}
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:11, color:'#6b7280' }}>{t('est_weekly_cost')}</div>
                  <div style={{ fontSize:18, fontWeight:700, color:'#0d9488' }}>
                    ~{tpl.estimatedCost.toFixed(2)} zł
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Summary;
