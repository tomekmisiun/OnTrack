import React, { useState, useEffect, useMemo } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import pl from 'date-fns/locale/pl';
import 'react-datepicker/dist/react-datepicker.css';
import { Icon } from '@iconify/react';
import { mealPlan as api, recipes as recipesApi, products as productsApi } from '../api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useMember } from '../contexts/MemberContext';
import { dateToStr, toEU, getCurrentWeek, getCurrentMonth } from '../utils/dates';
import ProductTable from './SummaryProductTable';
import PieChart from './SummaryPieChart';
import DrinksCard, { OTHER_TYPES, SHARED_KEYS } from './DrinksCard';
registerLocale('pl', pl);

// ─── Period card (week / month / custom) ──────────────────────────────────────
function PeriodContent({ range, summary, loading, scrollToWeek, onGoToTab, drinkItems = [], showDrinksInSummary = false, onToggleDrinks, memberLabel = '', onCategoriesUpdate, hideHeader = false }) {
  const { t } = useLanguage();
  const [productsOpen, setProductsOpen] = useState(false);
  const [adjustedTotal, setAdjustedTotal] = useState(null);

  const COLORS = ['#6366f1','#0d9488','#f59e0b','#ec4899','#22c55e','#ef4444','#8b5cf6','#14b8a6','#f97316','#06b6d4'];
  const categories = useMemo(() => {
    if (!summary) return [];
    const foodTotal = adjustedTotal !== null ? adjustedTotal : summary.total_cost;
    const drinkKeys = new Set(['kawa','herbata','napoje','woda','sodaStream']);
    const napojTotal = drinkItems.filter(d => drinkKeys.has(d._dk)).reduce((s,i)=>s+i.total,0);
    const otherGroups = OTHER_TYPES.flatMap((ot,i) => {
      if (ot.key === 'lekarze') {
        return drinkItems.filter(d => d._dk === 'lekarze').map(d => d.total > 0 ? { label: d._tkey ? t(d._tkey) : d.name, value: d.total, color: COLORS[(i+3)%COLORS.length] } : null).filter(Boolean);
      }
      const val = drinkItems.filter(d => d._dk === ot.key).reduce((s,d)=>s+d.total,0);
      return val > 0 ? [{ label: t('exp_' + ot.key) || ot.label, value: val, color: COLORS[(i+3)%COLORS.length] }] : [];
    });
    return [
      { label: t('food_label'), value: foodTotal, color: COLORS[0] },
      ...(napojTotal > 0 ? [{ label: t('drinks_label'), value: napojTotal, color: COLORS[1] }] : []),
      ...otherGroups,
    ];
  }, [summary, adjustedTotal, drinkItems]); // eslint-disable-line

  useEffect(() => {
    if (onCategoriesUpdate) onCategoriesUpdate(categories);
  }, [categories]); // eslint-disable-line

  return (
    <div>
      {!hideHeader && (
        <div style={{ padding:'16px 20px 12px', display:'flex', gap:12, alignItems:'flex-start', justifyContent:'space-between' }}>
          <div style={{ flexShrink:0 }}>
            {range && <div style={{ fontSize:12, color:'#6b7280', marginBottom:6 }}>{toEU(range.start)} – {toEU(range.end)}</div>}
            <button
              onClick={() => { onGoToTab?.('calendar'); if (scrollToWeek) setTimeout(() => document.getElementById('calendar-today')?.scrollIntoView({ behavior:'smooth', block:'center' }), 200); }}
              style={{ background:'#0d948820', border:'1px solid #0d9488', borderRadius:6, padding:'3px 10px', cursor:'pointer', fontSize:11, fontWeight:600, color:'#2dd4bf', display:'inline-flex', alignItems:'center' }}
            >
              {t('btn_go_calendar')}
            </button>
          </div>
        </div>
      )}


      {!loading && summary && (
        <div style={{ borderTop:'1px solid #374151' }}>
          <button onClick={() => setProductsOpen(o => !o)}
            style={{ width:'100%', padding:'10px 20px', background:'none', border:'none', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ textAlign:'left' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:2 }}>{t('food_expenses_label')}</div>
              <div style={{ fontSize:13, fontWeight:600, color:'#0d9488' }}>{productsOpen ? t('hide_product_list') : t('show_product_list')}</div>
            </div>
            <Icon icon="heroicons:chevron-down" style={{width:20,height:20,transition:'transform 0.25s',transform:productsOpen?'rotate(180deg)':'rotate(0deg)',color:'#0d9488'}}/>
          </button>
          {productsOpen && summary.items.length > 0 && <div style={{ padding:'0 16px 16px' }}><ProductTable items={summary.items} onTotalChange={setAdjustedTotal} /></div>}
        </div>
      )}
      {!loading && summary && summary.items.length === 0 && false && (
        <div style={{ padding:'0 20px 16px', fontSize:13, color:'#4b5563', fontStyle:'italic' }}>{t('no_meals_period')}</div>
      )}
    </div>
  );
}

// ─── Drinks helpers ───────────────────────────────────────────────────────────

function Summary({ onGoToTab }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { showError } = useToast();
  const { members, activeMember } = useMember();

  const week  = getCurrentWeek();
  const month = getCurrentMonth();

  const [weekSummary,  setWeekSummary]  = useState(null);
  const [monthSummary, setMonthSummary] = useState(null);
  const [weekLoading,  setWeekLoading]  = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);

  // Które profile uwzględniać (domyślnie wszystkie, aktualizuje się gdy member lista załaduje)
  const [selectedMemberIds, setSelectedMemberIds] = useState(
    () => activeMember ? [activeMember.id] : []
  );
  useEffect(() => {
    if (members.length > 0 && selectedMemberIds.length === 0) {
      setSelectedMemberIds(members.map(m => m.id));
    }
  }, [members]); // eslint-disable-line

  const toggleMember = (id) => setSelectedMemberIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const [activePeriod, setActivePeriod] = useState('month');

  // Custom period
  const [customRange,   setCustomRange]   = useState({ start:'', end:'' });
  const [customSummary, setCustomSummary] = useState(null);
  const [customLoading, setCustomLoading] = useState(false);

  // Templates
  const [templates, setTemplates] = useState(() => {
    try { return JSON.parse(localStorage.getItem('weekTemplates') || '[]'); } catch { return []; }
  });

  const [expandedTpl, setExpandedTpl] = useState(null);

  const deleteTemplate = (idx) => {
    const updated = templates.filter((_, i) => i !== idx);
    setTemplates(updated);
    localStorage.setItem('weekTemplates', JSON.stringify(updated));
    if (expandedTpl === idx) setExpandedTpl(null);
  };

  const DAY_NAMES = t('day_short');
  const [recipeList, setRecipeList] = useState([]);
  const [productList, setProductList] = useState([]);
  const [drinkItems, setDrinkItems] = useState([]);
  const [showDrinksInSummary, setShowDrinksInSummary] = useState(false);
  const [pieCategories, setPieCategories] = useState([]);
  const [productsOpenCustom, setProductsOpenCustom] = useState(false);

  const drinksDays = useMemo(() => {
    if (activePeriod === 'week') return 7;
    if (activePeriod === 'month') return 30;
    if (activePeriod === 'custom' && customRange.start && customRange.end && customRange.end >= customRange.start) {
      return Math.max(1, Math.round((new Date(customRange.end) - new Date(customRange.start)) / 86400000) + 1);
    }
    return 7;
  }, [activePeriod, customRange]);
  const drinksPeriodLabel = activePeriod === 'week' ? 'tydzień (7 dni)' : activePeriod === 'month' ? `miesiąc (${drinksDays} dni)` : `wybrany okres (${drinksDays} dni)`;

  // Ładuj dane gdy mamy activeMember lub zmieniono selectedMemberIds
  // Gdy nikt nie zaznaczony → puste wyniki (0 zł)
  const noMembersSelected = members.length > 1 && selectedMemberIds.length === 0;
  const loadMids = noMembersSelected ? [] : selectedMemberIds.length > 0
    ? selectedMemberIds
    : activeMember ? [activeMember.id] : [];

  useEffect(() => {
    if (noMembersSelected) {
      const empty = { items: [], total_cost: 0 };
      setWeekSummary(empty); setMonthSummary(empty);
      setWeekLoading(false); setMonthLoading(false);
      return;
    }
    if (!loadMids.length) return;
    setWeekLoading(true); setMonthLoading(true);
    Promise.all([
      api.getSummary(week.start, week.end, loadMids),
      api.getSummary(month.start, month.end, loadMids),
      recipesApi.getAll(),
      productsApi.getAll(),
    ]).then(([wRes, mRes, rRes, pRes]) => {
      setWeekSummary(wRes.data);
      setMonthSummary(mRes.data);
      setRecipeList(rRes.data);
      setProductList(pRes.data);
    }).catch(() => showError(t('err_load_summary')))
      .finally(() => { setWeekLoading(false); setMonthLoading(false); });
  }, [loadMids.join(','), week.start, week.end, user?.lang]); // eslint-disable-line

  const handleCustomLoad = async () => {
    if (!customRange.start || !customRange.end) { showError(t('err_select_range')); return; }
    if (customRange.start > customRange.end)    { showError(t('err_date_order'));   return; }
    setCustomLoading(true);
    try {
      const res = await api.getSummary(customRange.start, customRange.end, loadMids);
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

  return (
    <div>

      {/* ─── Member selector (tylko gdy > 1 osoba) ─── */}
      {members.length > 1 && (
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.6px', marginRight:2 }}>{t('include_label')}</span>
          {members.map((m, idx) => {
            const checked = selectedMemberIds.includes(m.id);
            const color = ['#0d9488','#6366f1','#f59e0b','#ec4899','#22c55e','#ef4444'][idx % 6];
            return (
              <button
                key={m.id}
                onClick={() => toggleMember(m.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 14px', borderRadius: 20,
                  border: `1px solid ${checked ? color : '#374151'}`,
                  background: checked ? `${color}22` : '#1f2937',
                  color: checked ? color : '#6b7280',
                  fontSize: 12, fontWeight: checked ? 700 : 400,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <span style={{ width:8, height:8, borderRadius:'50%', background: checked ? color : '#374151', flexShrink:0, transition:'background 0.15s' }} />
                {m.name}
              </button>
            );
          })}
        </div>
      )}

      {/* ─── Połączona karta: taby + 2 kolumny pod spodem ─── */}
      <div className="card" style={{ padding:0, overflow:'hidden', marginBottom:16 }}>

        {/* Taby — 3 równe, NIEZMIENIONE */}
        <div style={{ display:'flex', gap:0, borderBottom:'1px solid #374151' }}>
          {[
            { id:'month',  label: t('this_month') },
            { id:'week',   label: t('this_week') },
            { id:'custom', label: t('custom_period') },
          ].map(({ id, label }, idx, arr) => (
            <button key={id} onClick={() => setActivePeriod(id)}
              style={{
                flex:1, padding:'10px 8px', cursor:'pointer',
                border:'none',
                borderRight: idx < arr.length-1 ? '1px solid #374151' : 'none',
                borderBottom: activePeriod===id ? '3px solid #0d9488' : '3px solid transparent',
                background: activePeriod===id ? '#0d948818' : '#111827',
                color: activePeriod===id ? '#2dd4bf' : '#e2e8f0',
                fontWeight:700, fontSize:13,
                letterSpacing: activePeriod===id ? '0.2px' : 0,
                transition:'all 0.15s',
                display:'flex', flexDirection:'column', alignItems:'center', gap:3,
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Zawartość: lewa (2/3) + prawa (1/3) */}
        <div style={{ display:'flex', alignItems:'stretch' }}>

          {/* LEWA (szerokość 2 tabów): przyciski wydatków + lista jedzenia */}
          <div style={{ flex:2, minWidth:0, borderRight:'1px solid #374151' }}>
            {/* Wydatki na jedzenie — nad przyciskami */}
            <div style={{ borderBottom:'1px solid #374151' }}>
              {activePeriod === 'week' && (
                <PeriodContent range={week} summary={weekSummary} loading={weekLoading} scrollToWeek onGoToTab={onGoToTab} drinkItems={drinkItems} showDrinksInSummary={showDrinksInSummary} onToggleDrinks={() => setShowDrinksInSummary(v => !v)} memberLabel={members.length > 1 ? members.filter(m => selectedMemberIds.includes(m.id)).map(m => m.name).join(', ') : members[0]?.name ?? ''} onCategoriesUpdate={setPieCategories} hideHeader />
              )}
              {activePeriod === 'month' && (
                <PeriodContent range={month} summary={monthSummary} loading={monthLoading} onGoToTab={onGoToTab} drinkItems={drinkItems} showDrinksInSummary={showDrinksInSummary} onToggleDrinks={() => setShowDrinksInSummary(v => !v)} memberLabel={members.length > 1 ? members.filter(m => selectedMemberIds.includes(m.id)).map(m => m.name).join(', ') : members[0]?.name ?? ''} onCategoriesUpdate={setPieCategories} hideHeader />
              )}
              {activePeriod === 'custom' && customSummary && customSummary.items.length > 0 && (
                <div>
                  <button onClick={() => setProductsOpenCustom(o => !o)}
                    style={{ width:'100%', padding:'10px 20px', background:'none', border:'none', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ textAlign:'left' }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:2 }}>{t('food_expenses_label')}</div>
                      <div style={{ fontSize:13, fontWeight:600, color:'#0d9488' }}>{productsOpenCustom ? t('hide_product_list') : t('show_product_list')}</div>
                    </div>
                    <Icon icon="heroicons:chevron-down" style={{width:20,height:20,transition:'transform 0.25s',transform:productsOpenCustom?'rotate(180deg)':'rotate(0deg)',color:'#0d9488'}}/>
                  </button>
                  {productsOpenCustom && <div style={{ padding:'0 16px 16px' }}><ProductTable items={customSummary.items} /></div>}
                </div>
              )}
            </div>
            <div style={{ padding:'16px 20px' }}>
              <DrinksCard
                days={drinksDays}
                periodLabel={drinksPeriodLabel}
                productList={productList}
                onUpdate={(items) => setDrinkItems(items)}
                pieCategories={pieCategories}
              />
            </div>
          </div>

          {/* PRAWA (szerokość 1 tabu): pie chart + podsumowanie + date picker */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', borderLeft:'1px solid #374151' }}>

            {/* Pie chart + lista + Łącznie + date picker */}
            <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'16px', gap:12, overflowY:'auto' }}>
              {pieCategories.length > 0 && (
                <>
                  <div style={{ display:'flex', justifyContent:'center' }}>
                    <PieChart slices={pieCategories} size={190} interactive />
                  </div>
                  <div style={{ width:'100%' }}>
                    {pieCategories.map((cat, i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                        <span style={{ width:10, height:10, borderRadius:2, background:cat.color, flexShrink:0 }} />
                        <span style={{ fontSize:11, color:'#9ca3af', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cat.label}</span>
                        <span style={{ fontSize:12, fontWeight:600, color:'#e2e8f0', whiteSpace:'nowrap' }}>{cat.value.toFixed(2)} {t('currency')}</span>
                      </div>
                    ))}
                    <div style={{ borderTop:'1px solid #374151', paddingTop:10, marginTop:4, display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                      <span style={{ fontSize:13, color:'#9ca3af', fontWeight:700 }}>{t('expenses_total')}</span>
                      <span style={{ fontSize:22, fontWeight:800, color:'#0d9488' }}>{pieCategories.reduce((s,c)=>s+c.value,0).toFixed(2)} {t('currency')}</span>
                    </div>
                  </div>
                </>
              )}
              {pieCategories.length === 0 && (
                <div style={{ color:'#4b5563', fontSize:12, textAlign:'center', marginTop:40 }}>{t('no_data_label')}</div>
              )}

              {/* Sekcja okresu na dole */}
              <div style={{ borderTop:'1px solid #374151', paddingTop:12, marginTop:4 }}>
                {activePeriod === 'custom' ? (
                  <>
                    <div style={{ display:'flex', gap:8 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>{t('date_from')}</div>
                        <DatePicker
                          locale="pl"
                          dateFormat="dd.MM.yyyy"
                          selected={customRange.start ? new Date(customRange.start) : null}
                          onChange={d => setCustomRange(r => ({ ...r, start: d ? d.toISOString().slice(0,10) : '' }))}
                          placeholderText="dd.mm.yyyy"
                          className="dp-input"
                          popperPlacement="top-start"
                        />
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>{t('date_to')}</div>
                        <DatePicker
                          locale="pl"
                          dateFormat="dd.MM.yyyy"
                          selected={customRange.end ? new Date(customRange.end) : null}
                          onChange={d => setCustomRange(r => ({ ...r, end: d ? d.toISOString().slice(0,10) : '' }))}
                          placeholderText="dd.mm.yyyy"
                          className="dp-input"
                          popperPlacement="top-end"
                          minDate={customRange.start ? new Date(customRange.start) : null}
                        />
                      </div>
                    </div>
                    <button className="btn btn-primary" onClick={handleCustomLoad} disabled={customLoading}
                      style={{ fontSize:11, width:'100%', marginTop:8 }}>
                      {customLoading ? '...' : t('generate')}
                    </button>
                  </>
                ) : (
                  <div style={{ display:'flex', gap:8 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>{t('date_from')}</div>
                      <div style={{ padding:'7px 10px', border:'1px solid #374151', borderRadius:6, fontSize:12, color:'#9ca3af', background:'#111827', textAlign:'center' }}>
                        {activePeriod === 'month' && month ? toEU(month.start) : activePeriod === 'week' && week ? toEU(week.start) : '—'}
                      </div>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>{t('date_to')}</div>
                      <div style={{ padding:'7px 10px', border:'1px solid #374151', borderRadius:6, fontSize:12, color:'#9ca3af', background:'#111827', textAlign:'center' }}>
                        {activePeriod === 'month' && month ? toEU(month.end) : activePeriod === 'week' && week ? toEU(week.end) : '—'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ─── Templates summary ─── */}
      <div className="card" style={{ padding:0, overflow:'hidden', marginBottom:16 }}>
        <div style={{ padding:'16px 20px' }}>
          <h2 style={{ margin:0, fontSize:17, color:'#f1f5f9', fontWeight:600 }}>{t('week_templates_sum')}</h2>
          <div style={{ display:'flex', gap:8, marginTop:6 }}>
            <button
              onClick={() => { onGoToTab?.('calendar'); setTimeout(() => window.dispatchEvent(new Event('open-template')), 250); }}
              style={{ background:'#0d948820', border:'1px solid #0d9488', borderRadius:6, padding:'3px 10px', cursor:'pointer', fontSize:11, fontWeight:600, color:'#2dd4bf', display:'inline-flex', alignItems:'center' }}
            >
              {t('btn_create_template')}
            </button>
            <button
              onClick={() => onGoToTab?.('calendar')}
              style={{ background:'#0d948820', border:'1px solid #0d9488', borderRadius:6, padding:'3px 10px', cursor:'pointer', fontSize:11, fontWeight:600, color:'#2dd4bf', display:'inline-flex', alignItems:'center' }}
            >
              {t('btn_go_calendar')}
            </button>
          </div>
        </div>

        <div style={{ borderTop:'1px solid #374151' }}>
            {tplData.map((tpl, i) => {
              const isOpen = expandedTpl === i;
              // Grupuj posiłki po dniu
              const byDay = Array.from({ length: 7 }, (_, d) =>
                tpl.meals.filter(m => m.dayOffset === d).sort((a, b) => a.position - b.position)
              );
              const activeDays = byDay.map((meals, d) => ({ d, meals })).filter(x => x.meals.length > 0);

              return (
                <div key={i} style={{ borderBottom: i < tplData.length-1 ? '1px solid #2d3748' : 'none' }}>
                  {/* Nagłówek wiersza */}
                  <div
                    className="template-row"
                    style={{ padding:'12px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}
                    onClick={() => setExpandedTpl(isOpen ? null : i)}
                  >
                    <div>
                      <div style={{ fontWeight:700, fontSize:14 }}>{tpl.name}</div>
                      <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>{t('meals_n')(tpl.meals.length)}</div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:11, color:'#6b7280' }}>{t('est_weekly_cost')}</div>
                        <div style={{ fontSize:18, fontWeight:700, color:'#0d9488' }}>~{tpl.estimatedCost.toFixed(2)} {t('currency')}</div>
                      </div>
                      <button
                        className="btn btn-danger"
                        onClick={e => { e.stopPropagation(); deleteTemplate(i); }}
                      >
                        {t('delete')}
                      </button>
                    </div>
                  </div>

                  {/* Rozwinięta zawartość */}
                  {isOpen && (
                    <div style={{ padding:'0 20px 14px', display:'flex', gap:8, flexWrap:'wrap' }}>
                      {activeDays.map(({ d, meals }) => (
                        <div key={d} style={{ background:'#111827', borderRadius:8, padding:'8px 12px', minWidth:110 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:'#0d9488', marginBottom:6 }}>{DAY_NAMES[d]}</div>
                          {meals.map((m, mi) => (
                            <div key={mi} style={{ fontSize:12, color:'#e2e8f0', marginBottom:3, display:'flex', gap:6, alignItems:'flex-start' }}>
                              <span style={{ fontSize:10, color:'#6b7280', minWidth:14, paddingTop:1 }}>{m.position}.</span>
                              <span>{m.recipe_name}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
      </div>
    </div>
  );
}


export default Summary;
