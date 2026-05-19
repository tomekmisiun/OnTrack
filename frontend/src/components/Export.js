import React, { useState, useEffect } from 'react';
import { mealPlan as api, recipes as recipesApi } from '../api';
import { useMember } from '../contexts/MemberContext';
import { useToast } from '../contexts/ToastContext';
import { dateToStr, toEU, getCurrentWeek, getCurrentMonth, getCalGrid, MONTH_NAMES_PL } from '../utils/dates';

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

// ─── Other expenses summary (reads from localStorage, monthly→daily) ──────────
function calcOtherSummary(days) {
  try {
    const n = v => parseFloat(v) || 0;
    const saved = JSON.parse(localStorage.getItem('otherExpenses') || '{}');
    const ORDER = [
      ['czynsz','Czynsz'],['prad','Prąd'],['gaz_oplata','Gaz'],['media','Media'],
      ['ogrzewanie','Ogrzewanie'],['kredyt','Kredyt'],['dziecko','Dziecko'],
      ['zwierze','Zwierzę'],['lekarze','Lekarze i leki'],['paliwo','Paliwo'],
      ['pranie','Pranie'],['zmywanie','Zmywanie'],['sprzatan','Sprzątanie'],
      ['higiena','Higiena'],['biurowe','Art. biurowe'],
    ];
    return ORDER.map(([key, label]) => {
      const o = saved[key];
      if (!o || !o.enabled) return null;
      const daily = n(o.monthlyAmount) / 30;
      return daily > 0 ? { label, total: daily * days } : null;
    }).filter(Boolean);
  } catch { return []; }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
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

// ─── Wydatki HTML generator (podsumowanie kategorii) ─────────────────────────
function generateWydatkiHTML({ categories, total, periodLabel, memberLabel }) {
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2,'0')}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()}`;
  const rows = categories.map((cat, i) =>
    `<div class="cat-row ${i % 2 === 1 ? 'cat-alt' : ''}">
      <span class="cat-label">${cat.label}</span>
      <span class="cat-value">${cat.value.toFixed(2)} zł</span>
    </div>`
  ).join('');
  return `<!DOCTYPE html>
<html lang="pl"><head><meta charset="UTF-8">
<title>Podsumowanie wydatków</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:#fff;color:#111827;padding:32px 40px;max-width:600px;margin:0 auto}
.print-btn{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 auto 24px;padding:10px 32px;background:#0d9488;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}
.hdr{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:22px;padding-bottom:12px;border-bottom:2px solid #0d9488}
h1{font-size:22px;font-weight:800;color:#0d9488}
.period{font-size:13px;color:#374151;margin-top:4px}
.member{font-size:12px;color:#6b7280;margin-top:2px}
.meta{font-size:11px;color:#9ca3af;text-align:right;line-height:1.7}
.cat-row{display:flex;justify-content:space-between;align-items:center;padding:11px 14px;border-radius:6px}
.cat-alt{background:#f9fafb}
.cat-label{font-size:15px;color:#374151}
.cat-value{font-size:16px;font-weight:600;color:#111827}
.cat-total{display:flex;justify-content:space-between;align-items:center;padding:13px 14px;margin-top:8px;border-top:2px solid #0d9488;background:#f0fdf4;border-radius:6px}
.cat-total-label{font-size:15px;font-weight:700;color:#0d9488}
.cat-total-value{font-size:22px;font-weight:800;color:#0d9488}
.footer{margin-top:24px;padding-top:10px;border-top:1px solid #f3f4f6;font-size:10px;color:#d1d5db;text-align:center}
@media print{.print-btn{display:none!important}body{padding:12px}}
</style></head><body>
<button class="print-btn" onclick="window.print()">Drukuj / Zapisz PDF</button>
<div class="hdr">
  <div>
    <h1>Podsumowanie wydatków</h1>
    <div class="period">${periodLabel}</div>
    ${memberLabel ? `<div class="member">${memberLabel}</div>` : ''}
  </div>
  <div class="meta">Wygenerowano: ${dateStr}</div>
</div>
${rows}
<div class="cat-total">
  <span class="cat-total-label">Łącznie</span>
  <span class="cat-total-value">${total.toFixed(2)} zł</span>
</div>
<div class="footer">Wygenerowano przez aplikację Meal Planner · ${dateStr}</div>
</body></html>`;
}

// ─── Karta Kalendarza HTML generator ─────────────────────────────────────────
function generateKalendarzHTML({ mealsByDate, start, end, periodLabel, memberName }) {
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2,'0')}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()}`;
  const todayStr = dateToStr(now);

  const startD = new Date(start);
  const endD   = new Date(end);
  const sDow   = (startD.getDay() + 6) % 7;
  const gridStart = new Date(startD); gridStart.setDate(gridStart.getDate() - sDow);
  const eDow   = (endD.getDay() + 6) % 7;
  const gridEnd   = new Date(endD); if (eDow < 6) gridEnd.setDate(gridEnd.getDate() + (6 - eDow));

  const days = [];
  const cur = new Date(gridStart);
  while (cur <= gridEnd) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }

  const SLOT_NAMES  = ['Śniadanie','II śniadanie','Obiad','Podwieczorek','Kolacja'];
  const SLOT_COLORS = ['#4a6fa5','#93c5fd','#fcd34d','#c2410c','#6366f1'];
  const DAY_SHORT   = ['Pn','Wt','Śr','Cz','Pt','So','Nd'];
  const DAY_FULL    = ['Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota','Niedziela'];

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const weeksHTML = weeks.map(week => {
    const cellsHTML = week.map(day => {
      const ds      = dateToStr(day);
      const isToday = ds === todayStr;
      const inRange = ds >= start && ds <= end;
      const meals   = (mealsByDate[ds] || []).slice().sort((a, b) => a.position - b.position);
      const dow     = (day.getDay() + 6) % 7;

      const mealsHTML = meals.map(m => {
        const col  = SLOT_COLORS[(m.position - 1) % 5];
        const name = m.recipe?.name || '';
        return `<div style="background:${col}22;border-left:3px solid ${col};border-radius:4px;padding:3px 6px;margin-bottom:3px">
          <div style="font-size:8px;font-weight:700;color:${col};text-transform:uppercase;letter-spacing:.4px">${SLOT_NAMES[m.position-1]}</div>
          <div style="font-size:10px;font-weight:600;color:#111827;line-height:1.3">${name}</div>
        </div>`;
      }).join('');

      const totalKcal    = meals.reduce((s, m) => s + (m.recipe?.total_kcal    || 0), 0);
      const totalProtein = meals.reduce((s, m) => s + (m.recipe?.total_protein || 0), 0);
      const totalFat     = meals.reduce((s, m) => s + (m.recipe?.total_fat     || 0), 0);
      const totalCarbs   = meals.reduce((s, m) => s + (m.recipe?.total_carbs   || 0), 0);
      const hasMacro     = totalKcal > 0 || totalProtein > 0;

      const dayFooter = hasMacro ? `<div class="day-footer">
        <div class="kcal-row">${totalKcal} kcal</div>
        <div class="macro-row">B:${Math.round(totalProtein)}g · T:${Math.round(totalFat)}g · W:${Math.round(totalCarbs)}g</div>
      </div>` : '';

      return `<div style="border:${isToday ? '2px solid #0d9488' : '1px solid #e5e7eb'};border-radius:7px;padding:7px;background:${isToday ? '#f0fdf4' : '#fff'};opacity:${inRange ? 1 : 0.45};min-height:72px;display:flex;flex-direction:column">
        <div style="font-size:11px;font-weight:${isToday ? 700 : 600};color:${isToday ? '#0d9488' : '#374151'};margin-bottom:5px;padding-bottom:4px;border-bottom:1px solid #f3f4f6">
          ${DAY_SHORT[dow]} ${day.getDate()}${isToday ? ' (dziś)' : ''}
        </div>
        <div style="flex:1">
          ${mealsHTML || '<div style="font-size:10px;color:#e5e7eb;text-align:center;padding:5px 0">—</div>'}
        </div>
        ${dayFooter}
      </div>`;
    }).join('');
    return `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:5px">${cellsHTML}</div>`;
  }).join('');

  const legendHTML = SLOT_NAMES.map((n, i) =>
    `<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#6b7280">
      <div style="width:10px;height:10px;border-radius:2px;background:${SLOT_COLORS[i]};flex-shrink:0"></div>${n}
    </div>`
  ).join('');

  const headerRowHTML = DAY_FULL.map(d =>
    `<div style="font-size:10px;font-weight:700;color:#9ca3af;text-align:center;padding:4px;text-transform:uppercase;letter-spacing:.5px">${d}</div>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="pl"><head><meta charset="UTF-8">
<title>Karta Kalendarza</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:#fff;color:#111827;padding:24px 32px;max-width:1100px;margin:0 auto}
.print-btn{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 auto 16px;padding:10px 32px;background:#0d9488;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}
.options-bar{display:flex;gap:20px;flex-wrap:wrap;margin-bottom:16px;padding:10px 16px;background:#f0fdf4;border:1px solid #a7f3d0;border-radius:8px;align-items:center}
.opt-title{font-size:12px;font-weight:700;color:#0d9488;margin-right:4px}
.opt-label{display:flex;align-items:center;gap:7px;font-size:13px;color:#374151;cursor:pointer;font-weight:500;user-select:none}
.opt-label input[type="checkbox"]{width:15px;height:15px;accent-color:#0d9488;cursor:pointer}
.footer{margin-top:20px;padding-top:10px;border-top:1px solid #f3f4f6;font-size:10px;color:#d1d5db;text-align:center}
.day-footer{border-top:1px solid #f0f0f0;margin-top:5px;padding-top:4px}
.kcal-row{font-size:11px;font-weight:700;color:#0d9488;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.macro-row{font-size:9px;color:#6b7280;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
body.hide-kcal .kcal-row{display:none}
body.hide-macro .macro-row{display:none}
body.hide-kcal.hide-macro .day-footer{display:none}
@media print{
  .print-btn,.no-print{display:none!important}
  body{padding:8px}
}
</style></head><body>
<button class="print-btn" onclick="window.print()">Drukuj / Zapisz PDF</button>
<div class="options-bar no-print">
  <span class="opt-title">Opcje widoku:</span>
  <label class="opt-label">
    <input type="checkbox" id="show-kcal" checked onchange="document.body.classList.toggle('hide-kcal',!this.checked)">
    kcal w dniach
  </label>
  <label class="opt-label">
    <input type="checkbox" id="show-macro" checked onchange="document.body.classList.toggle('hide-macro',!this.checked)">
    Makro B/T/W w dniach
  </label>
</div>
<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #0d9488">
  <div>
    <div style="font-size:22px;font-weight:800;color:#0d9488">Karta Kalendarza</div>
    <div style="font-size:13px;color:#374151;margin-top:4px">${periodLabel}</div>
    ${memberName ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${memberName}</div>` : ''}
  </div>
  <div style="font-size:11px;color:#9ca3af;text-align:right;line-height:1.7">Wygenerowano: ${dateStr}</div>
</div>
<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">${legendHTML}</div>
<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:5px">${headerRowHTML}</div>
${weeksHTML}
<div class="footer">Wygenerowano przez aplikację Meal Planner · ${dateStr}</div>
</body></html>`;
}

// ─── Składniki przepisu HTML generator ───────────────────────────────────────
function generateSkladnikiHTML(recipe) {
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2,'0')}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()}`;
  const rows = (recipe.ingredients || []).map(ing =>
    `<tr>
      <td>${ing.product_name}</td>
      <td class="num">${ing.weight}</td>
      <td>${ing.unit || 'g'}</td>
      <td class="cost">${ing.cost != null ? ing.cost.toFixed(2) + ' zł' : '—'}</td>
    </tr>`
  ).join('');

  const hasKcal = recipe.total_kcal > 0;
  const macroHTML = hasKcal ? `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:20px">
    ${[['Kalorie', recipe.total_kcal, 'kcal', '#0d9488'],
       ['Białko',  Math.round(recipe.total_protein), 'g', '#0d9488'],
       ['Tłuszcze',Math.round(recipe.total_fat),     'g', '#f59e0b'],
       ['Węglowodany',Math.round(recipe.total_carbs),'g', '#6366f1']].map(([l,v,u,c]) =>
      `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 16px;text-align:center">
        <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">${l}</div>
        <div style="font-size:20px;font-weight:800;color:${c}">${v}</div>
        <div style="font-size:11px;color:#9ca3af">${u}</div>
      </div>`).join('')}
  </div>` : '';

  return `<!DOCTYPE html>
<html lang="pl"><head><meta charset="UTF-8">
<title>Składniki: ${recipe.name}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:#fff;color:#111827;padding:32px 40px;max-width:700px;margin:0 auto}
.print-btn{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 auto 24px;padding:10px 32px;background:#0d9488;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}
.hdr{margin-bottom:22px;padding-bottom:12px;border-bottom:2px solid #0d9488}
h1{font-size:24px;font-weight:800;color:#0d9488}
.sub{font-size:12px;color:#9ca3af;margin-top:4px}
table{width:100%;border-collapse:collapse;margin-top:4px}
th{font-size:11px;font-weight:700;color:#0d9488;text-transform:uppercase;letter-spacing:.5px;padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb}
th.num,th.cost{text-align:right}
td{padding:9px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151}
tr:nth-child(even) td{background:#fafafa}
td.num{text-align:right}
td.cost{text-align:right;font-weight:700;color:#111827}
tfoot td{font-weight:700;border-top:2px solid #0d9488;background:#f0fdf4;padding:10px}
.tlabel{font-size:14px;color:#0d9488}
.tval{text-align:right;font-size:16px;color:#0d9488}
.footer{margin-top:24px;padding-top:10px;border-top:1px solid #f3f4f6;font-size:10px;color:#d1d5db;text-align:center}
@media print{.print-btn{display:none!important}body{padding:12px}}
</style></head><body>
<button class="print-btn" onclick="window.print()">Drukuj / Zapisz PDF</button>
<div class="hdr">
  <h1>${recipe.name}</h1>
  <div class="sub">Wygenerowano: ${dateStr} · ${recipe.ingredients?.length || 0} składników</div>
</div>
<table>
<thead><tr>
  <th>Składnik</th><th class="num">Ilość</th><th>Jednostka</th><th class="cost">Koszt</th>
</tr></thead>
<tbody>${rows}</tbody>
${recipe.total_cost != null ? `<tfoot><tr>
  <td colspan="3" class="tlabel">Łączny koszt przepisu</td>
  <td class="tval">${recipe.total_cost.toFixed(2)} zł</td>
</tr></tfoot>` : ''}
</table>
${macroHTML}
<div class="footer">Wygenerowano przez aplikację Meal Planner · ${dateStr}</div>
</body></html>`;
}

// ─── Lista zakupów HTML generator ────────────────────────────────────────────
function generateShopListHTML({ items, total, selectedDays, memberLabel }) {
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2,'0')}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()}`;
  const daysStr = selectedDays.map(d => toEU(d)).join(', ');

  const rows = items.map(item => {
    const pkgStr = item.sold_by_weight
      ? 'na wagę'
      : `${item.packages_rounded} szt.`;
    return `<tr>
      <td class="no-print del-cell">
        <button class="del-btn" onclick="this.closest('tr').remove()">Usuń</button>
      </td>
      <td>${item.product_name}</td>
      <td class="num">${item.total_weight} ${item.unit || 'g'}</td>
      <td>${pkgStr}</td>
      <td class="num">${item.price_per_package?.toFixed(2)} zł</td>
      <td class="check"><input type="checkbox" /></td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pl"><head><meta charset="UTF-8">
<title>Lista zakupów</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:#fff;color:#111827;padding:32px 40px;max-width:900px;margin:0 auto}
.print-btn{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 auto 24px;padding:10px 32px;background:#0d9488;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}
.hdr{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:22px;padding-bottom:12px;border-bottom:2px solid #0d9488}
h1{font-size:22px;font-weight:800;color:#0d9488}
.days-label{font-size:12px;color:#374151;margin-top:5px;line-height:1.5}
.member{font-size:11px;color:#6b7280;margin-top:2px}
.meta{font-size:11px;color:#9ca3af;text-align:right;line-height:1.7}
.badges{display:flex;gap:8px;margin-top:7px;flex-wrap:wrap;align-items:center}
.badge{background:#f0fdf4;border:1px solid #a7f3d0;border-radius:4px;padding:2px 8px;font-size:11px;color:#0d9488;font-weight:600}
.cost-badge{background:#f0fdf4;border:1px solid #0d9488;border-radius:4px;padding:2px 10px;font-size:12px;color:#0d9488;font-weight:700}
table{width:100%;border-collapse:collapse;margin-top:4px}
th{font-size:11px;font-weight:700;color:#0d9488;text-transform:uppercase;letter-spacing:.5px;padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb}
th.num{text-align:right}
th.check-col{text-align:center;width:80px}
td{padding:9px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151;vertical-align:middle}
tr:nth-child(even) td{background:#fafafa}
td.num{text-align:right}
td.check{text-align:center}
td.del-cell{width:56px;padding:6px 6px}
input[type="checkbox"]{width:16px;height:16px;cursor:pointer;accent-color:#0d9488;vertical-align:middle}
.del-btn{background:#fef2f2;border:1px solid #fca5a5;border-radius:4px;color:#ef4444;font-size:11px;font-weight:600;padding:3px 8px;cursor:pointer;white-space:nowrap}
.del-btn:hover{background:#fee2e2}
.footer{margin-top:24px;padding-top:10px;border-top:1px solid #f3f4f6;font-size:10px;color:#d1d5db;text-align:center}
@media print{
  .print-btn,.no-print{display:none!important}
  body{padding:12px}
  tr{break-inside:avoid}
  input[type="checkbox"]{appearance:none;-webkit-appearance:none;width:14px;height:14px;border:1.5px solid #9ca3af;border-radius:3px;display:inline-block;vertical-align:middle}
}
</style></head><body>
<button class="print-btn" onclick="window.print()">Drukuj / Zapisz PDF</button>
<div class="hdr">
  <div>
    <h1>Lista zakupów</h1>
    <div class="days-label">Dni: ${daysStr}</div>
    ${memberLabel ? `<div class="member">${memberLabel}</div>` : ''}
    <div class="badges">
      <span class="badge">${items.length} produktów</span>
      <span class="cost-badge">Szac. koszt: ${total.toFixed(2)} zł</span>
    </div>
  </div>
  <div class="meta">Wygenerowano: ${dateStr}</div>
</div>
<table>
<thead><tr>
  <th class="no-print"></th>
  <th>Produkt</th>
  <th class="num">Potrzebne</th>
  <th>Opakowania</th>
  <th class="num">Szac. cena/opak.</th>
  <th class="check-col">W koszyku?</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>
<div class="footer">Wygenerowano przez aplikację Meal Planner · ${dateStr}</div>
</body></html>`;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Export({ onGoToTab }) {
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
    if (activeMember) setSelectedMemberIds([activeMember.id]);
  }, [activeMember?.id]); // eslint-disable-line
  const toggleMember = id => {
    if (id === activeMember?.id) return;
    setSelectedMemberIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Składniki przepisu — collapsible + search
  const [skladnikiOpen,   setSkladnikiOpen]   = useState(false);
  const [skladnikiSearch, setSkladnikiSearch] = useState('');

  // Generuj dokumenty HTML
  const [htmlPeriod,   setHtmlPeriod]   = useState('week');
  const [htmlCustom,   setHtmlCustom]   = useState({ start:'', end:'' });
  const [htmlRecipeId, setHtmlRecipeId] = useState('');
  const [htmlWLoading, setHtmlWLoading] = useState(false);
  const [htmlKLoading, setHtmlKLoading] = useState(false);

  // Lista zakupów — kalendarz z zaznaczaniem dni
  const [shopYear,  setShopYear]  = useState(() => new Date().getFullYear());
  const [shopMonth, setShopMonth] = useState(() => new Date().getMonth());
  const [shopDays,  setShopDays]  = useState(() => new Set());
  const [shopLoading, setShopLoading] = useState(false);
  const [shopMemberIds, setShopMemberIds] = useState(() => activeMember ? [activeMember.id] : []);
  useEffect(() => {
    if (activeMember) setShopMemberIds([activeMember.id]);
  }, [activeMember?.id]); // eslint-disable-line

  const [recipes, setRecipes] = useState([]);
  useEffect(() => { recipesApi.getAll().then(r => setRecipes(r.data)).catch(()=>{}); }, []);

  const [previewMeals, setPreviewMeals] = useState({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const midsKey = selectedMemberIds.join(',');
  useEffect(() => {
    const w = getCurrentWeek(), mo = getCurrentMonth();
    const range = htmlPeriod === 'week' ? w
      : htmlPeriod === 'month' ? mo
      : (htmlCustom.start && htmlCustom.end) ? htmlCustom : w;
    if (!range.start || !range.end) return;
    setPreviewLoading(true);
    const ids = selectedMemberIds;
    api.getRange(range.start, range.end, ids).then(r => { setPreviewMeals(r.data || {}); setPreviewLoading(false); }).catch(() => setPreviewLoading(false));
  }, [midsKey, htmlPeriod, htmlCustom.start, htmlCustom.end]); // eslint-disable-line

  const week  = getCurrentWeek();
  const month = getCurrentMonth();
  const memberLabel = members.filter(m => selectedMemberIds.includes(m.id)).map(m => m.name).join(', ');
  const mids = selectedMemberIds;

  // Shop list helpers
  const shopMids = shopMemberIds;
  const shopMemberLabel = members.filter(m => shopMemberIds.includes(m.id)).map(m => m.name).join(', ');
  const toggleShopMember = id => {
    if (id === activeMember?.id) return;
    setShopMemberIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleShopDay = ds => setShopDays(prev => { const n = new Set(prev); n.has(ds) ? n.delete(ds) : n.add(ds); return n; });
  const prevShopMonth = () => { if (shopMonth === 0) { setShopYear(y => y-1); setShopMonth(11); } else setShopMonth(m => m-1); };
  const nextShopMonth = () => { if (shopMonth === 11) { setShopYear(y => y+1); setShopMonth(0); } else setShopMonth(m => m+1); };
  const selectShopWeek = () => {
    const { start, end } = getCurrentWeek();
    const s = new Set(); let d = new Date(start); const e = new Date(end);
    while (d <= e) { s.add(dateToStr(d)); d.setDate(d.getDate()+1); }
    setShopDays(s);
  };
  const selectShopMonth = () => {
    const s = new Set(getCalGrid(shopYear, shopMonth).filter(d => d.getMonth() === shopMonth).map(dateToStr));
    setShopDays(s);
  };
  const handleGenShopList = async () => {
    if (shopDays.size === 0) { showError('Zaznacz co najmniej jeden dzień'); return; }
    setShopLoading(true);
    try {
      const days = [...shopDays].sort();
      const results = await Promise.all(days.map(d => api.getSummary(d, d, shopMids)));
      const merged = {};
      for (const res of results) {
        for (const item of res.data.items) {
          if (!merged[item.product_id]) merged[item.product_id] = { ...item, total_weight: 0 };
          merged[item.product_id].total_weight += item.total_weight;
        }
      }
      const mergedItems = Object.values(merged).map(item => {
        const exact   = item.total_weight / item.package_weight;
        const rounded = item.sold_by_weight ? exact : Math.ceil(exact);
        const cost    = Math.round(rounded * item.price_per_package * 100) / 100;
        return { ...item, packages_exact: exact, packages_rounded: rounded, total_cost: cost, actual_cost: Math.round(exact * item.price_per_package * 100) / 100 };
      }).sort((a, b) => a.product_name.localeCompare(b.product_name, 'pl'));
      const total = mergedItems.reduce((s, i) => s + i.total_cost, 0);
      const html = generateShopListHTML({ items: mergedItems, total, selectedDays: days, memberLabel: shopMemberLabel });
      const win = window.open('', '_blank'); win.document.write(html); win.document.close();
    } catch { showError('Nie udało się wygenerować listy zakupów'); }
    finally { setShopLoading(false); }
  };

  const getHtmlRange = () => {
    if (htmlPeriod === 'week')   return week;
    if (htmlPeriod === 'month')  return month;
    return htmlCustom;
  };
  const getHtmlPeriodLabel = () => {
    if (htmlPeriod === 'week')  return `Bieżący tydzień (${toEU(week.start)} – ${toEU(week.end)})`;
    if (htmlPeriod === 'month') return `Bieżący miesiąc (${toEU(month.start)} – ${toEU(month.end)})`;
    const r = htmlCustom;
    return r.start && r.end ? `${toEU(r.start)} – ${toEU(r.end)}` : '';
  };

  const handleGenWydatki = async () => {
    const range = getHtmlRange();
    if (!range.start || !range.end) { showError('Wybierz okres'); return; }
    setHtmlWLoading(true);
    try {
      const res = await api.getSummary(range.start, range.end, mids);
      const d = res.data;
      const days = Math.round((new Date(range.end) - new Date(range.start)) / 86400000) + 1;
      const categories = [{ label: 'Jedzenie', value: d.total_cost }];
      const drinkItems = calcDrinks(days);
      const drinkTotal = drinkItems.reduce((s, i) => s + i.total, 0);
      if (drinkTotal > 0) categories.push({ label: 'Napoje', value: drinkTotal });
      calcOtherSummary(days).forEach(item => categories.push({ label: item.label, value: item.total }));
      const total = categories.reduce((s, c) => s + c.value, 0);
      const html = generateWydatkiHTML({ categories, total, periodLabel: getHtmlPeriodLabel(), memberLabel });
      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
    } catch { showError('Nie udało się pobrać danych wydatków'); }
    finally { setHtmlWLoading(false); }
  };

  const handleGenKalendar = async () => {
    const range = getHtmlRange();
    if (!range.start || !range.end) { showError('Wybierz okres'); return; }
    setHtmlKLoading(true);
    try {
      const res = await api.getRange(range.start, range.end, mids);
      const html = generateKalendarzHTML({ mealsByDate: res.data, start: range.start, end: range.end, periodLabel: getHtmlPeriodLabel(), memberName: memberLabel });
      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
    } catch { showError('Nie udało się pobrać kalendarza'); }
    finally { setHtmlKLoading(false); }
  };

  const handleGenSkladniki = () => {
    const recipe = recipes.find(r => String(r.id) === htmlRecipeId);
    if (!recipe) { showError('Wybierz przepis'); return; }
    const html = generateSkladnikiHTML(recipe);
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  };

  const DIV = <div style={{ borderTop:'1px solid #374151', margin:'18px 0' }} />;
  const LBL = { fontSize:11, color:'#6b7280', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:700 };

  return (
    <div>
      <div className="card" style={{ padding:'16px 20px', marginBottom:12 }}>
        <div style={{ display:'flex', gap:20, alignItems:'flex-start' }}>
        <div style={{ flexShrink:0 }}>

        {/* ── Generuj dokumenty ─────────────────────────── */}
        <h2 style={{ marginBottom:12 }}>Generuj dokumenty</h2>

        <div style={{ marginBottom:12 }}>
          <div style={LBL}>Okres (wydatki i kalendarz)</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <ToggleChip active={htmlPeriod==='week'}   onClick={()=>setHtmlPeriod('week')}>Bieżący tydzień</ToggleChip>
            <ToggleChip active={htmlPeriod==='month'}  onClick={()=>setHtmlPeriod('month')}>Bieżący miesiąc</ToggleChip>
            <ToggleChip active={htmlPeriod==='custom'} onClick={()=>setHtmlPeriod('custom')}>Własny</ToggleChip>
          </div>
          {htmlPeriod === 'custom' && (
            <div style={{ marginTop:10, display:'flex', gap:12, flexWrap:'wrap' }}>
              {[{key:'start',label:'Od'},{key:'end',label:'Do'}].map(({key,label}) => (
                <div key={key}>
                  <div style={{ fontSize:11, color:'#6b7280', marginBottom:3 }}>{label}</div>
                  <div style={{ position:'relative' }}>
                    <input type="text" readOnly placeholder="dd.mm.rrrr"
                      value={htmlCustom[key] ? toEU(htmlCustom[key]) : ''}
                      style={{ padding:'6px 10px', border:'1px solid #374151', borderRadius:6, fontSize:13, color:'#f1f5f9', background:'#111827', width:130, cursor:'pointer' }} />
                    <input type="date" value={htmlCustom[key]||''}
                      onChange={e => setHtmlCustom(r=>({...r,[key]:e.target.value}))}
                      style={{ position:'absolute', inset:0, opacity:0, width:'100%', height:'100%', cursor:'pointer' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {members.length > 1 && (
          <div style={{ marginBottom:14 }}>
            <div style={LBL}>Kogo uwzględniamy</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', width:0, minWidth:'100%' }}>
              {members.map((m, idx) => {
                const checked = selectedMemberIds.includes(m.id);
                const color = ['#0d9488','#6366f1','#f59e0b','#ec4899','#22c55e','#ef4444'][idx%6];
                return (
                  <button key={m.id} onClick={() => toggleMember(m.id)}
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 14px', borderRadius:20, cursor: m.id===activeMember?.id?'default':'pointer', fontSize:12, fontWeight: checked?700:400, transition:'all 0.15s',
                      border:`1px solid ${checked?color:'#374151'}`, background: checked?`${color}22`:'#1f2937', color: checked?color:'#6b7280' }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background: checked?color:'#374151', flexShrink:0 }} />
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'stretch', width:'100%' }}>
          <button className="btn btn-primary" onClick={handleGenWydatki} disabled={htmlWLoading}
            style={{ padding:'8px 12px', fontSize:13, fontWeight:700 }}>
            {htmlWLoading ? 'Generuję...' : 'Podsumowanie wydatków'}
          </button>
          <button className="btn btn-primary" onClick={handleExportMacro}
            style={{ padding:'8px 12px', fontSize:13, fontWeight:700 }}>
            Karta Makro
          </button>
          <button className="btn btn-primary" onClick={handleGenKalendar} disabled={htmlKLoading}
            style={{ padding:'8px 12px', fontSize:13, fontWeight:700 }}>
            {htmlKLoading ? 'Generuję...' : 'Karta Kalendarza'}
          </button>
          <div style={{ position:'relative' }}>
            <button type="button" className="btn btn-primary"
              onClick={() => { setSkladnikiOpen(v => !v); setSkladnikiSearch(''); setHtmlRecipeId(''); }}
              style={{ padding:'8px 12px', fontSize:13, fontWeight:700, width:'100%' }}>
              Składniki przepisu
            </button>
            {skladnikiOpen && (
              <div style={{
                position:'absolute', top:'calc(100% + 6px)', left:0,
                width:'100%',
                background:'#1c2433', border:'1px solid #374151', borderRadius:10,
                padding:'12px', zIndex:100, boxShadow:'0 8px 24px rgba(0,0,0,0.5)',
              }}>
                <input type="text" placeholder="Wyszukaj przepis..." autoFocus
                  value={skladnikiSearch} onChange={e => { setSkladnikiSearch(e.target.value); setHtmlRecipeId(''); }}
                  style={{ width:'100%', padding:'8px 12px', fontSize:13, border:'1px solid #374151', borderRadius:8, background:'#111827', color:'#e2e8f0', marginBottom:8, boxSizing:'border-box' }} />
                {skladnikiSearch.trim() && (
                  <div style={{ maxHeight:200, overflowY:'auto', border:'1px solid #374151', borderRadius:8, marginBottom:10 }}>
                    {recipes.filter(r => r.name.toLowerCase().includes(skladnikiSearch.toLowerCase())).slice(0, 20).map(r => (
                      <div key={r.id} onClick={() => { setHtmlRecipeId(String(r.id)); setSkladnikiSearch(''); }}
                        style={{ padding:'8px 12px', cursor:'pointer', fontSize:13, transition:'background 0.1s',
                          color:'#e2e8f0', borderBottom:'1px solid #1f2937' }}
                        onMouseEnter={e => e.currentTarget.style.background='#0d948822'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        {r.name}
                      </div>
                    ))}
                    {recipes.filter(r => r.name.toLowerCase().includes(skladnikiSearch.toLowerCase())).length === 0 && (
                      <div style={{ padding:'12px', fontSize:12, color:'#6b7280', textAlign:'center' }}>Brak wyników</div>
                    )}
                  </div>
                )}
                {htmlRecipeId && !skladnikiSearch.trim() && (
                  <div>
                    <div style={{ fontSize:12, color:'#2dd4bf', fontWeight:600, marginBottom:10, padding:'2px 0' }}>
                      {recipes.find(r => String(r.id) === htmlRecipeId)?.name}
                    </div>
                    <button className="btn btn-primary" onClick={handleGenSkladniki}
                      style={{ width:'100%', padding:'9px', fontSize:14, fontWeight:700 }}>
                      Eksportuj składniki
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        </div>{/* end left column */}

        <div style={{ width:1, background:'#374151', alignSelf:'stretch', flexShrink:0 }} />

        {/* ── Lista zakupów (obok przycisków) ──────────────  */}
        <div style={{ flexShrink:0, width:280 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <h2 style={{ margin:0, fontSize:15 }}>Lista zakupów</h2>
            {onGoToTab && (
              <button onClick={() => onGoToTab('calendar')}
                style={{ background:'#0d948820', border:'1px solid #0d9488', borderRadius:6, color:'#2dd4bf', fontSize:11, fontWeight:600, padding:'3px 10px', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                Idź do kalendarza
              </button>
            )}
          </div>
          <p style={{ fontSize:12, color:'#6b7280', margin:'0 0 10px', lineHeight:1.4 }}>
            Zaznacz dni — lista produktów z przepisów przeliczona na opakowania.
          </p>

          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
            <button onClick={prevShopMonth}
              style={{ background:'#1f2937', border:'1px solid #374151', borderRadius:6, color:'#9ca3af', width:26, height:26, cursor:'pointer', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              ‹
            </button>
            <span style={{ flex:1, textAlign:'center', fontWeight:700, fontSize:13, color:'#e2e8f0' }}>
              {MONTH_NAMES_PL[shopMonth]} {shopYear}
            </span>
            <button onClick={nextShopMonth}
              style={{ background:'#1f2937', border:'1px solid #374151', borderRadius:6, color:'#9ca3af', width:26, height:26, cursor:'pointer', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              ›
            </button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:2 }}>
            {['Pn','Wt','Śr','Cz','Pt','So','Nd'].map(d => (
              <div key={d} style={{ textAlign:'center', fontSize:9, fontWeight:700, color:'#6b7280', padding:'2px 0' }}>{d}</div>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:8 }}>
            {getCalGrid(shopYear, shopMonth).map(day => {
              const ds = dateToStr(day);
              const isCurrentMonth = day.getMonth() === shopMonth;
              const isToday = ds === dateToStr(new Date());
              const isSel = shopDays.has(ds);
              return (
                <div key={ds} onClick={() => toggleShopDay(ds)}
                  style={{
                    height:30, borderRadius:5, cursor:'pointer', fontSize:11,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontWeight: isSel ? 700 : 400, userSelect:'none', transition:'all 0.1s',
                    background: isSel ? '#0d9488' : 'transparent',
                    color: isSel ? '#fff' : isCurrentMonth ? '#e2e8f0' : '#374151',
                    border: isToday && !isSel ? '1px solid #0d9488' : '1px solid transparent',
                    opacity: isCurrentMonth ? 1 : 0.2,
                  }}>
                  {day.getDate()}
                </div>
              );
            })}
          </div>

          <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:8 }}>
            <ToggleChip active={false} onClick={selectShopWeek}>Bieżący tydzień</ToggleChip>
            <ToggleChip active={false} onClick={selectShopMonth}>Ten miesiąc</ToggleChip>
            {shopDays.size > 0 && <ToggleChip active={false} onClick={() => setShopDays(new Set())}>Wyczyść</ToggleChip>}
          </div>

          {shopDays.size > 0 && (
            <div style={{ fontSize:11, color:'#0d9488', fontWeight:600, marginBottom:8 }}>
              Zaznaczono: {shopDays.size} {shopDays.size === 1 ? 'dzień' : 'dni'}
            </div>
          )}

          {members.length > 1 && (
            <div style={{ marginBottom:10 }}>
              <div style={{ ...LBL, fontSize:10, marginBottom:6 }}>Uwzględnij profile</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {members.map((m, idx) => {
                  const checked = shopMemberIds.includes(m.id);
                  const color = ['#0d9488','#6366f1','#f59e0b','#ec4899','#22c55e','#ef4444'][idx%6];
                  return (
                    <button key={m.id} onClick={() => toggleShopMember(m.id)}
                      style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, cursor: m.id===activeMember?.id?'default':'pointer', fontSize:11, fontWeight: checked?700:400, transition:'all 0.15s',
                        border:`1px solid ${checked?color:'#374151'}`, background: checked?`${color}22`:'#1f2937', color: checked?color:'#6b7280' }}>
                      <span style={{ width:7, height:7, borderRadius:'50%', background: checked?color:'#374151', flexShrink:0 }} />
                      {m.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button className="btn btn-primary" onClick={handleGenShopList}
            disabled={shopLoading || shopDays.size === 0}
            style={{ width:'100%', padding:'8px', fontSize:13, fontWeight:700 }}>
            {shopLoading ? 'Generuję...' : `Generuj listę zakupów${shopDays.size > 0 ? ` (${shopDays.size} ${shopDays.size === 1 ? 'dzień' : 'dni'})` : ''}`}
          </button>
        </div>

        <div style={{ width:1, background:'#374151', alignSelf:'stretch', flexShrink:0 }} />

        {/* ── Podgląd (wypełnia resztę, reaguje na wybrany okres) ─ */}
        {(() => {
          const SLOT_COLORS = ['#4a6fa5','#93c5fd','#fcd34d','#c2410c','#6366f1'];
          const todayStr = dateToStr(new Date());
          const previewRange = htmlPeriod === 'week' ? week
            : htmlPeriod === 'month' ? month
            : (htmlCustom.start && htmlCustom.end) ? htmlCustom : week;
          const previewLabel = htmlPeriod === 'week'
            ? `${toEU(week.start)} – ${toEU(week.end)}`
            : htmlPeriod === 'month'
            ? `${toEU(month.start)} – ${toEU(month.end)}`
            : (htmlCustom.start && htmlCustom.end) ? `${toEU(htmlCustom.start)} – ${toEU(htmlCustom.end)}`
            : `${toEU(week.start)} – ${toEU(week.end)}`;

          const startD = new Date(previewRange.start || week.start);
          const endD   = new Date(previewRange.end   || week.end);
          const sDow   = (startD.getDay() + 6) % 7;
          const gridS  = new Date(startD); gridS.setDate(gridS.getDate() - sDow);
          const eDow   = (endD.getDay() + 6) % 7;
          const gridE  = new Date(endD); if (eDow < 6) gridE.setDate(gridE.getDate() + (6 - eDow));
          const allDays = [];
          const cur = new Date(gridS);
          while (cur <= gridE) { allDays.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
          const weeksArr = [];
          for (let i = 0; i < allDays.length; i += 7) weeksArr.push(allDays.slice(i, i + 7));
          const rStart = previewRange.start || week.start;
          const rEnd   = previewRange.end   || week.end;
          const totalMeals    = allDays.reduce((s, d) => s + (previewMeals[dateToStr(d)]||[]).length, 0);
          const daysWithMeals = allDays.filter(d => ds => (previewMeals[ds]||[]).length > 0);

          return (
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <span style={{ fontSize:13, fontWeight:700, color:'#e2e8f0' }}>Podgląd</span>
                <span style={{ fontSize:11, color:'#6b7280' }}>{previewLabel}</span>
              </div>
              {previewLoading ? (
                <div style={{ fontSize:12, color:'#6b7280', textAlign:'center', padding:'20px 0' }}>Ładowanie...</div>
              ) : (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, marginBottom:3 }}>
                    {['Pn','Wt','Śr','Cz','Pt','So','Nd'].map(d => (
                      <div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:700, color:'#6b7280', paddingBottom:3 }}>{d}</div>
                    ))}
                  </div>
                  {weeksArr.map((wk, wi) => (
                    <div key={wi} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, marginBottom:3 }}>
                      {wk.map(day => {
                        const ds = dateToStr(day);
                        const isToday = ds === todayStr;
                        const inRange = ds >= rStart && ds <= rEnd;
                        const meals = (previewMeals[ds] || []).slice().sort((a,b) => a.position - b.position);
                        return (
                          <div key={ds} style={{
                            background: isToday ? '#162626' : '#1f2937',
                            border: `1px solid ${isToday ? '#0d9488' : '#374151'}`,
                            borderRadius:6, padding:'4px 3px', minHeight:54,
                            opacity: inRange ? 1 : 0.3,
                          }}>
                            <div style={{ textAlign:'center', fontSize:10, fontWeight: isToday?700:500, color: isToday?'#2dd4bf':'#94a3b8', marginBottom:2 }}>
                              {day.getDate()}
                            </div>
                            {meals.length === 0
                              ? <div style={{ textAlign:'center', fontSize:9, color:'#374151', marginTop:4 }}>—</div>
                              : meals.map(m => {
                                  const col = SLOT_COLORS[(m.position-1)%5];
                                  return (
                                    <div key={m.id} style={{
                                      background:`${col}22`, borderLeft:`2px solid ${col}`, borderRadius:2,
                                      padding:'1px 3px', marginBottom:2, fontSize:8, color:'#e2e8f0',
                                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                                    }} title={m.recipe?.name}>
                                      {m.recipe?.name || ''}
                                    </div>
                                  );
                                })
                            }
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div style={{ fontSize:11, color: totalMeals > 0 ? '#6b7280' : '#374151', textAlign:'center', marginTop:2 }}>
                    {totalMeals === 0
                      ? 'Brak zaplanowanych posiłków'
                      : `${daysWithMeals.length} ${daysWithMeals.length === 1 ? 'dzień' : 'dni'} z posiłkami · ${totalMeals} ${totalMeals === 1 ? 'posiłek' : totalMeals < 5 ? 'posiłki' : 'posiłków'}`}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        </div>{/* end flex row */}
      </div>{/* end card */}

      {/* ── Karta pomocy ── */}
      <div className="card" style={{ marginTop: 12, background: '#1c3534', border: '1px solid #374151', borderRadius: 8, padding: '14px 16px', fontSize: 13, lineHeight: 1.7 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0d9488', marginBottom: 12 }}>Jak działa eksport?</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

          {[
            {
              label: 'Podsumowanie wydatków',
              desc: 'Wydatki na jedzenie + koszty stałe zaznaczone w zakładce Wydatki (czynsz, prąd, gaz…), przeliczone proporcjonalnie na liczbę dni.',
            },
            {
              label: 'Karta Makro',
              desc: 'Eksport danych z Kalkulatora Makro — dane osobowe, BMI, zapotrzebowanie kaloryczne i docelowe makroskładniki.',
            },
            {
              label: 'Karta Kalendarza',
              desc: 'Wydruk planu posiłków. Przed wydrukiem możesz włączyć lub wyłączyć widoczność kcal i makro przy każdym dniu.',
            },
            {
              label: 'Składniki przepisu',
              desc: 'Wyszukaj przepis wpisując jego nazwę, a następnie wyeksportuj listę składników z ilościami i cenami gotową do wydruku.',
            },
            {
              label: 'Lista zakupów',
              desc: 'Zaznacz dni, lista produktów z przepisów przeliczona na opakowania. Przed wydrukiem możesz usunąć pozycje z listy zakupów.',
            },
            {
              label: 'Podgląd tygodnia',
              desc: 'Miniaturowy widok kalendarza reagujący na wybrany okres (bieżący tydzień / miesiąc / zakres własny). Pokazuje jakie posiłki są zaplanowane w danym dniu.',
            },
          ].map(({ label, desc }) => (
            <div key={label} style={{ background: '#111827', border: '1px solid #374151', borderRadius: 6, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', background: '#1e3a3a', color: '#2dd4bf', border: '1px solid #374151', borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700, alignSelf: 'flex-start' }}>{label}</span>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>{desc}</span>
            </div>
          ))}

        </div>
      </div>
    </div>
  );
}
