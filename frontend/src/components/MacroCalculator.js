import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useToast } from '../contexts/ToastContext';
import { useMember } from '../contexts/MemberContext';
import { members as membersApi } from '../api';
import { useLanguage } from '../contexts/LanguageContext';

const ACTIVITY_VALUES = [1.2, 1.375, 1.55, 1.725, 1.9];
const GOAL_VALUES = [
  { value: 'lose',     adj:  -500, proteinPerKg: 2.2, fatPct: 0.25, warn: false },
  { value: 'maintain', adj:     0, proteinPerKg: 1.8, fatPct: 0.27, warn: false },
  { value: 'extreme',  adj: -1000, proteinPerKg: 2.2, fatPct: 0.25, warn: true  },
  { value: 'gain',     adj:  +300, proteinPerKg: 2.0, fatPct: 0.25, warn: false },
];

const FORM_KEY = 'macroFormState';

function loadForm() {
  try { return JSON.parse(localStorage.getItem(FORM_KEY) || 'null'); } catch { return null; }
}

function bmi(w, h) { const hm = h / 100; return w / (hm * hm); }
function bmiCat(b, t) {
  if (b < 18.5) return { label: t('macro_underweight'), color: '#3b82f6' };
  if (b < 25)   return { label: t('macro_normal'),      color: '#22c55e' };
  if (b < 30)   return { label: t('macro_overweight'),  color: '#eab308' };
  return               { label: t('macro_obese'),       color: '#ef4444' };
}
function bmr(w, h, age, gender) {
  const base = 10 * w + 6.25 * h - 5 * age;
  return gender === 'm' ? base + 5 : base - 161;
}
// Adjusted Body Weight for protein calc when overweight/obese.
// IBW = weight at BMI 25; AdjBW = IBW + 0.25 × (actual − IBW)
function adjProteinWeight(w, h) {
  const hm = h / 100;
  const ibw = 25 * hm * hm;
  if (w <= ibw) return { pw: w, adjusted: false, ibw: null };
  const adj = ibw + 0.25 * (w - ibw);
  return { pw: Math.round(adj), adjusted: true, ibw: Math.round(ibw) };
}

function calcMacros(w, h, tdee, g) {
  const { pw } = adjProteinWeight(w, h);
  const targetKcal = Math.round(tdee + g.adj);
  const proteinG   = Math.round(pw * g.proteinPerKg);
  const fatG       = Math.round((g.fatPct * targetKcal) / 9);
  const carbsG     = Math.max(0, Math.round((targetKcal - proteinG * 4 - fatG * 9) / 4));
  return { kcal: targetKcal, protein: proteinG, fat: fatG, carbs: carbsG };
}
function pct(val, total) { return Math.round((val / total) * 100); }

const inp = {
  background: '#111827', border: '1.5px solid #374151', color: '#f1f5f9',
  borderRadius: 7, padding: '6px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box',
};
const sel = { ...inp };
const labelSt = { fontSize: 11, color: '#9ca3af', marginBottom: 3, display: 'block' };
const row = { marginBottom: 10 };

// ── BMI gauge ────────────────────────────────────────────────────────────────
const BMI_MIN = 10, BMI_MAX = 45;
const ZONE_COLORS = ['#3b82f6','#22c55e','#eab308','#ef4444'];
const ZONE_RANGES = [[10,18.5],[18.5,25],[25,30],[30,45]];
function bmiPos(val) {
  return Math.min(100, Math.max(0, (val - BMI_MIN) / (BMI_MAX - BMI_MIN) * 100));
}

function BmiGauge({ bmiVal }) {
  const { t } = useLanguage();
  const ZONES = [
    { from: 10,   to: 18.5, color: ZONE_COLORS[0], label: t('macro_underweight') },
    { from: 18.5, to: 25,   color: ZONE_COLORS[1], label: t('macro_normal') },
    { from: 25,   to: 30,   color: ZONE_COLORS[2], label: t('macro_overweight') },
    { from: 30,   to: 45,   color: ZONE_COLORS[3], label: t('macro_obese') },
  ];
  const pos = bmiPos(bmiVal);
  const cat = bmiCat(bmiVal, t);
  return (
    <div style={{ marginTop: 12 }}>
      {/* colour bar + marker line overlay */}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', height: 14, borderRadius: 6, overflow: 'hidden' }}>
          {ZONES.map(z => (
            <div key={z.label}
              style={{ width: `${(z.to - z.from) / (BMI_MAX - BMI_MIN) * 100}%`, background: z.color, opacity: 0.85 }}
            />
          ))}
        </div>
        <div style={{
          position: 'absolute', top: 0, left: `${pos}%`, transform: 'translateX(-50%)',
          width: 2, height: '100%', background: '#fff',
          boxShadow: '0 0 4px rgba(0,0,0,0.5)', borderRadius: 1,
        }} />
      </div>
      {/* scale */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {[10, 18.5, 25, 30, 45].map(v => (
          <span key={v} style={{ fontSize: 9, color: '#6b7280' }}>{v}</span>
        ))}
      </div>
      {/* legend - active zone highlighted */}
      <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
        {ZONES.map(z => (
          <span key={z.label} style={{
            display: 'flex', alignItems: 'center', gap: 3, fontSize: 10,
            color: cat.label === z.label ? z.color : '#6b7280',
            fontWeight: cat.label === z.label ? 700 : 400,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: z.color, opacity: cat.label === z.label ? 1 : 0.45, display: 'inline-block' }} />
            {z.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Macro legend card ────────────────────────────────────────────────────────
function MacroLegend({ goalOpt, weight, adjPW }) {
  const [open, setOpen] = React.useState(false);
  const { t } = useLanguage();
  const pw = adjPW?.pw ?? weight;
  const proteinG = pw > 0 ? Math.round(pw * goalOpt.proteinPerKg) : null;
  return (
    <div style={{ background: '#1c3534', border: '1px solid #374151', borderRadius: 8 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width:'100%', padding:'12px 16px', background:'none', border:'none', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#0d9488' }}>{t('macro_how_title')}</span>
        <Icon icon="heroicons:chevron-down" style={{ width:18, height:18, color:'#0d9488', transition:'transform 0.25s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      </button>
      {open && (
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Obesity adjustment notice */}
        {adjPW?.adjusted && (
          <div style={{ background: '#1c1917', border: '1px solid #78350f', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#fcd34d', lineHeight: 1.6 }}>
            <strong>{t('legend_obesity_title')}</strong> {t('legend_obesity_body1')}{' '}
            <strong>{adjPW.pw} kg</strong> {t('legend_obesity_body2')(weight)}.{' '}
            {t('legend_obesity_formula')(adjPW.ibw)}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#0d9488', flexShrink: 0, marginTop: 3 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 3 }}>{t('macro_protein')}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
              {t('legend_protein_by_goal')}{' '}
              <span style={{ color: '#2dd4bf' }}>
                {goalOpt.value === 'lose' && t('legend_protein_lose')}
                {goalOpt.value === 'maintain' && t('legend_protein_maintain')}
                {goalOpt.value === 'gain' && t('legend_protein_gain')}
                {goalOpt.value === 'extreme' && t('legend_protein_extreme')}
              </span>.
              {proteinG && (
                <span style={{ color: '#6b7280' }}>
                  {' '}{t('legend_protein_basis')}: <strong style={{ color: '#2dd4bf' }}>{pw} kg</strong> → <strong style={{ color: '#2dd4bf' }}>{proteinG} g</strong>.
                </span>
              )}
              {' '}{t('legend_1g_protein')}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#f59e0b', flexShrink: 0, marginTop: 3 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 3 }}>{t('macro_fat')}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
              {t('legend_fat_fixed')}{' '}
              <span style={{ color: '#f59e0b' }}>{Math.round(goalOpt.fatPct * 100)}% {t('legend_fat_of_kcal')}</span> {t('legend_fat_div9')}.
              {' '}{t('legend_fat_note')}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#6366f1', flexShrink: 0, marginTop: 3 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 3 }}>{t('macro_carbs')}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
              {t('legend_carbs_desc')}
              {' '}{t('legend_formula')}: <span style={{ color: '#6366f1' }}>{t('legend_carbs_formula')}</span>.
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #374151', paddingTop: 12, fontSize: 11, color: '#9ca3af', lineHeight: 1.6 }}>
          <strong style={{ color: '#e2e8f0' }}>BMR</strong> {t('legend_bmr_desc')}{' '}
          <span style={{ color: '#9ca3af' }}>10×{t('legend_bmr_formula')}</span>.{' '}
          <strong style={{ color: '#e2e8f0' }}>TDEE</strong> = BMR × {t('legend_tdee_desc')}.
        </div>
      </div>
      )}
    </div>
  );
}

function MacroBar({ kcal, protein, fat, carbs }) {
  const { t } = useLanguage();
  const proteinKcal = protein * 4, fatKcal = fat * 9, carbsKcal = carbs * 4;
  const total = proteinKcal + fatKcal + carbsKcal || 1;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
        <div style={{ width: `${(proteinKcal/total)*100}%`, background: '#0d9488' }} />
        <div style={{ width: `${(fatKcal/total)*100}%`, background: '#f59e0b' }} />
        <div style={{ width: `${(carbsKcal/total)*100}%`, background: '#6366f1' }} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        {[['#0d9488',t('macro_protein')],['#f59e0b',t('macro_fat')],['#6366f1',t('macro_carbs')]].map(([c,lbl]) => (
          <span key={lbl} style={{ display:'flex', alignItems:'center', gap:3, fontSize:10, color:'#9ca3af' }}>
            <span style={{ width:8, height:8, borderRadius:2, background:c, display:'inline-block' }} />{lbl}
          </span>
        ))}
      </div>
    </div>
  );
}

function MacroRow({ label: lbl, value, unit, kcalVal, totalKcal, color }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid #374151' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ width:10, height:10, borderRadius:2, background:color, display:'inline-block', flexShrink:0 }} />
        <span style={{ fontSize:14, color:'#e2e8f0' }}>{lbl}</span>
      </div>
      <div style={{ textAlign:'right' }}>
        <span style={{ fontSize:15, fontWeight:700, color:'#f1f5f9' }}>{value}<span style={{ fontSize:11, color:'#9ca3af', marginLeft:2 }}>{unit}</span></span>
        <span style={{ fontSize:11, color:'#6b7280', marginLeft:8 }}>{pct(kcalVal, totalKcal)}%</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MacroCalculator() {
  const { showSuccess } = useToast();
  const { activeMember, reload: reloadMembers } = useMember();
  const { t } = useLanguage();

  const ACTIVITY = [
    { value: 1.2,   label: t('macro_act_sedentary') },
    { value: 1.375, label: t('macro_act_light') },
    { value: 1.55,  label: t('macro_act_moderate') },
    { value: 1.725, label: t('macro_act_active') },
    { value: 1.9,   label: t('macro_act_very_active') },
  ];
  const GOALS = [
    { value: 'lose',     label: t('macro_cut'),       adj:  -500, proteinPerKg: 2.2, fatPct: 0.25, warn: false },
    { value: 'maintain', label: t('macro_maintain'),  adj:     0, proteinPerKg: 1.8, fatPct: 0.27, warn: false },
    { value: 'extreme',  label: t('macro_aggr_cut'),  adj: -1000, proteinPerKg: 2.2, fatPct: 0.25, warn: true  },
    { value: 'gain',     label: t('macro_bulk'),       adj:  +300, proteinPerKg: 2.0, fatPct: 0.25, warn: false },
  ];

  // Init form from active member profile, fallback to localStorage
  const saved = activeMember
    ? { gender: activeMember.gender, age: activeMember.age, weight: activeMember.weight, height: activeMember.height, activity: activeMember.activity, goal: activeMember.goal }
    : loadForm();

  const [gender,   setGender]   = useState(saved?.gender   ?? 'm');
  const [age,      setAge]      = useState(saved?.age      ?? '');
  const [weight,   setWeight]   = useState(saved?.weight   ?? '');
  const [height,   setHeight]   = useState(saved?.height   ?? '');
  const [activity, setActivity] = useState(saved?.activity ?? 1.55);
  const [goal,     setGoal]     = useState(saved?.goal     ?? 'maintain');

  // When active member changes, repopulate form
  useEffect(() => {
    if (!activeMember) return;
    if (activeMember.gender)   setGender(activeMember.gender);
    if (activeMember.age)      setAge(String(activeMember.age));
    if (activeMember.weight)   setWeight(String(activeMember.weight));
    if (activeMember.height)   setHeight(String(activeMember.height));
    if (activeMember.activity) setActivity(activeMember.activity);
    if (activeMember.goal)     setGoal(activeMember.goal);
  }, [activeMember?.id]);

  // Persist to localStorage as fallback
  useEffect(() => {
    localStorage.setItem(FORM_KEY, JSON.stringify({ gender, age, weight, height, activity, goal }));
  }, [gender, age, weight, height, activity, goal]);

  const w = parseFloat(weight), h = parseFloat(height),
        a = parseInt(age),      act = parseFloat(activity);
  const valid = w > 0 && h > 0 && a > 0 && a < 120;

  const bmiVal  = valid ? bmi(w, h) : null;
  const bmrVal  = valid ? Math.round(bmr(w, h, a, gender)) : null;
  const tdeeVal = valid ? Math.round(bmrVal * act) : null;
  const goalOpt = GOALS.find(g => g.value === goal);
  const adjPW   = valid ? adjProteinWeight(w, h) : null;
  const macros  = valid ? calcMacros(w, h, tdeeVal, goalOpt) : null;

  async function saveGoals() {
    if (!macros) return;
    // Zapisz do bazy dla aktywnego członka
    if (activeMember) {
      await membersApi.saveProfile(activeMember.id, {
        gender, age: parseInt(age), weight: parseFloat(weight),
        height: parseFloat(height), activity: parseFloat(activity), goal,
        macro_kcal: macros.kcal, macro_protein: macros.protein,
        macro_fat: macros.fat, macro_carbs: macros.carbs,
        macro_goal_label: goalOpt.label,
      });
      await reloadMembers();
    }
    // Fallback localStorage (dla backward compat z Calendar jeśli coś pójdzie nie tak)
    localStorage.setItem('macroGoals', JSON.stringify({ ...macros, goalLabel: goalOpt.label }));
    showSuccess('Cele makro zapisane! Kolory pojawią się w kalendarzu.');
  }

  const bmiInfo = bmiVal ? bmiCat(bmiVal, t) : null;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── ROW 1: 3 karty ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>

        {/* Karta 1: Twoje dane */}
        <div className="card" style={{ padding: 14 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 15, color: '#f1f5f9' }}>{t('macro_your_data')}</h2>

          <div style={row}>
            <span style={labelSt}>{t('macro_gender')}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['m', t('macro_male')],['f', t('macro_female')]].map(([v,l]) => (
                <button key={v} onClick={() => setGender(v)}
                  style={{ flex:1, padding:'6px 0', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600, border:'1px solid #374151', transition:'all 0.15s',
                    background: gender===v ? '#1e3a3a' : 'transparent', color: gender===v ? '#2dd4bf' : '#6b7280' }}>{l}</button>
              ))}
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            <div>
              <label style={labelSt}>{t('macro_age')}</label>
              <input type="number" className="no-spin" style={inp} value={age} onChange={e=>{const v=e.target.value;if(v==='')return setAge('');const n=parseFloat(v);if(!isNaN(n))setAge(String(Math.min(99,Math.max(1,n))));}} placeholder="np. 28" min={1} max={99} />
            </div>
            <div>
              <label style={labelSt}>{t('macro_weight')}</label>
              <input type="number" className="no-spin" style={inp} value={weight} onChange={e=>{const v=e.target.value;if(v==='')return setWeight('');const n=parseFloat(v);if(!isNaN(n))setWeight(String(Math.min(500,Math.max(1,n))));}} placeholder="np. 75" min={1} max={500} />
            </div>
          </div>

          <div style={row}>
            <label style={labelSt}>{t('macro_height')}</label>
            <input type="number" className="no-spin" style={inp} value={height} onChange={e=>{const v=e.target.value;if(v==='')return setHeight('');const n=parseFloat(v);if(!isNaN(n))setHeight(String(Math.min(300,Math.max(1,n))));}} placeholder="np. 178" min={1} max={300} />
          </div>
          <div style={row}>
            <label style={labelSt}>{t('macro_activity')}</label>
            <select style={sel} value={activity} onChange={e=>setActivity(e.target.value)}>
              {ACTIVITY.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div style={{ ...row, marginBottom: 0 }}>
            <span style={labelSt}>{t('macro_goal')}</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {GOALS.map(g => {
                const isActive = goal === g.value;
                const activeBg   = g.warn ? '#2d1515' : '#1e3a3a';
                const activeFg   = g.warn ? '#f87171' : '#2dd4bf';
                const borderClr  = g.warn ? '#4b1515' : '#374151';
                return (
                  <button key={g.value} onClick={() => setGoal(g.value)}
                    style={{ padding:'6px 4px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600, transition:'all 0.15s',
                      border: `1px solid ${borderClr}`,
                      background: isActive ? activeBg : 'transparent',
                      color: isActive ? activeFg : g.warn ? '#f87171' : '#6b7280' }}>
                    {g.label}
                    {g.warn && <div style={{ fontSize:9, fontWeight:400, marginTop:1, opacity:0.8 }}>{t('macro_aggr_not_rec')}</div>}
                  </button>
                );
              })}
            </div>
          </div>
          <button onClick={saveGoals} disabled={!macros}
            style={{ marginTop:10, width:'100%', padding:'8px 0', borderRadius:7, transition:'all 0.15s',
              border: macros ? '1px solid #374151' : '1px solid #374151',
              background: macros ? '#1e3a3a' : 'transparent',
              color: macros ? '#2dd4bf' : '#4b5563',
              fontSize:13, fontWeight:700, cursor: macros ? 'pointer' : 'default' }}>
            {t('macro_save_goal')}
          </button>
        </div>

        {/* Karta 2: Cel dzienny makro */}
        <div className="card" style={{ padding: 14, display:'flex', flexDirection:'column' }}>
          <h2 style={{ margin:'0 0 10px', fontSize:15, color:'#f1f5f9' }}>{t('macro_daily_goal')}</h2>
          {macros ? (
            <>
              <div style={{ fontSize:28, fontWeight:800, color:'#2dd4bf', marginBottom:4 }}>
                {macros.kcal} <span style={{ fontSize:13, color:'#6b7280', fontWeight:400 }}>{t('macro_kcal_day')}</span>
              </div>
              <MacroBar {...macros} />
              <div style={{ marginTop:10 }}>
                <MacroRow label={t('macro_protein')} value={macros.protein} unit="g" kcalVal={macros.protein*4} totalKcal={macros.kcal} color="#0d9488" />
                <MacroRow label={t('macro_fat')}     value={macros.fat}     unit="g" kcalVal={macros.fat*9}     totalKcal={macros.kcal} color="#f59e0b" />
                <MacroRow label={t('macro_carbs')}   value={macros.carbs}   unit="g" kcalVal={macros.carbs*4}   totalKcal={macros.kcal} color="#6366f1" />
              </div>
              <div style={{ marginTop:'auto', paddingTop:14, display:'flex', alignItems:'baseline', gap:5 }}>
                {goalOpt.adj === 0 ? (
                  <>
                    <span style={{ fontSize:20, fontWeight:800, color:'#9ca3af' }}>{t('macro_maintain')}</span>
                    <span style={{ fontSize:13, color:'#6b7280', marginLeft:4 }}>TDEE</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize:20, fontWeight:800, color:'#9ca3af', marginRight:2 }}>{goalOpt.label}</span>
                    <span style={{ fontSize:28, fontWeight:800, color: goalOpt.adj < 0 ? '#f87171' : '#4ade80' }}>
                      {goalOpt.adj > 0 ? '+' : ''}{goalOpt.adj}
                    </span>
                    <span style={{ fontSize:13, color:'#6b7280' }}>{t('macro_kcal_day')}</span>
                  </>
                )}
              </div>
            </>
          ) : (
            <span style={{ fontSize:12, color:'#4b5563' }}>Uzupełnij dane po lewej</span>
          )}

          {/* Aktywny cel — przypięty na dole */}
          {activeMember?.macro_goals && (
            <div style={{ marginTop:'auto', paddingTop:12, borderTop:'1px solid #374151' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ fontSize:10, color:'#0d9488', fontWeight:600, letterSpacing:'0.05em' }}>{t('macro_active_goal')}</div>
                {activeMember.goal && (
                  <span style={{ fontSize:10, fontWeight:700, color:'#2dd4bf', background:'#0d948822', borderRadius:5, padding:'2px 7px' }}>
                    {GOALS.find(g => g.value === activeMember.goal)?.label || activeMember.macro_goals.goalLabel}
                  </span>
                )}
              </div>
              <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
                {[['Kcal', activeMember.macro_goals.kcal, '#2dd4bf'],[t('macro_p'),`${activeMember.macro_goals.protein}g`,'#0d9488'],[t('macro_f'),`${activeMember.macro_goals.fat}g`,'#f59e0b'],[t('macro_c'),`${activeMember.macro_goals.carbs}g`,'#6366f1']].map(([lbl,val,color]) => (
                  <div key={lbl}>
                    <div style={{ fontSize:10, color:'#6b7280' }}>{lbl}</div>
                    <div style={{ fontSize:14, fontWeight:700, color }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Karta 3: BMI */}
        <div className="card" style={{ padding: 14, display:'flex', flexDirection:'column', gap:10 }}>
          <h2 style={{ margin:0, fontSize:15, color:'#f1f5f9' }}>BMI</h2>
          {bmiVal ? (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:32, fontWeight:800, color:bmiInfo.color, lineHeight:1 }}>{bmiVal.toFixed(1)}</span>
                <div>
                  <span style={{ display:'inline-block', background:bmiInfo.color+'22', color:bmiInfo.color, borderRadius:6, padding:'2px 8px', fontSize:12, fontWeight:700 }}>{bmiInfo.label}</span>
                  <div style={{ fontSize:10, color:'#6b7280', marginTop:2 }}>{t('macro_bmi_normal')} 18,5 – 24,9</div>
                </div>
              </div>
              <BmiGauge bmiVal={bmiVal} />
            </>
          ) : (
            <span style={{ fontSize:12, color:'#4b5563' }}>Uzupełnij dane po lewej</span>
          )}

          <div style={{ borderTop:'1px solid #374151' }} />

          <div style={{ fontSize:11, color:'#6b7280', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{t('macro_caloric_needs')}</div>
          {bmrVal ? (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {[
                { label: 'BMR', sub: t('macro_bmr_label'),  val: bmrVal,  color: '#e2e8f0' },
                { label: 'TDEE', sub: t('macro_tdee_label'), val: tdeeVal, color: '#2dd4bf' },
              ].map(({ label, sub, val, color }) => (
                <div key={label} style={{ display:'flex', alignItems:'baseline', gap:5 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'#9ca3af', width:36 }}>{label}</span>
                  <span style={{ fontSize:20, fontWeight:700, color }}>{val}</span>
                  <span style={{ fontSize:11, color:'#6b7280' }}>{sub}</span>
                </div>
              ))}
              {bmrVal && (
                <div style={{ background:'#2d1515', border:'1px solid #7f1d1d', borderRadius:6, padding:'6px 8px', fontSize:11, color:'#fca5a5', lineHeight:1.5, marginTop:2 }}>
                  ⚠ {t('macro_bmr_warning')(bmrVal)}
                </div>
              )}
            </div>
          ) : (
            <span style={{ fontSize:12, color:'#4b5563' }}>Uzupełnij dane po lewej</span>
          )}
        </div>
      </div>

      {/* ── ROW 2: Jak liczymy makro — pełna szerokość ── */}
      <MacroLegend goalOpt={goalOpt} weight={w || 0} adjPW={adjPW} />

      {/* ── ROW 3: Cytaty — pełna szerokość ── */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: 16 }}>
        {[
          { quote: t('quote_1'), author: t('quote_1_author') },
          { quote: t('quote_2'), author: t('quote_2_author') },
        ].map(({ quote, author }) => (
          <div key={author} style={{ flex: 1, borderLeft: '3px solid #0d9488', paddingLeft: 12 }}>
            <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.6, fontStyle: 'italic' }}>„{quote}"</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>- {author}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
