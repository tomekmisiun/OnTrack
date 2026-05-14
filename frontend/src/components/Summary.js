import React, { useState, useEffect } from 'react';
import { mealPlan as api, recipes as recipesApi } from '../api';
import { useLanguage } from '../contexts/LanguageContext';

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
  return (
    <table style={{ marginTop: 4 }}>
      <thead>
        <tr>
          <th>Produkt</th>
          <th>Gramatura</th>
          <th>Opakowania</th>
          <th>Cena/opak.</th>
          <th>Koszt</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i}>
            <td><strong>{item.product_name}</strong></td>
            <td>{item.total_weight} {item.unit || 'g'}</td>
            <td>
              <span style={{ background:'#667eea', color:'white', padding:'2px 8px', borderRadius:10, fontWeight:600, fontSize:12 }}>
                {item.packages_rounded} szt.
              </span>
            </td>
            <td>{item.price_per_package.toFixed(2)} zł</td>
            <td><strong>{item.total_cost.toFixed(2)} zł</strong></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Period card (week / month / custom) ──────────────────────────────────────
function PeriodCard({ title, range, summary, loading, error }) {
  const { t } = useLanguage();
  const [productsOpen, setProductsOpen] = useState(false);

  const toggleStyle = {
    width:'100%', padding:'10px 20px', background:'none', border:'none',
    cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center',
    fontSize:13, fontWeight:600, color:'#667eea',
  };

  return (
    <div className="card" style={{ padding:0, overflow:'hidden', marginBottom:16 }}>
      {/* Always-visible header: title + total */}
      <div style={{ padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h2 style={{ margin:0, fontSize:17 }}>{title}</h2>
          {range && (
            <div style={{ fontSize:12, color:'#aaa', marginTop:3 }}>
              {toEU(range.start)} — {toEU(range.end)}
            </div>
          )}
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:11, color:'#aaa', marginBottom:2 }}>{t('total_cost_lbl2')}</div>
          {loading ? (
            <div style={{ fontSize:20, color:'#ddd', fontWeight:700 }}>…</div>
          ) : summary ? (
            <>
              <div style={{ fontSize:28, fontWeight:800, color:'#667eea', lineHeight:1 }}>
                {summary.total_cost.toFixed(2)}<span style={{ fontSize:16, marginLeft:3 }}>zł</span>
              </div>
              {summary.items.length > 0 && (
                <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>{summary.items.length} produktów</div>
              )}
            </>
          ) : (
            <div style={{ fontSize:13, color:'#ccc' }}>—</div>
          )}
        </div>
      </div>

      {error && <div style={{ padding:'0 20px 12px', fontSize:13, color:'#c00' }}>{error}</div>}

      {/* Collapsible product list */}
      {!loading && summary && summary.items.length > 0 && (
        <div style={{ borderTop:'1px solid #f0f0f0' }}>
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
        <div style={{ padding:'0 20px 16px', fontSize:13, color:'#bbb', fontStyle:'italic' }}>
          {t('no_meals_period')}
        </div>
      )}
    </div>
  );
}

// ─── Main Summary component ───────────────────────────────────────────────────
function Summary({ onGoToTab }) {
  const { t } = useLanguage();

  const week  = getCurrentWeek();
  const month = getCurrentMonth();

  const [weekSummary,  setWeekSummary]  = useState(null);
  const [monthSummary, setMonthSummary] = useState(null);
  const [weekLoading,  setWeekLoading]  = useState(true);
  const [monthLoading, setMonthLoading] = useState(true);
  const [loadError,    setLoadError]    = useState('');

  // Custom period
  const [customOpen,    setCustomOpen]    = useState(false);
  const [customRange,   setCustomRange]   = useState({ start:'', end:'' });
  const [customSummary, setCustomSummary] = useState(null);
  const [customLoading, setCustomLoading] = useState(false);
  const [customError,   setCustomError]   = useState('');

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
    }).catch(() => setLoadError(t('err_load_summary')))
      .finally(() => { setWeekLoading(false); setMonthLoading(false); });
  }, []);

  const handleCustomLoad = async () => {
    if (!customRange.start || !customRange.end) { setCustomError(t('err_select_range')); return; }
    if (customRange.start > customRange.end)    { setCustomError(t('err_date_order'));   return; }
    setCustomLoading(true); setCustomError('');
    try {
      const res = await api.getSummary(customRange.start, customRange.end);
      setCustomSummary(res.data);
    } catch { setCustomError(t('err_load_summary')); }
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
    fontSize:13, fontWeight:600, color:'#667eea',
  };

  return (
    <div>
      {loadError && <div style={{ background:'#ffe0e0', color:'#c00', padding:12, borderRadius:8, marginBottom:16 }}>{loadError}</div>}

      {/* ─── Current week ─── */}
      <PeriodCard
        title={t('this_week')}
        range={week}
        summary={weekSummary}
        loading={weekLoading}
      />

      {/* ─── Current month ─── */}
      <PeriodCard
        title={t('this_month')}
        range={month}
        summary={monthSummary}
        loading={monthLoading}
      />

      {/* ─── Custom period (collapsible) ─── */}
      <div className="card" style={{ padding:0, overflow:'hidden', marginBottom:16 }}>
        <button onClick={() => setCustomOpen(o => !o)} style={toggleStyle}>
          <span>{t('custom_period')}</span>
          <span style={{ display:'flex', alignItems:'center', gap:4, fontWeight:400, fontSize:12 }}>
            {customOpen ? 'Zwiń' : 'Rozwiń'}
            <span style={{ fontSize:16, transition:'transform 0.2s', transform: customOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
          </span>
        </button>
        {customOpen && (
          <div style={{ padding:'0 20px 20px', borderTop:'1px solid #f0f0f0' }}>
            {customError && <p style={{ color:'red', fontSize:13, marginTop:12 }}>{customError}</p>}
            <div className="form-row" style={{ marginTop:12 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                <label style={{ fontSize:13, color:'#999' }}>{t('date_from')}</label>
                <input type="date" value={customRange.start}
                  onChange={e => setCustomRange({ ...customRange, start: e.target.value })} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                <label style={{ fontSize:13, color:'#999' }}>{t('date_to')}</label>
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
                  background:'linear-gradient(135deg,#667eea,#764ba2)', color:'white', borderRadius:10,
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                }}>
                  <div>
                    <div style={{ opacity:0.8, fontSize:12 }}>{toEU(customRange.start)} — {toEU(customRange.end)}</div>
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
                  <p style={{ color:'#bbb', fontSize:13, marginTop:12, fontStyle:'italic' }}>{t('no_meals_period')}</p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── Templates summary ─── */}
      <div className="card" style={{ padding:0, overflow:'hidden', marginBottom:16 }}>
        <div
          onClick={() => onGoToTab?.('recipes')}
          style={{ padding:'16px 20px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}
        >
          <div>
            <h2 style={{ margin:0, fontSize:17, color:'#667eea' }}>{t('week_templates_sum')}</h2>
            <div style={{ fontSize:12, color:'#bbb', marginTop:4 }}>
              {t('go_edit_hint')} →
            </div>
          </div>
          <span style={{ fontSize:20, color:'#c0caff', marginTop:2 }}>›</span>
        </div>

        {templates.length === 0 ? (
          <div style={{ padding:'0 20px 16px', fontSize:13, color:'#bbb', fontStyle:'italic', borderTop:'1px solid #f0f0f0' }}>
            {t('no_tpl_summary')}
          </div>
        ) : (
          <div style={{ borderTop:'1px solid #f0f0f0' }}>
            {tplData.map((tpl, i) => (
              <div key={i} style={{
                padding:'12px 20px',
                borderBottom: i < tplData.length-1 ? '1px solid #f8f8f8' : 'none',
                display:'flex', justifyContent:'space-between', alignItems:'center',
              }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:14 }}>{tpl.name}</div>
                  <div style={{ fontSize:12, color:'#aaa', marginTop:2 }}>
                    {t('meals_n')(tpl.meals.length)}
                    {tpl.estimatedKcal > 0 && <span> · ~{tpl.estimatedKcal} kcal/tydz.</span>}
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:11, color:'#aaa' }}>{t('est_weekly_cost')}</div>
                  <div style={{ fontSize:18, fontWeight:700, color:'#667eea' }}>
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
