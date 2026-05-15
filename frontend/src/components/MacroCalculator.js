import React, { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';

const ACTIVITY = [
  { value: 1.2,   label: 'Siedzący (biurko, brak ćwiczeń)' },
  { value: 1.375, label: 'Lekka aktywność (1–3x/tydzień)' },
  { value: 1.55,  label: 'Umiarkowana (3–5x/tydzień)' },
  { value: 1.725, label: 'Wysoka (6–7x/tydzień)' },
  { value: 1.9,   label: 'Bardzo wysoka (sportowiec / praca fizyczna)' },
];

const GOALS = [
  { value: 'lose',     label: 'Redukcja',      adj:  -500, proteinPerKg: 2.2, fatPct: 0.25, warn: false },
  { value: 'maintain', label: 'Utrzymanie',     adj:     0, proteinPerKg: 1.8, fatPct: 0.27, warn: false },
  { value: 'extreme',  label: 'Ostra redukcja', adj: -1000, proteinPerKg: 2.5, fatPct: 0.25, warn: true  },
  { value: 'gain',     label: 'Masa',            adj:  +300, proteinPerKg: 2.0, fatPct: 0.25, warn: false },
];

const FORM_KEY = 'macroFormState';

function loadForm() {
  try { return JSON.parse(localStorage.getItem(FORM_KEY) || 'null'); } catch { return null; }
}

function bmi(w, h) { const hm = h / 100; return w / (hm * hm); }
function bmiCat(b) {
  if (b < 18.5) return { label: 'Niedowaga', color: '#3b82f6' };
  if (b < 25)   return { label: 'Norma',     color: '#22c55e' };
  if (b < 30)   return { label: 'Nadwaga',   color: '#eab308' };
  return               { label: 'Otyłość',   color: '#ef4444' };
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
  borderRadius: 7, padding: '8px 12px', fontSize: 14, width: '100%', boxSizing: 'border-box',
};
const sel = { ...inp };
const labelSt = { fontSize: 12, color: '#9ca3af', marginBottom: 4, display: 'block' };
const row = { marginBottom: 14 };

// ── BMI gauge ────────────────────────────────────────────────────────────────
const BMI_MIN = 10, BMI_MAX = 45;
const ZONES = [
  { from: 10,   to: 18.5, color: '#3b82f6', label: 'Niedowaga' },
  { from: 18.5, to: 25,   color: '#22c55e', label: 'Norma' },
  { from: 25,   to: 30,   color: '#eab308', label: 'Nadwaga' },
  { from: 30,   to: 45,   color: '#ef4444', label: 'Otyłość' },
];
function bmiPos(val) {
  return Math.min(100, Math.max(0, (val - BMI_MIN) / (BMI_MAX - BMI_MIN) * 100));
}

function BmiGauge({ bmiVal }) {
  const pos = bmiPos(bmiVal);
  const cat = bmiCat(bmiVal);
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
      {/* legend — active zone highlighted */}
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
  const pw = adjPW?.pw ?? weight;
  const proteinG = pw > 0 ? Math.round(pw * goalOpt.proteinPerKg) : null;
  return (
    <div style={{ background: '#1c3534', border: '1px solid #374151', borderRadius: 8, padding: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#0d9488', marginBottom: 14 }}>
        Jak liczymy makro?
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Obesity adjustment notice */}
        {adjPW?.adjusted && (
          <div style={{ background: '#1c1917', border: '1px solid #78350f', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#fcd34d', lineHeight: 1.6 }}>
            <strong>Korekta dla nadwagi / otyłości:</strong> białko liczone od masy skorygowanej{' '}
            <strong>{adjPW.pw} kg</strong> (nie od rzeczywistej {weight} kg), żeby uniknąć zawyżonych wartości.{' '}
            Wzór: idealna waga ({adjPW.ibw} kg) + 25% nadwyżki.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#0d9488', flexShrink: 0, marginTop: 3 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 3 }}>Białko</div>
            <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
              Ilość białka zależy od celu:{' '}
              <span style={{ color: '#2dd4bf' }}>
                {goalOpt.value === 'lose' && '2,2 g × kg (redukcja — ochrona mięśni)'}
                {goalOpt.value === 'maintain' && '1,8 g × kg (utrzymanie)'}
                {goalOpt.value === 'gain' && '2,0 g × kg (masa — budowa mięśni)'}
                {goalOpt.value === 'extreme' && '2,5 g × kg (ostra redukcja — maksymalna ochrona mięśni)'}
              </span>.
              {proteinG && (
                <span style={{ color: '#6b7280' }}>
                  {' '}Podstawa obliczeń: <strong style={{ color: '#2dd4bf' }}>{pw} kg</strong> → <strong style={{ color: '#2dd4bf' }}>{proteinG} g</strong>.
                </span>
              )}
              {' '}1 g białka = 4 kcal.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#f59e0b', flexShrink: 0, marginTop: 3 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 3 }}>Tłuszcze</div>
            <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
              Stały udział{' '}
              <span style={{ color: '#f59e0b' }}>{Math.round(goalOpt.fatPct * 100)}% kalorii docelowych</span> podzielony przez 9 kcal/g.
              Tłuszcze są niezbędne dla hormonów i wchłaniania witamin — poniżej 20% nie jest zalecane.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#6366f1', flexShrink: 0, marginTop: 3 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 3 }}>Węglowodany</div>
            <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
              Reszta kalorii po odjęciu białka i tłuszczów, podzielona przez 4 kcal/g.
              Wzór: <span style={{ color: '#6366f1' }}>(cel kcal − białko×4 − tłuszcz×9) ÷ 4</span>.
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #374151', paddingTop: 12, fontSize: 11, color: '#4b5563', lineHeight: 1.6 }}>
          <strong style={{ color: '#6b7280' }}>BMR</strong> (podstawowa przemiana materii) — Mifflin-St Jeor:{' '}
          <span style={{ color: '#6b7280' }}>10×waga + 6,25×wzrost − 5×wiek + 5 (M) / −161 (K)</span>.{' '}
          <strong style={{ color: '#6b7280' }}>TDEE</strong> = BMR × współczynnik aktywności.
        </div>
      </div>
    </div>
  );
}

function MacroBar({ kcal, protein, fat, carbs }) {
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
        {[['#0d9488','Białko'],['#f59e0b','Tłuszcz'],['#6366f1','Węgle']].map(([c,lbl]) => (
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

  const saved = loadForm();
  const [gender,   setGender]   = useState(saved?.gender   ?? 'm');
  const [age,      setAge]      = useState(saved?.age      ?? '');
  const [weight,   setWeight]   = useState(saved?.weight   ?? '');
  const [height,   setHeight]   = useState(saved?.height   ?? '');
  const [activity, setActivity] = useState(saved?.activity ?? 1.55);
  const [goal,     setGoal]     = useState(saved?.goal     ?? 'maintain');

  const [savedGoals, setSavedGoals] = useState(() => {
    try { return JSON.parse(localStorage.getItem('macroGoals') || 'null'); } catch { return null; }
  });

  // Persist form state
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

  function saveGoals() {
    if (!macros) return;
    const data = { ...macros, goalLabel: goalOpt.label };
    localStorage.setItem('macroGoals', JSON.stringify(data));
    setSavedGoals(data);
    showSuccess('Cele makro zapisane! Kolory pojawią się w kalendarzu.');
  }

  const bmiInfo = bmiVal ? bmiCat(bmiVal) : null;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── ROW 1: Twoje dane | BMI + BMR/TDEE + Czym jest BMR i TDEE ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

        {/* LEFT: formularz + aktywny cel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ margin: '0 0 20px', fontSize: 16, color: '#f1f5f9' }}>Twoje dane</h2>

          <div style={row}>
            <span style={labelSt}>Płeć</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['m','Mężczyzna'],['f','Kobieta']].map(([v,l]) => (
                <button key={v} onClick={() => setGender(v)}
                  style={{ flex:1, padding:'8px 0', borderRadius:7, cursor:'pointer', fontSize:13, fontWeight:600, border:'none',
                    background: gender===v ? '#0d9488' : '#2d3748', color: gender===v ? 'white' : '#9ca3af' }}>{l}</button>
              ))}
            </div>
          </div>
          <div style={row}>
            <label style={labelSt}>Wiek (lata)</label>
            <input type="number" className="no-spin" style={inp} value={age} onChange={e=>setAge(e.target.value)} placeholder="np. 28" min={10} max={100} />
          </div>
          <div style={row}>
            <label style={labelSt}>Masa ciała (kg)</label>
            <input type="number" className="no-spin" style={inp} value={weight} onChange={e=>setWeight(e.target.value)} placeholder="np. 75" min={30} max={300} />
          </div>
          <div style={row}>
            <label style={labelSt}>Wzrost (cm)</label>
            <input type="number" className="no-spin" style={inp} value={height} onChange={e=>setHeight(e.target.value)} placeholder="np. 178" min={100} max={250} />
          </div>
          <div style={row}>
            <label style={labelSt}>Poziom aktywności</label>
            <select style={sel} value={activity} onChange={e=>setActivity(e.target.value)}>
              {ACTIVITY.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div style={{ ...row, marginBottom: 0 }}>
            <span style={labelSt}>Cel</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {GOALS.map(g => {
                const isActive   = goal === g.value;
                const activeBg   = g.warn ? '#7f1d1d' : '#0d9488';
                const inactiveFg = g.warn ? '#f87171' : '#9ca3af';
                return (
                  <button key={g.value} onClick={() => setGoal(g.value)}
                    style={{ padding:'8px 6px', borderRadius:7, cursor:'pointer', fontSize:12, fontWeight:600,
                      border: g.warn && !isActive ? '1px solid #7f1d1d' : 'none',
                      background: isActive ? activeBg : '#2d3748',
                      color: isActive ? 'white' : inactiveFg }}>
                    {g.label}
                    {g.warn && <div style={{ fontSize:9, fontWeight:400, marginTop:1, opacity:0.8 }}>(niezalecane)</div>}
                  </button>
                );
              })}
            </div>
          </div>
          <button onClick={saveGoals} disabled={!macros}
            style={{ marginTop:16, width:'100%', padding:'10px 0', borderRadius:8, border:'none',
              background: macros ? '#0d9488' : '#2d3748',
              color: macros ? 'white' : '#6b7280',
              fontSize:14, fontWeight:700, cursor: macros ? 'pointer' : 'default' }}>
            Zapisz jako cel i pokaż w kalendarzu
          </button>
        </div>

          {savedGoals && (
            <div className="card" style={{ padding:16, borderColor:'#0d9488' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ fontSize:11, color:'#0d9488', fontWeight:600 }}>AKTYWNY CEL W KALENDARZU</div>
                {savedGoals.goalLabel && (
                  <span style={{ fontSize:11, fontWeight:700, color:'#2dd4bf', background:'#0d948822', borderRadius:5, padding:'2px 8px' }}>
                    {savedGoals.goalLabel}
                  </span>
                )}
              </div>
              <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                {[['Kcal', savedGoals.kcal, '#2dd4bf'],['Białko',`${savedGoals.protein}g`,'#0d9488'],['Tłuszcze',`${savedGoals.fat}g`,'#f59e0b'],['Węgle',`${savedGoals.carbs}g`,'#6366f1']].map(([lbl,val,color]) => (
                  <div key={lbl}>
                    <div style={{ fontSize:10, color:'#6b7280' }}>{lbl}</div>
                    <div style={{ fontSize:15, fontWeight:700, color }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: BMI + BMR/TDEE + Czym jest BMR i TDEE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize:12, color:'#6b7280', marginBottom:6, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>BMI</div>
            {bmiVal ? (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                  <span style={{ fontSize:36, fontWeight:800, color:bmiInfo.color, lineHeight:1 }}>{bmiVal.toFixed(1)}</span>
                  <div>
                    <span style={{ display:'inline-block', background:bmiInfo.color+'22', color:bmiInfo.color, borderRadius:6, padding:'3px 10px', fontSize:13, fontWeight:700 }}>{bmiInfo.label}</span>
                    <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>Norma: 18,5 – 24,9</div>
                  </div>
                </div>
                <BmiGauge bmiVal={bmiVal} />
              </>
            ) : (
              <span style={{ fontSize:13, color:'#4b5563' }}>Uzupełnij dane po lewej</span>
            )}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize:12, color:'#6b7280', marginBottom:12, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Zapotrzebowanie kaloryczne</div>
            {bmrVal ? (
              <div style={{ display:'flex', gap:24 }}>
                <div>
                  <div style={{ fontSize:11, color:'#6b7280' }}>BMR (podstawowe)</div>
                  <div style={{ fontSize:22, fontWeight:700, color:'#e2e8f0' }}>{bmrVal} <span style={{ fontSize:13, color:'#6b7280' }}>kcal</span></div>
                </div>
                <div style={{ width:1, background:'#374151' }} />
                <div>
                  <div style={{ fontSize:11, color:'#6b7280' }}>TDEE (z aktywnością)</div>
                  <div style={{ fontSize:22, fontWeight:700, color:'#2dd4bf' }}>{tdeeVal} <span style={{ fontSize:13, color:'#6b7280' }}>kcal</span></div>
                </div>
              </div>
            ) : (
              <span style={{ fontSize:13, color:'#4b5563' }}>Uzupełnij dane po lewej</span>
            )}
          </div>

          <div style={{ background:'#1c3534', border:'1px solid #374151', borderRadius:8, padding:20 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#0d9488', marginBottom:12 }}>Czym jest BMR i TDEE?</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ fontSize:12, color:'#9ca3af', lineHeight:1.7 }}>
                <strong style={{ color:'#e2e8f0' }}>BMR</strong> (Basic Metabolic Rate) — minimalna ilość kalorii,
                jakiej Twój organizm potrzebuje do podtrzymania funkcji życiowych w całkowitym spoczynku:
                oddychanie, praca serca, temperatura ciała, praca narządów.
              </div>
              <div style={{ fontSize:12, color:'#9ca3af', lineHeight:1.7 }}>
                <strong style={{ color:'#2dd4bf' }}>TDEE</strong> (Total Daily Energy Expenditure) — BMR pomnożone
                przez współczynnik aktywności. To rzeczywista ilość kalorii, którą spalasz każdego dnia uwzględniając
                ruch i ćwiczenia.
              </div>
              {bmrVal && (
                <div style={{ background:'#2d1515', border:'1px solid #7f1d1d', borderRadius:6, padding:'10px 12px',
                  fontSize:12, color:'#fca5a5', lineHeight:1.7 }}>
                  <strong>⚠ Nie schodź poniżej BMR ({bmrVal} kcal/dzień)!</strong> Jedzenie poniżej BMR
                  spowalnia metabolizm, powoduje utratę masy mięśniowej i prowadzi do niedoborów żywieniowych.
                  Nawet przy ostrej redukcji utrzymuj deficyt na poziomie TDEE, nie BMR.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 2: Cytaty — pełna szerokość ── */}
      <div className="card" style={{ padding: '24px 32px', display: 'flex', gap: 32 }}>
        {[
          { quote: 'Perfekcjonizm jest wrogiem postępu.', author: 'Winston Churchill' },
          { quote: 'Jesteśmy tym, co regularnie robimy. Doskonałość nie jest więc czynem, lecz nawykiem.', author: 'Arystoteles' },
        ].map(({ quote, author }) => (
          <div key={author} style={{ flex: 1, borderLeft: '3px solid #0d9488', paddingLeft: 16 }}>
            <div style={{ fontSize: 14, color: '#e2e8f0', lineHeight: 1.7, fontStyle: 'italic' }}>„{quote}"</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>— {author}</div>
          </div>
        ))}
      </div>

      {/* ── ROW 3: Cel dzienny makro | Jak liczymy makro ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

        {/* LEFT: cel dzienny makro */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ fontSize:12, color:'#6b7280', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Cel dzienny makro</div>
              {macros && (
                <div style={{ fontSize:11, color:'#6b7280' }}>
                  {goalOpt.label}
                  {goalOpt.adj !== 0 && (
                    <span style={{ color: goalOpt.adj < 0 ? '#f87171' : '#4ade80', marginLeft:4 }}>
                      {goalOpt.adj > 0 ? '+' : ''}{goalOpt.adj} kcal
                    </span>
                  )}
                </div>
              )}
            </div>
            {macros ? (
              <>
                <div style={{ fontSize:28, fontWeight:800, color:'#2dd4bf', marginBottom:4 }}>
                  {macros.kcal} <span style={{ fontSize:14, color:'#6b7280', fontWeight:400 }}>kcal/dzień</span>
                </div>
                <MacroBar {...macros} />
                <div style={{ marginTop:12 }}>
                  <MacroRow label="Białko"      value={macros.protein} unit="g" kcalVal={macros.protein*4} totalKcal={macros.kcal} color="#0d9488" />
                  <MacroRow label="Tłuszcze"    value={macros.fat}     unit="g" kcalVal={macros.fat*9}     totalKcal={macros.kcal} color="#f59e0b" />
                  <MacroRow label="Węglowodany" value={macros.carbs}   unit="g" kcalVal={macros.carbs*4}   totalKcal={macros.kcal} color="#6366f1" />
                </div>
              </>
            ) : (
              <span style={{ fontSize:13, color:'#4b5563' }}>Uzupełnij dane po lewej</span>
            )}
          </div>
        </div>

        {/* RIGHT: Jak liczymy makro */}
        <MacroLegend goalOpt={goalOpt} weight={w || 0} adjPW={adjPW} />
      </div>
    </div>
  );
}
