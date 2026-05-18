import React, { useState, useEffect } from 'react';
import { mealPlan as api, recipes as recipesApi } from '../api';
import { useMember } from '../contexts/MemberContext';
import { useToast } from '../contexts/ToastContext';

// ─── helpers ─────────────────────────────────────────────────────────────────
function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function toEU(s) {
  if (!s) return '';
  const [y,m,d] = s.split('-');
  return `${d}.${m}.${y}`;
}
function getCurrentWeek() {
  const now = new Date(); now.setHours(0,0,0,0);
  const dow = (now.getDay()+6)%7;
  const mon = new Date(now); mon.setDate(now.getDate()-dow);
  const sun = new Date(mon); sun.setDate(mon.getDate()+6);
  return { start: dateToStr(mon), end: dateToStr(sun) };
}
function getCurrentMonth() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last  = new Date(now.getFullYear(), now.getMonth()+1, 0);
  return { start: dateToStr(first), end: dateToStr(last) };
}

// ─── Drinks recalc from localStorage ─────────────────────────────────────────
function calcDrinks(days) {
  try {
    const saved = JSON.parse(localStorage.getItem('drinksConfig') || '{}');
    const cukierPrice = parseFloat(localStorage.getItem('drinksCukierPrice')) || 3.5;
    const slodzikPrice = parseFloat(localStorage.getItem('drinksSlodzikPrice')) || 15;
    const n = v => parseFloat(v) || 0;
    const priceForType = t => (3/1000) * (t === 'cukier' ? cukierPrice : slodzikPrice);
    const list = [];
    const d = saved;
    if (d.kawa?.enabled) {
      const gPerDay = n(d.kawa.cupsPerDay)*n(d.kawa.spoonsPerCup)*3;
      const daily = (gPerDay/Math.max(1,n(d.kawa.pkgG)))*n(d.kawa.pkgPrice);
      list.push({ name:'Kawa', daily, total: daily*days });
      if (d.kawa.sugarType) { const sd = n(d.kawa.cupsPerDay)*n(d.kawa.sugarSpoons)*priceForType(d.kawa.sugarType); list.push({ name:`${d.kawa.sugarType==='cukier'?'Cukier':'Słodzik'} (kawa)`, daily:sd, total:sd*days }); }
    }
    if (d.herbata?.enabled) {
      const daily = (n(d.herbata.cupsPerDay)/Math.max(1,n(d.herbata.sachetPerPkg)))*n(d.herbata.pkgPrice);
      list.push({ name:'Herbata', daily, total: daily*days });
      if (d.herbata.sugarType) { const sd = n(d.herbata.cupsPerDay)*n(d.herbata.sugarSpoons)*priceForType(d.herbata.sugarType); list.push({ name:`${d.herbata.sugarType==='cukier'?'Cukier':'Słodzik'} (herbata)`, daily:sd, total:sd*days }); }
    }
    if (d.napoje?.enabled) { const daily=(n(d.napoje.litersPerDay)/Math.max(0.001,n(d.napoje.pkgL)))*n(d.napoje.pkgPrice); list.push({name:'Napoje',daily,total:daily*days}); }
    if (d.woda?.enabled)   { const daily=(n(d.woda.litersPerDay)/Math.max(0.001,n(d.woda.pkgL)))*n(d.woda.pkgPrice); list.push({name:'Woda',daily,total:daily*days}); }
    if (d.sodaStream?.enabled) {
      const syrupDaily = n(d.sodaStream.litersPerDay)*(n(d.sodaStream.mlPer1L)/Math.max(1,n(d.sodaStream.syrupMl)))*n(d.sodaStream.syrupPrice);
      const cylDaily = n(d.sodaStream.cylinderDays) > 0 ? n(d.sodaStream.cylinderCost)/n(d.sodaStream.cylinderDays) : 0;
      const daily = syrupDaily + cylDaily;
      list.push({name:'Syrop Soda Stream', daily, total:daily*days});
    }
    return list;
  } catch { return []; }
}

// ─── Export logic ─────────────────────────────────────────────────────────────
function generateCSV(sections) {
  const s = ';';
  const rows = [];
  sections.forEach(sec => {
    rows.push(sec.title);
    if (sec.subtitle) rows.push(sec.subtitle);
    rows.push('');
    if (sec.headers) rows.push(sec.headers.join(s));
    sec.rows.forEach(r => rows.push(r.map(c => String(c ?? '')).join(s)));
    if (sec.footer) rows.push(sec.footer.join(s));
    rows.push('');
  });
  const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `eksport_${dateToStr(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="card" style={{ padding:'16px 20px', marginBottom:12 }}>
      <h2 style={{ marginBottom:14 }}>{title}</h2>
      {children}
    </div>
  );
}
function CheckRow({ checked, onChange, label, sub }) {
  return (
    <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', padding:'6px 0', userSelect:'none' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ width:15, height:15, marginTop:2, flexShrink:0 }} />
      <div>
        <div style={{ fontSize:13, color:'#e2e8f0', fontWeight:500 }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:'#6b7280', marginTop:1 }}>{sub}</div>}
      </div>
    </label>
  );
}
function ToggleChip({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      style={{ padding:'4px 12px', borderRadius:20, border:'1px solid', cursor:'pointer', fontSize:12, fontWeight:600, transition:'all 0.15s',
        background: active ? '#0d9488' : '#1f2937',
        borderColor: active ? '#0d9488' : '#374151',
        color: active ? '#fff' : '#9ca3af' }}>
      {children}
    </button>
  );
}

// ─── Macro export utilities ───────────────────────────────────────────────────
const MACRO_ACTIVITY = [
  { value: 1.2,   label: 'Siedzący (biurko, brak ćwiczeń)' },
  { value: 1.375, label: 'Lekka aktywność (1–3x/tydzień)' },
  { value: 1.55,  label: 'Umiarkowana (3–5x/tydzień)' },
  { value: 1.725, label: 'Wysoka (6–7x/tydzień)' },
  { value: 1.9,   label: 'Bardzo wysoka (sportowiec / praca fizyczna)' },
];
const MACRO_GOALS = [
  { value: 'lose',     label: 'Redukcja',      adj:  -500, proteinPerKg: 2.2, fatPct: 0.25, warn: false },
  { value: 'maintain', label: 'Utrzymanie',     adj:     0, proteinPerKg: 1.8, fatPct: 0.27, warn: false },
  { value: 'extreme',  label: 'Ostra redukcja', adj: -1000, proteinPerKg: 2.2, fatPct: 0.25, warn: true  },
  { value: 'gain',     label: 'Masa',           adj:  +300, proteinPerKg: 2.0, fatPct: 0.25, warn: false },
];
function mBmi(w,h)       { const hm=h/100; return w/(hm*hm); }
function mBmiCat(b)      { if(b<18.5) return{label:'Niedowaga',color:'#3b82f6'}; if(b<25) return{label:'Norma',color:'#22c55e'}; if(b<30) return{label:'Nadwaga',color:'#eab308'}; return{label:'Otyłość',color:'#ef4444'}; }
function mBmr(w,h,age,g) { const b=10*w+6.25*h-5*age; return g==='m'?b+5:b-161; }
function mAdj(w,h)       { const hm=h/100,ibw=25*hm*hm; if(w<=ibw) return{pw:w,adjusted:false,ibw:null}; const adj=ibw+0.25*(w-ibw); return{pw:Math.round(adj),adjusted:true,ibw:Math.round(ibw)}; }
function mCalc(w,h,tdee,g) { const{pw}=mAdj(w,h); const kcal=Math.round(tdee+g.adj); const protein=Math.round(pw*g.proteinPerKg); const fat=Math.round((g.fatPct*kcal)/9); const carbs=Math.max(0,Math.round((kcal-protein*4-fat*9)/4)); return{kcal,protein,fat,carbs}; }

function generateMacroHTML({ gender, age, weight, height, activity, goal, macros, memberName }) {
  const w=parseFloat(weight), h=parseFloat(height), a=parseInt(age), act=parseFloat(activity);
  if(!(w>0&&h>0&&a>0)||!macros) return null;
  const bmiVal  = mBmi(w,h);
  const bmiInfo = mBmiCat(bmiVal);
  const bmrVal  = Math.round(mBmr(w,h,a,gender));
  const tdeeVal = Math.round(bmrVal*act);
  const goalOpt = MACRO_GOALS.find(g=>g.value===goal) || MACRO_GOALS[1];
  const adjPW   = mAdj(w,h);
  const actLabel= MACRO_ACTIVITY.find(x=>String(x.value)===String(activity))?.label || String(activity);
  const gLabel  = gender==='m'?'Mężczyzna':'Kobieta';
  const now     = new Date();
  const dateStr = `${String(now.getDate()).padStart(2,'0')}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()}`;
  const totalKcal   = macros.kcal||1;
  const proteinKcal = macros.protein*4, fatKcal=macros.fat*9, carbsKcal=macros.carbs*4;
  const proteinPct  = Math.round(proteinKcal/totalKcal*100);
  const fatPct      = Math.round(fatKcal/totalKcal*100);
  const carbsPct    = 100-proteinPct-fatPct;

  return `<!DOCTYPE html>
<html lang="pl"><head><meta charset="UTF-8">
<title>Karta Makro${memberName?' – '+memberName:''}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:#fff;color:#111827;padding:32px 40px;max-width:800px;margin:0 auto}
.header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:22px;padding-bottom:12px;border-bottom:2px solid #0d9488}
.header h1{font-size:22px;font-weight:800;color:#0d9488}
.header .member{font-size:15px;font-weight:600;color:#374151;margin-top:2px}
.header-right{text-align:right;font-size:11px;color:#9ca3af;line-height:1.6}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.card{border:1px solid #e5e7eb;border-radius:10px;padding:16px 18px}
.card-title{font-size:10px;font-weight:700;color:#0d9488;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #f0fdf4}
.info-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f9fafb}
.info-row:last-child{border-bottom:none}
.info-label{font-size:11px;color:#6b7280}
.info-value{font-size:12px;font-weight:600;color:#111827}
.bmi-row{display:flex;align-items:center;gap:14px;margin-bottom:14px}
.bmi-number{font-size:42px;font-weight:800;line-height:1}
.bmi-badge{display:inline-block;border-radius:6px;padding:2px 10px;font-size:12px;font-weight:700}
.bmi-norm{font-size:10px;color:#9ca3af;margin-top:4px}
.energy-row{display:flex;align-items:baseline;gap:6px;padding:5px 0;border-bottom:1px solid #f9fafb}
.energy-row:last-child{border-bottom:none}
.energy-label{font-size:11px;font-weight:700;color:#9ca3af;width:44px}
.energy-val{font-size:20px;font-weight:700}
.energy-unit{font-size:11px;color:#9ca3af}
.kcal-big{font-size:36px;font-weight:800;color:#0d9488}
.kcal-unit{font-size:14px;color:#9ca3af;font-weight:400}
.goal-note{font-size:11px;color:#6b7280;margin:4px 0 14px}
.macro-bar{display:flex;height:12px;border-radius:6px;overflow:hidden;gap:2px;margin-bottom:14px}
.macro-grid{display:grid;grid-template-columns:1fr 1fr 1fr}
.macro-item{text-align:center;padding:10px 4px;border-right:1px solid #f3f4f6}
.macro-item:last-child{border-right:none}
.macro-dot{width:10px;height:10px;border-radius:3px;display:inline-block;margin-bottom:4px}
.macro-name{font-size:10px;color:#9ca3af;margin-bottom:4px}
.macro-g{font-size:22px;font-weight:800}
.macro-sub{font-size:10px;color:#9ca3af;margin-top:3px}
.adj-note{background:#fffbeb;border:1px solid #fbbf24;border-radius:6px;padding:8px 12px;font-size:11px;color:#92400e;margin-top:12px;line-height:1.6}
.warn-red{background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:8px 12px;font-size:11px;color:#991b1b;margin-top:8px;line-height:1.6}
.footer{margin-top:24px;padding-top:10px;border-top:1px solid #f3f4f6;font-size:10px;color:#d1d5db;text-align:center}
.print-btn{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 auto 24px;padding:10px 32px;background:#0d9488;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}
@media print{.print-btn{display:none!important}body{padding:12px}.card{break-inside:avoid}}
</style></head><body>
<button class="print-btn" onclick="window.print()">🖨️ Drukuj / Zapisz PDF</button>
<div class="header">
  <div class="header-left">
    <h1>Karta Makro</h1>
    ${memberName?`<div class="member">${memberName}</div>`:''}
  </div>
  <div class="header-right">Wygenerowano: ${dateStr}<br>Cel: ${goalOpt.label}</div>
</div>
<div class="grid-2">
  <div class="card">
    <div class="card-title">Dane osobowe</div>
    <div class="info-row"><span class="info-label">Płeć</span><span class="info-value">${gLabel}</span></div>
    <div class="info-row"><span class="info-label">Wiek</span><span class="info-value">${age} lat</span></div>
    <div class="info-row"><span class="info-label">Masa ciała</span><span class="info-value">${weight} kg</span></div>
    <div class="info-row"><span class="info-label">Wzrost</span><span class="info-value">${height} cm</span></div>
    <div class="info-row"><span class="info-label">Aktywność</span><span class="info-value">${actLabel}</span></div>
    <div class="info-row"><span class="info-label">Cel</span><span class="info-value">${goalOpt.label}</span></div>
  </div>
  <div class="card">
    <div class="card-title">BMI i zapotrzebowanie kaloryczne</div>
    <div class="bmi-row">
      <div class="bmi-number" style="color:${bmiInfo.color}">${bmiVal.toFixed(1)}</div>
      <div>
        <div class="bmi-badge" style="background:${bmiInfo.color}22;color:${bmiInfo.color}">${bmiInfo.label}</div>
        <div class="bmi-norm">Norma: 18,5 – 24,9</div>
      </div>
    </div>
    <div class="energy-row"><span class="energy-label">BMR</span><span class="energy-val" style="color:#374151">${bmrVal}</span><span class="energy-unit">kcal / podstawowe</span></div>
    <div class="energy-row"><span class="energy-label">TDEE</span><span class="energy-val" style="color:#0d9488">${tdeeVal}</span><span class="energy-unit">kcal / z aktywnością (×${act})</span></div>
    <div class="warn-red" style="margin-top:10px">⚠ Nie schodź poniżej BMR (${bmrVal} kcal/dzień)</div>
  </div>
</div>
<div class="card">
  <div class="card-title">Cel dzienny makro</div>
  <div class="kcal-big">${macros.kcal} <span class="kcal-unit">kcal/dzień</span></div>
  <div class="goal-note">${goalOpt.adj===0?'Utrzymanie wagi — spożywaj tyle co TDEE ('+tdeeVal+' kcal)':goalOpt.label+': '+(goalOpt.adj>0?'+':'')+goalOpt.adj+' kcal/dzień względem TDEE ('+tdeeVal+' kcal)'}</div>
  <div class="macro-bar">
    <div style="width:${proteinPct}%;background:#0d9488"></div>
    <div style="width:${fatPct}%;background:#f59e0b"></div>
    <div style="width:${carbsPct}%;background:#6366f1"></div>
  </div>
  <div class="macro-grid">
    <div class="macro-item"><span class="macro-dot" style="background:#0d9488"></span><div class="macro-name">Białko</div><div class="macro-g" style="color:#0d9488">${macros.protein}g</div><div class="macro-sub">${proteinPct}% · ${proteinKcal} kcal</div></div>
    <div class="macro-item"><span class="macro-dot" style="background:#f59e0b"></span><div class="macro-name">Tłuszcze</div><div class="macro-g" style="color:#f59e0b">${macros.fat}g</div><div class="macro-sub">${fatPct}% · ${fatKcal} kcal</div></div>
    <div class="macro-item"><span class="macro-dot" style="background:#6366f1"></span><div class="macro-name">Węglowodany</div><div class="macro-g" style="color:#6366f1">${macros.carbs}g</div><div class="macro-sub">${carbsPct}% · ${carbsKcal} kcal</div></div>
  </div>
  ${adjPW.adjusted?`<div class="adj-note">ℹ Białko liczone od masy skorygowanej <strong>${adjPW.pw} kg</strong> (protokół dla nadwagi: idealna waga ${adjPW.ibw} kg + 25% nadwyżki), nie od rzeczywistych ${weight} kg.</div>`:''}
  ${goalOpt.warn?`<div class="warn-red">⚠ Ostra redukcja (−1000 kcal/dzień) jest podejściem ekstremalnym i nie jest zalecana bez nadzoru specjalisty.</div>`:''}
</div>
<div class="footer">Wygenerowano przez aplikację Meal Planner · ${dateStr}</div>
</body></html>`;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Export() {
  const { members, activeMember } = useMember();
  const { showError } = useToast();

  const handleExportMacro = () => {
    let formData = null;
    let macros   = null;

    if (activeMember?.weight && activeMember?.height) {
      formData = { gender: activeMember.gender, age: activeMember.age, weight: activeMember.weight, height: activeMember.height, activity: activeMember.activity, goal: activeMember.goal };
      if (activeMember.macro_goals) macros = activeMember.macro_goals;
    }
    if (!formData) { try { formData = JSON.parse(localStorage.getItem('macroFormState')||'null'); } catch {} }
    if (!macros)   { try { macros   = JSON.parse(localStorage.getItem('macroGoals')||'null'); } catch {} }

    if (!formData || !(parseFloat(formData.weight)>0 && parseFloat(formData.height)>0 && parseInt(formData.age)>0)) {
      showError('Uzupełnij dane w Kalkulatorze Makro i zapisz je przed eksportem.');
      return;
    }
    if (!macros) {
      const w=parseFloat(formData.weight), h=parseFloat(formData.height);
      const bmrV = Math.round(mBmr(w, h, parseInt(formData.age), formData.gender));
      const tdeeV = Math.round(bmrV * parseFloat(formData.activity||1.55));
      const goalOpt = MACRO_GOALS.find(g=>g.value===formData.goal)||MACRO_GOALS[1];
      macros = mCalc(w, h, tdeeV, goalOpt);
    }

    const html = generateMacroHTML({ ...formData, macros, memberName: activeMember?.name || '' });
    if (!html) { showError('Nie udało się wygenerować karty — sprawdź dane w kalkulatorze.'); return; }
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  };
  const [selectedMemberIds, setSelectedMemberIds] = useState(() => activeMember ? [activeMember.id] : []);
  useEffect(() => {
    if (members.length > 0 && selectedMemberIds.length === 0) setSelectedMemberIds(members.map(m => m.id));
  }, [members]); // eslint-disable-line
  const toggleMember = id => setSelectedMemberIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);

  // Co eksportujemy
  const [expWeek,   setExpWeek]   = useState(true);
  const [expMonth,  setExpMonth]  = useState(false);
  const [expCustom, setExpCustom] = useState(false);
  const [expDrinks, setExpDrinks] = useState(false);
  const [expTpl,    setExpTpl]    = useState(false);
  const [expRecipe, setExpRecipe] = useState(false);
  const [customRange, setCustomRange] = useState({ start:'', end:'' });
  const [selectedRecipeId, setSelectedRecipeId] = useState('');

  // Pola produktów
  const [fldGram,    setFldGram]    = useState(true);
  const [fldPkg,     setFldPkg]     = useState(true);
  const [fldSzt,     setFldSzt]     = useState(true);
  const [fldPrice,   setFldPrice]   = useState(true);
  const [fldShop,    setFldShop]    = useState(true);
  const [fldCost,    setFldCost]    = useState(true);

  const [recipes, setRecipes] = useState([]);
  const [templates] = useState(() => { try { return JSON.parse(localStorage.getItem('weekTemplates')||'[]'); } catch { return []; } });
  const [loading, setLoading] = useState(false);

  useEffect(() => { recipesApi.getAll().then(r => setRecipes(r.data)).catch(()=>{}); }, []);

  const week  = getCurrentWeek();
  const month = getCurrentMonth();
  const memberLabel = members.filter(m => selectedMemberIds.includes(m.id)).map(m => m.name).join(', ');
  const mids = selectedMemberIds.length > 0 ? selectedMemberIds : activeMember ? [activeMember.id] : [];

  const handleExport = async () => {
    setLoading(true);
    const sections = [];
    const sep = ';';

    const productHeaders = ['Produkt', fldGram&&'Gram. użyta', fldPkg&&'Pojemność opak.', fldSzt&&'Szt.', fldPrice&&'Cena/opak. (zł)', fldShop&&'Zakupy (zł)', fldCost&&'Koszt (zł)'].filter(Boolean);

    const buildProductRows = (items) => items.map(item => {
      const szt = item.sold_by_weight ? item.packages_exact?.toFixed(3) : item.packages_rounded;
      return [
        item.product_name,
        fldGram  && `${item.total_weight} ${item.unit||'g'}`,
        fldPkg   && `${item.package_weight} ${item.unit||'g'}`,
        fldSzt   && szt,
        fldPrice && item.price_per_package?.toFixed(2),
        fldShop  && item.actual_cost?.toFixed(2),
        fldCost  && item.total_cost?.toFixed(2),
      ].filter((v,i) => productHeaders[i] !== undefined ? true : false).filter((_,i) => i < productHeaders.length);
    });

    const addPeriodSection = async (label, range) => {
      try {
        const res = await api.getSummary(range.start, range.end, mids);
        const d = res.data;
        const days = Math.round((new Date(range.end)-new Date(range.start))/86400000)+1;
        const drinks = expDrinks ? calcDrinks(days) : [];
        const total = d.total_cost + drinks.reduce((s,i)=>s+i.total,0);
        const sec = {
          title: `${label};${toEU(range.start)} – ${toEU(range.end)}`,
          subtitle: memberLabel ? `Uwzględnieni;${memberLabel}` : '',
          headers: productHeaders,
          rows: buildProductRows(d.items),
          footer: null,
        };
        if (drinks.length > 0) {
          sec.rows.push(['']);
          sec.rows.push(['Napoje i wydatki regularne', ...Array(productHeaders.length-1).fill('')]);
          drinks.forEach(dr => {
            const row = Array(productHeaders.length).fill('');
            row[0] = dr.name;
            if (fldShop) row[productHeaders.indexOf('Zakupy (zł)')] = dr.daily.toFixed(2)+' zł/dzień';
            if (fldCost) row[productHeaders.indexOf('Koszt (zł)')] = dr.total.toFixed(2);
            sec.rows.push(row);
          });
        }
        const totalRow = Array(productHeaders.length).fill('');
        totalRow[0] = 'Łączny koszt';
        totalRow[productHeaders.length-1] = total.toFixed(2);
        sec.rows.push(['']);
        sec.rows.push(totalRow);
        sections.push(sec);
      } catch {}
    };

    if (expWeek)   await addPeriodSection('Bieżący tydzień', week);
    if (expMonth)  await addPeriodSection('Bieżący miesiąc', month);
    if (expCustom && customRange.start && customRange.end) await addPeriodSection('Wybrany okres', customRange);

    if (expDrinks && !expWeek && !expMonth && !expCustom) {
      const days = 7;
      const drinks = calcDrinks(days);
      if (drinks.length > 0) {
        sections.push({
          title: 'Napoje i wydatki regularne (tydzień)',
          headers: ['Napój', 'zł/dzień', 'Łącznie (zł)'],
          rows: drinks.map(d => [d.name, d.daily.toFixed(2), d.total.toFixed(2)]),
          footer: ['Łącznie', '', drinks.reduce((s,i)=>s+i.total,0).toFixed(2)],
        });
      }
    }

    if (expTpl && templates.length > 0) {
      sections.push({
        title: 'Szablony tygodniowe',
        headers: ['Szablon', 'Liczba posiłków'],
        rows: templates.map(t => [t.name, t.meals?.length ?? 0]),
      });
    }

    if (expRecipe && selectedRecipeId) {
      const recipe = recipes.find(r => String(r.id) === selectedRecipeId);
      if (recipe) {
        sections.push({
          title: `Przepis: ${recipe.name}`,
          headers: ['Składnik', 'Ilość', 'Jednostka', 'Koszt (zł)'],
          rows: (recipe.ingredients || []).map(ing => [ing.product_name, ing.weight, ing.unit||'g', ing.cost?.toFixed(2)]),
          footer: ['Łączny koszt przepisu', '', '', recipe.total_cost?.toFixed(2)],
        });
      }
    }

    if (sections.length === 0) { setLoading(false); return; }
    generateCSV(sections);
    setLoading(false);
  };

  return (
    <div>
      <div className="card" style={{ padding:'16px 20px', marginBottom:12 }}>
        <h1 style={{ marginBottom:4 }}>Eksport danych</h1>
        <p style={{ fontSize:13, color:'#6b7280', margin:0 }}>Wybierz co chcesz wyeksportować i jakie pola uwzględnić, następnie wygeneruj plik CSV.</p>
      </div>

      <Section title="Karta Makro dla klienta">
        <p style={{ fontSize:13, color:'#9ca3af', marginBottom:14, lineHeight:1.6 }}>
          Generuje gotowy dokument do wydruku lub zapisu jako PDF — z danymi osobowymi, BMI, TDEE i celami makro.
          Dane są pobierane z <strong style={{ color:'#e2e8f0' }}>Kalkulatora Makro</strong>.
        </p>
        <button className="btn btn-primary" onClick={handleExportMacro}
          style={{ padding:'9px 22px', fontSize:14, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:16 }}>🖨️</span> Generuj kartę makro
        </button>
      </Section>

      {members.length > 1 && (
        <Section title="Kogo uwzględniamy">
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {members.map((m, idx) => {
              const checked = selectedMemberIds.includes(m.id);
              const color = ['#0d9488','#6366f1','#f59e0b','#ec4899','#22c55e','#ef4444'][idx%6];
              return (
                <button key={m.id} onClick={() => toggleMember(m.id)}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 14px', borderRadius:20, cursor:'pointer', fontSize:12, fontWeight: checked?700:400, transition:'all 0.15s',
                    border:`1px solid ${checked?color:'#374151'}`, background: checked?`${color}22`:'#1f2937', color: checked?color:'#6b7280' }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background: checked?color:'#374151', flexShrink:0 }} />
                  {m.name}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Co eksportować">
        <CheckRow checked={expWeek} onChange={setExpWeek} label="Bieżący tydzień" sub={`${toEU(week.start)} – ${toEU(week.end)}`} />
        <CheckRow checked={expMonth} onChange={setExpMonth} label="Bieżący miesiąc" sub={`${toEU(month.start)} – ${toEU(month.end)}`} />
        <CheckRow checked={expCustom} onChange={setExpCustom} label="Wybrany okres" />
        {expCustom && (
          <div style={{ marginLeft:25, display:'flex', gap:12, marginBottom:4, flexWrap:'wrap' }}>
            {[{key:'start',label:'Od'},{key:'end',label:'Do'}].map(({key,label}) => (
              <div key={key}>
                <div style={{ fontSize:11, color:'#6b7280', marginBottom:3 }}>{label}</div>
                <div style={{ position:'relative' }}>
                  <input type="text" readOnly placeholder="dd.mm.rrrr"
                    value={customRange[key] ? toEU(customRange[key]) : ''}
                    style={{ padding:'6px 10px', border:'1px solid #374151', borderRadius:6, fontSize:13, color:'#f1f5f9', background:'#111827', width:130, cursor:'pointer' }} />
                  <input type="date" value={customRange[key]||''}
                    onChange={e => setCustomRange(r=>({...r,[key]:e.target.value}))}
                    style={{ position:'absolute', inset:0, opacity:0, width:'100%', height:'100%', cursor:'pointer' }} />
                </div>
              </div>
            ))}
          </div>
        )}
        <CheckRow checked={expDrinks} onChange={setExpDrinks} label="Napoje i wydatki regularne" sub="Dołącz koszty napojów z ustawień w Wydatkach" />
        <CheckRow checked={expTpl} onChange={setExpTpl} label="Szablony tygodniowe" sub={`${templates.length} szablonów`} />
        <CheckRow checked={expRecipe} onChange={setExpRecipe} label="Wybrany przepis" />
        {expRecipe && (
          <div style={{ marginLeft:25, marginBottom:4 }}>
            <select value={selectedRecipeId} onChange={e => setSelectedRecipeId(e.target.value)}
              style={{ padding:'6px 10px', fontSize:13, borderRadius:6, border:'1px solid #374151', background:'#111827', color:'#e2e8f0', minWidth:220 }}>
              <option value="">— wybierz przepis —</option>
              {recipes.map(r => <option key={r.id} value={String(r.id)}>{r.name}</option>)}
            </select>
          </div>
        )}
      </Section>

      {(expWeek || expMonth || expCustom) && (
        <Section title="Pola produktów">
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {[
              [fldGram,  setFldGram,  'Gram. użyta'],
              [fldPkg,   setFldPkg,   'Pojemność opak.'],
              [fldSzt,   setFldSzt,   'Szt.'],
              [fldPrice, setFldPrice, 'Cena/opak.'],
              [fldShop,  setFldShop,  'Zakupy'],
              [fldCost,  setFldCost,  'Koszt'],
            ].map(([val, set, lbl]) => (
              <ToggleChip key={lbl} active={val} onClick={() => set(v=>!v)}>{lbl}</ToggleChip>
            ))}
          </div>
        </Section>
      )}

      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
        <button className="btn btn-primary" onClick={handleExport} disabled={loading}
          style={{ padding:'10px 28px', fontSize:15, fontWeight:700 }}>
          {loading ? 'Generuję...' : '↓ Generuj CSV'}
        </button>
      </div>
    </div>
  );
}
