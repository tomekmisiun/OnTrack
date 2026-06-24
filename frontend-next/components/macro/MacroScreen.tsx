"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { Icon } from "@iconify/react";
import { useToast } from '@/contexts/ToastContext';
import { useMember } from '@/contexts/MemberContext';
import { saveMemberProfile } from '@/lib/api/members';
import { useLanguage } from '@/contexts/LanguageContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import { tFormatN, tString } from '@/lib/i18n/translate';
import './macro.css';

type TFn = (key: TranslationKey) => unknown;

type Gender = 'm' | 'f';
type GoalValue = 'lose' | 'maintain' | 'extreme' | 'gain';

type GoalOption = {
  value: GoalValue;
  label: string;
  adj: number;
  proteinPerKg: number;
  fatPct: number;
  warn: boolean;
};

type AdjProteinWeight = {
  pw: number;
  adjusted: boolean;
  ibw: number | null;
};

type MacroResult = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

type BmiCategory = {
  label: string;
  color: string;
};

type FormState = {
  gender?: string;
  age?: string | number;
  weight?: string | number;
  height?: string | number;
  activity?: number;
  goal?: string;
};

const FORM_KEY = 'macroFormState';

function loadForm(): FormState | null {
  try {
    return JSON.parse(localStorage.getItem(FORM_KEY) || 'null') as FormState | null;
  } catch {
    return null;
  }
}

function bmi(w: number, h: number): number {
  const hm = h / 100;
  return w / (hm * hm);
}

function bmiCat(b: number, t: TFn): BmiCategory {
  if (b < 18.5) return { label: tString(t, 'macro_underweight'), color: '#3b82f6' };
  if (b < 25)   return { label: tString(t, 'macro_normal'),      color: '#22c55e' };
  if (b < 30)   return { label: tString(t, 'macro_overweight'),  color: '#eab308' };
  return               { label: tString(t, 'macro_obese'),       color: '#ef4444' };
}

function bmr(w: number, h: number, age: number, gender: Gender): number {
  const base = 10 * w + 6.25 * h - 5 * age;
  return gender === 'm' ? base + 5 : base - 161;
}

// Adjusted Body Weight for protein calc when overweight/obese.
// IBW = weight at BMI 25; AdjBW = IBW + 0.25 × (actual − IBW)
function adjProteinWeight(w: number, h: number): AdjProteinWeight {
  const hm = h / 100;
  const ibw = 25 * hm * hm;
  if (w <= ibw) return { pw: w, adjusted: false, ibw: null };
  const adj = ibw + 0.25 * (w - ibw);
  return { pw: Math.round(adj), adjusted: true, ibw: Math.round(ibw) };
}

function calcMacros(w: number, h: number, tdee: number, g: GoalOption): MacroResult {
  const { pw } = adjProteinWeight(w, h);
  const targetKcal = Math.round(tdee + g.adj);
  const proteinG   = Math.round(pw * g.proteinPerKg);
  const fatG       = Math.round((g.fatPct * targetKcal) / 9);
  const carbsG     = Math.max(0, Math.round((targetKcal - proteinG * 4 - fatG * 9) / 4));
  return { kcal: targetKcal, protein: proteinG, fat: fatG, carbs: carbsG };
}

function pct(val: number, total: number): number {
  return Math.round((val / total) * 100);
}

const inp: CSSProperties = {
  background: '#111827', border: '1.5px solid #374151', color: '#f1f5f9',
  borderRadius: 7, padding: '6px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box',
};
const sel: CSSProperties = { ...inp };
const labelSt: CSSProperties = { fontSize: 11, color: '#9ca3af', marginBottom: 3, display: 'block' };
const row: CSSProperties = { marginBottom: 10 };

// ── BMI gauge ────────────────────────────────────────────────────────────────
const BMI_MIN = 10;
const BMI_MAX = 45;
const ZONE_COLORS = ['#3b82f6','#22c55e','#eab308','#ef4444'] as const;

function bmiPos(val: number): number {
  return Math.min(100, Math.max(0, (val - BMI_MIN) / (BMI_MAX - BMI_MIN) * 100));
}

function BmiGauge({ bmiVal }: { bmiVal: number }) {
  const { t } = useLanguage();
  const ZONES = [
    { from: 10,   to: 18.5, color: ZONE_COLORS[0], label: tString(t, 'macro_underweight') },
    { from: 18.5, to: 25,   color: ZONE_COLORS[1], label: tString(t, 'macro_normal') },
    { from: 25,   to: 30,   color: ZONE_COLORS[2], label: tString(t, 'macro_overweight') },
    { from: 30,   to: 45,   color: ZONE_COLORS[3], label: tString(t, 'macro_obese') },
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

// ── Macro formula modal ──────────────────────────────────────────────────────
function MacroFormulaContent({
  goalOpt,
  weight,
  adjPW,
  t,
}: {
  goalOpt: GoalOption;
  weight: number;
  adjPW: AdjProteinWeight | null;
  t: TFn;
}) {
  const pw = adjPW?.pw ?? weight;
  const proteinG = pw > 0 ? Math.round(pw * goalOpt.proteinPerKg) : null;

  return (
    <>
      {adjPW?.adjusted && adjPW.ibw !== null && (
        <div className="macro-formula-obesity">
          <strong>{tString(t, 'legend_obesity_title')}</strong> {tString(t, 'legend_obesity_body1')}{' '}
          <strong>{adjPW.pw} kg</strong> {tFormatN(t, 'legend_obesity_body2', weight)}.{' '}
          {tFormatN(t, 'legend_obesity_formula', adjPW.ibw)}
        </div>
      )}

      <div className="macro-formula-row">
        <span className="macro-formula-dot" style={{ background: '#0d9488' }} />
        <div>
          <div className="macro-formula-row-title">{tString(t, 'macro_protein')}</div>
          <div className="macro-formula-row-text">
            {tString(t, 'legend_protein_by_goal')}{' '}
            <span style={{ color: '#2dd4bf' }}>
              {goalOpt.value === 'lose' && tString(t, 'legend_protein_lose')}
              {goalOpt.value === 'maintain' && tString(t, 'legend_protein_maintain')}
              {goalOpt.value === 'gain' && tString(t, 'legend_protein_gain')}
              {goalOpt.value === 'extreme' && tString(t, 'legend_protein_extreme')}
            </span>.
            {proteinG !== null && (
              <span style={{ color: '#6b7280' }}>
                {' '}{tString(t, 'legend_protein_basis')}: <strong style={{ color: '#2dd4bf' }}>{pw} kg</strong> → <strong style={{ color: '#2dd4bf' }}>{proteinG} g</strong>.
              </span>
            )}
            {' '}{tString(t, 'legend_1g_protein')}
          </div>
        </div>
      </div>

      <div className="macro-formula-row">
        <span className="macro-formula-dot" style={{ background: '#f59e0b' }} />
        <div>
          <div className="macro-formula-row-title">{tString(t, 'macro_fat')}</div>
          <div className="macro-formula-row-text">
            {tString(t, 'legend_fat_fixed')}{' '}
            <span style={{ color: '#f59e0b' }}>{Math.round(goalOpt.fatPct * 100)}% {tString(t, 'legend_fat_of_kcal')}</span> {tString(t, 'legend_fat_div9')}.
            {' '}{tString(t, 'legend_fat_note')}
          </div>
        </div>
      </div>

      <div className="macro-formula-row">
        <span className="macro-formula-dot" style={{ background: '#6366f1' }} />
        <div>
          <div className="macro-formula-row-title">{tString(t, 'macro_carbs')}</div>
          <div className="macro-formula-row-text">
            {tString(t, 'legend_carbs_desc')}
            {' '}{tString(t, 'legend_formula')}: <span style={{ color: '#6366f1' }}>{tString(t, 'legend_carbs_formula')}</span>.
          </div>
        </div>
      </div>

      <div className="macro-formula-bmr">
        <strong style={{ color: '#e2e8f0' }}>BMR</strong> {tString(t, 'legend_bmr_desc')}{' '}
        <span style={{ color: '#9ca3af' }}>10×{tString(t, 'legend_bmr_formula')}</span>.{' '}
        <strong style={{ color: '#e2e8f0' }}>TDEE</strong> = BMR × {tString(t, 'legend_tdee_desc')}.
      </div>
    </>
  );
}

function MacroFormulaModal({
  open,
  onClose,
  goalOpt,
  weight,
  adjPW,
}: {
  open: boolean;
  onClose: () => void;
  goalOpt: GoalOption | undefined;
  weight: number;
  adjPW: AdjProteinWeight | null;
}) {
  const { t } = useLanguage();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !goalOpt) return null;

  return (
    <div className="macro-formula-modal-backdrop" onClick={onClose}>
      <div
        className="macro-formula-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="macro-formula-title"
      >
        <div className="macro-formula-modal-header">
          <h2 id="macro-formula-title" className="macro-formula-modal-title">{tString(t, 'macro_how_title')}</h2>
          <button type="button" className="macro-formula-modal-close" onClick={onClose} aria-label={tString(t, 'cancel')}>×</button>
        </div>
        <div className="macro-formula-modal-body dark-scroll">
          <MacroFormulaContent goalOpt={goalOpt} weight={weight} adjPW={adjPW} t={t} />
        </div>
      </div>
    </div>
  );
}

function MacroBar({ protein, fat, carbs }: Pick<MacroResult, 'protein' | 'fat' | 'carbs'>) {
  const { t } = useLanguage();
  const proteinKcal = protein * 4;
  const fatKcal = fat * 9;
  const carbsKcal = carbs * 4;
  const total = proteinKcal + fatKcal + carbsKcal || 1;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
        <div style={{ width: `${(proteinKcal/total)*100}%`, background: '#0d9488' }} />
        <div style={{ width: `${(fatKcal/total)*100}%`, background: '#f59e0b' }} />
        <div style={{ width: `${(carbsKcal/total)*100}%`, background: '#6366f1' }} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        {([['#0d9488', tString(t, 'macro_protein')], ['#f59e0b', tString(t, 'macro_fat')], ['#6366f1', tString(t, 'macro_carbs')]] as const).map(([c, lbl]) => (
          <span key={lbl} style={{ display:'flex', alignItems:'center', gap:3, fontSize:10, color:'#9ca3af' }}>
            <span style={{ width:8, height:8, borderRadius:2, background:c, display:'inline-block' }} />{lbl}
          </span>
        ))}
      </div>
    </div>
  );
}

function MacroRow({
  label: lbl,
  value,
  unit,
  kcalVal,
  totalKcal,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  kcalVal: number;
  totalKcal: number;
  color: string;
}) {
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

function parseGoalValue(value: string | undefined | null): GoalValue {
  if (value === 'lose' || value === 'maintain' || value === 'extreme' || value === 'gain') {
    return value;
  }
  return 'maintain';
}

function parseGender(value: string | undefined | null): Gender {
  return value === 'f' ? 'f' : 'm';
}

// ── Main component ────────────────────────────────────────────────────────────
export function MacroScreen() {
  const { showSuccess } = useToast();
  const { activeMember, reload: reloadMembers } = useMember();
  const { t } = useLanguage();

  const ACTIVITY = [
    { value: 1.2,   label: tString(t, 'macro_act_sedentary') },
    { value: 1.375, label: tString(t, 'macro_act_light') },
    { value: 1.55,  label: tString(t, 'macro_act_moderate') },
    { value: 1.725, label: tString(t, 'macro_act_active') },
    { value: 1.9,   label: tString(t, 'macro_act_very_active') },
  ];
  const GOALS: GoalOption[] = [
    { value: 'lose',     label: tString(t, 'macro_cut'),       adj:  -500, proteinPerKg: 2.2, fatPct: 0.25, warn: false },
    { value: 'maintain', label: tString(t, 'macro_maintain'),  adj:     0, proteinPerKg: 1.8, fatPct: 0.27, warn: false },
    { value: 'extreme',  label: tString(t, 'macro_aggr_cut'),  adj: -1000, proteinPerKg: 2.2, fatPct: 0.25, warn: true  },
    { value: 'gain',     label: tString(t, 'macro_bulk'),       adj:  +300, proteinPerKg: 2.0, fatPct: 0.25, warn: false },
  ];

  // Init form from active member profile, fallback to localStorage
  const saved = activeMember
    ? {
        gender: activeMember.gender,
        age: activeMember.age,
        weight: activeMember.weight,
        height: activeMember.height,
        activity: activeMember.activity,
        goal: activeMember.goal,
      }
    : loadForm();

  const [gender,   setGender]   = useState<Gender>(parseGender(saved?.gender));
  const [age,      setAge]      = useState(saved?.age != null ? String(saved.age) : '');
  const [weight,   setWeight]   = useState(saved?.weight != null ? String(saved.weight) : '');
  const [height,   setHeight]   = useState(saved?.height != null ? String(saved.height) : '');
  const [activity, setActivity] = useState(saved?.activity ?? 1.55);
  const [goal,     setGoal]     = useState<GoalValue>(parseGoalValue(saved?.goal));
  const [formulaOpen, setFormulaOpen] = useState(false);

  // When active member changes, repopulate form
  useEffect(() => {
    if (!activeMember) return;
    if (activeMember.gender)   setGender(parseGender(activeMember.gender));
    if (activeMember.age)      setAge(String(activeMember.age));
    if (activeMember.weight)   setWeight(String(activeMember.weight));
    if (activeMember.height)   setHeight(String(activeMember.height));
    if (activeMember.activity) setActivity(activeMember.activity);
    if (activeMember.goal)     setGoal(parseGoalValue(activeMember.goal));
  }, [activeMember]);

  // Persist to localStorage as fallback
  useEffect(() => {
    localStorage.setItem(FORM_KEY, JSON.stringify({ gender, age, weight, height, activity, goal }));
  }, [gender, age, weight, height, activity, goal]);

  const w = parseFloat(weight);
  const h = parseFloat(height);
  const a = parseInt(age, 10);
  const act = parseFloat(String(activity));
  const valid = w > 0 && h > 0 && a > 0 && a < 120;

  const bmiVal  = valid ? bmi(w, h) : null;
  const bmrVal  = valid ? Math.round(bmr(w, h, a, gender)) : null;
  const tdeeVal = valid && bmrVal !== null ? Math.round(bmrVal * act) : null;
  const goalOpt = GOALS.find(g => g.value === goal);
  const adjPW   = valid ? adjProteinWeight(w, h) : null;
  const macros  = valid && tdeeVal !== null && goalOpt ? calcMacros(w, h, tdeeVal, goalOpt) : null;

  async function saveGoals() {
    if (!macros || !goalOpt) return;
    // Zapisz do bazy dla aktywnego członka
    if (activeMember) {
      await saveMemberProfile(activeMember.id, {
        gender, age: parseInt(age, 10), weight: parseFloat(weight),
        height: parseFloat(height), activity: parseFloat(String(activity)), goal,
        macro_kcal: macros.kcal, macro_protein: macros.protein,
        macro_fat: macros.fat, macro_carbs: macros.carbs,
        macro_goal_label: goalOpt.label,
      });
      await reloadMembers();
    }
    // Fallback localStorage (dla backward compat z Calendar jeśli coś pójdzie nie tak)
    localStorage.setItem('macroGoals', JSON.stringify({ ...macros, goalLabel: goalOpt.label }));
    showSuccess(tString(t, 'macro_goals_saved'));
  }

  const bmiInfo = bmiVal !== null ? bmiCat(bmiVal, t) : null;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── ROW 1: 3 karty ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>

        {/* Karta 1: Twoje dane */}
        <div className="card" style={{ padding: 14 }}>
          <h2 className="card-section-title" style={{ marginBottom: 12 }}>{tString(t, 'macro_your_data')}</h2>

          <div style={row}>
            <span style={labelSt}>{tString(t, 'macro_gender')}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {([['m', tString(t, 'macro_male')], ['f', tString(t, 'macro_female')]] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setGender(v)}
                  style={{ flex:1, padding:'6px 0', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600, border:'1px solid #374151', transition:'all 0.15s',
                    background: gender===v ? '#1e3a3a' : 'transparent', color: gender===v ? '#2dd4bf' : '#6b7280' }}>{l}</button>
              ))}
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            <div>
              <label style={labelSt}>{tString(t, 'macro_age')}</label>
              <input type="number" className="no-spin" style={inp} value={age} onChange={e=>{const v=e.target.value;if(v==='')return setAge('');const n=parseFloat(v);if(!isNaN(n))setAge(String(Math.min(99,Math.max(1,n))));}} placeholder={tString(t, 'placeholder_eg_age')} min={1} max={99} />
            </div>
            <div>
              <label style={labelSt}>{tString(t, 'macro_weight')}</label>
              <input type="number" className="no-spin" style={inp} value={weight} onChange={e=>{const v=e.target.value;if(v==='')return setWeight('');const n=parseFloat(v);if(!isNaN(n))setWeight(String(Math.min(500,Math.max(1,n))));}} placeholder={tString(t, 'placeholder_eg_weight')} min={1} max={500} />
            </div>
          </div>

          <div style={row}>
            <label style={labelSt}>{tString(t, 'macro_height')}</label>
            <input type="number" className="no-spin" style={inp} value={height} onChange={e=>{const v=e.target.value;if(v==='')return setHeight('');const n=parseFloat(v);if(!isNaN(n))setHeight(String(Math.min(300,Math.max(1,n))));}} placeholder={tString(t, 'placeholder_eg_height')} min={1} max={300} />
          </div>
          <div style={row}>
            <label style={labelSt}>{tString(t, 'macro_activity')}</label>
            <select style={sel} value={activity} onChange={e=>setActivity(parseFloat(e.target.value))}>
              {ACTIVITY.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div style={{ ...row, marginBottom: 0 }}>
            <span style={labelSt}>{tString(t, 'macro_goal')}</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {GOALS.map(g => {
                const isActive = goal === g.value;
                const activeBg   = g.warn ? '#2d1515' : '#1e3a3a';
                const activeFg   = g.warn ? '#f87171' : '#2dd4bf';
                const borderClr  = g.warn ? '#4b1515' : '#374151';
                return (
                  <button key={g.value} type="button" onClick={() => setGoal(g.value)}
                    style={{ padding:'6px 4px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600, transition:'all 0.15s',
                      border: `1px solid ${borderClr}`,
                      background: isActive ? activeBg : 'transparent',
                      color: isActive ? activeFg : g.warn ? '#f87171' : '#6b7280' }}>
                    {g.label}
                    {g.warn && <div style={{ fontSize:9, fontWeight:400, marginTop:1, opacity:0.8 }}>{tString(t, 'macro_aggr_not_rec')}</div>}
                  </button>
                );
              })}
            </div>
          </div>
          <button type="button" onClick={saveGoals} disabled={!macros}
            style={{ marginTop:10, width:'100%', padding:'8px 0', borderRadius:7, transition:'all 0.15s',
              border: '1px solid #374151',
              background: macros ? '#1e3a3a' : 'transparent',
              color: macros ? '#2dd4bf' : '#4b5563',
              fontSize:13, fontWeight:700, cursor: macros ? 'pointer' : 'default' }}>
            {tString(t, 'macro_save_goal')}
          </button>
        </div>

        {/* Karta 2: Cel dzienny makro */}
        <div className="card" style={{ padding: 14, display:'flex', flexDirection:'column' }}>
          <div className="macro-daily-goal-head">
            <h2 className="card-section-title">{tString(t, 'macro_daily_goal')}</h2>
            <button
              type="button"
              className="pill-help-btn"
              onClick={() => setFormulaOpen(true)}
              aria-label={tString(t, 'macro_formula_info_aria')}
              title={tString(t, 'macro_formula_info_aria')}
            >
              <Icon icon="heroicons:information-circle" width={15} />
              <span>{tString(t, 'macro_formula_info_btn')}</span>
            </button>
          </div>
          {macros ? (
            <>
              <div style={{ fontSize:28, fontWeight:800, color:'#2dd4bf', marginBottom:4 }}>
                {macros.kcal} <span style={{ fontSize:13, color:'#6b7280', fontWeight:400 }}>{tString(t, 'macro_kcal_day')}</span>
              </div>
              <MacroBar protein={macros.protein} fat={macros.fat} carbs={macros.carbs} />
              <div style={{ marginTop:10 }}>
                <MacroRow label={tString(t, 'macro_protein')} value={macros.protein} unit="g" kcalVal={macros.protein*4} totalKcal={macros.kcal} color="#0d9488" />
                <MacroRow label={tString(t, 'macro_fat')}     value={macros.fat}     unit="g" kcalVal={macros.fat*9}     totalKcal={macros.kcal} color="#f59e0b" />
                <MacroRow label={tString(t, 'macro_carbs')}   value={macros.carbs}   unit="g" kcalVal={macros.carbs*4}   totalKcal={macros.kcal} color="#6366f1" />
              </div>
              <div style={{ marginTop:'auto', paddingTop:14, display:'flex', alignItems:'baseline', gap:5 }}>
                {goalOpt && goalOpt.adj === 0 ? (
                  <>
                    <span style={{ fontSize:20, fontWeight:800, color:'#9ca3af' }}>{tString(t, 'macro_maintain')}</span>
                    <span style={{ fontSize:13, color:'#6b7280', marginLeft:4 }}>TDEE</span>
                  </>
                ) : goalOpt ? (
                  <>
                    <span style={{ fontSize:20, fontWeight:800, color:'#9ca3af', marginRight:2 }}>{goalOpt.label}</span>
                    <span style={{ fontSize:28, fontWeight:800, color: goalOpt.adj < 0 ? '#f87171' : '#4ade80' }}>
                      {goalOpt.adj > 0 ? '+' : ''}{goalOpt.adj}
                    </span>
                    <span style={{ fontSize:13, color:'#6b7280' }}>{tString(t, 'macro_kcal_day')}</span>
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <span style={{ fontSize:12, color:'#4b5563' }}>{tString(t, 'fill_left')}</span>
          )}

          {/* Aktywny cel — przypięty na dole */}
          {activeMember?.macro_goals && (
            <div style={{ marginTop:'auto', paddingTop:12, borderTop:'1px solid #374151' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ fontSize:10, color:'#0d9488', fontWeight:600, letterSpacing:'0.05em' }}>{tString(t, 'macro_active_goal')}</div>
                {activeMember.goal && (
                  <span style={{ fontSize:10, fontWeight:700, color:'#2dd4bf', background:'#0d948822', borderRadius:5, padding:'2px 7px' }}>
                    {GOALS.find(g => g.value === activeMember.goal)?.label || activeMember.macro_goals.goalLabel}
                  </span>
                )}
              </div>
              <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
                {([['Kcal', activeMember.macro_goals.kcal, '#2dd4bf'], [tString(t, 'macro_p'), `${activeMember.macro_goals.protein}g`, '#0d9488'], [tString(t, 'macro_f'), `${activeMember.macro_goals.fat}g`, '#f59e0b'], [tString(t, 'macro_c'), `${activeMember.macro_goals.carbs}g`, '#6366f1']] as const).map(([lbl, val, color]) => (
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
          <h2 className="card-section-title">BMI</h2>
          {bmiVal !== null && bmiInfo ? (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:32, fontWeight:800, color:bmiInfo.color, lineHeight:1 }}>{bmiVal.toFixed(1)}</span>
                <div>
                  <span style={{ display:'inline-block', background:bmiInfo.color+'22', color:bmiInfo.color, borderRadius:6, padding:'2px 8px', fontSize:12, fontWeight:700 }}>{bmiInfo.label}</span>
                  <div style={{ fontSize:10, color:'#6b7280', marginTop:2 }}>{tString(t, 'macro_bmi_normal')} 18,5 – 24,9</div>
                </div>
              </div>
              <BmiGauge bmiVal={bmiVal} />
            </>
          ) : (
            <span style={{ fontSize:12, color:'#4b5563' }}>{tString(t, 'fill_left')}</span>
          )}

          <div style={{ borderTop:'1px solid #374151' }} />

          <div style={{ fontSize:11, color:'#6b7280', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{tString(t, 'macro_caloric_needs')}</div>
          {bmrVal !== null && tdeeVal !== null ? (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {[
                { label: 'BMR', sub: tString(t, 'macro_bmr_label'),  val: bmrVal,  color: '#e2e8f0' },
                { label: 'TDEE', sub: tString(t, 'macro_tdee_label'), val: tdeeVal, color: '#2dd4bf' },
              ].map(({ label, sub, val, color }) => (
                <div key={label} style={{ display:'flex', alignItems:'baseline', gap:5 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'#9ca3af', width:36 }}>{label}</span>
                  <span style={{ fontSize:20, fontWeight:700, color }}>{val}</span>
                  <span style={{ fontSize:11, color:'#6b7280' }}>{sub}</span>
                </div>
              ))}
              <div style={{ background:'#2d1515', border:'1px solid #7f1d1d', borderRadius:6, padding:'6px 8px', fontSize:11, color:'#fca5a5', lineHeight:1.5, marginTop:2 }}>
                ⚠ {tFormatN(t, 'macro_bmr_warning', bmrVal)}
              </div>
            </div>
          ) : (
            <span style={{ fontSize:12, color:'#4b5563' }}>{tString(t, 'fill_left')}</span>
          )}
        </div>
      </div>

      <MacroFormulaModal
        open={formulaOpen}
        onClose={() => setFormulaOpen(false)}
        goalOpt={goalOpt}
        weight={w || 0}
        adjPW={adjPW}
      />
    </div>
  );
}
